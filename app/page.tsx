"use client";

import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import AuthModal from './components/AuthModal';

const MAX_STAKE = 10000;
const MAX_WIN = 10000;
const MIN_STAKE = 20; 

export default function Home() {
    const [isMounted, setIsMounted] = useState(false);
    const [fixtures, setFixtures] = useState<any[]>([]);
    const [betSlip, setBetSlip] = useState<any[]>([]);
    const [stake, setStake] = useState<number>(20);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [isFetchingFixtures, setIsFetchingFixtures] = useState<boolean>(true);
    const [bookingCode, setBookingCode] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState<string>('');
    
    const [ticketCodeInput, setTicketCodeInput] = useState<string>('');
    const [placedBetSignatures, setPlacedBetSignatures] = useState<string[]>([]);
    
    const [user, setUser] = useState<any>(null);
    const [token, setToken] = useState<string | null>(null);
    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
    const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
    
    const [selectedMatch, setSelectedMatch] = useState<any>(null);
    const [marketTab, setMarketTab] = useState<string>('All');
    
    const [selectedLeague, setSelectedLeague] = useState<string>('Upcoming');
    const [isTopLeaguesOpen, setIsTopLeaguesOpen] = useState(true);
    const [isSoccerOpen, setIsSoccerOpen] = useState(true);
    const [openCountry, setOpenCountry] = useState<string | null>(null);

    const [openAccordions, setOpenAccordions] = useState<string[]>(['3 Way', 'Both teams to score', 'Double chance', 'Over/Under']);

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
        const storedUser = localStorage.getItem('user');
        const storedToken = localStorage.getItem('token');
        if (storedUser && storedToken) {
            setUser(JSON.parse(storedUser));
            setToken(storedToken);
        }
    }, []);

    useEffect(() => {
        setIsFetchingFixtures(true);
        axios.get(`${process.env.NEXT_PUBLIC_API_URL}/api/matches/list`)
            .then(res => {
                if (res.data.success) {
                    const formatted = res.data.data.map((game: any) => {
                        let parsedOdds = [];
                        let rawMarkets = [];
                        try {
                            const bookmakers = typeof game.odds_data === 'string' ? JSON.parse(game.odds_data) : game.odds_data;
                            rawMarkets = bookmakers[0]?.markets || [];
                            
                            const h2h = rawMarkets.find((m: any) => {
                                const title = (m?.title || m?.name || '').toLowerCase();
                                return m.id === 1 || m?.key === 'h2h' || title === 'match winner' || title === '3 way' || title.includes('result') || title.includes('match betting');
                            });

                            const odd1 = h2h?.outcomes?.find((o: any) => o?.name === game.home_team || o?.name === 'Home' || o?.name === '1')?.price || 0;
                            const oddX = h2h?.outcomes?.find((o: any) => o?.name === 'Draw' || o?.name === 'X')?.price || 0;
                            const odd2 = h2h?.outcomes?.find((o: any) => o?.name === game.away_team || o?.name === 'Away' || o?.name === '2')?.price || 0;

                            parsedOdds = [
                                { odd_id: `1_${game.id}`, option: "1", value: odd1 ? parseFloat(odd1).toFixed(2) : "0.00" },
                                { odd_id: `x_${game.id}`, option: "X", value: oddX ? parseFloat(oddX).toFixed(2) : "0.00" },
                                { odd_id: `2_${game.id}`, option: "2", value: odd2 ? parseFloat(odd2).toFixed(2) : "0.00" }
                            ];
                        } catch (e) {
                            parsedOdds = [{ odd_id: `1_${game.id}`, option: "1", value: "0.00" }, { odd_id: `x_${game.id}`, option: "X", value: "0.00" }, { odd_id: `2_${game.id}`, option: "2", value: "0.00" }];
                        }

                        return {
                            id: game.id,
                            home_team: game.home_team || "Home",
                            away_team: game.away_team || "Away",
                            match_time: game.commence_time,
                            league: game.sport_key || "World|Soccer|https://media.api-sports.io/flags/un.svg",
                            league_flag: game.league_logo, 
                            odds: parsedOdds,
                            raw_markets: rawMarkets 
                        };
                    });
                    
                    setFixtures(formatted);
                }
            })
            .catch(err => console.error("ዳታ ማምጣት አልተቻለም:", err))
            .finally(() => setIsFetchingFixtures(false));
    }, []);

    const toggleSelection = (game: any, odd: any) => {
        if (!odd || odd.value === "0.00" || odd.value === "-") return; 
        setBookingCode(null);
        setErrorMessage(null);
        setBetSlip(prev => {
            const exists = prev.find(item => item.fixture_id === game.id);
            if (exists && exists.odd_id === odd.odd_id) return prev.filter(item => item.fixture_id !== game.id);
            const newItem = {
                fixture_id: game.id, home_team: game.home_team, away_team: game.away_team,
                match_time: game.match_time, league_name: getLeagueDetails(game.league).name,
                odd_id: odd.odd_id, odd_name: odd.option, odd_value: parseFloat(odd.value)
            };
            return [...prev.filter(item => item.fixture_id !== game.id), newItem];
        });
    };

    const handleMarketSelection = (game: any, odd: any) => {
        toggleSelection(game, odd);
        setSelectedMatch(null); 
    };

    const totalOdds = betSlip.reduce((total, item) => total * (item.odd_value || 1), 1).toFixed(2);
    const grossWin = parseFloat(totalOdds) * stake;

    const isUnderStake = stake < MIN_STAKE;
    const isOverStake = stake > MAX_STAKE;
    const isOverWin = grossWin > MAX_WIN;
    const currentBetSignature = betSlip.map(i => i.odd_id).sort().join('|');
    const isDuplicateBet = betSlip.length > 0 && placedBetSignatures.includes(currentBetSignature);

    let limitWarning = null;
    if (isUnderStake) limitWarning = `ዝቅተኛው መቁረጫ ሂሳብ ${MIN_STAKE} ብር ነው!`;
    else if (isOverStake) limitWarning = `ከ ${MAX_STAKE.toLocaleString()} ብር በላይ መቁረጥ አይቻልም!`;
    else if (isOverWin) limitWarning = `ከ ${MAX_WIN.toLocaleString()} ብር በላይ ማሸነፍ አይቻልም!`;
    else if (isDuplicateBet) limitWarning = "ይህ ምርጫ (ትኬት) ተቆርጧል! ሌላ ሰው ኮፒ ማድረግ አይችልም።";

    const handlePlaceBet = async () => {
        if (betSlip.length === 0 || stake < MIN_STAKE || limitWarning) return;
        setIsLoading(true);
        try {
            const payload = {
                stake_amount: stake, is_guest: !user,
                accept_odds_change: acceptOddsChange,
                selections: betSlip.map(item => ({ fixture_id: item.fixture_id, odd_id: item.odd_id, odd_value: item.odd_value, match_info: `${item.home_team} vs ${item.away_team}`, odd_name: item.odd_name }))
            };
            const headers = user ? { Authorization: `Bearer ${token}` } : {};
            const response = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/api/tickets/place`, payload, { headers });
            
            if (response.data.success) {
                if (!user) {
                    const bCode = response.data.booking_code || response.data.data?.booking_code;
                    setBookingCode(bCode);
                } else {
                    alert(`ትኬትዎ በተሳካ ሁኔታ ተቆርጧል!`);
                    setUser({ ...user, current_balance: (user.current_balance || 0) - stake });
                    setBetSlip([]); 
                }
                setPlacedBetSignatures(prev => [...prev, currentBetSignature]);
                if(window.innerWidth < 1024 && user) setIsMobileBetSlipOpen(false); 
            }
        } catch (error: any) { setErrorMessage("ስህተት ተፈጥሯል"); } finally { setIsLoading(false); }
    };

    const loadTicketByCode = async (code: string) => {
        if (!code.trim()) return;
        setIsLoading(true);
        try {
            const response = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/api/tickets/load/${code}`);
            if (response.data.success && response.data.data.selections) {
                const loadedSelections = response.data.data.selections.map((s: any) => ({
                    fixture_id: s.fixture_id, home_team: s.match_info ? s.match_info.split(' vs ')[0] : 'Home', away_team: s.match_info ? s.match_info.split(' vs ')[1] : 'Away',
                    odd_id: s.odd_id, odd_name: s.odd_name, odd_value: parseFloat(s.odd_value || 0),
                    match_time: new Date().toISOString(), league_name: 'Loaded Match'
                }));
                setBetSlip(loadedSelections); setBookingCode(null); return true;
            } else { alert("ትኬቱ አልተገኘም! እባክዎ ትክክለኛ Booking Code ያስገቡ።"); return false; }
        } catch (err) { alert("ትኬት ማምጣት አልተቻለም!"); return false; } finally { setIsLoading(false); }
    };

    const handleLoadTicket = async () => {
        const success = await loadTicketByCode(ticketCodeInput);
        if (success) setTicketCodeInput('');
    };

    const handleCheckCustomerTicket = async (e: React.FormEvent) => {
        e.preventDefault();
        const cleanCode = checkInputCode.trim().toUpperCase();
        if (!cleanCode) return;
        setIsCheckingTicket(true); setCheckTicketError(null); setCheckedTicketData(null);
        try {
            const response = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/api/tickets/check/${cleanCode}`);
            if (response.data.success) setCheckedTicketData(response.data.data);
        } catch (err: any) { setCheckTicketError(err.response?.data?.message || 'ይህ ትኬት ወይም ቡኪንግ ኮድ አልተገኘም!'); } finally { setIsCheckingTicket(false); }
    };

    const handleBetAgain = async () => {
        if (!checkedTicketData) return;
        const codeToLoad = checkedTicketData.booking_code || checkedTicketData.ticket_number;
        const success = await loadTicketByCode(codeToLoad);
        if (success) { closeCheckTicketModal(); if(window.innerWidth < 1024) setIsMobileBetSlipOpen(true); }
    };

    const closeCheckTicketModal = () => { setIsCheckTicketModalOpen(false); setCheckInputCode(''); setCheckedTicketData(null); setCheckTicketError(null); };

    const handlePrintBooking = () => {
        const printFrame = document.createElement('iframe');
        printFrame.style.position = 'fixed'; printFrame.style.right = '0'; printFrame.style.bottom = '0'; printFrame.style.width = '0'; printFrame.style.height = '0'; printFrame.style.border = '0';
        document.body.appendChild(printFrame);
        const doc = printFrame.contentWindow?.document;
        if (!doc) return;

        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head><meta charset="utf-8"><style>@page { margin: 0; size: 80mm auto; } body { margin: 0; padding: 5mm; font-family: Arial, sans-serif; text-align: center; color: #000; position: relative; background: #fff; } .watermark { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-45deg); font-size: 26px; color: rgba(255, 0, 0, 0.15); white-space: nowrap; font-weight: 900; pointer-events: none; z-index: 0; text-align: center; line-height: 1.2; } .content { position: relative; z-index: 1; } h2 { margin: 0 0 5px 0; font-size: 16px; font-weight: 900;} .code { font-size: 28px; font-weight: 900; margin: 10px 0; letter-spacing: 2px; } .details { display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 10px; border-bottom: 2px dashed #000; padding-bottom: 8px;} .match { text-align: left; font-size: 11px; margin-bottom: 8px; border-bottom: 1px dotted #888; padding-bottom: 6px; } .match-teams { font-weight: 900; margin-bottom: 2px;} .match-pick { display: flex; justify-content: space-between; margin-top: 2px; }</style></head>
            <body>
                <div class="watermark">NOT FOR PAYOUT<br>BOOKING ONLY</div>
                <div class="content">
                    <h2>VIBE BET - BOOKING</h2>
                    <div class="code">*${bookingCode}*</div>
                    <div class="details"><div>Date: ${new Date().toLocaleDateString()}</div><div style="text-align: right;">Stake: ${stake.toFixed(2)} Br<br>Potential Win: ${grossWin.toFixed(2)} Br</div></div>
                    <div style="text-align: left; margin-bottom: 5px; font-size: 12px; font-weight: 900;">EVENTS PLAYED:</div>
                    ${betSlip.map(item => `<div class="match"><div class="match-teams">${item.home_team} vs ${item.away_team}</div><div class="match-pick"><span>Pick: ${item.odd_name}</span><span style="font-weight: 900;">@${item.odd_value}</span></div></div>`).join('')}
                    <div style="text-align: center; font-size: 10px; margin-top: 15px; font-weight: bold;">This is a booking slip.<br>Please visit a branch to confirm your bet.</div>
                </div>
            </body>
            </html>
        `;
        doc.open(); doc.write(htmlContent); doc.close();
        setTimeout(() => { printFrame.contentWindow?.focus(); printFrame.contentWindow?.print(); setTimeout(() => document.body.removeChild(printFrame), 1000); }, 500);
    };

    const handleAuthSuccess = (userData: any, userToken: string) => {
        setUser(userData); setToken(userToken);
        localStorage.setItem('user', JSON.stringify(userData)); localStorage.setItem('token', userToken);
        setIsAuthModalOpen(false);
    };

    const handleLogout = () => { setUser(null); setToken(null); localStorage.removeItem('user'); localStorage.removeItem('token'); };

    const toggleAccordion = (title: string) => {
        setOpenAccordions(prev => prev.includes(title) ? prev.filter(t => t !== title) : [...prev, title]);
    };

    // 🌟 እጅግ ጥብቅ የሆነው የማርኬት አመዳደብ (Strict Market Mapping API-Football to UI) 🌟
    const getCategorizedMarkets = (game: any) => {
        const raw = game?.raw_markets || [];
        const marketsObj: Record<string, any[]> = {
            "All": [], "Main Market": [], "Total": [], "Combination": [], "Half": [], "Handicap": []
        };

        if (!Array.isArray(raw)) return marketsObj;

        // 🌟 Smart Sorting Logic 🌟
        const sortOutcomes = (oddsArray: any[]) => {
            return oddsArray.sort((a, b) => {
                const matchA = a.option.match(/-?\d+(\.\d+)?/);
                const matchB = b.option.match(/-?\d+(\.\d+)?/);
                const numA = matchA ? parseFloat(matchA[0]) : NaN;
                const numB = matchB ? parseFloat(matchB[0]) : NaN;
                
                if (!isNaN(numA) && !isNaN(numB)) {
                    if (numA !== numB) return numA - numB; // ቁጥሮቹን በቅደም-ተከተል ያሰልፋል (0.5, 1.0, 1.5...)
                    
                    const strA = a.option.toLowerCase();
                    const strB = b.option.toLowerCase();
                    // "Over" ሁልጊዜም ከ "Under" በፊት እንዲመጣ ያደርጋል
                    if (strA.includes('over') && strB.includes('under')) return -1;
                    if (strA.includes('under') && strB.includes('over')) return 1;
                    if (strA.includes('home') && strB.includes('away')) return -1;
                    if (strA.includes('away') && strB.includes('home')) return 1;
                    if (strA.includes('yes') && strB.includes('no')) return -1;
                    if (strA.includes('no') && strB.includes('yes')) return 1;
                }
                
                const sortOrder: Record<string, number> = { '1': 1, 'x': 2, '2': 3, '1x': 4, '12': 5, 'x2': 6 };
                const keyA = a.option.toLowerCase().trim();
                const keyB = b.option.toLowerCase().trim();
                if (sortOrder[keyA] && sortOrder[keyB]) return sortOrder[keyA] - sortOrder[keyB];
                
                return a.option.localeCompare(b.option);
            });
        };

        raw.forEach((market: any) => {
            if (!market || !market.outcomes || market.outcomes.length === 0) return; 
            
            let category = null; 
            let title = market.title || market.name || market.key || "Market";
            const titleLower = title.toLowerCase().trim();
            const mId = market.id;

            // --- 1. MAIN MARKET ---
            if (mId === 1 || titleLower.includes('match winner') || titleLower === '1x2') {
                title = "3 Way"; category = "Main Market";
            }
            else if (mId === 8 || titleLower.includes('both teams score') || titleLower === 'both teams to score') {
                title = "Both teams to score"; category = "Main Market";
            }
            else if (mId === 12 || titleLower.includes('double chance')) {
                title = "Double chance"; category = "Main Market";
            }
            else if (mId === 5 || titleLower === 'goals over/under' || (titleLower.includes('over/under') && !titleLower.includes('half') && !titleLower.includes('corner') && !titleLower.includes('&') && !titleLower.includes('and'))) {
                title = "Over/Under"; category = "Main Market";
            }
            else if (mId === 17 || (titleLower.includes('halftime/fulltime') && !titleLower.includes('&'))) {
                title = "Halftime/Fulltime"; category = "Main Market";
            }
            else if (mId === 24 || (titleLower.includes('odd/even') && !titleLower.includes('half') && !titleLower.includes('corner'))) {
                title = "Odd/even"; category = "Main Market";
            }
            else if (mId === 21 || titleLower.includes('draw no bet')) {
                title = "Draw no bet"; category = "Main Market";
            }
            else if (mId === 40 || titleLower.includes('highest scoring half')) {
                title = "Highest scoring half"; category = "Main Market";
            }
            else if (mId === 10 || (titleLower.includes('correct score') && !titleLower.includes('half'))) {
                title = "Correct score"; category = "Main Market";
            }

            // --- 2. TOTAL MARKET ---
            else if (mId === 6 || titleLower === 'first half winner' || (titleLower.includes('1st half') && titleLower.includes('over/under') && !titleLower.includes('&') && !titleLower.includes('corner'))) {
                title = "1st half - Over/Under"; category = "Total";
            }
            else if (mId === 11 || (titleLower.includes('exact goals') && !titleLower.includes('half') && !titleLower.includes('&'))) {
                title = "Exact goals"; category = "Total";
            }
            else if (titleLower.includes('goal range') || titleLower.includes('goals range')) {
                title = "Goal range"; category = "Total";
            }
            else if (titleLower.includes('corner range') && !titleLower.includes('half') && !titleLower.includes(game.home_team?.toLowerCase())) {
                title = "Corner range"; category = "Total";
            }
            else if (titleLower.includes('over/under corners') || titleLower.includes('corners over/under')) {
                title = "Over/Under corners"; category = "Total";
            }

            // --- 3. COMBINATION MARKET ---
            else if (titleLower.includes('3 way & over/under') || titleLower.includes('match winner and over/under')) {
                title = "3 Way & Over/Under"; category = "Combination";
            }
            else if (titleLower.includes('3 way & both teams to score') || titleLower.includes('match winner and both teams')) {
                title = "3 Way & both teams to score"; category = "Combination";
            }
            else if (titleLower.includes('10 minutes')) {
                title = "10 minutes - 3 Way from 1 to 10"; category = "Combination";
            }
            else if (titleLower.includes('anytime goalscorer')) {
                title = "Anytime goalscorer"; category = "Combination";
            }
            else if (titleLower.includes('corner 1x2') && !titleLower.includes('half')) {
                title = "Corner 1x2"; category = "Combination";
            }
            else if (titleLower.includes('double chance & both teams') || titleLower.includes('double chance and both teams')) {
                title = "Double chance & both teams to score"; category = "Combination";
            }
            else if (titleLower.includes('last corner') && !titleLower.includes('half')) {
                title = "Last corner"; category = "Combination";
            }
            else if (titleLower.includes('last goal') && !titleLower.includes('scorer')) {
                title = "Last goal"; category = "Combination";
            }
            else if (titleLower.includes('last goalscorer')) {
                title = "Last goalscorer"; category = "Combination";
            }
            else if (titleLower.includes('odd/even corners') && !titleLower.includes('half')) {
                title = "Odd/even corners"; category = "Combination";
            }
            else if (titleLower.includes('over/under & both teams') || titleLower.includes('goals over/under and both teams')) {
                title = "Over/Under & both teams to score"; category = "Combination";
            }
            else if (titleLower.includes('which team to score')) {
                title = "Which team to score"; category = "Combination";
            }
            else if (titleLower.includes('corner range') && (titleLower.includes(game.home_team?.toLowerCase()) || titleLower.includes(game.away_team?.toLowerCase()))) {
                title = `${game.home_team} corner range`; category = "Combination";
            }

            // --- 4. HALF MARKET ---
            else if (titleLower.includes('half') || titleLower.includes('ht') || titleLower.includes('1st') || titleLower.includes('2nd') || titleLower.includes('first half') || titleLower.includes('second half') || titleLower.includes('both halves') || titleLower.includes('halftime/fulltime &') || titleLower.includes('to win either half')) {
                category = "Half";
                title = title.replace(/first half/i, '1st Half').replace(/second half/i, '2nd Half').replace(/match winner/i, '3 Way');
            }

            // --- 5. HANDICAP MARKET ---
            else if (titleLower.includes('handicap') || titleLower.includes('asian')) {
                category = "Handicap";
            }

            // 🚫 ካልተመደበ ሙሉ በሙሉ መዝለል 🚫
            if (!category) return;

            let outcomes = market.outcomes.map((o: any, idx: number) => ({
                odd_id: `${market.key || 'unk'}_${(o?.name || '').toString().replace(/[^a-zA-Z0-9]/g, '_')}_${game.id}_${idx}`, 
                option: o?.name || 'Opt', 
                value: parseFloat(o?.price || o?.odd || 0).toFixed(2)
            }));

            // 🌟 1. የተደገሙ አማራጮችን በአንድ Market ውስጥ ማጥራት (Deduplicate options) 🌟
            const uniqueOutcomes: any[] = [];
            const seenOptions = new Set();
            outcomes.forEach((o: any) => {
                const cleanOpt = o.option.trim().toLowerCase();
                if (!seenOptions.has(cleanOpt)) {
                    seenOptions.add(cleanOpt);
                    uniqueOutcomes.push(o);
                }
            });
            outcomes = uniqueOutcomes;

            // 🌟 2. ቁጥሮቹን በቅደም ተከተል ማሰለፍ (Sort arrays logically) 🌟
            outcomes = sortOutcomes(outcomes);

            if (outcomes.length > 0) {
                // 🌟 3. Over/Under ሁልጊዜም 2 Column እንዲሆን ማዘዝ (Force 2-columns for totals) 🌟
                let cols = 2; 
                if (outcomes.length === 3) cols = 3;
                else if (titleLower.includes('correct score') || titleLower.includes('halftime/fulltime')) cols = 3;
                // Over/Under እና Handicap ብዙ ቢሆኑም በ2 አምድ ብቻ እንዲታዩ መገደብ
                else if (outcomes.length >= 6 && !titleLower.includes('over/under') && !titleLower.includes('handicap') && !titleLower.includes('goals')) cols = 3;
                
                if (outcomes.length === 1) cols = 1;
                
                const marketData = { title: title, cols: cols, odds: outcomes };
                
                // 🌟 4. የተደገሙ ማርኬቶችን ማዋሃድ (Merge duplicate market titles like Asian vs Normal Over/Under) 🌟
                const mergeIntoCategory = (catArray: any[]) => {
                    const existingIdx = catArray.findIndex(m => m.title === title);
                    if (existingIdx === -1) {
                        catArray.push(JSON.parse(JSON.stringify(marketData)));
                    } else {
                        const existingMarket = catArray[existingIdx];
                        const existingOpts = new Set(existingMarket.odds.map((o:any) => o.option.trim().toLowerCase()));
                        outcomes.forEach(o => {
                            if (!existingOpts.has(o.option.trim().toLowerCase())) {
                                existingMarket.odds.push({...o});
                                existingOpts.add(o.option.trim().toLowerCase());
                            }
                        });
                        // ከተዋሃደ በኋላ ድጋሚ በቅደም ተከተል ማሰለፍ
                        existingMarket.odds = sortOutcomes(existingMarket.odds);
                    }
                };

                mergeIntoCategory(marketsObj[category]);
                mergeIntoCategory(marketsObj["All"]);
            }
        });

        const finalObj: Record<string, any[]> = {};
        Object.keys(marketsObj).forEach(key => {
            if (marketsObj[key].length > 0) finalObj[key] = marketsObj[key];
        });

        return finalObj;
    };

    const getLeagueDetails = (key: string, flagFromApi?: string) => {
        if (!key || typeof key !== 'string') return { country: 'World', flag: 'https://media.api-sports.io/flags/un.svg', name: 'Soccer', isTop: false };

        const topLeaguesExactMatches = [
            'England|Premier League', 'England|Championship',
            'Spain|La Liga', 'Spain|Primera Division',
            'Italy|Serie A', 'Germany|Bundesliga', 
            'France|Ligue 1', 'World|UEFA Champions League', 
            'World|UEFA Europa League', 'Netherlands|Eredivisie',
            'Portugal|Primeira Liga', 'Saudi Arabia|Pro League', 'Ethiopia|Premier League'
        ];

        if (key.includes('|')) {
            const parts = key.split('|');
            const countryName = parts[0] || 'World';
            const leagueName = parts[1] || 'League';
            const flagUrl = parts[2] || flagFromApi || 'https://media.api-sports.io/flags/un.svg';
            
            const exactKey = `${countryName}|${leagueName}`;
            const isTopLeague = topLeaguesExactMatches.includes(exactKey) || topLeaguesExactMatches.some(t => exactKey.toLowerCase().includes(t.toLowerCase()));

            return { country: countryName, flag: flagUrl, name: leagueName, isTop: isTopLeague };
        }

        return { country: 'World', flag: 'https://media.api-sports.io/flags/un.svg', name: key.replace('soccer_', '').replace(/_/g, ' '), isTop: false };
    };

    const renderFlag = (flagObj: string) => {
        if (!flagObj) return <img src="https://media.api-sports.io/flags/un.svg" alt="flag" className="w-full h-full object-cover" />;
        return <img src={flagObj} alt="flag" onError={(e: any) => e.target.src='https://media.api-sports.io/flags/un.svg'} className="w-full h-full object-cover" />;
    };

    if (!isMounted) return <div className="min-h-screen bg-[#1c2024]"></div>;

    const currentTime = new Date().getTime();
    const activeFixtures = fixtures.filter(g => g && g.match_time && new Date(g.match_time).getTime() > currentTime);

    const groupedFixtures = activeFixtures.reduce((acc: any, game: any) => {
        const details = getLeagueDetails(game.league, game.league_flag);
        const uniqueKey = game.league || 'unknown';
        if (!acc[uniqueKey]) acc[uniqueKey] = { details, games: [] };
        acc[uniqueKey].games.push(game);
        return acc;
    }, {});

    const allLeagues: [string, any][] = Object.entries(groupedFixtures);
    const topLeagues = allLeagues.filter(([_, data]) => data.details.isTop);
    
    const countriesMap = new Map<string, { flag: string, leagues: {key: string, name: string, count: number}[] }>();
    allLeagues.forEach(([key, data]) => {
        const country = data.details.country;
        if (!countriesMap.has(country)) countriesMap.set(country, { flag: data.details.flag, leagues: [] });
        countriesMap.get(country)!.leagues.push({ key: key, name: data.details.name, count: data.games.length });
    });
    const sortedCountries = Array.from(countriesMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));

    let displayLeagues = allLeagues;
    if (selectedLeague === 'Upcoming') {
        const sortedUpcoming = [...activeFixtures].sort((a, b) => new Date(a.match_time).getTime() - new Date(b.match_time).getTime());
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
        displayLeagues = groupedArray;
    } else if (selectedLeague === 'Top Matches') {
        displayLeagues = topLeagues;
    } else if (selectedLeague !== 'All') {
        displayLeagues = allLeagues.filter(([key, _]) => key === selectedLeague);
    }

    return (
        <div className="min-h-screen bg-[#1c2024] text-slate-300 font-sans text-sm relative">
            <header className="bg-[#ffcc00] border-b border-[#e6b800] sticky top-0 z-30 h-[60px] flex items-center justify-between px-4 shadow-md">
                <button onClick={() => window.location.reload()} className="flex items-center gap-3 cursor-pointer hover:opacity-90 transition text-left">
                    <div className="w-11 h-11 shrink-0 rounded-[10px] overflow-hidden shadow-lg border border-[#3b4148]/50 bg-[#1c2024] p-1 flex items-center justify-center">
                        <img src="/icon.svg" alt="Vibe Bet" className="w-full h-full object-contain" />
                    </div>
                    <div className="hidden sm:flex flex-col justify-center">
                        <h1 className="text-[22px] font-black text-black leading-none tracking-tight italic mb-1">VIBE BET</h1>
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
                    {user && (
                        <div className="flex items-center gap-3 bg-black/10 border border-black/20 px-3 py-1.5 rounded-full">
                            <span className="hidden sm:inline text-xs font-bold text-black">{user.username}</span>
                            <span className="text-xs font-black text-black sm:border-l border-black/30 sm:pl-2">{(user.current_balance || 0).toFixed(2)} Br</span>
                            <button onClick={handleLogout} className="text-xs font-bold text-black hover:underline ml-2">Logout</button>
                        </div>
                    )}
                </div>
            </header>

            <div className="lg:hidden fixed bottom-0 left-0 right-0 h-[60px] bg-[#1e2328] border-t border-[#3b4148] flex justify-around items-center z-40 shadow-[0_-4px_10px_rgba(0,0,0,0.5)]">
                <button onClick={() => setIsMobileMenuOpen(true)} className="flex flex-col items-center gap-1 text-slate-400 hover:text-[#ffcc00]"><span className="text-xl">☰</span><span className="text-[10px] font-bold uppercase">Menu</span></button>
                <button onClick={() => setIsCheckTicketModalOpen(true)} className="flex flex-col items-center gap-1 text-slate-400 hover:text-[#ffcc00]"><span className="text-xl">🔍</span><span className="text-[10px] font-bold uppercase">Check</span></button>
                <button onClick={() => {setIsMobileMenuOpen(false); setIsMobileBetSlipOpen(false); setSelectedMatch(null);}} className="flex flex-col items-center gap-1 text-[#ffcc00]"><span className="text-xl">🏠</span><span className="text-[10px] font-bold uppercase">Home</span></button>
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
                        <button onClick={() => {setSelectedLeague('Top Matches'); setSelectedMatch(null); if(window.innerWidth < 1280) setIsMobileMenuOpen(false);}} className={`flex-1 border text-[11px] font-bold py-2 rounded transition-colors flex items-center justify-center gap-1.5 ${selectedLeague === 'Top Matches' ? 'bg-[#ffcc00] border-[#ffcc00] text-black' : 'bg-[#2a3038] hover:bg-[#3b4148] border-[#3b4148] text-white'}`}>
                            <span className={selectedLeague === 'Top Matches' ? 'text-black' : 'text-[#ffcc00]'}>🏆</span> Top
                        </button>
                        <button onClick={() => {setSelectedLeague('Upcoming'); setSelectedMatch(null); if(window.innerWidth < 1280) setIsMobileMenuOpen(false);}} className={`flex-1 border text-[11px] font-bold py-2 rounded transition-colors flex items-center justify-center gap-1.5 ${selectedLeague === 'Upcoming' ? 'bg-[#ffcc00] border-[#ffcc00] text-black' : 'bg-[#2a3038] hover:bg-[#3b4148] border-[#3b4148] text-white'}`}>
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
                                    {topLeagues.map(([key, data]) => (
                                        <li key={key}>
                                            <button onClick={() => {setSelectedLeague(key); setSelectedMatch(null); if(window.innerWidth < 1280) setIsMobileMenuOpen(false);}} className={`w-full flex items-center justify-between px-3 py-1.5 transition-colors ${selectedLeague === key ? 'bg-[#2a3038] border-l-2 border-[#ffcc00] text-white' : 'border-l-2 border-transparent hover:bg-[#2a3038] hover:text-white'}`}>
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
                                {sortedCountries.map(([countryName, countryData]) => {
                                    const isCountryOpen = openCountry === countryName;
                                    const totalGames = countryData.leagues.reduce((sum, l) => sum + l.count, 0);
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
                                                    {countryData.leagues.map((league) => (
                                                        <li key={league.key}>
                                                            <button onClick={() => {setSelectedLeague(league.key); setSelectedMatch(null); if(window.innerWidth < 1280) setIsMobileMenuOpen(false);}} className={`w-full flex items-center justify-between pl-12 pr-4 py-2 transition-colors ${selectedLeague === league.key ? 'text-[#ffcc00] font-bold' : 'text-slate-400 hover:text-white hover:bg-[#24292e]'}`}>
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
                        // 🌟 አዲሱ Dedicated Market Page 🌟
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

                                const displayMarkets = marketTab === 'All' ? allCats['All'] : (allCats[marketTab] || []);

                                return (
                                    <>
                                        {/* 🌟 ታቦቹ: Vibe Bet Yellow & Dark Gray 🌟 */}
                                        <div className="flex overflow-x-auto gap-3 p-3 bg-[#24292e] border-b border-[#3b4148] custom-scrollbar shrink-0">
                                            {availableTabs.map(tab => (
                                                <button 
                                                    key={tab} 
                                                    onClick={() => setMarketTab(tab)} 
                                                    className={`px-5 py-2 rounded-full text-[13px] font-black whitespace-nowrap transition-colors ${marketTab === tab ? 'bg-[#ffcc00] text-black shadow' : 'bg-[#2a3038] text-slate-300 hover:text-white hover:bg-[#3b4148]'}`}
                                                >
                                                    {tab}
                                                </button>
                                            ))}
                                        </div>

                                        <div className="flex-1 overflow-y-auto p-2 sm:p-4 bg-[#2a3038] custom-scrollbar">
                                            {/* 🌟 የማርኬት ዝርዝር ዲዛይን (Stacked Accordions with Star Icon) 🌟 */}
                                            <div className="max-w-5xl mx-auto w-full bg-[#485058] border border-[#3a4148] rounded-md overflow-hidden shadow-md">
                                                {displayMarkets.map((market: any, mIdx: number) => {
                                                    const isOpen = openAccordions.includes(market.title);
                                                    return (
                                                        <div key={`${marketTab}-${mIdx}`} className="border-b border-[#3a4148] last:border-b-0 w-full">
                                                            <button onClick={() => toggleAccordion(market.title)} className="w-full flex items-center justify-between p-3.5 hover:bg-[#525b65] transition-colors">
                                                                <div className="flex items-center gap-3">
                                                                    {/* ባዶ የኮከብ ምልክት (Star Icon) */}
                                                                    <svg className="w-4 h-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"></path></svg>
                                                                    <span className="text-[13px] font-bold text-white tracking-wide text-left">{market.title}</span>
                                                                </div>
                                                                <svg className={`w-4 h-4 text-slate-300 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                                                            </button>
                                                            
                                                            {isOpen && (
                                                                <div className="p-3 bg-[#1e2328] border-t border-[#3a4148]">
                                                                    <div className={`grid gap-2 ${market.cols === 4 ? 'grid-cols-2 md:grid-cols-4' : market.cols === 3 ? 'grid-cols-1 md:grid-cols-3' : market.cols === 1 ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'}`}>
                                                                        {market.odds.map((odd: any) => {
                                                                            const isSelected = betSlip.some((item: any) => item.odd_id === odd.odd_id);
                                                                            return (
                                                                                <button key={odd.odd_id} onClick={() => handleMarketSelection(selectedMatch, odd)} className={`flex justify-between items-center px-3 py-2.5 rounded-sm transition-colors border ${isSelected ? 'bg-[#ffcc00] border-[#ffcc00] text-black shadow' : 'bg-[#1a1f24] border-[#3b4148] hover:border-[#ffcc00]'}`}>
                                                                                    <span className={`text-[11px] ${isSelected ? 'text-black font-bold' : 'text-slate-300'}`}>{odd.option}</span>
                                                                                    <span className={`text-[12px] font-black ${isSelected ? 'text-black' : 'text-[#ffcc00]'}`}>{odd.value}</span>
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
                        // 🌟 Normal Fixtures View (ዋናው ገፅ) 🌟
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
                                                {sortedCountries.map(([cName, cData]) => (
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
                                            <button onClick={() => { if(dateInputRef.current) { try { dateInputRef.current.showPicker(); } catch(e) { dateInputRef.current.focus(); } } }} className={`w-8 h-8 rounded-full text-xs sm:text-sm transition-colors relative z-0 flex items-center justify-center ${!['All', todayStr, tomorrowStr, dayAfterTmwStr].includes(selectedDateFilter) && selectedDateFilter !== 'All' ? 'bg-[#ffcc00] text-black shadow' : 'text-slate-400 hover:text-white'}`}>📅</button>
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
                                        {displayLeagues.filter(([key, data]) => {
                                                return (selectedCountryFilter !== 'All Countries' && selectedLeague !== 'Upcoming') ? data.details.country === selectedCountryFilter : true;
                                            }).map(([key, data]) => {
                                                let gamesToRender = data.games;
                                                if (selectedLeague === 'Upcoming' && selectedCountryFilter !== 'All Countries') gamesToRender = gamesToRender.filter((g: any) => getLeagueDetails(g.league).country === selectedCountryFilter);

                                                const filteredGames = gamesToRender.filter((g: any) => {
                                                    const matchesSearch = (g.home_team || '').toLowerCase().includes(searchTerm.toLowerCase()) || (g.away_team || '').toLowerCase().includes(searchTerm.toLowerCase());
                                                    const matchesDate = selectedDateFilter === 'All' || new Date(g.match_time).toDateString() === selectedDateFilter;
                                                    return matchesSearch && matchesDate;
                                                }).sort((a: any, b: any) => new Date(a.match_time).getTime() - new Date(b.match_time).getTime());

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
                                                            const categorizedMarkets = getCategorizedMarkets(game);
                                                            const mainMarkets = categorizedMarkets["Main Market"] || [];
                                                            
                                                            const market1X2 = mainMarkets.find((m:any) => {
                                                                const t = (m?.title || '').toLowerCase();
                                                                return t.includes("winner") || t.includes("h2h") || t.includes("result") || t.includes("match betting") || t.includes("3 way");
                                                            })?.odds || [];
                                                            
                                                            const marketDC = mainMarkets.find((m:any) => {
                                                                const t = (m?.title || '').toLowerCase();
                                                                return t.includes("double chance");
                                                            })?.odds || [];
                                                            
                                                            const currentDisplayOdds = mainMarketView === '1X2' ? market1X2 : marketDC;

                                                            const btn1 = currentDisplayOdds[0] || { odd_id: `1_null_${game.id}`, option: "1", value: "0.00" };
                                                            const btnX = currentDisplayOdds[1] || { odd_id: `x_null_${game.id}`, option: "X", value: "0.00" };
                                                            const btn2 = currentDisplayOdds[2] || { odd_id: `2_null_${game.id}`, option: "2", value: "0.00" };
                                                            const hasSelectionInGame = betSlip.some((item: any) => item.fixture_id === game.id);

                                                            const totalMarketsCount = categorizedMarkets["All"] ? categorizedMarkets["All"].length : 0;

                                                            return (
                                                                <div key={game.id} className="flex flex-col border-b border-[#2a3038] last:border-b-0 hover:bg-[#24292e] transition-colors">
                                                                    <div className="flex items-stretch min-h-[54px] py-0.5">
                                                                        <div className="w-12 sm:w-16 flex flex-col justify-center items-center text-[9px] sm:text-[10px] border-r border-[#2a3038] text-slate-400 font-medium shrink-0 bg-[#1a1f24]/50">
                                                                            <span>{matchDate.getDate()}/{matchDate.getMonth()+1}</span>
                                                                            <span className="text-[#ffcc00] font-bold">{matchDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                                                        </div>

                                                                        <div className="flex-1 flex items-center gap-0.5 sm:gap-1 p-1 sm:p-1.5 min-w-0">
                                                                            <button onClick={() => toggleSelection(game, btn1)} className={`flex-1 h-full min-h-[44px] flex justify-between items-center px-1.5 sm:px-3 rounded transition-colors border ${betSlip.some(item => item.odd_id === btn1.odd_id) ? 'bg-[#ffcc00] border-[#ffcc00] text-black shadow-md' : 'bg-[#1e2328] border-[#3b4148] hover:border-[#ffcc00] shadow-sm'} ${btn1.value === "0.00" ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                                                                <span className={`text-[9.5px] sm:text-[11px] font-semibold truncate max-w-[50px] sm:max-w-[90px] ${betSlip.some(item => item.odd_id === btn1.odd_id) ? 'text-black' : 'text-slate-300'}`}>{mainMarketView === '1X2' ? game.home_team : '1X'}</span>
                                                                                <span className={`font-black text-[11px] sm:text-[12px] ${betSlip.some(item => item.odd_id === btn1.odd_id) ? 'text-black' : 'text-[#ffcc00]'}`}>{btn1?.value !== "0.00" ? btn1?.value : "-"}</span>
                                                                            </button>
                                                                            <button onClick={() => toggleSelection(game, btnX)} className={`w-10 sm:w-16 shrink-0 h-full min-h-[44px] flex flex-col sm:flex-row justify-center sm:justify-between items-center px-1 sm:px-2 rounded transition-colors border ${betSlip.some(item => item.odd_id === btnX.odd_id) ? 'bg-[#ffcc00] border-[#ffcc00] text-black shadow-md' : 'bg-[#1e2328] border-[#3b4148] hover:border-[#ffcc00] shadow-sm'} ${btnX.value === "0.00" ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                                                                {mainMarketView === 'DC' && <span className={`text-[9.5px] sm:text-[11px] font-semibold mb-0.5 sm:mb-0 ${betSlip.some(item => item.odd_id === btnX.odd_id) ? 'text-black' : 'text-slate-300'}`}>12</span>}
                                                                                <span className={`font-black text-[11px] sm:text-[12px] ${betSlip.some(item => item.odd_id === btnX.odd_id) ? 'text-black' : 'text-slate-300'}`}>{btnX?.value !== "0.00" ? btnX?.value : "-"}</span>
                                                                            </button>
                                                                            <button onClick={() => toggleSelection(game, btn2)} className={`flex-1 h-full min-h-[44px] flex justify-between items-center px-1.5 sm:px-3 rounded transition-colors border ${betSlip.some(item => item.odd_id === btn2.odd_id) ? 'bg-[#ffcc00] border-[#ffcc00] text-black shadow-md' : 'bg-[#1e2328] border-[#3b4148] hover:border-[#ffcc00] shadow-sm'} ${btn2.value === "0.00" ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                                                                <span className={`font-black text-[11px] sm:text-[12px] ${betSlip.some(item => item.odd_id === btn2.odd_id) ? 'text-black' : 'text-[#ffcc00]'}`}>{btn2?.value !== "0.00" ? btn2?.value : "-"}</span>
                                                                                <span className={`text-[9.5px] sm:text-[11px] font-semibold truncate max-w-[50px] sm:max-w-[90px] ${betSlip.some(item => item.odd_id === btn2.odd_id) ? 'text-black' : 'text-slate-300'}`}>{mainMarketView === '1X2' ? game.away_team : 'X2'}</span>
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
                                {betSlip.map((item, idx) => (
                                    <div key={idx} className="bg-[#1e2328] border border-[#2a3038] rounded-md p-3 relative group hover:border-[#3b4148] transition-colors shadow-sm">
                                        <button onClick={() => toggleSelection({id: item.fixture_id}, {odd_id: item.odd_id})} className="absolute top-2 right-2 text-slate-500 hover:text-red-500 text-lg leading-none transition-colors">✕</button>
                                        <div className="flex justify-between items-center mb-1.5 pr-4"><span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider truncate mr-2">{item.league_name}</span><span className="text-[10px] text-[#ffcc00] font-black shrink-0">{new Date(item.match_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span></div>
                                        <div className="pr-5 mb-2"><p className="text-[11px] font-bold text-white leading-snug">{item.home_team} <span className="text-slate-500 font-normal px-1">vs</span> {item.away_team}</p></div>
                                        <div className="flex justify-between items-center bg-[#1a1f24] p-1.5 rounded border border-[#2a3038]"><span className="text-[11px] text-[#ffcc00] font-bold">{item.odd_name}</span><span className="text-[13px] font-black text-white">{item.odd_value}</span></div>
                                    </div>
                                ))}
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
                                <span className="text-[10px] font-bold text-slate-400 pl-3 uppercase">Stake</span><input type="number" value={stake} onChange={(e) => setStake(Number(e.target.value))} className="flex-1 h-full bg-transparent text-white text-sm font-bold outline-none text-right pr-3" />
                            </div>
                            
                            <div className="h-[18px] mb-2 flex items-center justify-center">{limitWarning && <p className="text-[10px] text-red-500 font-bold leading-tight text-center">{limitWarning}</p>}</div>
                            <div className="flex gap-2 h-[44px]">
                                <button onClick={() => {setBetSlip([]); setBookingCode(null)}} className="bg-[#24292e] border border-[#3b4148] text-slate-400 hover:text-red-400 hover:border-red-400 text-sm font-bold w-12 rounded flex items-center justify-center transition-colors">🗑</button>
                                <button onClick={handlePlaceBet} disabled={isLoading || !!limitWarning} className="flex-1 bg-[#ffcc00] hover:bg-[#e6b800] text-black font-black text-sm rounded flex items-center justify-center transition-transform active:scale-[0.98] disabled:opacity-50 disabled:bg-slate-600 disabled:text-slate-400 disabled:cursor-not-allowed shadow-md">
                                    {isLoading ? '...' : 'Place Bet'}
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
                                    onChange={(e) => setCheckInputCode(e.target.value.trim().toUpperCase())}
                                    placeholder="የትኬት ቁጥር ወይም Booking Code..." 
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
                                                <div><p className="text-slate-500 text-[10px] mb-1">Date</p><p className="text-white font-bold">{new Date(checkedTicketData.created_at).toLocaleDateString([], {day:'2-digit', month:'2-digit'})}</p></div>
                                                <div><p className="text-slate-500 text-[10px] mb-1">Type</p><p className="text-white font-bold">Prematch</p></div>
                                                <div><p className="text-slate-500 text-[10px] mb-1">Amount</p><p className="text-white font-bold">{checkedTicketData.stake_amount}</p></div>
                                                <div><p className="text-slate-500 text-[10px] mb-1">Win</p><p className="text-[#00e700] font-bold">{checkedTicketData.potential_win}</p></div>
                                            </div>

                                            <div className="flex gap-2 mb-4">
                                                <button onClick={() => {
                                                    navigator.clipboard.writeText(`${window.location.origin}?booking=${checkedTicketData.booking_code || checkedTicketData.ticket_number}`);
                                                    alert("Link Copied!");
                                                }} className="flex-1 bg-[#24292e] hover:bg-[#2a3038] text-slate-300 font-bold text-xs py-2.5 rounded transition-colors flex items-center justify-center gap-2 border border-[#3b4148]">
                                                    🔗 SHARE BET
                                                </button>
                                                <button onClick={handleBetAgain} className="flex-1 bg-[#24292e] hover:bg-[#3b4148] text-[#ffcc00] font-bold text-xs py-2.5 rounded transition-colors flex items-center justify-center gap-2 border border-[#ffcc00]/30">
                                                    🔄 BET AGAIN
                                                </button>
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
                                                    const icon = isWon ? '✅' : isLost ? '❌' : '⏳';
                                                    
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

            {/* 🌟 አዲሱ የቡኪንግ ሞዳል (Booking Modal) 🌟 */}
            {bookingCode && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in p-4 overflow-y-auto">
                    <div className="bg-[#dfdfdf] w-full max-w-4xl shadow-2xl relative my-auto flex flex-col animate-fade-in-down rounded-sm overflow-hidden">
                        
                        <div className="w-full bg-[#dfdfdf] p-4 pb-2 relative">
                            <button onClick={() => setBookingCode(null)} className="absolute top-2 right-3 text-gray-500 hover:text-black text-xl leading-none">✕</button>
                            
                            <div className="flex flex-col md:flex-row justify-between items-center md:items-end gap-4 mb-2">
                                <div className="text-center md:text-left">
                                    <p className="text-gray-700 italic text-xs mb-0.5">Your bet has been booked</p>
                                    <div className="flex items-center justify-center md:justify-start gap-1">
                                        <p className="text-2xl font-medium text-black tracking-wider">*{bookingCode}*</p>
                                        <button onClick={() => { navigator.clipboard.writeText(bookingCode); alert("Copied!"); }} className="text-gray-700 hover:text-black transition">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 16 16"><path d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1v-1z"/><path d="M9.5 1h-3a.5.5 0 0 0-.5.5v1a.5.5 0 0 0 .5.5h3a.5.5 0 0 0 .5-.5v-1a.5.5 0 0 0-.5-.5zm-3-1A1.5 1.5 0 0 0 5 1.5v1A1.5 1.5 0 0 0 6.5 4h3A1.5 1.5 0 0 0 11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3z"/></svg>
                                        </button>
                                    </div>
                                </div>

                                <div className="flex gap-6 text-center text-xs">
                                    <div>
                                        <p className="text-[#1c2024] font-bold mb-0.5 uppercase tracking-wide">BETING DATE</p>
                                        <p className="text-gray-700 font-medium text-[13px]">{new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}</p>
                                    </div>
                                    <div>
                                        <p className="text-[#1c2024] font-bold mb-0.5 uppercase tracking-wide">TOTAL STAKE</p>
                                        <p className="text-gray-700 font-medium text-[13px]">{stake.toFixed(2)}</p>
                                    </div>
                                    <div>
                                        <p className="text-[#1c2024] font-bold mb-0.5 uppercase tracking-wide">WIN AMOUNT</p>
                                        <p className="text-gray-700 font-medium text-[13px]">{grossWin.toFixed(2)}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="w-full px-3 md:px-5">
                            <div className="w-full border border-gray-300 bg-white">
                                <div className="grid grid-cols-12 bg-[#1c2024] text-white text-[10px] font-bold text-center border-b border-gray-300">
                                    <div className="col-span-3 py-1.5 border-r border-[#3b4148]">Event Date</div>
                                    <div className="col-span-3 py-1.5 border-r border-[#3b4148]">Tournament</div>
                                    <div className="col-span-3 py-1.5 border-r border-[#3b4148]">Event</div>
                                    <div className="col-span-2 py-1.5 border-r border-[#3b4148]">Market</div>
                                    <div className="col-span-1 py-1.5 text-[#ffcc00]">Odd</div>
                                </div>

                                <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
                                    {betSlip.map((item, idx) => {
                                        const matchDate = new Date(item.match_time);
                                        const dateStr = `${matchDate.getFullYear()}-${String(matchDate.getMonth()+1).padStart(2,'0')}-${String(matchDate.getDate()).padStart(2,'0')}T${String(matchDate.getHours()).padStart(2,'0')}:${String(matchDate.getMinutes()).padStart(2,'0')}:00`;
                                        
                                        let marketText = item.odd_name;
                                        if (['1', 'X', '2'].includes(item.odd_name)) {
                                            marketText = `Match Result: ${item.odd_name === '1' ? 'W1' : item.odd_name === '2' ? 'W2' : 'Draw'}`;
                                        } else if (['1X', '12', 'X2'].includes(item.odd_name)) {
                                            marketText = `Double Chance: ${item.odd_name}`;
                                        }

                                        return (
                                            <div key={idx} className="grid grid-cols-12 text-center text-[11px] text-gray-800 border-b border-gray-200 hover:bg-gray-50 transition-colors">
                                                <div className="col-span-3 py-1.5 px-1.5 border-r border-gray-200 truncate">{dateStr}</div>
                                                <div className="col-span-3 py-1.5 px-1.5 border-r border-gray-200 truncate" title={item.league_name}>{item.league_name}</div>
                                                <div className="col-span-3 py-1.5 px-1.5 border-r border-gray-200 truncate" title={`${item.home_team} - ${item.away_team}`}>{item.home_team} - {item.away_team}</div>
                                                <div className="col-span-2 py-1.5 px-1.5 border-r border-gray-200 truncate">{marketText}</div>
                                                <div className="col-span-1 py-1.5 px-1.5 font-medium">{(item.odd_value || 0).toFixed(2)}</div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        <div className="w-full bg-[#dfdfdf] flex p-3 md:px-5 md:py-3 gap-3 mt-1">
                            <button onClick={() => setBookingCode(null)} className="bg-[#d2d2d2] hover:bg-[#c2c2c2] text-black text-[11px] font-bold px-4 py-2 transition shadow-sm border border-gray-300">
                                REPEAT BET
                            </button>
                            <button onClick={handlePrintBooking} className="bg-[#d2d2d2] hover:bg-[#c2c2c2] text-black text-[11px] font-bold px-4 py-2 transition shadow-sm border border-gray-300 flex items-center justify-center gap-1.5">
                                PRINT 🖨️
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} initialMode={authMode} onSuccess={handleAuthSuccess} />

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
