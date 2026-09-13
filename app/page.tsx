"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import axios from 'axios';
import { QRCodeSVG } from 'qrcode.react';

const MAX_STAKE = 10000;
const MAX_WIN = 10000;
const MIN_STAKE = 20;

// NOTE: left as a literal localhost URL on purpose (not switched to an env var) —
// just centralized into one constant so it isn't repeated 5 times across the file.
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

// ---------- Basic shared types (state boundaries only; raw odds-feed parsing stays "any" on purpose,
// since that shape is dynamic/foreign and forcing strict types on it would be guesswork). ----------
interface OddOption {
    odd_id: string;
    option: string;
    value: string;
}

interface BetSlipItem {
    fixture_id: string | number;
    home_team: string;
    away_team: string;
    match_time: string;
    league_name: string;
    market_name: string;
    odd_id: string;
    odd_name: string;
    odd_value: number;
}

interface Fixture {
    id: string | number;
    home_team: string;
    away_team: string;
    match_time: string;
    league: string;
    league_flag?: string;
    odds: OddOption[];
    dc_odds: OddOption[];
    raw_markets: any[];
    total_markets_count: number;
}

// ---------- Shared odds/id helpers ----------
const sanitizeIdPart = (s: any) => String(s ?? '').trim().replace(/[^a-zA-Z0-9+\-.]/g, '_');

const getMarketKind = (mkt: any): 'h2h' | 'dc' | 'other' => {
    const idNum = Number(mkt?.id);
    const key = mkt?.key;
    const title = String(mkt?.name || mkt?.title || '').toLowerCase();
    if (idNum === 1 || idNum === 13 || key === 'h2h' || ['match winner', '3 way', 'full time result', 'first half winner'].includes(title)) return 'h2h';
    if (idNum === 12 || key === 'double_chance' || title.includes('double chance')) return 'dc';
    return 'other';
};

const standardizeOptionLabel = (kind: 'h2h' | 'dc' | 'other', rawLabel: any, game: any) => {
    const label = String(rawLabel ?? '').trim();
    if (kind === 'h2h') {
        if (label === game?.home_team || label === 'Home' || label === '1') return '1';
        if (label === 'Draw' || label === 'X') return 'X';
        if (label === game?.away_team || label === 'Away' || label === '2') return '2';
        return label;
    }
    if (kind === 'dc') {
        if (['1X', '12', 'X2'].includes(label)) return label;
        if (label.includes('Home') && label.includes('Draw')) return '1X';
        if (label.includes('Home') && label.includes('Away')) return '12';
        if (label.includes('Draw') && label.includes('Away')) return 'X2';
        return label;
    }
    return label;
};

const buildOddId = (marketRef: any, optionLabel: any, gameId: any) =>
    `${sanitizeIdPart(marketRef)}_${sanitizeIdPart(optionLabel)}_${gameId}`;

const escapeHtml = (str: any) =>
    String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');

// Renders a CODE128 barcode into an inline <svg>. jsbarcode is imported dynamically inside the
// effect (client-only) so it never runs during server rendering.
function BarcodeSVG({ value, lineColor = '#000000', className }: { value: string; lineColor?: string; className?: string }) {
    const svgRef = useRef<SVGSVGElement>(null);
    useEffect(() => {
        if (!svgRef.current || !value) return;
        let cancelled = false;
        import('jsbarcode').then(({ default: JsBarcode }) => {
            if (cancelled || !svgRef.current) return;
            try {
                JsBarcode(svgRef.current, value, {
                    format: 'CODE128',
                    width: 1.6,
                    height: 46,
                    displayValue: false,
                    margin: 0,
                    background: 'transparent',
                    lineColor
                });
            } catch (e) {
                // value has characters CODE128 can't encode — leave the svg empty rather than crash
            }
        });
        return () => { cancelled = true; };
    }, [value, lineColor]);
    return <svg ref={svgRef} className={className} />;
}

// "Sat, Sep 12 5:00 PM" style formatting for each pick on the receipt.
const formatMatchDateTime = (iso: string) => {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    const datePart = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    const timePart = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    return `${datePart} ${timePart}`;
};

const PLACED_SIGNATURES_KEY = 'vibebet_placed_signatures';

