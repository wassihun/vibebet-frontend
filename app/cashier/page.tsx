"use client";

import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import AuthModal from '../components/AuthModal';

const MAX_STAKE = 10000;
const MAX_WIN = 10000;
const MIN_STAKE = 20; 

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

    const [recentTickets, setRecentTickets] = useState<any[]>([]);
    const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
    const [receiptHtml, setReceiptHtml] = useState<string>(''); 
    
    const [cancelTimer, setCancelTimer] = useState<number | null>(null);

    const [fixtures, setFixtures] = useState<any[]>([]);
    
    const [isReportUnlocked, setIsReportUnlocked] = useState(false);
    const [reportPassword, setReportPassword] = useState('');
    const [reportError, setReportError] = useState('');
    
    const [reportFilter, setReportFilter] = useState<'today' | 'week' | 'month' | 'year'>('today');
    const [cashierReport, setCashierReport] = useState<any>(null);

    const [isOnline, setIsOnline] = useState(true);

    let displayStatus = payoutDetails?.status;
    const allItemsWon = payoutDetails?.selections?.length > 0 && payoutDetails.selections.every((item: any) => item.match_status === 'won');
    const anyItemLost = payoutDetails?.selections?.some((item: any) => item.match_status === 'lost');
    
    if (displayStatus === 'active') {
        if (anyItemLost) displayStatus = 'lost';
        else if (allItemsWon) displayStatus = 'won';
    }

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
            setToken(savedToken);
            setUsername(savedUsername);
        }
    }, []);

    useEffect(() => {
        if (token) {
            fetchRecentTickets();
            axios.get(`${process.env.NEXT_PUBLIC_API_URL}/api/matches/list`)
                .then(res => {
                    if (res.data.success) {
                        setFixtures(res.data.data);
                    }
                })
                .catch(err => console.error("Matches fetch error:", err));
        }
    }, [token]);

    useEffect(() => {
        if (token && activeTab === 'report' && isReportUnlocked) fetchCashierReport();
    }, [token, activeTab, reportFilter, isReportUnlocked]);

    useEffect(() => {
        let timerId: NodeJS.Timeout;
        if (cancelTimer !== null && cancelTimer > 0) {
            timerId = setInterval(() => {
                setCancelTimer(prev => prev! - 1);
            }, 1000);
        } else if (cancelTimer === 0) {
            setIsPrintModalOpen(false);
            setTicketData(null);
            setSearchCode('');
            setCancelTimer(null);
        }
        return () => clearInterval(timerId);
    }, [cancelTimer]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'F3') {
                e.preventDefault();
                setActiveTab('new'); setMessage(null); setTicketData(null); setSearchCode(''); setCancelTimer(null);
            } else if (e.key === 'F2') {
                e.preventDefault();
                if (activeTab === 'new' && ticketData && !isPrintModalOpen) {
                    if (!ticketData.ticket_number) {
                        handleConfirmTicket(); // ገና ካልተቆረጠ አረጋግጥ
                    } else {
                        handleCustomPrint(ticketData); // ከተቆረጠ ፕሪንት አድርግ
                    }
                } else if (activeTab === 'check' && payoutDetails) {
                    if (displayStatus === 'won') {
                        handleConfirmPayout();
                    }
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [activeTab, ticketData, isPrintModalOpen, payoutDetails, displayStatus]);

    const getLeagueDetails = (key: string) => {
        if (!key) return { name: "Soccer" };
        const mapped: Record<string, string> = {
            'soccer_epl': 'Premier League', 'soccer_efl_champ': 'Championship', 'soccer_spain_la_liga': 'LaLiga',
            'soccer_italy_serie_a': 'Serie A', 'soccer_germany_bundesliga': 'Bundesliga', 'soccer_france_ligue_one': 'Ligue 1',
            'soccer_uefa_champs_league': 'Champions League', 'soccer_uefa_europa_league': 'Europa League',
            'soccer_saudi_professional_league': 'Pro League', 'soccer_saudi_arabia_pro_league': 'Pro League',
            'soccer_spl': 'Premiership', 'soccer_brazil_campeonato': 'Serie A'
        };
        if (mapped[key]) return { name: mapped[key] };
        const parts = key.replace('soccer_', '').split('_');
        let leagueName = parts.slice(1).join(' ').replace(/\b\w/g, l => l.toUpperCase());
        return { name: leagueName || "Soccer" };
    };

    const fetchRecentTickets = async () => {
        try {
            const res = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/api/tickets/history`, { headers: { Authorization: `Bearer ${token}` } });
            if (res.data.success) setRecentTickets(res.data.data);
        } catch (err) { console.error("History fetch error"); }
    };

    const fetchCashierReport = async () => {
        try {
            const res = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/api/tickets/cashier/report?filter=${reportFilter}`, { headers: { Authorization: `Bearer ${token}` } });
            if (res.data.success) setCashierReport(res.data.data);
        } catch (err) { console.error("Report fetch error"); }
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoginError('');
        setIsLoggingIn(true);
        try {
            const res = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/login`, { username: username.trim(), password });
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
        if (!cleanCode) return;
        setIsLoading(true); setMessage(null); setTicketData(null); setCancelTimer(null);
        try {
            const res = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/api/tickets/booking/${cleanCode}`, { headers: { Authorization: `Bearer ${token}` } });
            if (res.data.success) setTicketData(res.data.data);
        } catch (error: any) {
            setMessage({ type: 'error', text: error.response?.data?.message || "የተሳሳተ ኮድ ነው" });
        } finally { setIsLoading(false); }
    };

    const handleRebookTicket = async (ticket_number: string) => {
        setIsLoading(true); setMessage(null); setCancelTimer(null);
        try {
            const res = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/api/tickets/check/${ticket_number.trim()}`, { headers: { Authorization: `Bearer ${token}` } });
            if (res.data.success) {
                const data = res.data.data;
                if (data.status === 'void') {
                    setMessage({ type: 'error', text: 'ይህ ትኬት የተሰረዘ (Void) ስለሆነ Rebook አይደረግም' });
                    setIsLoading(false); return;
                }
                const originalSig = data.selections.map((s: any) => s.odd_id).sort().join('|');
                setTicketData({ ...data, ticket_number: null, booking_code: `REBOOK`, original_signature: originalSig });
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
        const newPotentialWin = (parseFloat(newTotalOdds) * parseFloat(ticketData.stake_amount)).toFixed(2);
        
        setTicketData({ 
            ...ticketData, 
            selections: updatedSelections, 
            total_odds: newTotalOdds, 
            potential_win: newPotentialWin,
            booking_code: 'REBOOK' 
        });
    };

    const handleStakeChange = (newStakeStr: string) => {
        const newStake = parseFloat(newStakeStr) || 0;
        const newPotentialWin = (parseFloat(ticketData.total_odds) * newStake).toFixed(2);
        setTicketData({ ...ticketData, stake_amount: newStake, potential_win: newPotentialWin });
    };

    const openPrintModal = () => { setIsPrintModalOpen(true); };

    // 🌟 አዲሱ እና ጥብቅ (Compact) የሆነው የፕሪንት ዲዛይን 🌟
    const handleCustomPrint = (ticketDetails: any) => {
        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <style>
                    @page { margin: 0; size: 72mm auto; }
                    body { 
                        margin: 0; 
                        padding: 0; 
                        font-family: Arial, Helvetica, sans-serif; 
                        color: #000; 
                        width: 72mm; 
                        background: #fff;
                        box-sizing: border-box;
                    }
                    * {
                        font-weight: 900 !important; 
                        font-size: 11px;
                        line-height: 1.1;
                        color: #000 !important;
                    }
                </style>
            </head>
            <body>
                <div style="text-align: center; margin-bottom: 2px;">
                    <h1 style="font-size: 18px; margin: 0;">VIBE BET</h1>
                    <div style="font-size: 9px; font-weight: normal !important;">SPORTS BETTING</div>
                    <div style="font-size: 9px; font-weight: normal !important;">${new Date().toLocaleString('en-GB')}</div>
                </div>
                
                <div style="border-top: 1px dashed #000; margin: 2px 0;"></div>
                <div style="display: flex; justify-content: space-between; font-size: 11px;"><span>TKT:</span><span>${ticketDetails.ticket_number || 'PENDING'}</span></div>
                <div style="display: flex; justify-content: space-between; font-size: 11px;"><span>BOOK:</span><span>${ticketDetails.booking_code === 'REBOOK' ? 'REBOOK' : ticketDetails.booking_code}</span></div>
                <div style="display: flex; justify-content: space-between; font-size: 11px;"><span>CASHIER:</span><span style="text-transform: uppercase;">${username}</span></div>
                
                <div style="border-top: 1px solid #000; margin: 3px 0;"></div>

                ${ticketDetails.selections.map((item: any, index: number) => {
                    const matchDetails = fixtures.find((f: any) => f.id === item.fixture_id);
                    let countryName = "World";
                    let leagueName = "Soccer";
                    let mTimeRaw = new Date();
                    
                    if (matchDetails) {
                        const parts = (matchDetails.sport_key || matchDetails.league)?.split('|');
                        if (parts && parts.length >= 2) {
                            countryName = parts[0];
                            leagueName = parts[1];
                        } else {
                            leagueName = matchDetails.sport_key || matchDetails.league;
                        }
                        mTimeRaw = new Date(matchDetails.commence_time || matchDetails.match_time);
                    } else if (item.match_time || item.commence_time) {
                        mTimeRaw = new Date(item.match_time || item.commence_time);
                        countryName = "";
                        leagueName = item.league_name || "Soccer";
                    }
                    
                    const cleanLeague = countryName ? \`\${countryName} - \${leagueName}\`.replace(/Soccer /gi, '').trim() : leagueName;
                    
                    const pad = (n: number) => n < 10 ? '0' + n : n;
                    const dStr = `${pad(mTimeRaw.getDate())}/${pad(mTimeRaw.getMonth() + 1)}/${String(mTimeRaw.getFullYear()).slice(-2)} ${pad(mTimeRaw.getHours())}:${pad(mTimeRaw.getMinutes())}`;
                    
                    let teamStr = item.match_info || (item.home_team + ' v ' + item.away_team);
                    teamStr = teamStr.replace(' vs ', ' v ');

                    let marketText = 'Match Result';
                    let pickText = item.odd_name;

                    if (['1', 'X', '2'].includes(item.odd_name)) {
                        marketText = 'Match Result';
                        pickText = item.odd_name === '1' ? 'W1' : item.odd_name === '2' ? 'W2' : item.odd_name === 'X' ? 'Draw' : item.odd_name;
                    } else if (['1X', '12', 'X2'].includes(item.odd_name)) {
                        marketText = 'Double Chance';
                    } else if (['Yes', 'No'].includes(item.odd_name) || item.odd_name.includes('GG') || item.odd_name.includes('NG')) {
                        marketText = 'Both Teams To Score';
                        pickText = (item.odd_name === 'Yes' || item.odd_name.includes('GG')) ? 'Yes' : 'No';
                    } else if (item.odd_name.toLowerCase().includes('over') || item.odd_name.toLowerCase().includes('under') || item.odd_name.includes('O/U')) {
                        marketText = 'Total Goals';
                        if(!pickText.includes('(')) {
                            pickText = pickText.replace(/Over /ig, 'Over (').replace(/Under /ig, 'Under (') + ')';
                            pickText = pickText.replace('))', ')'); 
                        }
                    } else {
                        marketText = 'Market';
                    }

                    return `
                    <div style="${index > 0 ? 'border-top: 1px solid #000;' : ''} padding: 1.5px 0; margin: 0;">
                        <div style="font-size: 11px !important; font-weight: 900 !important; text-align: left; line-height: 1.1;">${teamStr}</div>
                        <div style="display: flex; justify-content: space-between; font-size: 9.5px !important; line-height: 1.1; margin-top: 1px;">
                            <span style="font-weight: normal !important; text-transform: capitalize; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 65%;">${cleanLeague}</span>
                            <span style="font-weight: normal !important;">${dStr}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; font-size: 11px !important; font-weight: 900 !important; line-height: 1.1; margin-top: 1px;">
                            <span style="width: 45%; text-align: left; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${marketText}</span>
                            <span style="width: 35%; text-align: right; padding-right: 3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${pickText}</span>
                            <span style="width: 20%; text-align: right;">Q: ${parseFloat(item.odd_value).toFixed(2)}</span>
                        </div>
                    </div>
                    `;
                }).join('')}

                <div style="border: 1px solid #000; display: flex; justify-content: space-between; padding: 2px 4px; margin-top: 2px; align-items: center;">
                    <span style="font-size: 11px !important; font-weight: 900 !important;">NR EVENTS: ${ticketDetails.selections.length}</span>
                    <span style="font-size: 11px !important; font-weight: 900 !important;">ODDS TOTAL: ${ticketDetails.total_odds}</span>
                </div>

                <div style="display: flex; justify-content: space-between; margin-top: 3px; font-size: 12px;"><span>STAKE:</span><span>${parseFloat(ticketDetails.stake_amount).toFixed(2)} Br</span></div>
                <div style="display: flex; justify-content: space-between; font-size: 12px;"><span>FEE:</span><span>10.00 Br</span></div>
                
                <div style="display: flex; justify-content: space-between; border-top: 1px solid #000; margin-top: 2px; padding-top: 1px;">
                    <span style="font-size: 12px !important;">PAID:</span>
                    <span style="font-size: 12px !important;">${(parseFloat(ticketDetails.stake_amount) + 10).toFixed(2)} Br</span>
                </div>
                <div style="display: flex; justify-content: space-between; border-top: 1px solid #000; margin-top: 2px; padding-top: 1px;">
                    <span style="font-size: 14px !important; font-weight: 900 !important;">MAX WIN:</span>
                    <span style="font-size: 14px !important; font-weight: 900 !important;">${parseFloat(ticketDetails.potential_win).toFixed(2)} Br</span>
                </div>

                <div style="text-align: center; margin-top: 4px; border-top: 1px dashed #000; padding-top: 2px;">
                    <div style="font-size: 9px; font-weight: normal !important;">Thanks for playing!</div>
                    <div style="font-size: 9px; font-weight: normal !important;">Valid for 24 hrs</div>
                </div>
            </body>
            </html>
        `;

        setReceiptHtml(htmlContent);
        setIsPrintModalOpen(true);

        // Silent Print
        setTimeout(() => {
            const printFrame = document.getElementById('receipt-preview-frame') as HTMLIFrameElement;
            if (printFrame && printFrame.contentWindow) {
                printFrame.contentWindow.focus();
                printFrame.contentWindow.print();
                
                setTimeout(() => {
                    setIsPrintModalOpen(false);
                    setTicketData(null);
                    setSearchCode('');
                    fetchRecentTickets();
                }, 1000);
            }
        }, 1000);
    };

    // 🌟 አዲሱ አሰራር: Submit ብቻ ያደርጋል (አያትምም) 🌟
    const handleConfirmTicket = async () => {
        const hasStarted = ticketData.selections.some((item: any) => item.commence_time && new Date(item.commence_time) < new Date());
        if (hasStarted) { alert("የጀመሩ ጨዋታዎች አሉ! እባክዎ ከትኬቱ ላይ ይቀንሱ።"); return; }
        if (ticketData.booking_code === 'REBOOK') {
            const currentSig = ticketData.selections.map((s: any) => s.odd_id).sort().join('|');
            if (currentSig === ticketData.original_signature) {
                alert("🚫 ተመሳሳይ ትኬት ኮፒ ማድረግ አይቻልም! እባክዎ ቢያንስ አንዱን ጨዋታ ይቀንሱ (✕)።"); return;
            }
        }
        setIsLoading(true);
        try {
            let res;
            if (ticketData.booking_code === 'REBOOK') {
                const cleanSelections = ticketData.selections.map((s: any) => ({
                    fixture_id: s.fixture_id,
                    odd_id: s.odd_id,
                    odd_value: s.odd_value,
                    match_info: s.match_info || (s.home_team + ' vs ' + s.away_team),
                    odd_name: s.odd_name
                }));
                const placePayload = { stake_amount: ticketData.stake_amount, is_guest: true, selections: cleanSelections };
                const placeRes = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/api/tickets/place`, placePayload);
                const newBookingCode = placeRes.data.data.booking_code;
                
                const confirmPayload = { selections: cleanSelections, stake_amount: ticketData.stake_amount };
                res = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/api/tickets/booking/${newBookingCode}/confirm`, confirmPayload, { headers: { Authorization: `Bearer ${token}` } });
                
                if(res.data.success) {
                    res.data.data.booking_code = newBookingCode;
                }
            } else {
                const payload = { selections: ticketData.selections, stake_amount: ticketData.stake_amount };
                res = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/api/tickets/booking/${ticketData.booking_code}/confirm`, payload, { headers: { Authorization: `Bearer ${token}` } });
            }

            if (res.data.success) {
                const newBookingCode = res.data.data.booking_code || ticketData.booking_code;
                const finalTicket = { 
                    ...ticketData, 
                    ticket_number: res.data.data.ticket_number, 
                    booking_code: newBookingCode, 
                    status: 'active', 
                    created_at: new Date().toISOString() 
                };
                
                // ትኬት ተቆርጧል, Print በተን እንዲመጣ እናደርጋለን (handleCustomPrintን እዚህ አናስነሳም)
                setTicketData(finalTicket);
            }
        } catch (error: any) { alert(error.response?.data?.message || "ክፍያ ማረጋገጥ አልተቻለም"); } 
        finally { setIsLoading(false); }
    };

    const fetchTicketDetailsForCheck = async (code: string) => {
        const cleanCode = code.trim().toUpperCase(); 
        setIsPayingOut(true); setMessage(null);
        try {
            const res = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/api/tickets/check/${cleanCode}`, { headers: { Authorization: `Bearer ${token}` } });
            if (res.data.success) setPayoutDetails(res.data.data);
        } catch (err: any) {
            setMessage({ type: 'error', text: err.response?.data?.message || 'ትኬቱ አልተገኘም' });
            setPayoutDetails(null);
        } finally { setIsPayingOut(false); }
    };

    const checkTicketDetails = (e: React.FormEvent) => {
        e.preventDefault();
        const code = payoutTicket.trim();
        if (!/^\d{8}$/.test(code)) {
            setMessage({ type: 'error', text: 'እባክዎ 8 ዲጂት ያለው የትኬት ቁጥር ብቻ ያስገቡ! (ቡኪንግ ኮድ አይሰራም)' });
            setPayoutDetails(null);
            return;
        }
        fetchTicketDetailsForCheck(code);
    };

    const handleConfirmPayout = async () => {
        if (!payoutDetails) return;
        setIsPayingOut(true);
        const tNum = payoutDetails.ticket_number || payoutDetails.booking_code;
        try {
            const res = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/api/tickets/payout`, 
                { ticket_number: tNum }, { headers: { Authorization: `Bearer ${token}` } });
            setMessage({ type: 'success', text: `${res.data.message}! የተከፈለው: ${payoutDetails.potential_win} ብር` });
            setPayoutDetails(null); setPayoutTicket('');
        } catch (err: any) { setMessage({ type: 'error', text: err.response?.data?.message || 'ክፍያ መፈጸም አልተቻለም' }); } 
        finally { setIsPayingOut(false); }
    };

    const handleVoidTicket = async () => {
        if (!payoutDetails || !window.confirm("እርግጠኛ ነዎት ይህንን ትኬት መሰረዝ (Void ማድረግ) ይፈልጋሉ?")) return;
        const tNum = payoutDetails.ticket_number || payoutDetails.booking_code;
        try {
            const res = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/api/tickets/void`, 
                { ticket_number: tNum }, { headers: { Authorization: `Bearer ${token}` } });
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
            const res = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/api/tickets/void`, 
                { ticket_number: ticketNum }, { headers: { Authorization: `Bearer ${token}` } });
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
            const res = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/verify-password`, { 
                password: reportPassword 
            }, { headers: { Authorization: `Bearer ${token}` } });
            
            if (res.data.success) {
                setIsReportUnlocked(true); 
                setReportError('');
            } else {
                setReportError('የተሳሳተ ፓስወርድ ነው!');
            }
        } catch (err: any) {
            setReportError(err.response?.data?.message || 'የተሳሳተ ፓስወርድ ነው!');
        }
    };

    const isWithin5Minutes = (createdAt: string) => {
        const diff = new Date().getTime() - new Date(createdAt).getTime();
        return diff <= 5 * 60 * 1000;
    };

    const tenMinsAgo = new Date().getTime() - 10 * 60 * 1000;
    const validRecentTickets = recentTickets.filter(t => new Date(t.created_at).getTime() >= tenMinsAgo);

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

    const hasStartedGames = ticketData?.selections?.some((item: any) => item.commence_time && new Date(item.commence_time) < new Date());

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
                        <button onClick={() => {setActiveTab('report'); setMessage(null); setIsReportUnlocked(false); setReportPassword('');}} className={`px-4 py-2 font-black text-xs rounded-md transition ${activeTab === 'report' ? 'bg-blue-600 text-white shadow-sm' : 'text-black/70 hover:bg-black/5 hover:text-black'}`}>
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
                    
                    <aside className="w-[280px] bg-[#24292e] border border-[#3b4148] rounded-xl flex flex-col overflow-hidden shadow-sm shrink-0 h-[calc(100vh-90px)] sticky top-[75px]">
                        <div className="p-4 border-b border-[#3b4148] bg-[#1a1f24]">
                            <h3 className="font-black text-white flex items-center gap-2 text-xs uppercase tracking-widest">⏱ በቅርብ የተቆረጡ</h3>
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2.5 bg-[#1c2024]">
                            {validRecentTickets.length === 0 ? (
                                <p className="text-xs text-slate-500 text-center py-10 font-bold">ባለፉት 10 ደቂቃዎች ምንም ትኬት አልተቆረጠም</p>
                            ) : (
                                validRecentTickets.slice(0, 15).map((t, i) => (
                                    <div key={i} onClick={() => handleRebookTicket(t.ticket_number)} className={`bg-[#24292e] border ${t.status === 'void' ? 'border-red-500/30 opacity-60' : 'border-[#3b4148]'} p-3 rounded-lg hover:border-[#ffcc00] transition cursor-pointer group relative overflow-hidden shadow-sm`}>
                                        <div className="absolute inset-0 bg-gradient-to-r from-[#ffcc00]/5 to-transparent opacity-0 group-hover:opacity-100 transition"></div>
                                        <div className="flex justify-between items-center mb-1.5 relative z-10">
                                            <span className={`font-mono font-black text-[13px] ${t.status === 'void' ? 'line-through text-slate-500' : 'text-[#ffcc00]'}`}>{t.ticket_number}</span>
                                            <span className="text-[10px] font-bold text-slate-500">{new Date(t.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-[11px] relative z-10 font-bold">
                                            <span className="text-slate-400">Stake: <span className="text-white">{t.stake_amount}</span></span>
                                            {t.status === 'void' ? <span className="text-red-400">VOID</span> : (
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[#00e700]">Win: {t.potential_win}</span>
                                                    <button onClick={(e) => handleVoidRecentTicket(e, t.ticket_number)} className="bg-red-500/20 text-red-500 hover:bg-red-500 hover:text-white rounded px-1.5 py-0.5 transition-colors text-[10px]">
                                                        🗑️
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </aside>

                    <main className="flex-1 flex flex-col">
                        {message && (
                            <div className={`p-4 rounded-xl border font-bold text-sm flex items-center gap-2 mb-4 shadow-sm ${message.type === 'success' ? 'bg-[#00e700]/10 border-[#00e700]/30 text-[#00e700]' : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>
                                <span>{message.type === 'success' ? '✅' : '❌'}</span> {message.text}
                            </div>
                        )}

                        {activeTab === 'new' && (
                            <div className="bg-[#24292e] p-6 rounded-xl border border-[#3b4148] shadow-sm flex-1 flex flex-col">
                                <h2 className="text-xl font-black text-white mb-5 flex items-center gap-2"><span>🔍</span> ትኬት መቁረጫ</h2>
                                <form onSubmit={searchTicket} className="flex gap-3 mb-6 shrink-0">
                                    <input 
                                        type="text" value={searchCode} onChange={(e) => setSearchCode(e.target.value.trim().toUpperCase())}
                                        placeholder="የቡኪንግ ኮድ (ምሳሌ: 482915)" 
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
                                                            value={ticketData.stake_amount || ''} 
                                                            onChange={(e) => handleStakeChange(e.target.value)}
                                                            className="w-16 bg-transparent border-b border-dashed border-gray-400 text-black font-black text-sm outline-none text-center focus:border-solid transition-colors"
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

                                        <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 mb-2 space-y-1">
                                            {ticketData.selections?.map((item: any, idx: number) => {
                                                const now = new Date();
                                                const matchTime = item.commence_time ? new Date(item.commence_time) : null;
                                                const hasStarted = matchTime && matchTime < now;

                                                const matchDetails = fixtures.find((f: any) => f.id === item.fixture_id);
                                                let lName = "Soccer";
                                                let mTime = "";
                                                if (matchDetails) {
                                                    lName = getLeagueDetails(matchDetails.sport_key || matchDetails.league).name;
                                                    mTime = new Date(matchDetails.commence_time || matchDetails.match_time).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit' });
                                                } else if (item.match_time || item.commence_time) {
                                                    mTime = new Date(item.match_time || item.commence_time).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit' });
                                                    lName = item.league_name || "Soccer";
                                                }

                                                return (
                                                    <div key={idx} className={`p-1.5 rounded border flex justify-between items-center transition shadow-sm ${hasStarted && !ticketData.ticket_number ? 'bg-red-50 border-red-300' : 'bg-white border-gray-200 hover:bg-gray-50'}`}>
                                                        <div className="w-full flex-1">
                                                            <div className="flex justify-between items-center mb-0.5">
                                                                <span className="text-[9px] text-gray-500 font-bold uppercase tracking-wider truncate max-w-[70%]">{lName}</span>
                                                                <span className="text-[9px] text-gray-800 font-black shrink-0">{mTime}</span>
                                                            </div>
                                                            <div className="flex justify-between items-center">
                                                                <p className="font-bold text-[11px] text-black flex items-center gap-1">
                                                                    {item.match_info || item.home_team + ' vs ' + item.away_team}
                                                                    {hasStarted && !ticketData.ticket_number && <span className="text-[8px] text-white bg-red-500 px-1 rounded uppercase font-black animate-pulse">Started</span>}
                                                                </p>
                                                            </div>
                                                            <p className="text-[10px] text-gray-600 font-bold mt-0.5">Pick: <span className="text-black font-black">{item.odd_name}</span> <span className="text-gray-500">(@{item.odd_value})</span></p>
                                                        </div>
                                                        {!ticketData.ticket_number && (
                                                            <button onClick={() => handleRemoveGame(idx)} className="ml-2 shrink-0 w-6 h-6 rounded bg-gray-100 border border-gray-300 text-gray-500 hover:bg-red-500 hover:text-white hover:border-red-500 flex justify-center items-center font-black text-xs transition">✕</button>
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
                                            {/* 🌟 ማስተካከያ 1: Two-Step Submit & Print Flow 🌟 */}
                                            {!ticketData.ticket_number ? (
                                                <button 
                                                    onClick={handleConfirmTicket} 
                                                    disabled={isLoading}
                                                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:text-gray-200 text-white font-black py-2.5 rounded text-sm transition transform active:scale-[0.98] tracking-widest flex items-center justify-center gap-2 shadow-md"
                                                >
                                                    {isLoading ? '...' : `አረጋግጥ (CONFIRM)`} <span className="text-[10px] bg-black/20 px-1.5 py-0.5 rounded ml-1">F2</span>
                                                </button>
                                            ) : (
                                                <button 
                                                    onClick={() => handleCustomPrint(ticketData)} 
                                                    disabled={isLoading}
                                                    className="w-full bg-[#00e700] hover:bg-green-500 text-black font-black py-2.5 rounded text-sm transition transform active:scale-[0.98] tracking-widest flex items-center justify-center gap-2 shadow-md"
                                                >
                                                    🖨️ ፕሪንት (PRINT TICKET) <span className="text-[10px] bg-black/20 px-1.5 py-0.5 rounded ml-1">F2</span>
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
                                        placeholder="የቲኬት ቁጥር (8 ዲጂት ብቻ)" 
                                        maxLength={8}
                                        className="flex-1 bg-[#1a1f24] border border-[#3b4148] text-white px-5 py-3.5 rounded-xl outline-none focus:border-[#00e700] text-lg font-black uppercase tracking-widest transition shadow-inner"
                                    />
                                    <button type="submit" disabled={isPayingOut} className="bg-[#00e700] hover:bg-green-500 text-black font-black px-8 rounded-xl transition active:scale-95 text-sm flex items-center gap-2 shadow-sm">
                                        {isPayingOut ? '...' : 'ውጤት አሳይ'} <span className="text-[10px] opacity-60">(Enter)</span>
                                    </button>
                                </form>

                                {payoutDetails && (
                                    <div className="flex-1 flex flex-col bg-[#1c2024] border border-[#3b4148] rounded-xl p-5 animate-fade-in-down shadow-inner overflow-hidden max-w-3xl mx-auto w-full">
                                        <div className="flex justify-between items-end border-b border-[#3b4148] pb-4 mb-4 shrink-0">
                                            <div>
                                                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1">Ticket Number</p>
                                                <p className="text-2xl font-mono font-black text-[#ffcc00] tracking-widest bg-[#ffcc00]/10 px-3 py-1 rounded-md border border-[#ffcc00]/20 inline-block">{payoutDetails.ticket_number || payoutDetails.booking_code}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-2">ሁኔታ (Status)</p>
                                                <div className="flex items-center gap-3">
                                                    {displayStatus === 'active' && isWithin5Minutes(payoutDetails.created_at) && (
                                                        <button onClick={handleVoidTicket} className="bg-red-500 hover:bg-red-600 text-white font-bold px-3 py-1.5 text-xs rounded-md border border-red-700 transition shadow-sm">
                                                            🗑️ ትኬት ሰርዝ
                                                        </button>
                                                    )}

                                                    <div className={`px-4 py-1.5 rounded-md border shadow-sm ${displayStatus === 'won' ? 'bg-[#00e700]/10 border-[#00e700]/50 text-[#00e700]' : displayStatus === 'paid' ? 'bg-blue-500/10 border-blue-500/50 text-blue-400' : displayStatus === 'void' ? 'bg-slate-500/10 border-slate-500/50 text-slate-400' : displayStatus === 'expired' ? 'bg-red-500/10 border-red-500/50 text-red-500' : displayStatus === 'lost' ? 'bg-red-500/10 border-red-500/50 text-red-500' : 'bg-[#1a1f24] border-[#3b4148] text-slate-300'}`}>
                                                        <p className="text-sm font-black uppercase tracking-widest">
                                                            {displayStatus === 'won' ? '🎉 አሸንፏል' : displayStatus === 'paid' ? '✅ ተከፍሏል' : displayStatus === 'void' ? '🚫 ተሰርዟል' : displayStatus === 'expired' ? '⏳ EXPIRED' : displayStatus === 'lost' ? '❌ ተበልቷል' : '⏳ በመጠባበቅ'}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex-1 overflow-y-auto custom-scrollbar mb-4">
                                            <div className="bg-white border border-gray-300 rounded overflow-hidden shadow-sm">
                                                {payoutDetails.selections?.map((item: any, i: number) => {
                                                    const isWon = item.match_status === 'won'; 
                                                    const isLost = item.match_status === 'lost'; 
                                                    const icon = isWon ? '👍' : isLost ? '👎' : '🕒';
                                                    const iconColor = isWon ? 'text-green-600' : isLost ? 'text-red-600' : 'text-gray-500';
                                                    
                                                    const teams = item.match_info.split(' vs ');
                                                    const homeTeam = teams[0] || 'Home';
                                                    const awayTeam = teams[1] || 'Away';
                                                    
                                                    const score = item.score || (isWon || isLost ? 'FT' : '-:-');
                                                    const mTime = new Date(item.match_time || new Date()).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', hour: '2-digit', minute:'2-digit' }).replace(',', '');

                                                    return (
                                                        <div key={i} className="border-b-2 border-gray-300 last:border-b-0 p-2.5">
                                                            <div className="flex justify-between items-center text-[11px] font-black text-gray-800 uppercase">
                                                                <span>{homeTeam}</span>
                                                                <span className="font-normal text-[10px] text-gray-500">{mTime}</span>
                                                            </div>
                                                            <div className="flex justify-between items-center text-[11px] font-black text-gray-800 uppercase mt-0.5">
                                                                <span>{awayTeam}</span>
                                                                
                                                                <span className={`mx-2 text-[10px] px-2 py-0.5 rounded shrink-0 font-black border ${item.score && item.score !== '-:-' ? 'bg-[#ffcc00] text-black border-[#e6b800] shadow-sm' : 'bg-[#24292e] text-slate-400 border-[#3b4148]'}`}>
                                                                    {item.score && item.score !== '-:-' ? item.score : 'vs'}
                                                                </span>

                                                            </div>
                                                            <div className="flex justify-between items-center text-[10px] text-gray-600 mt-2">
                                                                <span>{item.odd_name && ['1','X','2'].includes(item.odd_name) ? `Match Result: ${item.odd_name}` : `Pick: ${item.odd_name}`}</span>
                                                                <div className="flex items-center gap-1.5 font-bold">
                                                                    <span className="text-blue-600 text-[11px]">{parseFloat(item.odd_value).toFixed(2)}</span>
                                                                    <span className={`text-sm ${iconColor}`}>{icon}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        <div className="flex justify-between items-center bg-gradient-to-r from-[#1a1f24] to-[#24292e] p-5 rounded-xl border border-[#3b4148] shrink-0 shadow-sm">
                                            <div>
                                                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">የተወራረደው (Stake)</p>
                                                <p className="text-2xl font-black text-white">{payoutDetails.stake_amount} Br</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">የሚያሸንፈው ብር</p>
                                                <p className={`text-2xl font-black ${displayStatus === 'lost' ? 'text-red-500 line-through' : 'text-[#00e700]'}`}>{payoutDetails.potential_win} Br</p>
                                            </div>
                                        </div>

                                        <div className="shrink-0 mt-4">
                                            <button 
                                                onClick={handleConfirmPayout} 
                                                disabled={isPayingOut || displayStatus !== 'won'} 
                                                className={`w-full font-black py-4 rounded-xl text-lg transition active:scale-[0.98] tracking-widest flex justify-center items-center gap-2 shadow-md ${displayStatus === 'won' ? 'bg-[#00e700] hover:bg-green-500 text-black' : 'bg-[#3b4148] text-slate-500 cursor-not-allowed border border-[#555]'}`}
                                            >
                                                {isPayingOut ? '...' : displayStatus === 'paid' ? '✅ ተከፍሏል' : displayStatus === 'won' ? `ክፈል (${payoutDetails.potential_win} Br)` : 'ክፍያ የለም'}
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
                                ) : cashierReport ? (
                                    <div className="flex-1 flex flex-col">
                                        <div className="flex justify-between items-center mb-6 pb-4 border-b border-[#3b4148] shrink-0">
                                            <h2 className="text-xl font-black text-white flex items-center gap-2"><span className="text-2xl">📈</span> የእኔ ሪፖርት</h2>
                                            <div className="flex bg-[#1a1f24] border border-[#3b4148] rounded-lg overflow-hidden p-1 shadow-inner">
                                                <button onClick={() => setReportFilter('today')} className={`px-5 py-2 text-xs font-black rounded-md transition uppercase tracking-widest ${reportFilter === 'today' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white hover:bg-[#2a3038]'}`}>ዛሬ</button>
                                                <button onClick={() => setReportFilter('week')} className={`px-5 py-2 text-xs font-black rounded-md transition uppercase tracking-widest ${reportFilter === 'week' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white hover:bg-[#2a3038]'}`}>ሳምንት</button>
                                                <button onClick={() => setReportFilter('month')} className={`px-5 py-2 text-xs font-black rounded-md transition uppercase tracking-widest ${reportFilter === 'month' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white hover:bg-[#2a3038]'}`}>ወር</button>
                                                <button onClick={() => setReportFilter('year')} className={`px-5 py-2 text-xs font-black rounded-md transition uppercase tracking-widest ${reportFilter === 'year' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white hover:bg-[#2a3038]'}`}>ዓመት</button>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-4 shrink-0">
                                            <div className="bg-[#1c2024] border border-[#3b4148] p-5 rounded-xl shadow-sm">
                                                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">የተቆረጠ ትኬት</p>
                                                <p className="text-3xl font-black text-white">{cashierReport.total_tickets}</p>
                                            </div>
                                            <div className="bg-[#1c2024] border border-[#ffcc00]/40 p-5 rounded-xl relative overflow-hidden shadow-[0_0_10px_rgba(255,204,0,0.05)]">
                                                <div className="absolute top-0 right-0 p-3 opacity-10 text-5xl">💰</div>
                                                <p className="text-[11px] font-bold text-[#ffcc00] uppercase tracking-widest mb-1.5 relative z-10">የትኬት ክፍያ (10 ብር)</p>
                                                <p className="text-3xl font-black text-[#ffcc00] relative z-10">{(cashierReport.total_tickets * 10).toLocaleString()} Br</p>
                                            </div>
                                            <div className="bg-[#1c2024] border border-[#00e700]/40 p-5 rounded-xl shadow-[0_0_10px_rgba(0,231,0,0.05)]">
                                                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">ጠቅላላ ገቢ (Stake)</p>
                                                <p className="text-3xl font-black text-[#00e700]">{Number(cashierReport.total_revenue).toLocaleString()} Br</p>
                                            </div>
                                            <div className="bg-[#1c2024] border border-red-500/40 p-5 rounded-xl shadow-[0_0_10px_rgba(239,68,68,0.05)]">
                                                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">የተከፈለ (Payout)</p>
                                                <p className="text-3xl font-black text-red-500">{Number(cashierReport.total_paid).toLocaleString()} Br</p>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 shrink-0 mt-auto">
                                            <div className="bg-gradient-to-br from-[#1a1f24] to-[#24292e] border border-[#3b4148] p-6 rounded-xl flex items-center justify-between shadow-md">
                                                <div>
                                                    <p className="text-sm font-black text-slate-300 uppercase tracking-widest mb-1">ንፁህ ትርፍ</p>
                                                    <p className="text-[11px] font-bold text-slate-500">ገቢ ሲቀነስ ወጪ</p>
                                                </div>
                                                <p className="text-3xl font-black text-[#00bfff]">{Number(cashierReport.net_profit).toLocaleString()} Br</p>
                                            </div>
                                            
                                            <div className="bg-gradient-to-br from-red-500/10 to-red-500/5 border border-red-500/30 p-6 rounded-xl flex items-center justify-between shadow-md">
                                                <div>
                                                    <p className="text-sm font-black text-red-400 uppercase tracking-widest mb-1">ያልተከፈለ ዕዳ</p>
                                                    <p className="text-[11px] font-bold text-red-300">በእርስዎ የተቆረጡ ያልተከፈሉ</p>
                                                </div>
                                                <p className="text-3xl font-black text-red-500">{Number(cashierReport.unpaid_winnings).toLocaleString()} Br</p>
                                            </div>

                                            <div className="bg-gradient-to-br from-green-500/10 to-green-500/5 border border-green-500/30 p-6 rounded-xl flex items-center justify-between shadow-md">
                                                <div>
                                                    <p className="text-sm font-black text-green-400 uppercase tracking-widest mb-1">ጠቅላላ ትርፍ</p>
                                                    <p className="text-[11px] font-bold text-green-300">ትኬት + ገቢ - የተከፈለ</p>
                                                </div>
                                                <p className="text-3xl font-black text-green-500">{((cashierReport.total_tickets * 10) + Number(cashierReport.total_revenue) - Number(cashierReport.total_paid)).toLocaleString()} Br</p>
                                            </div>
                                        </div>
                                    </div>
                                ) : null}
                            </div>
                        )}
                    </main>
                </div>
            </div>

            {/* 🌟 ፕሪንት ማረጋገጫ (Print Preview & Silent Auto-Print Modal) 🌟 */}
            {isPrintModalOpen && ticketData && (
                <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[100] flex justify-center items-center p-4 overflow-y-auto custom-scrollbar">
                    <div className="flex flex-col items-center w-[72mm] my-auto">
                        <div className="bg-white rounded shadow-2xl relative w-full mb-4 flex justify-center overflow-hidden" style={{ minHeight: '400px', maxHeight: '75vh' }}>
                            <iframe
                                id="receipt-preview-frame"
                                srcDoc={receiptHtml}
                                className="w-full h-full bg-white border-0"
                                style={{ height: '75vh' }}
                            />
                        </div>
                        <div className="bg-[#1c2024] border border-[#ffcc00]/50 p-4 rounded-xl shadow-lg w-[300px] text-center">
                            <div className="w-10 h-10 bg-[#ffcc00]/20 rounded-full flex items-center justify-center mb-2 mx-auto shadow-inner">
                                <span className="text-xl animate-spin">🖨️</span>
                            </div>
                            <h2 className="text-[#ffcc00] font-black text-sm mb-1">ወደ ፕሪንተር እየተላከ ነው...</h2>
                            <p className="text-slate-400 text-[10px] font-bold leading-tight mt-2 border-t border-[#3b4148] pt-2">ማሳሰቢያ፡ ያለ ዳያሎግ ቀጥታ (Silent) ፕሪንት ለማድረግ የ Chrome ብሮውዘርዎን '--kiosk-printing' ሞድ ያብሩ።</p>
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
