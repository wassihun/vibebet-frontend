"use client";

import { useState, useEffect } from 'react';
import axios from 'axios';

export default function AdminDashboard() {
    const [token, setToken] = useState<string | null>(null);
    const [adminName, setAdminName] = useState('');
    const [loginUsername, setLoginUsername] = useState('');
    const [loginPassword, setLoginPassword] = useState('');
    const [loginError, setLoginError] = useState('');

    const [activeTab, setActiveTab] = useState<'dashboard' | 'staff' | 'settings' | 'reports'>('dashboard');

    const [newUsername, setNewUsername] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [newRole, setNewRole] = useState('cashier');
    const [staffMsg, setStaffMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    
    const [staffList, setStaffList] = useState<any[]>([]);

    // 🌟 አዲስ፡ የ API Keys ዝርዝር ስቴት 🌟
    const [apiKeysList, setApiKeysList] = useState<string[]>([]);
    const [newApiKeyValue, setNewApiKeyValue] = useState('');
    
    const [apiMsg, setApiMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    
    const [apiUsage, setApiUsage] = useState({ used: 0, remaining: 0 });
    
    const [isSyncing, setIsSyncing] = useState(false);
    const [totalMatches, setTotalMatches] = useState<number>(0);

    const [reportFilter, setReportFilter] = useState<'today' | 'month' | 'year'>('today');
    const [reports, setReports] = useState({
        totalTickets: 0,
        totalRevenue: 0,
        totalPayout: 0,
        activeOnlineUsers: 0,
        onlineStats: { tickets_sold: 0, winning_tickets_count: 0, revenue: 0, payout: 0 },
        cashierStats: [] as any[],
        winningTickets: [] as any[]
    });
    const [isFetchingReports, setIsFetchingReports] = useState(false);

    useEffect(() => {
        const savedToken = localStorage.getItem('adminToken');
        const savedUsername = localStorage.getItem('adminUsername');
        if (savedToken && savedUsername) {
            setToken(savedToken);
            setAdminName(savedUsername);
        }
    }, []);

    useEffect(() => {
        if (token && activeTab === 'settings') {
            fetchApiKeys();
            axios.get(`${process.env.NEXT_PUBLIC_API_URL}/api/matches/api-usage`).then(res => {
                if (res.data.success) setApiUsage(res.data.data);
            }).catch(() => {});
        }
        
        if (token && activeTab === 'dashboard') {
            axios.get(`${process.env.NEXT_PUBLIC_API_URL}/api/matches/list`).then(res => {
                if (res.data.success) setTotalMatches(res.data.data.length);
            }).catch(() => setTotalMatches(0));
            fetchReports(); 
        }

        if (token && activeTab === 'reports') {
            fetchReports();
        }

        if (token && activeTab === 'staff') {
            fetchStaffList();
        }
    }, [token, activeTab, reportFilter]);

    // 🌟 አዲስ፡ የገባውን የ API Keys ዝርዝር ያመጣል 🌟
    const fetchApiKeys = () => {
        axios.get(`${process.env.NEXT_PUBLIC_API_URL}/api/matches/get-api-key`).then(res => {
            if (res.data.success && res.data.api_key) {
                const keysArray = res.data.api_key.split(',').map((k: string) => k.trim()).filter((k: string) => k.length > 0);
                setApiKeysList(keysArray);
            } else {
                setApiKeysList([]);
            }
        }).catch(() => setApiKeysList([]));
    };

    const fetchReports = async () => {
        setIsFetchingReports(true);
        try {
            const res = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/api/tickets/reports/summary?filter=${reportFilter}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data.success) {
                setReports(res.data.data);
            }
        } catch (err) {
            console.error("ሪፖርት ማምጣት አልተቻለም");
        } finally {
            setIsFetchingReports(false);
        }
    };

    const fetchStaffList = async () => {
        try {
            const res = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/api/tickets/staff-list`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data.success) {
                setStaffList(res.data.data);
            }
        } catch (err) {
            console.error("ሰራተኞችን ማምጣት አልተቻለም");
        }
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoginError('');
        try {
            const res = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/login`, { username: loginUsername, password: loginPassword });
            if (res.data.success && res.data.user.role === 'admin') {
                setToken(res.data.token);
                setAdminName(res.data.user.username);
                localStorage.setItem('adminToken', res.data.token);
                localStorage.setItem('adminUsername', res.data.user.username);
            } else {
                setLoginError('ይህን ገጽ ለመጠቀም የአድሚን ፈቃድ ያስፈልጋል!');
            }
        } catch (err: any) {
            setLoginError(err.response?.data?.message || 'ሎጊን አልተሳካም');
        }
    };

    const handleLogout = () => {
        setToken(null);
        setAdminName('');
        localStorage.removeItem('adminToken');
        localStorage.removeItem('adminUsername');
    };

    const handleRegisterStaff = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setStaffMsg(null);
        try {
            const res = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/register-staff`, { username: newUsername, password: newPassword, role: newRole });
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

    // 🌟 አዲስ፡ ወደ ዳታቤዝ አዲሱን የKeys ዝርዝር (Array) ያስቀምጣል 🌟
    const saveKeysToBackend = async (keysArray: string[]) => {
        setIsLoading(true);
        setApiMsg(null);
        try {
            const keysStr = keysArray.join(',');
            await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/api/matches/update-api-key`, { api_key: keysStr });
            setApiKeysList(keysArray);
            setApiMsg({ type: 'success', text: '✅ የ API Keys ዝርዝር በተሳካ ሁኔታ ተዘምኗል!' });
        } catch (err: any) {
            setApiMsg({ type: 'error', text: 'ስህተት ተፈጥሯል' });
        } finally {
            setIsLoading(false);
        }
    };

    // አዲስ Key ሲገባ የሚጠራ
    const handleAddKey = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newApiKeyValue.trim()) return;
        const updatedList = [...apiKeysList, newApiKeyValue.trim()];
        saveKeysToBackend(updatedList);
        setNewApiKeyValue('');
    };

    // ከዝርዝሩ ላይ ሲሰረዝ የሚጠራ
    const handleDeleteKey = (indexToRemove: number) => {
        const updatedList = apiKeysList.filter((_, idx) => idx !== indexToRemove);
        saveKeysToBackend(updatedList);
    };

    const handleManualSync = async () => {
        setIsSyncing(true);
        setApiMsg({ type: 'success', text: '⏳ አዳዲስ ጨዋታዎችን ከ API በማምጣት ላይ... እባክዎ ትንሽ ይጠብቁ' });
        try {
            const res = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/api/matches/manual-sync`);
            setApiMsg({ type: 'success', text: res.data.message });
            
            axios.get(`${process.env.NEXT_PUBLIC_API_URL}/api/matches/list`).then(r => {
                if (r.data.success) setTotalMatches(r.data.data.length);
            });
            // ሲያመጣ ኮታ ስለሚበላ የ API Usageን ዳግም ይጠይቃል
            axios.get(`${process.env.NEXT_PUBLIC_API_URL}/api/matches/api-usage`).then(r => {
                if (r.data.success) setApiUsage(r.data.data);
            }).catch(() => {});
            // ከዳታቤዝ አዲስ የ Keys ዝርዝር ያመጣል (ካለቀ እያጠፋ ስለሚሄድ)
            fetchApiKeys();
        } catch (err: any) {
            setApiMsg({ type: 'error', text: 'ዳታ ማምጣት አልተቻለም! የገቡት Keys ሁሉም አልቀው ሊሆን ይችላል።' });
            fetchApiKeys(); // ያለቁት ጠፍተው ሊሆን ስለሚችል አሁንም ሪፍሬሽ እናደርጋለን
        } finally {
            setIsSyncing(false);
        }
    };

    if (!token) {
        return (
            <div className="min-h-screen bg-[#111418] flex items-center justify-center font-sans">
                <div className="bg-[#1e2328] p-10 rounded-xl shadow-2xl border border-[#3b4148] w-[400px] relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-2 bg-[#ffcc00]"></div>
                    <div className="text-center mb-8 mt-2">
                        <div className="w-16 h-16 bg-[#ffcc00]/10 rounded-full mx-auto flex items-center justify-center mb-4 border border-[#ffcc00]/20">
                            <span className="text-2xl">🔒</span>
                        </div>
                        <h2 className="text-3xl font-black text-white tracking-wide">VIBE <span className="text-[#ffcc00]">BET</span></h2>
                        <p className="text-slate-400 text-sm mt-1">Super User Portal</p>
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
                        <button type="submit" className="w-full bg-[#ffcc00] hover:bg-[#e6b800] text-black font-black py-3.5 rounded mt-4 transition transform active:scale-95">ግባ (LOGIN)</button>
                    </form>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#111418] text-slate-300 font-sans flex">
            {/* Sidebar */}
            <div className="w-64 bg-[#1e2328] border-r border-[#3b4148] p-6 flex flex-col relative z-10 shadow-[4px_0_24px_rgba(0,0,0,0.2)]">
                <div className="mb-10">
                    <h2 className="text-2xl font-black text-white">VIBE <span className="text-[#ffcc00]">BET</span></h2>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">Admin Panel</p>
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
            <div className="flex-1 p-10 overflow-y-auto">
                
                {activeTab === 'dashboard' && (
                    <div className="max-w-5xl animate-fade-in-down">
                        <h1 className="text-3xl font-black text-white mb-2">📊 ዳሽቦርድ</h1>
                        <p className="text-slate-400 mb-8">የሲስተምዎን አጠቃላይ ሁኔታዎች እና እንቅስቃሴዎች ይከታተሉ።</p>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                            <div className="bg-[#1e2328] border border-[#3b4148] p-6 rounded-xl shadow-lg relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-4 opacity-10 text-5xl">⚽</div>
                                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">በሲስተሙ ያሉ ጨዋታዎች</h3>
                                <p className="text-4xl font-black text-white">{totalMatches}</p>
                                <p className="text-xs text-[#00e700] mt-2 font-bold flex items-center gap-1">
                                    <span className="w-2 h-2 rounded-full bg-[#00e700] animate-pulse"></span> Active
                                </p>
                            </div>
                            
                            <div className="bg-[#1e2328] border border-[#3b4148] p-6 rounded-xl shadow-lg relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-4 opacity-10 text-5xl">🌐</div>
                                <h3 className="text-xs font-bold text-[#00bfff] uppercase tracking-wider mb-2">የተመዘገቡ ኦንላይን ተጫዋቾች</h3>
                                <p className="text-4xl font-black text-white">{reports.activeOnlineUsers}</p>
                                <p className="text-xs text-slate-400 mt-2">በሲስተሙ ላይ የሚጫወቱ</p>
                            </div>

                            <div className="bg-[#1e2328] border border-[#3b4148] p-6 rounded-xl shadow-lg relative overflow-hidden flex flex-col justify-center items-center text-center">
                                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">ፈጣን እርምጃዎች</h3>
                                <button 
                                    onClick={() => setActiveTab('settings')}
                                    className="bg-[#ffcc00]/10 hover:bg-[#ffcc00]/20 text-[#ffcc00] border border-[#ffcc00]/30 px-6 py-2 rounded-full font-bold text-xs transition-colors"
                                >
                                    API ያዘምኑ (Sync Now)
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'reports' && (
                    <div className="max-w-6xl animate-fade-in-down">
                        <div className="flex justify-between items-end mb-8">
                            <div>
                                <h1 className="text-3xl font-black text-white mb-2">📈 የፋይናንስ እና ስራ ሪፖርት</h1>
                                <p className="text-slate-400">የገቢ፣ የተሸጡ ትኬቶች እና የተበሉ ሂሳቦችን በካሼር ይከታተሉ።</p>
                            </div>
                            <div className="flex bg-[#1e2328] border border-[#3b4148] rounded-lg overflow-hidden">
                                <button onClick={() => setReportFilter('today')} className={`px-5 py-2 text-sm font-bold transition ${reportFilter === 'today' ? 'bg-[#ffcc00] text-black' : 'text-slate-400 hover:text-white hover:bg-[#24292e]'}`}>የዛሬ</button>
                                <button onClick={() => setReportFilter('month')} className={`px-5 py-2 text-sm font-bold border-l border-[#3b4148] transition ${reportFilter === 'month' ? 'bg-[#ffcc00] text-black' : 'text-slate-400 hover:text-white hover:bg-[#24292e]'}`}>የወሩ</button>
                                <button onClick={() => setReportFilter('year')} className={`px-5 py-2 text-sm font-bold border-l border-[#3b4148] transition ${reportFilter === 'year' ? 'bg-[#ffcc00] text-black' : 'text-slate-400 hover:text-white hover:bg-[#24292e]'}`}>የዓመቱ</button>
                            </div>
                        </div>

                        <div className="bg-blue-500/10 border border-blue-500/30 p-4 rounded-lg mb-6 flex items-start gap-3">
                            <span className="text-blue-400 text-xl">ℹ️</span>
                            <p className="text-sm text-blue-200">
                                <strong className="text-white block mb-1">የ24 ሰዓት የትኬት ህግ (Expiration Policy):</strong>
                                ማንም ሰው በ <strong className="text-white">ገስት (Guest)</strong> ከቆረጠ ካሼሩ እስኪያረጋግጠው ድረስ ትኬቱ አይሰራም (Invalid)። ያሸነፈ ትኬት ደግሞ በ 24 ሰዓት ውስጥ መከፈል አለበት፣ ካልተከፈለ ሲስተሙ በራሱ ጊዜ <span className="text-red-400 font-bold">ውድቅ (Expired)</span> ያደርገዋል፤ ብሩም ለአድሚኑ ገቢ ይሆናል።
                            </p>
                        </div>

                        {isFetchingReports ? (
                            <div className="py-20 flex justify-center"><span className="w-10 h-10 border-4 border-[#3b4148] border-t-[#ffcc00] rounded-full animate-spin"></span></div>
                        ) : (
                            <>
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                                    <div className="bg-[#1e2328] border border-[#3b4148] p-6 rounded-xl shadow-lg">
                                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">የተሸጠ ትኬት ብዛት</h3>
                                        <p className="text-3xl font-black text-white">{reports.totalTickets}</p>
                                    </div>
                                    <div className="bg-[#1e2328] border border-[#3b4148] p-6 rounded-xl shadow-lg relative overflow-hidden">
                                        <div className="absolute top-0 right-0 p-3 opacity-10 text-4xl">💰</div>
                                        <h3 className="text-xs font-bold text-[#ffcc00] uppercase tracking-wider mb-2">የትኬት ክፍያ (10 ብር)</h3>
                                        <p className="text-3xl font-black text-[#ffcc00]">{(reports.totalTickets * 10).toLocaleString()} Br</p>
                                    </div>
                                    <div className="bg-[#1e2328] border border-[#3b4148] p-6 rounded-xl shadow-lg">
                                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">ገቢ (Stake)</h3>
                                        <p className="text-3xl font-black text-[#00e700]">{reports.totalRevenue.toLocaleString()} Br</p>
                                    </div>
                                    <div className="bg-[#1e2328] border border-[#3b4148] p-6 rounded-xl shadow-lg">
                                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">የተበላነው (Payout)</h3>
                                        <p className="text-3xl font-black text-red-500">{reports.totalPayout.toLocaleString()} Br</p>
                                    </div>
                                </div>

                                <div className="bg-gradient-to-r from-[#00bfff]/10 to-[#1e2328] border border-[#00bfff]/30 p-6 rounded-xl shadow-lg mb-8 flex justify-between items-center">
                                    <div>
                                        <h2 className="text-lg font-bold text-[#00bfff] mb-1">📱 የኦንላይን ተጫዋቾች (Online Users) ሪፖርት</h2>
                                        <p className="text-xs text-slate-400">እነዚህ በራሳቸው አካውንት ገብተው የሚጫወቱት ናቸው።</p>
                                    </div>
                                    <div className="flex gap-8 text-right">
                                        <div>
                                            <p className="text-xs font-bold text-slate-400 uppercase">ትኬት ቁጥር</p>
                                            <p className="text-xl font-black text-white">{reports.onlineStats?.tickets_sold || 0}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-slate-400 uppercase">ገቢ (Stake)</p>
                                            <p className="text-xl font-black text-[#00e700]">{Number(reports.onlineStats?.revenue || 0).toLocaleString()} Br</p>
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-slate-400 uppercase">ያሸነፉ (Payout)</p>
                                            <p className="text-xl font-black text-red-400">{Number(reports.onlineStats?.payout || 0).toLocaleString()} Br</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-[#1e2328] border border-[#3b4148] rounded-xl shadow-lg mb-8 overflow-hidden">
                                    <div className="px-6 py-4 border-b border-[#3b4148] bg-[#24292e]">
                                        <h2 className="text-lg font-bold text-white">👨‍💼 የካሼሮች የስራ ሪፖርት (Performance)</h2>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="bg-[#1a1f24] text-[11px] uppercase tracking-widest text-slate-500">
                                                    <th className="px-6 py-4 font-black">ካሼር ስም</th>
                                                    <th className="px-6 py-4 font-black">የተሸጠ ትኬት</th>
                                                    <th className="px-6 py-4 font-black">ያሸነፈ ትኬት</th>
                                                    <th className="px-6 py-4 font-black text-[#ffcc00]">የትኬት ክፍያ ስብስብ (10 ብር)</th>
                                                    <th className="px-6 py-4 font-black text-[#00e700]">ገቢ (Stake)</th>
                                                    <th className="px-6 py-4 font-black text-red-400">ያከሳረው / የተበላው</th>
                                                </tr>
                                            </thead>
                                            <tbody className="text-sm divide-y divide-[#2a3038]">
                                                {reports.cashierStats.length === 0 ? (
                                                    <tr><td colSpan={6} className="text-center py-6 text-slate-500">ምንም የካሼር መረጃ የለም</td></tr>
                                                ) : (
                                                    reports.cashierStats.map((stat, i) => (
                                                        <tr key={i} className="hover:bg-[#24292e] transition-colors">
                                                            <td className="px-6 py-4 font-bold text-white flex items-center gap-2">
                                                                <span className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-xs">👤</span>
                                                                {stat.cashier}
                                                            </td>
                                                            <td className="px-6 py-4 text-slate-300">{stat.tickets_sold} ትኬቶች</td>
                                                            <td className="px-6 py-4 font-bold text-red-400">{stat.winning_tickets_count} ትኬቶች</td>
                                                            <td className="px-6 py-4 font-black text-[#ffcc00]">{(stat.tickets_sold * 10).toLocaleString()} Br</td>
                                                            <td className="px-6 py-4 font-black text-[#00e700]">{Number(stat.revenue).toLocaleString()} Br</td>
                                                            <td className="px-6 py-4 font-black text-red-400">{Number(stat.payout).toLocaleString()} Br</td>
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                <div className="bg-[#1e2328] border border-red-500/30 rounded-xl shadow-lg overflow-hidden">
                                    <div className="px-6 py-4 border-b border-[#3b4148] bg-red-500/10">
                                        <h2 className="text-lg font-bold text-red-400">⚠️ የተበላንባቸው (ያሸነፉ) ትኬቶች ዝርዝር</h2>
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
                                                {reports.winningTickets.length === 0 ? (
                                                    <tr><td colSpan={5} className="text-center py-6 text-slate-500">በዚህ ጊዜ ውስጥ ምንም የተበላነው ሂሳብ የለም ማትረፍ ብቻ ነው! 🎉</td></tr>
                                                ) : (
                                                    reports.winningTickets.map((ticket, i) => (
                                                        <tr key={i} className="hover:bg-[#24292e] transition-colors">
                                                            <td className="px-6 py-4 font-mono font-bold text-[#ffcc00]">{ticket.ticket_number}</td>
                                                            <td className="px-6 py-4 font-bold text-white">
                                                                {ticket.role === 'user' ? (
                                                                    <span className="text-[#00bfff]">📱 ኦንላይን: {ticket.cashier}</span>
                                                                ) : (
                                                                    <span className="text-slate-300">👤 ካሼር: {ticket.cashier || 'Guest'}</span>
                                                                )}
                                                            </td>
                                                            <td className="px-6 py-4 text-slate-300">{Number(ticket.stake_amount).toLocaleString()} Br</td>
                                                            <td className="px-6 py-4 font-black text-red-400">{Number(ticket.potential_win).toLocaleString()} Br</td>
                                                            <td className="px-6 py-4 font-bold text-xs">
                                                                {ticket.status === 'expired' 
                                                                    ? <span className="bg-red-500/20 text-red-500 px-2 py-1 rounded">ውድቅ (Expired)</span> 
                                                                    : <span className="bg-green-500/20 text-green-500 px-2 py-1 rounded">Active</span>}
                                                            </td>
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </>
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
                        <p className="text-slate-400 mb-8">የስፖርት ዳታ (Odds API) ቁልፍን እና ሌሎች ማስተካከያዎችን ከዚህ ይቆጣጠሩ。</p>

                        {/* 🌟 አዲስ፡ የ API Usage የሚያሳይ ውብ ቦርድ 🌟 */}
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
                                    style={{ width: `${Math.min((apiUsage.used / 500) * 100, 100)}%` }}
                                ></div>
                            </div>
                            <p className="text-[10px] text-slate-500">በየወሩ 500 ነፃ ጥያቄ ይሰጣል። ሲያልቅ ወደ ቀጣዩ Key አውቶማቲክ ይቀየራል።</p>
                        </div>

                        <div className="bg-[#1e2328] border border-[#3b4148] p-8 rounded-xl shadow-lg">
                            <h2 className="text-lg font-bold text-white mb-6 border-b border-[#3b4148] pb-4 flex items-center gap-2">
                                🔑 የ The Odds API ቁልፎች (Multiple Keys)
                            </h2>
                            
                            {apiMsg && (
                                <div className={`p-4 rounded-lg mb-6 font-bold text-sm border ${apiMsg.type === 'success' ? 'bg-[#ffcc00]/10 border-[#ffcc00]/30 text-[#ffcc00]' : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>
                                    {apiMsg.text}
                                </div>
                            )}

                            {/* 🌟 አዲስ፡ በግራም በቀኝም (Grid) የተሰራ የAPI ማስገቢያ እና መደርደሪያ 🌟 */}
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
                                            placeholder="አዲስ የ API ቁልፍ (Key) ያስገቡ..." 
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
                                        ሲስተሙ በየ 30 ደቂቃው ራሱ ያዘምናል (አውቶማቲክ)። ነገር ግን አሁን ወዲያውኑ አዳዲስ ጨዋታዎችን ወደ ዳታቤዝ ማስገባት ከፈለጉ ከታች ያለውን በተን ይጫኑ።
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

            <style jsx global>{`
                .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #3b4148; border-radius: 10px; }
                @keyframes fadeInDown { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
                .animate-fade-in-down { animation: fadeInDown 0.3s ease-out forwards; }
            `}</style>
        </div>
    );
}
