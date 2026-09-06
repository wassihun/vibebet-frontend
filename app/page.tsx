"use client";

import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import AuthModal from './components/AuthModal';

const MAX_STAKE = 10000;
const MAX_WIN = 10000;
const MIN_STAKE = 20; 

export default function Home() {
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
    
    const [expandedMatchId, setExpandedMatchId] = useState<number | string | null>(null);
    
    const [selectedLeague, setSelectedLeague] = useState<string>('All');
    
    const [isTopLeaguesOpen, setIsTopLeaguesOpen] = useState(true);
    const [isSoccerOpen, setIsSoccerOpen] = useState(true);
    const [openCountry, setOpenCountry] = useState<string | null>('England');

    const [openAccordions, setOpenAccordions] = useState<string[]>(['1X2 (Match Winner)', 'Double Chance', 'Total Goals: Over/Under 2.5']);

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
                            const h2h = rawMarkets.find((m: any) => m.key === 'h2h');
                            
                            const odd1 = h2h?.outcomes?.find((o: any) => o.name === game.home_team)?.price || 2.10;
                            const oddX = h2h?.outcomes?.find((o: any) => o.name === 'Draw')?.price || 3.10;
                            const odd2 = h2h?.outcomes?.find((o: any) => o.name === game.away_team)?.price || 2.80;

                            parsedOdds = [
                                { odd_id: `1_${game.id}`, option: "1", value: odd1.toFixed(2) },
                                { odd_id: `x_${game.id}`, option: "X", value: oddX.toFixed(2) },
                                { odd_id: `2_${game.id}`, option: "2", value: odd2.toFixed(2) }
                            ];
                        } catch (e) {
                            parsedOdds = [
                                { odd_id: `1_${game.id}`, option: "1", value: "2.10" },
                                { odd_id: `x_${game.id}`, option: "X", value: "3.10" },
                                { odd_id: `2_${game.id}`, option: "2", value: "2.80" }
                            ];
                        }

                        return {
                            id: game.id,
                            home_team: game.home_team,
                            away_team: game.away_team,
                            match_time: game.commence_time,
                            league: game.sport_key,
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
        setBookingCode(null);
        setErrorMessage(null);
        setBetSlip(prev => {
            const exists = prev.find(item => item.fixture_id === game.id);
            if (exists && exists.odd_id === odd.odd_id) {
                return prev.filter(item => item.fixture_id !== game.id);
            }
            const newItem = {
                fixture_id: game.id,
                home_team: game.home_team,
                away_team: game.away_team,
                match_time: game.match_time, 
                league_name: getLeagueDetails(game.league).name,
                odd_id: odd.odd_id,
                odd_name: odd.option,
                odd_value: parseFloat(odd.value)
            };
            const filtered = prev.filter(item => item.fixture_id !== game.id);
            return [...filtered, newItem];
        });
    };

    const totalOdds = betSlip.reduce((total, item) => total * item.odd_value, 1).toFixed(2);
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
                stake_amount: stake,
                is_guest: !user,
                selections: betSlip.map(item => ({ fixture_id: item.fixture_id, odd_id: item.odd_id, odd_value: item.odd_value, match_info: `${item.home_team} vs ${item.away_team}`, odd_name: item.odd_name }))
            };
            const headers = user ? { Authorization: `Bearer ${token}` } : {};
            const response = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/api/tickets/place`, payload, { headers });
            
            if (response.data.success) {
                if (!user) {
                    setBookingCode(response.data.data.booking_code);
                } else {
                    alert(`ትኬትዎ በተሳካ ሁኔታ ተቆርጧል!`);
                    setUser({ ...user, current_balance: (user.current_balance || 0) - stake });
                    setBetSlip([]); 
                }
                setPlacedBetSignatures(prev => [...prev, currentBetSignature]);
                if(window.innerWidth < 1024 && user) setIsMobileBetSlipOpen(false); 
            }
        } catch (error: any) {
            setErrorMessage("ስህተት ተፈጥሯል");
        } finally {
            setIsLoading(false);
        }
    };

    const loadTicketByCode = async (code: string) => {
        if (!code.trim()) return;
        setIsLoading(true);
        try {
            const response = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/api/tickets/load/${code}`);
            if (response.data.success && response.data.data.selections) {
                const loadedSelections = response.data.data.selections.map((s: any) => ({
                    fixture_id: s.fixture_id,
                    home_team: s.match_info ? s.match_info.split(' vs ')[0] : 'Home',
                    away_team: s.match_info ? s.match_info.split(' vs ')[1] : 'Away',
                    odd_id: s.odd_id,
                    odd_name: s.odd_name,
                    odd_value: parseFloat(s.odd_value),
                    match_time: new Date().toISOString(), 
                    league_name: 'Loaded Match'
                }));
                setBetSlip(loadedSelections);
                setBookingCode(null);
                return true;
            } else {
                alert("ትኬቱ አልተገኘም! እባክዎ ትክክለኛ Booking Code ያስገቡ።");
                return false;
            }
        } catch (err) {
            alert("ትኬት ማምጣት አልተቻለም!");
            return false;
        } finally {
            setIsLoading(false);
        }
    };

    const handleLoadTicket = async () => {
        const success = await loadTicketByCode(ticketCodeInput);
        if (success) setTicketCodeInput('');
    };

    const handleCheckCustomerTicket = async (e: React.FormEvent) => {
        e.preventDefault();
        const cleanCode = checkInputCode.trim().toUpperCase();
        if (!cleanCode) return;
        
        setIsCheckingTicket(true); 
        setCheckTicketError(null); 
        setCheckedTicketData(null);
        
        try {
            const response = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/api/tickets/check/${cleanCode}`);
            if (response.data.success) {
                setCheckedTicketData(response.data.data);
            }
        } catch (err: any) {
            setCheckTicketError(err.response?.data?.message || 'ይህ ትኬት ወይም ቡኪንግ ኮድ አልተገኘም!');
        } finally {
            setIsCheckingTicket(false);
        }
    };

    const handleBetAgain = async () => {
        if (!checkedTicketData) return;
        const codeToLoad = checkedTicketData.booking_code || checkedTicketData.ticket_number;
        const success = await loadTicketByCode(codeToLoad);
        if (success) {
            closeCheckTicketModal();
            if(window.innerWidth < 1024) setIsMobileBetSlipOpen(true);
        }
    };

    const closeCheckTicketModal = () => {
        setIsCheckTicketModalOpen(false);
        setCheckInputCode('');
        setCheckedTicketData(null);
        setCheckTicketError(null);
    };

    const handlePrintBooking = () => {
        const printFrame = document.createElement('iframe');
        printFrame.style.position = 'fixed';
        printFrame.style.right = '0';
        printFrame.style.bottom = '0';
        printFrame.style.width = '0';
        printFrame.style.height = '0';
        printFrame.style.border = '0';
        document.body.appendChild(printFrame);

        const doc = printFrame.contentWindow?.document;
        if (!doc) return;

        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <style>
                    @page { margin: 0; size: 80mm auto; }
                    body {
                        margin: 0; padding: 5mm;
                        font-family: Arial, sans-serif;
                        text-align: center; color: #000;
                        position: relative;
                        background: #fff;
                    }
                    .watermark {
                        position: absolute; top: 50%; left: 50%;
                        transform: translate(-50%, -50%) rotate(-45deg);
                        font-size: 26px; color: rgba(255, 0, 0, 0.15);
                        white-space: nowrap; font-weight: 900;
                        pointer-events: none; z-index: 0; text-align: center;
                        line-height: 1.2;
                    }
                    .content { position: relative; z-index: 1; }
                    h2 { margin: 0 0 5px 0; font-size: 16px; font-weight: 900;}
                    .code { font-size: 28px; font-weight: 900; margin: 10px 0; letter-spacing: 2px; }
                    .details { display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 10px; border-bottom: 2px dashed #000; padding-bottom: 8px;}
                    .match { text-align: left; font-size: 11px; margin-bottom: 8px; border-bottom: 1px dotted #888; padding-bottom: 6px; }
                    .match-teams { font-weight: 900; margin-bottom: 2px;}
                    .match-pick { display: flex; justify-content: space-between; margin-top: 2px; }
                </style>
            </head>
            <body>
                <div class="watermark">NOT FOR PAYOUT<br>BOOKING ONLY</div>
                <div class="content">
                    <h2>VIBE BET - BOOKING</h2>
                    <div class="code">*${bookingCode}*</div>
                    <div class="details">
                        <div>Date: ${new Date().toLocaleDateString()}</div>
                        <div style="text-align: right;">Stake: ${stake.toFixed(2)} Br<br>Potential Win: ${grossWin.toFixed(2)} Br</div>
                    </div>
                    <div style="text-align: left; margin-bottom: 5px; font-size: 12px; font-weight: 900;">EVENTS PLAYED:</div>
                    ${betSlip.map(item => `
                        <div class="match">
                            <div class="match-teams">${item.home_team} vs ${item.away_team}</div>
                            <div class="match-pick">
                                <span>Pick: ${item.odd_name}</span>
                                <span style="font-weight: 900;">@${item.odd_value}</span>
                            </div>
                        </div>
                    `).join('')}
                    <div style="text-align: center; font-size: 10px; margin-top: 15px; font-weight: bold;">
                        This is a booking slip.<br>Please visit a branch to confirm your bet.
                    </div>
                </div>
            </body>
            </html>
        `;
        doc.open(); doc.write(htmlContent); doc.close();
        setTimeout(() => {
            printFrame.contentWindow?.focus();
            printFrame.contentWindow?.print();
            setTimeout(() => document.body.removeChild(printFrame), 1000);
        }, 500);
    };

    const handleAuthSuccess = (userData: any, userToken: string) => {
        setUser(userData);
        setToken(userToken);
        localStorage.setItem('user', JSON.stringify(userData));
        localStorage.setItem('token', userToken);
        setIsAuthModalOpen(false);
    };

    const handleLogout = () => {
        setUser(null); setToken(null);
        localStorage.removeItem('user'); localStorage.removeItem('token');
    };

    const toggleAccordion = (title: string) => {
        setOpenAccordions(prev => prev.includes(title) ? prev.filter(t => t !== title) : [...prev, title]);
    };

    const getCategorizedMarkets = (game: any) => {
        const raw = game.raw_markets || [];

        const odd1 = parseFloat(game.odds[0].value) || 2.10;
        const oddX = parseFloat(game.odds[1].value) || 3.10;
        const odd2 = parseFloat(game.odds[2].value) || 2.80;
        const fav = Math.min(odd1, odd2);

        const dcMarket = raw.find((m: any) => m.key === 'double_chance');
        const dc1X = (dcMarket?.outcomes?.find((o: any) => o.name === '1X')?.price || Math.max(1.05, ((odd1 * oddX) / (odd1 + oddX)) * 0.90)).toFixed(2);
        const dc12 = (dcMarket?.outcomes?.find((o: any) => o.name === '12')?.price || Math.max(1.05, ((odd1 * odd2) / (odd1 + odd2)) * 0.90)).toFixed(2);
        const dcX2 = (dcMarket?.outcomes?.find((o: any) => o.name === 'X2')?.price || Math.max(1.05, ((oddX * odd2) / (oddX + odd2)) * 0.90)).toFixed(2);

        const totalsMarket = raw.find((m: any) => m.key === 'totals');
        const over25 = (totalsMarket?.outcomes?.find((o: any) => o.name.includes('Over'))?.price || (fav > 1.8 ? 1.60 : 1.85)).toFixed(2);
        const under25 = (totalsMarket?.outcomes?.find((o: any) => o.name.includes('Under'))?.price || (fav > 1.8 ? 2.05 : 1.65)).toFixed(2);

        const bttsMarket = raw.find((m: any) => m.key === 'btts');
        const bttsYes = (bttsMarket?.outcomes?.find((o: any) => o.name === 'Yes')?.price || 1.75).toFixed(2);
        const bttsNo = (bttsMarket?.outcomes?.find((o: any) => o.name === 'No')?.price || 1.75).toFixed(2);

        const bO = parseFloat(over25);
        const bU = parseFloat(under25);

        const dnb1 = Math.max(1.05, odd1 * 0.68).toFixed(2);
        const dnb2 = Math.max(1.05, odd2 * 0.68).toFixed(2);
        const winMargin1 = (odd1 * 1.65).toFixed(2);
        const winMargin2 = (odd2 * 1.65).toFixed(2);

        const cs10 = (odd1 * 2.2).toFixed(2);
        const cs20 = (odd1 * 3.1).toFixed(2);
        const cs21 = (odd1 * 3.8).toFixed(2);
        const cs00 = (oddX * 2.4).toFixed(2);
        const cs11 = (oddX * 1.9).toFixed(2);
        const cs01 = (odd2 * 2.2).toFixed(2);
        const cs02 = (odd2 * 3.1).toFixed(2);
        const cs12 = (odd2 * 3.8).toFixed(2);

        const over05 = Math.max(1.02, bO * 0.40).toFixed(2);
        const under05 = (bU * 3.2).toFixed(2);
        const over15 = Math.max(1.10, bO * 0.60).toFixed(2);
        const under15 = (bU * 1.65).toFixed(2);
        const over35 = (bO * 1.95).toFixed(2);
        const under35 = Math.max(1.15, bU * 0.55).toFixed(2);
        const over45 = (bO * 3.1).toFixed(2);
        const under45 = Math.max(1.05, bU * 0.35).toFixed(2);

        const exact0 = under05;
        const exact1 = (bU * 1.35).toFixed(2);
        const exact2 = (oddX * 1.05).toFixed(2);
        const exact3 = (bO * 1.35).toFixed(2);
        const exact4Plus = (bO * 1.95).toFixed(2);

        const goalsOdd = "1.85";
        const goalsEven = "1.85";

        const homeO15 = (odd1 * 1.1).toFixed(2);
        const homeU15 = (odd2 * 1.1).toFixed(2);
        const awayO15 = (odd2 * 1.1).toFixed(2);
        const awayU15 = (odd1 * 1.1).toFixed(2);

        const firstToScore1 = Math.max(1.15, odd1 * 0.75).toFixed(2);
        const firstToScoreNone = under05;
        const firstToScore2 = Math.max(1.15, odd2 * 0.75).toFixed(2);

        const scoreBothHalves1 = (odd1 * 2.5).toFixed(2);
        const scoreBothHalves2 = (odd2 * 2.5).toFixed(2);
        const cleanSheet1 = (odd1 * 1.2).toFixed(2);
        const cleanSheet2 = (odd2 * 1.2).toFixed(2);

        const ht1 = (odd1 * 1.35).toFixed(2);
        const htX = Math.max(1.10, oddX * 0.55).toFixed(2);
        const ht2 = (odd2 * 1.35).toFixed(2);

        const htO05 = (bO * 0.75).toFixed(2);
        const htU05 = (bU * 1.3).toFixed(2);
        const htO15 = (bO * 1.4).toFixed(2);
        const htU15 = (bU * 0.65).toFixed(2);

        const htBttsYes = (bO * 1.6).toFixed(2);
        const htBttsNo = Math.max(1.05, bU * 0.55).toFixed(2);

        const highestScoringHalf1 = "2.90";
        const highestScoringHalfTie = "3.20";
        const highestScoringHalf2 = "1.95";

        const ft11 = (odd1 * 1.45).toFixed(2);
        const ftX1 = (odd1 * 2.0).toFixed(2);
        const ft22 = (odd2 * 1.45).toFixed(2);
        const ftX2 = (odd2 * 2.0).toFixed(2);
        const ftXX = (oddX * 1.3).toFixed(2);

        const euHcHomeMinus1 = (odd1 * 1.65).toFixed(2);
        const euHcTieMinus1 = (oddX * 1.10).toFixed(2);
        const euHcAwayPlus1 = Math.max(1.10, odd2 * 0.55).toFixed(2);

        const asHcHomeMinus05 = odd1.toFixed(2);
        const asHcAwayPlus05 = dcX2;

        const combo1Y = (odd1 * bO * 0.75).toFixed(2);
        const combo1N = (odd1 * bU * 0.75).toFixed(2);
        const comboXY = (oddX * bO * 0.75).toFixed(2);
        const comboXN = (oddX * bU * 0.75).toFixed(2);
        const combo2Y = (odd2 * bO * 0.75).toFixed(2);
        const combo2N = (odd2 * bU * 0.75).toFixed(2);

        const combo1XAndOver25 = (parseFloat(dc1X) * bO * 0.78).toFixed(2);
        const combo1XAndUnder25 = (parseFloat(dc1X) * bU * 0.78).toFixed(2);

        const over95Corners = "1.75";
        const under95Corners = "1.75";
        const mostCorners1 = (odd1 * 0.82).toFixed(2);
        const mostCornersX = "6.50";
        const mostCorners2 = (odd2 * 0.82).toFixed(2);

        const over45Cards = "1.72";
        const under45Cards = "1.82";
        const redCardYes = "4.20";
        const redCardNo = "1.12";
        const penaltyYes = "2.60";
        const penaltyNo = "1.30";

        const goal15MinYes = "2.95";
        const goal15MinNo = "1.25";

        return {
            "Main Match Result": [
                { title: "1X2 (Match Winner)", cols: 3, odds: [{ odd_id: `1_${game.id}`, option: "1", value: odd1.toFixed(2) }, { odd_id: `x_${game.id}`, option: "X", value: oddX.toFixed(2) }, { odd_id: `2_${game.id}`, option: "2", value: odd2.toFixed(2) }] },
                { title: "Double Chance", cols: 3, odds: [{ odd_id: `dc_1x_${game.id}`, option: "1X", value: dc1X }, { odd_id: `dc_12_${game.id}`, option: "12", value: dc12 }, { odd_id: `dc_x2_${game.id}`, option: "X2", value: dcX2 }] },
                { title: "Draw No Bet (DNB)", cols: 2, odds: [{ odd_id: `dnb_1_${game.id}`, option: "1 (Home)", value: dnb1 }, { odd_id: `dnb_2_${game.id}`, option: "2 (Away)", value: dnb2 }] },
                { title: "Winning Margin", cols: 2, odds: [{ odd_id: `wm_1_${game.id}`, option: "Home by 1", value: winMargin1 }, { odd_id: `wm_2_${game.id}`, option: "Away by 1", value: winMargin2 }] },
                { title: "Correct Score (Popular)", cols: 4, odds: [
                    { odd_id: `cs_10_${game.id}`, option: "1-0", value: cs10 }, { odd_id: `cs_20_${game.id}`, option: "2-0", value: cs20 }, { odd_id: `cs_21_${game.id}`, option: "2-1", value: cs21 }, { odd_id: `cs_00_${game.id}`, option: "0-0", value: cs00 },
                    { odd_id: `cs_01_${game.id}`, option: "0-1", value: cs01 }, { odd_id: `cs_02_${game.id}`, option: "0-2", value: cs02 }, { odd_id: `cs_12_${game.id}`, option: "1-2", value: cs12 }, { odd_id: `cs_11_${game.id}`, option: "1-1", value: cs11 }
                ]}
            ],
            "Goal Markets": [
                { title: "Total Goals: Over/Under 0.5", cols: 2, odds: [{ odd_id: `ou_o05_${game.id}`, option: "Over 0.5", value: over05 }, { odd_id: `ou_u05_${game.id}`, option: "Under 0.5", value: under05 }] },
                { title: "Total Goals: Over/Under 1.5", cols: 2, odds: [{ odd_id: `ou_o15_${game.id}`, option: "Over 1.5", value: over15 }, { odd_id: `ou_u15_${game.id}`, option: "Under 1.5", value: under15 }] },
                { title: "Total Goals: Over/Under 2.5", cols: 2, odds: [{ odd_id: `ou_o25_${game.id}`, option: "Over 2.5", value: over25 }, { odd_id: `ou_u25_${game.id}`, option: "Under 2.5", value: under25 }] },
                { title: "Total Goals: Over/Under 3.5", cols: 2, odds: [{ odd_id: `ou_o35_${game.id}`, option: "Over 3.5", value: over35 }, { odd_id: `ou_u35_${game.id}`, option: "Under 3.5", value: under35 }] },
                { title: "Total Goals: Over/Under 4.5", cols: 2, odds: [{ odd_id: `ou_o45_${game.id}`, option: "Over 4.5", value: over45 }, { odd_id: `ou_u45_${game.id}`, option: "Under 4.5", value: under45 }] },
                { title: "Both Teams To Score (BTTS)", cols: 2, odds: [{ odd_id: `btts_yes_${game.id}`, option: "Yes (GG)", value: bttsYes }, { odd_id: `btts_no_${game.id}`, option: "No (NG)", value: bttsNo }] },
                { title: "Odd/Even Goals", cols: 2, odds: [{ odd_id: `odd_${game.id}`, option: "Odd", value: goalsOdd }, { odd_id: `even_${game.id}`, option: "Even", value: goalsEven }] },
                { title: "Exact Total Goals", cols: 4, odds: [
                    { odd_id: `exg_0_${game.id}`, option: "0 Goals", value: exact0 }, { odd_id: `exg_1_${game.id}`, option: "1 Goal", value: exact1 },
                    { odd_id: `exg_2_${game.id}`, option: "2 Goals", value: exact2 }, { odd_id: `exg_3_${game.id}`, option: "3 Goals", value: exact3 },
                    { odd_id: `exg_4p_${game.id}`, option: "4+ Goals", value: exact4Plus }
                ]},
                { title: "Home Team Goals O/U 1.5", cols: 2, odds: [{ odd_id: `htg_o15_${game.id}`, option: "Over 1.5", value: homeO15 }, { odd_id: `htg_u15_${game.id}`, option: "Under 1.5", value: homeU15 }] },
                { title: "Away Team Goals O/U 1.5", cols: 2, odds: [{ odd_id: `atg_o15_${game.id}`, option: "Over 1.5", value: awayO15 }, { odd_id: `atg_u15_${game.id}`, option: "Under 1.5", value: awayU15 }] },
                { title: "First Team to Score", cols: 3, odds: [{ odd_id: `fts_1_${game.id}`, option: "Home", value: firstToScore1 }, { odd_id: `fts_none_${game.id}`, option: "None", value: firstToScoreNone }, { odd_id: `fts_2_${game.id}`, option: "Away", value: firstToScore2 }] },
                { title: "Clean Sheet", cols: 2, odds: [{ odd_id: `cs_home_${game.id}`, option: "Home Clean Sheet", value: cleanSheet1 }, { odd_id: `cs_away_${game.id}`, option: "Away Clean Sheet", value: cleanSheet2 }] },
                { title: "Score in Both Halves", cols: 2, odds: [{ odd_id: `sbh_home_${game.id}`, option: "Home Yes", value: scoreBothHalves1 }, { odd_id: `sbh_away_${game.id}`, option: "Away Yes", value: scoreBothHalves2 }] }
            ],
            "Half-Time Markets": [
                { title: "1st Half 1X2", cols: 3, odds: [{ odd_id: `ht_1_${game.id}`, option: "1", value: ht1 }, { odd_id: `ht_x_${game.id}`, option: "X", value: htX }, { odd_id: `ht_2_${game.id}`, option: "2", value: ht2 }] },
                { title: "1st Half O/U 0.5 Goals", cols: 2, odds: [{ odd_id: `ht_o05_${game.id}`, option: "Over 0.5", value: htO05 }, { odd_id: `ht_u05_${game.id}`, option: "Under 0.5", value: htU05 }] },
                { title: "1st Half O/U 1.5 Goals", cols: 2, odds: [{ odd_id: `ht_o15_${game.id}`, option: "Over 1.5", value: htO15 }, { odd_id: `ht_u15_${game.id}`, option: "Under 1.5", value: htU15 }] },
                { title: "1st Half BTTS", cols: 2, odds: [{ odd_id: `htb_y_${game.id}`, option: "Yes", value: htBttsYes }, { odd_id: `htb_n_${game.id}`, option: "No", value: htBttsNo }] },
                { title: "Highest Scoring Half", cols: 3, odds: [{ odd_id: `hsh_1_${game.id}`, option: "1st Half", value: highestScoringHalf1 }, { odd_id: `hsh_x_${game.id}`, option: "Tie", value: highestScoringHalfTie }, { odd_id: `hsh_2_${game.id}`, option: "2nd Half", value: highestScoringHalf2 }] },
                { title: "HT/FT (Half-Time/Full-Time)", cols: 3, odds: [
                    { odd_id: `htft_11_${game.id}`, option: "1/1", value: ft11 }, { odd_id: `htft_x1_${game.id}`, option: "X/1", value: ftX1 }, 
                    { odd_id: `htft_22_${game.id}`, option: "2/2", value: ft22 }, { odd_id: `htft_x2_${game.id}`, option: "X/2", value: ftX2 },
                    { odd_id: `htft_xx_${game.id}`, option: "X/X", value: ftXX }
                ]}
            ],
            "Handicap Markets": [
                { title: "3-Way Handicap (European)", cols: 3, odds: [{ odd_id: `ehc_1_${game.id}`, option: "Home (-1)", value: euHcHomeMinus1 }, { odd_id: `ehc_x_${game.id}`, option: "Tie (-1)", value: euHcTieMinus1 }, { odd_id: `ehc_2_${game.id}`, option: "Away (+1)", value: euHcAwayPlus1 }] },
                { title: "Asian Handicap", cols: 2, odds: [{ odd_id: `ahc_1_${game.id}`, option: "Home -0.5", value: asHcHomeMinus05 }, { odd_id: `ahc_2_${game.id}`, option: "Away +0.5", value: asHcAwayPlus05 }] }
            ],
            "Combo Markets": [
                { title: "Match Result & BTTS", cols: 2, odds: [
                    { odd_id: `combo_1y_${game.id}`, option: "1 & Yes", value: combo1Y }, { odd_id: `combo_1n_${game.id}`, option: "1 & No", value: combo1N }, 
                    { odd_id: `combo_xy_${game.id}`, option: "X & Yes", value: comboXY }, { odd_id: `combo_xn_${game.id}`, option: "X & No", value: comboXN }, 
                    { odd_id: `combo_2y_${game.id}`, option: "2 & Yes", value: combo2Y }, { odd_id: `combo_2n_${game.id}`, option: "2 & No", value: combo2N }
                ]},
                { title: "Double Chance & O/U 2.5", cols: 2, odds: [
                    { odd_id: `combo_1xo_${game.id}`, option: "1X & Over", value: combo1XAndOver25 }, { odd_id: `combo_1xu_${game.id}`, option: "1X & Under", value: combo1XAndUnder25 }
                ]}
            ],
            "Stats & Cards": [
                { title: "Total Corners O/U 9.5", cols: 2, odds: [{ odd_id: `crn_o95_${game.id}`, option: "Over 9.5", value: over95Corners }, { odd_id: `crn_u95_${game.id}`, option: "Under 9.5", value: under95Corners }] },
                { title: "Match Corners 1X2", cols: 3, odds: [{ odd_id: `crn_1_${game.id}`, option: "1", value: mostCorners1 }, { odd_id: `crn_x_${game.id}`, option: "X", value: mostCornersX }, { odd_id: `crn_2_${game.id}`, option: "2", value: mostCorners2 }] },
                { title: "Total Cards O/U 4.5", cols: 2, odds: [{ odd_id: `crd_o45_${game.id}`, option: "Over 4.5", value: over45Cards }, { odd_id: `crd_u45_${game.id}`, option: "Under 4.5", value: under45Cards }] },
                { title: "Red Card in Match", cols: 2, odds: [{ odd_id: `red_y_${game.id}`, option: "Yes", value: redCardYes }, { odd_id: `red_n_${game.id}`, option: "No", value: redCardNo }] },
                { title: "Penalty Awarded", cols: 2, odds: [{ odd_id: `pen_y_${game.id}`, option: "Yes", value: penaltyYes }, { odd_id: `pen_n_${game.id}`, option: "No", value: penaltyNo }] }
            ],
            "Fast Markets": [
                { title: "Goal in First 15 Mins", cols: 2, odds: [{ odd_id: `fm_o05_15_${game.id}`, option: "Yes", value: goal15MinYes }, { odd_id: `fm_u05_15_${game.id}`, option: "No", value: goal15MinNo }] }
            ]
        };
    };

    const getLeagueDetails = (key: string) => {
        const topLeagueKeys = [
            'soccer_epl', 'soccer_germany_bundesliga', 'soccer_netherlands_eredivisie',
            'soccer_spain_la_liga', 'soccer_portugal_primeira_liga', 'soccer_france_ligue_one',
            'soccer_belgium_first_div', 'soccer_italy_serie_a', 'soccer_switzerland_superleague',
            'soccer_sweden_superettan', 'soccer_uefa_champs_league', 'soccer_uefa_europa_league',
            'soccer_saudi_professional_league', 'soccer_brazil_campeonato'
        ];

        const mapped: Record<string, { country: string, flag: string, name: string, isTop: boolean }> = {
            'soccer_epl': { country: 'England', flag: 'https://flagcdn.com/w40/gb-eng.png', name: 'Premier League', isTop: true },
            'soccer_efl_champ': { country: 'England', flag: 'https://flagcdn.com/w40/gb-eng.png', name: 'Championship', isTop: false },
            'soccer_spain_la_liga': { country: 'Spain', flag: 'https://flagcdn.com/w40/es.png', name: 'LaLiga', isTop: true },
            'soccer_italy_serie_a': { country: 'Italy', flag: 'https://flagcdn.com/w40/it.png', name: 'Serie A', isTop: true },
            'soccer_germany_bundesliga': { country: 'Germany', flag: 'https://flagcdn.com/w40/de.png', name: 'Bundesliga', isTop: true },
            'soccer_france_ligue_one': { country: 'France', flag: 'https://flagcdn.com/w40/fr.png', name: 'Ligue 1', isTop: true },
            'soccer_uefa_champs_league': { country: 'International', flag: 'https://flagcdn.com/w40/eu.png', name: 'UEFA Champions League', isTop: true },
            'soccer_uefa_europa_league': { country: 'International', flag: 'https://flagcdn.com/w40/eu.png', name: 'UEFA Europa League', isTop: true },
            'soccer_netherlands_eredivisie': { country: 'Netherlands', flag: 'https://flagcdn.com/w40/nl.png', name: 'Eredivisie', isTop: true },
            'soccer_portugal_primeira_liga': { country: 'Portugal', flag: 'https://flagcdn.com/w40/pt.png', name: 'Liga Portugal', isTop: true },
            'soccer_belgium_first_div': { country: 'Belgium', flag: 'https://flagcdn.com/w40/be.png', name: 'Pro League', isTop: true },
            'soccer_switzerland_superleague': { country: 'Switzerland', flag: 'https://flagcdn.com/w40/ch.png', name: 'Super League', isTop: true },
            'soccer_sweden_superettan': { country: 'Sweden', flag: 'https://flagcdn.com/w40/se.png', name: 'Superettan', isTop: true }, 
            'soccer_saudi_professional_league': { country: 'Saudi Arabia', flag: 'https://flagcdn.com/w40/sa.png', name: 'Pro League', isTop: true },
            'soccer_spl': { country: 'Scotland', flag: 'https://flagcdn.com/w40/gb-sct.png', name: 'Premiership', isTop: false },
            'soccer_brazil_campeonato': { country: 'Brazil', flag: 'https://flagcdn.com/w40/br.png', name: 'Serie A', isTop: true },
        };
        
        if (mapped[key]) return mapped[key];
        
        const parts = key.replace('soccer_', '').split('_');
        let rawCountry = parts[0] || 'world';
        
        let countryName = rawCountry.charAt(0).toUpperCase() + rawCountry.slice(1);
        let leagueName = parts.slice(1).join(' ').replace(/\b\w/g, l => l.toUpperCase());

        const countryCodes: Record<string, string> = {
            'england': 'gb-eng', 'spain': 'es', 'italy': 'it', 'germany': 'de', 'france': 'fr', 'europe': 'eu', 'international': 'un', 'world': 'un',
            'brazil': 'br', 'scotland': 'gb-sct', 'saudi': 'sa', 'argentina': 'ar', 'mexico': 'mx', 'usa': 'us', 'turkey': 'tr', 'greece': 'gr', 'japan': 'jp', 'colombia': 'co'
        };

        if (!leagueName) leagueName = countryName + ' League';

        const cCode = countryCodes[countryName.toLowerCase()];
        const flagUrl = cCode ? `https://flagcdn.com/w40/${cCode}.png` : `https://flagcdn.com/w40/${rawCountry.slice(0,2)}.png`; 
        
        return { 
            country: countryName,
            flag: flagUrl, 
            name: leagueName, 
            isTop: topLeagueKeys.includes(key)
        };
    };

    const renderFlag = (flagObj: string) => {
        if (flagObj.includes('http') || flagObj.includes('/') || flagObj.includes('.')) {
            return <img src={flagObj} alt="flag" onError={(e: any) => e.target.src='https://flagcdn.com/w40/un.png'} className="w-full h-full object-cover" />;
        }
        return flagObj; 
    };

    const currentTime = new Date().getTime();
    const activeFixtures = fixtures.filter(g => new Date(g.match_time).getTime() > currentTime);

    const groupedFixtures = activeFixtures.reduce((acc: any, game: any) => {
        const details = getLeagueDetails(game.league);
        const uniqueKey = game.league;
        if (!acc[uniqueKey]) acc[uniqueKey] = { details, games: [] };
        acc[uniqueKey].games.push(game);
        return acc;
    }, {});

    const allLeagues: [string, any][] = Object.entries(groupedFixtures);
    const topLeagues = allLeagues.filter(([_, data]) => data.details.isTop);
    
    const countriesMap = new Map<string, { flag: string, leagues: {key: string, name: string, count: number}[] }>();
    allLeagues.forEach(([key, data]) => {
        const country = data.details.country;
        if (!countriesMap.has(country)) {
            countriesMap.set(country, { flag: data.details.flag, leagues: [] });
        }
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
                currentGroup = {
                    leagueKey: leagueKey,
                    id: leagueKey + '_' + game.id,
                    data: {
                        details: getLeagueDetails(leagueKey),
                        games: [game]
                    }
                };
            } else {
                currentGroup.data.games.push(game);
            }
        }
        if (currentGroup) groupedArray.push([currentGroup.id, currentGroup.data]);
        
        displayLeagues = groupedArray;
    } else if (selectedLeague === 'Top Matches') {
        displayLeagues = allLeagues.filter(([_, data]) => data.details.isTop);
    } else if (selectedLeague !== 'All') {
        displayLeagues = allLeagues.filter(([key, _]) => key === selectedLeague);
    }

    return (
        <div className="min-h-screen bg-[#1c2024] text-slate-300 font-sans text-sm relative">
            
            <header className="bg-[#ffcc00] border-b border-[#e6b800] sticky top-0 z-30 h-[60px] flex items-center justify-between px-4 shadow-md">
                <button onClick={() => window.location.reload()} className="flex items-center gap-3 cursor-pointer hover:opacity-90 transition">
                    <div className="w-8 h-8 bg-black rounded-full flex items-center justify-center font-black text-[#ffcc00] text-xl">V</div>
                    <h1 className="text-xl font-black text-black tracking-tight flex items-center">
                        VIBE<span className="font-bold text-black/70 ml-1 text-lg">bet</span>
                    </h1>
                </button>
                
                <div className="flex gap-2 sm:gap-4 items-center">
                    <button 
                        onClick={() => setIsCheckTicketModalOpen(true)}
                        className="bg-black text-[#ffcc00] hover:bg-[#1a1a1a] px-3 py-1.5 rounded font-black text-xs flex items-center gap-1 transition-colors shadow-sm border border-black/20"
                    >
                        🔍 <span className="hidden sm:inline">ትኬት አረጋግጥ</span>
                    </button>

                    {user && (
                        <div className="flex items-center gap-3 bg-black/10 border border-black/20 px-3 py-1.5 rounded-full">
                            <span className="hidden sm:inline text-xs font-bold text-black">{user.username}</span>
                            <span className="text-xs font-black text-black sm:border-l border-black/30 sm:pl-2">
                                {(user.current_balance || 0).toFixed(2)} Br
                            </span>
                            <button onClick={handleLogout} className="text-xs font-bold text-black hover:underline ml-2">Logout</button>
                        </div>
                    )}
                </div>
            </header>

            <div className="lg:hidden fixed bottom-0 left-0 right-0 h-[60px] bg-[#1e2328] border-t border-[#3b4148] flex justify-around items-center z-40 shadow-[0_-4px_10px_rgba(0,0,0,0.5)]">
                <button onClick={() => setIsMobileMenuOpen(true)} className="flex flex-col items-center gap-1 text-slate-400 hover:text-[#ffcc00]">
                    <span className="text-xl">☰</span>
                    <span className="text-[10px] font-bold uppercase">Menu</span>
                </button>
                
                <button onClick={() => setIsCheckTicketModalOpen(true)} className="flex flex-col items-center gap-1 text-slate-400 hover:text-[#ffcc00]">
                    <span className="text-xl">🔍</span>
                    <span className="text-[10px] font-bold uppercase">Check</span>
                </button>

                <button onClick={() => {setIsMobileMenuOpen(false); setIsMobileBetSlipOpen(false);}} className="flex flex-col items-center gap-1 text-[#ffcc00]">
                    <span className="text-xl">🏠</span>
                    <span className="text-[10px] font-bold uppercase">Home</span>
                </button>
                <button onClick={() => setIsMobileBetSlipOpen(true)} className="flex flex-col items-center gap-1 text-slate-400 hover:text-[#ffcc00] relative">
                    <span className="text-xl">🧾</span>
                    <span className="text-[10px] font-bold uppercase">BetSlip</span>
                    {betSlip.length > 0 && (
                        <span className="absolute -top-1.5 -right-2 bg-[#00e700] text-black text-[10px] font-black w-4 h-4 flex items-center justify-center rounded-full border border-black shadow">
                            {betSlip.length}
                        </span>
                    )}
                </button>
            </div>

            {isMobileMenuOpen && <div className="fixed inset-0 bg-black/70 z-40 xl:hidden animate-fade-in" onClick={() => setIsMobileMenuOpen(false)} />}
            {isMobileBetSlipOpen && <div className="fixed inset-0 bg-black/70 z-40 lg:hidden animate-fade-in" onClick={() => setIsMobileBetSlipOpen(false)} />}

            <div className="flex w-full h-[calc(100vh-60px)] overflow-hidden pb-[60px] lg:pb-0">
                
                <aside className={`
                    fixed inset-y-0 left-0 z-50 w-[260px] bg-[#1e2328] border-r border-[#2a3038] overflow-y-auto custom-scrollbar transform transition-transform duration-300
                    ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
                    xl:relative xl:translate-x-0 xl:flex flex-col shrink-0
                `}>
                    <div className="xl:hidden flex justify-between items-center p-3 bg-[#24292e] border-b border-[#3b4148]">
                        <span className="font-bold text-[#ffcc00] uppercase text-sm">Menu</span>
                        <button onClick={() => setIsMobileMenuOpen(false)} className="text-slate-400 hover:text-white text-2xl leading-none">×</button>
                    </div>

                    <div className="p-3 border-b border-[#2a3038]">
                        <div className="flex bg-[#2a3038] rounded overflow-hidden border border-[#3b4148] focus-within:border-[#ffcc00] transition-colors">
                            <input 
                                type="text" 
                                placeholder="Search matches..." 
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="bg-transparent text-xs text-white p-2.5 flex-1 outline-none placeholder-slate-500" 
                            />
                            <button className="bg-[#ffcc00] hover:bg-[#e6b800] px-3 flex items-center justify-center transition-colors">
                                <span className="text-black text-sm">🔍</span>
                            </button>
                        </div>
                    </div>

                    <div className="flex gap-2 p-3 border-b border-[#2a3038]">
                        <button 
                            onClick={() => {setSelectedLeague('Top Matches'); if(window.innerWidth < 1280) setIsMobileMenuOpen(false);}}
                            className={`flex-1 border text-[11px] font-bold py-2 rounded transition-colors flex items-center justify-center gap-1.5 ${
                                selectedLeague === 'Top Matches' ? 'bg-[#ffcc00] border-[#ffcc00] text-black' : 'bg-[#2a3038] hover:bg-[#3b4148] border-[#3b4148] text-white'
                            }`}
                        >
                            <span className={selectedLeague === 'Top Matches' ? 'text-black' : 'text-[#ffcc00]'}>🏆</span> Top
                        </button>
                        <button 
                            onClick={() => {setSelectedLeague('Upcoming'); if(window.innerWidth < 1280) setIsMobileMenuOpen(false);}}
                            className={`flex-1 border text-[11px] font-bold py-2 rounded transition-colors flex items-center justify-center gap-1.5 ${
                                selectedLeague === 'Upcoming' ? 'bg-[#ffcc00] border-[#ffcc00] text-black' : 'bg-[#2a3038] hover:bg-[#3b4148] border-[#3b4148] text-white'
                            }`}
                        >
                            <span className={selectedLeague === 'Upcoming' ? 'text-black' : 'text-[#ffcc00]'}>🕒</span> Upcoming
                        </button>
                    </div>

                    {topLeagues.length > 0 && (
                        <div className="border-b border-[#2a3038]">
                            <button 
                                onClick={() => setIsTopLeaguesOpen(!isTopLeaguesOpen)} 
                                className="w-full flex items-center justify-between p-3 hover:bg-[#24292e] transition-colors"
                            >
                                <div className="flex items-center gap-2">
                                    <span className="text-[#ffcc00]">🔥</span>
                                    <span className="text-[13px] font-bold text-white">Top Leagues</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="bg-[#2a3038] text-slate-400 text-[10px] px-1.5 py-0.5 rounded-sm">{topLeagues.length}</span>
                                    <span className="text-slate-500 text-[10px]">{isTopLeaguesOpen ? '▲' : '▼'}</span>
                                </div>
                            </button>

                            {isTopLeaguesOpen && (
                                <ul className="text-xs text-slate-300 pb-2">
                                    {topLeagues.map(([key, data]) => (
                                        <li key={key}>
                                            <button 
                                                onClick={() => {setSelectedLeague(key); if(window.innerWidth < 1280) setIsMobileMenuOpen(false);}}
                                                className={`w-full flex items-center justify-between px-3 py-1.5 transition-colors ${
                                                    selectedLeague === key ? 'bg-[#2a3038] border-l-2 border-[#ffcc00] text-white' : 'border-l-2 border-transparent hover:bg-[#2a3038] hover:text-white'
                                                }`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="w-5 h-5 bg-[#2a3038] rounded-full flex items-center justify-center text-xs overflow-hidden border border-[#3b4148]">
                                                        {renderFlag(data.details.flag)}
                                                    </div>
                                                    <span className="font-semibold">{data.details.name}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-slate-500 text-[11px]">{data.games.length}</span>
                                                    <span className="text-slate-600 hover:text-[#ffcc00] transition-colors text-sm">☆</span>
                                                </div>
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    )}

                    <div>
                        <div className="px-3 pt-4 pb-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                            Sports
                        </div>
                        <button 
                            onClick={() => setIsSoccerOpen(!isSoccerOpen)} 
                            className="w-full flex items-center justify-between p-3 hover:bg-[#24292e] transition-colors"
                        >
                            <div className="flex items-center gap-2">
                                <span className="text-[#3b82f6]">⚽</span>
                                <span className="text-[13px] font-bold text-white">Soccer</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="bg-[#2a3038] text-slate-400 text-[10px] px-1.5 py-0.5 rounded-sm">{activeFixtures.length}</span>
                                <span className="text-slate-500 text-[10px]">{isSoccerOpen ? '▲' : '▼'}</span>
                            </div>
                        </button>

                        {isSoccerOpen && (
                            <div className="text-xs text-slate-300 pb-4">
                                {sortedCountries.map(([countryName, countryData]) => {
                                    const isCountryOpen = openCountry === countryName;
                                    const totalGames = countryData.leagues.reduce((sum, l) => sum + l.count, 0);
                                    
                                    return (
                                        <div key={countryName}>
                                            <button 
                                                onClick={() => setOpenCountry(isCountryOpen ? null : countryName)}
                                                className={`w-full flex items-center justify-between px-4 py-2 transition-colors ${
                                                    isCountryOpen ? 'bg-[#2a3038] text-white' : 'hover:bg-[#2a3038] hover:text-white'
                                                }`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <span className="text-sm w-5 h-5 flex items-center justify-center rounded-full overflow-hidden border border-[#3b4148]">
                                                        {renderFlag(countryData.flag)}
                                                    </span>
                                                    <span className="font-semibold">{countryName}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-slate-500 text-[11px]">{totalGames}</span>
                                                    <span className="text-slate-600 text-[10px]">{isCountryOpen ? '▼' : '❯'}</span>
                                                </div>
                                            </button>
                                            
                                            {isCountryOpen && (
                                                <ul className="bg-[#1a1f24] py-1 border-b border-[#2a3038]">
                                                    {countryData.leagues.map((league) => (
                                                        <li key={league.key}>
                                                            <button 
                                                                onClick={() => {setSelectedLeague(league.key); if(window.innerWidth < 1280) setIsMobileMenuOpen(false);}}
                                                                className={`w-full flex items-center justify-between pl-12 pr-4 py-2 transition-colors ${
                                                                    selectedLeague === league.key ? 'text-[#ffcc00] font-bold' : 'text-slate-400 hover:text-white hover:bg-[#24292e]'
                                                                }`}
                                                            >
                                                                <span>{league.name}</span>
                                                                <span className="text-[10px] opacity-60">{league.count}</span>
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
                    
                    <div className="bg-[#24292e] border-b border-[#3b4148] p-2 sm:p-3 shrink-0 flex flex-col gap-3 shadow-sm z-20 relative">
                        <div className="flex gap-2 sm:gap-4">
                            <div className="flex-1 relative">
                                <button className="w-full bg-[#1a1f24] hover:bg-[#1e2328] border border-[#3b4148] rounded-lg p-2.5 flex items-center justify-between text-slate-300 transition shadow-inner">
                                    <div className="flex items-center gap-2">
                                        <span className="bg-slate-200 text-black rounded-full w-5 h-5 flex items-center justify-center text-[10px] sm:text-xs">⚽</span>
                                        <span className="font-bold text-xs sm:text-sm">Soccer</span>
                                    </div>
                                    <span className="text-[10px] text-slate-500">▼</span>
                                </button>
                            </div>
                            
                            <div className="flex-1 relative">
                                <button onClick={() => setIsCountryDropdownOpen(!isCountryDropdownOpen)} className="w-full bg-[#1a1f24] hover:bg-[#1e2328] border border-[#3b4148] rounded-lg p-2.5 flex items-center justify-between text-slate-300 transition shadow-inner truncate">
                                    <div className="flex items-center gap-2 truncate">
                                        <span className="bg-slate-200 text-black rounded-full w-5 h-5 flex items-center justify-center text-[10px] sm:text-xs shrink-0">🌐</span>
                                        <span className="font-bold text-xs sm:text-sm truncate">
                                            {selectedCountryFilter}
                                        </span>
                                    </div>
                                    <span className="text-[10px] text-slate-500 ml-2 shrink-0">{isCountryDropdownOpen ? '▲' : '▼'}</span>
                                </button>

                                {isCountryDropdownOpen && (
                                    <div className="absolute top-full left-0 mt-1 w-full bg-[#1e2328] border border-[#3b4148] rounded-lg shadow-xl z-50 max-h-60 overflow-y-auto custom-scrollbar">
                                        <button onClick={() => { setSelectedCountryFilter('All Countries'); setIsCountryDropdownOpen(false); }} className="w-full text-left px-4 py-3 hover:bg-[#2a3038] text-sm font-bold text-white border-b border-[#3b4148] transition-colors">
                                            🌐 ሁሉም ሀገራት (All)
                                        </button>
                                        {sortedCountries.map(([cName, cData]) => (
                                            <button key={cName} onClick={() => { setSelectedCountryFilter(cName); setIsCountryDropdownOpen(false); }} className="w-full text-left px-4 py-2.5 hover:bg-[#2a3038] flex items-center gap-3 border-b border-[#3b4148] last:border-0 transition-colors">
                                                <span className="w-5 h-5 flex items-center justify-center rounded-full overflow-hidden border border-[#3b4148]">{renderFlag(cData.flag)}</span>
                                                <span className="text-sm font-semibold text-slate-300">{cName}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex justify-between items-center overflow-x-auto custom-scrollbar pb-1">
                            <div className="flex items-center gap-1 bg-[#1a1f24] p-1 rounded-full border border-[#3b4148] shrink-0 shadow-inner relative">
                                <button
                                    onClick={() => setSelectedDateFilter(todayStr)}
                                    className={`px-3 sm:px-4 py-1.5 rounded-full text-[10px] sm:text-xs font-bold transition-colors ${selectedDateFilter === todayStr ? 'bg-[#ffcc00] text-black shadow' : 'text-slate-400 hover:text-white'}`}
                                >Tdy</button>
                                <button
                                    onClick={() => setSelectedDateFilter(tomorrowStr)}
                                    className={`px-3 sm:px-4 py-1.5 rounded-full text-[10px] sm:text-xs font-bold transition-colors ${selectedDateFilter === tomorrowStr ? 'bg-[#ffcc00] text-black shadow' : 'text-slate-400 hover:text-white'}`}
                                >Tmw</button>
                                <button
                                    onClick={() => setSelectedDateFilter(dayAfterTmwStr)}
                                    className={`px-3 sm:px-4 py-1.5 rounded-full text-[10px] sm:text-xs font-bold transition-colors ${selectedDateFilter === dayAfterTmwStr ? 'bg-[#ffcc00] text-black shadow' : 'text-slate-400 hover:text-white'}`}
                                >{dayAfterTmwLabel}</button>
                                
                                <div className="relative flex items-center justify-center px-2">
                                    <input 
                                        ref={dateInputRef}
                                        type="date" 
                                        className="absolute w-0 h-0 opacity-0 overflow-hidden"
                                        onChange={(e) => {
                                            if(e.target.value) {
                                                const dateObj = new Date(e.target.value);
                                                const dateStr = new Date(dateObj.getTime() + Math.abs(dateObj.getTimezoneOffset() * 60000)).toDateString();
                                                setSelectedDateFilter(dateStr);
                                            } else {
                                                setSelectedDateFilter('All');
                                            }
                                        }}
                                    />
                                    <button
                                        onClick={() => {
                                            if(dateInputRef.current) {
                                                try { dateInputRef.current.showPicker(); } 
                                                catch(e) { dateInputRef.current.focus(); }
                                            }
                                        }}
                                        className={`w-8 h-8 rounded-full text-xs sm:text-sm transition-colors relative z-0 flex items-center justify-center ${!['All', todayStr, tomorrowStr, dayAfterTmwStr].includes(selectedDateFilter) && selectedDateFilter !== 'All' ? 'bg-[#ffcc00] text-black shadow' : 'text-slate-400 hover:text-white'}`}
                                    >📅</button>
                                </div>
                            </div>

                            <div className="flex items-center bg-[#1a1f24] p-1 rounded-full border border-[#3b4148] shrink-0 ml-4 shadow-inner">
                                <button
                                    onClick={() => setMainMarketView('1X2')}
                                    className={`px-3 sm:px-4 py-1.5 rounded-full text-[10px] sm:text-xs font-bold transition-colors ${mainMarketView === '1X2' ? 'bg-[#ffcc00] text-black shadow' : 'text-slate-400 hover:text-white'}`}
                                >3 Way</button>
                                <button
                                    onClick={() => setMainMarketView('DC')}
                                    className={`px-3 sm:px-4 py-1.5 rounded-full text-[10px] sm:text-xs font-bold transition-colors ${mainMarketView === 'DC' ? 'bg-[#ffcc00] text-black shadow' : 'text-slate-400 hover:text-white'}`}
                                >Double Chance</button>
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                        {isFetchingFixtures ? (
                            <div className="py-32 text-center flex flex-col items-center justify-center">
                                <div className="w-8 h-8 border-4 border-[#3b4148] border-t-[#ffcc00] rounded-full animate-spin mb-4"></div>
                                <p className="text-slate-400 font-bold text-xs uppercase tracking-wider">ጨዋታዎችን በማምጣት ላይ...</p>
                            </div>
                        ) : activeFixtures.length === 0 ? (
                            <div className="py-20 text-center text-slate-500 text-xs font-bold">አሁን ላይ ምንም አይነት ጨዋታ አልተገኘም!</div>
                        ) : (
                            <div>
                                {displayLeagues
                                    .filter(([key, data]) => {
                                        let passCountry = true;
                                        if (selectedCountryFilter !== 'All Countries' && selectedLeague !== 'Upcoming') {
                                            passCountry = data.details.country === selectedCountryFilter;
                                        }
                                        return passCountry;
                                    })
                                    .map(([key, data]) => {
                                        let gamesToRender = data.games;
                                        if (selectedLeague === 'Upcoming' && selectedCountryFilter !== 'All Countries') {
                                            gamesToRender = gamesToRender.filter((g: any) => getLeagueDetails(g.league).country === selectedCountryFilter);
                                        }

                                        const filteredGames = gamesToRender.filter((g: any) => {
                                            const matchesSearch = g.home_team.toLowerCase().includes(searchTerm.toLowerCase()) || g.away_team.toLowerCase().includes(searchTerm.toLowerCase());
                                            const matchesDate = selectedDateFilter === 'All' || new Date(g.match_time).toDateString() === selectedDateFilter;
                                            return matchesSearch && matchesDate;
                                        }).sort((a: any, b: any) => new Date(a.match_time).getTime() - new Date(b.match_time).getTime());

                                        if (filteredGames.length === 0) return null;

                                        return (
                                        <div key={key} className="mb-6 rounded-lg overflow-hidden border border-[#2a3038] shadow-sm">
                                            <div className="bg-[#24292e] px-4 py-3 flex items-center gap-3 border-b border-[#3b4148] sticky top-0 z-10">
                                                <div className="w-6 h-6 bg-[#1e2328] rounded-full flex items-center justify-center text-sm shadow-inner border border-[#3b4148] overflow-hidden">
                                                    {renderFlag(data.details.flag)}
                                                </div>
                                                <span className="text-[13px] font-black text-white tracking-wide">
                                                    {data.details.country}: {data.details.name}
                                                </span>
                                            </div>

                                            <div className="flex flex-col bg-[#1e2328]">
                                                <div className="flex text-[10px] font-bold text-slate-500 px-1 sm:px-2 py-2 border-b border-[#2a3038] bg-[#1a1f24]">
                                                    <div className="w-12 sm:w-16"></div>
                                                    <div className="flex-1 flex justify-around">
                                                        {mainMarketView === '1X2' ? (
                                                            <><span>1</span><span>X</span><span>2</span></>
                                                        ) : (
                                                            <><span>1X</span><span>12</span><span>X2</span></>
                                                        )}
                                                    </div>
                                                    <div className="w-10 sm:w-14"></div>
                                                </div>

                                                {filteredGames.map((game: any) => {
                                                    const matchDate = new Date(game.match_time);
                                                    const isExpanded = expandedMatchId === game.id;
                                                    const categorizedMarkets = getCategorizedMarkets(game);
                                                    
                                                    const mainMarkets = categorizedMarkets["Main Match Result"];
                                                    const market1X2 = mainMarkets.find(m => m.title === "1X2 (Match Winner)")?.odds || [];
                                                    const marketDC = mainMarkets.find(m => m.title === "Double Chance")?.odds || [];
                                                    const currentDisplayOdds = mainMarketView === '1X2' ? market1X2 : marketDC;

                                                    const btn1 = currentDisplayOdds[0];
                                                    const btnX = currentDisplayOdds[1];
                                                    const btn2 = currentDisplayOdds[2];
                                                    
                                                    const hasSelectionInGame = betSlip.some((item: any) => item.fixture_id === game.id);

                                                    return (
                                                        <div key={game.id} className="flex flex-col border-b border-[#2a3038] last:border-b-0 hover:bg-[#24292e] transition-colors">
                                                            <div className="flex items-stretch min-h-[54px] py-0.5">
                                                                <div className="w-12 sm:w-16 flex flex-col justify-center items-center text-[9px] sm:text-[10px] border-r border-[#2a3038] text-slate-400 font-medium shrink-0 bg-[#1a1f24]/50">
                                                                    <span>{matchDate.getDate()}/{matchDate.getMonth()+1}</span>
                                                                    <span className="text-[#ffcc00] font-bold">{matchDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                                                </div>

                                                                <div className="flex-1 flex items-center gap-0.5 sm:gap-1 p-1 sm:p-1.5 min-w-0">
                                                                    <button onClick={() => toggleSelection(game, btn1)} className={`flex-1 h-full min-h-[44px] flex justify-between items-center px-1.5 sm:px-3 rounded transition-colors border ${betSlip.some(item => item.odd_id === btn1.odd_id) ? 'bg-[#ffcc00] border-[#ffcc00] text-black shadow-md' : 'bg-[#1e2328] border-[#3b4148] hover:border-[#ffcc00] shadow-sm'}`}>
                                                                        <span className={`text-[9.5px] sm:text-[11px] font-semibold truncate max-w-[50px] sm:max-w-[90px] ${betSlip.some(item => item.odd_id === btn1.odd_id) ? 'text-black' : 'text-slate-300'}`}>{mainMarketView === '1X2' ? game.home_team : '1X'}</span>
                                                                        <span className={`font-black text-[11px] sm:text-[12px] ${betSlip.some(item => item.odd_id === btn1.odd_id) ? 'text-black' : 'text-[#ffcc00]'}`}>{btn1?.value}</span>
                                                                    </button>
                                                                    <button onClick={() => toggleSelection(game, btnX)} className={`w-10 sm:w-16 shrink-0 h-full min-h-[44px] flex flex-col sm:flex-row justify-center sm:justify-between items-center px-1 sm:px-2 rounded transition-colors border ${betSlip.some(item => item.odd_id === btnX.odd_id) ? 'bg-[#ffcc00] border-[#ffcc00] text-black shadow-md' : 'bg-[#1e2328] border-[#3b4148] hover:border-[#ffcc00] shadow-sm'}`}>
                                                                        {mainMarketView === 'DC' && <span className={`text-[9.5px] sm:text-[11px] font-semibold mb-0.5 sm:mb-0 ${betSlip.some(item => item.odd_id === btnX.odd_id) ? 'text-black' : 'text-slate-300'}`}>12</span>}
                                                                        <span className={`font-black text-[11px] sm:text-[12px] ${betSlip.some(item => item.odd_id === btnX.odd_id) ? 'text-black' : 'text-slate-300'}`}>{btnX?.value}</span>
                                                                    </button>
                                                                    <button onClick={() => toggleSelection(game, btn2)} className={`flex-1 h-full min-h-[44px] flex justify-between items-center px-1.5 sm:px-3 rounded transition-colors border ${betSlip.some(item => item.odd_id === btn2.odd_id) ? 'bg-[#ffcc00] border-[#ffcc00] text-black shadow-md' : 'bg-[#1e2328] border-[#3b4148] hover:border-[#ffcc00] shadow-sm'}`}>
                                                                        <span className={`font-black text-[11px] sm:text-[12px] ${betSlip.some(item => item.odd_id === btn2.odd_id) ? 'text-black' : 'text-[#ffcc00]'}`}>{btn2?.value}</span>
                                                                        <span className={`text-[9.5px] sm:text-[11px] font-semibold truncate max-w-[50px] sm:max-w-[90px] ${betSlip.some(item => item.odd_id === btn2.odd_id) ? 'text-black' : 'text-slate-300'}`}>{mainMarketView === '1X2' ? game.away_team : 'X2'}</span>
                                                                    </button>
                                                                </div>

                                                                <div className="w-10 sm:w-14 flex items-center justify-center border-l border-[#2a3038] shrink-0 bg-[#1a1f24]/50">
                                                                    <button onClick={() => setExpandedMatchId(isExpanded ? null : game.id)} className={`w-full h-full text-[10px] font-bold transition-colors flex flex-col items-center justify-center ${hasSelectionInGame ? 'bg-[#ffcc00] text-black shadow-inner' : isExpanded ? 'bg-[#2a3038] text-white shadow-inner' : 'text-slate-400 hover:text-white hover:bg-[#2a3038]'}`}>
                                                                        <span className={`text-xs ${hasSelectionInGame ? 'text-black' : ''}`}>{isExpanded ? '▲' : '▼'}</span>
                                                                        <span className={hasSelectionInGame ? 'text-black' : ''}>+{Object.values(categorizedMarkets).reduce((acc, cat) => acc + cat.length, 0)}</span>
                                                                    </button>
                                                                </div>
                                                            </div>

                                                            {isExpanded && (
                                                                <div className="bg-[#16191c] border-t border-[#3b4148] animate-fade-in-down p-2 sm:p-3">
                                                                    <div className="flex flex-col space-y-4">
                                                                        {Object.entries(categorizedMarkets).map(([categoryName, markets], catIdx) => (
                                                                            <div key={catIdx} className="bg-[#1e2328] rounded-md border border-[#2a3038] overflow-hidden shadow-sm">
                                                                                <div className="bg-[#1a1f24] px-3 py-2 border-b border-[#2a3038] sticky top-0">
                                                                                    <h3 className="text-[#ffcc00] font-black text-xs uppercase tracking-wider">{categoryName}</h3>
                                                                                </div>
                                                                                <div className="p-2 space-y-1">
                                                                                    {(markets as any[]).map((market: any, mIdx: number) => {
                                                                                        const isOpen = openAccordions.includes(market.title);
                                                                                        return (
                                                                                            <div key={mIdx} className="bg-[#2b3138] rounded-sm border border-[#3b4148] overflow-hidden">
                                                                                                <button onClick={() => toggleAccordion(market.title)} className="w-full flex items-center justify-between p-2 hover:bg-[#323840] transition-colors">
                                                                                                    <div className="flex items-center gap-2">
                                                                                                        <span className="text-slate-400 font-black text-[10px]">▶</span>
                                                                                                        <span className="text-[10px] sm:text-[11px] font-bold text-white tracking-wide text-left">{market.title}</span>
                                                                                                    </div>
                                                                                                    <span className="text-slate-500 text-[10px]">{isOpen ? '▲' : '▼'}</span>
                                                                                                </button>
                                                                                                {isOpen && (
                                                                                                    <div className="p-2 border-t border-[#3b4148] bg-[#1e2328]">
                                                                                                        <div className={`grid gap-1 ${market.cols === 4 ? 'grid-cols-2 md:grid-cols-4' : market.cols === 3 ? 'grid-cols-1 md:grid-cols-3' : 'grid-cols-1 md:grid-cols-2'}`}>
                                                                                                            {market.odds.map((odd: any) => {
                                                                                                                const isSelected = betSlip.some((item: any) => item.odd_id === odd.odd_id);
                                                                                                                return (
                                                                                                                    <button key={odd.odd_id} onClick={() => toggleSelection(game, odd)} className={`flex justify-between items-center px-2 py-1.5 rounded-sm transition-colors border ${isSelected ? 'bg-[#ffcc00] border-[#ffcc00] text-black shadow' : 'bg-[#1a1f24] border-[#3b4148] hover:border-[#ffcc00]'}`}>
                                                                                                                        <span className={`text-[10px] ${isSelected ? 'text-black font-bold' : 'text-slate-300'}`}>{odd.option}</span>
                                                                                                                        <span className={`text-[11px] font-black ${isSelected ? 'text-black' : 'text-[#ffcc00]'}`}>{odd.value}</span>
                                                                                                                    </button>
                                                                                                                )
                                                                                                            })}
                                                                                                        </div>
                                                                                                    </div>
                                                                                                )}
                                                                                            </div>
                                                                                        )
                                                                                    })}
                                                                                </div>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            )}
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
                </main>

                <aside className={`
                    fixed inset-y-0 right-0 z-50 w-full sm:w-[320px] bg-[#1e2328] border-l border-[#2a3038] overflow-hidden flex flex-col transform transition-transform duration-300
                    ${isMobileBetSlipOpen ? 'translate-x-0' : 'translate-x-full'}
                    lg:relative lg:translate-x-0 lg:w-[300px] shrink-0 shadow-[-4px_0_15px_rgba(0,0,0,0.3)] lg:shadow-none
                `}>
                    
                    <div className="bg-[#1e2328] p-3 border-b border-[#3b4148] z-20">
                        <div className="flex bg-[#24292e] rounded border border-[#3b4148] focus-within:border-[#ffcc00] overflow-hidden shadow-inner">
                            <input
                                type="text"
                                placeholder="Booking Code ያስገቡ..."
                                value={ticketCodeInput}
                                onChange={(e) => setTicketCodeInput(e.target.value)}
                                className="bg-transparent text-xs text-white p-2.5 flex-1 outline-none uppercase tracking-wider"
                            />
                            <button 
                                onClick={handleLoadTicket} 
                                disabled={isLoading || !ticketCodeInput.trim()}
                                className="bg-[#3b4148] hover:bg-[#ffcc00] hover:text-black text-slate-300 text-xs px-4 font-black transition-colors disabled:opacity-50"
                            >
                                ጫን
                            </button>
                        </div>
                    </div>

                    <div className="bg-[#24292e] p-3 border-b border-[#3b4148] shadow-sm z-10 flex justify-between items-center">
                        <h2 className="text-sm font-black text-white uppercase tracking-wide flex items-center">
                            Bet Slip
                            <span className="bg-[#ffcc00] text-black font-bold text-[10px] px-2 py-0.5 rounded-full ml-2">{betSlip.length}</span>
                        </h2>
                        <button onClick={() => setIsMobileBetSlipOpen(false)} className="lg:hidden text-slate-400 hover:text-white text-2xl leading-none">×</button>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar bg-[#16191c]">
                        {betSlip.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-slate-500 opacity-60">
                                <span className="text-4xl mb-2">📋</span>
                                <p className="text-xs font-bold text-white mb-1">ምንም አልመረጡም</p>
                            </div>
                        ) : (
                            <div className="flex flex-col p-2 space-y-2">
                                {betSlip.map((item, idx) => (
                                    <div key={idx} className="bg-[#1e2328] border border-[#2a3038] rounded-md p-3 relative group hover:border-[#3b4148] transition-colors shadow-sm">
                                        <button onClick={() => toggleSelection({id: item.fixture_id}, {odd_id: item.odd_id})} className="absolute top-2 right-2 text-slate-500 hover:text-red-500 text-lg leading-none transition-colors">✕</button>
                                        
                                        <div className="flex justify-between items-center mb-1.5 pr-4">
                                            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider truncate mr-2">{item.league_name}</span>
                                            <span className="text-[10px] text-[#ffcc00] font-black shrink-0">{new Date(item.match_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                        </div>

                                        <div className="pr-5 mb-2">
                                            <p className="text-[11px] font-bold text-white leading-snug">{item.home_team} <span className="text-slate-500 font-normal px-1">vs</span> {item.away_team}</p>
                                        </div>
                                        
                                        <div className="flex justify-between items-center bg-[#1a1f24] p-1.5 rounded border border-[#2a3038]">
                                            <span className="text-[11px] text-[#ffcc00] font-bold">{item.odd_name}</span>
                                            <span className="text-[13px] font-black text-white">{item.odd_value}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {betSlip.length > 0 && (
                        <div className="bg-[#1a1f24] p-4 border-t border-[#3b4148] shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.3)] z-10">
                            <div className="flex justify-between items-center mb-1.5">
                                <span className="text-[11px] text-slate-400">Total Odds</span>
                                <span className="text-[13px] font-black text-white">{totalOdds}</span>
                            </div>
                            <div className="flex justify-between items-center mb-3">
                                <span className="text-[11px] font-bold text-slate-300">Potential Win</span>
                                <span className="text-[14px] font-black text-[#00e700]">{grossWin.toFixed(2)} Br</span>
                            </div>
                            
                            <div className={`flex items-center gap-2 bg-[#24292e] border rounded transition-colors mb-1 overflow-hidden h-[40px] shadow-inner ${limitWarning ? 'border-red-500' : 'border-[#3b4148] focus-within:border-[#ffcc00]'}`}>
                                <span className="text-[10px] font-bold text-slate-400 pl-3 uppercase">Stake</span>
                                <input type="number" value={stake} onChange={(e) => setStake(Number(e.target.value))} className="flex-1 h-full bg-transparent text-white text-sm font-bold outline-none text-right pr-3" />
                            </div>

                            <div className="h-[18px] mb-2 flex items-center justify-center">
                                {limitWarning && <p className="text-[10px] text-red-500 font-bold leading-tight text-center">{limitWarning}</p>}
                            </div>

                            <div className="flex gap-2 h-[44px]">
                                <button onClick={() => {setBetSlip([]); setBookingCode(null)}} className="bg-[#24292e] border border-[#3b4148] text-slate-400 hover:text-red-400 hover:border-red-400 text-sm font-bold w-12 rounded flex items-center justify-center transition-colors">🗑</button>
                                <button 
                                    onClick={handlePlaceBet} 
                                    disabled={isLoading || !!limitWarning} 
                                    className="flex-1 bg-[#ffcc00] hover:bg-[#e6b800] text-black font-black text-sm rounded flex items-center justify-center transition-transform active:scale-[0.98] disabled:opacity-50 disabled:bg-slate-600 disabled:text-slate-400 disabled:cursor-not-allowed shadow-md"
                                >
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
                                            {/* Header Info */}
                                            <div className="grid grid-cols-4 text-center text-xs border-b border-[#3b4148] pb-3 mb-3">
                                                <div><p className="text-slate-500 text-[10px] mb-1">Date</p><p className="text-white font-bold">{new Date(checkedTicketData.created_at).toLocaleDateString([], {day:'2-digit', month:'2-digit'})}</p></div>
                                                <div><p className="text-slate-500 text-[10px] mb-1">Type</p><p className="text-white font-bold">Prematch</p></div>
                                                <div><p className="text-slate-500 text-[10px] mb-1">Amount</p><p className="text-white font-bold">{checkedTicketData.stake_amount}</p></div>
                                                <div><p className="text-slate-500 text-[10px] mb-1">Win</p><p className="text-[#00e700] font-bold">{checkedTicketData.potential_win}</p></div>
                                            </div>

                                            {/* Action Buttons */}
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

                                            {/* Events List (Image 2 Redesign) */}
                                            <div className="space-y-2 mb-2">
                                                {checkedTicketData.selections?.map((item: any, i: number) => {
                                                    const isWon = item.match_status === 'won'; 
                                                    const isLost = item.match_status === 'lost'; 
                                                    const icon = isWon ? '✅' : isLost ? '❌' : '⏳';
                                                    
                                                    const teams = item.match_info.split(' vs ');
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

            {/* 🌟 አዲሱ የቡኪንግ ሞዳል (Booking Modal) በምስሉ (Table Design) መሰረት 🌟 */}
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
                                                <div className="col-span-1 py-1.5 px-1.5 font-medium">{item.odd_value.toFixed(2)}</div>
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
