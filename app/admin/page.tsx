"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState, useEffect } from 'react';
import axios from 'axios';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

interface StaffMember {
    id: number;
    username: string;
    role: 'admin' | 'cashier' | 'user';
    created_at: string;
}

// 🛡️ የሴኪውሪቲ ማስተካከያ፡ ሁሉም የ axios ጥያቄዎች ቶከኑን በራሳቸው እንዲይዙ ማድረግ
axios.interceptors.request.use(
    config => {
        if (typeof window !== 'undefined') {
            const savedToken = localStorage.getItem('adminToken');
            if (savedToken && config.headers && !config.headers.Authorization) {
                config.headers.Authorization = `Bearer ${savedToken}`;
            }
        }
        return config;
    },
    error => Promise.reject(error)
);

export default function AdminDashboard() {
    const [token, setToken] = useState<string | null>(null);
    const [adminName, setAdminName] = useState('');
    const [loginUsername, setLoginUsername] = useState('');
    const [loginPassword, setLoginPassword] = useState('');
    const [loginError, setLoginError] = useState('');

    const [activeTab, setActiveTab] = useState<'dashboard' | 'staff' | 'settings' | 'reports' | 'tickets'>('dashboard');

    const [newUsername, setNewUsername] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [newRole, setNewRole] = useState('cashier');
    const [staffMsg, setStaffMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    const [staffList, setStaffList] = useState<StaffMember[]>([]);

    const [apiKeysList, setApiKeysList] = useState<string[]>([]);
    const [newApiKeyValue, setNewApiKeyValue] = useState('');

    const [apiMsg, setApiMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const [apiUsage, setApiUsage] = useState({ used: 0, remaining: 0 });

    const [isSyncing, setIsSyncing] = useState(false);
    const [totalMatches, setTotalMatches] = useState<number>(0);

    const getTodayIsoStr = () => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };

    const [reportFilter, setReportFilter] = useState<'today' | 'week' | 'month' | 'year' | 'date'>('today');
    const [selectedReportDate, setSelectedReportDate] = useState<string>(getTodayIsoStr);
    const [reportTicketStatusFilter, setReportTicketStatusFilter] = useState<'all' | 'won' | 'lost' | 'paid' | 'active'>('all');

    const [reports, setReports] = useState<any>({
        totalTickets: 0,
        voidTickets: 0,
        shopTicketsCount: 0,
        serviceFeeTotal: 0,
        totalRevenue: 0,
        grossCashIn: 0,
        totalPayout: 0,
        totalPaidOut: 0,
        totalUnpaidWon: 0,
        totalActiveRisk: 0,
        totalSavedFromLost: 0,
        netCashFlow: 0,
        netProfitAfterLiability: 0,
        winningTicketsCount: 0,
        paidTicketsCount: 0,
        unpaidWonCount: 0,
        lostTicketsCount: 0,
        activeTicketsCount: 0,
        activeOnlineUsers: 0,
        onlineStats: { tickets_sold: 0, winning_tickets_count: 0, revenue: 0, payout: 0 },
        cashierStats: [] as any[],
        winningTickets: [] as any[],
        periodTickets: [] as any[]
    });
    const [isFetchingReports, setIsFetchingReports] = useState(false);

    const [allTickets, setAllTickets] = useState<any[]>([]);
    const [isFetchingTickets, setIsFetchingTickets] = useState(false);
    const [ticketFilter, setTicketFilter] = useState<'all' | 'today' | 'won' | 'paid' | 'lost' | 'high_stake' | 'close_to_win'>('today');
    const [selectedManageTicket, setSelectedManageTicket] = useState<any | null>(null);

    const [expandedCashiers, setExpandedCashiers] = useState<string[]>([]);
    const toggleCashier = (cashierName: string) => {
        setExpandedCashiers(prev => prev.includes(cashierName) ? prev.filter(c => c !== cashierName) : [...prev, cashierName]);
    };

    const handleLogout = () => {
        setToken(null);
        setAdminName('');
        delete axios.defaults.headers.common['Authorization'];
        localStorage.removeItem('adminToken');
        localStorage.removeItem('adminUsername');
    };

    useEffect(() => {
        document.title = "vibebet.et - Admin";

        const savedToken = localStorage.getItem('adminToken');
        const savedUsername = localStorage.getItem('adminUsername');
        
        if (savedToken && savedUsername) {
            axios.defaults.headers.common['Authorization'] = `Bearer ${savedToken}`;
            // 🛡️ የሴኪውሪቲ ማስተካከያ 1፡ ዝም ብሎ ከማስገባት በፊት ቶከኑ ትክክለኛ መሆኑን ባክ-ኤንዱን ይጠይቃል (Fake Token Prevention)
            axios.get(`${API_BASE}/api/auth/verify`, {
                headers: { Authorization: `Bearer ${savedToken}` }
            }).then(res => {
                if (res.data.success && res.data.user.role === 'admin') {
                    setToken(savedToken);
                    setAdminName(savedUsername);
                } else {
                    handleLogout();
                }
            }).catch((err) => {
                if (err.response && (err.response.status === 401 || err.response.status === 403)) {
                    handleLogout();
                } else {
                    // የኔትወርክ መቆራረጥ ከሆነ ወዲያውኑ አያስወጣም
                    setToken(savedToken);
                    setAdminName(savedUsername);
                }
            });
        }
    }, []);

    useEffect(() => {
        if (!token) return;
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;

        if (activeTab === 'settings') {
            fetchApiKeys();
            axios.get(`${API_BASE}/api/matches/api-usage`, {
                headers: { Authorization: `Bearer ${token}` }
            }).then(res => {
                if (res.data.success) setApiUsage(res.data.data);
            }).catch(() => {});
        }

        if (activeTab === 'dashboard') {
            axios.get(`${API_BASE}/api/matches/list`, {
                headers: { Authorization: `Bearer ${token}` }
            }).then(res => {
                if (res.data.success) setTotalMatches(res.data.data.length);
            }).catch(() => setTotalMatches(0));
            fetchReports();
            fetchTickets();
        }

        if (activeTab === 'reports') {
            fetchReports();
            fetchTickets();
            fetchStaffList();
        }

        if (activeTab === 'staff') {
            fetchStaffList();
        }

        if (activeTab === 'tickets') {
            fetchTickets();
        }
    }, [token, activeTab, reportFilter, selectedReportDate]);

    async function fetchTickets() {
        setIsFetchingTickets(true);
        try {
            const res = await axios.get(`${API_BASE}/api/tickets/all`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data.success) {
                const list = res.data.data || [];
                setAllTickets(list);
                // ሁሉም የካሼር ቡድኖች ወዲያውኑ ተዘርግተው እንዲታዩ ማድረግ
                const cashiers = Array.from(new Set(list.map((t: any) => t.cashier || (t.role === 'user' ? 'ኦንላይን ተጫዋቾች (Online)' : 'ካሼር (Shop)')))).filter(Boolean) as string[];
                setExpandedCashiers(prev => prev.length > 0 ? Array.from(new Set([...prev, ...cashiers])) : cashiers);
            }
        } catch (err) {
            console.log("ትኬቶችን ማምጣት አልተቻለም (API ይዘገያል)");
        } finally {
            setIsFetchingTickets(false);
        }
    };

    function fetchApiKeys() {
        axios.get(`${API_BASE}/api/matches/get-api-key`, {
            headers: { Authorization: `Bearer ${token}` }
        }).then(res => {
            if (res.data.success && res.data.api_key) {
                const keysArray = res.data.api_key.split(',').map((k: string) => k.trim()).filter((k: string) => k.length > 0);
                setApiKeysList(keysArray);
            } else {
                setApiKeysList([]);
            }
        }).catch(() => setApiKeysList([]));
    };

    async function fetchReports() {
        setIsFetchingReports(true);
        try {
            const query = reportFilter === 'date'
                ? `filter=date&date=${encodeURIComponent(selectedReportDate)}`
                : `filter=${encodeURIComponent(reportFilter)}`;
            const res = await axios.get(`${API_BASE}/api/tickets/reports/summary?${query}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data.success && res.data.data) {
                setReports(res.data.data);
            }
        } catch (err) {
            console.log("ሪፖርት ማምጣት አልተቻለም (ከትኬት ዝርዝር በቀጥታ ይሰላል)");
        } finally {
            setIsFetchingReports(false);
        }
    };

    const shiftSelectedDate = (daysDelta: number) => {
        const base = selectedReportDate ? new Date(`${selectedReportDate}T12:00:00`) : new Date();
        base.setDate(base.getDate() + daysDelta);
        const nextIso = `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}-${String(base.getDate()).padStart(2, '0')}`;
        setSelectedReportDate(nextIso);
        setReportFilter('date');
    };

    async function fetchStaffList() {
        try {
            // 🌟 የሊንክ ማስተካከያ፡ ወደ ትክክለኛው /api/tickets/staff-list ተቀይሯል 🌟
            const res = await axios.get(`${API_BASE}/api/tickets/staff-list`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data.success) {
                setStaffList(res.data.data || []);
                if (staffMsg?.type === 'error') setStaffMsg(null); 
            }
        } catch (err) {
            console.log("ሰራተኞችን ማምጣት አልተቻለም (API ይዘገያል)");
            setStaffMsg({ type: 'error', text: 'የካሼሮች ዝርዝር ማምጣት አልተቻለም። የኔትወርክ ወይም የባክኤንድ ስህተት ሊሆን ይችላል።' });
        }
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoginError('');
        try {
            const res = await axios.post(`${API_BASE}/api/auth/login`, { username: loginUsername.trim(), password: loginPassword });
            if (res.data.success && res.data.user.role === 'admin') {
                axios.defaults.headers.common['Authorization'] = `Bearer ${res.data.token}`;
                localStorage.setItem('adminToken', res.data.token);
                localStorage.setItem('adminUsername', res.data.user.username);
                setToken(res.data.token);
                setAdminName(res.data.user.username);
            } else {
                setLoginError('ይህን ገጽ ለመጠቀም የአድሚን ፈቃድ ያስፈልጋል!');
            }
        } catch (err: any) {
            setLoginError(err.response?.data?.message || 'ሎጊን አልተሳካም');
        }
    };

    const handleRegisterStaff = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setStaffMsg(null);
        try {
            const res = await axios.post(`${API_BASE}/api/auth/register-staff`, 
                { username: newUsername, password: newPassword, role: newRole },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setStaffMsg({ type: 'success', text: res.data.message });
            setNewUsername('');
            setNewPassword('');
            fetchStaffList(); 
        } catch (err: any) {
            setStaffMsg({ type: 'error', text: err.response?.data?.message || 'ስህተት ተፈጥሯል' });
        } finally {
            setIsLoading(false);
        }
    };

    const saveKeysToBackend = async (keysArray: string[]) => {
        setIsLoading(true);
        setApiMsg(null);
        try {
            const keysStr = keysArray.join(',');
            await axios.post(`${API_BASE}/api/matches/update-api-key`, 
                { api_key: keysStr },
                { headers: { Authorization: `Bearer ${token}` } } 
            );
            setApiKeysList(keysArray);
            setApiMsg({ type: 'success', text: '✅ የ API Keys ዝርዝር በተሳካ ሁኔታ ተዘምኗል!' });
        } catch (err: any) {
            setApiMsg({ type: 'error', text: 'ስህተት ተፈጥሯል' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleAddKey = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newApiKeyValue.trim()) return;
        const updatedList = [...apiKeysList, newApiKeyValue.trim()];
        saveKeysToBackend(updatedList);
        setNewApiKeyValue('');
    };

    const handleDeleteKey = (indexToRemove: number) => {
        const updatedList = apiKeysList.filter((_, idx) => idx !== indexToRemove);
        saveKeysToBackend(updatedList);
    };

    const handleManualSync = async () => {
        setIsSyncing(true);
        setApiMsg({ type: 'success', text: '⏳ አዳዲስ ጨዋታዎችን ከ API በማምጣት ላይ... እባክዎ ትንሽ ይጠብቁ' });
        try {
            const res = await axios.post(`${API_BASE}/api/matches/manual-sync`, 
                {}, 
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setApiMsg({ type: 'success', text: res.data.message });

            axios.get(`${API_BASE}/api/matches/list`, {
                headers: { Authorization: `Bearer ${token}` }
            }).then(r => {
                if (r.data.success) setTotalMatches(r.data.data.length);
            }).catch(() => {});
            axios.get(`${API_BASE}/api/matches/api-usage`, {
                headers: { Authorization: `Bearer ${token}` }
            }).then(r => {
                if (r.data.success) setApiUsage(r.data.data);
            }).catch(() => {});
            fetchApiKeys();
        } catch (err: any) {
            setApiMsg({ type: 'error', text: 'ዳታ ማምጣት አልተቻለም! የገቡት Keys ሁሉም አልቀው ሊሆን ይችላል።' });
            fetchApiKeys(); 
        } finally {
            setIsSyncing(false);
        }
    };

    let initialPotential = 0;
    let lostDeduction = 0;
    let currentRisk = 0;
    let totalPaidOut = 0;

    // 🌟 ማስተካከያ: የተቆረጡ (ticket_number ያላቸው) ትኬቶችን ሁሉ ማካተት 🌟
    const todayDateObj = new Date();
    const isTicketFromToday = (t: any) => {
        if (t.is_today === 1 || t.is_today === true) return true;
        const d = new Date(t.created_at);
        return d.getDate() === todayDateObj.getDate() &&
               d.getMonth() === todayDateObj.getMonth() &&
               d.getFullYear() === todayDateObj.getFullYear();
    };

    const computedTickets = allTickets
        .filter(t => t.ticket_number) 
        .map(t => {
            let ticketStatus = t.status;
            let actualPotentialWin = parseFloat(t.potential_win) || 0;

            if (ticketStatus === 'active' || ticketStatus === 'pending') {
                if (t.selections && t.selections.length > 0) {
                    let isLost = false;
                    let isPending = false;
                    let calculatedOdds = 1;

                    t.selections.forEach((s: any) => {
                        if (s.match_status === 'lost') {
                            isLost = true;
                        } else if (s.match_status === 'won') {
                            calculatedOdds *= parseFloat(s.odd_value);
                        } else if (s.match_status === 'postponed' || s.match_status === 'cancelled' || s.match_status === 'abandoned') {
                            calculatedOdds *= 1; 
                        } else {
                            isPending = true; 
                        }
                    });

                    if (isLost) ticketStatus = 'lost';
                    else if (isPending) ticketStatus = 'pending';
                    else {
                        ticketStatus = 'won';
                        actualPotentialWin = calculatedOdds * parseFloat(t.stake_amount);
                    }
                }
            }

            if (ticketStatus === 'won') {
                let lmt = new Date(t.created_at).getTime();
                if (t.selections && t.selections.length > 0) {
                    lmt = Math.max(...t.selections.map((s:any) => new Date(s.match_time || s.commence_time || lmt).getTime()));
                }
                if (Date.now() > lmt + (3 * 24 * 60 * 60 * 1000)) {
                    ticketStatus = 'expired';
                }
            }

            return { ...t, displayStatus: ticketStatus, computedPotential: actualPotentialWin };
        });

    computedTickets.forEach(t => {
        const winAmt = t.computedPotential;
        initialPotential += winAmt;
        
        if (t.displayStatus === 'lost' || t.displayStatus === 'expired') {
            lostDeduction += winAmt;
        } else if (t.displayStatus === 'active' || t.displayStatus === 'pending' || t.displayStatus === 'won') {
            currentRisk += winAmt;
        } else if (t.displayStatus === 'paid') {
            totalPaidOut += winAmt;
        }
    });

    let filteredTickets = [...computedTickets];
    if (ticketFilter === 'today') filteredTickets = filteredTickets.filter(t => isTicketFromToday(t));
    if (ticketFilter === 'won') filteredTickets = filteredTickets.filter(t => t.displayStatus === 'won');
    if (ticketFilter === 'paid') filteredTickets = filteredTickets.filter(t => t.displayStatus === 'paid');
    if (ticketFilter === 'lost') filteredTickets = filteredTickets.filter(t => t.displayStatus === 'lost' || t.displayStatus === 'expired');
    if (ticketFilter === 'high_stake') {
        filteredTickets = filteredTickets.filter(t => Number(t.stake_amount) >= 100).sort((a, b) => b.stake_amount - a.stake_amount);
    }
    if (ticketFilter === 'close_to_win') {
        filteredTickets = filteredTickets.filter(t => {
            if (t.displayStatus !== 'active' && t.displayStatus !== 'pending') return false;
            const won = t.selections?.filter((s: any) => s.match_status === 'won').length || 0;
            const pending = t.selections?.filter((s: any) => s.match_status === 'pending').length || 0;
            const lost = t.selections?.filter((s: any) => s.match_status === 'lost').length || 0;
            return lost === 0 && pending > 0 && pending <= 2; 
        });
    }

    filteredTickets.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const groupedTickets = filteredTickets.reduce((acc, ticket) => {
        const c = ticket.cashier || (ticket.role === 'user' ? 'ኦንላይን ተጫዋቾች (Online)' : 'ያልታወቀ');
        if (!acc[c]) acc[c] = [];
        acc[c].push(ticket);
        return acc;
    }, {} as Record<string, any[]>);

    // 🌟 ለፋይናንስ ሪፖርት ታብ 100% ትክክለኛ የቀን/ሳምንት/ወር/ዓመት ስሌት (ከ computedTickets እና ከ Backend reports የተዋሃደ) 🌟
    const toLocalIsoDate = (dateInput: any) => {
        const d = new Date(dateInput);
        if (Number.isNaN(d.getTime())) return '';
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };

    const doesTicketMatchReportPeriod = (t: any) => {
        const d = new Date(t.created_at);
        if (Number.isNaN(d.getTime())) return false;
        const ticketIso = toLocalIsoDate(d);
        const now = new Date();

        if (reportFilter === 'today') {
            return isTicketFromToday(t) || ticketIso === getTodayIsoStr();
        }
        if (reportFilter === 'date') {
            return ticketIso === selectedReportDate;
        }
        if (reportFilter === 'week') {
            const startOfWeek = new Date(now);
            const day = startOfWeek.getDay() || 7; // Monday = 1
            startOfWeek.setHours(0, 0, 0, 0);
            startOfWeek.setDate(startOfWeek.getDate() - (day - 1));
            return d.getTime() >= startOfWeek.getTime();
        }
        if (reportFilter === 'month') {
            return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        }
        if (reportFilter === 'year') {
            return d.getFullYear() === now.getFullYear();
        }
        return true;
    };

    const effectiveReport = (() => {
        const matchingTickets = computedTickets.filter(doesTicketMatchReportPeriod);

        // ከ computedTickets በቀጥታ ማስላት
        let totalTickets = 0;
        let voidTickets = 0;
        let shopTicketsCount = 0;
        let totalRevenue = 0;
        let totalPayout = 0;
        let totalPaidOut = 0;
        let totalUnpaidWon = 0;
        let totalActiveRisk = 0;
        let totalSavedFromLost = 0;
        let winningTicketsCount = 0;
        let paidTicketsCount = 0;
        let unpaidWonCount = 0;
        let lostTicketsCount = 0;
        let activeTicketsCount = 0;

        const onlineStats = {
            tickets_sold: 0,
            winning_tickets_count: 0,
            lost_tickets_count: 0,
            active_tickets_count: 0,
            revenue: 0,
            payout: 0,
            paid_out: 0
        };

        const cashierMap = new Map<string, any>();
        staffList.forEach(s => {
            if (s.role === 'cashier') {
                cashierMap.set(s.username, {
                    cashier: s.username,
                    role: s.role,
                    tickets_sold: 0,
                    void_tickets: 0,
                    winning_tickets_count: 0,
                    paid_tickets_count: 0,
                    unpaid_tickets_count: 0,
                    lost_tickets_count: 0,
                    active_tickets_count: 0,
                    revenue: 0,
                    payout: 0,
                    paid_out: 0,
                    unpaid_won: 0,
                    active_risk: 0
                });
            }
        });

        const winningTickets: any[] = [];

        matchingTickets.forEach(t => {
            const st = String(t.displayStatus || t.status || 'active').toLowerCase();
            const stake = parseFloat(t.stake_amount) || 0;
            const win = parseFloat(t.computedPotential ?? t.potential_win) || 0;
            const isOnline = t.role === 'user';
            const cName = t.cashier || (isOnline ? 'ኦንላይን ተጫዋች (Online)' : 'ካሼር (Shop)');

            if (!isOnline && !cashierMap.has(cName)) {
                cashierMap.set(cName, {
                    cashier: cName,
                    role: t.role || 'cashier',
                    tickets_sold: 0,
                    void_tickets: 0,
                    winning_tickets_count: 0,
                    paid_tickets_count: 0,
                    unpaid_tickets_count: 0,
                    lost_tickets_count: 0,
                    active_tickets_count: 0,
                    revenue: 0,
                    payout: 0,
                    paid_out: 0,
                    unpaid_won: 0,
                    active_risk: 0
                });
            }
            const cStat = !isOnline ? cashierMap.get(cName) : null;

            if (st === 'void') {
                voidTickets++;
                if (cStat) cStat.void_tickets++;
                return;
            }

            totalTickets++;
            totalRevenue += stake;

            if (isOnline) {
                onlineStats.tickets_sold++;
                onlineStats.revenue += stake;
            } else {
                shopTicketsCount++;
                if (cStat) {
                    cStat.tickets_sold++;
                    cStat.revenue += stake;
                }
            }

            if (st === 'paid') {
                winningTicketsCount++;
                paidTicketsCount++;
                totalPaidOut += win;
                totalPayout += win;
                winningTickets.push({ ...t, status: 'paid', potential_win: win });
                if (isOnline) {
                    onlineStats.winning_tickets_count++;
                    onlineStats.payout += win;
                    onlineStats.paid_out += win;
                } else if (cStat) {
                    cStat.winning_tickets_count++;
                    cStat.paid_tickets_count++;
                    cStat.payout += win;
                    cStat.paid_out += win;
                }
            } else if (st === 'won') {
                winningTicketsCount++;
                unpaidWonCount++;
                totalUnpaidWon += win;
                totalPayout += win;
                winningTickets.push({ ...t, status: 'won', potential_win: win });
                if (isOnline) {
                    onlineStats.winning_tickets_count++;
                    onlineStats.payout += win;
                } else if (cStat) {
                    cStat.winning_tickets_count++;
                    cStat.unpaid_tickets_count++;
                    cStat.payout += win;
                    cStat.unpaid_won += win;
                }
            } else if (st === 'lost' || st === 'expired') {
                lostTicketsCount++;
                totalSavedFromLost += win;
                if (st === 'expired') winningTickets.push({ ...t, status: 'expired', potential_win: win });
                if (isOnline) {
                    onlineStats.lost_tickets_count++;
                } else if (cStat) {
                    cStat.lost_tickets_count++;
                }
            } else {
                activeTicketsCount++;
                totalActiveRisk += win;
                if (isOnline) {
                    onlineStats.active_tickets_count++;
                } else if (cStat) {
                    cStat.active_tickets_count++;
                    cStat.active_risk += win;
                }
            }
        });

        const serviceFeeTotal = shopTicketsCount * 10;
        const grossCashIn = totalRevenue + serviceFeeTotal;
        const netCashFlow = grossCashIn - totalPaidOut;
        const netProfitAfterLiability = grossCashIn - totalPayout;

        const computedSummary = {
            totalTickets,
            voidTickets,
            shopTicketsCount,
            serviceFeeTotal,
            totalRevenue,
            grossCashIn,
            totalPayout,
            totalPaidOut,
            totalUnpaidWon,
            totalActiveRisk,
            totalSavedFromLost,
            netCashFlow,
            netProfitAfterLiability,
            winningTicketsCount,
            paidTicketsCount,
            unpaidWonCount,
            lostTicketsCount,
            activeTicketsCount,
            activeOnlineUsers: reports.activeOnlineUsers || 0,
            onlineStats,
            cashierStats: Array.from(cashierMap.values()).sort((a, b) => b.revenue - a.revenue),
            winningTickets,
            periodTickets: matchingTickets
        };

        // computedTickets ዳታ ካለው ወይም የባክኤንድ ሪፖርት 0 ከሆነ የቀጥታ ስሌቱን ይጠቀማል
        if (computedTickets.length > 0 || Number(reports.totalTickets || 0) === 0) {
            return computedSummary;
        }
        return {
            ...computedSummary,
            ...reports,
            periodTickets: reports.periodTickets?.length ? reports.periodTickets : matchingTickets
        };
    })();


    if (!token) {
        return (
            <div className="min-h-screen bg-[#111418] flex items-center justify-center font-sans">
                <div className="bg-[#1e2328] p-10 rounded-xl shadow-2xl border border-[#3b4148] w-[400px] relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-2 bg-[#ffcc00]"></div>
                    <div className="text-center mb-8 mt-2">
                        <div className="w-20 h-20 bg-[#1c2024] rounded-[15px] flex items-center justify-center mx-auto mb-4 shadow-inner border border-[#3b4148] p-2">
                            <img src="/icon.svg" alt="Vibe Bet Admin" className="w-full h-full object-contain" />
                        </div>
                        <h2 className="text-3xl font-black text-white tracking-wide italic">VIBE <span className="text-[#ffcc00]">BET</span></h2>
                        <p className="text-slate-400 text-sm mt-1 font-bold">Super User Portal</p>
                    </div>
                    <form onSubmit={handleLogin} className="space-y-5">
                        {loginError && <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-bold p-3 rounded text-center">{loginError}</div>}
                        <div>
                            <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">Admin Username</label>
                            <input type="text" value={loginUsername} onChange={(e) => setLoginUsername(e.target.value)} required className="w-full bg-[#111418] border border-[#3b4148] text-white px-4 py-3 rounded outline-none focus:border-[#ffcc00] transition-colors" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">Password</label>
                            <input type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} required className="w-full bg-[#111418] border border-[#3b4148] text-white px-4 py-3 rounded outline-none focus:border-[#ffcc00] transition-colors" />
                        </div>
                        <button type="submit" className="w-full bg-[#ffcc00] hover:bg-[#e6b800] text-black font-black py-3.5 rounded mt-4 transition transform active:scale-95 uppercase tracking-wider">ግባ (LOGIN)</button>
                    </form>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#111418] text-slate-300 font-sans flex">
            {/* Sidebar */}
            <div className="w-64 bg-[#1e2328] border-r border-[#3b4148] p-6 flex flex-col relative z-10 shadow-[4px_0_24px_rgba(0,0,0,0.2)]">
                <div className="mb-10 flex items-center gap-3">
                    <div className="w-10 h-10 shrink-0 rounded-lg overflow-hidden shadow-lg border border-[#3b4148]/50 bg-[#1c2024] p-1 flex items-center justify-center">
                        <img src="/icon.svg" alt="Vibe Bet" className="w-full h-full object-contain" />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-white leading-none italic">VIBE <span className="text-[#ffcc00]">BET</span></h2>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">Admin Panel</p>
                    </div>
                </div>

                <nav className="flex-1 space-y-2">
                    <button onClick={() => setActiveTab('dashboard')} className={`w-full text-left font-bold px-4 py-3 rounded-lg flex items-center gap-3 transition ${activeTab === 'dashboard' ? 'bg-[#ffcc00]/10 text-[#ffcc00] border border-[#ffcc00]/30' : 'text-slate-400 hover:bg-[#24292e] hover:text-white'}`}>
                        📊 ዳሽቦርድ (Overview)
                    </button>
                    <button onClick={() => setActiveTab('reports')} className={`w-full text-left font-bold px-4 py-3 rounded-lg flex items-center gap-3 transition ${activeTab === 'reports' ? 'bg-[#ffcc00]/10 text-[#ffcc00] border border-[#ffcc00]/30' : 'text-slate-400 hover:bg-[#24292e] hover:text-white'}`}>
                        📈 የፋይናንስ ሪፖርት
                    </button>
                    <button onClick={() => setActiveTab('staff')} className={`w-full text-left font-bold px-4 py-3 rounded-lg flex items-center gap-3 transition ${activeTab === 'staff' ? 'bg-[#ffcc00]/10 text-[#ffcc00] border border-[#ffcc00]/30' : 'text-slate-400 hover:bg-[#24292e] hover:text-white'}`}>
                        👥 ሰራተኞች ማስተዳደሪያ
                    </button>
                    <button onClick={() => setActiveTab('tickets')} className={`w-full text-left font-bold px-4 py-3 rounded-lg flex items-center gap-3 transition ${activeTab === 'tickets' ? 'bg-[#ffcc00]/10 text-[#ffcc00] border border-[#ffcc00]/30' : 'text-slate-400 hover:bg-[#24292e] hover:text-white'}`}>
                        🎟️ ትኬት ማኔጅመንት
                    </button>
                    <button onClick={() => setActiveTab('settings')} className={`w-full text-left font-bold px-4 py-3 rounded-lg flex items-center gap-3 transition ${activeTab === 'settings' ? 'bg-[#ffcc00]/10 text-[#ffcc00] border border-[#ffcc00]/30' : 'text-slate-400 hover:bg-[#24292e] hover:text-white'}`}>
                        ⚙️ ሲስተም ሴቲንግ
                    </button>
                </nav>
                <div className="border-t border-[#3b4148] pt-4">
                    <div className="text-sm font-bold text-white mb-2 flex items-center gap-2">
                        <span className="bg-[#ffcc00] text-black w-6 h-6 rounded-full flex items-center justify-center text-xs">A</span>
                        {adminName}
                    </div>
                    <button onClick={handleLogout} className="w-full text-xs font-bold text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 px-4 py-2.5 rounded transition">ውጣ (Logout)</button>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 p-10 overflow-y-auto custom-scrollbar">

                {activeTab === 'dashboard' && (
                    <div className="max-w-6xl animate-fade-in-down">
                        <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
                            <div>
                                <h1 className="text-3xl font-black text-white mb-1">📊 ዳሽቦርድ እና የዛሬ የገንዘብ ፍሰት</h1>
                                <p className="text-slate-400 text-sm">የዛሬ የተቆረጡ ትኬቶችን፣ አጠቃላይ የገንዘብ እንቅስቃሴን እና የሲስተም ሁኔታን በቀጥታ ይከታተሉ።</p>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => { fetchReports(); fetchTickets(); }}
                                    className="bg-[#1e2328] hover:bg-[#2a3038] text-[#ffcc00] border border-[#3b4148] px-4 py-2 rounded-lg font-bold text-xs transition flex items-center gap-1.5"
                                >
                                    🔄 መረጃ አድስ (Refresh)
                                </button>
                                <button 
                                    onClick={() => setActiveTab('settings')}
                                    className="bg-[#ffcc00] hover:bg-[#e6b800] text-black px-4 py-2 rounded-lg font-black text-xs transition"
                                >
                                    ⚙️ API አዘምን (Sync)
                                </button>
                            </div>
                        </div>

                        {/* 🌟 የዛሬ የገንዘብ ፍሰት ማጠቃለያ ካርዶች 🌟 */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                            <div className="bg-[#1e2328] border border-[#3b4148] p-5 rounded-xl shadow-lg">
                                <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">ዛሬ የተቆረጡ ትኬቶች</h3>
                                <p className="text-3xl font-black text-white">{computedTickets.filter(t => isTicketFromToday(t) && t.displayStatus !== 'void').length}</p>
                                <p className="text-[11px] text-[#ffcc00] mt-1.5 font-bold">
                                    የ10 ብር ሰርቪስ ገቢ: {(computedTickets.filter(t => isTicketFromToday(t) && t.displayStatus !== 'void' && t.role !== 'user').length * 10).toLocaleString()} Br
                                </p>
                            </div>

                            <div className="bg-[#1e2328] border border-[#00e700]/30 p-5 rounded-xl shadow-lg">
                                <h3 className="text-[11px] font-bold text-[#00e700] uppercase tracking-wider mb-1">የዛሬ ውርርድ ገቢ (Stake)</h3>
                                <p className="text-3xl font-black text-[#00e700]">
                                    {computedTickets.filter(t => isTicketFromToday(t) && t.displayStatus !== 'void').reduce((s, t) => s + (Number(t.stake_amount) || 0), 0).toLocaleString()} Br
                                </p>
                                <p className="text-[11px] text-slate-400 mt-1.5 font-bold">
                                    ከሰርቪስ ጋር ጠቅላላ: <span className="text-white">
                                        {(
                                            computedTickets.filter(t => isTicketFromToday(t) && t.displayStatus !== 'void').reduce((s, t) => s + (Number(t.stake_amount) || 0), 0) +
                                            computedTickets.filter(t => isTicketFromToday(t) && t.displayStatus !== 'void' && t.role !== 'user').length * 10
                                        ).toLocaleString()} Br
                                    </span>
                                </p>
                            </div>

                            <div className="bg-[#1e2328] border border-red-500/30 p-5 rounded-xl shadow-lg">
                                <h3 className="text-[11px] font-bold text-red-400 uppercase tracking-wider mb-1">የዛሬ ወጪ (Paid / Won)</h3>
                                <p className="text-3xl font-black text-red-400">
                                    {computedTickets.filter(t => isTicketFromToday(t) && (t.displayStatus === 'paid' || t.displayStatus === 'won')).reduce((s, t) => s + (Number(t.computedPotential) || 0), 0).toLocaleString()} Br
                                </p>
                                <p className="text-[11px] text-slate-400 mt-1.5 font-bold">
                                    የተከፈለ: <span className="text-blue-400">{computedTickets.filter(t => isTicketFromToday(t) && t.displayStatus === 'paid').reduce((s, t) => s + (Number(t.computedPotential) || 0), 0).toLocaleString()} Br</span>
                                </p>
                            </div>

                            <div className="bg-gradient-to-br from-[#1e2328] to-[#182620] border border-[#00e700]/40 p-5 rounded-xl shadow-lg">
                                <h3 className="text-[11px] font-bold text-[#00e700] uppercase tracking-wider mb-1">የዛሬ ንፁህ ቀሪ ካዝና</h3>
                                <p className="text-3xl font-black text-white">
                                    {(
                                        computedTickets.filter(t => isTicketFromToday(t) && t.displayStatus !== 'void').reduce((s, t) => s + (Number(t.stake_amount) || 0), 0) +
                                        computedTickets.filter(t => isTicketFromToday(t) && t.displayStatus !== 'void' && t.role !== 'user').length * 10 -
                                        computedTickets.filter(t => isTicketFromToday(t) && t.displayStatus === 'paid').reduce((s, t) => s + (Number(t.computedPotential) || 0), 0)
                                    ).toLocaleString()} Br
                                </p>
                                <p className="text-[11px] text-slate-400 mt-1.5 font-bold">
                                    አክቲቭ ጨዋታዎች: <span className="text-[#ffcc00]">{totalMatches}</span> | ኦንላይን ተጫዋቾች: <span className="text-[#00bfff]">{reports.activeOnlineUsers}</span>
                                </p>
                            </div>
                        </div>

                        {/* 🌟 ዛሬ የተቆረጡ ትኬቶች የቀጥታ ሰንጠረዥ 🌟 */}
                        <div className="bg-[#1e2328] border border-[#3b4148] rounded-xl shadow-lg overflow-hidden">
                            <div className="px-6 py-4 border-b border-[#3b4148] bg-[#24292e] flex justify-between items-center">
                                <h2 className="text-base font-black text-white flex items-center gap-2">
                                    <span>🧾</span> ዛሬ የተቆረጡ ትኬቶች እና የጨዋታዎች ዝርዝር
                                </h2>
                                <button
                                    onClick={() => { setTicketFilter('today'); setActiveTab('tickets'); }}
                                    className="text-xs font-bold text-[#ffcc00] hover:underline"
                                >
                                    ሁሉንም በትኬት ማኔጅመንት እይ ❯
                                </button>
                            </div>
                            <div className="overflow-x-auto max-h-[420px] overflow-y-auto custom-scrollbar">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-[#1a1f24] text-[10px] uppercase tracking-widest text-slate-400 sticky top-0">
                                            <th className="px-4 py-3 font-black">ሰዓት</th>
                                            <th className="px-4 py-3 font-black">ትኬት ቁጥር</th>
                                            <th className="px-4 py-3 font-black">ካሼር / ምንጭ</th>
                                            <th className="px-4 py-3 font-black">ጨዋታዎች</th>
                                            <th className="px-4 py-3 font-black">Stake (+10)</th>
                                            <th className="px-4 py-3 font-black">ሊበላ (Win)</th>
                                            <th className="px-4 py-3 font-black">ሁኔታ</th>
                                            <th className="px-4 py-3 font-black text-right">ድርጊት</th>
                                        </tr>
                                    </thead>
                                    <tbody className="text-xs divide-y divide-[#2a3038]">
                                        {computedTickets.filter(t => isTicketFromToday(t)).length === 0 ? (
                                            <tr>
                                                <td colSpan={8} className="text-center py-10 text-slate-500 font-bold">ዛሬ የተቆረጠ ትኬት የለም</td>
                                            </tr>
                                        ) : (
                                            computedTickets.filter(t => isTicketFromToday(t)).slice(0, 50).map((t, idx) => (
                                                <tr key={idx} className="hover:bg-[#24292e] transition-colors">
                                                    <td className="px-4 py-3 text-slate-400 font-bold">
                                                        {new Date(t.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </td>
                                                    <td className="px-4 py-3 font-mono font-black text-[#ffcc00]">#{t.ticket_number}</td>
                                                    <td className="px-4 py-3 font-bold text-white">{t.cashier || 'Shop'}</td>
                                                    <td className="px-4 py-3 text-slate-300 font-bold">{t.selections?.length || 0} ጨዋታ</td>
                                                    <td className="px-4 py-3 font-bold text-[#00e700]">{Number(t.stake_amount).toLocaleString()} Br</td>
                                                    <td className="px-4 py-3 font-black text-white">{Number(t.computedPotential).toLocaleString()} Br</td>
                                                    <td className="px-4 py-3 font-bold">
                                                        {t.displayStatus === 'paid' ? <span className="text-blue-400">✅ ተከፍሏል</span> :
                                                         t.displayStatus === 'won' ? <span className="text-[#00e700]">🎉 ያሸነፈ</span> :
                                                         t.displayStatus === 'lost' ? <span className="text-red-500">❌ የተሸነፈ</span> :
                                                         t.displayStatus === 'void' ? <span className="text-slate-500">🚫 የተሰረዘ</span> :
                                                         <span className="text-[#ffcc00]">⏳ በሂደት ላይ</span>}
                                                    </td>
                                                    <td className="px-4 py-3 text-right">
                                                        <button onClick={() => setSelectedManageTicket(t)} className="bg-[#111418] hover:bg-[#3b4148] border border-[#3b4148] text-white px-3 py-1 rounded text-[10px] font-bold">
                                                            ዝርዝር እይ
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'reports' && (
                    <div className="max-w-6xl animate-fade-in-down">
                        <div className="flex flex-wrap justify-between items-end gap-4 mb-6">
                            <div>
                                <h1 className="text-3xl font-black text-white mb-2">📈 የፋይናንስ እና የየቀኑ ሂሳብ ሪፖርት</h1>
                                <p className="text-slate-400 text-sm">
                                    ማንኛውንም ቀን ወይም ጊዜ በመምረጥ የተቆረጡ ትኬቶችን፣ ያሸነፉትን፣ የተሸነፉትን እና ለተጫዋቾች የተከፈለውን ብር በዝርዝር ይፈትሹ።
                                </p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                <button
                                    onClick={() => { fetchReports(); fetchTickets(); fetchStaffList(); }}
                                    className="bg-[#1e2328] hover:bg-[#24292e] border border-[#3b4148] text-[#ffcc00] px-4 py-2 rounded-lg text-xs font-bold transition"
                                >
                                    🔄 አድስ
                                </button>
                                <div className="flex bg-[#1e2328] border border-[#3b4148] rounded-lg overflow-hidden">
                                    <button
                                        onClick={() => { setReportFilter('today'); setSelectedReportDate(getTodayIsoStr()); }}
                                        className={`px-4 py-2 text-xs sm:text-sm font-bold transition ${reportFilter === 'today' ? 'bg-[#ffcc00] text-black' : 'text-slate-400 hover:text-white hover:bg-[#24292e]'}`}
                                    >
                                        የዛሬ
                                    </button>
                                    <button
                                        onClick={() => setReportFilter('week')}
                                        className={`px-4 py-2 text-xs sm:text-sm font-bold border-l border-[#3b4148] transition ${reportFilter === 'week' ? 'bg-[#ffcc00] text-black' : 'text-slate-400 hover:text-white hover:bg-[#24292e]'}`}
                                    >
                                        የሳምንቱ
                                    </button>
                                    <button
                                        onClick={() => setReportFilter('month')}
                                        className={`px-4 py-2 text-xs sm:text-sm font-bold border-l border-[#3b4148] transition ${reportFilter === 'month' ? 'bg-[#ffcc00] text-black' : 'text-slate-400 hover:text-white hover:bg-[#24292e]'}`}
                                    >
                                        የወሩ
                                    </button>
                                    <button
                                        onClick={() => setReportFilter('year')}
                                        className={`px-4 py-2 text-xs sm:text-sm font-bold border-l border-[#3b4148] transition ${reportFilter === 'year' ? 'bg-[#ffcc00] text-black' : 'text-slate-400 hover:text-white hover:bg-[#24292e]'}`}
                                    >
                                        የዓመቱ
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* 🌟 የየቀኑ ሂሳብ መምረጫ (Daily Date Picker Bar) 🌟 */}
                        <div className="bg-[#1e2328] border border-[#3b4148] p-4 rounded-xl shadow-lg mb-6 flex flex-wrap justify-between items-center gap-4">
                            <div className="flex items-center gap-3">
                                <span className="text-2xl">📅</span>
                                <div>
                                    <h3 className="text-sm font-black text-white">የየቀኑ ሂሳብ መፈተሻ (ቀን ይምረጡ)</h3>
                                    <p className="text-xs text-slate-400">
                                        አሁን እየታየ ያለው ሪፖርት፦{' '}
                                        <span className="text-[#ffcc00] font-black">
                                            {reportFilter === 'date'
                                                ? `የ ${selectedReportDate} ሙሉ የዕለት ሂሳብ`
                                                : reportFilter === 'today'
                                                ? `የዛሬ (${getTodayIsoStr()}) ሂሳብ`
                                                : reportFilter === 'week'
                                                ? 'የዚህ ሳምንት ሂሳብ'
                                                : reportFilter === 'month'
                                                ? 'የዚህ ወር ሂሳብ'
                                                : 'የዚህ ዓመት ሂሳብ'}
                                        </span>
                                    </p>
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => shiftSelectedDate(-1)}
                                    className="bg-[#111418] hover:bg-[#24292e] text-slate-300 hover:text-white border border-[#3b4148] px-3 py-2 rounded-lg text-xs font-bold transition"
                                    title="ያለፈው ቀን"
                                >
                                    ◀ ቀዳሚ ቀን
                                </button>
                                <div className={`flex items-center gap-2 bg-[#111418] border px-3 py-1.5 rounded-lg transition ${reportFilter === 'date' ? 'border-[#ffcc00] ring-1 ring-[#ffcc00]/40' : 'border-[#3b4148]'}`}>
                                    <span className="text-xs font-bold text-slate-400">ቀን:</span>
                                    <input
                                        type="date"
                                        value={selectedReportDate}
                                        onChange={(e) => {
                                            if (e.target.value) {
                                                setSelectedReportDate(e.target.value);
                                                setReportFilter('date');
                                            }
                                        }}
                                        className="bg-transparent text-white font-black text-xs sm:text-sm outline-none cursor-pointer"
                                    />
                                </div>
                                <button
                                    type="button"
                                    onClick={() => shiftSelectedDate(1)}
                                    className="bg-[#111418] hover:bg-[#24292e] text-slate-300 hover:text-white border border-[#3b4148] px-3 py-2 rounded-lg text-xs font-bold transition"
                                    title="ቀጣይ ቀን"
                                >
                                    ቀጣይ ቀን ▶
                                </button>
                                {reportFilter === 'date' && (
                                    <button
                                        type="button"
                                        onClick={() => { setReportFilter('today'); setSelectedReportDate(getTodayIsoStr()); }}
                                        className="bg-[#ffcc00]/15 hover:bg-[#ffcc00]/25 text-[#ffcc00] border border-[#ffcc00]/30 px-3 py-2 rounded-lg text-xs font-bold transition"
                                    >
                                        ወደ ዛሬ ተመለስ
                                    </button>
                                )}
                            </div>
                        </div>

                        {isFetchingReports && computedTickets.length === 0 ? (
                            <div className="py-20 flex justify-center"><span className="w-10 h-10 border-4 border-[#3b4148] border-t-[#ffcc00] rounded-full animate-spin"></span></div>
                        ) : (
                            <>
                                {(() => {
                                    const totalCut = Number(effectiveReport.totalTickets || 0);
                                    const voidCount = Number(effectiveReport.voidTickets || 0);
                                    const wonCount = Number(effectiveReport.winningTicketsCount || 0);
                                    const paidCount = Number(effectiveReport.paidTicketsCount || 0);
                                    const unpaidCount = Number(effectiveReport.unpaidWonCount || 0);
                                    const lostCount = Number(effectiveReport.lostTicketsCount || 0);
                                    const activeCount = Number(effectiveReport.activeTicketsCount || 0);

                                    const shopTickets = Number(effectiveReport.shopTicketsCount ?? totalCut);
                                    const serviceFee = Number(effectiveReport.serviceFeeTotal ?? (shopTickets * 10));
                                    const stakeRev = Number(effectiveReport.totalRevenue ?? 0);
                                    const grossIn = Number(effectiveReport.grossCashIn ?? (stakeRev + serviceFee));
                                    const paidOut = Number(effectiveReport.totalPaidOut ?? 0);
                                    const unpaidWon = Number(effectiveReport.totalUnpaidWon ?? 0);
                                    const totalWonAndPaid = Number(effectiveReport.totalPayout ?? (paidOut + unpaidWon));
                                    const savedFromLost = Number(effectiveReport.totalSavedFromLost ?? 0);
                                    const netCash = Number(effectiveReport.netCashFlow ?? (grossIn - paidOut));
                                    const activeRiskVal = Number(effectiveReport.totalActiveRisk ?? 0);

                                    const periodTicketsList: any[] = effectiveReport.periodTickets || [];
                                    const filteredPeriodTickets = periodTicketsList.filter((t: any) => {
                                        const st = String(t.displayStatus || t.status || 'active').toLowerCase();
                                        if (reportTicketStatusFilter === 'won') return st === 'won' || st === 'paid';
                                        if (reportTicketStatusFilter === 'lost') return st === 'lost' || st === 'expired';
                                        if (reportTicketStatusFilter === 'paid') return st === 'paid';
                                        if (reportTicketStatusFilter === 'active') return st === 'active' || st === 'pending';
                                        return true;
                                    });

                                    return (
                                        <>
                                            {/* 🌟 1. አራቱ ዋና የዕለቱ ጥያቄዎች፡ ስንት ተቆረጠ? ስንት አሸነፈ? ስንት ተሸነፈ? ስንት ብር ለተጫዋቾች ተከፈለ? 🌟 */}
                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-6">
                                                <div className="bg-[#1e2328] border border-[#3b4148] p-5 rounded-xl shadow-lg">
                                                    <div className="flex justify-between items-start mb-1.5">
                                                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">1. የተቆረጠ ትኬት ብዛት</h3>
                                                        <span className="text-lg">🧾</span>
                                                    </div>
                                                    <p className="text-3xl font-black text-white">{totalCut} <span className="text-sm font-bold text-slate-400">ትኬት</span></p>
                                                    <p className="text-[11px] text-slate-400 mt-2 font-bold">
                                                        በሂደት ላይ: <span className="text-[#ffcc00]">{activeCount}</span> | የተሰረዘ (Void): <span className="text-red-400">{voidCount}</span>
                                                    </p>
                                                </div>

                                                <div className="bg-[#1e2328] border border-[#00e700]/40 p-5 rounded-xl shadow-lg">
                                                    <div className="flex justify-between items-start mb-1.5">
                                                        <h3 className="text-xs font-bold text-[#00e700] uppercase tracking-wider">2. ያሸነፈ ትኬት ብዛት</h3>
                                                        <span className="text-lg">🎉</span>
                                                    </div>
                                                    <p className="text-3xl font-black text-[#00e700]">{wonCount} <span className="text-sm font-bold text-slate-400">ትኬት</span></p>
                                                    <p className="text-[11px] text-slate-300 mt-2 font-bold">
                                                        ጠቅላላ ያሸነፉት: <span className="text-white">{totalWonAndPaid.toLocaleString()} Br</span> (የተከፈለ: {paidCount} | ያልተከፈለ: {unpaidCount})
                                                    </p>
                                                </div>

                                                <div className="bg-[#1e2328] border border-red-500/40 p-5 rounded-xl shadow-lg">
                                                    <div className="flex justify-between items-start mb-1.5">
                                                        <h3 className="text-xs font-bold text-red-400 uppercase tracking-wider">3. የተሸነፈ ትኬት ብዛት</h3>
                                                        <span className="text-lg">❌</span>
                                                    </div>
                                                    <p className="text-3xl font-black text-red-400">{lostCount} <span className="text-sm font-bold text-slate-400">ትኬት</span></p>
                                                    <p className="text-[11px] text-slate-400 mt-2 font-bold">
                                                        ከተሸነፉ የዳነ ክፍያ: <span className="text-[#00e700]">{savedFromLost.toLocaleString()} Br</span>
                                                    </p>
                                                </div>

                                                <div className="bg-gradient-to-br from-blue-500/15 to-[#1e2328] border border-blue-500/40 p-5 rounded-xl shadow-lg">
                                                    <div className="flex justify-between items-start mb-1.5">
                                                        <h3 className="text-xs font-bold text-blue-400 uppercase tracking-wider">4. ለተጫዋቾች የተከፈለ ብር</h3>
                                                        <span className="text-lg">💸</span>
                                                    </div>
                                                    <p className="text-3xl font-black text-blue-400">{paidOut.toLocaleString()} Br</p>
                                                    <p className="text-[11px] text-slate-300 mt-2 font-bold">
                                                        የተከፈሉ ትኬቶች: <span className="text-white">{paidCount}</span> | ገና ያልተከፈለ: <span className="text-orange-400">{unpaidWon.toLocaleString()} Br</span>
                                                    </p>
                                                </div>
                                            </div>

                                            {/* 🌟 2. የገንዘብ ገቢ፣ የ10 ብር ክፍያ እና ንፁህ ቀሪ ካዝና 🌟 */}
                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
                                                <div className="bg-[#1e2328] border border-[#ffcc00]/40 p-5 rounded-xl shadow-lg relative overflow-hidden">
                                                    <div className="absolute top-0 right-0 p-3 opacity-10 text-4xl">💰</div>
                                                    <h3 className="text-xs font-bold text-[#ffcc00] uppercase tracking-wider mb-1">የትኬት ክፍያ (10 ብር)</h3>
                                                    <p className="text-2xl font-black text-[#ffcc00]">{serviceFee.toLocaleString()} Br</p>
                                                    <p className="text-[11px] text-slate-400 mt-1 font-bold">{shopTickets} የሱቅ ትኬት × 10 ብር</p>
                                                </div>

                                                <div className="bg-[#1e2328] border border-[#00e700]/40 p-5 rounded-xl shadow-lg">
                                                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">የውርርድ ገቢ (Stake)</h3>
                                                    <p className="text-2xl font-black text-[#00e700]">{stakeRev.toLocaleString()} Br</p>
                                                    <p className="text-[11px] text-slate-300 mt-1 font-bold">
                                                        ከ10 ብር ጋር ጠቅላላ: <span className="text-white">{grossIn.toLocaleString()} Br</span>
                                                    </p>
                                                </div>

                                                <div className="bg-gradient-to-r from-[#00e700]/15 to-[#1e2328] border border-[#00e700]/40 p-5 rounded-xl shadow-lg">
                                                    <h3 className="text-xs font-black text-[#00e700] uppercase tracking-wider mb-1">በካዝና ያለ ንፁህ ቀሪ ብር</h3>
                                                    <p className="text-2xl font-black text-white">{netCash.toLocaleString()} Br</p>
                                                    <p className="text-[11px] text-slate-400 mt-1 font-bold">(Stake + 10 ብር) - የተከፈለ ብር</p>
                                                </div>

                                                <div className="bg-[#1e2328] border border-[#ffcc00]/30 p-5 rounded-xl shadow-lg">
                                                    <h3 className="text-xs font-black text-[#ffcc00] uppercase tracking-wider mb-1">በሂደት ላይ ያለ አደጋ (Risk)</h3>
                                                    <p className="text-2xl font-black text-[#ffcc00]">{activeRiskVal.toLocaleString()} Br</p>
                                                    <p className="text-[11px] text-slate-400 mt-1 font-bold">{activeCount} ያላለቁ ትኬቶች ቢያሸንፉ</p>
                                                </div>
                                            </div>

                                            {/* 🌟 3. የካሼሮች የስራ እና የየቀኑ ሂሳብ ሪፖርት ሰንጠረዥ 🌟 */}
                                            <div className="bg-[#1e2328] border border-[#3b4148] rounded-xl shadow-lg mb-8 overflow-hidden">
                                                <div className="px-6 py-4 border-b border-[#3b4148] bg-[#24292e]">
                                                    <h2 className="text-lg font-bold text-white">👨‍💼 የካሼሮች የስራ እና የገንዘብ ፍሰት ሪፖርት (Cashier Performance)</h2>
                                                </div>
                                                <div className="overflow-x-auto">
                                                    <table className="w-full text-left border-collapse">
                                                        <thead>
                                                            <tr className="bg-[#1a1f24] text-[10px] uppercase tracking-widest text-slate-400">
                                                                <th className="px-4 py-3.5 font-black">ካሼር ስም</th>
                                                                <th className="px-4 py-3.5 font-black">የተቆረጠ</th>
                                                                <th className="px-4 py-3.5 font-black text-[#00e700]">ያሸነፈ</th>
                                                                <th className="px-4 py-3.5 font-black text-red-400">የተሸነፈ</th>
                                                                <th className="px-4 py-3.5 font-black text-[#ffcc00]">የ10 ብር ክፍያ</th>
                                                                <th className="px-4 py-3.5 font-black text-[#00e700]">Stake ገቢ</th>
                                                                <th className="px-4 py-3.5 font-black text-white">ጠቅላላ የሰበሰበው</th>
                                                                <th className="px-4 py-3.5 font-black text-blue-400">ለተጫዋች የተከፈለ</th>
                                                                <th className="px-4 py-3.5 font-black text-orange-400">ያልተከፈለ (Won)</th>
                                                                <th className="px-4 py-3.5 font-black text-[#00e700]">ቀሪ ካዝና (Net)</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="text-xs sm:text-sm divide-y divide-[#2a3038]">
                                                            {effectiveReport.cashierStats.length === 0 ? (
                                                                <tr><td colSpan={10} className="text-center py-6 text-slate-500">ምንም የካሼር መረጃ የለም</td></tr>
                                                            ) : (
                                                                effectiveReport.cashierStats.map((stat: any, i: number) => {
                                                                    const sold = Number(stat.tickets_sold || 0);
                                                                    const wonC = Number(stat.winning_tickets_count || 0);
                                                                    const lostC = Number(stat.lost_tickets_count || 0);
                                                                    const fee = sold * 10;
                                                                    const rev = Number(stat.revenue || 0);
                                                                    const gross = rev + fee;
                                                                    const paid = Number(stat.paid_out ?? 0);
                                                                    const unpaid = Number(stat.unpaid_won ?? 0);
                                                                    const netCashVal = gross - paid;

                                                                    return (
                                                                        <tr key={i} className="hover:bg-[#24292e] transition-colors">
                                                                            <td className="px-4 py-3.5 font-bold text-white flex items-center gap-2">
                                                                                <span className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-xs">👤</span>
                                                                                {stat.cashier}
                                                                            </td>
                                                                            <td className="px-4 py-3.5 text-white font-black">{sold}</td>
                                                                            <td className="px-4 py-3.5 font-black text-[#00e700]">{wonC}</td>
                                                                            <td className="px-4 py-3.5 font-black text-red-400">{lostC}</td>
                                                                            <td className="px-4 py-3.5 font-black text-[#ffcc00]">{fee.toLocaleString()} Br</td>
                                                                            <td className="px-4 py-3.5 font-black text-[#00e700]">{rev.toLocaleString()} Br</td>
                                                                            <td className="px-4 py-3.5 font-black text-white">{gross.toLocaleString()} Br</td>
                                                                            <td className="px-4 py-3.5 font-black text-blue-400">{paid.toLocaleString()} Br</td>
                                                                            <td className="px-4 py-3.5 font-black text-orange-400">{unpaid.toLocaleString()} Br</td>
                                                                            <td className="px-4 py-3.5 font-black text-[#00e700]">{netCashVal.toLocaleString()} Br</td>
                                                                        </tr>
                                                                    );
                                                                })
                                                            )}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>

                                            {/* 🌟 4. በተመረጠው ቀን/ጊዜ የተቆረጡ ትኬቶች ሙሉ ዝርዝር (ከሁኔታ ማጣሪያ ጋር) 🌟 */}
                                            <div className="bg-[#1e2328] border border-[#3b4148] rounded-xl shadow-lg mb-8 overflow-hidden">
                                                <div className="px-6 py-4 border-b border-[#3b4148] bg-[#24292e] flex flex-wrap justify-between items-center gap-3">
                                                    <h2 className="text-lg font-bold text-white">🧾 በተመረጠው ቀን/ጊዜ የተቆረጡ ትኬቶች ዝርዝር ({filteredPeriodTickets.length})</h2>
                                                    <div className="flex flex-wrap gap-1.5">
                                                        <button onClick={() => setReportTicketStatusFilter('all')} className={`px-3 py-1 rounded text-xs font-bold transition ${reportTicketStatusFilter === 'all' ? 'bg-[#ffcc00] text-black' : 'bg-[#111418] text-slate-400 hover:text-white'}`}>ሁሉም ({periodTicketsList.length})</button>
                                                        <button onClick={() => setReportTicketStatusFilter('won')} className={`px-3 py-1 rounded text-xs font-bold transition ${reportTicketStatusFilter === 'won' ? 'bg-[#00e700] text-black' : 'bg-[#111418] text-[#00e700] border border-[#00e700]/30'}`}>🎉 ያሸነፉ ({wonCount})</button>
                                                        <button onClick={() => setReportTicketStatusFilter('lost')} className={`px-3 py-1 rounded text-xs font-bold transition ${reportTicketStatusFilter === 'lost' ? 'bg-red-500 text-white' : 'bg-[#111418] text-red-400 border border-red-500/30'}`}>❌ የተሸነፉ ({lostCount})</button>
                                                        <button onClick={() => setReportTicketStatusFilter('paid')} className={`px-3 py-1 rounded text-xs font-bold transition ${reportTicketStatusFilter === 'paid' ? 'bg-blue-500 text-white' : 'bg-[#111418] text-blue-400 border border-blue-500/30'}`}>✅ የተከፈሉ ({paidCount})</button>
                                                        <button onClick={() => setReportTicketStatusFilter('active')} className={`px-3 py-1 rounded text-xs font-bold transition ${reportTicketStatusFilter === 'active' ? 'bg-orange-500 text-black' : 'bg-[#111418] text-orange-400 border border-orange-500/30'}`}>⏳ በሂደት ላይ ({activeCount})</button>
                                                    </div>
                                                </div>
                                                <div className="overflow-x-auto max-h-[450px] overflow-y-auto custom-scrollbar">
                                                    <table className="w-full text-left border-collapse">
                                                        <thead>
                                                            <tr className="bg-[#1a1f24] text-[10px] uppercase tracking-widest text-slate-400 sticky top-0">
                                                                <th className="px-4 py-3 font-black">ቀን እና ሰዓት</th>
                                                                <th className="px-4 py-3 font-black">ትኬት ቁጥር</th>
                                                                <th className="px-4 py-3 font-black">ካሼር / ምንጭ</th>
                                                                <th className="px-4 py-3 font-black">የተመደበ (Stake)</th>
                                                                <th className="px-4 py-3 font-black">ሊበላ (Win)</th>
                                                                <th className="px-4 py-3 font-black">ሁኔታ (Status)</th>
                                                                <th className="px-4 py-3 font-black text-right">ድርጊት</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="text-xs divide-y divide-[#2a3038]">
                                                            {filteredPeriodTickets.length === 0 ? (
                                                                <tr><td colSpan={7} className="text-center py-8 text-slate-500 font-bold">በዚህ ቀን/ማጣሪያ የተገኘ ትኬት የለም</td></tr>
                                                            ) : (
                                                                filteredPeriodTickets.map((t: any, idx: number) => {
                                                                    const st = String(t.displayStatus || t.status || 'active').toLowerCase();
                                                                    const winAmt = Number(t.computedPotential ?? t.potential_win ?? 0);
                                                                    return (
                                                                        <tr key={idx} className="hover:bg-[#24292e] transition-colors">
                                                                            <td className="px-4 py-3 text-slate-400 font-medium">
                                                                                {new Date(t.created_at).toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' })}{' '}
                                                                                <span className="text-slate-300 font-bold">{new Date(t.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                                            </td>
                                                                            <td className="px-4 py-3 font-mono font-black text-[#ffcc00]">#{t.ticket_number}</td>
                                                                            <td className="px-4 py-3 font-bold text-white">{t.cashier || 'Shop'}</td>
                                                                            <td className="px-4 py-3 font-bold text-slate-200">{Number(t.stake_amount).toLocaleString()} Br</td>
                                                                            <td className="px-4 py-3 font-black text-[#00e700]">{winAmt.toLocaleString()} Br</td>
                                                                            <td className="px-4 py-3 font-bold">
                                                                                {st === 'paid' ? <span className="bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded text-[10px]">✅ ተከፍሏል (Paid)</span> :
                                                                                 st === 'won' ? <span className="bg-[#00e700]/20 text-[#00e700] px-2 py-0.5 rounded text-[10px]">🎉 ያሸነፈ (Unpaid)</span> :
                                                                                 st === 'lost' ? <span className="bg-red-500/20 text-red-400 px-2 py-0.5 rounded text-[10px]">❌ የተሸነፈ (Lost)</span> :
                                                                                 st === 'expired' ? <span className="bg-red-500/20 text-red-400 px-2 py-0.5 rounded text-[10px]">⏳ ውድቅ (Expired)</span> :
                                                                                 st === 'void' ? <span className="bg-slate-600/30 text-slate-400 px-2 py-0.5 rounded text-[10px]">🚫 የተሰረዘ (Void)</span> :
                                                                                 <span className="bg-[#ffcc00]/20 text-[#ffcc00] px-2 py-0.5 rounded text-[10px]">⏳ በሂደት ላይ</span>}
                                                                            </td>
                                                                            <td className="px-4 py-3 text-right">
                                                                                <button
                                                                                    onClick={() => setSelectedManageTicket({ ...t, displayStatus: st, computedPotential: winAmt })}
                                                                                    className="bg-[#111418] hover:bg-[#3b4148] border border-[#3b4148] text-white px-3 py-1 rounded text-[10px] font-bold"
                                                                                >
                                                                                    ዝርዝር እይ
                                                                                </button>
                                                                            </td>
                                                                        </tr>
                                                                    );
                                                                })
                                                            )}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>

                                            <div className="bg-gradient-to-r from-[#00bfff]/10 to-[#1e2328] border border-[#00bfff]/30 p-6 rounded-xl shadow-lg mb-8 flex flex-wrap justify-between items-center gap-4">
                                                <div>
                                                    <h2 className="text-lg font-bold text-[#00bfff] mb-1">📱 የኦንላይን ተጫዋቾች (Online Users) ሪፖርት</h2>
                                                    <p className="text-xs text-slate-400">እነዚህ በራሳቸው አካውንት ገብተው የሚጫወቱት ናቸው።</p>
                                                </div>
                                                <div className="flex gap-8 text-right">
                                                    <div>
                                                        <p className="text-xs font-bold text-slate-400 uppercase">ትኬት ብዛት</p>
                                                        <p className="text-xl font-black text-white">{effectiveReport.onlineStats?.tickets_sold || 0}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs font-bold text-slate-400 uppercase">ገቢ (Stake)</p>
                                                        <p className="text-xl font-black text-[#00e700]">{Number(effectiveReport.onlineStats?.revenue || 0).toLocaleString()} Br</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs font-bold text-slate-400 uppercase">ያሸነፉ (Payout)</p>
                                                        <p className="text-xl font-black text-red-400">{Number(effectiveReport.onlineStats?.payout || 0).toLocaleString()} Br</p>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="bg-[#1e2328] border border-red-500/30 rounded-xl shadow-lg overflow-hidden">
                                                <div className="px-6 py-4 border-b border-[#3b4148] bg-red-500/10">
                                                    <h2 className="text-lg font-bold text-red-400">⚠️ ያሸነፉ እና የተከፈሉ ትኬቶች ዝርዝር</h2>
                                                </div>
                                                <div className="overflow-x-auto">
                                                    <table className="w-full text-left border-collapse">
                                                        <thead>
                                                            <tr className="bg-[#1a1f24] text-[11px] uppercase tracking-widest text-slate-500">
                                                                <th className="px-6 py-4 font-black">ትኬት ቁጥር</th>
                                                                <th className="px-6 py-4 font-black">መነሻ (Source)</th>
                                                                <th className="px-6 py-4 font-black">የተመደበ (Stake)</th>
                                                                <th className="px-6 py-4 font-black">የበላው (Win)</th>
                                                                <th className="px-6 py-4 font-black">ሁኔታ (Status)</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="text-sm divide-y divide-[#2a3038]">
                                                            {effectiveReport.winningTickets.length === 0 ? (
                                                                <tr><td colSpan={5} className="text-center py-6 text-slate-500">በዚህ ጊዜ ውስጥ ምንም የተበላነው ሂሳብ የለም ማትረፍ ብቻ ነው! 🎉</td></tr>
                                                            ) : (
                                                                effectiveReport.winningTickets.map((ticket: any, i: number) => (
                                                                    <tr key={i} className="hover:bg-[#24292e] transition-colors">
                                                                        <td className="px-6 py-4 font-mono font-bold text-[#ffcc00]">#{ticket.ticket_number}</td>
                                                                        <td className="px-6 py-4 font-bold text-white">
                                                                            {ticket.role === 'user' ? (
                                                                                <span className="text-[#00bfff]">📱 ኦንላይን: {ticket.cashier}</span>
                                                                            ) : (
                                                                                <span className="text-slate-300">👤 ካሼር: {ticket.cashier || 'Shop'}</span>
                                                                            )}
                                                                        </td>
                                                                        <td className="px-6 py-4 text-slate-300">{Number(ticket.stake_amount).toLocaleString()} Br</td>
                                                                        <td className="px-6 py-4 font-black text-red-400">{Number(ticket.potential_win).toLocaleString()} Br</td>
                                                                        <td className="px-6 py-4 font-bold text-xs">
                                                                            {ticket.status === 'expired' ? (
                                                                                <span className="bg-red-500/20 text-red-500 px-2 py-1 rounded">⏳ ውድቅ (Expired)</span>
                                                                            ) : ticket.status === 'paid' ? (
                                                                                <span className="bg-blue-500/20 text-blue-400 px-2 py-1 rounded">✅ ተከፍሏል (Paid)</span>
                                                                            ) : (
                                                                                <span className="bg-[#00e700]/20 text-[#00e700] px-2 py-1 rounded">🎉 ያሸነፈ (Unpaid)</span>
                                                                            )}
                                                                        </td>
                                                                    </tr>
                                                                ))
                                                            )}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        </>
                                    );
                                })()}
                            </>
                        )}
                    </div>
                )}

                {/* 🌟 አዲሱ የትኬት ማኔጅመንት ታብ (Tickets Tab) 🌟 */}
                {activeTab === 'tickets' && (
                    <div className="max-w-6xl animate-fade-in-down">
                        <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
                            <div>
                                <h1 className="text-3xl font-black text-white mb-1">🎟️ የትኬት ማኔጅመንት</h1>
                                <p className="text-slate-400 text-sm">በሲስተሙ የተቆረጡ ትኬቶችን በየካሼሩ እና በሁኔታቸው (Status) ይቆጣጠሩ።</p>
                            </div>
                            <button
                                onClick={() => fetchTickets()}
                                className="bg-[#1e2328] hover:bg-[#24292e] border border-[#3b4148] text-[#ffcc00] px-4 py-2 rounded-lg text-xs font-bold transition"
                            >
                                🔄 ትኬቶችን አድስ
                            </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                            <div className="bg-[#1e2328] border border-[#3b4148] p-5 rounded-xl shadow-lg relative overflow-hidden">
                                <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">አጠቃላይ የሚጠበቅ ክፍያ</h3>
                                <p className="text-xl font-black text-white">{initialPotential.toLocaleString()} Br</p>
                                <p className="text-[9px] text-slate-500 mt-2">ሁሉም ቢበሉ (100% Win) ሊከፈል የሚችል</p>
                            </div>
                            <div className="bg-[#1e2328] border border-[#00e700]/30 p-5 rounded-xl shadow-lg relative overflow-hidden">
                                <h3 className="text-[11px] font-bold text-[#00e700] uppercase tracking-wider mb-2">የዳነው ብር (ከተሸነፉ)</h3>
                                <p className="text-xl font-black text-[#00e700]">{lostDeduction.toLocaleString()} Br</p>
                                <p className="text-[9px] text-slate-500 mt-2">ትኬቱ በመበላቱ ድርጅቱ ያተረፈው/የዳነው</p>
                            </div>
                            <div className="bg-gradient-to-r from-[#ffcc00]/10 to-[#1e2328] border border-[#ffcc00]/40 p-5 rounded-xl shadow-lg relative overflow-hidden">
                                <h3 className="text-[11px] font-bold text-[#ffcc00] uppercase tracking-wider mb-2">አሁን ያለንበት አደጋ (Risk)</h3>
                                <p className="text-2xl font-black text-[#ffcc00]">{currentRisk.toLocaleString()} Br</p>
                                <p className="text-[9px] text-[#ffcc00]/70 mt-2 font-bold flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-[#ffcc00] animate-pulse"></span> ሊያሸንፉ የሚችሉ Active
                                </p>
                            </div>
                            <div className="bg-[#1e2328] border border-blue-500/30 p-5 rounded-xl shadow-lg relative overflow-hidden">
                                <h3 className="text-[11px] font-bold text-blue-400 uppercase tracking-wider mb-2">የተከፈለ ብር (Paid Out)</h3>
                                <p className="text-2xl font-black text-blue-400">{totalPaidOut.toLocaleString()} Br</p>
                                <p className="text-[9px] text-slate-500 mt-2">ያሸነፉ እና ለደንበኛ የተከፈሉ ትኬቶች</p>
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-2 mb-6">
                            <button onClick={() => setTicketFilter('today')} className={`px-4 py-2 text-xs font-bold rounded-lg transition ${ticketFilter === 'today' ? 'bg-[#ffcc00] text-black shadow-md' : 'bg-[#1e2328] text-[#ffcc00] border border-[#ffcc00]/30 hover:bg-[#ffcc00]/10'}`}>📅 የዛሬ ትኬቶች ({computedTickets.filter(t => isTicketFromToday(t)).length})</button>
                            <button onClick={() => setTicketFilter('all')} className={`px-4 py-2 text-xs font-bold rounded-lg transition ${ticketFilter === 'all' ? 'bg-[#ffcc00] text-black shadow-md' : 'bg-[#1e2328] text-slate-400 border border-[#3b4148] hover:text-white'}`}>ሁሉንም አሳይ ({computedTickets.length})</button>
                            <button onClick={() => setTicketFilter('close_to_win')} className={`px-4 py-2 text-xs font-bold rounded-lg transition flex items-center gap-1.5 ${ticketFilter === 'close_to_win' ? 'bg-[#00bfff] text-white shadow-md border-[#00bfff]' : 'bg-[#1e2328] text-[#00bfff] border border-[#00bfff]/30 hover:bg-[#00bfff]/10'}`}>⚡ ጥቂት የቀረው (Close)</button>
                            <button onClick={() => setTicketFilter('high_stake')} className={`px-4 py-2 text-xs font-bold rounded-lg transition flex items-center gap-1.5 ${ticketFilter === 'high_stake' ? 'bg-purple-500 text-white shadow-md border-purple-500' : 'bg-[#1e2328] text-purple-400 border border-purple-500/30 hover:bg-purple-500/10'}`}>🔥 ትልቅ ብር (High Stake)</button>
                            <button onClick={() => setTicketFilter('won')} className={`px-4 py-2 text-xs font-bold rounded-lg transition ${ticketFilter === 'won' ? 'bg-[#00e700] text-black shadow-md border-[#00e700]' : 'bg-[#1e2328] text-[#00e700] border border-[#00e700]/30 hover:bg-[#00e700]/10'}`}>🎉 ያሸነፉ (Won)</button>
                            <button onClick={() => setTicketFilter('paid')} className={`px-4 py-2 text-xs font-bold rounded-lg transition ${ticketFilter === 'paid' ? 'bg-blue-500 text-white shadow-md border-blue-500' : 'bg-[#1e2328] text-blue-400 border border-blue-500/30 hover:bg-blue-500/10'}`}>✅ የተከፈሉ (Paid)</button>
                            <button onClick={() => setTicketFilter('lost')} className={`px-4 py-2 text-xs font-bold rounded-lg transition ${ticketFilter === 'lost' ? 'bg-red-500 text-white shadow-md border-red-500' : 'bg-[#1e2328] text-red-400 border border-red-500/30 hover:bg-red-500/10'}`}>❌ የተሸነፉ (Lost)</button>
                        </div>

                        {isFetchingTickets ? (
                            <div className="py-20 flex justify-center"><span className="w-10 h-10 border-4 border-[#3b4148] border-t-[#ffcc00] rounded-full animate-spin"></span></div>
                        ) : Object.keys(groupedTickets).length === 0 ? (
                            <div className="bg-[#1e2328] border border-[#3b4148] p-10 rounded-xl text-center">
                                <span className="text-4xl block mb-2 opacity-50">📭</span>
                                <p className="text-slate-400 font-bold">በዚህ ማጣሪያ መሰረት የተገኘ ትኬት የለም!</p>
                            </div>
                        ) : (
                            (Object.entries(groupedTickets) as [string, any[]][]).map(([cashierName, tList], idx) => {
                                const isOpen = expandedCashiers.includes(cashierName);
                                const cashierPaid = tList.filter(t => t.displayStatus === 'paid').reduce((sum, t) => sum + Number(t.computedPotential), 0);

                                return (
                                    <div key={idx} className="bg-[#1e2328] border border-[#3b4148] rounded-xl shadow-lg mb-6 overflow-hidden transition-all duration-300">
                                        <button 
                                            onClick={() => toggleCashier(cashierName)} 
                                            className="w-full bg-[#24292e] px-6 py-4 border-b border-[#3b4148] flex justify-between items-center transition-colors hover:bg-[#2a3038]"
                                        >
                                            <div className="flex items-center gap-4">
                                                <span className="bg-black/30 p-2.5 rounded-lg text-lg">👤</span>
                                                <div className="text-left">
                                                    <h2 className="text-sm font-black text-[#ffcc00] uppercase tracking-wide">{cashierName}</h2>
                                                    <p className="text-[11px] text-slate-400 mt-1 font-medium">የተከፈለ ብር: <span className="text-blue-400 font-black ml-1">{cashierPaid.toLocaleString()} Br</span></p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <span className="text-xs font-bold text-slate-400 bg-[#111418] px-4 py-1.5 rounded-full border border-[#3b4148] shadow-inner">{tList.length} ትኬቶች</span>
                                                <span className="text-slate-400 text-lg transition-transform">{isOpen ? '▲' : '▼'}</span>
                                            </div>
                                        </button>

                                        {isOpen && (
                                            <div className="overflow-x-auto bg-[#16191c] p-1">
                                                <table className="w-full text-left border-collapse">
                                                    <thead>
                                                        <tr className="bg-[#1a1f24] text-[10px] uppercase tracking-widest text-slate-500">
                                                            <th className="px-4 py-3 font-black">ቀን እና ሰዓት</th>
                                                            <th className="px-4 py-3 font-black">ትኬት ቁጥር</th>
                                                            <th className="px-4 py-3 font-black">የተመደበ (Stake)</th>
                                                            <th className="px-4 py-3 font-black">ሊበላ (Win)</th>
                                                            <th className="px-4 py-3 font-black">ሁኔታ (Status)</th>
                                                            <th className="px-4 py-3 font-black text-right">ድርጊት</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="text-xs divide-y divide-[#2a3038]">
                                                        {tList.map((ticket, tIdx) => {
                                                            const isHighStake = Number(ticket.stake_amount) >= 100;
                                                            const wonMatches = ticket.selections?.filter((s:any) => s.match_status === 'won').length || 0;
                                                            const pendingMatches = ticket.selections?.filter((s:any) => s.match_status === 'pending').length || 0;
                                                            const lostMatches = ticket.selections?.filter((s:any) => s.match_status === 'lost').length || 0;
                                                            const isCloseToWin = ticket.displayStatus === 'active' && lostMatches === 0 && pendingMatches > 0 && pendingMatches <= 2;

                                                            let statusDisplay = <span className="text-[#ffcc00]">⏳ Active</span>;
                                                            if (ticket.displayStatus === 'expired') {
                                                                statusDisplay = <span className="text-red-400 font-black">⏳ ጊዜው ያለፈ (Expired)</span>;
                                                            } else if (ticket.displayStatus === 'won') {
                                                                statusDisplay = <span className="text-[#00e700] font-black">🎉 ያሸነፈ</span>;
                                                            } else if (ticket.displayStatus === 'paid') {
                                                                statusDisplay = <span className="text-blue-400 font-black">✅ ተከፍሏል</span>;
                                                            } else if (ticket.displayStatus === 'lost') {
                                                                statusDisplay = <span className="text-red-500 font-black">❌ የተሸነፈ</span>;
                                                            } else if (ticket.displayStatus === 'void') {
                                                                statusDisplay = <span className="text-slate-500 font-black">🚫 የተሰረዘ</span>;
                                                            } else if (ticket.displayStatus === 'pending') {
                                                                statusDisplay = <span className="text-orange-400 font-black">⏳ በመጠባበቅ ላይ</span>;
                                                            }

                                                            return (
                                                                <tr key={tIdx} className="hover:bg-[#24292e] transition-colors">
                                                                    <td className="px-4 py-3 text-slate-400 font-medium">
                                                                        {new Date(ticket.created_at).toLocaleDateString([], { day:'2-digit', month:'short' })} <span className="text-[10px] ml-1">{new Date(ticket.created_at).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit'})}</span>
                                                                    </td>
                                                                    <td className="px-4 py-3 font-mono font-bold text-white flex items-center gap-2">
                                                                        {ticket.ticket_number}
                                                                        {isHighStake && <span title="High Stake" className="text-purple-400 text-sm">🔥</span>}
                                                                        {isCloseToWin && <span title="Close to Win" className="text-[#00bfff] text-sm">⚡</span>}
                                                                    </td>
                                                                    <td className={`px-4 py-3 font-bold ${isHighStake ? 'text-purple-400' : 'text-slate-300'}`}>{Number(ticket.stake_amount).toLocaleString()} Br</td>
                                                                    <td className="px-4 py-3 font-black text-[#00e700]">{Number(ticket.computedPotential).toLocaleString()} Br</td>
                                                                    <td className="px-4 py-3 font-bold">
                                                                        {statusDisplay}
                                                                    </td>
                                                                    <td className="px-4 py-3 text-right">
                                                                        <button onClick={() => setSelectedManageTicket(ticket)} className="bg-[#111418] hover:bg-[#3b4148] border border-[#3b4148] text-white px-3 py-1.5 rounded text-[10px] font-bold uppercase transition">
                                                                            ዝርዝር እይ
                                                                        </button>
                                                                    </td>
                                                                </tr>
                                                            )
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                )}

                {activeTab === 'staff' && (
                    <div className="max-w-4xl animate-fade-in-down">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            <div>
                                <h1 className="text-2xl font-black text-white mb-2">👥 አዲስ ሰራተኛ መመዝገቢያ</h1>
                                <p className="text-slate-400 mb-6 text-sm">ለካሼር ወይም ለሌላ አድሚን መግቢያ አካውንት ይፍጠሩ።</p>
                                <div className="bg-[#1e2328] border border-[#3b4148] p-6 rounded-xl shadow-lg">
                                    {staffMsg && (
                                        <div className={`p-4 rounded-lg mb-6 font-bold text-sm border ${staffMsg.type === 'success' ? 'bg-[#00e700]/10 border-[#00e700]/30 text-[#00e700]' : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>
                                            {staffMsg.text}
                                        </div>
                                    )}
                                    <form onSubmit={handleRegisterStaff} className="space-y-5">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-400 mb-2 uppercase">የሰራተኛው Username</label>
                                            <input type="text" value={newUsername} onChange={(e) => setNewUsername(e.target.value)} required placeholder="ምሳሌ: abebe_c1" className="w-full bg-[#111418] border border-[#3b4148] text-white px-4 py-3 rounded outline-none focus:border-[#ffcc00] transition-colors" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-400 mb-2 uppercase">የስራ ድርሻ (Role)</label>
                                            <select value={newRole} onChange={(e) => setNewRole(e.target.value)} className="w-full bg-[#111418] border border-[#3b4148] text-white px-4 py-3 rounded outline-none focus:border-[#ffcc00] transition-colors appearance-none">
                                                <option value="cashier">ካሼር (Cashier)</option>
                                                <option value="admin">አድሚን (Admin)</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-400 mb-2 uppercase">Password</label>
                                            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required placeholder="ቢያንስ 6 ፊደል/ቁጥር" className="w-full bg-[#111418] border border-[#3b4148] text-white px-4 py-3 rounded outline-none focus:border-[#ffcc00] transition-colors" />
                                        </div>
                                        <button type="submit" disabled={isLoading} className="w-full bg-[#ffcc00] hover:bg-[#e6b800] text-black font-black py-4 rounded-lg mt-2 transition active:scale-[0.98]">
                                            {isLoading ? 'እየመዘገበ ነው...' : 'አካውንቱን ፍጠር'}
                                        </button>
                                    </form>
                                </div>
                            </div>

                            <div>
                                <h1 className="text-2xl font-black text-white mb-2">📋 የተመዘገቡ ካሼሮች</h1>
                                <p className="text-slate-400 mb-6 text-sm">በሲስተሙ ውስጥ ያሉት ካሼሮች ዝርዝር</p>
                                <div className="bg-[#1e2328] border border-[#3b4148] rounded-xl shadow-lg overflow-hidden h-[450px] flex flex-col">
                                    <div className="px-6 py-4 border-b border-[#3b4148] bg-[#24292e]">
                                        <h2 className="text-sm font-bold text-white uppercase tracking-widest">የሰራተኞች ዝርዝር</h2>
                                    </div>
                                    <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                                        {staffList.length === 0 ? (
                                            <div className="h-full flex items-center justify-center text-slate-500">ምንም የተመዘገበ ሰራተኛ የለም</div>
                                        ) : (
                                            <div className="space-y-2">
                                                {staffList.map((staff, idx) => (
                                                    <div key={idx} className="bg-[#111418] border border-[#3b4148] p-4 rounded-lg flex items-center justify-between hover:border-[#ffcc00]/50 transition-colors">
                                                        <div className="flex items-center gap-4">
                                                            <div className="w-10 h-10 rounded-full bg-[#ffcc00]/20 text-[#ffcc00] font-black flex items-center justify-center text-lg uppercase">
                                                                {staff.username.charAt(0)}
                                                            </div>
                                                            <div>
                                                                <h4 className="font-bold text-white text-sm">{staff.username}</h4>
                                                                <p className="text-xs text-slate-500 uppercase tracking-widest">{staff.role}</p>
                                                            </div>
                                                        </div>
                                                        <div className="text-xs text-slate-400 text-right">
                                                            <p>የተመዘገበው</p>
                                                            <p className="font-bold">{new Date(staff.created_at).toLocaleDateString()}</p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'settings' && (
                    <div className="max-w-4xl animate-fade-in-down">
                        <h1 className="text-3xl font-black text-white mb-2">⚙️ ሲስተም ሴቲንግ</h1>
                        <p className="text-slate-400 mb-8">የስፖርት ዳታ (API-Football) ቁልፍን እና ሌሎች ማስተካከያዎችን ከዚህ ይቆጣጠሩ።</p>

                        <div className="bg-[#24292e] p-6 rounded-xl border border-[#3b4148] mb-8 shadow-md relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4 opacity-10 text-5xl">📊</div>
                            <h3 className="text-slate-400 font-bold text-xs uppercase mb-2">አሁን እየሰራ ያለው የ API ኮታ (Usage Limit)</h3>
                            <div className="flex justify-between items-end mb-3">
                                <span className="text-white font-black text-3xl">{apiUsage.used} <span className="text-sm font-bold text-slate-500">ጥያቄዎች ተጠቅመዋል</span></span>
                                <span className={`text-sm font-bold ${apiUsage.remaining < 50 ? 'text-red-400 animate-pulse' : 'text-[#00e700]'}`}>
                                    {apiUsage.remaining} ጥያቄ ቀርቷል
                                </span>
                            </div>
                            <div className="w-full bg-[#111418] rounded-full h-3 mb-2 border border-[#3b4148] overflow-hidden">
                                <div 
                                    className={`h-full rounded-full transition-all duration-1000 ${apiUsage.remaining < 50 ? 'bg-red-500' : 'bg-gradient-to-r from-[#ffcc00] to-[#e6b800]'}`} 
                                    style={{ width: `${Math.min((apiUsage.used / ((apiUsage.used + apiUsage.remaining) || 100)) * 100, 100)}%` }}
                                ></div>
                            </div>
                            <p className="text-[10px] text-slate-500">በየቀኑ የተወሰነ ነፃ ጥያቄ (API Requests) ይሰጣል። ሲያልቅ ወደ ቀጣዩ Key አውቶማቲክ ይቀየራል።</p>
                        </div>

                        <div className="bg-[#1e2328] border border-[#3b4148] p-8 rounded-xl shadow-lg">
                            <h2 className="text-lg font-bold text-white mb-6 border-b border-[#3b4148] pb-4 flex items-center gap-2">
                                🔑 የ API-Football ቁልፎች (Multiple Keys)
                            </h2>

                            {apiMsg && (
                                <div className={`p-4 rounded-lg mb-6 font-bold text-sm border ${apiMsg.type === 'success' ? 'bg-[#ffcc00]/10 border-[#ffcc00]/30 text-[#ffcc00]' : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>
                                    {apiMsg.text}
                                </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                {/* Left Side: Add API Key Form */}
                                <div className="bg-[#1a1f24] p-5 rounded-lg border border-[#3b4148] h-max">
                                    <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2"><span>➕</span> አዲስ API Key አስገባ</h3>
                                    <form onSubmit={handleAddKey} className="space-y-4">
                                        <input 
                                            type="text" 
                                            value={newApiKeyValue} 
                                            onChange={(e) => setNewApiKeyValue(e.target.value)} 
                                            required 
                                            placeholder="አዲስ የ API-Football ቁልፍ ያስገቡ..." 
                                            className="w-full bg-[#111418] border border-[#3b4148] text-white px-4 py-3 rounded outline-none focus:border-[#ffcc00] font-mono text-xs transition-colors" 
                                        />
                                        <button type="submit" disabled={isLoading} className="w-full bg-[#3b4148] hover:bg-[#464c54] text-white font-bold py-3.5 rounded-lg transition active:scale-[0.98] text-sm">
                                            {isLoading ? 'እየገባ ነው...' : 'አስገባ (Add Key)'}
                                        </button>
                                    </form>
                                    <p className="text-[10px] text-slate-500 mt-4 leading-relaxed">
                                        በርካታ ቁልፎችን ካስገቡ ሲስተሙ የላይኛውን ይጠቀማል። የላይኛው ኮታ (Limit) ሲያልቅ በራሱ ጊዜ አጥፍቶት ወደ ቀጣዩ ይሸጋገራል።
                                    </p>
                                </div>

                                {/* Right Side: API Keys Queue List */}
                                <div className="bg-[#1a1f24] p-5 rounded-lg border border-[#3b4148] h-[300px] flex flex-col">
                                    <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-2"><span>📋</span> የገቡ ቁልፎች (Queue)</h3>
                                    <p className="text-[10px] text-slate-400 mb-4 pb-3 border-b border-[#3b4148]">ከላይ ያለው (Active የሆነው) አልቆ ሲጠፋ ከታች ያሉት ወደ ላይ ይወጣሉ።</p>

                                    <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-2">
                                        {apiKeysList.length === 0 ? (
                                            <div className="h-full flex flex-col items-center justify-center text-slate-500 text-xs">
                                                <span className="text-2xl mb-2">📭</span>
                                                ምንም API Key አልተገኘም
                                            </div>
                                        ) : (
                                            apiKeysList.map((key, idx) => (
                                                <div key={idx} className="flex justify-between items-center bg-[#111418] border border-[#3b4148] p-3 rounded group hover:border-[#ffcc00]/50 transition-colors">
                                                    <div className="flex items-center gap-3 truncate pr-2">
                                                        {idx === 0 ? (
                                                            <span className="w-2.5 h-2.5 rounded-full bg-[#00e700] shadow-[0_0_8px_#00e700] animate-pulse shrink-0"></span>
                                                        ) : (
                                                            <span className="w-2.5 h-2.5 rounded-full bg-slate-600 shrink-0"></span>
                                                        )}
                                                        <span className={`font-mono text-[11px] truncate ${idx === 0 ? 'text-[#00e700] font-bold' : 'text-slate-400'}`}>
                                                            {key}
                                                        </span>
                                                    </div>
                                                    <button 
                                                        onClick={() => handleDeleteKey(idx)} 
                                                        className="text-slate-600 hover:text-red-500 bg-[#1e2328] hover:bg-red-500/10 p-1.5 rounded transition-colors shrink-0"
                                                        title="ይህንን ሰርዝ"
                                                    >
                                                        🗑️
                                                    </button>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="mt-10 border-t border-[#3b4148] pt-8">
                                <h2 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                                    🔄 ጨዋታዎችን አሁኑኑ አምጣ (Manual Sync)
                                </h2>
                                <div className="bg-[#111418] p-4 rounded-lg border border-[#3b4148] mb-6">
                                    <p className="text-sm text-slate-400 flex items-start gap-2 leading-relaxed">
                                        <span className="text-[#ffcc00] text-lg">💡</span>
                                        ሲስተሙ በየተወሰነ ሰዓት ራሱ ያዘምናል (አውቶማቲክ)። ነገር ግን አሁን ወዲያውኑ አዳዲስ ጨዋታዎችን ወደ ዳታቤዝ ማስገባት ከፈለጉ ከታች ያለውን በተን ይጫኑ።
                                    </p>
                                </div>
                                <button 
                                    onClick={handleManualSync} 
                                    disabled={isSyncing || apiKeysList.length === 0} 
                                    className="w-full bg-[#ffcc00] hover:bg-[#e6b800] text-black font-black py-4 rounded-lg transition active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
                                >
                                    {isSyncing ? (
                                        <>
                                            <span className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin"></span>
                                            ከ API በማምጣት ላይ... (ትንሽ ደቂቃዎች ሊወስድ ይችላል)
                                        </>
                                    ) : 'አሁኑኑ ጨዋታዎችን አምጣ (Sync Matches Now)'}
                                </button>
                            </div>

                        </div>
                    </div>
                )}
            </div>

            {/* 🌟 የትኬት ዝርዝር መመልከቻ ሞዳል (Manage Ticket Modal) 🌟 */}
            {selectedManageTicket && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in p-4 overflow-y-auto">
                    <div className="bg-[#1e2328] border border-[#3b4148] rounded-xl w-full max-w-lg shadow-2xl relative my-auto animate-fade-in-down flex flex-col max-h-[90vh]">
                        <div className="p-4 border-b border-[#3b4148] flex justify-between items-center bg-[#24292e] rounded-t-xl shrink-0">
                            <h2 className="text-[#ffcc00] font-black text-lg flex items-center gap-2"><span>🧾</span> ትኬት #{selectedManageTicket.ticket_number}</h2>
                            <button onClick={() => setSelectedManageTicket(null)} className="text-slate-400 hover:text-white text-2xl leading-none">✕</button>
                        </div>

                        <div className="p-4 pt-0 overflow-y-auto custom-scrollbar flex-1 mt-4">
                            <div className="bg-[#0d1117] border border-[#30363d] rounded-xl p-4 shadow-inner mb-4">
                                <div className="grid grid-cols-4 text-center text-xs border-b border-[#3b4148] pb-3 mb-3">
                                    <div><p className="text-slate-500 text-[10px] mb-1">Date</p><p className="text-white font-bold">{new Date(selectedManageTicket.created_at).toLocaleDateString([], { day: '2-digit', month: '2-digit' })}</p></div>
                                    <div><p className="text-slate-500 text-[10px] mb-1">Cashier</p><p className="text-white font-bold truncate px-1">{selectedManageTicket.cashier || 'Online'}</p></div>
                                    <div><p className="text-slate-500 text-[10px] mb-1">Amount</p><p className="text-white font-bold">{selectedManageTicket.stake_amount}</p></div>
                                    <div><p className="text-slate-500 text-[10px] mb-1">Win</p><p className="text-[#00e700] font-bold">{selectedManageTicket.computedPotential}</p></div>
                                </div>

                                <div className="flex justify-between items-center mb-2">
                                    <p className="text-xs font-bold text-slate-400">Events / Matches</p>
                                    {(() => {
                                        let modalStatusDisplay = <span className="bg-[#ffcc00]/20 text-[#ffcc00] px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest">⏳ Active</span>;
                                        
                                        if (selectedManageTicket.displayStatus === 'expired') {
                                            modalStatusDisplay = <span className="bg-red-400/20 text-red-400 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest">⏳ Expired</span>;
                                        } else if (selectedManageTicket.displayStatus === 'won') {
                                            modalStatusDisplay = <span className="bg-[#00e700]/20 text-[#00e700] px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest">🎉 Won</span>;
                                        } else if (selectedManageTicket.displayStatus === 'paid') {
                                            modalStatusDisplay = <span className="bg-blue-400/20 text-blue-400 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest">✅ Paid</span>;
                                        } else if (selectedManageTicket.displayStatus === 'lost') {
                                            modalStatusDisplay = <span className="bg-red-500/20 text-red-500 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest">❌ Lost</span>;
                                        } else if (selectedManageTicket.displayStatus === 'void') {
                                            modalStatusDisplay = <span className="bg-slate-500/20 text-slate-400 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest">🚫 Void</span>;
                                        } else if (selectedManageTicket.displayStatus === 'pending') {
                                            modalStatusDisplay = <span className="bg-orange-400/20 text-orange-400 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest">⏳ Pending Result</span>;
                                        }
                                        return modalStatusDisplay;
                                    })()}
                                </div>

                                <div className="space-y-2">
                                    {selectedManageTicket.selections?.map((item: any, i: number) => {
                                        const isWon = item.match_status === 'won';
                                        const isLost = item.match_status === 'lost';
                                        const isPostponed = (item.match_status === 'postponed' || item.match_status === 'cancelled' || item.match_status === 'abandoned' || item.match_status === 'PST' || item.match_status === 'CANC');

                                        const icon = isWon ? (
                                            <svg className="w-5 h-5 text-green-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                                        ) : isLost ? (
                                            <svg className="w-5 h-5 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
                                        ) : isPostponed ? (
                                            <span className="text-[#ffcc00] font-black text-xs">1.00</span>
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
                        </div>
                        <div className="p-4 border-t border-[#3b4148] bg-[#1e2328] rounded-b-xl shrink-0 flex justify-end">
                            <button onClick={() => setSelectedManageTicket(null)} className="bg-[#3b4148] hover:bg-[#4a515a] text-white text-xs font-bold px-6 py-2.5 rounded transition">ዝጋ (Close)</button>
                        </div>
                    </div>
                </div>
            )}

            <style jsx global>{`
                .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #3b4148; border-radius: 10px; }
                @keyframes fadeInDown { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
                .animate-fade-in-down { animation: fadeInDown 0.3s ease-out forwards; }
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                .animate-fade-in { animation: fadeIn 0.2s ease-out forwards; }
            `}</style>
        </div>
    );
}