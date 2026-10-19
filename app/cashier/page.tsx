"use client";

import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { QRCodeSVG } from 'qrcode.react';

const MAX_STAKE = 10000;
const MAX_WIN = 10000;
const MIN_STAKE = 20;

const API_URL =
    (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_API_URL) ||
    'http://localhost:5000';

// 1. Request Interceptor (ሁልጊዜ ቶከኑን ከ localStorage አውጥቶ አብሮ ይልካል)
axios.interceptors.request.use(
    (config) => {
        const cashierToken = typeof window !== 'undefined' ? localStorage.getItem('cashierToken') : null;
        if (cashierToken && config.headers) {
            config.headers.Authorization = `Bearer ${cashierToken}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// 2. Response Interceptor (403 ላይ እንዳያስወጣ ተደርጓል)
axios.interceptors.response.use(
    response => response,
    error => {
        const requestUrl = error.config?.url || '';
        const isAuthRequest =
            requestUrl.includes('/api/auth/login') ||
            requestUrl.includes('/api/auth/verify') ||
            requestUrl.includes('/api/auth/verify-password');

        if (
            error.response &&
            error.response.status === 401 &&
            !isAuthRequest
        ) {
            localStorage.removeItem('cashierToken');
            localStorage.removeItem('cashierUsername');
            window.location.reload();
        }
        return Promise.reject(error);
    }
);

const formatShortDateTime = (iso: string) => {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const formatMatchListDateTime = (iso: string) => {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear().toString().slice(-2)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const getLeagueDetails = (key: string, flagFromApi?: string) => {
    if (!key || typeof key !== 'string') return { country: 'World', flag: 'https://media.api-sports.io/flags/un.svg', name: 'Soccer', isTop: false };
    
    let country = 'World';
    let name = key.replace('soccer_', '').replace(/_/g, ' ');
    let flag = flagFromApi || 'https://media.api-sports.io/flags/un.svg';

    if (key.includes('|')) {
        const parts = key.split('|');
        country = parts[0] || 'World';
        name = parts[1] || name;
        flag = parts[2] || flag;
    }

    const nameLower = name.toLowerCase().trim();
    const countryLower = country.toLowerCase().trim();

    let isTop = false;

    if (
        (nameLower === 'premier league' && countryLower === 'england') ||
        (nameLower === 'championship' && countryLower === 'england') ||
        (nameLower === 'fa cup' && countryLower === 'england') ||
        ((nameLower === 'la liga' || nameLower === 'primera division' || nameLower === 'laliga') && countryLower === 'spain') ||
        (nameLower === 'serie a' && countryLower === 'italy') ||
        ((nameLower === 'bundesliga' || nameLower === '1. bundesliga') && countryLower === 'germany') ||
        (nameLower === 'ligue 1' && countryLower === 'france') ||
        nameLower === 'uefa champions league' ||
        nameLower === 'uefa europa league' ||
        nameLower === 'uefa conference league' ||
        nameLower === 'world cup' ||
        nameLower === 'euro championship' ||
        nameLower === 'copa america' ||
        nameLower === 'africa cup of nations'
    ) {
        isTop = true;
    }

    if (!isTop && !key.includes('|')) {
        name = name.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        country = country.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    }

    return { country, flag, name, isTop };
};

const formatLeagueDisplay = (item: any, fixtures: any[]) => {
    const matchDetails = fixtures.find((f: any) => String(f.id) === String(item.fixture_id));
    let lName = "Soccer";
    let countryName = ""; 
    
    if (matchDetails) {
        const details = getLeagueDetails(matchDetails.sport_key || matchDetails.league);
        lName = details.name;
        countryName = details.country;
    } else if (item.sport_key) {
        const details = getLeagueDetails(item.sport_key);
        lName = details.name;
        countryName = details.country;
    } else if (item.league_name) {
        lName = item.league_name;
    }

    if (!lName || lName.toLowerCase() === "soccer" || lName.toLowerCase() === "football") return "Football";
    
    let fullName = lName;
    if (countryName && countryName !== 'World' && !lName.includes(countryName)) {
        fullName = `${countryName} - ${lName}`;
    }

    if (fullName.toLowerCase().startsWith('football')) {
        return fullName.replace(/^football\s*\/?\s*/i, 'Football / ');
    }
    return `Football / ${fullName}`;
};

const getFormattedMarket = (item: any, fixtures: any[]) => {
    let pickText = String(item.odd_name || item.pick || '').trim();
    let marketText = String(item.market_name || item.odd_category || item.market || '').trim();

    const ouMatch = pickText.match(/(over|under)\s*([\d.]+)/i);
    if (ouMatch) {
        const val = parseFloat(ouMatch[2]);
        pickText = `${ouMatch[1].charAt(0).toUpperCase() + ouMatch[1].slice(1).toLowerCase()} (${val})`;
    } else {
        if (['1', 'x', '2'].includes(pickText.toLowerCase())) {
            pickText = pickText === '1' ? 'W1' : pickText === '2' ? 'W2' : 'Draw';
            if (pickText.toUpperCase() === 'X') pickText = 'Draw';
        } else if (['1x', '12', 'x2'].includes(pickText.toLowerCase())) {
            pickText = pickText.toUpperCase();
        } else if (['yes', 'no'].includes(pickText.toLowerCase()) || pickText.toUpperCase().includes('GG') || pickText.toUpperCase().includes('NG')) {
            pickText = (pickText.toLowerCase() === 'yes' || pickText.toUpperCase().includes('GG')) ? 'Yes' : 'No';
        }
    }

    if (
        marketText.toLowerCase() === 'undefined' ||
        marketText.toLowerCase() === 'null' ||
        marketText === 'Market' ||
        marketText === 'Match Market'
    ) {
        marketText = '';
    }

    if (!marketText && (item.market_id || item.market_key)) {
        const mRef = String(item.market_id || item.market_key).toLowerCase();

        const CUSTOM_MAP: Record<string, string> = {
            "1": "Match Result", "h2h": "Match Result",
            "8": "Both Teams To Score", "btts": "Both Teams To Score",
            "12": "Double Chance", "dc": "Double Chance", "double_chance": "Double Chance",
            "5": "Total Goals", "totals": "Total Goals", "50": "Total Goals",
            "16": "Home Total Goals", "17": "Away Total Goals", "6": "1st Half Total Goals",
            "7": "Halftime/Fulltime", "11": "Highest Scoring Half", "21": "Odd/Even", "2": "Draw No Bet",
            "10": "Correct Score", "31": "Correct Score", "38": "Exact Goals", "349": "Goal Range",
            "295": "Corner Range", "85": "Total Corners", "25": "1X2 & Total",
            "24": "1X2 & Both Teams To Score", "54": "10 Minutes - 1X2",
            "92": "Anytime Goalscorer", "79": "Corner 1X2", "33": "Double Chance & Both Teams To Score",
            "86": "Last Corner", "15": "Last Goal", "94": "Last Goalscorer",
            "88": "Odd/Even Corners", "83": "Sending Off", "49": "Total & Both Teams To Score",
            "62": "Which Team To Score"
        };

        if (CUSTOM_MAP[mRef]) {
            marketText = CUSTOM_MAP[mRef];
        } else {
            const match = fixtures.find((f: any) => String(f.id) === String(item.fixture_id));
            const rawMarket = match?.raw_markets?.find(
                (m: any) =>
                    String(m.id).toLowerCase() === mRef ||
                    String(m.key).toLowerCase() === mRef
            );
            if (rawMarket) {
                marketText = String(rawMarket.title || rawMarket.name || '').trim();
            }
        }
    }

    if (!marketText || marketText.toLowerCase() === 'undefined' || marketText.toLowerCase() === 'null' || marketText === 'Market' || marketText === 'Match Market') {
        if (ouMatch) {
            if (pickText.toLowerCase().includes('corner')) marketText = 'Total Corners';
            else if (pickText.toLowerCase().includes('card')) marketText = 'Total Cards';
            else marketText = 'Total Goals';
        }
        else if (['w1', 'w2', 'draw', '1', 'x', '2'].includes(pickText.toLowerCase())) marketText = 'Match Result';
        else if (['1x', 'x2', '12'].includes(pickText.toLowerCase())) marketText = 'Double Chance';
        else if (['yes', 'no'].includes(pickText.toLowerCase())) marketText = 'Both Teams To Score';
        else marketText = 'Match Market';
    }

    if (marketText.toLowerCase() === 'total' || marketText.toLowerCase() === 'over/under') marketText = 'Total Goals';
    if (marketText.toLowerCase() === 'match winner') marketText = 'Match Result';

    return { marketText, pickText };
};

// ትክክለኛ የሚያሸንፈውን ብር (Potential Win) ማስያ (ወደ Stake እንዳይመለስ የሚከላከል)
const computeTruePotentialWin = (ticketObj: any) => {
    if (!ticketObj) return 0;
    const stake = parseFloat(ticketObj.stake_amount) || 0;
    const storedWin = parseFloat(ticketObj.potential_win) || 0;
    const storedOdds = parseFloat(ticketObj.total_odds) || 0;

    if (Array.isArray(ticketObj.selections) && ticketObj.selections.length > 0) {
        let activeOdds = 1;
        for (const s of ticketObj.selections) {
            const st = String(s.match_status || '').toLowerCase();
            if (!['postponed', 'cancelled', 'abandoned'].includes(st)) {
                const oddVal = parseFloat(s.odd_value);
                if (Number.isFinite(oddVal) && oddVal > 0) activeOdds *= oddVal;
            }
        }
        const calcFromSelections = Math.round(activeOdds * stake * 100) / 100;
        if (calcFromSelections > stake && (storedWin <= stake + 0.01 || Math.abs(storedWin - stake) < 0.05)) {
            return calcFromSelections;
        }
        if (storedWin > 0) return storedWin;
        return calcFromSelections;
    }

    if (storedOdds > 1 && (storedWin <= stake + 0.01)) {
        return Math.round(storedOdds * stake * 100) / 100;
    }

    return storedWin;
};

export default function CashierDashboard() {
    const [token, setToken] = useState<string | null>(null);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState(''); 
    const [loginError, setLoginError] = useState('');
    const [isLoggingIn, setIsLoggingIn] = useState(false);

    const [activeTab, setActiveTab] = useState<'new' | 'check' | 'report'>('new');

    const [searchCode, setSearchCode] = useState('');
    const [ticketData, setTicketData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    const [payoutTicket, setPayoutTicket] = useState('');
    const [payoutDetails, setPayoutDetails] = useState<any>(null);
    const [isPayingOut, setIsPayingOut] = useState(false);
    const [aiAnalysis, setAiAnalysis] = useState<any>(null);
    const [isAiChecking, setIsAiChecking] = useState(false);
    const [isPrinting, setIsPrinting] = useState(false);
    
    const [isPrintPreviewOpen, setIsPrintPreviewOpen] = useState(false);

    const [recentTickets, setRecentTickets] = useState<any[]>([]);
    const [allHistoryTickets, setAllHistoryTickets] = useState<any[]>([]);
    const [fixtures, setFixtures] = useState<any[]>([]);
    
    const [sidebarSearch, setSidebarSearch] = useState('');
    const [sidebarPage, setSidebarPage] = useState(1);
    
    const [isReportUnlocked, setIsReportUnlocked] = useState(false);
    const [reportPassword, setReportPassword] = useState('');
    const [reportError, setReportError] = useState('');
    
    const getLocalTodayStr = () => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };

    const [reportFilter, setReportFilter] = useState<'today' | 'week' | 'month' | 'year' | 'custom'>('today');
    const [selectedReportDate, setSelectedReportDate] = useState<string>(getLocalTodayStr());
    const [reportStatusTab, setReportStatusTab] = useState<'all' | 'won' | 'lost' | 'paid' | 'active'>('all');
    const [cashierReport, setCashierReport] = useState<any>(null);
    const reportDateInputRef = useRef<HTMLInputElement>(null);

    const [isOnline, setIsOnline] = useState(true);

    const receiptRef = useRef<HTMLDivElement>(null);
    const [isBookingPreviewOpen, setIsBookingPreviewOpen] = useState<boolean>(false);
    const [bookingCode, setBookingCode] = useState<string | null>(null);
    const [codeCopied, setCodeCopied] = useState(false);

    const displayStatus = payoutDetails?.status;
    const actualPotentialWin = computeTruePotentialWin(payoutDetails);

    useEffect(() => {
        document.title = "vibebet.et - Cashier";
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
        const savedToken = localStorage.getItem('cashierToken');
        const savedUsername = localStorage.getItem('cashierUsername');
        if (savedToken && savedUsername) {
            axios.get(`${API_URL}/api/auth/verify`, {
                headers: { Authorization: `Bearer ${savedToken}` }
            }).then(res => {
                if (res.data.success && (res.data.user.role === 'cashier' || res.data.user.role === 'admin')) {
                    setToken(savedToken);
                    setUsername(savedUsername);
                } else {
                    handleLogout();
                }
            }).catch(() => {
                handleLogout();
            });
        }
    }, []);

    useEffect(() => {
        if (token) {
            fetchRecentTickets();
            fetchCashierReport();
            // ለካሼር ክፍት የሆነውን የጨዋታዎች ሊንክ መጠቀም (403 እንዳያመጣ)
            axios.get(`${API_URL}/api/fixtures`, {
                headers: { Authorization: `Bearer ${token}` }
            })
                .then(res => {
                    const list = Array.isArray(res.data) ? res.data : (res.data?.data || []);
                    if (Array.isArray(list)) setFixtures(list);
                })
                .catch(() => {
                    axios.get(`${API_URL}/api/matches/list`, {
                        headers: { Authorization: `Bearer ${token}` }
                    })
                        .then(res2 => {
                            if (res2.data?.success) setFixtures(res2.data.data || []);
                        })
                        .catch(() => {});
                });
        }
    }, [token]);

    // በየ 5 ደቂቃው የቀኑ ትኬቶችን እና ሪፖርቱን በራሱ እንዲያድስ
    useEffect(() => {
        if (!token) return;
        const intervalId = setInterval(() => {
            fetchRecentTickets();
            if (isReportUnlocked) fetchCashierReport();
        }, 5 * 60 * 1000);
        return () => clearInterval(intervalId);
    }, [token, isReportUnlocked, reportFilter, selectedReportDate]);

    useEffect(() => {
        if (token && activeTab === 'report' && isReportUnlocked) fetchCashierReport();
    }, [token, activeTab, reportFilter, selectedReportDate, isReportUnlocked]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'F3') {
                e.preventDefault();
                setActiveTab('new'); setMessage(null); setTicketData(null); setSearchCode('');
            } else if (e.key === 'F2') {
                e.preventDefault();
                if (activeTab === 'new' && ticketData) {
                    if (!ticketData.ticket_number) {
                        if (!isLoading) handleConfirmTicketValidation();
                    } else {
                        if (!isPrinting) setIsPrintPreviewOpen(true);
                    }
                } else if (activeTab === 'check' && payoutDetails) {
                    if (displayStatus === 'won' && !isPayingOut) {
                        handleConfirmPayout();
                    }
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [activeTab, ticketData, payoutDetails, displayStatus, isLoading, isPrinting, isPayingOut]);

    const fetchRecentTickets = async () => {
        try {
            const res = await axios.get(`${API_URL}/api/tickets/history`);
            if (res.data.success && Array.isArray(res.data.data)) {
                const validAll = res.data.data
                    .filter((t: any) => t.ticket_number)
                    .map((t: any) => ({
                        ...t,
                        potential_win: computeTruePotentialWin(t).toFixed(2)
                    }));
                setAllHistoryTickets(validAll);

                const today = new Date();
                const todaysTickets = validAll.filter((t: any) => {
                    if (t.is_today === 1 || t.is_today === true) return true;
                    const ticketDate = new Date(t.created_at);
                    return ticketDate.getDate() === today.getDate() &&
                           ticketDate.getMonth() === today.getMonth() &&
                           ticketDate.getFullYear() === today.getFullYear();
                });
                
                const sorted = todaysTickets.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
                setRecentTickets(sorted);
            }
        } catch (err: any) { 
            console.warn("History fetch error:", err.message); 
        }
    };

    const fetchCashierReport = async () => {
        try {
            const dateQuery = reportFilter === 'custom' && selectedReportDate ? `&date=${encodeURIComponent(selectedReportDate)}` : '';
            const res = await axios.get(`${API_URL}/api/tickets/cashier/report?filter=${reportFilter}${dateQuery}`);
            if (res.data.success) {
                setCashierReport(res.data.data);
            }
        } catch (err: any) { 
            console.warn("Report fetch error:", err.message); 
        }
    };

    const shiftCashierReportDate = (daysDelta: number) => {
        const base = selectedReportDate ? new Date(`${selectedReportDate}T12:00:00`) : new Date();
        if (isNaN(base.getTime())) return;
        base.setDate(base.getDate() + daysDelta);
        const nextStr = `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}-${String(base.getDate()).padStart(2, '0')}`;
        setSelectedReportDate(nextStr);
        setReportFilter('custom');
    };

    const openCashierDatePicker = () => {
        const el = reportDateInputRef.current;
        if (!el) return;
        try {
            if (typeof (el as any).showPicker === 'function') {
                (el as any).showPicker();
            } else {
                el.focus();
                el.click();
            }
        } catch {
            el.focus();
        }
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoginError('');
        setIsLoggingIn(true);
        try {
            const res = await axios.post(`${API_URL}/api/auth/login`, { username: username.trim(), password });
            if (res.data.success && (res.data.user.role === 'cashier' || res.data.user.role === 'admin')) {
                setToken(res.data.token);
                setUsername(res.data.user.username);
                localStorage.setItem('cashierToken', res.data.token);
                localStorage.setItem('cashierUsername', res.data.user.username);
            } else {
                setLoginError('ይህን ገጽ ለመጠቀም የካሼር ፈቃድ ያስፈልጋል');
            }
        } catch (err: any) {
            setLoginError(err.response?.data?.message || 'ሎጊን አልተሳካም');
        } finally {
            setIsLoggingIn(false);
        }
    };

    const handleLogout = () => {
        setToken(null);
        setUsername('');
        localStorage.removeItem('cashierToken');
        localStorage.removeItem('cashierUsername');
    };

    const searchTicket = async (e: React.FormEvent) => {
        e.preventDefault();
        const cleanCode = searchCode.trim(); 
        if (!cleanCode || !/^[A-Z0-9]{5,12}$/.test(cleanCode)) {
            setMessage({ type: 'error', text: 'እባክዎ ትክክለኛ የትኬት ቁጥር ወይም የቡኪንግ ኮድ ብቻ ያስገቡ!' });
            return;
        }
        setIsLoading(true); setMessage(null); setTicketData(null);
        try {
            const res = await axios.get(`${API_URL}/api/tickets/booking/${cleanCode}`);
            if (res.data.success) {
                if (res.data.data.ticket_number && res.data.data.status !== 'void') {
                    setMessage({ type: 'error', text: 'ይህ ቁጥር ከዚህ በፊት ታትሟል! ኮፒ ማድረግ አይቻልም።' });
                    return;
                }
                setTicketData(res.data.data);
            }
        } catch (error: any) {
            setMessage({ type: 'error', text: error.response?.data?.message || "የተሳሳተ ኮድ ነው" });
        } finally { setIsLoading(false); }
    };

    const handleRebookTicket = async (ticket_number: string) => {
        setIsLoading(true); setMessage(null);
        try {
            const res = await axios.get(`${API_URL}/api/tickets/check/${ticket_number.trim()}`);
            if (res.data.success) {
                const data = res.data.data;
                if (data.status === 'void') {
                    setMessage({ type: 'error', text: 'ይህ ትኬት የተሰረዘ (Void) ስለሆነ Rebook አይደረግም' });
                    setIsLoading(false); return;
                }
                const originalSig = (data.selections || []).map((s: any) => s.odd_id).sort().join('|');
                const trueWin = computeTruePotentialWin(data).toFixed(2);
                setTicketData({ ...data, potential_win: trueWin, ticket_number: null, booking_code: `REBOOK`, original_signature: originalSig });
                setActiveTab('new');
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        } catch (err: any) {
            setMessage({ type: 'error', text: 'ትኬቱን ማምጣት አልተቻለም' });
        } finally { setIsLoading(false); }
    };

    const handleRemoveGame = (indexToRemove: number) => {
        if (!ticketData || !ticketData.selections) return;
        if (ticketData.selections.length <= 1) { alert("ቢያንስ አንድ ጨዋታ መቅረት አለበት!"); return; }
        const updatedSelections = ticketData.selections.filter((_: any, idx: number) => idx !== indexToRemove);
        const newTotalOdds = updatedSelections.reduce((acc: number, curr: any) => acc * parseFloat(curr.odd_value), 1).toFixed(2);
        const newPotentialWin = Number((parseFloat(newTotalOdds) * parseFloat(ticketData.stake_amount)).toFixed(2)).toFixed(2);
        
        setTicketData({ 
            ...ticketData, 
            selections: updatedSelections, 
            total_odds: newTotalOdds, 
            potential_win: newPotentialWin,
            booking_code: 'REBOOK' 
        });
    };

    const handleStakeChange = (newStakeStr: string) => {
        const cleaned = newStakeStr.replace(/[^0-9.]/g, '');
        const numericStake = parseFloat(cleaned);
        const validStake = Number.isFinite(numericStake) ? numericStake : 0;
        const oddsNum = (ticketData?.selections || []).reduce(
            (acc: number, curr: any) => acc * (parseFloat(curr.odd_value) || 1),
            1
        ) || parseFloat(ticketData?.total_odds) || 1;
        const newPotentialWin = (Math.round(oddsNum * validStake * 100) / 100).toFixed(2);
        setTicketData((prev: any) => ({
            ...prev,
            stake_amount: cleaned === '' ? '' : validStake,
            total_odds: oddsNum.toFixed(2),
            potential_win: newPotentialWin
        }));
    };

    const handleConfirmTicketValidation = () => {
        if (isLoading || !ticketData) return; 
        const hasStarted = ticketData.selections.some((item: any) => {
            const startTime = item.match_time || item.commence_time;
            return startTime && new Date(startTime) < new Date();
        });
        if (hasStarted) { alert("የጀመሩ ጨዋታዎች አሉ! እባክዎ ከትኬቱ ላይ ይቀንሱ።"); return; }

        const stakeVal = parseFloat(String(ticketData.stake_amount)) || 0;
        const recalcOdds = (ticketData.selections || []).reduce(
            (acc: number, curr: any) => acc * (parseFloat(curr.odd_value) || 1),
            1
        );
        const winVal = Math.round(recalcOdds * stakeVal * 100) / 100;

        if (stakeVal < MIN_STAKE) { alert(`ዝቅተኛው የውርርድ መጠን ${MIN_STAKE} ብር ነው!`); return; }
        if (stakeVal > MAX_STAKE) { alert(`ከፍተኛው የውርርድ መጠን ${MAX_STAKE} ብር ነው!`); return; }
        if (winVal > MAX_WIN) { alert(`ከፍተኛው ማሸነፊያ ${MAX_WIN} ብር ነው! እባክዎ ውርርዱን ይቀንሱ።`); return; }

        if (ticketData.booking_code === 'REBOOK') {
            const currentSig = ticketData.selections.map((s: any) => s.odd_id).sort().join('|');
            if (currentSig === ticketData.original_signature) {
                alert("🚫 ተመሳሳይ ትኬት ኮፒ ማድረግ አይቻልም! እባክዎ ቢያንስ አንዱን ጨዋታ ይቀንሱ (✕)።"); return;
            }
        }

        // የተስተካከለውን Stake እና Potential Win ወዲያውኑ ማዘመን
        setTicketData((prev: any) => ({
            ...prev,
            stake_amount: stakeVal.toFixed(2),
            total_odds: recalcOdds.toFixed(2),
            potential_win: winVal.toFixed(2)
        }));
        
        setIsPrintPreviewOpen(true);
    };

    const handleConfirmAndPrint = async () => {
        if (isPrinting || !ticketData) return;
        setIsPrinting(true);
        setIsLoading(true);

        try {
            if (ticketData.ticket_number) {
                handleDirectPrint(ticketData);
                return;
            }

            const desiredStake = parseFloat(String(ticketData.stake_amount)) || MIN_STAKE;
            const desiredOdds = (ticketData.selections || []).reduce(
                (acc: number, curr: any) => acc * (parseFloat(curr.odd_value) || 1),
                1
            );
            const desiredWin = Math.round(desiredOdds * desiredStake * 100) / 100;

            const cleanSelections = (ticketData.selections || []).map((s: any) => {
                const league = formatLeagueDisplay(s, fixtures);
                const { marketText } = getFormattedMarket(s, fixtures);
                return {
                    ...s,
                    fixture_id: s.fixture_id,
                    odd_id: s.odd_id,
                    odd_value: s.odd_value,
                    match_info: s.match_info || (s.home_team + ' vs ' + s.away_team),
                    odd_name: s.odd_name,
                    market_name: s.market_name || s.market_title || marketText,
                    league_name: league,
                    sport_key: s.sport_key || s.sport || ''
                };
            });

            let res;
            if (ticketData.booking_code === 'REBOOK') {
                const placePayload = { stake_amount: desiredStake, is_guest: true, selections: cleanSelections };
                const placeRes = await axios.post(`${API_URL}/api/tickets/place`, placePayload);
                if (!placeRes.data?.success || !placeRes.data?.data?.booking_code) {
                    throw new Error(placeRes.data?.message || 'Rebook ማስጀመር አልተቻለም');
                }
                const newBookingCode = placeRes.data.data.booking_code;
                const confirmPayload = { selections: cleanSelections, stake_amount: desiredStake };
                res = await axios.post(`${API_URL}/api/tickets/booking/${newBookingCode}/confirm`, confirmPayload);
                if (res.data.success) {
                    res.data.data.booking_code = newBookingCode;
                }
            } else {
                const payload = {
                    selections: cleanSelections,
                    stake_amount: desiredStake
                };
                res = await axios.post(`${API_URL}/api/tickets/booking/${ticketData.booking_code}/confirm`, payload);
            }

            if (res.data.success) {
                const newBookingCode = res.data.data.booking_code || ticketData.booking_code;
                const backendSelections = res.data.data.selections || [];
                
                const mergedSelections = cleanSelections.map((origSel: any, idx: number) => {
                    const backSel = backendSelections.find((b: any) => String(b.odd_id) === String(origSel.odd_id)) || backendSelections[idx] || {};
                    const merged = { ...origSel, ...backSel };
                    return {
                        ...merged,
                        market_name:
                            backSel.market_name ||
                            origSel.market_name ||
                            getFormattedMarket(merged, fixtures).marketText
                    };
                });

                const nowIso = new Date().toISOString();
                const finalTicketData = { 
                    ...ticketData, 
                    ...res.data.data,
                    selections: mergedSelections,
                    ticket_number: res.data.data.ticket_number, 
                    booking_code: newBookingCode, 
                    stake_amount: desiredStake.toFixed(2),
                    total_odds: desiredOdds.toFixed(2),
                    potential_win: desiredWin.toFixed(2),
                    status: 'active', 
                    is_today: 1,
                    minutes_ago: 0,
                    created_at: nowIso 
                };
                
                setTicketData(finalTicketData);
                setBookingCode(newBookingCode);

                // ወዲያውኑ በግራ በኩል ባለው "የቀኑ ትኬቶች" እና በሪፖርት ላይ እንዲታይ ማድረግ
                setRecentTickets((prev: any[]) => [
                    finalTicketData,
                    ...prev.filter((t: any) => t.ticket_number !== finalTicketData.ticket_number)
                ]);
                setAllHistoryTickets((prev: any[]) => [
                    finalTicketData,
                    ...prev.filter((t: any) => t.ticket_number !== finalTicketData.ticket_number)
                ]);

                fetchRecentTickets();
                fetchCashierReport();
                
                handleDirectPrint(finalTicketData);
            } else {
                throw new Error(res.data?.message || 'ትኬቱን ማረጋገጥ አልተቻለም');
            }
        } catch (error: any) { 
            alert(error.response?.data?.message || error.message || "ትኬቱን ማረጋገጥ ወይም ማተም አልተቻለም");
        } finally { 
            setIsLoading(false); 
            setIsPrinting(false);
        }
    };

    // 80mm Thermal Printer ቀጥታ የህትመት ፈንክሽን (ያለ ባዶ ወረቀት ልክ ትኬቱ እንዳለቀ እንዲቆርጥ የተሰራ)
    const handleDirectPrint = (ticketDetails: any) => {
        setTimeout(() => {
            const receiptEl = document.getElementById('printable-thermal-receipt');
            if (!receiptEl) {
                window.print();
                return;
            }

            const iframe = document.createElement('iframe');
            iframe.style.position = 'fixed';
            iframe.style.right = '0';
            iframe.style.bottom = '0';
            iframe.style.width = '80mm';
            iframe.style.height = '0';
            iframe.style.border = '0';
            iframe.style.visibility = 'hidden';
            document.body.appendChild(iframe);

            const doc = iframe.contentWindow?.document;
            if (!doc) {
                document.body.removeChild(iframe);
                window.print();
                return;
            }

            const styleLinks = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
                .map(node => node.outerHTML)
                .join('\n');

            doc.open();
            doc.write(`
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8" />
                    <title>Receipt #${ticketDetails.ticket_number || ''}</title>
                    ${styleLinks}
                    <style>
                        @page {
                            size: 72mm auto;
                            margin: 0mm !important;
                        }
                        html, body {
                            margin: 0 !important;
                            padding: 0 !important;
                            width: 72mm !important;
                            max-width: 72mm !important;
                            height: fit-content !important;
                            min-height: 0 !important;
                            background: #ffffff !important;
                            color: #000000 !important;
                            overflow: visible !important;
                            -webkit-print-color-adjust: exact !important;
                            print-color-adjust: exact !important;
                        }
                        #printable-thermal-receipt {
                            width: 100% !important;
                            max-width: 72mm !important;
                            height: fit-content !important;
                            margin: 0 !important;
                            padding: 1mm 1.5mm 1mm 1.5mm !important;
                            border: none !important;
                            box-shadow: none !important;
                        }
                        .receipt-matches-scroll {
                            max-height: none !important;
                            overflow: visible !important;
                        }
                    </style>
                </head>
                <body>
                    ${receiptEl.outerHTML}
                </body>
                </html>
            `);
            doc.close();

            setTimeout(() => {
                try {
                    iframe.contentWindow?.focus();
                    iframe.contentWindow?.print();
                } catch (e) {
                    window.print();
                } finally {
                    setTimeout(() => {
                        if (document.body.contains(iframe)) {
                            document.body.removeChild(iframe);
                        }
                    }, 1000);
                    setTicketData(null);
                    setSearchCode('');
                    setIsPrintPreviewOpen(false);
                    setMessage({
                        type: 'success',
                        text: `✅ ትኬት #${ticketDetails.ticket_number} በተሳካ ሁኔታ ተቆርጦ ታትሟል!`
                    });
                }
            }, 250);
        }, 120);
    };

    const mergeAiLegsIntoTicket = (ticketObj: any, analysisObj: any) => {
        if (!ticketObj || !analysisObj || !Array.isArray(analysisObj.legs)) return ticketObj;
        const updatedSelections = (ticketObj.selections || []).map((sel: any, idx: number) => {
            const leg = analysisObj.legs.find((l: any) => l.item_id === sel.id) || analysisObj.legs[idx];
            if (!leg) return sel;
            return {
                ...sel,
                match_status: leg.aiStatus || sel.match_status,
                score: leg.liveScore && leg.liveScore !== "-:-" ? leg.liveScore : sel.score,
                liveScore: leg.liveScore,
                aiStatus: leg.aiStatus,
                explanationAmharic: leg.explanationAmharic
            };
        });
        return {
            ...ticketObj,
            selections: updatedSelections
        };
    };

    const runAiVerifyByCode = async (code: string, autoSettle = true) => {
        if (!code || isAiChecking) return;
        setIsAiChecking(true);

        try {
            const res = await axios.post(`${API_URL}/api/tickets/ai-verify`, {
                ticket_number: code,
                autoSettle
            });

            if (res.data.success) {
                const analysis = res.data.data;
                setAiAnalysis(analysis);
                if (res.data.updatedTicket) {
                    setPayoutDetails(mergeAiLegsIntoTicket(res.data.updatedTicket, analysis));
                } else {
                    setPayoutDetails((prev: any) => mergeAiLegsIntoTicket(prev, analysis));
                }
            }
        } catch (err: any) {
            setMessage({ type: 'error', text: err.response?.data?.message || 'ውጤት ማረጋገጥ አልተቻለም' });
        } finally {
            setIsAiChecking(false);
        }
    };

    const fetchTicketDetailsForCheck = async (code: string) => {
        const cleanCode = code.trim().toUpperCase(); 
        setIsPayingOut(true); setMessage(null); setAiAnalysis(null);
        try {
            const res = await axios.get(`${API_URL}/api/tickets/check/${cleanCode}`);
            if (res.data.success) {
                const ticketObj = res.data.data;
                if (ticketObj.aiAnalysis) {
                    setAiAnalysis(ticketObj.aiAnalysis);
                    setPayoutDetails(mergeAiLegsIntoTicket(ticketObj, ticketObj.aiAnalysis));
                } else {
                    setPayoutDetails(ticketObj);
                    await runAiVerifyByCode(cleanCode, true);
                }
            }
        } catch (err: any) {
            setMessage({ type: 'error', text: err.response?.data?.message || 'ትኬቱ አልተገኘም' });
            setPayoutDetails(null);
        } finally { setIsPayingOut(false); }
    };

    const checkTicketDetails = (e: React.FormEvent) => {
        e.preventDefault();
        const code = payoutTicket.trim();
        if (!code || !/^\d{8}$/.test(code)) {
            setMessage({ type: 'error', text: 'እባክዎ ትክክለኛ 8 ዲጂት የትኬት ቁጥር ብቻ ያስገቡ!' });
            return;
        } 
        fetchTicketDetailsForCheck(code);
    };

    const handleAiVerifyTicket = async (autoSettle = false) => {
        if (!payoutDetails) return;
        const code = String(payoutDetails.ticket_number || payoutDetails.booking_code || payoutTicket).trim();
        await runAiVerifyByCode(code, autoSettle);
    };

    const handleConfirmPayout = async () => {
        if (!payoutDetails || isPayingOut) return;
        setIsPayingOut(true);
        
        const tNum = String(payoutDetails.ticket_number || payoutDetails.booking_code || payoutTicket).trim();
        try {
            const response = await fetch(`${API_URL}/api/tickets/payout`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ ticket_number: tNum })
            });
            const data = await response.json();
            
            if (!data.success) throw new Error(data.message || 'ክፍያ መፈጸም አልተቻለም');

            const serverPayoutAmount = Number(
                data.payout_amount ??
                data.data?.payout_amount ??
                actualPotentialWin
            );
            const paidAmount = serverPayoutAmount.toFixed(2);

            setPayoutDetails((prev: any) => ({
                ...prev,
                status: 'paid',
                potential_win: paidAmount
            }));
            setMessage({ type: 'success', text: `✅ ${data.message || 'ክፍያው በተሳካ ሁኔታ ተፈጽሟል'}! የተከፈለው: ${paidAmount} ብር` });
            setPayoutTicket('');
            
            fetchCashierReport();
            fetchRecentTickets();
        } catch (err: any) { 
            setMessage({ type: 'error', text: `❌ ${err.message || 'ክፍያ መፈጸም አልተቻለም! (እባክዎ ኔትወርክዎን ያረጋግጡ)'}` }); 
        } 
        finally { setIsPayingOut(false); }
    };

    const handleVoidTicket = async () => {
        if (!payoutDetails || !window.confirm("እርግጠኛ ነዎት ይህንን ትኬት መሰረዝ (Void ማድረግ) ይፈልጋሉ?")) return;
        const tNum = String(payoutDetails.ticket_number || payoutDetails.booking_code).trim();
        try {
            const res = await axios.post(`${API_URL}/api/tickets/void`, { ticket_number: tNum });
            setMessage({ type: 'success', text: res.data.message });
            fetchTicketDetailsForCheck(tNum);
            fetchRecentTickets(); 
        } catch (err: any) {
            setMessage({ type: 'error', text: err.response?.data?.message || 'ትኬቱን መሰረዝ አልተቻለም' });
        }
    };

    const handleVoidRecentTicket = async (e: React.MouseEvent, ticketNum: string) => {
        e.stopPropagation(); 
        if (!window.confirm(`እርግጠኛ ነዎት ትኬት ቁጥር ${ticketNum} መሰረዝ ይፈልጋሉ?`)) return;
        try {
            const res = await axios.post(`${API_URL}/api/tickets/void`, { ticket_number: String(ticketNum).trim() });
            setMessage({ type: 'success', text: res.data.message || "ትኬቱ ተሰርዟል!" });
            fetchRecentTickets(); 
        } catch (err: any) {
            setMessage({ type: 'error', text: err.response?.data?.message || 'ትኬቱን መሰረዝ አልተቻለም' });
        }
    };

    const handleReportAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setReportError('');
        try {
            const res = await axios.post(`${API_URL}/api/auth/verify-password`, { 
                password: reportPassword 
            });
            
            if (res.data.success) {
                setIsReportUnlocked(true); 
                setReportError('');
                fetchCashierReport();
                return;
            }
        } catch {
            // /api/auth/verify-password ካልሰራ በ /api/auth/login ማረጋገጥ
            try {
                const loginRes = await axios.post(`${API_URL}/api/auth/login`, {
                    username: username.trim(),
                    password: reportPassword
                });
                if (loginRes.data?.success) {
                    setIsReportUnlocked(true);
                    setReportError('');
                    fetchCashierReport();
                    return;
                }
            } catch (loginErr: any) {
                setReportError(loginErr.response?.data?.message || 'የተሳሳተ ፓስወርድ ነው!');
                return;
            }
        }
        setReportError('የተሳሳተ ፓስወርድ ነው!');
    };

    const isWithin20Minutes = (createdAt: string, minutesAgo?: number) => {
        if (typeof minutesAgo === 'number' && !Number.isNaN(minutesAgo)) {
            return minutesAgo >= 0 && minutesAgo < 20;
        }
        const diff = Date.now() - new Date(createdAt).getTime();
        return diff >= -60000 && diff <= 20 * 60 * 1000;
    };

    const filteredSidebarTickets = recentTickets.filter(t => 
        t.ticket_number && t.ticket_number.includes(sidebarSearch)
    );
    const totalSidebarPages = Math.ceil(filteredSidebarTickets.length / 10);
    const paginatedRecentTickets = filteredSidebarTickets.slice((sidebarPage - 1) * 10, sidebarPage * 10);

    // የQR Code ሊንክ (በማንኛውም ስልክ ሲቃኝ ትኬቱን ወዲያውኑ የሚከፍት)
    const activeReceiptCode = ticketData?.ticket_number || (ticketData?.booking_code && ticketData?.booking_code !== 'REBOOK' ? ticketData.booking_code : '') || bookingCode || '';
    const qrTargetUrl = activeReceiptCode
        ? `${typeof window !== 'undefined' ? window.location.origin : 'https://vibebet.et'}/?check=${encodeURIComponent(activeReceiptCode)}&booking=${encodeURIComponent(ticketData?.booking_code && ticketData?.booking_code !== 'REBOOK' ? ticketData.booking_code : activeReceiptCode)}`
        : `${typeof window !== 'undefined' ? window.location.origin : 'https://vibebet.et'}`;
    const bookingShareUrl = bookingCode ? `${typeof window !== 'undefined' ? window.location.origin : 'https://vibebet.et'}/?booking=${bookingCode}` : qrTargetUrl;

    // በካሼር ገጽ የተመረጠውን ቀን ወይም ጊዜ ከ allHistoryTickets እና ከ cashierReport ጋር አቀናጅቶ የሚያሰላ
    const effectiveCashierReport = (() => {
        const now = new Date();
        const isTicketInPeriod = (t: any) => {
            if (!t.created_at) return false;
            const d = new Date(t.created_at);
            if (isNaN(d.getTime())) return false;
            const localDateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

            if (reportFilter === 'custom' && selectedReportDate) {
                return localDateStr === selectedReportDate;
            }
            if (reportFilter === 'today') {
                return t.is_today === 1 || t.is_today === true || localDateStr === getLocalTodayStr();
            }
            if (reportFilter === 'week') {
                const diffDays = (now.getTime() - d.getTime()) / (1000 * 3600 * 24);
                return diffDays >= -1 && diffDays <= 7;
            }
            if (reportFilter === 'month') {
                return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
            }
            if (reportFilter === 'year') {
                return d.getFullYear() === now.getFullYear();
            }
            return true;
        };

        const localFiltered = allHistoryTickets.filter(isTicketInPeriod);
        const backendTickets = Array.isArray(cashierReport?.tickets) ? cashierReport.tickets : [];
        const sourceTickets = backendTickets.length >= localFiltered.length ? backendTickets : localFiltered;

        if (cashierReport && Number(cashierReport.total_tickets || 0) >= localFiltered.filter(t => t.status !== 'void').length && backendTickets.length > 0) {
            const fixedTickets = backendTickets.map((t: any) => ({
                ...t,
                potential_win: computeTruePotentialWin(t).toFixed(2)
            }));
            return {
                ...cashierReport,
                tickets: fixedTickets
            };
        }

        let totalTickets = 0;
        let voidTickets = 0;
        let wonCount = 0;
        let paidCount = 0;
        let unpaidWonCount = 0;
        let lostCount = 0;
        let activeCount = 0;
        let totalRevenue = 0;
        let totalPaid = 0;
        let unpaidWinnings = 0;
        let totalWonAmount = 0;
        let activeRisk = 0;

        for (const rawT of sourceTickets) {
            const st = rawT.status;
            const stake = parseFloat(rawT.stake_amount) || 0;
            const win = computeTruePotentialWin(rawT);
            rawT.potential_win = win.toFixed(2);

            if (st === 'void') {
                voidTickets++;
                continue;
            }
            totalTickets++;
            totalRevenue += stake;

            if (st === 'paid') {
                paidCount++;
                wonCount++;
                totalPaid += win;
                totalWonAmount += win;
            } else if (st === 'won') {
                unpaidWonCount++;
                wonCount++;
                unpaidWinnings += win;
                totalWonAmount += win;
            } else if (st === 'lost' || st === 'expired') {
                lostCount++;
            } else {
                activeCount++;
                activeRisk += win;
            }
        }

        const serviceFeeTotal = totalTickets * 10;
        const grossCashCollected = totalRevenue + serviceFeeTotal;
        const netProfit = totalRevenue - totalPaid;
        const cashInHand = grossCashCollected - totalPaid;

        return {
            total_tickets: totalTickets,
            void_tickets: voidTickets,
            service_fee_total: serviceFeeTotal,
            total_revenue: totalRevenue,
            gross_cash_collected: grossCashCollected,
            total_paid: totalPaid,
            unpaid_winnings: unpaidWinnings,
            total_won_amount: totalWonAmount,
            active_risk: activeRisk,
            won_tickets_count: wonCount,
            paid_tickets_count: paidCount,
            unpaid_won_count: unpaidWonCount,
            lost_tickets_count: lostCount,
            active_tickets_count: activeCount,
            net_profit: netProfit,
            cash_in_hand: cashInHand,
            tickets: sourceTickets
        };
    })();

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
        const shareText = `Vibe Bet — Booking Code: ${bookingCode}\nStake: ${parseFloat(ticketData?.stake_amount || 0).toFixed(2)} ETB | Odds: ${ticketData?.total_odds || 0}\nPotential Win: ${parseFloat(ticketData?.potential_win || 0).toFixed(2)} ETB\n${bookingShareUrl}`;
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
            const dataUrl = await toPng(receiptRef.current, { backgroundColor: '#ffffff', pixelRatio: 2 });
            const link = document.createElement('a');
            link.download = `vibebet-ticket-${bookingCode}.png`;
            link.href = dataUrl;
            link.click();
        } catch (e) {
            console.warn('Could not save receipt image', e);
        }
    };

    if (!token) {
        return (
            <div className="min-h-screen bg-[#1c2024] flex items-center justify-center font-sans">
                <div className="bg-[#24292e] p-8 rounded-2xl shadow-2xl border border-[#3b4148] w-[380px]">
                    <div className="text-center mb-8">
                        <div className="w-20 h-20 bg-[#1c2024] rounded-[15px] flex items-center justify-center mx-auto mb-4 shadow-inner border border-[#3b4148] p-2">
                            <img src="/icon.svg" alt="Vibe Bet" className="w-full h-full object-contain" />
                        </div>
                        <h2 className="text-3xl font-black text-white tracking-wide italic">VIBE <span className="text-[#ffcc00]">BET</span></h2>
                        <p className="text-slate-400 text-xs mt-2 uppercase tracking-widest font-bold bg-[#1a1f24] inline-block px-3 py-1 rounded-full border border-[#3b4148]">Cashier Portal</p>
                    </div>
                    <form onSubmit={handleLogin} className="space-y-5">
                        {loginError && <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-bold p-3 rounded-lg text-center">{loginError}</div>}
                        <div>
                            <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">Username</label>
                            <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} required className="w-full bg-[#1a1f24] border border-[#3b4148] text-white px-4 py-3 rounded-lg outline-none focus:border-[#ffcc00] text-sm transition shadow-inner" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">Password</label>
                            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="w-full bg-[#1a1f24] border border-[#3b4148] text-white px-4 py-3 rounded-lg outline-none focus:border-[#ffcc00] text-sm transition shadow-inner" />
                        </div>
                        <button type="submit" disabled={isLoggingIn} className="w-full bg-[#ffcc00] hover:bg-[#e6b800] text-black font-black py-3.5 rounded-lg mt-2 transition transform active:scale-[0.98] shadow-md uppercase tracking-wider text-sm">
                            {isLoggingIn ? 'እየገባ ነው...' : 'ግባ (LOGIN)'}
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    const hasStartedGames = ticketData?.selections?.some((item: any) => {
        const startTime = item.match_time || item.commence_time;
        return startTime && new Date(startTime) < new Date();
    });

    const stakeError = (() => {
        if (!ticketData || ticketData.ticket_number) return null;
        const stakeVal = parseFloat(ticketData.stake_amount) || 0;
        const winVal = parseFloat(ticketData.potential_win) || 0;
        if (stakeVal <= 0) return null; 
        if (stakeVal < MIN_STAKE) return `ዝቅተኛው የውርርድ መጠን ${MIN_STAKE} ብር ነው`;
        if (stakeVal > MAX_STAKE) return `ከፍተኛው የውርርድ መጠን ${MAX_STAKE} ብር ነው`;
        if (winVal > MAX_WIN) return `ከፍተኛው ማሸነፊያ ${MAX_WIN} ብር ነው፤ ውርርዱን ይቀንሱ`;
        return null;
    })();

    const betSlip = ticketData?.selections || [];
    const safeStake = parseFloat(ticketData?.stake_amount) || 0;
    const grossWin = parseFloat(ticketData?.potential_win) || 0;

    return (
        <div className="min-h-screen bg-[#1c2024] text-slate-300 font-sans flex flex-col relative">
            
            <div className="no-print flex flex-col flex-1">
                <header className="bg-[#ffcc00] border-b border-[#e6b800] h-[60px] flex items-center justify-between px-6 sticky top-0 z-30 shadow-md">
                    <div className="flex items-center gap-3">
                        <div className="w-11 h-11 shrink-0 rounded-[10px] overflow-hidden shadow-lg border border-[#3b4148]/50 bg-[#1c2024] p-1 flex items-center justify-center">
                            <img src="/icon.svg" alt="Vibe Bet" className="w-full h-full object-contain" />
                        </div>
                        <div>
                            <h1 className="text-[22px] font-black text-black leading-none tracking-tight italic mb-0.5">VIBE BET</h1>
                            <p className="text-[10px] text-black/60 font-bold uppercase tracking-widest mt-0.5 flex items-center gap-2">
                                Cashier Terminal
                                {isOnline ? <span className="text-black bg-white/30 px-1.5 rounded-sm">● Online</span> : <span className="text-red-600 bg-white/30 px-1.5 rounded-sm animate-pulse">● Offline</span>}
                            </p>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-2 bg-black/10 p-1 rounded-lg border border-black/20">
                        <button onClick={() => {setActiveTab('new'); setMessage(null); setTicketData(null); setSearchCode('');}} className={`px-4 py-2 font-black text-xs rounded-md transition flex gap-1 ${activeTab === 'new' ? 'bg-black text-[#ffcc00] shadow-sm' : 'text-black/70 hover:bg-black/5 hover:text-black'}`}>
                            ➕ አዲስ ትኬት <span className="text-[9px] opacity-60 ml-1">(F3)</span>
                        </button>
                        <button onClick={() => {setActiveTab('check'); setMessage(null);}} className={`px-4 py-2 font-black text-xs rounded-md transition ${activeTab === 'check' ? 'bg-[#00e700] text-black shadow-sm' : 'text-black/70 hover:bg-black/5 hover:text-black'}`}>
                            💰 ውጤት / ክፍያ
                        </button>
                        <button onClick={() => {setActiveTab('report'); setMessage(null); fetchCashierReport(); fetchRecentTickets();}} className={`px-4 py-2 font-black text-xs rounded-md transition ${activeTab === 'report' ? 'bg-blue-600 text-white shadow-sm' : 'text-black/70 hover:bg-black/5 hover:text-black'}`}>
                            📈 የእኔ ሪፖርት
                        </button>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="flex flex-col items-end">
                            <span className="text-xs font-black text-black uppercase tracking-wider">{username}</span>
                            <span className="text-[9px] text-black/60 uppercase tracking-widest font-bold">● Active</span>
                        </div>
                        <button onClick={handleLogout} className="text-[11px] font-bold text-white bg-black hover:bg-[#1a1a1a] px-4 py-2 rounded-md transition transform active:scale-95 shadow-sm">ውጣ</button>
                    </div>
                </header>

                <div className="flex-1 flex max-w-[1400px] w-full mx-auto p-4 gap-4">
                    
                    <aside className="w-[300px] bg-[#24292e] border border-[#3b4148] rounded-xl flex flex-col overflow-hidden shadow-sm shrink-0 h-[calc(100vh-90px)] sticky top-[75px]">
                        <div className="p-3 border-b border-[#3b4148] bg-[#1a1f24]">
                            <div className="flex justify-between items-center mb-2">
                                <h3 className="font-black text-white flex items-center gap-1.5 text-xs uppercase tracking-widest">
                                    <span>⏱ የቀኑ ትኬቶች</span>
                                    <span className="bg-[#ffcc00] text-black px-2 py-0.5 rounded-full text-[10px] font-black">
                                        {recentTickets.filter(t => t.status !== 'void').length}
                                    </span>
                                </h3>
                                <button
                                    type="button"
                                    onClick={() => { fetchRecentTickets(); fetchCashierReport(); }}
                                    className="text-[10px] font-bold text-[#ffcc00] hover:underline"
                                    title="አድስ"
                                >
                                    🔄 አድስ
                                </button>
                            </div>
                            <div className="grid grid-cols-2 gap-1.5 mb-2.5 text-[10px] bg-[#14181d] p-2 rounded-lg border border-[#2f353d]">
                                <div>
                                    <span className="text-slate-400 block">የዛሬ ውርርድ (Stake)</span>
                                    <span className="font-black text-[#00e700]">
                                        {recentTickets.filter(t => t.status !== 'void').reduce((s, t) => s + (parseFloat(t.stake_amount) || 0), 0).toLocaleString()} Br
                                    </span>
                                </div>
                                <div className="text-right">
                                    <span className="text-slate-400 block">ከ10 ብር ጋር ጠቅላላ</span>
                                    <span className="font-black text-[#ffcc00]">
                                        {(
                                            recentTickets.filter(t => t.status !== 'void').reduce((s, t) => s + (parseFloat(t.stake_amount) || 0), 0) +
                                            recentTickets.filter(t => t.status !== 'void').length * 10
                                        ).toLocaleString()} Br
                                    </span>
                                </div>
                            </div>
                            <input 
                                type="text" 
                                placeholder="በትኬት ቁጥር ፈልግ..." 
                                value={sidebarSearch}
                                onChange={(e) => {setSidebarSearch(e.target.value.trim()); setSidebarPage(1);}}
                                className="w-full bg-[#1c2024] border border-[#3b4148] text-white text-xs px-3 py-2 rounded-md outline-none focus:border-[#ffcc00] transition"
                            />
                        </div>
                        
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2.5 bg-[#1c2024]">
                            {paginatedRecentTickets.length === 0 ? (
                                <p className="text-xs text-slate-500 text-center py-10 font-bold">ዛሬ የተቆረጠ ትኬት የለም</p>
                            ) : (
                                paginatedRecentTickets.map((t, i) => (
                                    <div key={i} onClick={() => handleRebookTicket(t.ticket_number)} className={`bg-[#24292e] border ${t.status === 'void' ? 'border-red-500/30 opacity-60' : t.status === 'won' ? 'border-[#00e700]/50' : t.status === 'paid' ? 'border-blue-500/50' : 'border-[#3b4148]'} p-3 rounded-lg hover:border-[#ffcc00] transition cursor-pointer group relative overflow-hidden shadow-sm`}>
                                        <div className="absolute inset-0 bg-gradient-to-r from-[#ffcc00]/5 to-transparent opacity-0 group-hover:opacity-100 transition"></div>
                                        <div className="flex justify-between items-center mb-1.5 relative z-10">
                                            <div className="flex items-center gap-1.5">
                                                <span className={`font-mono font-black text-[13px] ${t.status === 'void' ? 'line-through text-slate-500' : 'text-[#ffcc00]'}`}>#{t.ticket_number}</span>
                                                <span className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase ${
                                                    t.status === 'won' ? 'bg-[#00e700]/20 text-[#00e700]' :
                                                    t.status === 'paid' ? 'bg-blue-500/20 text-blue-400' :
                                                    t.status === 'lost' ? 'bg-red-500/20 text-red-400' :
                                                    t.status === 'void' ? 'bg-slate-600/30 text-slate-400' :
                                                    'bg-[#ffcc00]/15 text-[#ffcc00]'
                                                }`}>
                                                    {t.status === 'won' ? 'WON' : t.status === 'paid' ? 'PAID' : t.status === 'lost' ? 'LOST' : t.status === 'void' ? 'VOID' : 'ACTIVE'}
                                                </span>
                                            </div>
                                            <span className="text-[10px] font-bold text-slate-400">{new Date(t.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-[11px] relative z-10 font-bold">
                                            <span className="text-slate-400">Stake: <span className="text-white">{t.stake_amount} Br</span></span>
                                            {t.status === 'void' ? <span className="text-red-400">ተሰርዟል</span> : (
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[#00e700]">Win: {computeTruePotentialWin(t).toFixed(2)}</span>
                                                    {t.status === 'active' && isWithin20Minutes(t.created_at, t.minutes_ago) && (
                                                        <button onClick={(e) => handleVoidRecentTicket(e, t.ticket_number)} className="bg-red-500/20 text-red-500 hover:bg-red-500 hover:text-white rounded px-1.5 py-0.5 transition-colors text-[10px]" title="ሰርዝ">
                                                            🗑️
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        {totalSidebarPages > 1 && (
                            <div className="p-3 border-t border-[#3b4148] bg-[#1a1f24] flex justify-between items-center text-xs">
                                <button 
                                    disabled={sidebarPage === 1} 
                                    onClick={() => setSidebarPage(p => p - 1)}
                                    className="px-3 py-1.5 bg-[#3b4148] text-white rounded hover:bg-[#4b5158] disabled:opacity-50 transition"
                                >
                                    ◀ በፊት
                                </button>
                                <span className="text-slate-400 font-bold">{sidebarPage} / {totalSidebarPages}</span>
                                <button 
                                    disabled={sidebarPage === totalSidebarPages} 
                                    onClick={() => setSidebarPage(p => p + 1)}
                                    className="px-3 py-1.5 bg-[#3b4148] text-white rounded hover:bg-[#4b5158] disabled:opacity-50 transition"
                                >
                                    ቀጣይ ▶
                                </button>
                            </div>
                        )}
                    </aside>

                    <main className="flex-1 flex flex-col">
                        {message && (
                            <div className={`p-4 rounded-xl font-bold text-sm flex items-center gap-2 mb-4 shadow-sm ${message.type === 'success' ? 'bg-[#00e700]/10 border border-[#00e700]/30 text-[#00e700]' : 'bg-red-500/10 border border-red-500/30 text-red-400'}`}>
                                <span>{message.type === 'success' ? '✅' : '❌'}</span> {message.text}
                            </div>
                        )}

                        {activeTab === 'new' && (
                            <div className="bg-[#24292e] p-6 rounded-xl border border-[#3b4148] shadow-sm flex-1 flex flex-col">
                                <h2 className="text-xl font-black text-white mb-5 flex items-center gap-2"><span>🔍</span> ትኬት መቁረጫ</h2>
                                <form onSubmit={searchTicket} className="flex gap-3 mb-6 shrink-0">
                                    <input 
                                        type="text" value={searchCode} onChange={(e) => setSearchCode(e.target.value.trim().toUpperCase())}
                                        placeholder="የቡኪንግ ኮድ ወይም የትኬት ቁጥር" 
                                        className="flex-1 bg-[#1a1f24] border border-[#3b4148] text-white px-5 py-3.5 rounded-xl outline-none focus:border-[#ffcc00] text-lg font-black tracking-widest transition shadow-inner uppercase"
                                    />
                                    <button type="submit" disabled={isLoading} className="bg-[#1a1f24] border border-[#3b4148] hover:bg-[#ffcc00] hover:text-black hover:border-[#ffcc00] text-white font-black px-8 rounded-xl transition active:scale-95 text-sm flex gap-2 items-center shadow-sm">
                                        {isLoading ? '...' : 'ፈልግ'} <span className="text-[10px] opacity-60">(Enter)</span>
                                    </button>
                                </form>

                                {ticketData && (
                                    <div className="flex-1 flex flex-col bg-[#f5f5f5] border border-gray-300 rounded-lg p-3 animate-fade-in-down shadow-md overflow-hidden text-black mx-auto w-full max-w-2xl">
                                        <div className="flex justify-between items-end border-b border-gray-300 pb-2 mb-2 shrink-0">
                                            <div>
                                                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-0.5">Booking Code</p>
                                                <p className="text-lg font-mono font-black text-black tracking-widest bg-white px-2 py-0.5 rounded border border-gray-300 inline-block shadow-sm">
                                                    {ticketData.booking_code === 'REBOOK' ? '🔄 REBOOK' : ticketData.booking_code}
                                                </p>
                                            </div>
                                            <div className="text-right flex flex-col gap-1">
                                                <p className="text-[11px] font-bold text-gray-600">Total Odds: <span className="text-black text-sm font-black ml-1">{ticketData.total_odds}</span></p>
                                                <div className="flex items-center justify-end gap-1 bg-white p-1 rounded border border-gray-300 shadow-sm">
                                                    <span className="text-[10px] font-bold text-gray-600 uppercase">Stake:</span>
                                                    {!ticketData.ticket_number ? (
                                                        <input 
                                                            type="number" 
                                                            min={MIN_STAKE}
                                                            max={MAX_STAKE}
                                                            value={ticketData.stake_amount ?? ''} 
                                                            onChange={(e) => handleStakeChange(e.target.value)}
                                                            className="w-20 bg-yellow-50 border border-gray-400 rounded px-1.5 py-0.5 text-black font-black text-sm outline-none text-center focus:border-blue-600 transition-colors"
                                                        />
                                                    ) : (
                                                        <span className="text-black text-sm font-black px-1">{ticketData.stake_amount}</span>
                                                    )}
                                                    <span className="text-[10px] font-bold text-gray-600">Br</span>
                                                </div>
                                            </div>
                                        </div>

                                        {hasStartedGames && !ticketData.ticket_number && (
                                            <div className="bg-red-100 text-red-600 p-2 rounded text-[10px] font-bold mb-2 flex items-center border border-red-200 animate-pulse shrink-0">
                                                <span>⚠️ የጀመሩ ጨዋታዎች አሉ! ማረጋገጥ አይችሉም (ከጨዋታው ይቀንሱ)።</span>
                                            </div>
                                        )}

                                        {stakeError && (
                                            <div className="bg-red-100 text-red-600 p-2 rounded text-[10px] font-bold mb-2 flex items-center border border-red-200 shrink-0">
                                                <span>⚠️ {stakeError}</span>
                                            </div>
                                        )}

                                        <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 mb-2 space-y-1">
                                            {ticketData.selections?.map((item: any, idx: number) => {
                                                const now = new Date();
                                                const matchTimeValue = item.match_time || item.commence_time;
                                                const matchTime = matchTimeValue ? new Date(matchTimeValue) : null;
                                                const hasStarted = matchTime && matchTime < now;

                                                const fullLeagueText = formatLeagueDisplay(item, fixtures);
                                                const { marketText, pickText } = getFormattedMarket(item, fixtures);

                                                let mTime = formatMatchListDateTime(item.match_time || item.commence_time || new Date().toISOString());
                                                let teamStr = item.match_info || (item.home_team + ' vs ' + item.away_team);

                                                return (
                                                    <div key={idx} className={`p-1.5 rounded border flex justify-between items-center transition shadow-sm ${hasStarted && !ticketData.ticket_number ? 'bg-red-50 border-red-300' : 'bg-white border-gray-200 hover:bg-gray-50'}`}>
                                                        <div className="w-full flex-1">
                                                            <div className="flex justify-between items-center mb-0.5">
                                                                <span className="text-[9px] text-gray-500 font-bold uppercase tracking-wider truncate max-w-[70%]">{fullLeagueText}</span>
                                                                <span className="text-[9px] text-gray-800 font-black shrink-0">{mTime}</span>
                                                            </div>
                                                            <div className="flex justify-between items-center">
                                                                <p className="font-bold text-[11px] text-black flex items-center gap-1">
                                                                    {teamStr}
                                                                    {hasStarted && !ticketData.ticket_number && <span className="text-[8px] text-white bg-red-500 px-1 rounded uppercase font-black animate-pulse">Started</span>}
                                                                </p>
                                                            </div>
                                                            <p className="text-[10px] text-gray-600 font-bold mt-0.5">{marketText}: <span className="text-black font-black">{pickText}</span> <span className="text-gray-500">(@{parseFloat(item.odd_value).toFixed(2)})</span></p>
                                                        </div>
                                                        {!ticketData.ticket_number && (
                                                            <button onClick={() => handleRemoveGame(idx)} className="ml-2 shrink-0 w-6 h-6 rounded bg-gray-100 border border-gray-300 text-gray-500 hover:bg-red-50 hover:text-red-500 flex justify-center items-center font-black text-xs transition">✕</button>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        <div className="flex justify-between items-center bg-gray-200 p-2.5 rounded border border-gray-300 shrink-0 mb-2 shadow-sm">
                                            <div>
                                                <p className="text-[9px] font-bold text-gray-600 uppercase tracking-widest mb-0.5">ከ 10 ብር ክፍያ ጋር የሚቀበሉ</p>
                                                <p className="text-lg font-black text-black">{(parseFloat(ticketData.stake_amount || 0) + 10).toFixed(2)} Br</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-[9px] font-bold text-gray-600 uppercase tracking-widest mb-0.5">የሚያሸንፈው (Potential Win)</p>
                                                <p className="text-lg font-black text-green-700">{parseFloat(ticketData.potential_win || 0).toFixed(2)} Br</p>
                                            </div>
                                        </div>

                                        <div className="shrink-0">
                                            {!ticketData.ticket_number ? (
                                                <button 
                                                    onClick={handleConfirmTicketValidation} 
                                                    disabled={isLoading || !!stakeError}
                                                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:text-gray-200 text-white font-black py-2.5 rounded text-sm transition transform active:scale-[0.98] tracking-widest flex items-center justify-center gap-2 shadow-md"
                                                >
                                                    {isLoading ? '...' : `አረጋግጥ (CONFIRM)`} <span className="text-[10px] bg-black/20 px-1.5 py-0.5 rounded ml-1">F2</span>
                                                </button>
                                            ) : (
                                                <button 
                                                    onClick={() => setIsPrintPreviewOpen(true)} 
                                                    disabled={isPrinting}
                                                    className="w-full bg-[#00e700] hover:bg-green-500 disabled:bg-gray-400 disabled:text-gray-200 text-black font-black py-2.5 rounded text-sm transition transform active:scale-[0.98] tracking-widest flex items-center justify-center gap-2 shadow-md animate-pulse"
                                                >
                                                    {isPrinting ? '🖨️ እየታተመ ነው...' : '🖨️ ፕሪንት (PRINT TICKET)'} <span className="text-[10px] bg-black/20 px-1.5 py-0.5 rounded ml-1">F2</span>
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'check' && (
                            <div className="bg-[#24292e] p-6 rounded-xl border border-[#3b4148] shadow-sm flex-1 flex flex-col">
                                <h2 className="text-xl font-black text-white mb-5 flex items-center gap-2"><span>💰</span> ትኬት ማጣሪያ እና ክፍያ</h2>
                                <form onSubmit={checkTicketDetails} className="flex gap-3 mb-6 shrink-0">
                                    <input 
                                        type="text" value={payoutTicket} onChange={(e) => setPayoutTicket(e.target.value.trim().toUpperCase())}
                                        placeholder="8 ዲጂት የትኬት ቁጥር ያስገቡ" 
                                        className="flex-1 bg-[#1a1f24] border border-[#3b4148] text-white px-5 py-3.5 rounded-xl outline-none focus:border-[#00e700] text-lg font-black uppercase tracking-widest transition shadow-inner"
                                    />
                                    <button type="submit" disabled={isPayingOut} className="bg-[#00e700] hover:bg-green-500 text-black font-black px-8 rounded-xl transition active:scale-95 text-sm flex items-center gap-2 shadow-sm">
                                        {isPayingOut ? '...' : 'ውጤት አሳይ'} <span className="text-[10px] opacity-60">(Enter)</span>
                                    </button>
                                </form>

                                {payoutDetails && (
                                    <div className="flex-1 flex flex-col bg-[#1c2024] border border-[#3b4148] rounded-xl p-5 animate-fade-in-down shadow-inner overflow-hidden max-w-4xl mx-auto w-full">
                                        <div className="flex justify-between items-end border-b border-[#3b4148] pb-4 mb-4 shrink-0">
                                            <div>
                                                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1">Ticket Number</p>
                                                <p className="text-2xl font-mono font-black text-[#ffcc00] tracking-widest bg-[#ffcc00]/10 px-3 py-1 rounded-md border border-[#ffcc00]/20 inline-block">{payoutDetails.ticket_number}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-2">ሁኔታ (Status)</p>
                                                <div className="flex items-center gap-3">
                                                    {displayStatus === 'active' && isWithin20Minutes(payoutDetails.created_at) && (
                                                        <button onClick={handleVoidTicket} className="bg-red-500 hover:bg-red-600 text-white font-bold px-3 py-1.5 text-xs rounded-md border border-red-700 transition shadow-sm">
                                                            🗑️ ትኬት ሰርዝ
                                                        </button>
                                                    )}

                                                    <div className={`px-4 py-1.5 rounded-md border shadow-sm ${displayStatus === 'won' ? 'bg-[#00e700]/10 border-[#00e700]/50 text-[#00e700]' : displayStatus === 'paid' ? 'bg-blue-500/10 border-blue-500/50 text-blue-400' : displayStatus === 'void' ? 'bg-slate-500/10 border-slate-500/50 text-slate-400' : displayStatus === 'expired' ? 'bg-red-500/10 border-red-500/50 text-red-500' : displayStatus === 'lost' ? 'bg-red-500/10 border-red-500/50 text-red-500' : displayStatus === 'pending' ? 'bg-orange-500/10 border-orange-500/50 text-orange-400' : 'bg-[#1a1f24] border-[#3b4148] text-slate-300'}`}>
                                                        <p className="text-sm font-black uppercase tracking-widest">
                                                            {displayStatus === 'won' ? '🎉 አሸንፏል' : displayStatus === 'paid' ? '✅ ተከፍሏል' : displayStatus === 'void' ? '🚫 ተሰርዟል' : displayStatus === 'expired' ? '⏳ ጊዜው ያለፈ (EXPIRED)' : displayStatus === 'lost' ? '❌ ተበልቷል' : displayStatus === 'pending' ? '⏳ በመጠባበቅ ላይ' : '⏳ ACTIVE'}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="mb-3 shrink-0">
                                            <div className="flex flex-wrap justify-between items-center gap-3 bg-gradient-to-r from-[#24292e] to-[#1a1f24] p-3.5 rounded-xl border border-[#3b4148] shadow-sm">
                                                <div className="flex-1 min-w-[220px]">
                                                    <p className="text-xs font-black text-[#ffcc00] flex items-center gap-1.5">
                                                        <span>🤖</span>
                                                        <span>{isAiChecking ? 'ከዳታቤዝ እና ከቀጥታ ውጤት እየተጣራ ነው...' : (aiAnalysis?.summaryAmharic || 'የትኬት ጨዋታዎች ዝርዝር እና ትክክለኛ ውጤት')}</span>
                                                    </p>
                                                    {payoutDetails.selections && (
                                                        <div className="flex flex-wrap gap-2 mt-2">
                                                            <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-[#00e700]/15 text-[#00e700] border border-[#00e700]/30">
                                                                ✅ አሸናፊ: {payoutDetails.selections.filter((s: any) => (s.aiStatus || s.match_status) === 'won').length}
                                                            </span>
                                                            <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/30">
                                                                ❌ ተሸናፊ: {payoutDetails.selections.filter((s: any) => (s.aiStatus || s.match_status) === 'lost').length}
                                                            </span>
                                                            <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-orange-500/15 text-orange-400 border border-orange-500/30">
                                                                ⏳ በመጠባበቅ ላይ: {payoutDetails.selections.filter((s: any) => !['won', 'lost', 'postponed'].includes(s.aiStatus || s.match_status)).length}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => handleAiVerifyTicket(true)}
                                                    disabled={isAiChecking}
                                                    className="bg-[#ffcc00] hover:bg-[#e6b800] text-black font-black px-4 py-2 rounded-lg text-xs transition active:scale-95 disabled:opacity-50 shadow-sm flex items-center gap-1.5 shrink-0"
                                                >
                                                    {isAiChecking ? '🔄 እያጣራ ነው...' : '🔄 ውጤት አድስ (Refresh)'}
                                                </button>
                                            </div>
                                        </div>

                                        <div className="flex-1 overflow-y-auto custom-scrollbar mb-4 space-y-2.5 pr-1">
                                            {payoutDetails.selections?.map((item: any, i: number) => {
                                                const leg = aiAnalysis?.legs?.find((l: any) => l.item_id === item.id) || aiAnalysis?.legs?.[i];
                                                const finalStatus = leg?.aiStatus || item.aiStatus || item.match_status || 'pending';
                                                const isWon = finalStatus === 'won';
                                                const isLost = finalStatus === 'lost';
                                                const isPostponed = [ 'postponed', 'cancelled', 'abandoned' ].includes(finalStatus);

                                                const trueScore =
                                                    (leg?.liveScore && leg.liveScore !== '-:-' ? leg.liveScore : null) ||
                                                    (item.liveScore && item.liveScore !== '-:-' ? item.liveScore : null) ||
                                                    (item.score && item.score !== '-:-' ? item.score : '-:-');

                                                const explanation =
                                                    leg?.explanationAmharic ||
                                                    item.explanationAmharic ||
                                                    null;

                                                const teams = String(item.match_info || '').split(/\s+vs\.?\s+|\s+-\s+/i);
                                                const homeTeam = teams[0] || item.home_team || 'Home';
                                                const awayTeam = teams[1] || item.away_team || 'Away';

                                                const mTime = new Date(item.match_time || item.commence_time || payoutDetails.created_at || new Date()).toLocaleString('en-GB', {
                                                    day: '2-digit',
                                                    month: '2-digit',
                                                    hour: '2-digit',
                                                    minute: '2-digit'
                                                }).replace(',', '');

                                                const { marketText, pickText } = getFormattedMarket(item, fixtures);
                                                const fullLeagueText = formatLeagueDisplay(item, fixtures);

                                                return (
                                                    <div
                                                        key={i}
                                                        className={`rounded-xl border p-3.5 transition-all shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                                                            isWon
                                                                ? 'bg-gradient-to-r from-[#182c22] to-[#1e262b] border-[#00e700]/40'
                                                                : isLost
                                                                    ? 'bg-gradient-to-r from-[#2e1c20] to-[#1e2328] border-red-500/40'
                                                                    : isPostponed
                                                                        ? 'bg-[#25282c] border-[#ffcc00]/40'
                                                                        : 'bg-[#24292e] border-[#3b4148]'
                                                        }`}
                                                    >
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex flex-wrap items-center gap-2 mb-1.5">
                                                                <span className="text-[10px] font-bold text-slate-300 bg-[#1a1f24] border border-[#3b4148] px-2 py-0.5 rounded">
                                                                    🕒 {mTime}
                                                                </span>
                                                                {fullLeagueText && (
                                                                    <span className="text-[10px] font-bold text-slate-400 truncate max-w-[260px]">
                                                                        {fullLeagueText}
                                                                    </span>
                                                                )}
                                                            </div>

                                                            <div className="text-sm font-black text-white tracking-wide mb-1.5">
                                                                {homeTeam} <span className="text-[#ffcc00] mx-1">vs</span> {awayTeam}
                                                            </div>

                                                            <div className="flex flex-wrap items-center gap-2">
                                                                <span className="text-xs font-bold text-slate-200 bg-[#1a1f24] px-2.5 py-1 rounded-md border border-[#3b4148]">
                                                                    {marketText}: <span className="text-[#ffcc00] font-black">{pickText}</span>
                                                                </span>
                                                                <span className="text-xs font-black text-[#00bfff] bg-[#00bfff]/10 border border-[#00bfff]/30 px-2 py-0.5 rounded-md">
                                                                    @{parseFloat(item.odd_value).toFixed(2)}
                                                                </span>
                                                            </div>

                                                            {explanation && (
                                                                <p className="text-[11px] text-slate-300 mt-2 leading-relaxed bg-[#1a1f24]/80 px-2.5 py-1.5 rounded-lg border border-[#3b4148]/70">
                                                                    {explanation}
                                                                </p>
                                                            )}
                                                        </div>

                                                        <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 shrink-0 sm:pl-4 sm:border-l border-[#3b4148]">
                                                            <div className="text-right">
                                                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1 sm:text-right">ውጤት (Result)</p>
                                                                <span className={`inline-block text-xs px-2.5 py-1 rounded-md font-black border ${
                                                                    trueScore !== '-:-'
                                                                        ? 'bg-black text-[#ffcc00] border-[#ffcc00]/50 shadow-sm'
                                                                        : 'bg-[#1a1f24] text-slate-400 border-[#3b4148]'
                                                                }`}>
                                                                    {trueScore}
                                                                </span>
                                                            </div>

                                                            <div className={`px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider flex items-center gap-1 border ${
                                                                isWon
                                                                    ? 'bg-[#00e700]/20 text-[#00e700] border-[#00e700]/50'
                                                                    : isLost
                                                                        ? 'bg-red-500/20 text-red-400 border-red-500/50'
                                                                        : isPostponed
                                                                            ? 'bg-[#ffcc00]/20 text-[#ffcc00] border-[#ffcc00]/50'
                                                                            : 'bg-orange-500/20 text-orange-400 border-orange-500/50'
                                                            }`}>
                                                                {isWon ? '✅ አሸንፏል (WON)' : isLost ? '❌ ተሸንፏል (LOST)' : isPostponed ? 'VOID (1.00)' : '⏳ PENDING'}
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        <div className="flex justify-between items-center bg-gradient-to-r from-[#1a1f24] to-[#24292e] p-5 rounded-xl border border-[#3b4148] shrink-0 shadow-sm">
                                            <div>
                                                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">የተወራረደው (Stake)</p>
                                                <p className="text-2xl font-black text-white">{payoutDetails.stake_amount} Br</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">የሚያሸንፈው ብር</p>
                                                <p className={`text-2xl font-black ${displayStatus === 'lost' || displayStatus === 'void' ? 'text-red-500 line-through' : 'text-[#00e700]'}`}>{actualPotentialWin.toFixed(2)} Br</p>
                                            </div>
                                        </div>

                                        <div className="shrink-0 mt-4">
                                            <button 
                                                onClick={handleConfirmPayout} 
                                                disabled={isPayingOut || displayStatus !== 'won'} 
                                                className={`w-full font-black py-4 rounded-xl text-lg transition active:scale-[0.98] tracking-widest flex justify-center items-center gap-2 shadow-md ${displayStatus === 'won' ? 'bg-[#00e700] hover:bg-green-500 text-black' : 'bg-[#3b4148] text-slate-500 cursor-not-allowed border border-[#555]'}`}
                                            >
                                                {isPayingOut ? '...' : displayStatus === 'paid' ? '✅ ተከፍሏል' : displayStatus === 'won' ? `ክፈል (${actualPotentialWin.toFixed(2)} Br)` : displayStatus === 'expired' ? '⏳ ጊዜው አልፏል (EXPIRED)' : 'ክፍያ የለም'}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'report' && (
                            <div className="bg-[#24292e] p-6 rounded-xl border border-[#3b4148] shadow-sm flex-1 animate-fade-in-down flex flex-col">
                                {!isReportUnlocked ? (
                                    <div className="py-20 max-w-sm mx-auto text-center flex-1 flex flex-col justify-center">
                                        <div className="w-20 h-20 bg-blue-500/10 text-blue-500 rounded-full flex items-center justify-center text-4xl mx-auto mb-6 border-2 border-blue-500/30 shadow-inner">🔒</div>
                                        <h2 className="text-2xl font-black text-white mb-2">ሪፖርትዎን ለመክፈት</h2>
                                        <p className="text-slate-400 text-sm font-bold mb-8">የግል የገንዘብ ሪፖርትዎን ለማየት መግቢያ ፓስወርድዎን ያስገቡ።</p>
                                        
                                        <form onSubmit={handleReportAuth} className="space-y-4 w-full">
                                            {reportError && <p className="text-red-400 text-sm font-bold bg-red-500/10 p-3 rounded-lg border border-red-500/30">{reportError}</p>}
                                            <input 
                                                type="password" value={reportPassword} onChange={(e) => setReportPassword(e.target.value)} required
                                                placeholder="ፓስወርድ (Password)"
                                                className="w-full bg-[#1a1f24] border border-[#3b4148] text-white px-5 py-4 rounded-xl outline-none focus:border-blue-500 text-center tracking-widest text-lg font-black transition shadow-inner"
                                            />
                                            <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-4 rounded-xl transition active:scale-[0.98] text-sm uppercase tracking-widest shadow-md">
                                                ክፈት (Unlock)
                                            </button>
                                        </form>
                                    </div>
                                ) : (
                                    <div className="flex-1 flex flex-col">
                                        <div className="flex flex-wrap justify-between items-center gap-3 mb-4 pb-4 border-b border-[#3b4148] shrink-0">
                                            <div className="flex items-center gap-3">
                                                <h2 className="text-xl font-black text-white flex items-center gap-2"><span className="text-2xl">📈</span> የእኔ የገንዘብ ፍሰት እና የየቀኑ ሪፖርት</h2>
                                                <button
                                                    type="button"
                                                    onClick={() => { fetchCashierReport(); fetchRecentTickets(); }}
                                                    className="bg-[#1a1f24] hover:bg-[#2a3038] text-[#ffcc00] border border-[#3b4148] px-3 py-1.5 rounded-lg text-xs font-bold transition"
                                                >
                                                    🔄 አድስ
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => { setIsReportUnlocked(false); setReportPassword(''); }}
                                                    className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 px-3 py-1.5 rounded-lg text-xs font-bold transition"
                                                >
                                                    🔒 ቆልፍ
                                                </button>
                                            </div>
                                            <div className="flex bg-[#1a1f24] border border-[#3b4148] rounded-lg overflow-hidden p-1 shadow-inner">
                                                <button onClick={() => { setReportFilter('today'); setSelectedReportDate(getLocalTodayStr()); }} className={`px-4 py-2 text-xs font-black rounded-md transition uppercase tracking-widest ${reportFilter === 'today' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white hover:bg-[#2a3038]'}`}>ዛሬ</button>
                                                <button onClick={() => setReportFilter('week')} className={`px-4 py-2 text-xs font-black rounded-md transition uppercase tracking-widest ${reportFilter === 'week' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white hover:bg-[#2a3038]'}`}>ሳምንት</button>
                                                <button onClick={() => setReportFilter('month')} className={`px-4 py-2 text-xs font-black rounded-md transition uppercase tracking-widest ${reportFilter === 'month' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white hover:bg-[#2a3038]'}`}>ወር</button>
                                                <button onClick={() => setReportFilter('year')} className={`px-4 py-2 text-xs font-black rounded-md transition uppercase tracking-widest ${reportFilter === 'year' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white hover:bg-[#2a3038]'}`}>ዓመት</button>
                                            </div>
                                        </div>

                                        <div className="bg-[#1c2024] border border-[#3b4148] rounded-xl p-3.5 mb-5 flex flex-wrap items-center justify-between gap-3 shrink-0 shadow-inner">
                                            <div className="flex items-center gap-2.5">
                                                <span className="text-xl">📅</span>
                                                <div>
                                                    <h3 className="text-xs font-black text-white">የየቀኑ ሂሳብ መፈተሻ (ቀን ይምረጡ)</h3>
                                                    <p className="text-[10px] text-slate-400 font-bold">የፈለጉትን ቀን መርጠው የተቆረጡ፣ ያሸነፉ፣ የተሸነፉ እና የተከፈሉ ትኬቶችን ይመልከቱ።</p>
                                                </div>
                                            </div>
                                            <div className="flex flex-wrap items-center gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => shiftCashierReportDate(-1)}
                                                    className="bg-[#24292e] hover:bg-[#2f363d] text-slate-200 border border-[#3b4148] px-3 py-1.5 rounded-lg text-xs font-bold transition"
                                                >
                                                    ◀ ቀዳሚ ቀን
                                                </button>
                                                <div
                                                    onClick={openCashierDatePicker}
                                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border cursor-pointer transition ${
                                                        reportFilter === 'custom'
                                                            ? 'bg-blue-600/20 border-blue-400 text-white shadow-[0_0_12px_rgba(37,99,235,0.25)]'
                                                            : 'bg-[#24292e] border-[#3b4148] text-white hover:border-[#ffcc00]'
                                                    }`}
                                                >
                                                    <span className="text-sm select-none" title="ካላንደር ክፈት">📅 ካላንደር:</span>
                                                    <input
                                                        ref={reportDateInputRef}
                                                        type="date"
                                                        value={selectedReportDate}
                                                        onChange={(e) => {
                                                            if (e.target.value) {
                                                                setSelectedReportDate(e.target.value);
                                                                setReportFilter('custom');
                                                            }
                                                        }}
                                                        className="bg-transparent text-white text-xs font-black outline-none cursor-pointer [color-scheme:dark]"
                                                    />
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => shiftCashierReportDate(1)}
                                                    className="bg-[#24292e] hover:bg-[#2f363d] text-slate-200 border border-[#3b4148] px-3 py-1.5 rounded-lg text-xs font-bold transition"
                                                >
                                                    ቀጣይ ቀን ▶
                                                </button>
                                                {reportFilter === 'custom' && (
                                                    <span className="bg-blue-500/20 text-blue-300 border border-blue-500/40 px-2.5 py-1 rounded-md text-[11px] font-black">
                                                        📌 የተመረጠ ቀን: {selectedReportDate}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-4 shrink-0">
                                            <div className="bg-[#1c2024] border border-[#3b4148] p-4 rounded-xl shadow-sm">
                                                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">1. የተቆረጠ ትኬት</p>
                                                <p className="text-3xl font-black text-white">{effectiveCashierReport.total_tickets} <span className="text-xs font-bold text-slate-400">ትኬት</span></p>
                                                <p className="text-[10px] text-slate-400 mt-1 font-bold">
                                                    በሂደት ላይ: <span className="text-[#ffcc00]">{effectiveCashierReport.active_tickets_count || 0}</span> | የተሰረዘ: <span className="text-red-400">{effectiveCashierReport.void_tickets || 0}</span>
                                                </p>
                                            </div>
                                            <div className="bg-[#1c2024] border border-[#00e700]/40 p-4 rounded-xl shadow-sm">
                                                <p className="text-[11px] font-bold text-[#00e700] uppercase tracking-widest mb-1">2. ያሸነፈ ትኬት</p>
                                                <p className="text-3xl font-black text-[#00e700]">{effectiveCashierReport.won_tickets_count || 0} <span className="text-xs font-bold text-slate-400">ትኬት</span></p>
                                                <p className="text-[10px] text-slate-400 mt-1 font-bold">
                                                    የተከፈለ: <span className="text-blue-400">{effectiveCashierReport.paid_tickets_count || 0}</span> | ያልተከፈለ: <span className="text-orange-400">{effectiveCashierReport.unpaid_won_count ?? ((effectiveCashierReport.won_tickets_count || 0) - (effectiveCashierReport.paid_tickets_count || 0))}</span>
                                                </p>
                                            </div>
                                            <div className="bg-[#1c2024] border border-red-500/40 p-4 rounded-xl shadow-sm">
                                                <p className="text-[11px] font-bold text-red-400 uppercase tracking-widest mb-1">3. የተሸነፈ ትኬት</p>
                                                <p className="text-3xl font-black text-red-400">{effectiveCashierReport.lost_tickets_count || 0} <span className="text-xs font-bold text-slate-400">ትኬት</span></p>
                                                <p className="text-[10px] text-slate-400 mt-1 font-bold">ውድቅ የሆኑ / የተበሉ ትኬቶች</p>
                                            </div>
                                            <div className="bg-[#1c2024] border border-blue-500/40 p-4 rounded-xl shadow-sm">
                                                <p className="text-[11px] font-bold text-blue-400 uppercase tracking-widest mb-1">4. ለተጫዋች የተከፈለ ብር</p>
                                                <p className="text-3xl font-black text-blue-400">{Number(effectiveCashierReport.total_paid || 0).toLocaleString()} Br</p>
                                                <p className="text-[10px] text-slate-400 mt-1 font-bold">የተከፈሉ ትኬቶች: {effectiveCashierReport.paid_tickets_count || 0}</p>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 shrink-0 mb-5">
                                            <div className="bg-[#1c2024] border border-[#ffcc00]/40 p-4 rounded-xl relative overflow-hidden shadow-sm">
                                                <p className="text-[11px] font-bold text-[#ffcc00] uppercase tracking-widest mb-1">የትኬት ክፍያ (10 ብር)</p>
                                                <p className="text-2xl font-black text-[#ffcc00]">{(Number(effectiveCashierReport.total_tickets || 0) * 10).toLocaleString()} Br</p>
                                                <p className="text-[10px] text-slate-400 mt-1 font-bold">{effectiveCashierReport.total_tickets} ትኬት × 10 ብር</p>
                                            </div>
                                            <div className="bg-[#1c2024] border border-[#00e700]/40 p-4 rounded-xl shadow-sm">
                                                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">የውርርድ ገቢ (Stake)</p>
                                                <p className="text-2xl font-black text-[#00e700]">{Number(effectiveCashierReport.total_revenue || 0).toLocaleString()} Br</p>
                                                <p className="text-[10px] text-slate-300 mt-1 font-bold">
                                                    ከ10 ብር ጋር ጠቅላላ: <span className="text-white">{((Number(effectiveCashierReport.total_tickets || 0) * 10) + Number(effectiveCashierReport.total_revenue || 0)).toLocaleString()} Br</span>
                                                </p>
                                            </div>
                                            <div className="bg-gradient-to-br from-red-500/10 to-red-500/5 border border-red-500/30 p-4 rounded-xl flex items-center justify-between shadow-sm">
                                                <div>
                                                    <p className="text-xs font-black text-red-400 uppercase tracking-widest mb-1">ያልተከፈለ አሸናፊ (Won)</p>
                                                    <p className="text-[10px] font-bold text-red-300">ያሸነፉ ግን ገና ያልተከፈሉ</p>
                                                </div>
                                                <p className="text-xl font-black text-red-500">{Number(effectiveCashierReport.unpaid_winnings || 0).toLocaleString()} Br</p>
                                            </div>
                                            <div className="bg-gradient-to-br from-green-500/10 to-green-500/5 border border-green-500/30 p-4 rounded-xl flex items-center justify-between shadow-sm">
                                                <div>
                                                    <p className="text-xs font-black text-green-400 uppercase tracking-widest mb-1">በካዝና ያለ ቀሪ ብር</p>
                                                    <p className="text-[10px] font-bold text-green-300">(Stake + 10 ብር) - የተከፈለ</p>
                                                </div>
                                                <p className="text-xl font-black text-green-500">{((Number(effectiveCashierReport.total_tickets || 0) * 10) + Number(effectiveCashierReport.total_revenue || 0) - Number(effectiveCashierReport.total_paid || 0)).toLocaleString()} Br</p>
                                            </div>
                                        </div>

                                        <div className="bg-[#1c2024] border border-[#3b4148] rounded-xl overflow-hidden flex-1 flex flex-col">
                                            <div className="px-5 py-3.5 bg-[#1a1f24] border-b border-[#3b4148] flex flex-wrap justify-between items-center gap-2">
                                                <h3 className="text-sm font-black text-white">🧾 የተቆረጡ ትኬቶች እና የገንዘብ እንቅስቃሴ ዝርዝር</h3>
                                                <div className="flex flex-wrap gap-1.5">
                                                    <button onClick={() => setReportStatusTab('all')} className={`px-2.5 py-1 rounded text-[10px] font-black transition ${reportStatusTab === 'all' ? 'bg-[#ffcc00] text-black' : 'bg-[#24292e] text-slate-300 border border-[#3b4148]'}`}>
                                                        ሁሉም ({(effectiveCashierReport.tickets || []).length})
                                                    </button>
                                                    <button onClick={() => setReportStatusTab('won')} className={`px-2.5 py-1 rounded text-[10px] font-black transition ${reportStatusTab === 'won' ? 'bg-[#00e700] text-black' : 'bg-[#24292e] text-[#00e700] border border-[#00e700]/30'}`}>
                                                        🎉 ያሸነፉ ({(effectiveCashierReport.tickets || []).filter((t: any) => t.status === 'won' || t.status === 'paid').length})
                                                    </button>
                                                    <button onClick={() => setReportStatusTab('lost')} className={`px-2.5 py-1 rounded text-[10px] font-black transition ${reportStatusTab === 'lost' ? 'bg-red-500 text-white' : 'bg-[#24292e] text-red-400 border border-red-500/30'}`}>
                                                        ❌ የተሸነፉ ({(effectiveCashierReport.tickets || []).filter((t: any) => t.status === 'lost' || t.status === 'expired').length})
                                                    </button>
                                                    <button onClick={() => setReportStatusTab('paid')} className={`px-2.5 py-1 rounded text-[10px] font-black transition ${reportStatusTab === 'paid' ? 'bg-blue-500 text-white' : 'bg-[#24292e] text-blue-400 border border-blue-500/30'}`}>
                                                        ✅ የተከፈሉ ({(effectiveCashierReport.tickets || []).filter((t: any) => t.status === 'paid').length})
                                                    </button>
                                                    <button onClick={() => setReportStatusTab('active')} className={`px-2.5 py-1 rounded text-[10px] font-black transition ${reportStatusTab === 'active' ? 'bg-orange-500 text-black' : 'bg-[#24292e] text-orange-400 border border-orange-500/30'}`}>
                                                        ⏳ በሂደት ላይ ({(effectiveCashierReport.tickets || []).filter((t: any) => t.status === 'active' || t.status === 'pending').length})
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="overflow-x-auto max-h-[340px] overflow-y-auto custom-scrollbar">
                                                <table className="w-full text-left border-collapse">
                                                    <thead>
                                                        <tr className="bg-[#14181d] text-[10px] uppercase tracking-wider text-slate-400 sticky top-0">
                                                            <th className="px-4 py-3 font-black">ሰዓት / ቀን</th>
                                                            <th className="px-4 py-3 font-black">ትኬት ቁጥር</th>
                                                            <th className="px-4 py-3 font-black">Stake (+10 Br)</th>
                                                            <th className="px-4 py-3 font-black">ጠቅላላ ኦድ</th>
                                                            <th className="px-4 py-3 font-black">ሊበላ የሚችል (Win)</th>
                                                            <th className="px-4 py-3 font-black">ሁኔታ (Status)</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="text-xs divide-y divide-[#2a3038]">
                                                        {(() => {
                                                            const list = (effectiveCashierReport.tickets || []).filter((t: any) => {
                                                                if (reportStatusTab === 'won') return t.status === 'won' || t.status === 'paid';
                                                                if (reportStatusTab === 'lost') return t.status === 'lost' || t.status === 'expired';
                                                                if (reportStatusTab === 'paid') return t.status === 'paid';
                                                                if (reportStatusTab === 'active') return t.status === 'active' || t.status === 'pending';
                                                                return true;
                                                            });

                                                            if (list.length === 0) {
                                                                return (
                                                                    <tr>
                                                                        <td colSpan={6} className="text-center py-8 text-slate-500 font-bold">በዚህ የጊዜ ማጣሪያ የተቆረጠ ትኬት የለም</td>
                                                                    </tr>
                                                                );
                                                            }

                                                            return list.map((t: any, idx: number) => (
                                                                <tr
                                                                    key={idx}
                                                                    onClick={() => {
                                                                        setActiveTab('check');
                                                                        setPayoutTicket(t.ticket_number);
                                                                        fetchTicketDetailsForCheck(t.ticket_number);
                                                                    }}
                                                                    className="hover:bg-[#24292e] transition cursor-pointer"
                                                                >
                                                                    <td className="px-4 py-3 text-slate-400 font-medium">
                                                                        {new Date(t.created_at).toLocaleDateString([], { day: '2-digit', month: 'short' })}{' '}
                                                                        <span className="text-slate-300 font-bold">{new Date(t.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                                    </td>
                                                                    <td className="px-4 py-3 font-mono font-black text-[#ffcc00]">#{t.ticket_number}</td>
                                                                    <td className="px-4 py-3 font-bold text-white">
                                                                        {Number(t.stake_amount).toLocaleString()} Br{' '}
                                                                        {t.status !== 'void' && <span className="text-[10px] text-[#ffcc00]">(+10)</span>}
                                                                    </td>
                                                                    <td className="px-4 py-3 font-bold text-slate-300">{t.total_odds || '-'}</td>
                                                                    <td className="px-4 py-3 font-black text-[#00e700]">{computeTruePotentialWin(t).toLocaleString()} Br</td>
                                                                    <td className="px-4 py-3 font-black">
                                                                        {t.status === 'paid' ? (
                                                                            <span className="bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded text-[10px]">✅ ተከፍሏል (PAID)</span>
                                                                        ) : t.status === 'won' ? (
                                                                            <span className="bg-[#00e700]/20 text-[#00e700] px-2 py-0.5 rounded text-[10px]">🎉 አሸንፏል (WON)</span>
                                                                        ) : t.status === 'lost' ? (
                                                                            <span className="bg-red-500/20 text-red-400 px-2 py-0.5 rounded text-[10px]">❌ ተሸንፏል (LOST)</span>
                                                                        ) : t.status === 'void' ? (
                                                                            <span className="bg-slate-600/30 text-slate-400 px-2 py-0.5 rounded text-[10px]">🚫 ተሰርዟል (VOID)</span>
                                                                        ) : t.status === 'expired' ? (
                                                                            <span className="bg-red-500/20 text-red-400 px-2 py-0.5 rounded text-[10px]">⏳ EXPIRED</span>
                                                                        ) : (
                                                                            <span className="bg-[#ffcc00]/20 text-[#ffcc00] px-2 py-0.5 rounded text-[10px]">⏳ ACTIVE</span>
                                                                        )}
                                                                    </td>
                                                                </tr>
                                                            ));
                                                        })()}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </main>
                </div>
            </div>
            
            {/* 🌟 1. የPrint Preview እና የ80mm Thermal Printer ደረሰኝ (Compact & Paper-Saving Design) 🌟 */}
            {isPrintPreviewOpen && ticketData && (
                <div id="print-modal-wrapper" className="fixed inset-0 z-[120] flex flex-col items-center bg-black/80 overflow-y-auto animate-fade-in p-4 py-6 backdrop-blur-sm">
                    <div className="no-print w-full max-w-[320px] mb-2 flex justify-end shrink-0 sticky top-0 z-50">
                        <button 
                            onClick={() => setIsPrintPreviewOpen(false)} 
                            className="text-white text-[10px] font-black tracking-widest bg-black/60 backdrop-blur-md border border-white/10 hover:bg-red-500 hover:border-red-400 px-4 py-2 rounded-full transition-all flex items-center gap-1.5 shadow-[0_4px_12px_rgba(0,0,0,0.5)]"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"></path></svg>
                            CLOSE
                        </button>
                    </div>

                    {/* 🧾 የሚታተመው ትኬት (Compact 80mm Receipt — QR ከላይ ከ vibebet.et ፊት ለፊት፣ ያለ ባርኮድ) */}
                    <div id="printable-thermal-receipt" className="w-full max-w-[302px] bg-white text-black rounded-sm overflow-hidden px-2.5 py-1.5 shadow-2xl relative shrink-0 border border-gray-300 font-sans">
                        
                        {/* Header: vibebet.et መጀመሪያ በነበረው የሚያምር ዲዛይን በግራ + QR Code ፊት ለፊት በቀኝ */}
                        <div className="flex items-center justify-between border-b-[1.5px] border-black pb-1 mb-1">
                            <div className="flex flex-col">
                                <div className="flex items-center gap-1.5">
                                    <h1 className="text-[21px] font-black leading-none tracking-tight text-black">
                                        vibebet<span className="text-[#ffcc00]">.et</span>
                                    </h1>
                                    <span className="border-[1.5px] border-black rounded-full px-1 py-0.5 text-[7.5px] font-black leading-none text-black">21+</span>
                                </div>
                                <p className="text-[8px] font-extrabold tracking-[0.14em] uppercase text-black mt-0.5">
                                    OFFICIAL BETTING RECEIPT
                                </p>
                                <p className="text-[7.5px] font-bold text-gray-800 leading-none mt-0.5">
                                    DATE: {formatShortDateTime(ticketData.created_at || new Date().toISOString())}
                                </p>
                            </div>
                            <div className="border border-black p-0.5 bg-white shrink-0">
                                <QRCodeSVG value={qrTargetUrl} size={38} level="M" includeMargin={false} />
                            </div>
                        </div>

                        {/* Ticket & Booking Meta Bar (Compact Single Row) */}
                        <div className="flex justify-between items-center bg-gray-100 border border-black px-1.5 py-0.5 text-[9.5px] font-bold mb-1 leading-tight">
                            <span>TICKET: <strong className="font-mono font-black text-[10.5px]">{ticketData.ticket_number || 'PENDING'}</strong></span>
                            {ticketData.booking_code && ticketData.booking_code !== 'REBOOK' && (
                                <span>CODE: <strong className="font-mono font-black text-[10px]">{ticketData.booking_code}</strong></span>
                            )}
                        </div>

                        {/* Matches List (Ultra-Compact Spacing) */}
                        <div className="receipt-matches-scroll mb-1 max-h-[42vh] overflow-y-auto custom-scrollbar divide-y divide-dashed divide-black border-b-[1.5px] border-black">
                            {[...(ticketData.selections || [])]
                                .sort((a, b) => new Date(a.match_time || a.commence_time || 0).getTime() - new Date(b.match_time || b.commence_time || 0).getTime())
                                .map((item: any, idx: number) => {
                                    const fullLeagueText = formatLeagueDisplay(item, fixtures).replace(/^Football\s*\/\s*/i, '');
                                    const { marketText, pickText } = getFormattedMarket(item, fixtures);

                                    const mTime = formatMatchListDateTime(item.match_time || item.commence_time || new Date().toISOString());
                                    let teamStr = item.match_info || (item.home_team + ' - ' + item.away_team);
                                    teamStr = teamStr.replace(/\s+vs\.?\s+/gi, ' v ');

                                    return (
                                        <div key={idx} className="py-0.5 leading-tight">
                                            <div className="flex justify-between items-baseline gap-1">
                                                <span className="text-[10.5px] font-black text-black truncate">{idx + 1}. {teamStr}</span>
                                                <span className="text-[8.5px] font-bold text-black shrink-0">{mTime}</span>
                                            </div>
                                            <div className="flex justify-between items-center text-[9.5px] font-black text-black">
                                                <span className="truncate pr-1 text-[8.5px] font-bold text-gray-800 max-w-[42%]">{fullLeagueText}</span>
                                                <div className="flex items-center gap-1 shrink-0">
                                                    <span className="text-[9px] font-bold">{marketText}:</span>
                                                    <span className="underline font-black">{pickText}</span>
                                                    <span className="font-mono font-black bg-gray-100 border border-black px-1 rounded-sm text-[9.5px]">@{parseFloat(item.odd_value).toFixed(2)}</span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                        </div>

                        {/* Events & Total Odds Summary */}
                        <div className="flex justify-between items-center bg-black text-white px-2 py-0.5 text-[9.5px] font-black mb-1 leading-tight">
                            <span>EVENTS: {ticketData.selections?.length || 0}</span>
                            <span>TOTAL ODDS: {parseFloat(ticketData.total_odds || 0).toFixed(2)}</span>
                        </div>

                        {/* Financial Totals Box (Compact) */}
                        <div className="border-[1.5px] border-black px-2 py-1 mb-1 text-[9.5px] font-bold leading-snug">
                            <div className="flex justify-between">
                                <span>STAKE:</span>
                                <span className="font-black">{parseFloat(ticketData.stake_amount || 0).toFixed(2)} ETB</span>
                            </div>
                            <div className="flex justify-between">
                                <span>SERVICE FEE:</span>
                                <span className="font-black">10.00 ETB</span>
                            </div>
                            <div className="flex justify-between border-t border-dashed border-black pt-0.5 mt-0.5">
                                <span className="font-black">TOTAL PAID:</span>
                                <span className="font-black">{(parseFloat(ticketData.stake_amount || 0) + 10).toFixed(2)} ETB</span>
                            </div>
                            <div className="flex justify-between items-center border-t-[1.5px] border-black pt-0.5 mt-0.5 text-[11px] font-black">
                                <span>POTENTIAL WIN:</span>
                                <span className="text-[12px] font-black">{parseFloat(ticketData.potential_win || 0).toFixed(2)} ETB</span>
                            </div>
                        </div>

                        {/* Compact Footer Rules */}
                        <div className="text-[7.5px] font-bold text-center leading-tight text-black pt-0.5">
                            Valid for 3 Days | 90 Mins Only (No Extra Time / Penalties)
                        </div>
                    </div>

                    <div className="no-print w-full max-w-[320px] mt-3 shrink-0 flex gap-3 sticky bottom-4 z-50">
                        <button 
                            onClick={handleConfirmAndPrint} 
                            disabled={isPrinting || isLoading}
                            className="flex-1 bg-gradient-to-r from-[#00e700] to-[#00c800] text-black py-3.5 rounded-xl font-black hover:shadow-[0_0_20px_rgba(0,231,0,0.5)] transition-all transform active:scale-[0.98] uppercase tracking-[0.1em] flex justify-center items-center gap-2 text-[13px] border-t border-white/40 shadow-xl disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            {isPrinting || isLoading ? (
                                <span className="flex items-center gap-2">
                                    <svg className="animate-spin h-4 w-4 text-black" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                    እባክዎ ይጠብቁ...
                                </span>
                            ) : (
                                <>
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg>
                                    PRINT TICKET (F2)
                                </>
                            )}
                        </button>
                    </div>
                </div>
            )}

            {/* 🌟 2. ውጤት ማረጋገጫ (Check/Saved Ticket) Modal (Compact & QR on Header) */}
            {isBookingPreviewOpen && bookingCode && (
                <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/80 overflow-y-auto animate-fade-in p-4 py-6 backdrop-blur-sm">
                    <div className="w-full max-w-[320px] mb-2 flex justify-between items-center shrink-0 pt-2 sticky top-0 z-50">
                        <button onClick={() => setIsBookingPreviewOpen(false)} className="text-gray-800 hover:text-black flex items-center gap-1.5 font-bold text-xs px-3 py-1.5 bg-white rounded-lg border border-gray-200 shadow-sm transition-colors">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg> Back
                        </button>
                        <div className="flex gap-2">
                            <button onClick={handleSaveReceipt} className="text-gray-800 hover:text-[#e6b800] bg-white rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg> Save
                            </button>
                            <button onClick={handleShareBooking} className="text-black bg-[#ffcc00] hover:bg-[#e6b800] rounded-lg px-4 py-1.5 text-xs font-black flex items-center gap-1.5 shadow-sm transition-colors">
                                Share
                            </button>
                        </div>
                    </div>

                    <div ref={receiptRef} className="w-full max-w-[302px] bg-white text-black rounded-sm overflow-hidden px-2.5 py-2 shadow-2xl relative shrink-0 border border-gray-300 font-sans">
                        {/* Header: vibebet.et መጀመሪያ በነበረው የሚያምር ዲዛይን በግራ + QR Code ፊት ለፊት በቀኝ */}
                        <div className="flex justify-between items-center border-b-[1.5px] border-black pb-1 mb-1">
                            <div className="flex flex-col">
                                <h1 className="text-[21px] font-black leading-none tracking-tight text-black">
                                    vibebet<span className="text-[#ffcc00]">.et</span>
                                </h1>
                                <span className="text-[8px] font-bold mt-0.5 uppercase tracking-widest">TICKET RECEIPT</span>
                            </div>
                            <div className="border border-black p-0.5 bg-white shrink-0">
                                <QRCodeSVG value={bookingShareUrl} size={38} level="M" includeMargin={false} />
                            </div>
                        </div>

                        {/* Sub-header */}
                        <div className="border border-black flex justify-between items-center px-1.5 py-0.5 bg-gray-100 text-[9.5px] mb-1 font-bold">
                            <span className="font-black">CODE: #{bookingCode}</span>
                            <span className="text-gray-700 text-[8.5px]">{formatShortDateTime(new Date().toISOString())}</span>
                        </div>

                        {/* Matches List (Compact) */}
                        <div className="mb-1 divide-y divide-dashed divide-black border-b-[1.5px] border-black">
                            {betSlip.map((item: any, idx: number) => {
                                const fullLeagueText = formatLeagueDisplay(item, fixtures).replace(/^Football\s*\/\s*/i, '');
                                const { marketText, pickText } = getFormattedMarket(item, fixtures);

                                const mTime = formatMatchListDateTime(item.match_time || item.commence_time || new Date().toISOString());
                                let teamStr = item.match_info || (item.home_team + ' - ' + item.away_team);
                                teamStr = teamStr.replace(/\s+vs\.?\s+/gi, ' v ');

                                return (
                                    <div key={idx} className="py-0.5 leading-tight">
                                        <div className="flex justify-between items-baseline gap-1">
                                            <span className="text-[10.5px] font-black text-black truncate">{idx + 1}. {teamStr}</span>
                                            <span className="text-[8.5px] font-bold text-black shrink-0">{mTime}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-[9.5px] font-black text-black">
                                            <span className="truncate pr-1 text-[8.5px] font-bold text-gray-800 max-w-[42%]">{fullLeagueText}</span>
                                            <div className="flex items-center gap-1 shrink-0">
                                                <span className="text-[9px] font-bold">{marketText}:</span>
                                                <span className="underline font-black">{pickText}</span>
                                                <span className="font-mono font-black bg-gray-100 border border-black px-1 rounded-sm text-[9.5px]">@{parseFloat(item.odd_value).toFixed(2)}</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="border-[1.5px] border-black px-2 py-1 text-[9.5px] font-black bg-gray-50 leading-snug">
                            <div className="flex justify-between"><span>BET AMOUNT:</span><span>{safeStake.toFixed(2)} ETB</span></div>
                            <div className="flex justify-between items-center border-t border-black pt-0.5 mt-0.5 text-[11px]">
                                <span>POSSIBLE WIN:</span>
                                <span>{grossWin.toFixed(2)} ETB</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            
            <style jsx global>{`
                .custom-scrollbar::-webkit-scrollbar { width: 4px; height: 4px; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #3b4148; border-radius: 10px; }
                input[type=number]::-webkit-inner-spin-button, input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
                input[type=number] { -moz-appearance: textfield; }
                @keyframes fadeInDown { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
                .animate-fade-in-down { animation: fadeInDown 0.2s ease-out forwards; }
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                .animate-fade-in { animation: fadeIn 0.2s ease-out forwards; }

                /* 🖨️ 80mm Thermal Receipt Direct Print Rules */
                @media print {
                    @page {
                        size: 72mm auto;
                        margin: 0mm;
                    }
                    html, body {
                        background: #ffffff !important;
                        color: #000000 !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        width: 72mm !important;
                        height: fit-content !important;
                        min-height: 0 !important;
                        overflow: visible !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    .no-print {
                        display: none !important;
                    }
                    #print-modal-wrapper {
                        position: static !important;
                        background: transparent !important;
                        padding: 0 !important;
                        margin: 0 !important;
                        overflow: visible !important;
                        display: block !important;
                        height: fit-content !important;
                        min-height: 0 !important;
                    }
                    #printable-thermal-receipt {
                        width: 72mm !important;
                        max-width: 72mm !important;
                        height: fit-content !important;
                        margin: 0 !important;
                        padding: 1mm 1.5mm !important;
                        box-shadow: none !important;
                        border: none !important;
                    }
                    .receipt-matches-scroll {
                        max-height: none !important;
                        overflow: visible !important;
                    }
                }
            `}</style>
        </div>
    );
}