export default function Home() {
    const [isMounted, setIsMounted] = useState(false);
    const [fixtures, setFixtures] = useState<Fixture[]>([]);
    const [betSlip, setBetSlip] = useState<BetSlipItem[]>([]);
    const [stake, setStake] = useState<number>(20);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [isFetchingFixtures, setIsFetchingFixtures] = useState<boolean>(true);
    const [bookingCode, setBookingCode] = useState<string | null>(null);
    const [isBookingPreviewOpen, setIsBookingPreviewOpen] = useState<boolean>(false);
    const [codeCopied, setCodeCopied] = useState<boolean>(false);
    const receiptRef = useRef<HTMLDivElement>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState<string>('');

    const [ticketCodeInput, setTicketCodeInput] = useState<string>('');
    const [ticketLoadError, setTicketLoadError] = useState<string | null>(null);
    const [placedBetSignatures, setPlacedBetSignatures] = useState<string[]>([]);

    const [selectedMatch, setSelectedMatch] = useState<Fixture | null>(null);
    const [marketTab, setMarketTab] = useState<string>('MAIN');

    const [selectedLeague, setSelectedLeague] = useState<string>('Upcoming');
    const [isTopLeaguesOpen, setIsTopLeaguesOpen] = useState(true);
    const [isSoccerOpen, setIsSoccerOpen] = useState(true);
    const [openCountry, setOpenCountry] = useState<string | null>(null);

    const [openAccordions, setOpenAccordions] = useState<string[]>([]);

    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isMobileBetSlipOpen, setIsMobileBetSlipOpen] = useState(false);

    const [isCheckTicketModalOpen, setIsCheckTicketModalOpen] = useState(false);
    const [checkInputCode, setCheckInputCode] = useState('');
    const [checkedTicketData, setCheckedTicketData] = useState<any>(null);
    const [isCheckingTicket, setIsCheckingTicket] = useState(false);
    const [checkTicketError, setCheckTicketError] = useState<string | null>(null);

    const [mainMarketView, setMainMarketView] = useState<'1X2' | 'DC'>('1X2');
    const [isCountryDropdownOpen, setIsCountryDropdownOpen] = useState(false);
    const [selectedCountryFilter, setSelectedCountryFilter] = useState<string>('All Countries');

    const [acceptOddsChange, setAcceptOddsChange] = useState<boolean>(true);
    const acceptOddsChangeRef = useRef(acceptOddsChange);
    useEffect(() => {
        acceptOddsChangeRef.current = acceptOddsChange;
    }, [acceptOddsChange]);

    const [flashingOdds, setFlashingOdds] = useState<Record<string, 'up' | 'down'>>({});
    const prevFixturesRef = useRef<any[]>([]);
    const isPollingRef = useRef(false);
    const flashTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const today = new Date();
    const todayStr = today.toDateString();

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toDateString();

    const dayAfterTmw = new Date(today);
    dayAfterTmw.setDate(dayAfterTmw.getDate() + 2);
    const dayAfterTmwStr = dayAfterTmw.toDateString();
    const dayAfterTmwLabel = dayAfterTmw.toLocaleDateString('en-US', { weekday: 'short' });

    const [selectedDateFilter, setSelectedDateFilter] = useState<string>('All');
    const dateInputRef = useRef<HTMLInputElement>(null);
    const [isOnline, setIsOnline] = useState<boolean>(true);

    useEffect(() => {
        setIsMounted(true);
        document.title = "vibebet.et";
        setIsOnline(navigator.onLine);
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    useEffect(() => {
        try {
            const stored = localStorage.getItem('vibebet_placed_signatures');
            if (stored) setPlacedBetSignatures(JSON.parse(stored));
        } catch (e) { }
    }, []);

    useEffect(() => {
        try {
            localStorage.setItem('vibebet_placed_signatures', JSON.stringify(placedBetSignatures));
        } catch (e) { }
    }, [placedBetSignatures]);

    useEffect(() => {
        prevFixturesRef.current = fixtures;
    }, [fixtures]);

    const formatFixturesData = useCallback((data: any[]) => {
        return data.map((game: any) => {
            let parsedOdds: OddOption[] = [
                { odd_id: buildOddId('h2h', '1', game.id), option: "1", value: "0.00" },
                { odd_id: buildOddId('h2h', 'X', game.id), option: "X", value: "0.00" },
                { odd_id: buildOddId('h2h', '2', game.id), option: "2", value: "0.00" }
            ];
            let dcOdds: OddOption[] = [
                { odd_id: buildOddId('dc', '1X', game.id), option: "1X", value: "0.00" },
                { odd_id: buildOddId('dc', '12', game.id), option: "12", value: "0.00" },
                { odd_id: buildOddId('dc', 'X2', game.id), option: "X2", value: "0.00" }
            ];
            let rawMarkets: any[] = [];
            let tMarketsCount = 0;

            try {
                const bookmakers = typeof game.odds_data === 'string' ? JSON.parse(game.odds_data) : game.odds_data;

                if (bookmakers && bookmakers[0]) {
                    rawMarkets = bookmakers[0].bets || bookmakers[0].markets || [];
                }
                tMarketsCount = rawMarkets.length;

                const h2h = rawMarkets.find((m: any) => getMarketKind(m) === 'h2h');
                if (h2h) {
                    const marketRef = h2h.key || h2h.id;
                    const outcomesArray = h2h.values || h2h.outcomes || [];
                    const o1 = outcomesArray.find((o: any) => standardizeOptionLabel('h2h', o.value || o.name, game) === '1');
                    const oX = outcomesArray.find((o: any) => standardizeOptionLabel('h2h', o.value || o.name, game) === 'X');
                    const o2 = outcomesArray.find((o: any) => standardizeOptionLabel('h2h', o.value || o.name, game) === '2');

                    if (o1) parsedOdds[0] = { odd_id: buildOddId(marketRef, '1', game.id), option: "1", value: parseFloat(o1.odd || o1.price).toFixed(2) };
                    if (oX) parsedOdds[1] = { odd_id: buildOddId(marketRef, 'X', game.id), option: "X", value: parseFloat(oX.odd || oX.price).toFixed(2) };
                    if (o2) parsedOdds[2] = { odd_id: buildOddId(marketRef, '2', game.id), option: "2", value: parseFloat(o2.odd || o2.price).toFixed(2) };
                }

                const dcMarket = rawMarkets.find((m: any) => getMarketKind(m) === 'dc');
                if (dcMarket) {
                    const marketRef = dcMarket.key || dcMarket.id;
                    const outcomesArray = dcMarket.values || dcMarket.outcomes || [];
                    const o1X = outcomesArray.find((o: any) => standardizeOptionLabel('dc', o.value || o.name, game) === '1X');
                    const o12 = outcomesArray.find((o: any) => standardizeOptionLabel('dc', o.value || o.name, game) === '12');
                    const oX2 = outcomesArray.find((o: any) => standardizeOptionLabel('dc', o.value || o.name, game) === 'X2');

                    if (o1X) dcOdds[0] = { odd_id: buildOddId(marketRef, '1X', game.id), option: "1X", value: parseFloat(o1X.odd || o1X.price).toFixed(2) };
                    if (o12) dcOdds[1] = { odd_id: buildOddId(marketRef, '12', game.id), option: "12", value: parseFloat(o12.odd || o12.price).toFixed(2) };
                    if (oX2) dcOdds[2] = { odd_id: buildOddId(marketRef, 'X2', game.id), option: "X2", value: parseFloat(oX2.odd || oX2.price).toFixed(2) };
                }
            } catch (e) { }

            return {
                id: game.id,
                home_team: game.home_team || "Home",
                away_team: game.away_team || "Away",
                match_time: game.commence_time,
                league: game.sport_key || "World|Soccer|https://media.api-sports.io/flags/un.svg",
                league_flag: game.league_logo,
                odds: parsedOdds,
                dc_odds: dcOdds,
                raw_markets: rawMarkets,
                total_markets_count: tMarketsCount
            };
        });
    }, []);

    useEffect(() => {
        const fetchInitialData = async () => {
            setIsFetchingFixtures(true);
            try {
                const res = await axios.get(`${API_BASE}/api/matches/list`);
                if (res.data.success) {
                    setFixtures(formatFixturesData(res.data.data));
                }
            } catch (err) {
            } finally {
                setIsFetchingFixtures(false);
            }
        };

        const fetchPollingData = async () => {
            if (isPollingRef.current) return;
            isPollingRef.current = true;
            try {
                const res = await axios.get(`${API_BASE}/api/matches/list`);
                if (res.data.success) {
                    const formattedNew = formatFixturesData(res.data.data);
                    const prevFixtures = prevFixturesRef.current;
                    const changes: Record<string, 'up' | 'down'> = {};
                    const newOddsVals: Record<string, number> = {};

                    formattedNew.forEach((newGame: any) => {
                        const oldGame = prevFixtures.find((g: any) => g.id === newGame.id);
                        if (oldGame) {
                            newGame.raw_markets.forEach((newMkt: any) => {
                                const oldMkt = oldGame.raw_markets.find((m: any) => m.id === newMkt.id || m.key === newMkt.key);
                                if (oldMkt) {
                                    const kind = getMarketKind(newMkt);
                                    const marketRef = newMkt.key || newMkt.id;
                                    const newOutcomes = newMkt.values || newMkt.outcomes || [];
                                    const oldOutcomes = oldMkt.values || oldMkt.outcomes || [];

                                    newOutcomes.forEach((newOpt: any) => {
                                        const newLabel = standardizeOptionLabel(kind, newOpt.name || newOpt.value, newGame);
                                        const oldOpt = oldOutcomes.find((o: any) => standardizeOptionLabel(kind, o.name || o.value, newGame) === newLabel);
                                        if (oldOpt) {
                                            const nP = parseFloat(newOpt.price || newOpt.odd || "0");
                                            const oP = parseFloat(oldOpt.price || oldOpt.odd || "0");

                                            if (nP !== oP && nP > 0) {
                                                const oddId = buildOddId(marketRef, newLabel, newGame.id);
                                                if (nP > oP) changes[oddId] = 'up';
                                                else if (nP < oP) changes[oddId] = 'down';

                                                newOddsVals[oddId] = nP;
                                            }
                                        }
                                    });
                                }
                            });
                        }
                    });

                    if (Object.keys(changes).length > 0) {
                        setFlashingOdds((prev: any) => ({ ...prev, ...changes }));
                        if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
                        flashTimeoutRef.current = setTimeout(() => setFlashingOdds({}), 4000);

                        setBetSlip(prevSlip => {
                            if (!acceptOddsChangeRef.current) return prevSlip;
                            
                            let hasChange = false;
                            const updatedSlip = prevSlip.map(item => {
                                if (newOddsVals[item.odd_id] !== undefined && newOddsVals[item.odd_id] !== item.odd_value) {
                                    hasChange = true;
                                    return { ...item, odd_value: newOddsVals[item.odd_id] };
                                }
                                return item;
                            });
                            
                            return hasChange ? updatedSlip : prevSlip;
                        });
                    }

                    setFixtures(formattedNew);
                }
            } catch (err) {
            } finally {
                isPollingRef.current = false;
            }
        };

        fetchInitialData();
        const intervalId = setInterval(fetchPollingData, 15000);
        return () => {
            clearInterval(intervalId);
            if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
        };
    }, [formatFixturesData]);

    const clearBookingCode = () => { setBookingCode(null); setIsBookingPreviewOpen(false); };

    const toggleSelection = (game: any, odd: any, marketName: string = '1x2') => {
        if (!odd || odd.value === "0.00" || odd.value === "-") return;
        clearBookingCode();
        setErrorMessage(null);
        setBetSlip((prev: any[]) => {
            const exists = prev.find((item: any) => item.fixture_id === game.id);
            if (exists && exists.odd_id === odd.odd_id) return prev.filter((item: any) => item.fixture_id !== game.id);
            const newItem: BetSlipItem = {
                fixture_id: game.id, home_team: game.home_team, away_team: game.away_team,
                match_time: game.match_time, league_name: getLeagueDetails(game.league).name,
                market_name: marketName,
                odd_id: odd.odd_id, odd_name: odd.option, odd_value: parseFloat(odd.value)
            };
            return [...prev.filter((item: any) => item.fixture_id !== game.id), newItem];
        });
    };

    const handleMarketSelection = (game: any, odd: any, marketName: string) => {
        toggleSelection(game, odd, marketName);
        setSelectedMatch(null);
    };

    const totalOdds = betSlip.reduce((total: number, item: any) => total * (item.odd_value || 1), 1).toFixed(2);
    const safeStake = Number.isFinite(stake) ? stake : 0;
    const grossWin = parseFloat(totalOdds) * safeStake;

    const isUnderStake = safeStake < MIN_STAKE;
    const isOverStake = safeStake > MAX_STAKE;
    const isOverWin = grossWin > MAX_WIN;
    const currentBetSignature = betSlip.map((i: any) => i.odd_id).sort().join('|');
    const isDuplicateBet = betSlip.length > 0 && placedBetSignatures.includes(currentBetSignature);

    let limitWarning = null;
    if (isUnderStake) limitWarning = `ዝቅተኛው መቁረጫ ሂሳብ ${MIN_STAKE} ብር ነው!`;
    else if (isOverStake) limitWarning = `ከ ${MAX_STAKE.toLocaleString()} ብር በላይ መቁረጥ አይቻልም!`;
    else if (isOverWin) limitWarning = `ከ ${MAX_WIN.toLocaleString()} ብር በላይ ማሸነፍ አይቻልም!`;
    else if (isDuplicateBet) limitWarning = "ይህ ምርጫ (ትኬት) ተቆርጧል! ሌላ ሰው ኮፒ ማድረግ አይችልም።";

    const handlePlaceBet = async () => {
        if (betSlip.length === 0 || safeStake < MIN_STAKE || limitWarning) return;
        setIsLoading(true);
        setErrorMessage(null);
        try {
            const payload = {
                stake_amount: safeStake,
                is_guest: true,
                accept_odds_change: acceptOddsChange,
                selections: betSlip.map((item: any) => ({ fixture_id: item.fixture_id, odd_id: item.odd_id, odd_value: item.odd_value, match_info: `${item.home_team} vs ${item.away_team}`, odd_name: item.odd_name }))
            };
            const response = await axios.post(`${API_BASE}/api/tickets/place`, payload);

            if (response.data.success) {
                const bCode = response.data.booking_code || response.data.data?.booking_code;
                setBookingCode(bCode);
                setIsBookingPreviewOpen(false);
                setPlacedBetSignatures((prev: any) => [...prev, currentBetSignature]);
                if (window.innerWidth < 1024) setIsMobileBetSlipOpen(false);
            } else {
                setErrorMessage(response.data.message || "ትኬት መቁረጥ አልተቻለም። እባክዎ እንደገና ይሞክሩ።");
            }
        } catch (error: any) {
            setErrorMessage(error.response?.data?.message || "ትኬት መቁረጥ አልተቻለም። እባክዎ እንደገና ይሞክሩ።");
        } finally { setIsLoading(false); }
    };

    const loadTicketByCode = async (code: string) => {
        if (!code.trim()) return false;
        setIsLoading(true);
        setTicketLoadError(null);
        try {
            const response = await axios.get(`${API_BASE}/api/tickets/load/${code}`);
            if (response.data.success && response.data.data.selections) {
                const loadedSelections: BetSlipItem[] = response.data.data.selections.map((s: any) => {
                    const teams = s.match_info ? String(s.match_info).split(' vs ') : [];
                    return {
                        fixture_id: s.fixture_id,
                        home_team: s.home_team || teams[0] || 'Home',
                        away_team: s.away_team || teams[1] || 'Away',
                        market_name: s.market_name || (['1', 'X', '2'].includes(s.odd_name) ? '1x2' : ['1X', '12', 'X2'].includes(s.odd_name) ? 'Double Chance' : 'Market'),
                        odd_id: s.odd_id,
                        odd_name: s.odd_name,
                        odd_value: parseFloat(s.odd_value || 0),
                        match_time: s.match_time || s.commence_time || s.event_time || new Date().toISOString(),
                        league_name: s.league_name || s.league || 'Unknown League'
                    };
                });
                setBetSlip(loadedSelections); clearBookingCode(); return true;
            } else { setTicketLoadError("ትኬቱ አልተገኘም! እባክዎ ትክክለኛ Booking Code ያስገቡ።"); return false; }
        } catch (err: any) { setTicketLoadError(err.response?.data?.message || "ትኬት ማምጣት አልተቻለም!"); return false; } finally { setIsLoading(false); }
    };

    const handleLoadTicket = async () => {
        const success = await loadTicketByCode(ticketCodeInput);
        if (success) { setTicketCodeInput(''); setTicketLoadError(null); }
    };

    const handleCheckCustomerTicket = async (e: React.FormEvent) => {
        e.preventDefault();
        const cleanCode = checkInputCode.trim();
        if (!cleanCode) return;
        setIsCheckingTicket(true); setCheckTicketError(null); setCheckedTicketData(null);
        try {
            const response = await axios.get(`${API_BASE}/api/tickets/check/${cleanCode}`);
            if (response.data.success) setCheckedTicketData(response.data.data);
        } catch (err: any) { setCheckTicketError(err.response?.data?.message || 'ይህ ትኬት አልተገኘም!'); } finally { setIsCheckingTicket(false); }
    };

    const closeCheckTicketModal = () => { setIsCheckTicketModalOpen(false); setCheckInputCode(''); setCheckedTicketData(null); setCheckTicketError(null); };

    const bookingShareUrl = bookingCode ? `${typeof window !== 'undefined' ? window.location.origin : ''}?booking=${bookingCode}` : '';

    const handleCopyBookingCode = async () => {
        if (!bookingCode) return;
        try {
            await navigator.clipboard.writeText(bookingCode);
            setCodeCopied(true);
            setTimeout(() => setCodeCopied(false), 2000);
        } catch (e) { }
    };

    const handleShareBooking = async () => {
        if (!bookingCode) return;
        const shareText = `Vibe Bet — Booking Code: ${bookingCode}\nStake: ${safeStake.toFixed(2)} ETB | Odds: ${totalOdds}\nPotential Win: ${grossWin.toFixed(2)} ETB\n${bookingShareUrl}`;
        if (typeof navigator !== 'undefined' && (navigator as any).share) {
            try { await (navigator as any).share({ title: 'Vibe Bet Ticket', text: shareText, url: bookingShareUrl }); }
            catch (e) { }
        } else {
            try {
                await navigator.clipboard.writeText(shareText);
                setCodeCopied(true);
                setTimeout(() => setCodeCopied(false), 2000);
            } catch (e) { }
        }
    };

    const handleSaveReceipt = async () => {
        if (!receiptRef.current || !bookingCode) return;
        try {
            const { toPng } = await import('html-to-image');
            const dataUrl = await toPng(receiptRef.current, { backgroundColor: '#0d1117', pixelRatio: 2 });
            const link = document.createElement('a');
            link.download = `vibebet-ticket-${bookingCode}.png`;
            link.href = dataUrl;
            link.click();
        } catch (e) {
            console.error('Could not save receipt image', e);
        }
    };

    const toggleAccordion = (id: string) => {
        setOpenAccordions((prev: string[]) => prev.includes(id) ? prev.filter((t: string) => t !== id) : [...prev, id]);
    };

    // 🌟 እጅግ ጥብቅ የሆነው የማርኬት አመዳደብ፣ ማጣሪያ እና ሎጂክ 🌟
    const getCategorizedMarkets = (game: any) => {
        const rawBets = game?.raw_markets || [];
        const categories: Record<string, any[]> = { "MAIN": [], "TOTALS": [], "HALF": [], "HANDICAPS": [], "COMBOS": [], "PLAYERS": [], "ALL": [] };
        if (!Array.isArray(rawBets)) return categories;

        const CATEGORY_MAP: Record<number, string> = {};
        [1, 2, 5, 7, 8, 10, 11, 12, 21].forEach((id: number) => CATEGORY_MAP[id] = "MAIN");
        [6, 38, 85, 295, 349].forEach((id: number) => CATEGORY_MAP[id] = "TOTALS");
        [15, 24, 25, 33, 49, 54, 62, 79, 83, 86, 88, 92, 94].forEach((id: number) => CATEGORY_MAP[id] = "COMBOS");
        [3, 13, 18, 19, 20, 22, 26, 31, 32, 34, 35, 39, 42, 46, 63, 72, 77].forEach((id: number) => CATEGORY_MAP[id] = "HALF");
        [4, 9, 56, 239].forEach((id: number) => CATEGORY_MAP[id] = "HANDICAPS");
        [87, 93, 176, 215, 218, 219, 226, 228, 229, 231, 232, 233, 240, 241, 245, 257, 267, 269, 275, 276, 340].forEach((id: number) => CATEGORY_MAP[id] = "PLAYERS");

        const SORT_TYPE_MAP: Record<number, string> = {
            1: "1X2", 12: "1X2", 13: "1X2", 54: "1X2",
            8: "YES_NO", 21: "YES_NO",
            5: "OVER_UNDER", 50: "OVER_UNDER", 16: "OVER_UNDER", 17: "OVER_UNDER", 45: "OVER_UNDER",
            10: "SCORE", 31: "SCORE",
            7: "3_COLS", 11: "3_COLS"
        };

        const CUSTOM_TITLES: Record<number, string> = {
            1: "1X2",
            8: "BOTH TEAMS TO SCORE",
            12: "DOUBLE CHANCE",
            5: "TOTAL",
            7: "HALFTIME/FULLTIME",
            11: "HIGHEST SCORING HALF",
            21: "ODD/EVEN",
            2: "DRAW NO BET",
            10: "CORRECT SCORE",
            6: "1ST HALF - TOTAL",
            38: "EXACT GOALS",
            349: "GOAL RANGE",
            295: "CORNER RANGE",
            85: "TOTAL CORNERS",
            25: "1X2 & TOTAL",
            24: "1X2 & BOTH TEAMS TO SCORE",
            54: "10 MINUTES - 1X2 FROM 1 TO 10",
            92: "ANYTIME GOALSCORER",
            79: "CORNER 1X2",
            33: "DOUBLE CHANCE & BOTH TEAMS TO SCORE",
            86: "LAST CORNER",
            15: "LAST GOAL",
            94: "LAST GOALSCORER",
            88: "ODD/EVEN CORNERS",
            83: "SENDING OFF",
            49: "TOTAL & BOTH TEAMS TO SCORE",
            62: "WHICH TEAM TO SCORE"
        };

        const GLOBAL_ID_ORDER = [
            1, 8, 12, 5, 7, 21, 2, 11, 10, 
            6, 38, 349, 295, 85,
            25, 24, 54, 92, 79, 33, 86, 15, 94, 88, 83, 49, 62,
            50, 13, 72, 31, 34, 39, 14, 93, 20, 46, 18, 19, 22, 77, 3, 35, 42, 63, 26, 27, 40, 192, 23, 48, 32, 16, 9, 4, 56, 239, 28, 41, 193, 60, 17
        ];

        rawBets.forEach((bet: any, mIdx: number) => {
            const outcomesArray = bet.values || bet.outcomes;
            if (!outcomesArray || outcomesArray.length === 0) return;

            const rawTitle = String(bet.title || bet.name || "Market").trim();
            const tLower = rawTitle.toLowerCase();

            let betId = Number(bet.id);
            if (!betId && bet.key) {
                if (bet.key === 'h2h') betId = 1;
                else if (bet.key === 'double_chance') betId = 12;
                else if (bet.key === 'totals') betId = 5;
                else if (bet.key === 'btts') betId = 8;
                else {
                    const match = String(bet.key).match(/\d+/);
                    if (match) betId = parseInt(match[0], 10);
                }
            }

            let category = CATEGORY_MAP[betId];
            if (!category) {
                if (tLower.includes('corner range') && betId !== 295) category = "COMBOS";
                else category = "ALL";
            }

            const sortType = SORT_TYPE_MAP[betId] || (tLower.includes('over/under') || tLower.includes('goal line') || tLower.includes('total') ? "OVER_UNDER" : "DEFAULT");

            const marketKind = getMarketKind(bet);
            const marketRef = bet.key || betId || rawTitle;

            let normalizedOutcomes = outcomesArray.map((o: any) => {
                const rawLabel = o.name || o.value;
                const oddVal = parseFloat(o.price || o.odd || 0).toFixed(2);
                const standardOpt = standardizeOptionLabel(marketKind, rawLabel, game);

                return {
                    odd_id: buildOddId(marketRef, standardOpt, game.id),
                    option: standardOpt,
                    value: oddVal,
                    original: String(rawLabel ?? '').trim()
                };
            });

            if (sortType === "OVER_UNDER") {
                const isOUMarket = normalizedOutcomes.some((o: any) => o.option.toLowerCase().includes('over') || o.option.toLowerCase().includes('under'));
                if (isOUMarket && !tLower.includes('exact')) {
                    normalizedOutcomes = normalizedOutcomes.filter((o: any) => {
                        const numMatch = o.option.match(/\d+(\.\d+)?/);
                        if (!numMatch) return true;
                        return numMatch[0].endsWith('.5');
                    });
                }
            }

            let cols = 2;

            switch(sortType) {
                case "1X2":
                    const order1x2 = ['1', 'X', '2', '1X', '12', 'X2'];
                    normalizedOutcomes.sort((a: any, b: any) => order1x2.indexOf(a.option) - order1x2.indexOf(b.option));
                    cols = 3;
                    break;
                case "YES_NO":
                    const orderYesNo = ['Yes', 'No', 'Odd', 'Even'];
                    normalizedOutcomes.sort((a: any, b: any) => {
                        let iA = orderYesNo.indexOf(a.option);
                        let iB = orderYesNo.indexOf(b.option);
                        if (iA === -1) iA = 99; if (iB === -1) iB = 99;
                        return iA - iB;
                    });
                    break;
                case "OVER_UNDER":
                    normalizedOutcomes.sort((a: any, b: any) => {
                        const numA = parseFloat(a.option.match(/\d+(\.\d+)?/)?.[0] || "0");
                        const numB = parseFloat(b.option.match(/\d+(\.\d+)?/)?.[0] || "0");
                        if (numA !== numB) return numA - numB;
                        const isOverA = a.option.toLowerCase().includes('over') || a.option.toLowerCase().includes('yes');
                        const isOverB = b.option.toLowerCase().includes('over') || b.option.toLowerCase().includes('yes');
                        if (isOverA && !isOverB) return -1;
                        if (!isOverA && isOverB) return 1;
                        return 0;
                    });
                    break;
                case "SCORE":
                    normalizedOutcomes.sort((a: any, b: any) => {
                        const [aH, aA] = a.original.split(':').map(Number);
                        const [bH, bA] = b.original.split(':').map(Number);
                        if (!isNaN(aH) && !isNaN(bH)) {
                            if (aH !== bH) return aH - bH;
                            return aA - bA;
                        }
                        return String(a.option).localeCompare(String(b.option));
                    });
                    cols = 3;
                    break;
                case "3_COLS":
                    cols = 3;
                    break;
                default:
                    normalizedOutcomes.sort((a: any, b: any) => {
                        const numA = parseFloat(a.option.match(/-?\d+(\.\d+)?/)?.[0] || "NaN");
                        const numB = parseFloat(b.option.match(/-?\d+(\.\d+)?/)?.[0] || "NaN");
                        if (!isNaN(numA) && !isNaN(numB) && numA !== numB) return numA - numB;
                        return String(a.option).localeCompare(String(b.option));
                    });
                    if (normalizedOutcomes.length >= 6 && category !== "HANDICAPS") cols = 3;
            }

            if (normalizedOutcomes.length === 1) cols = 1;

            let finalTitle = CUSTOM_TITLES[betId] || rawTitle;
            if ((category === "MAIN" || category === "TOTALS" || category === "COMBOS") && !CUSTOM_TITLES[betId]) {
                finalTitle = rawTitle.toUpperCase();
            }

            if (normalizedOutcomes.length > 0) {
                categories[category].push({
                    unique_id: `market_${betId}_${mIdx}_${game.id}`,
                    bet_id: betId, 
                    title: finalTitle,
                    cols: cols,
                    odds: normalizedOutcomes
                });
            }
        });

        Object.keys(categories).forEach((cat: string) => {
            if (categories[cat].length > 0) {
                categories[cat].sort((a: any, b: any) => {
                    let idxA = GLOBAL_ID_ORDER.indexOf(a.bet_id);
                    let idxB = GLOBAL_ID_ORDER.indexOf(b.bet_id);
                    if (idxA === -1) idxA = 999;
                    if (idxB === -1) idxB = 999;
                    
                    if (idxA !== idxB) return idxA - idxB;
                    return a.title.localeCompare(b.title);
                });
            }
        });

        if (categories["COMBOS"] && categories["COMBOS"].length > 0) {
            categories["COMBOS"].sort((a: any, b: any) => {
                const getComboRank = (title: string) => {
                    if (title.includes("1X2 & TOTAL")) return 1;
                    if (title.includes("1X2 & BOTH TEAMS TO SCORE")) return 2;
                    if (title.includes("10 MINUTES - 1X2")) return 3;
                    if (title.includes("ANYTIME GOALSCORER")) return 4;
                    if (title.includes("CORNER 1X2")) return 5;
                    if (title.includes("DOUBLE CHANCE & BOTH TEAMS TO SCORE")) return 6;
                    if (title.includes("LAST CORNER")) return 7;
                    if (title.includes("LAST GOALSCORER")) return 9; 
                    if (title.includes("LAST GOAL")) return 8;
                    if (title.includes("CORNER RANGE")) return 10;
                    if (title.includes("ODD/EVEN CORNERS")) return 11;
                    if (title.includes("SENDING OFF")) return 12;
                    if (title.includes("TOTAL & BOTH TEAMS TO SCORE")) return 13;
                    if (title.includes("WHICH TEAM TO SCORE")) return 14;
                    return 999;
                };
                const rankA = getComboRank(a.title);
                const rankB = getComboRank(b.title);
                if (rankA !== rankB) return rankA - rankB;
                return a.title.localeCompare(b.title);
            });
        }

        Object.keys(categories).forEach((cat: string) => {
            if (cat !== "ALL" && categories[cat].length > 0) {
                categories["ALL"] = [...categories["ALL"], ...categories[cat]];
            }
        });

        if (categories["ALL"].length > 0) {
            categories["ALL"].sort((a: any, b: any) => {
                let idxA = GLOBAL_ID_ORDER.indexOf(a.bet_id);
                let idxB = GLOBAL_ID_ORDER.indexOf(b.bet_id);
                if (idxA === -1) idxA = 999;
                if (idxB === -1) idxB = 999;
                
                if (idxA !== idxB) return idxA - idxB;
                return a.title.localeCompare(b.title);
            });
        }

        const finalObj: Record<string, any[]> = {};
        Object.keys(categories).forEach((key: string) => {
            if (categories[key].length > 0) finalObj[key] = categories[key];
        });

        return finalObj;
    };

    const FALLBACK_FLAG = 'https://media.api-sports.io/flags/un.svg';
    const renderFlag = (flagObj: string) => {
        if (!flagObj) return <img src={FALLBACK_FLAG} alt="flag" className="w-full h-full object-cover" />;
        return (
            <img
                src={flagObj}
                alt="flag"
                onError={(e: any) => {
                    if (e.target.src !== FALLBACK_FLAG) {
                        e.target.onerror = null;
                        e.target.src = FALLBACK_FLAG;
                    }
                }}
                className="w-full h-full object-cover"
            />
        );
    };

    const getLeagueDetails = (key: string, flagFromApi?: string) => {
        if (!key || typeof key !== 'string') return { country: 'World', flag: 'https://media.api-sports.io/flags/un.svg', name: 'Soccer', isTop: false };
        
        const topLeaguesExactMatches = [
            'England|Premier League',
            'Germany|Bundesliga',
            'Netherlands|Eredivisie',
            'Spain|La Liga',
            'Spain|Primera Division',
            'Portugal|Liga Portugal',
            'Portugal|Primeira Liga',
            'France|Ligue 1',
            'Belgium|Pro League',
            'Belgium|Jupiler Pro League',
            'Italy|Serie A',
            'Switzerland|Super League',
            'Sweden|Superettan',
            'World|UEFA Champions League',
            'World|UEFA Europa League'
        ];

        if (key.includes('|')) {
            const parts = key.split('|');
            const exactKey = `${parts[0] || 'World'}|${parts[1] || 'League'}`;
            
            let displayName = parts[1] || 'League';
            if (displayName === 'Primera Division' || displayName === 'La Liga') displayName = 'LaLiga';
            if (displayName === 'Primeira Liga') displayName = 'Liga Portugal';
            if (displayName === 'Jupiler Pro League') displayName = 'Pro League';

            const isTop = topLeaguesExactMatches.some((t: string) => exactKey.toLowerCase() === t.toLowerCase());
            
            return { country: parts[0] || 'World', flag: parts[2] || flagFromApi || 'https://media.api-sports.io/flags/un.svg', name: displayName, isTop: isTop };
        }
        return { country: 'World', flag: 'https://media.api-sports.io/flags/un.svg', name: key.replace('soccer_', '').replace(/_/g, ' '), isTop: false };
    };

    const activeFixtures = useMemo(() => {
        const timeNow = new Date().getTime();
        return fixtures.filter((g: any) => g && g.match_time && new Date(g.match_time).getTime() > timeNow);
    }, [fixtures]);

    const { allLeagues, topLeagues, sortedCountries } = useMemo(() => {
        const grouped = activeFixtures.reduce((acc: any, game: any) => {
            const details = getLeagueDetails(game.league, game.league_flag);
            const uniqueKey = game.league || 'unknown';
            if (!acc[uniqueKey]) acc[uniqueKey] = { details, games: [] };
            acc[uniqueKey].games.push(game);
            return acc;
        }, {});

        const all = Object.entries(grouped) as [string, any][];
        
        const top = all
            .filter(([_, data]: [string, any]) => data.details.isTop)
            .sort((a: any, b: any) => a[1].details.name.localeCompare(b[1].details.name));

        const cMap = new Map<string, { flag: string, leagues: { key: string, name: string, count: number }[] }>();
        all.forEach(([key, data]: [string, any]) => {
            const country = data.details.country;
            if (!cMap.has(country)) cMap.set(country, { flag: data.details.flag, leagues: [] });
            cMap.get(country)!.leagues.push({ key: key, name: data.details.name, count: data.games.length });
        });
        const sortedC = Array.from(cMap.entries()).sort((a: any, b: any) => a[0].localeCompare(b[0]));

        return { allLeagues: all, topLeagues: top, sortedCountries: sortedC };
    }, [activeFixtures]);

    const displayLeagues = useMemo(() => {
        let result = allLeagues;
        if (selectedLeague === 'Upcoming') {
            const sortedUpcoming = [...activeFixtures].sort((a: any, b: any) => new Date(a.match_time).getTime() - new Date(b.match_time).getTime());
            const groupedArray: any[] = [];
            let currentGroup: any = null;
            for (const game of sortedUpcoming) {
                const leagueKey = game.league;
                if (!currentGroup || currentGroup.leagueKey !== leagueKey) {
                    if (currentGroup) groupedArray.push([currentGroup.id, currentGroup.data]);
                    currentGroup = { leagueKey: leagueKey, id: leagueKey + '_' + game.id, data: { details: getLeagueDetails(leagueKey, game.league_flag), games: [game] } };
                } else currentGroup.data.games.push(game);
            }
            if (currentGroup) groupedArray.push([currentGroup.id, currentGroup.data]);
            result = groupedArray;
        } else if (selectedLeague === 'Top Matches') {
            result = topLeagues;
        } else if (selectedLeague !== 'All') {
            result = allLeagues.filter(([key, _]: [string, any]) => key === selectedLeague);
        }
        return result;
    }, [allLeagues, topLeagues, selectedLeague, activeFixtures]);

    if (!isMounted) return <div className="min-h-screen bg-[#1c2024]"></div>;

    return (
        <div className="min-h-screen bg-[#1c2024] text-slate-300 font-sans text-sm relative">
            <header className="bg-[#ffcc00] border-b border-[#e6b800] sticky top-0 z-30 h-[60px] flex items-center justify-between px-4 shadow-md">
                <button onClick={() => window.location.reload()} className="flex items-center gap-3 cursor-pointer hover:opacity-90 transition text-left">
                    <div className="w-11 h-11 shrink-0 rounded-[10px] overflow-hidden shadow-sm border border-black/10 bg-[#1c2024] p-1.5 flex items-center justify-center">
                        <img src="/icon.svg" alt="Vibe Bet" className="w-full h-full object-contain" />
                    </div>
                    <div className="hidden sm:flex flex-col justify-center">
                        <h1 className="text-[22px] font-black text-black leading-none tracking-tight italic mb-0.5 flex items-center">
                            VIBE<span className="font-bold text-black/70 ml-1 text-lg">BET</span>
                        </h1>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] text-black/80 font-black uppercase tracking-[0.1em]">Premium Sportsbook</span>
                            {isOnline ? (
                                <span className="bg-[#ffe566] text-black text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider flex items-center gap-1 shadow-sm"><span className="text-[8px]">●</span> ONLINE</span>
                            ) : (
                                <span className="bg-red-500/20 text-red-700 border border-red-500/30 text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider flex items-center gap-1"><span className="text-[8px] animate-pulse">●</span> OFFLINE</span>
                            )}
                        </div>
                    </div>
                </button>
                <div className="flex gap-2 sm:gap-4 items-center">
                    <button onClick={() => setIsCheckTicketModalOpen(true)} className="bg-[#0a0a0a] text-[#ffcc00] hover:bg-[#1a1a1a] px-4 py-1.5 rounded-md font-black text-xs flex items-center gap-1.5 transition-colors shadow-md border border-black">
                        <span className="text-sm">🔍</span> <span className="hidden sm:inline">ትኬት አረጋግጥ</span>
                    </button>
                </div>
            </header>

            <div className="lg:hidden fixed bottom-0 left-0 right-0 h-[60px] bg-[#1e2328] border-t border-[#3b4148] flex justify-around items-center z-40 shadow-[0_-4px_10px_rgba(0,0,0,0.5)]">
                <button onClick={() => setIsMobileMenuOpen(true)} className="flex flex-col items-center gap-1 text-slate-400 hover:text-[#ffcc00]"><span className="text-xl">☰</span><span className="text-[10px] font-bold uppercase">Menu</span></button>
                <button onClick={() => setIsCheckTicketModalOpen(true)} className="flex flex-col items-center gap-1 text-slate-400 hover:text-[#ffcc00]"><span className="text-xl">🔍</span><span className="text-[10px] font-bold uppercase">Check</span></button>
                <button onClick={() => { setIsMobileMenuOpen(false); setIsMobileBetSlipOpen(false); setSelectedMatch(null); }} className="flex flex-col items-center gap-1 text-[#ffcc00]"><span className="text-xl">🏠</span><span className="text-[10px] font-bold uppercase">Home</span></button>
                <button onClick={() => setIsMobileBetSlipOpen(true)} className="flex flex-col items-center gap-1 text-slate-400 hover:text-[#ffcc00] relative">
                    <span className="text-xl">🧾</span><span className="text-[10px] font-bold uppercase">BetSlip</span>
                    {betSlip.length > 0 && <span className="absolute -top-1.5 -right-2 bg-[#00e700] text-black text-[10px] font-black w-4 h-4 flex items-center justify-center rounded-full border border-black shadow">{betSlip.length}</span>}
                </button>
            </div>

            {isMobileMenuOpen && <div className="fixed inset-0 bg-black/70 z-40 xl:hidden animate-fade-in" onClick={() => setIsMobileMenuOpen(false)} />}
            {isMobileBetSlipOpen && <div className="fixed inset-0 bg-black/70 z-40 lg:hidden animate-fade-in" onClick={() => setIsMobileBetSlipOpen(false)} />}

            <div className="flex w-full h-[calc(100vh-60px)] overflow-hidden pb-[60px] lg:pb-0">
                <aside className={`fixed inset-y-0 left-0 z-50 w-[260px] bg-[#1e2328] border-r border-[#2a3038] overflow-y-auto custom-scrollbar transform transition-transform duration-300 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} xl:relative xl:translate-x-0 xl:flex flex-col shrink-0`}>
                    <div className="xl:hidden flex justify-between items-center p-3 bg-[#24292e] border-b border-[#3b4148]">
                        <span className="font-bold text-[#ffcc00] uppercase text-sm">Menu</span><button onClick={() => setIsMobileMenuOpen(false)} className="text-slate-400 hover:text-white text-2xl leading-none">×</button>
                    </div>

                    <div className="p-3 border-b border-[#2a3038]">
                        <div className="flex bg-[#2a3038] rounded overflow-hidden border border-[#3b4148] focus-within:border-[#ffcc00] transition-colors">
                            <input type="text" placeholder="Search matches..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="bg-transparent text-xs text-white p-2.5 flex-1 outline-none placeholder-slate-500" />
                            <button className="bg-[#ffcc00] hover:bg-[#e6b800] px-3 flex items-center justify-center transition-colors"><span className="text-black text-sm">🔍</span></button>
                        </div>
                    </div>

                    <div className="flex gap-2 p-3 border-b border-[#2a3038]">
                        <button onClick={() => { setSelectedLeague('Top Matches'); setSelectedMatch(null); if (window.innerWidth < 1280) setIsMobileMenuOpen(false); }} className={`flex-1 border text-[11px] font-bold py-2 rounded transition-colors flex items-center justify-center gap-1.5 ${selectedLeague === 'Top Matches' ? 'bg-[#ffcc00] border-[#ffcc00] text-black' : 'bg-[#2a3038] hover:bg-[#3b4148] border-[#3b4148] text-white'}`}>
                            <span className={selectedLeague === 'Top Matches' ? 'text-black' : 'text-[#ffcc00]'}>🏆</span> Top
                        </button>
                        <button onClick={() => { setSelectedLeague('Upcoming'); setSelectedMatch(null); if (window.innerWidth < 1280) setIsMobileMenuOpen(false); }} className={`flex-1 border text-[11px] font-bold py-2 rounded transition-colors flex items-center justify-center gap-1.5 ${selectedLeague === 'Upcoming' ? 'bg-[#ffcc00] border-[#ffcc00] text-black' : 'bg-[#2a3038] hover:bg-[#3b4148] border-[#3b4148] text-white'}`}>
                            <span className={selectedLeague === 'Upcoming' ? 'text-black' : 'text-[#ffcc00]'}>🕒</span> Upcoming
                        </button>
                    </div>

                    {topLeagues.length > 0 && (
                        <div className="border-b border-[#2a3038]">
                            <button onClick={() => setIsTopLeaguesOpen(!isTopLeaguesOpen)} className="w-full flex items-center justify-between p-3 hover:bg-[#24292e] transition-colors">
                                <div className="flex items-center gap-2"><span className="text-[#ffcc00]">🔥</span><span className="text-[13px] font-bold text-white">Top Leagues</span></div>
                                <div className="flex items-center gap-2"><span className="bg-[#2a3038] text-slate-400 text-[10px] px-1.5 py-0.5 rounded-sm">{topLeagues.length}</span><span className="text-slate-500 text-[10px]">{isTopLeaguesOpen ? '▲' : '▼'}</span></div>
                            </button>
                            {isTopLeaguesOpen && (
                                <ul className="text-xs text-slate-300 pb-2">
                                    {topLeagues.map(([key, data]: [string, any]) => (
                                        <li key={key}>
                                            <button onClick={() => { setSelectedLeague(key); setSelectedMatch(null); if (window.innerWidth < 1280) setIsMobileMenuOpen(false); }} className={`w-full flex items-center justify-between px-3 py-1.5 transition-colors ${selectedLeague === key ? 'bg-[#2a3038] border-l-2 border-[#ffcc00] text-white' : 'border-l-2 border-transparent hover:bg-[#2a3038] hover:text-white'}`}>
                                                <div className="flex items-center gap-3">
                                                    <div className="w-5 h-5 bg-[#2a3038] rounded-full flex items-center justify-center text-xs overflow-hidden border border-[#3b4148]">{renderFlag(data.details.flag)}</div>
                                                    <span className="font-semibold">{data.details.name}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-slate-500 text-[11px]">{data.games.length}</span><span className="text-slate-600 hover:text-[#ffcc00] transition-colors text-sm">☆</span>
                                                </div>
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    )}

                    <div>
                        <div className="px-3 pt-4 pb-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Sports</div>
                        <button onClick={() => setIsSoccerOpen(!isSoccerOpen)} className="w-full flex items-center justify-between p-3 hover:bg-[#24292e] transition-colors">
                            <div className="flex items-center gap-2"><span className="text-[#3b82f6]">⚽</span><span className="text-[13px] font-bold text-white">Soccer</span></div>
                            <div className="flex items-center gap-2"><span className="bg-[#2a3038] text-slate-400 text-[10px] px-1.5 py-0.5 rounded-sm">{activeFixtures.length}</span><span className="text-slate-500 text-[10px]">{isSoccerOpen ? '▲' : '▼'}</span></div>
                        </button>

                        {isSoccerOpen && (
                            <div className="text-xs text-slate-300 pb-4">
                                {sortedCountries.map(([countryName, countryData]: [string, any]) => {
                                    const isCountryOpen = openCountry === countryName;
                                    const totalGames = countryData.leagues.reduce((sum: number, l: any) => sum + l.count, 0);
                                    return (
                                        <div key={countryName}>
                                            <button onClick={() => setOpenCountry(isCountryOpen ? null : countryName)} className={`w-full flex items-center justify-between px-4 py-2 transition-colors ${isCountryOpen ? 'bg-[#2a3038] text-white' : 'hover:bg-[#2a3038] hover:text-white'}`}>
                                                <div className="flex items-center gap-3">
                                                    <span className="text-sm w-5 h-5 flex items-center justify-center rounded-full overflow-hidden border border-[#3b4148]">{renderFlag(countryData.flag)}</span>
                                                    <span className="font-semibold">{countryName}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-slate-500 text-[11px]">{totalGames}</span><span className="text-slate-600 text-[10px]">{isCountryOpen ? '▼' : '❯'}</span>
                                                </div>
                                            </button>
                                            {isCountryOpen && (
                                                <ul className="bg-[#1a1f24] py-1 border-b border-[#2a3038]">
                                                    {countryData.leagues.map((league: any) => (
                                                        <li key={league.key}>
                                                            <button onClick={() => { setSelectedLeague(league.key); setSelectedMatch(null); if (window.innerWidth < 1280) setIsMobileMenuOpen(false); }} className={`w-full flex items-center justify-between pl-12 pr-4 py-2 transition-colors ${selectedLeague === league.key ? 'text-[#ffcc00] font-bold' : 'text-slate-400 hover:text-white hover:bg-[#24292e]'}`}>
                                                                <span>{league.name}</span><span className="text-[10px] opacity-60">{league.count}</span>
                                                            </button>
                                                        </li>
                                                    ))}
                                                </ul>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                </aside>

                <main className="flex-1 flex flex-col min-w-0 bg-[#16191c] overflow-hidden relative">
                    {selectedMatch ? (
                        <div className="flex flex-col h-full bg-[#16191c] animate-fade-in">
                            <div className="bg-[#1e2328] px-4 py-3 flex items-center justify-between border-b border-[#2a3038]">
                                <button onClick={() => setSelectedMatch(null)} className="text-[#ffcc00] font-bold hover:text-white flex items-center gap-1 transition text-xs sm:text-sm">
                                    <span>←</span> ተመለስ
                                </button>
                                <div className="text-white font-black text-sm sm:text-base text-right flex-1 ml-4 truncate">
                                    {selectedMatch.home_team} <span className="text-slate-500 font-normal">vs</span> {selectedMatch.away_team}
                                </div>
                            </div>
                            
                            {(() => {
                                const allCats = getCategorizedMarkets(selectedMatch);
                                const tabs = ['All', 'Main Market', 'Total', 'Combination', 'Half', 'Handicap'];
                                const availableTabs = tabs.filter(t => t === 'All' || (allCats[t] && allCats[t].length > 0));

                            {(() => {
                                const allCats = getCategorizedMarkets(selectedMatch);
                                const tabs = ['ALL', 'MAIN', 'TOTALS', 'COMBOS', 'HALF', 'HANDICAPS', 'PLAYERS'];
                                const availableTabs = tabs.filter((t: string) => t === 'ALL' || (allCats[t] && allCats[t].length > 0));

                                const displayMarkets = marketTab === 'ALL' ? allCats['ALL'] : (allCats[marketTab] || []);

                                return (
                                    <>
                                        <div className="flex overflow-x-auto gap-6 px-4 bg-[#24292e] border-b border-[#3b4148] custom-scrollbar shrink-0">
                                            {availableTabs.map((tab: string) => (
                                                <button
                                                    key={tab}
                                                    onClick={() => setMarketTab(tab)}
                                                    className={`py-4 text-[12px] tracking-[0.05em] font-black whitespace-nowrap uppercase transition-all border-b-[3px] ${marketTab === tab ? 'text-[#ffcc00] border-[#ffcc00]' : 'text-slate-400 border-transparent hover:text-white'}`}
                                                >
                                                    {tab}
                                                </button>
                                            ))}
                                        </div>

                                        <div className="flex-1 overflow-y-auto p-2 sm:p-4 bg-[#2a3038] custom-scrollbar">
                                            <div className="max-w-5xl mx-auto w-full bg-[#485058] border border-[#3a4148] rounded-md overflow-hidden shadow-md">
                                                {displayMarkets.map((market: any, mIdx: number) => {
                                                    const isOpen = openAccordions.includes(market.unique_id);
                                                    let customClass = `grid gap-2 `;
                                                    if (market.cols === 4) customClass += 'grid-cols-2 md:grid-cols-4';
                                                    else if (market.cols === 3) customClass += 'grid-cols-1 md:grid-cols-3';
                                                    else if (market.cols === 1) customClass += 'grid-cols-1';
                                                    else customClass += 'grid-cols-1 md:grid-cols-2';

                                                    const oddClass = 'flex justify-between items-center px-3 py-2.5 rounded-sm transition-all duration-500 border';

                                                    return (
                                                        <div key={market.unique_id} className="border-b border-[#3a4148] last:border-b-0 w-full">
                                                            <button onClick={() => toggleAccordion(market.unique_id)} className="w-full flex items-center justify-between p-3.5 hover:bg-[#525b65] transition-colors">
                                                                <div className="flex items-center gap-3">
                                                                    <svg className="w-4 h-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"></path></svg>
                                                                    <span className="text-[13px] font-bold text-white tracking-wide text-left">{market.title}</span>
                                                                </div>
                                                                <svg className={`w-4 h-4 text-slate-300 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                                                            </button>

                                                            {isOpen && (
                                                                <div className="p-3 bg-[#1e2328] border-t border-[#3a4148]">
                                                                    <div className={customClass}>
                                                                        {market.odds.map((odd: any) => {
                                                                            const isSelected = betSlip.some((item: any) => item.odd_id === odd.odd_id);
                                                                            const isFlashingUp = flashingOdds[odd.odd_id] === 'up';
                                                                            const isFlashingDown = flashingOdds[odd.odd_id] === 'down';
                                                                            const flashClass = isFlashingUp ? 'bg-[#00e700] text-black shadow-[0_0_8px_#00e700] border-[#00e700]' : isFlashingDown ? 'bg-red-500 text-white shadow-[0_0_8px_red] border-red-500' : '';

                                                                            return (
                                                                                <button key={odd.odd_id} onClick={() => handleMarketSelection(selectedMatch, odd, market.title)} className={`${oddClass} ${flashClass !== '' ? flashClass : isSelected ? 'bg-[#ffcc00] border-[#ffcc00] text-black shadow' : 'bg-[#1a1f24] border-[#3b4148] hover:border-[#ffcc00]'}`}>
                                                                                    <span className={`text-[11px] ${flashClass !== '' ? (isFlashingUp ? 'text-black font-bold' : 'text-white font-bold') : isSelected ? 'text-black font-bold' : 'text-slate-300'}`}>{odd.option}</span>
                                                                                    <span className={`text-[12px] font-black ${flashClass !== '' ? (isFlashingUp ? 'text-black' : 'text-white') : isSelected ? 'text-black' : 'text-[#ffcc00]'}`}>{odd.value}</span>
                                                                                </button>
                                                                            )
                                                                        })}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </>
                                );
                            })()}
                        </div>
                    ) : (
                        <>
                            <div className="bg-[#24292e] border-b border-[#3b4148] p-2 sm:p-3 shrink-0 flex flex-col gap-3 shadow-sm z-20 relative">
                                <div className="flex gap-2 sm:gap-4">
                                    <div className="flex-1 relative">
                                        <button className="w-full bg-[#1a1f24] hover:bg-[#1e2328] border border-[#3b4148] rounded-lg p-2.5 flex items-center justify-between text-slate-300 transition shadow-inner">
                                            <div className="flex items-center gap-2"><span className="bg-slate-200 text-black rounded-full w-5 h-5 flex items-center justify-center text-[10px] sm:text-xs">⚽</span><span className="font-bold text-xs sm:text-sm">Soccer</span></div><span className="text-[10px] text-slate-500">▼</span>
                                        </button>
                                    </div>
                                    <div className="flex-1 relative">
                                        <button onClick={() => setIsCountryDropdownOpen(!isCountryDropdownOpen)} className="w-full bg-[#1a1f24] hover:bg-[#1e2328] border border-[#3b4148] rounded-lg p-2.5 flex items-center justify-between text-slate-300 transition shadow-inner truncate">
                                            <div className="flex items-center gap-2 truncate"><span className="bg-slate-200 text-black rounded-full w-5 h-5 flex items-center justify-center text-[10px] sm:text-xs shrink-0">🌐</span><span className="font-bold text-xs sm:text-sm truncate">{selectedCountryFilter}</span></div><span className="text-[10px] text-slate-500 ml-2 shrink-0">{isCountryDropdownOpen ? '▲' : '▼'}</span>
                                        </button>
                                        {isCountryDropdownOpen && (
                                            <div className="absolute top-full left-0 mt-1 w-full bg-[#1e2328] border border-[#3b4148] rounded-lg shadow-xl z-50 max-h-60 overflow-y-auto custom-scrollbar">
                                                <button onClick={() => { setSelectedCountryFilter('All Countries'); setIsCountryDropdownOpen(false); }} className="w-full text-left px-4 py-3 hover:bg-[#2a3038] text-sm font-bold text-white border-b border-[#3b4148] transition-colors">🌐 ሁሉም ሀገራት (All)</button>
                                                {sortedCountries.map(([cName, cData]: [string, any]) => (
                                                    <button key={cName} onClick={() => { setSelectedCountryFilter(cName); setIsCountryDropdownOpen(false); }} className="w-full text-left px-4 py-2.5 hover:bg-[#2a3038] flex items-center gap-3 border-b border-[#3b4148] last:border-0 transition-colors">
                                                        <span className="w-5 h-5 flex items-center justify-center rounded-full overflow-hidden border border-[#3b4148]">{renderFlag(cData.flag)}</span><span className="text-sm font-semibold text-slate-300">{cName}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="flex justify-between items-center overflow-x-auto custom-scrollbar pb-1">
                                    <div className="flex items-center gap-1 bg-[#1a1f24] p-1 rounded-full border border-[#3b4148] shrink-0 shadow-inner relative">
                                        <button onClick={() => setSelectedDateFilter(todayStr)} className={`px-3 sm:px-4 py-1.5 rounded-full text-[10px] sm:text-xs font-bold transition-colors ${selectedDateFilter === todayStr ? 'bg-[#ffcc00] text-black shadow' : 'text-slate-400 hover:text-white'}`}>Tdy</button>
                                        <button onClick={() => setSelectedDateFilter(tomorrowStr)} className={`px-3 sm:px-4 py-1.5 rounded-full text-[10px] sm:text-xs font-bold transition-colors ${selectedDateFilter === tomorrowStr ? 'bg-[#ffcc00] text-black shadow' : 'text-slate-400 hover:text-white'}`}>Tmw</button>
                                        <button onClick={() => setSelectedDateFilter(dayAfterTmwStr)} className={`px-3 sm:px-4 py-1.5 rounded-full text-[10px] sm:text-xs font-bold transition-colors ${selectedDateFilter === dayAfterTmwStr ? 'bg-[#ffcc00] text-black shadow' : 'text-slate-400 hover:text-white'}`}>{dayAfterTmwLabel}</button>
                                        <div className="relative flex items-center justify-center px-2">
                                            <input ref={dateInputRef} type="date" className="absolute w-0 h-0 opacity-0 overflow-hidden" onChange={(e) => { e.target.value ? setSelectedDateFilter(new Date(new Date(e.target.value).getTime() + Math.abs(new Date(e.target.value).getTimezoneOffset() * 60000)).toDateString()) : setSelectedDateFilter('All'); }} />
                                            <button onClick={() => { if (dateInputRef.current) { try { dateInputRef.current.showPicker(); } catch (e) { dateInputRef.current.focus(); } } }} className={`w-8 h-8 rounded-full text-xs sm:text-sm transition-colors relative z-0 flex items-center justify-center ${!['All', todayStr, tomorrowStr, dayAfterTmwStr].includes(selectedDateFilter) && selectedDateFilter !== 'All' ? 'bg-[#ffcc00] text-black shadow' : 'text-slate-400 hover:text-white'}`}>📅</button>
                                        </div>
                                    </div>
                                    <div className="flex items-center bg-[#1a1f24] p-1 rounded-full border border-[#3b4148] shrink-0 ml-4 shadow-inner">
                                        <button onClick={() => setMainMarketView('1X2')} className={`px-3 sm:px-4 py-1.5 rounded-full text-[10px] sm:text-xs font-bold transition-colors ${mainMarketView === '1X2' ? 'bg-[#ffcc00] text-black shadow' : 'text-slate-400 hover:text-white'}`}>3 Way</button>
                                        <button onClick={() => setMainMarketView('DC')} className={`px-3 sm:px-4 py-1.5 rounded-full text-[10px] sm:text-xs font-bold transition-colors ${mainMarketView === 'DC' ? 'bg-[#ffcc00] text-black shadow' : 'text-slate-400 hover:text-white'}`}>Double Chance</button>
                                    </div>
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                                {isFetchingFixtures ? (
                                    <div className="py-32 text-center flex flex-col items-center justify-center">
                                        <div className="w-8 h-8 border-4 border-[#3b4148] border-t-[#ffcc00] rounded-full animate-spin mb-4"></div><p className="text-slate-400 font-bold text-xs uppercase tracking-wider">ጨዋታዎችን በማምጣት ላይ...</p>
                                    </div>
                                ) : activeFixtures.length === 0 ? (
                                    <div className="py-20 text-center text-slate-500 text-xs font-bold">አሁን ላይ ምንም አይነት ጨዋታ አልተገኘም!</div>
                                ) : (
                                    <div>
                                        {displayLeagues.filter(([key, data]: [string, any]) => {
                                            return (selectedCountryFilter !== 'All Countries' && selectedLeague !== 'Upcoming') ? data.details.country === selectedCountryFilter : true;
                                        }).map(([key, data]: [string, any]) => {
                                            let gamesToRender = data.games;
                                            if (selectedLeague === 'Upcoming' && selectedCountryFilter !== 'All Countries') gamesToRender = gamesToRender.filter((g: any) => getLeagueDetails(g.league).country === selectedCountryFilter);

                                            const filteredGames = gamesToRender.filter((g: any) => {
                                                const matchesSearch = (g.home_team || '').toLowerCase().includes(searchTerm.toLowerCase()) || (g.away_team || '').toLowerCase().includes(searchTerm.toLowerCase());
                                                const matchesDate = selectedDateFilter === 'All' || new Date(g.match_time).toDateString() === selectedDateFilter;
                                                return matchesSearch && matchesDate;
                                            });

                                            if (selectedLeague !== 'Upcoming') {
                                                filteredGames.sort((a: any, b: any) => new Date(a.match_time).getTime() - new Date(b.match_time).getTime());
                                            }

                                            if (filteredGames.length === 0) return null;

                                            return (
                                                <div key={key} className="mb-6 rounded-lg overflow-hidden border border-[#2a3038] shadow-sm">
                                                    <div className="bg-[#24292e] px-4 py-3 flex items-center gap-3 border-b border-[#3b4148] sticky top-0 z-10">
                                                        <div className="w-6 h-6 bg-[#1e2328] rounded-full flex items-center justify-center text-sm shadow-inner border border-[#3b4148] overflow-hidden">{renderFlag(data.details.flag)}</div>
                                                        <span className="text-[13px] font-black text-white tracking-wide">{data.details.country}: {data.details.name}</span>
                                                    </div>

                                                    <div className="flex flex-col bg-[#1e2328]">
                                                        <div className="flex text-[10px] font-bold text-slate-500 px-1 sm:px-2 py-2 border-b border-[#2a3038] bg-[#1a1f24]">
                                                            <div className="w-12 sm:w-16"></div>
                                                            <div className="flex-1 flex justify-around">
                                                                {mainMarketView === '1X2' ? (<><span>1</span><span>X</span><span>2</span></>) : (<><span>1X</span><span>12</span><span>X2</span></>)}
                                                            </div>
                                                            <div className="w-10 sm:w-14"></div>
                                                        </div>

                                                        {filteredGames.map((game: any) => {
                                                            const matchDate = new Date(game.match_time);
                                                            const currentDisplayOdds = mainMarketView === '1X2' ? game.odds : game.dc_odds;

                                                            const btn1 = currentDisplayOdds?.[0] || { odd_id: buildOddId('h2h', '1', game.id), option: "1", value: "0.00" };
                                                            const btnX = currentDisplayOdds?.[1] || { odd_id: buildOddId('h2h', 'X', game.id), option: "X", value: "0.00" };
                                                            const btn2 = currentDisplayOdds?.[2] || { odd_id: buildOddId('h2h', '2', game.id), option: "2", value: "0.00" };

                                                            const hasSelectionInGame = betSlip.some((item: any) => item.fixture_id === game.id);
                                                            const totalMarketsCount = game.total_markets_count || 0;

                                                            const isFlashBtn1Up = flashingOdds[btn1.odd_id] === 'up';
                                                            const isFlashBtn1Down = flashingOdds[btn1.odd_id] === 'down';
                                                            const flashClass1 = isFlashBtn1Up ? 'bg-[#00e700] border-[#00e700] shadow-[0_0_8px_#00e700]' : isFlashBtn1Down ? 'bg-red-500 border-red-500 shadow-[0_0_8px_red]' : '';

                                                            const isFlashBtnXUp = flashingOdds[btnX.odd_id] === 'up';
                                                            const isFlashBtnXDown = flashingOdds[btnX.odd_id] === 'down';
                                                            const flashClassX = isFlashBtnXUp ? 'bg-[#00e700] border-[#00e700] shadow-[0_0_8px_#00e700]' : isFlashBtnXDown ? 'bg-red-500 border-red-500 shadow-[0_0_8px_red]' : '';

                                                            const isFlashBtn2Up = flashingOdds[btn2.odd_id] === 'up';
                                                            const isFlashBtn2Down = flashingOdds[btn2.odd_id] === 'down';
                                                            const flashClass2 = isFlashBtn2Up ? 'bg-[#00e700] border-[#00e700] shadow-[0_0_8px_#00e700]' : isFlashBtn2Down ? 'bg-red-500 border-red-500 shadow-[0_0_8px_red]' : '';

                                                            return (
                                                                <div key={game.id} className="flex flex-col border-b border-[#2a3038] last:border-b-0 hover:bg-[#24292e] transition-colors">
                                                                    <div className="flex items-stretch min-h-[54px] py-0.5">
                                                                        <div className="w-12 sm:w-16 flex flex-col justify-center items-center text-[9px] sm:text-[10px] border-r border-[#2a3038] text-slate-400 font-medium shrink-0 bg-[#1a1f24]/50">
                                                                            <span>{matchDate.getDate()}/{matchDate.getMonth() + 1}</span>
                                                                            <span className="text-[#ffcc00] font-bold">{matchDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                                        </div>

                                                                        <div className="flex-1 flex items-center gap-0.5 sm:gap-1 p-1 sm:p-1.5 min-w-0">
                                                                            <button onClick={() => toggleSelection(game, btn1, mainMarketView === '1X2' ? '1x2' : 'Double Chance')} className={`flex-1 h-full min-h-[44px] flex justify-between items-center px-1.5 sm:px-3 rounded transition-all duration-500 border ${flashClass1 !== '' ? flashClass1 : betSlip.some((item: any) => item.odd_id === btn1.odd_id) ? 'bg-[#ffcc00] border-[#ffcc00] text-black shadow-md' : 'bg-[#1e2328] border-[#3b4148] hover:border-[#ffcc00] shadow-sm'} ${btn1.value === "0.00" ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                                                                <span className={`text-[9.5px] sm:text-[11px] font-semibold truncate max-w-[50px] sm:max-w-[90px] ${flashClass1 !== '' ? (isFlashBtn1Up ? 'text-black' : 'text-white') : betSlip.some((item: any) => item.odd_id === btn1.odd_id) ? 'text-black' : 'text-slate-300'}`}>{mainMarketView === '1X2' ? game.home_team : '1X'}</span>
                                                                                <span className={`font-black text-[11px] sm:text-[12px] ${flashClass1 !== '' ? (isFlashBtn1Up ? 'text-black' : 'text-white') : betSlip.some((item: any) => item.odd_id === btn1.odd_id) ? 'text-black' : 'text-[#ffcc00]'}`}>{btn1?.value !== "0.00" ? btn1?.value : "-"}</span>
                                                                            </button>
                                                                            <button onClick={() => toggleSelection(game, btnX, mainMarketView === '1X2' ? '1x2' : 'Double Chance')} className={`w-10 sm:w-16 shrink-0 h-full min-h-[44px] flex flex-col sm:flex-row justify-center sm:justify-between items-center px-1 sm:px-2 rounded transition-all duration-500 border ${flashClassX !== '' ? flashClassX : betSlip.some((item: any) => item.odd_id === btnX.odd_id) ? 'bg-[#ffcc00] border-[#ffcc00] text-black shadow-md' : 'bg-[#1e2328] border-[#3b4148] hover:border-[#ffcc00] shadow-sm'} ${btnX.value === "0.00" ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                                                                {mainMarketView === 'DC' && <span className={`text-[9.5px] sm:text-[11px] font-semibold mb-0.5 sm:mb-0 ${flashClassX !== '' ? (isFlashBtnXUp ? 'text-black' : 'text-white') : betSlip.some((item: any) => item.odd_id === btnX.odd_id) ? 'text-black' : 'text-slate-300'}`}>12</span>}
                                                                                <span className={`font-black text-[11px] sm:text-[12px] ${flashClassX !== '' ? (isFlashBtnXUp ? 'text-black' : 'text-white') : betSlip.some((item: any) => item.odd_id === btnX.odd_id) ? 'text-black' : 'text-slate-300'}`}>{btnX?.value !== "0.00" ? btnX?.value : "-"}</span>
                                                                            </button>
                                                                            <button onClick={() => toggleSelection(game, btn2, mainMarketView === '1X2' ? '1x2' : 'Double Chance')} className={`flex-1 h-full min-h-[44px] flex justify-between items-center px-1.5 sm:px-3 rounded transition-all duration-500 border ${flashClass2 !== '' ? flashClass2 : betSlip.some((item: any) => item.odd_id === btn2.odd_id) ? 'bg-[#ffcc00] border-[#ffcc00] text-black shadow-md' : 'bg-[#1e2328] border-[#3b4148] hover:border-[#ffcc00] shadow-sm'} ${btn2.value === "0.00" ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                                                                <span className={`font-black text-[11px] sm:text-[12px] ${flashClass2 !== '' ? (isFlashBtn2Up ? 'text-black' : 'text-white') : betSlip.some((item: any) => item.odd_id === btn2.odd_id) ? 'text-black' : 'text-[#ffcc00]'}`}>{btn2?.value !== "0.00" ? btn2?.value : "-"}</span>
                                                                                <span className={`text-[9.5px] sm:text-[11px] font-semibold truncate max-w-[50px] sm:max-w-[90px] ${flashClass2 !== '' ? (isFlashBtn2Up ? 'text-black' : 'text-white') : betSlip.some((item: any) => item.odd_id === btn2.odd_id) ? 'text-black' : 'text-slate-300'}`}>{mainMarketView === '1X2' ? game.away_team : 'X2'}</span>
                                                                            </button>
                                                                        </div>

                                                                        <div className="w-10 sm:w-14 flex items-center justify-center border-l border-[#2a3038] shrink-0 bg-[#1a1f24]/50">
                                                                            <button onClick={() => setSelectedMatch(game)} className={`w-full h-full text-[10px] font-bold transition-colors flex flex-col items-center justify-center ${hasSelectionInGame ? 'bg-[#ffcc00] text-black shadow-inner' : 'text-slate-400 hover:text-white hover:bg-[#2a3038]'}`}>
                                                                                <span className={`text-xs ${hasSelectionInGame ? 'text-black' : 'text-slate-300'}`}>❯</span>
                                                                                <span className={hasSelectionInGame ? 'text-black' : ''}>+{totalMarketsCount}</span>
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            )
                                                        })}
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </main>

                <aside className={`fixed inset-y-0 right-0 z-50 w-full sm:w-[320px] bg-[#1e2328] border-l border-[#2a3038] overflow-hidden flex flex-col transform transition-transform duration-300 ${isMobileBetSlipOpen ? 'translate-x-0' : 'translate-x-full'} lg:relative lg:translate-x-0 lg:w-[300px] shrink-0 shadow-[-4px_0_15px_rgba(0,0,0,0.3)] lg:shadow-none`}>
                    <div className="bg-[#1e2328] p-3 border-b border-[#3b4148] z-20">
                        <div className="flex bg-[#24292e] rounded border border-[#3b4148] focus-within:border-[#ffcc00] overflow-hidden shadow-inner">
                            <input type="text" placeholder="Booking Code ያስገቡ..." value={ticketCodeInput} onChange={(e) => setTicketCodeInput(e.target.value)} className="bg-transparent text-xs text-white p-2.5 flex-1 outline-none uppercase tracking-wider" />
                            <button onClick={handleLoadTicket} disabled={isLoading || !ticketCodeInput.trim()} className="bg-[#3b4148] hover:bg-[#ffcc00] hover:text-black text-slate-300 text-xs px-4 font-black transition-colors disabled:opacity-50">ጫን</button>
                        </div>
                        {ticketLoadError && <p className="text-[10px] text-red-500 font-bold mt-1.5">{ticketLoadError}</p>}
                    </div>

                    <div className="bg-[#24292e] p-3 border-b border-[#3b4148] shadow-sm z-10 flex justify-between items-center">
                        <h2 className="text-sm font-black text-white uppercase tracking-wide flex items-center">Bet Slip<span className="bg-[#ffcc00] text-black font-bold text-[10px] px-2 py-0.5 rounded-full ml-2">{betSlip.length}</span></h2>
                        <button onClick={() => setIsMobileBetSlipOpen(false)} className="lg:hidden text-slate-400 hover:text-white text-2xl leading-none">×</button>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar bg-[#16191c]">
                        {betSlip.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-slate-500 opacity-60"><span className="text-4xl mb-2">📋</span><p className="text-xs font-bold text-white mb-1">ምንም አልመረጡም</p></div>
                        ) : (
                            <div className="flex flex-col p-2 space-y-2">
                                {betSlip.map((item: any) => {
                                    const isStarted = new Date(item.match_time).getTime() < new Date().getTime();
                                    const isFlashingUp = flashingOdds[item.odd_id] === 'up';
                                    const isFlashingDown = flashingOdds[item.odd_id] === 'down';
                                    
                                    return (
                                        <div key={item.odd_id} className={`bg-[#1e2328] border ${isStarted ? 'border-red-500 shadow-[0_0_5px_rgba(239,68,68,0.3)]' : isFlashingUp ? 'border-[#00e700] shadow-[0_0_5px_rgba(0,231,0,0.3)]' : isFlashingDown ? 'border-red-500 shadow-[0_0_5px_rgba(239,68,68,0.3)]' : 'border-[#2a3038] hover:border-[#3b4148]'} rounded-md p-3 relative group transition-colors shadow-sm`}>
                                            <button onClick={() => toggleSelection({ id: item.fixture_id }, { odd_id: item.odd_id })} className="absolute top-2 right-2 text-slate-500 hover:text-red-500 text-lg leading-none transition-colors">✕</button>
                                            <div className="flex justify-between items-center mb-1.5 pr-4">
                                                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider truncate mr-2">{item.league_name}</span>
                                                <span className={`text-[10px] font-black shrink-0 ${isStarted ? 'text-red-500 animate-pulse' : 'text-[#ffcc00]'}`}>
                                                    {new Date(item.match_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                            <div className="pr-5 mb-2">
                                                <p className={`text-[11px] font-bold leading-snug ${isStarted ? 'text-slate-400 line-through' : 'text-white'}`}>
                                                    {item.home_team} <span className="text-slate-500 font-normal px-1">vs</span> {item.away_team}
                                                </p>
                                            </div>
                                            <div className={`flex justify-between items-center bg-[#1a1f24] p-1.5 rounded border ${isStarted ? 'border-red-500/30' : isFlashingUp ? 'border-[#00e700]/50 bg-[#00e700]/10' : isFlashingDown ? 'border-red-500/50 bg-red-500/10' : 'border-[#2a3038]'}`}>
                                                <span className="text-[11px] text-[#ffcc00] font-bold">{item.odd_name}</span>
                                                <span className={`text-[13px] font-black ${isFlashingUp ? 'text-[#00e700]' : isFlashingDown ? 'text-red-500' : 'text-white'}`}>{Number(item.odd_value).toFixed(2)}</span>
                                            </div>
                                            {isStarted && (
                                                <div className="mt-2 bg-red-500/10 text-red-500 text-[10px] font-bold p-1.5 rounded border border-red-500/20 text-center">
                                                    ⚠️ ይህ ጨዋታ ጀምሯል (አልፏል)
                                                </div>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>

                    {betSlip.length > 0 && (
                        <div className="bg-[#1a1f24] p-4 border-t border-[#3b4148] shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.3)] z-10">
                            <div className="flex justify-between items-center mb-1.5"><span className="text-[11px] text-slate-400">Total Odds</span><span className="text-[13px] font-black text-white">{totalOdds}</span></div>
                            <div className="flex justify-between items-center mb-3"><span className="text-[11px] font-bold text-slate-300">Potential Win</span><span className="text-[14px] font-black text-[#00e700]">{grossWin.toFixed(2)} Br</span></div>

                            <label className="flex items-center gap-2 mb-2 cursor-pointer w-max">
                                <input type="checkbox" checked={acceptOddsChange} onChange={(e) => setAcceptOddsChange(e.target.checked)} className="w-3.5 h-3.5 accent-[#ffcc00]" />
                                <span className="text-[10px] font-bold text-slate-400 select-none uppercase tracking-wider">Accept all odd changes</span>
                            </label>

                            <div className={`flex items-center gap-2 bg-[#24292e] border rounded transition-colors mb-2 overflow-hidden h-[40px] shadow-inner ${limitWarning ? 'border-red-500' : 'border-[#3b4148] focus-within:border-[#ffcc00]'}`}>
                                <span className="text-[10px] font-bold text-slate-400 pl-3 uppercase">Stake</span><input type="number" value={stake} onChange={(e) => {
                                    const raw = e.target.value;
                                    if (raw === '') { setStake(0); return; }
                                    const parsed = Number(raw);
                                    setStake(Number.isFinite(parsed) ? parsed : 0);
                                }} className="flex-1 h-full bg-transparent text-white text-sm font-bold outline-none text-right pr-3" />
                            </div>

                            <div className="h-[18px] mb-2 flex items-center justify-center">{(limitWarning || errorMessage) && <p className="text-[10px] text-red-500 font-bold leading-tight text-center">{limitWarning || errorMessage}</p>}</div>
                            <div className="flex gap-2 h-[44px]">
                                <button onClick={() => { setBetSlip([]); clearBookingCode(); }} className="bg-[#24292e] border border-[#3b4148] text-slate-400 hover:text-red-400 hover:border-red-400 text-sm font-bold w-12 rounded flex items-center justify-center transition-colors">🗑</button>
                                <button onClick={handlePlaceBet} disabled={isLoading || !!limitWarning} className="flex-1 bg-[#ffcc00] hover:bg-[#e6b800] text-black font-black text-sm rounded flex items-center justify-center transition-transform active:scale-[0.98] disabled:opacity-50 disabled:bg-slate-600 disabled:text-slate-400 disabled:cursor-not-allowed shadow-md">
                                    {isLoading ? '...' : 'Book Bet'}
                                </button>
                            </div>
                        </div>
                    )}
                </aside>
            </div>

            {/* 🌟 ቲኬት ማረጋገጫ (Check Ticket Modal) 🌟 */}
            {isCheckTicketModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in p-2 sm:p-4 overflow-y-auto">
                    <div className="bg-[#1e2328] border border-[#3b4148] rounded-xl w-full max-w-lg shadow-2xl relative my-auto animate-fade-in-down flex flex-col max-h-full">

                        <div className="p-4 border-b border-[#3b4148] flex justify-between items-center bg-[#24292e] rounded-t-xl shrink-0">
                            <h2 className="text-[#ffcc00] font-black text-lg flex items-center gap-2"><span>🔍</span> ትኬት ማረጋገጫ</h2>
                            <button onClick={closeCheckTicketModal} className="text-slate-400 hover:text-white text-2xl leading-none">✕</button>
                        </div>

                        <div className="p-4 shrink-0">
                            <form onSubmit={handleCheckCustomerTicket} className="flex gap-2">
                                <input
                                    type="text"
                                    value={checkInputCode}
                                    onChange={(e) => setCheckInputCode(e.target.value.trim())}
                                    placeholder="የትኬት ቁጥር (8 ዲጂት ብቻ)..."
                                    maxLength={8}
                                    className="flex-1 bg-[#0d1117] border border-[#3b4148] text-white px-4 py-3 rounded-lg outline-none focus:border-[#ffcc00] text-sm font-black uppercase tracking-widest transition shadow-inner"
                                />
                                <button type="submit" disabled={isCheckingTicket || !checkInputCode} className="bg-[#ffcc00] hover:bg-[#e6b800] disabled:bg-[#3b4148] disabled:text-slate-500 text-black font-black px-6 rounded-lg transition active:scale-95 text-sm shadow-md">
                                    {isCheckingTicket ? '...' : 'ፈልግ'}
                                </button>
                            </form>
                            {checkTicketError && <p className="text-red-400 text-xs font-bold mt-3 bg-red-500/10 p-2 rounded border border-red-500/20">{checkTicketError}</p>}
                        </div>

                        {checkedTicketData && (
                            <div className="p-3 sm:p-4 pt-0 overflow-y-auto custom-scrollbar flex-1">
                                {(() => {
                                    let displayStatus = checkedTicketData.status;
                                    const allItemsWon = checkedTicketData.selections?.length > 0 && checkedTicketData.selections.every((item: any) => item.match_status === 'won');
                                    const anyItemLost = checkedTicketData.selections?.some((item: any) => item.match_status === 'lost');

                                    if (displayStatus === 'active') {
                                        if (anyItemLost) displayStatus = 'lost';
                                        else if (allItemsWon) displayStatus = 'won';
                                    }

                                    return (
                                        <div className="bg-[#0d1117] border border-[#30363d] rounded-xl p-3 sm:p-4 shadow-inner">
                                            <div className="grid grid-cols-4 text-center text-xs border-b border-[#3b4148] pb-3 mb-3">
                                                <div><p className="text-slate-500 text-[10px] mb-1">Date</p><p className="text-white font-bold">{new Date(checkedTicketData.created_at).toLocaleDateString([], { day: '2-digit', month: '2-digit' })}</p></div>
                                                <div><p className="text-slate-500 text-[10px] mb-1">Type</p><p className="text-white font-bold">Prematch</p></div>
                                                <div><p className="text-slate-500 text-[10px] mb-1">Amount</p><p className="text-white font-bold">{checkedTicketData.stake_amount}</p></div>
                                                <div><p className="text-slate-500 text-[10px] mb-1">Win</p><p className="text-[#00e700] font-bold">{checkedTicketData.potential_win}</p></div>
                                            </div>

                                            <div className="flex justify-between items-center mb-2">
                                                <p className="text-xs font-bold text-slate-400">Events</p>
                                                <div className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest ${displayStatus === 'won' ? 'bg-[#00e700]/20 text-[#00e700]' : displayStatus === 'paid' ? 'bg-blue-500/20 text-blue-400' : displayStatus === 'void' ? 'bg-slate-500/20 text-slate-400' : displayStatus === 'expired' ? 'bg-red-500/20 text-red-500' : displayStatus === 'lost' ? 'bg-red-500/20 text-red-500' : 'bg-[#1e2328] border border-[#30363d] text-slate-300'}`}>
                                                    {displayStatus === 'won' ? '🎉 Won' : displayStatus === 'paid' ? '✅ Paid' : displayStatus === 'void' ? '🚫 Void' : displayStatus === 'expired' ? '⏳ Expired' : displayStatus === 'lost' ? '❌ Lost' : '⏳ Pending'}
                                                </div>
                                            </div>

                                            <div className="space-y-2 mb-2">
                                                {checkedTicketData.selections?.map((item: any, i: number) => {
                                                    const isWon = item.match_status === 'won';
                                                    const isLost = item.match_status === 'lost';
                                                    const icon = isWon ? (
                                                        <svg className="w-5 h-5 text-green-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                                                    ) : isLost ? (
                                                        <svg className="w-5 h-5 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
                                                    ) : (
                                                        <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" /></svg>
                                                    );

                                                    const teams = (item.match_info || "Home vs Away").split(' vs ');
                                                    const homeTeam = teams[0] || 'Home';
                                                    const awayTeam = teams[1] || 'Away';

                                                    return (
                                                        <div key={i} className={`bg-[#161b22] border ${isWon ? 'border-[#00e700]/30' : isLost ? 'border-red-500/30' : 'border-[#30363d]'} rounded-lg overflow-hidden`}>
                                                            <div className="flex items-center justify-between p-3 border-b border-[#30363d]">
                                                                <span className="w-5 text-center text-sm">{icon}</span>
                                                                <div className="flex-1 flex justify-between items-center px-2 sm:px-3">
                                                                    <span className="text-[11px] sm:text-xs font-bold text-white text-right flex-1 truncate">{homeTeam}</span>
                                                                    <span className="mx-2 text-[10px] bg-[#24292e] px-2 py-0.5 rounded text-slate-400 shrink-0 font-black border border-[#3b4148]">vs</span>
                                                                    <span className="text-[11px] sm:text-xs font-bold text-white text-left flex-1 truncate">{awayTeam}</span>
                                                                </div>
                                                                <span className="text-slate-500 text-xs">❯</span>
                                                            </div>
                                                            <div className="bg-[#0d1117] p-2 flex justify-between items-center text-[10px] text-slate-400">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="bg-[#1e2328] px-1.5 py-0.5 rounded border border-[#3b4148]">Pick: <span className="font-bold text-white ml-1">{item.odd_name} <span className="text-[#ffcc00]">({item.odd_value})</span></span></span>
                                                                </div>
                                                                <div>Outcome: <span className={`font-bold ml-1 uppercase ${isWon ? 'text-[#00e700]' : isLost ? 'text-red-500' : 'text-slate-300'}`}>{item.match_status || 'Pending'}</span></div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* 🌟 አዲሱ እና በምስሉ መሰረት ያጌጠው TICKET BOOKED PREVIEW 🌟 */}
            {bookingCode && !isBookingPreviewOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in p-4 overflow-y-auto">
                    <div className="bg-[#1e2328] border border-[#3b4148] w-full max-w-[360px] relative my-auto flex flex-col animate-fade-in-down rounded-2xl overflow-hidden shadow-2xl">

                        <div className="bg-[#ffcc00] p-6 flex flex-col items-center justify-center relative">
                            <button onClick={() => { setBookingCode(null); setIsBookingPreviewOpen(false); }} className="absolute top-3 right-3 text-black/60 hover:text-black bg-black/5 hover:bg-black/10 rounded-full w-7 h-7 flex items-center justify-center transition">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                            </button>
                            <div className="w-14 h-14 bg-transparent border-4 border-black/20 rounded-full flex items-center justify-center mb-3">
                                <svg className="w-7 h-7 text-black" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"></path></svg>
                            </div>
                            <h2 className="text-xl font-black text-black tracking-wide">Bet Booked!</h2>
                        </div>

                        <div className="p-5 bg-[#16191c]">
                            <button onClick={handleCopyBookingCode} className="w-full border border-dashed border-[#ffcc00]/50 bg-[#1e2328] hover:border-[#ffcc00] rounded-xl p-4 flex justify-center items-center gap-3 transition-colors group mb-4">
                                <span className="text-[22px] font-black text-white tracking-[0.15em]">{bookingCode}</span>
                                <svg className={`w-5 h-5 transition-colors ${codeCopied ? 'text-[#00e700]' : 'text-[#ffcc00]'}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                    {codeCopied ? <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"></path> : <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path>}
                                </svg>
                            </button>

                            <div className="grid grid-cols-2 gap-3 mb-3">
                                <div className="bg-[#1e2328] border border-[#2a3038] rounded-xl p-3 flex flex-col justify-center">
                                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-0.5">Stake</span>
                                    <span className="text-sm font-black text-white">{safeStake.toFixed(2)} ETB</span>
                                </div>
                                <div className="bg-[#1e2328] border border-[#2a3038] rounded-xl p-3 flex flex-col justify-center">
                                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-0.5">Total Odds</span>
                                    <span className="text-sm font-black text-white">{totalOdds}</span>
                                </div>
                            </div>

                            <div className="bg-[#1e2328] border border-[#2a3038] rounded-xl p-4 flex justify-between items-center mb-5">
                                <span className="text-sm font-bold text-white">Potential Win</span>
                                <span className="text-[17px] font-black text-[#ffcc00]">{grossWin.toFixed(2)} ETB</span>
                            </div>

                            <div className="border-t border-dashed border-[#3b4148] pt-5 flex flex-col items-center">
                                <BarcodeSVG value={bookingCode!} lineColor="#ffffff" className="h-[46px] w-full max-w-[240px]" />
                                <span className="text-[11px] text-slate-300 font-medium mt-1.5 tracking-widest">{bookingCode}</span>
                                <span className="text-[9px] text-slate-500 mt-1">Take this code to any branch to confirm your bet</span>
                            </div>

                            <div className="grid grid-cols-2 gap-3 mt-6">
                                <button onClick={() => setIsBookingPreviewOpen(true)} className="border border-[#3b4148] text-white font-bold text-[13px] rounded-xl py-3 flex items-center justify-center gap-2 hover:bg-[#1e2328] transition-colors">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                                    Preview
                                </button>
                                <button onClick={handleShareBooking} className="bg-[#ffcc00] text-black font-black text-[13px] rounded-xl py-3 flex items-center justify-center gap-2 hover:bg-[#e6b800] transition-colors shadow-md">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"></path></svg>
                                    Share
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {bookingCode && isBookingPreviewOpen && (
                <div className="fixed inset-0 z-[100] flex flex-col items-center bg-[#0d1117]/95 overflow-y-auto animate-fade-in p-2 sm:p-4">
                    <div className="w-full max-w-md mb-4 flex justify-between items-center shrink-0 pt-2">
                        <button onClick={() => setIsBookingPreviewOpen(false)} className="text-slate-400 hover:text-white flex items-center gap-1.5 font-bold text-xs px-3 py-2 bg-[#1e2328] rounded-lg border border-[#3b4148] transition-colors">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg> Back
                        </button>
                        <div className="flex gap-2">
                            <button onClick={handleSaveReceipt} className="text-slate-300 hover:text-[#ffcc00] bg-[#1e2328] rounded-lg border border-[#3b4148] px-3 py-2 text-xs font-bold flex items-center gap-1.5 transition-colors">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg> Save
                            </button>
                            <button onClick={handleShareBooking} className="text-black bg-[#ffcc00] hover:bg-[#e6b800] rounded-lg px-4 py-2 text-xs font-black flex items-center gap-1.5 shadow-sm transition-colors">
                                Share
                            </button>
                        </div>
                    </div>

                    <div ref={receiptRef} className="w-full max-w-md bg-[#161b22] rounded-xl overflow-hidden pb-8 shadow-2xl relative shrink-0 border border-[#30363d]">
                        {/* Header */}
                        <div className="flex justify-between items-start p-5 bg-[#0d1117]">
                            <div>
                                <h1 className="text-[22px] font-black text-white leading-none tracking-tight">
                                    vibebet<span className="text-[#ffcc00]">.et</span>
                                </h1>
                                <p className="text-[9px] text-slate-500 font-bold tracking-widest mt-2 uppercase">Ticket Receipt</p>
                            </div>
                            <div className="flex flex-col items-center">
                                <div className="bg-white p-1 rounded-sm">
                                    <QRCodeSVG value={bookingShareUrl} size={46} bgColor="#ffffff" fgColor="#000000" />
                                </div>
                                <span className="text-[8px] font-medium text-slate-500 mt-1">Scan to view</span>
                            </div>
                        </div>

                        {/* Sub-header */}
                        <div className="flex justify-between items-center px-5 py-2.5 bg-[#1a1f24] border-y border-[#30363d] text-xs">
                            <div className="flex items-center gap-1.5 text-[#ffcc00] font-black tracking-wider">
                                <span className="text-[8px]">●</span> BOOKED
                            </div>
                            <div className="text-white font-black tracking-widest text-[13px]">
                                #{bookingCode}
                            </div>
                            <div className="text-slate-400 font-medium text-[10px]">
                                {new Date().toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' })} at {new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                            </div>
                        </div>

                        {/* Matches List */}
                        <div className="px-5">
                            {betSlip.map((item: any, idx: number) => (
                                <div key={idx} className="py-4 border-b border-[#30363d] last:border-0">
                                    <p className="text-[10px] text-slate-500 font-medium mb-1.5">{formatMatchDateTime(item.match_time)}</p>
                                    <div className="flex justify-between items-start mb-1">
                                        <div className="flex items-start gap-2 flex-1 pr-3">
                                            <span className="text-slate-400 text-[13px] leading-tight">⚽</span>
                                            <h3 className="text-[13px] font-bold text-white leading-snug">{item.home_team} - {item.away_team}</h3>
                                        </div>
                                        <span className="text-[15px] font-black text-white shrink-0">{item.odd_value.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between items-center pl-[22px]">
                                        <span className="text-[11px] text-slate-500 font-medium">{item.market_name}</span>
                                        <span className="text-[11px] font-bold text-slate-300 text-right">{item.odd_name}</span>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Footer summary */}
                        <div className="px-5 mt-2">
                            <div className="bg-[#0d1117] rounded-lg p-3 flex justify-between items-center border border-[#30363d]">
                                <div className="flex flex-col gap-0.5">
                                    <span className="text-slate-500 text-[10px] font-medium">Odds <span className="text-[#ffcc00] font-bold ml-0.5">{totalOdds}</span></span>
                                </div>
                                <div className="flex flex-col gap-0.5 items-center">
                                    <span className="text-slate-500 text-[10px] font-medium">Stake <span className="text-white font-bold ml-0.5">ETB {safeStake.toFixed(2)}</span></span>
                                </div>
                                <div className="flex flex-col gap-0.5 items-end">
                                    <span className="text-slate-500 text-[10px] font-medium">Payout <span className="text-white font-bold ml-0.5">ETB {grossWin.toFixed(2)}</span></span>
                                </div>
                            </div>
                        </div>

                        {/* Barcode bottom */}
                        <div className="mt-6 flex flex-col items-center opacity-80 px-8">
                            <BarcodeSVG value={bookingCode!} lineColor="#ffffff" className="h-10 w-full" />
                            <span className="text-[9px] text-slate-500 font-medium mt-1 tracking-widest">{bookingCode}</span>
                        </div>
                    </div>
                </div>
            )}
            
            <style jsx global>{`
                .custom-scrollbar::-webkit-scrollbar { width: 4px; height: 4px; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #3b4148; border-radius: 10px; }
                input[type=number]::-webkit-inner-spin-button, input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
                input[type=number] { -moz-appearance: textfield; }
                input[type=date]::-webkit-calendar-picker-indicator { width: 100%; height: 100%; margin: 0; padding: 0; cursor: pointer; }
                @keyframes fadeInDown { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
                .animate-fade-in-down { animation: fadeInDown 0.2s ease-out forwards; }
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                .animate-fade-in { animation: fadeIn 0.2s ease-out forwards; }
            `}</style>
        </div>
    );
}
