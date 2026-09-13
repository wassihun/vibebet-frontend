"use client";

import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { QRCodeSVG } from 'qrcode.react';

const MAX_STAKE = 10000;
const MAX_WIN = 10000;
const MIN_STAKE = 20;

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

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
                    height: 40,
                    displayValue: false,
                    margin: 0,
                    background: 'transparent',
                    lineColor
                });
            } catch (e) {}
        });
        return () => { cancelled = true; };
    }, [value, lineColor]);
    return <svg ref={svgRef} className={className} />;
}

const formatMatchDateTime = (iso: string) => {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    const datePart = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    const timePart = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    return `${datePart} ${timePart}`;
};

const formatShortDateTime = (iso: string) => {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

const formatMatchListDateTime = (iso: string) => {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear().toString().slice(-2)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
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
    const [isPrinting, setIsPrinting] = useState(false);
    
    const [isPrintPreviewOpen, setIsPrintPreviewOpen] = useState(false);

    const [recentTickets, setRecentTickets] = useState<any[]>([]);
    const [fixtures, setFixtures] = useState<any[]>([]);
    
    const [isReportUnlocked, setIsReportUnlocked] = useState(false);
    const [reportPassword, setReportPassword] = useState('');
    const [reportError, setReportError] = useState('');
    
    const [reportFilter, setReportFilter] = useState<'today' | 'week' | 'month' | 'year'>('today');
    const [cashierReport, setCashierReport] = useState<any>(null);

    const [isOnline, setIsOnline] = useState(true);

    const receiptRef = useRef<HTMLDivElement>(null);
    const [isBookingPreviewOpen, setIsBookingPreviewOpen] = useState<boolean>(false);
    const [bookingCode, setBookingCode] = useState<string | null>(null);
    const [codeCopied, setCodeCopied] = useState(false);

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
            axios.get(`${API_URL}/api/matches/list`)
                .then(res => {
                    if (res.data.success) {
                        setFixtures(res.data.data);
                    }
                })
                .catch((err: any) => console.error("Matches fetch error:", err.message));
        }
    }, [token]);

    useEffect(() => {
        if (token && activeTab === 'report' && isReportUnlocked) fetchCashierReport();
    }, [token, activeTab, reportFilter, isReportUnlocked]);

    useEffect(() => {
        const interceptorId = axios.interceptors.response.use(
            (response) => response,
            (error) => {
                if (error?.response?.status === 401) {
                    handleLogout();
                }
                return Promise.reject(error);
            }
        );
        return () => axios.interceptors.response.eject(interceptorId);
    }, []);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'F3') {
                e.preventDefault();
                setActiveTab('new'); setMessage(null); setTicketData(null); setSearchCode('');
            } else if (e.key === 'F2') {
                e.preventDefault();
                if (activeTab === 'new' && ticketData) {
                    if (!ticketData.ticket_number) {
                        if (!isLoading) handleConfirmTicket();
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
            const res = await axios.get(`${API_URL}/api/tickets/history`, { headers: { Authorization: `Bearer ${token}` } });
            if (res.data.success) setRecentTickets(res.data.data);
        } catch (err: any) { 
            console.error("History fetch error:", err.response?.data || err.message); 
        }
    };

    const fetchCashierReport = async () => {
        try {
            const res = await axios.get(`${API_URL}/api/tickets/cashier/report?filter=${reportFilter}`, { headers: { Authorization: `Bearer ${token}` } });
            if (res.data.success) setCashierReport(res.data.data);
        } catch (err: any) { 
            console.error("Report fetch error:", err.response?.data || err.message); 
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
        if (!cleanCode) return;
        setIsLoading(true); setMessage(null); setTicketData(null);
        try {
            const res = await axios.get(`${API_URL}/api/tickets/booking/${cleanCode}`, { headers: { Authorization: `Bearer ${token}` } });
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
            const res = await axios.get(`${API_URL}/api/tickets/check/${ticket_number.trim()}`, { headers: { Authorization: `Bearer ${token}` } });
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

    const handleQzPrint = async (ticketDetails: any) => {
        if (isPrinting) return;

        setIsPrinting(true);
        try {
            // @ts-ignore
            const qzModule = await import('qz-tray');
            const qz = qzModule.default || qzModule;

            qz.security.setCertificatePromise(function(resolve: any, reject: any) {
                resolve(`-----BEGIN CERTIFICATE-----
MIID9zCCAt+gAwIBAgIUHJrFToXi5GNox9w7d0q+G6QJdtMwDQYJKoZIhvcNAQEL
BQAwgYoxCzAJBgNVBAYTAkVUMQ8wDQYDVQQIDAZBbWhhcmExDzANBgNVBAcMBkVu
ZnJhejEQMA4GA1UECgwHQWZyb2JldDEOMAwGA1UECwwFTG9jYWwxEzARBgNVBAMM
CnZpYmViZXQuZXQxIjAgBgkqhkiG9w0BCQEWE2Fia293b3JrdUBnbWFpbC5jb20w
HhcNMjYwOTEyMTcxMTU1WhcNMzYwOTA5MTcxMTU1WjCBijELMAkGA1UEBhMCRVQx
DzANBgNVBAgMBkFtaGFyYTEPMA0GA1UEBwwGRW5mcmF6MRAwDgYDVQQKDAdBZnJv
YmV0MQ4wDAYDVQQLDAVMb2NhbDETMBEGA1UEAwwKdmliZWJldC5ldDEiMCAGCSqG
SIb3DQEJARYTYWJrb3dvcmt1QGdtYWlsLmNvbTCCASIwDQYJKoZIhvcNAQEBBQAD
ggEPADCCAQoCggEBALLpofDt1OsPNHFxxn61olx8PrDVhvs6tMEK3BGP9Ddg52uJ
YscD/SdiiVgdwMcAfWESejdMlbaK95fzaibM+RckltCnh6Tk8Ac5cFaBV6lupUlh
eIMzuyqG5SKMdy0Y8zSb4qqlIft26ZfQKlNX6vhTlGIPA0C2JKzATXm+kRB+ECia
5YqYWJ8yA8BFDcwGUZhqqgx8nMyubNUuRQTExAZad8sYdOMe8dhs6MXsd498yaMy
xf3apryX9IUVphJEG9TVwSpA/YiDGAE9vzSFKFI8HcyVDpG1bMZ41f1hmj0fNYv8
Gw98aBbAC6H1fdqpatRVjq1n8703taDQ1cHeAjcCAwEAAaNTMFEwHQYDVR0OBBYE
FKQcaumkzkCjHaAGDfPUpSLnDIpHMB8GA1UdIwQYMBaAFKQcaumkzkCjHaAGDfPU
pSLnDIpHMA8GA1UdEwEB/wQFMAMBAf8wDQYJKoZIhvcNAQELBQADggEBAFNSMohh
D4OFQW1Swa2RD4ICZmf/twsmJY6DqmFtBvxS0tUxOwsaDGyUJw+HST2AVmTLtwxn
lwy/gwphmCl7TpgRUCBmDmMo2NBpMKnWOo7WyoWMzfRBzxJ7TnTF/id6k+ymKPC3
m/EjcTPZP9g37lT3bpecMNc1iZveBnLht9py+vfN1DL7tQKvpwUTvlvjIClGj5mm
5p30nEr/mNEmaZ6/X4GWaW0vHHYMF0XbMLTmenu2DjJudBO8luh2Gf5YvgzkWYpI
KrbL8xPJO7DKfn/J+QZYYmoDVliVFTDmasY9qPm+vep7gGkdfQbiMeGrhp0WcuGr
aR4ucTpnYio6L8w=
-----END CERTIFICATE-----`);
            });

            qz.security.setSignaturePromise(function(toSign: string) {
                return function(resolve: any, reject: any) {
                    axios.post(`${API_URL}/api/qz/sign`, { request: toSign })
                        .then(res => resolve(res.data))
                        .catch(err => reject(err));
                };
            });

            if (!qz.websocket.isActive()) {
                await qz.websocket.connect();
            }

            const printerName = await qz.printers.getDefault();

            // 80mm thermal-printer friendly settings. Keep the payload monochrome and compact.
            const config = qz.configs.create(printerName, { encoding: 'UTF-8' });

            const ESC = '\x1B';
            const GS = '\x1D';
            const alignLeft = ESC + '\x61' + '\x00';
            const alignCenter = ESC + '\x61' + '\x01';
            const boldOn = ESC + '\x45' + '\x01';
            const boldOff = ESC + '\x45' + '\x00';
            const normalFont = ESC + '\x4D' + '\x00';
            const lineSpacing = ESC + '\x32';

            // 80mm / 48-column safe width. Use wrapping instead of losing match names.
            const COLS = 48;
            const repeatLine = (char = '-', count = COLS) => char.repeat(count);
            const clip = (value: any, max: number) => String(value ?? '').trim().slice(0, max);

            const padRow = (left: string, right: string, width = COLS) => {
                const l = String(left);
                const r = String(right);
                const space = Math.max(1, width - l.length - r.length);
                return l.slice(0, width - r.length - 1) + ' '.repeat(space) + r.slice(-r.length);
            };

            const wrapText = (value: string, width = COLS) => {
                const words = String(value || '').trim().split(/\s+/);
                const lines: string[] = [];
                let current = '';

                for (const word of words) {
                    if (!current) {
                        if (word.length <= width) current = word;
                        else {
                            for (let i = 0; i < word.length; i += width) {
                                lines.push(word.slice(i, i + width));
                            }
                        }
                    } else if ((current.length + 1 + word.length) <= width) {
                        current += ' ' + word;
                    } else {
                        lines.push(current);
                        current = word;
                    }
                }
                if (current) lines.push(current);
                return lines;
            };

            const currentDate = new Date();
            const printDate = formatShortDateTime(currentDate.toISOString());

            const ticketNumber = ticketDetails.ticket_number || 'PENDING';
            const booking = ticketDetails.booking_code && ticketDetails.booking_code !== 'REBOOK'
                ? ticketDetails.booking_code
                : 'REBOOK';
            const usernameText = username.toUpperCase();
            const stake = Number(ticketDetails.stake_amount || 0);
            const serviceFee = 10;
            const totalPaid = stake + serviceFee;
            const potentialWin = Number(ticketDetails.potential_win || 0);
            const totalOdds = Number(ticketDetails.total_odds || 0);
            const eventCount = Array.isArray(ticketDetails.selections) ? ticketDetails.selections.length : 0;

            const data: string[] = [];

            // Initialize printer with tight line spacing.
            data.push(ESC + '\x40');
            data.push(lineSpacing);
            data.push(normalFont);

            // Header: brand + ticket number. QR is small and kept on the same logical header block.
            data.push(alignCenter);
            data.push(boldOn + 'VIBEBET.ET' + boldOff + '\n');
            data.push(boldOn + 'SPORTS BETTING RECEIPT' + boldOff + '\n');

            if (booking !== 'REBOOK') {
                data.push(boldOn + booking + boldOff + '\n');

                const qrUrl = window.location.origin + '?booking=' + booking;
                const len = qrUrl.length + 3;
                const pL = String.fromCharCode(len % 256);
                const pH = String.fromCharCode(Math.floor(len / 256));

                // Store / print QR in compact module size 2.
                data.push('\x1D\x28\x6B\x04\x00\x31\x41\x32\x00');
                data.push('\x1D\x28\x6B\x03\x00\x31\x43\x02');
                data.push('\x1D\x28\x6B\x03\x00\x31\x45\x31');
                data.push('\x1D\x28\x6B' + pL + pH + '\x31\x50\x30' + qrUrl);
                data.push('\x1D\x28\x6B\x03\x00\x31\x51\x30\n');
            }

            data.push(alignLeft);
            data.push(repeatLine('=') + '\n');

            // Compact ticket metadata.
            data.push(boldOn + padRow('DATE', printDate) + boldOff + '\n');
            data.push(boldOn + padRow('TICKET', ticketNumber) + boldOff + '\n');
            data.push(boldOn + padRow('CASHIER', usernameText) + boldOff + '\n');
            data.push(repeatLine('-') + '\n');

            // Responsible-gambling notice, kept concise.
            data.push(alignCenter);
            data.push(boldOn + '21+ ONLY  |  T&Cs APPLY' + boldOff + '\n');
            data.push(alignLeft);
            data.push(repeatLine('-') + '\n');

            // Matches — preserve the API text and use compact, readable rows.
            ticketDetails.selections?.forEach((item: any, index: number) => {
                const rawOddName = String(item.odd_name ?? '').trim();
                let marketText = 'Match Result';
                let pickText = rawOddName || '-';

                if (rawOddName === '1' || rawOddName === 'X' || rawOddName === '2') {
                    pickText = rawOddName === '1' ? 'W1' : rawOddName === '2' ? 'W2' : 'DRAW';
                } else if (
                    rawOddName === 'Yes' || rawOddName === 'No' ||
                    /\bGG\b/i.test(rawOddName) || /\bNG\b/i.test(rawOddName)
                ) {
                    pickText = (rawOddName === 'Yes' || /\bGG\b/i.test(rawOddName)) ? 'YES' : 'NO';
                    marketText = 'BTTS';
                } else if (/\b(over|under)\b/i.test(rawOddName)) {
                    marketText = 'TOTAL GOALS';
                }

                // Prefer the backend's full match_info; only build from teams when it is absent.
                const teamStr = String(
                    item.match_info || [item.home_team, item.away_team].filter(Boolean).join(' - ') || 'Match'
                )
                    .replace(/\s+vs\.?\s+/gi, ' - ')
                    .replace(/\s+/g, ' ')
                    .trim();

                const mTime = formatMatchListDateTime(
                    item.match_time || item.commence_time || currentDate.toISOString()
                );
                const leagueText = String(item.league_name || 'Soccer').trim();
                const oddText = Number(item.odd_value || 0).toFixed(2);

                data.push(boldOn + `${String(index + 1).padStart(2, '0')}. ${teamStr}` + boldOff + '\n');

                // Keep league/date on one line when possible; otherwise wrap the league only.
                if (leagueText.length + mTime.length <= COLS - 1) {
                    data.push(padRow(leagueText, mTime) + '\n');
                } else {
                    wrapText(leagueText, COLS - mTime.length - 1).slice(0, 2).forEach((line: string, i: number, arr: string[]) => {
                        if (i === arr.length - 1) data.push(padRow(line, mTime) + '\n');
                        else data.push(line + '\n');
                    });
                }

                const marketPick = `${marketText}: ${pickText}`;
                data.push(boldOn + padRow(marketPick, `@${oddText}`) + boldOff + '\n');
                if (index < eventCount - 1) data.push(repeatLine('-') + '\n');
            });

            // Summary and payment — no duplicated "possible win / winning" row.
            data.push(boldOn + padRow(`EVENTS: ${eventCount}`, `TOTAL ODDS: ${totalOdds.toFixed(2)}`) + boldOff + '\n');
            data.push(repeatLine('=') + '\n');

            data.push(boldOn + padRow('STAKE', `${stake.toFixed(2)} ETB`) + boldOff + '\n');
            data.push(padRow('SERVICE FEE', `${serviceFee.toFixed(2)} ETB`) + '\n');
            data.push(boldOn + padRow('TOTAL PAID', `${totalPaid.toFixed(2)} ETB`) + boldOff + '\n');
            data.push(boldOn + padRow('POTENTIAL WIN', `${potentialWin.toFixed(2)} ETB`) + boldOff + '\n');
            data.push(repeatLine('=') + '\n');

            // Barcode: compact, still easy for scanners to read.
            if (booking !== 'REBOOK') {
                data.push(alignCenter);
                data.push('\x1D' + '\x68' + '\x30'); // 48 dots height
                data.push('\x1D' + '\x77' + '\x02'); // module width 2
                data.push('\x1D' + '\x6B' + '\x49' + String.fromCharCode(booking.length + 2) + '{B' + booking);
                data.push('\n' + boldOn + booking + boldOff + '\n');
            }

            data.push(alignCenter);
            data.push(boldOn + 'Cashier: ' + usernameText + boldOff + '\n');
            data.push('Valid winning tickets: 30 days\n');
            data.push('Soccer: 90 minutes. No extra time/penalties.\n');
            data.push(GS + '\x56' + '\x41' + '\x10');

            await qz.print(config, data);

            setTicketData(null);
            setSearchCode('');
            setIsPrintPreviewOpen(false);
            setMessage({ type: 'success', text: 'ትኬቱ በተሳካ ሁኔታ ታትሟል!' });
            fetchRecentTickets();

        } catch (error: any) {
            console.error("Print Error:", error.message || error);
            alert("QZ Tray አልተገኘም! እባክዎ ፕሪንተሩን እና QZ Tray ሶፍትዌር መከፈቱን ያረጋግጡ።");
        } finally {
            setIsPrinting(false);
        }
    };

    const handleConfirmTicket = async () => {
        if (isLoading) return; 
        const hasStarted = ticketData.selections.some((item: any) => item.commence_time && new Date(item.commence_time) < new Date());
        if (hasStarted) { alert("የጀመሩ ጨዋታዎች አሉ! እባክዎ ከትኬቱ ላይ ይቀንሱ።"); return; }

        const stakeVal = parseFloat(ticketData.stake_amount) || 0;
        const winVal = parseFloat(ticketData.potential_win) || 0;
        if (stakeVal < MIN_STAKE) { alert(`ዝቅተኛው የውርርድ መጠን ${MIN_STAKE} ብር ነው!`); return; }
        if (stakeVal > MAX_STAKE) { alert(`ከፍተኛው የውርርድ መጠን ${MAX_STAKE} ብር ነው!`); return; }
        if (winVal > MAX_WIN) { alert(`ከፍተኛው ማሸነፊያ ${MAX_WIN} ብር ነው! እባክዎ ውርርዱን ይቀንሱ።`); return; }

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
                const placeRes = await axios.post(`${API_URL}/api/tickets/place`, placePayload);
                const newBookingCode = placeRes.data.data.booking_code;
                
                const confirmPayload = { selections: cleanSelections, stake_amount: ticketData.stake_amount };
                res = await axios.post(`${API_URL}/api/tickets/booking/${newBookingCode}/confirm`, confirmPayload, { headers: { Authorization: `Bearer ${token}` } });
                
                if(res.data.success) {
                    res.data.data.booking_code = newBookingCode;
                }
            } else {
                const payload = { selections: ticketData.selections, stake_amount: ticketData.stake_amount };
                res = await axios.post(`${API_URL}/api/tickets/booking/${ticketData.booking_code}/confirm`, payload, { headers: { Authorization: `Bearer ${token}` } });
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
                
                setTicketData(finalTicket);
                setBookingCode(newBookingCode);
            }
        } catch (error: any) { alert(error.response?.data?.message || "ክፍያ ማረጋገጥ አልተቻለም"); } 
        finally { setIsLoading(false); }
    };

    const fetchTicketDetailsForCheck = async (code: string) => {
        const cleanCode = code.trim().toUpperCase(); 
        setIsPayingOut(true); setMessage(null);
        try {
            const res = await axios.get(`${API_URL}/api/tickets/check/${cleanCode}`, { headers: { Authorization: `Bearer ${token}` } });
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
        if (!payoutDetails || isPayingOut) return;
        setIsPayingOut(true);
        const tNum = payoutDetails.ticket_number || payoutDetails.booking_code;
        try {
            const res = await axios.post(`${API_URL}/api/tickets/payout`, 
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
            const res = await axios.post(`${API_URL}/api/tickets/void`, 
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
            const res = await axios.post(`${API_URL}/api/tickets/void`, 
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
            const res = await axios.post(`${API_URL}/api/auth/verify-password`, { 
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
            console.error('Could not save receipt image', e);
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

    const hasStartedGames = ticketData?.selections?.some((item: any) => item.commence_time && new Date(item.commence_time) < new Date());

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
    const totalOdds = ticketData?.total_odds || 0;
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
                                                            min={MIN_STAKE}
                                                            max={MAX_STAKE}
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

                                        {stakeError && (
                                            <div className="bg-red-100 text-red-600 p-2 rounded text-[10px] font-bold mb-2 flex items-center border border-red-200 shrink-0">
                                                <span>⚠️ {stakeError}</span>
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
                                                    onClick={handleConfirmTicket} 
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
                                                    
                                                    const icon = isWon ? (
                                                        <svg className="w-5 h-5 text-green-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                                                    ) : isLost ? (
                                                        <svg className="w-5 h-5 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
                                                    ) : (
                                                        <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" /></svg>
                                                    );
                                                    
                                                    const teams = (item.match_info || '').split(' vs ');
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
                                                                <div className="flex items-center gap-2 font-bold">
                                                                    <span className="text-blue-600 text-[11px]">{parseFloat(item.odd_value).toFixed(2)}</span>
                                                                    <span>{icon}</span>
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
                                ) : !cashierReport ? (
                                    <div className="flex-1 flex items-center justify-center">
                                        <p className="text-white font-bold animate-pulse text-lg">Loading report data...</p>
                                    </div>
                                ) : (
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
                                )}
                            </div>
                        )}
                    </main>
                </div>
            </div>
            
            {/* 🌟 1. Print Preview Modal (Matches Photo Exactly) 🌟 */}
            {isPrintPreviewOpen && ticketData && (
                <div className="fixed inset-0 z-[120] flex flex-col items-center justify-center bg-black/80 overflow-y-auto animate-fade-in p-4 backdrop-blur-sm">
                    <div className="w-full max-w-[340px] mb-3 flex justify-end shrink-0">
                        <button onClick={() => setIsPrintPreviewOpen(false)} className="text-white font-bold bg-red-500 px-4 py-2 rounded-lg hover:bg-red-600 transition shadow-md">✕ CLOSE</button>
                    </div>

                    <div className="w-full max-w-[340px] bg-white text-black rounded-sm overflow-hidden pb-2 shadow-2xl relative shrink-0 border border-gray-300 font-sans">
                        
                        {/* Header */}
                        <div className="flex justify-between items-center px-4 py-2">
                            <div className="flex items-center gap-2">
                                <h1 className="text-lg font-black leading-none tracking-tight">
                                    vibebet<span className="text-[#ffcc00]">.et</span>
                                </h1>
                                <span className="text-[9px] font-bold mt-1">SCAN & CHECK BET PENDING</span>
                            </div>
                            {ticketData.booking_code && ticketData.booking_code !== 'REBOOK' && (
                                <div className="w-10 h-10 border border-gray-200 p-0.5 rounded-sm">
                                    <QRCodeSVG value={bookingShareUrl} size={34} />
                                </div>
                            )}
                        </div>

                        {/* Info Box */}
                        <div className="border-y-2 border-black p-2 text-[11px] font-bold mx-3 mb-2">
                            <div className="flex justify-between mb-0.5"><span>DATE</span><span>{formatShortDateTime(new Date().toISOString())}</span></div>
                            <div className="flex justify-between mb-0.5"><span>TICKET</span><span>{ticketData.ticket_number || 'PENDING'}</span></div>
                            <div className="flex justify-between mb-0.5"><span>BET</span><span>{ticketData.booking_code === 'REBOOK' ? 'REBOOK' : ticketData.booking_code}</span></div>
                            <div className="flex justify-between"><span>USERNAME</span><span>{username.toUpperCase()}</span></div>
                        </div>

                        {/* 21+ Box */}
                        <div className="border border-black flex items-center p-1 mx-3 mb-1.5">
                            <div className="border-2 border-black rounded-full w-8 h-8 flex items-center justify-center font-black text-sm shrink-0">21+</div>
                            <div className="text-[10px] font-bold text-center w-full leading-tight">
                                UNDER 21 YEARS STRICTLY FORBIDDEN!<br/>T&Cs APPLY
                            </div>
                        </div>

                        {/* Matches List */}
                        <div className="px-3 mb-2 max-h-[40vh] overflow-y-auto custom-scrollbar">
                            {ticketData.selections?.map((item: any, idx: number) => {
                                let mTime = formatMatchListDateTime(item.match_time || item.commence_time || new Date().toISOString());
                                let teamStr = item.match_info || (item.home_team + ' - ' + item.away_team);
                                teamStr = teamStr.replace(' vs ', ' v ');

                                let pickText = item.odd_name;
                                let marketText = 'Match Result';
                                if (['1', 'X', '2'].includes(item.odd_name)) {
                                    pickText = item.odd_name === '1' ? 'W1' : item.odd_name === '2' ? 'W2' : item.odd_name === 'X' ? 'Draw' : item.odd_name;
                                } else if (['Yes', 'No'].includes(item.odd_name) || item.odd_name.includes('GG') || item.odd_name.includes('NG')) {
                                    pickText = (item.odd_name === 'Yes' || item.odd_name.includes('GG')) ? 'Yes' : 'No';
                                    marketText = 'Both Teams To Score';
                                } else if (item.odd_name.toLowerCase().includes('over') || item.odd_name.toLowerCase().includes('under')) {
                                    marketText = 'Total Goals';
                                }

                                let leagueText = 'Football / Soccer';
                                if (item.league_name) leagueText = 'Football / ' + item.league_name;

                                return (
                                    <div key={idx} className="border-b border-gray-300 py-1 last:border-b-0">
                                        <h3 className="text-[12px] font-black">{teamStr}</h3>
                                        <div className="flex justify-between items-center text-[10px] mb-0.5">
                                            <span>{leagueText}</span>
                                            <span>{mTime}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-[11px] font-bold">
                                            <span className="w-1/3 truncate">{marketText}</span>
                                            <span className="w-1/3 text-center">{pickText}</span>
                                            <span className="w-1/3 text-right">Q: {parseFloat(item.odd_value).toFixed(2)}</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Summary Box */}
                        <div className="border-y-2 border-black flex justify-between px-3 py-1 text-[11px] font-black mx-3 mb-1.5">
                            <span>NR EVENTS: {ticketData.selections?.length}</span>
                            <span>ODDS TOTAL: {parseFloat(ticketData.total_odds).toFixed(2)}</span>
                        </div>

                        {/* Financial Box */}
                        <div className="border-2 border-black p-2 mx-3 mb-2 text-[10px] font-black leading-tight">
                            <div className="flex justify-between"><span>STAKE</span><span>{parseFloat(ticketData.stake_amount).toFixed(2)} ETB</span></div>
                            <div className="flex justify-between"><span>SERVICE FEE</span><span>10.00 ETB</span></div>
                            <div className="flex justify-between border-t border-gray-300 mt-0.5 pt-0.5"><span>TOTAL PAID</span><span>{(parseFloat(ticketData.stake_amount || 0) + 10).toFixed(2)} ETB</span></div>
                            <div className="flex justify-between"><span>POTENTIAL WIN</span><span>{parseFloat(ticketData.potential_win).toFixed(2)} ETB</span></div>
                        </div>

                        {/* Barcode bottom */}
                        {ticketData.booking_code && ticketData.booking_code !== 'REBOOK' && (
                            <div className="mt-1 flex flex-col items-center">
                                <BarcodeSVG value={ticketData.booking_code} lineColor="#000000" className="h-10 w-[80%]" />
                                <span className="text-[10px] font-bold tracking-widest">{ticketData.booking_code}</span>
                            </div>
                        )}

                        <div className="text-[8px] font-bold text-center mt-1.5 leading-tight px-3">
                            Cashier Code: {username.toUpperCase()}<br/><br/>
                            All Win Tickets are ONLY valid for 3 Days | Soccer Betting is 90 Minutes and Doesn't include Extra Time or Penalties.
                        </div>
                    </div>

                    <div className="w-full max-w-[340px] mt-4 shrink-0 flex gap-3">
                        <button 
                            onClick={() => { 
                                setIsPrintPreviewOpen(false);
                                handleQzPrint(ticketData); 
                            }} 
                            disabled={isPrinting}
                            className="flex-1 bg-[#00e700] text-black py-3.5 rounded-xl font-black hover:bg-green-500 transition shadow-lg uppercase tracking-widest"
                        >
                            {isPrinting ? '...' : '🖨️ PRINT TICKET'}
                        </button>
                    </div>
                </div>
            )}

            {/* 🌟 2. Check Ticket Modal (Matches Photo Exactly) 🌟 */}
            {isBookingPreviewOpen && bookingCode && (
                <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/80 overflow-y-auto animate-fade-in p-4 backdrop-blur-sm">
                    <div className="w-full max-w-[340px] mb-3 flex justify-between items-center shrink-0 pt-2">
                        <button onClick={() => setIsBookingPreviewOpen(false)} className="text-gray-800 hover:text-black flex items-center gap-1.5 font-bold text-xs px-3 py-2 bg-white rounded-lg border border-gray-200 shadow-sm transition-colors">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg> Back
                        </button>
                        <div className="flex gap-2">
                            <button onClick={handleSaveReceipt} className="text-gray-800 hover:text-[#e6b800] bg-white rounded-lg border border-gray-200 px-3 py-2 text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg> Save
                            </button>
                            <button onClick={handleShareBooking} className="text-black bg-[#ffcc00] hover:bg-[#e6b800] rounded-lg px-4 py-2 text-xs font-black flex items-center gap-1.5 shadow-sm transition-colors">
                                Share
                            </button>
                        </div>
                    </div>

                    <div ref={receiptRef} className="w-full max-w-[340px] bg-white text-black rounded-sm overflow-hidden pb-4 shadow-2xl relative shrink-0 border border-gray-300 font-sans">
                        
                        {/* Header */}
                        <div className="flex justify-between items-center px-4 py-3">
                            <div className="flex flex-col">
                                <h1 className="text-xl font-black leading-none tracking-tight">
                                    vibebet<span className="text-[#ffcc00]">.et</span>
                                </h1>
                                <span className="text-[9px] font-bold mt-1 uppercase tracking-widest">TICKET RECEIPT</span>
                            </div>
                            <div className="w-10 h-10 border border-gray-200 p-0.5 rounded-sm">
                                <QRCodeSVG value={bookingShareUrl} size={34} />
                            </div>
                        </div>

                        {/* Sub-header */}
                        <div className="border-y-2 border-black flex justify-between items-center px-3 py-1.5 bg-gray-50 text-[10px] mx-3 mb-2 font-bold">
                            <div className="flex items-center gap-1 text-[#e6b800] font-black">
                                <span className="text-[6px]">●</span> BOOKED
                            </div>
                            <div className="text-black font-black tracking-widest text-[12px]">
                                #{bookingCode}
                            </div>
                            <div className="text-gray-600">
                                {formatShortDateTime(new Date().toISOString())}
                            </div>
                        </div>

                        {/* Matches List */}
                        <div className="px-3 mb-2">
                            {betSlip.map((item: any, idx: number) => {
                                let marketText = 'Match Result';
                                let pickText = item.odd_name;
                                if (['1', 'X', '2'].includes(item.odd_name)) {
                                    pickText = item.odd_name === '1' ? 'W1' : item.odd_name === '2' ? 'W2' : item.odd_name === 'X' ? 'Draw' : item.odd_name;
                                } else if (['Yes', 'No'].includes(item.odd_name) || item.odd_name.includes('GG') || item.odd_name.includes('NG')) {
                                    pickText = (item.odd_name === 'Yes' || item.odd_name.includes('GG')) ? 'Yes' : 'No';
                                    marketText = 'Both Teams To Score';
                                } else if (item.odd_name.toLowerCase().includes('over') || item.odd_name.toLowerCase().includes('under')) {
                                    marketText = 'Total Goals';
                                }

                                let teamStr = item.match_info || (item.home_team + ' - ' + item.away_team);
                                teamStr = teamStr.replace(' vs ', ' - ');

                                return (
                                    <div key={idx} className="border-b border-gray-300 py-1.5 last:border-0">
                                        <p className="text-[9px] text-gray-500 font-bold mb-0.5">{formatMatchListDateTime(item.match_time)}</p>
                                        <div className="flex justify-between items-start mb-0.5">
                                            <div className="flex items-start gap-1 flex-1 pr-2">
                                                <span className="text-gray-400 text-[11px] leading-tight">⚽</span>
                                                <h3 className="text-[11px] font-black text-black leading-tight">{teamStr}</h3>
                                            </div>
                                            <span className="text-[12px] font-black text-black shrink-0">{parseFloat(item.odd_value).toFixed(2)}</span>
                                        </div>
                                        <div className="flex justify-between items-center pl-[18px]">
                                            <span className="text-[9px] text-gray-600 font-bold">{marketText}</span>
                                            <span className="text-[10px] font-black text-black text-right">{pickText}</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Footer summary */}
                        <div className="border border-black p-2 text-[10px] font-black mx-3 mb-2 bg-gray-50">
                            <div className="flex justify-between mb-0.5"><span>BET AMOUNT</span><span>{safeStake.toFixed(2)} ETB</span></div>
                            <div className="flex justify-between mb-1"><span>POSSIBLE WIN</span><span>{grossWin.toFixed(2)} ETB</span></div>
                            <div className="flex justify-between items-center mt-1 border-t border-gray-300 pt-1.5">
                                <span className="text-[11px]">WINNING</span>
                                <span className="text-[11px]">{grossWin.toFixed(2)} ETB</span>
                            </div>
                        </div>

                        {/* Barcode bottom */}
                        <div className="mt-3 flex flex-col items-center">
                            <BarcodeSVG value={bookingCode!} lineColor="#000000" className="h-10 w-[80%]" />
                            <span className="text-[9px] text-black font-bold mt-0.5 tracking-widest">{bookingCode}</span>
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
