"use client";

import { useState, useEffect } from 'react';
import axios from 'axios';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export default function ProfilePage() {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<'dashboard' | 'deposit' | 'withdraw' | 'history'>('dashboard');
    
    const [user, setUser] = useState<any>(null);
    const [token, setToken] = useState<string | null>(null);
    
    // የትኬት እና የትራንዛክሽን ታሪክ ስቴት
    const [betHistory, setBetHistory] = useState<any[]>([]);
    const [transactions, setTransactions] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // የክፍያ (Deposit/Withdraw) ፎርም ስቴት
    const [amount, setAmount] = useState<string>('');
    const [reference, setReference] = useState<string>('');
    const [paymentMethod, setPaymentMethod] = useState<string>('telebirr');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [paymentMessage, setPaymentMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    useEffect(() => {
        // 1. ዌብሳይቱ ሲከፈት ተጠቃሚው ሎጊን ማድረጉን ማረጋገጥ
        const storedToken = localStorage.getItem('vibebet_token');
        
        if (!storedToken) {
            router.push('/'); // ሎጊን ካላደረገ ወደ ዋናው ገጽ ይመልሰዋል
            return;
        }

        setToken(storedToken);

        const fetchAllData = async () => {
            try {
                // User Balance ማምጣት
                const balanceRes = await axios.get(`${API_BASE}/api/wallet/balance`, {
                    headers: { Authorization: `Bearer ${storedToken}` }
                });

                // User Info ማረጋገጥ (ከ token)
                const userRes = await axios.get(`${API_BASE}/api/auth/verify`, {
                    headers: { Authorization: `Bearer ${storedToken}` }
                });

                if (userRes.data.success) {
                    setUser({ ...userRes.data.user, current_balance: balanceRes.data.balance || 0 });
                }

                // የትኬት ታሪክ ማምጣት
                const historyRes = await axios.get(`${API_BASE}/api/tickets/history`, {
                    headers: { Authorization: `Bearer ${storedToken}` }
                });
                if (historyRes.data.success) {
                    setBetHistory(historyRes.data.data);
                }

                // የትራንዛክሽን ታሪክ ማምጣት
                const transRes = await axios.get(`${API_BASE}/api/wallet/history`, {
                    headers: { Authorization: `Bearer ${storedToken}` }
                });
                if (transRes.data.success) {
                    setTransactions(transRes.data.data);
                }

            } catch (err) {
                console.error("ዳታ ማምጣት አልተቻለም", err);
                if (axios.isAxiosError(err) && err.response?.status === 401) {
                    localStorage.removeItem('vibebet_token');
                    router.push('/');
                }
            } finally {
                setIsLoading(false);
            }
        };

        fetchAllData();
    }, [router]);

    // ገንዘብ ማስገቢያ (Deposit) መላክ
    const handleDeposit = async (e: React.FormEvent) => {
        e.preventDefault();
        setPaymentMessage(null);
        if (Number(amount) < 50) {
            setPaymentMessage({ type: 'error', text: 'ቢያንስ 50 ብር ማስገባት ያስፈልጋል!' });
            return;
        }
        setIsSubmitting(true);
        try {
            const res = await axios.post(`${API_BASE}/api/wallet/deposit`, 
                { amount: Number(amount), reference_id: reference },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            if (res.data.success) {
                setPaymentMessage({ type: 'success', text: res.data.message });
                setAmount('');
                setReference('');
            }
        } catch (err: any) {
            setPaymentMessage({ type: 'error', text: err.response?.data?.message || 'ጥያቄውን መላክ አልተቻለም!' });
        } finally {
            setIsSubmitting(false);
        }
    };

    // ገንዘብ ማውጫ (Withdraw) መላክ
    const handleWithdraw = async (e: React.FormEvent) => {
        e.preventDefault();
        setPaymentMessage(null);
        if (Number(amount) < 100) {
            setPaymentMessage({ type: 'error', text: 'ቢያንስ 100 ብር ማውጣት ያስፈልጋል!' });
            return;
        }
        if (Number(amount) > user.current_balance) {
            setPaymentMessage({ type: 'error', text: 'በቂ ባላንስ የሎትም!' });
            return;
        }
        setIsSubmitting(true);
        try {
            const res = await axios.post(`${API_BASE}/api/wallet/withdraw`, 
                { amount: Number(amount), reference_id: reference },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            if (res.data.success) {
                setPaymentMessage({ type: 'success', text: res.data.message });
                setUser({ ...user, current_balance: user.current_balance - Number(amount) });
                setAmount('');
                setReference('');
            }
        } catch (err: any) {
            setPaymentMessage({ type: 'error', text: err.response?.data?.message || 'ጥያቄውን መላክ አልተቻለም!' });
        } finally {
            setIsSubmitting(false);
        }
    };

    // ዩዘር ዳታው እስኪመጣ ሎዲንግ እናሳያለን
    if (!user && isLoading) return <div className="min-h-screen bg-[#1c2024] flex items-center justify-center text-[#ffcc00] font-bold">Loading Profile...</div>;
    if (!user) return null;

    return (
        <div className="min-h-screen bg-[#1c2024] text-slate-300 font-sans">
            
            {/* Header */}
            <header className="bg-[#ffcc00] border-b border-[#e6b800] sticky top-0 z-30">
                <div className="max-w-[1200px] mx-auto px-4 h-16 flex items-center justify-between">
                    <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition">
                        <div className="w-11 h-11 shrink-0 rounded-[10px] overflow-hidden shadow-sm border border-black/10 bg-[#1c2024] p-1.5 flex items-center justify-center">
                            <img src="/icon.svg" alt="Vibe Bet" className="w-full h-full object-contain" />
                        </div>
                        <h1 className="text-xl font-black text-black tracking-tight italic">VIBE<span className="font-bold text-black/70 ml-1">BET</span></h1>
                    </Link>
                    <Link href="/" className="text-xs font-bold text-[#ffcc00] hover:bg-[#1a1a1a] bg-[#0a0a0a] px-4 py-2 rounded-lg border border-black shadow-md transition-colors">
                        ← ወደ ዋናው ገጽ
                    </Link>
                </div>
            </header>

            <div className="max-w-[1200px] mx-auto flex flex-col md:flex-row gap-6 p-4 pt-8">
                
                {/* የግራ ሜኑ (Sidebar) */}
                <div className="w-full md:w-64 shrink-0">
                    <div className="bg-[#1e2328] rounded-2xl border border-[#2a3038] p-6 mb-4 text-center shadow-lg">
                        <div className="w-20 h-20 bg-[#16191c] rounded-full mx-auto mb-4 flex items-center justify-center text-3xl border-2 border-[#ffcc00] uppercase font-black text-white">
                            {user.username?.charAt(0) || 'U'}
                        </div>
                        <h2 className="text-xl font-black text-white mb-1 uppercase">{user.username}</h2>
                        <p className="text-xs text-slate-400 font-bold mb-2">{user.phone}</p>
                        <div className="bg-[#00e700]/10 border border-[#00e700]/30 rounded-lg p-2 mt-3">
                            <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Balance</p>
                            <p className="text-xl text-[#00e700] font-black">{Number(user.current_balance || 0).toFixed(2)} Br</p>
                        </div>
                    </div>

                    <div className="bg-[#1e2328] rounded-2xl border border-[#2a3038] overflow-hidden shadow-lg text-sm">
                        <button onClick={() => { setActiveTab('dashboard'); setPaymentMessage(null); }} className={`w-full text-left px-6 py-4 font-bold border-b border-[#2a3038] transition-colors ${activeTab === 'dashboard' ? 'bg-[#ffcc00]/10 text-[#ffcc00] border-l-4 border-l-[#ffcc00]' : 'text-slate-400 hover:bg-[#24292e] hover:text-white'}`}>
                            📊 ዳሽቦርድ (Overview)
                        </button>
                        <button onClick={() => { setActiveTab('deposit'); setPaymentMessage(null); }} className={`w-full text-left px-6 py-4 font-bold border-b border-[#2a3038] transition-colors ${activeTab === 'deposit' ? 'bg-[#ffcc00]/10 text-[#ffcc00] border-l-4 border-l-[#ffcc00]' : 'text-slate-400 hover:bg-[#24292e] hover:text-white'}`}>
                            💰 ገንዘብ አስገባ (Deposit)
                        </button>
                        <button onClick={() => { setActiveTab('withdraw'); setPaymentMessage(null); }} className={`w-full text-left px-6 py-4 font-bold border-b border-[#2a3038] transition-colors ${activeTab === 'withdraw' ? 'bg-[#ffcc00]/10 text-[#ffcc00] border-l-4 border-l-[#ffcc00]' : 'text-slate-400 hover:bg-[#24292e] hover:text-white'}`}>
                            💸 ገንዘብ አውጣ (Withdraw)
                        </button>
                        <button onClick={() => { setActiveTab('history'); setPaymentMessage(null); }} className={`w-full text-left px-6 py-4 font-bold transition-colors ${activeTab === 'history' ? 'bg-[#ffcc00]/10 text-[#ffcc00] border-l-4 border-l-[#ffcc00]' : 'text-slate-400 hover:bg-[#24292e] hover:text-white'}`}>
                            📝 የትኬት ታሪክ (History)
                        </button>
                    </div>
                </div>

                {/* መካከለኛው ዋና ክፍል (Main Content Area) */}
                <div className="flex-1">
                    
                    {/* ዳሽቦርድ (Overview) */}
                    {activeTab === 'dashboard' && (
                        <div className="space-y-6 animate-fade-in-up">
                            <h2 className="text-2xl font-bold text-white mb-6">የሂሳብ ማጠቃለያ</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="bg-gradient-to-br from-[#1e2328] to-[#16191c] rounded-2xl p-6 border border-[#2a3038] shadow-xl relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-[#ffcc00]/5 rounded-full -mr-10 -mt-10 blur-xl"></div>
                                    <p className="text-slate-400 font-bold mb-2 text-xs uppercase tracking-wider">አጠቃላይ ቀሪ ሂሳብ</p>
                                    <h3 className="text-4xl font-black text-[#00e700]">{Number(user.current_balance || 0).toFixed(2)} <span className="text-lg text-slate-500">ETB</span></h3>
                                    <div className="mt-8 flex gap-3">
                                        <button onClick={() => setActiveTab('deposit')} className="flex-1 bg-[#ffcc00] hover:bg-[#e6b800] text-black font-black py-2.5 rounded-lg transition text-sm shadow-md">Deposit</button>
                                        <button onClick={() => setActiveTab('withdraw')} className="flex-1 bg-[#2a3038] hover:bg-[#3b4148] border border-[#3b4148] text-white font-bold py-2.5 rounded-lg transition text-sm">Withdraw</button>
                                    </div>
                                </div>
                                <div className="bg-[#1e2328] rounded-2xl p-6 border border-[#2a3038] shadow-xl flex flex-col justify-center">
                                    <p className="text-slate-400 font-bold mb-4 text-xs uppercase tracking-wider">የመለያ መረጃዎች</p>
                                    <div className="space-y-4 text-sm">
                                        <div className="flex justify-between border-b border-[#3b4148] pb-2">
                                            <span className="text-slate-500">Username:</span>
                                            <span className="text-white font-bold">{user.username}</span>
                                        </div>
                                        <div className="flex justify-between border-b border-[#3b4148] pb-2">
                                            <span className="text-slate-500">Phone:</span>
                                            <span className="text-white font-bold">{user.phone}</span>
                                        </div>
                                        <div className="flex justify-between border-b border-[#3b4148] pb-2">
                                            <span className="text-slate-500">Status:</span>
                                            <span className="text-[#00e700] font-bold bg-[#00e700]/10 px-2 py-0.5 rounded text-xs uppercase">Active</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            {/* የቅርብ ጊዜ ትራንዛክሽኖች */}
                            {transactions.length > 0 && (
                                <div className="bg-[#1e2328] rounded-2xl border border-[#2a3038] shadow-xl overflow-hidden mt-6">
                                    <div className="p-4 border-b border-[#2a3038]">
                                        <h3 className="text-lg font-bold text-white">የቅርብ ጊዜ ዝውውሮች (Recent Transactions)</h3>
                                    </div>
                                    <div className="p-4 flex flex-col gap-3">
                                        {transactions.slice(0, 5).map((tx, idx) => (
                                            <div key={idx} className="flex justify-between items-center bg-[#16191c] p-3 rounded-lg border border-[#3b4148]">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-lg ${
                                                        tx.transaction_type.includes('deposit') || tx.transaction_type.includes('winning') || tx.transaction_type.includes('refund') ? 'bg-[#00e700]/20 text-[#00e700]' : 'bg-red-500/20 text-red-500'
                                                    }`}>
                                                        {tx.transaction_type.includes('deposit') ? '↓' : tx.transaction_type.includes('winning') ? '🏆' : tx.transaction_type.includes('refund') ? '↩️' : '↑'}
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-bold text-white capitalize">{tx.transaction_type.replace('_', ' ')}</p>
                                                        <p className="text-[10px] text-slate-500">{new Date(tx.created_at).toLocaleString()}</p>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p className={`text-sm font-black ${
                                                        tx.transaction_type.includes('deposit') || tx.transaction_type.includes('winning') || tx.transaction_type.includes('refund') ? 'text-[#00e700]' : 'text-red-500'
                                                    }`}>
                                                        {tx.transaction_type.includes('deposit') || tx.transaction_type.includes('winning') || tx.transaction_type.includes('refund') ? '+' : '-'}{tx.amount} Br
                                                    </p>
                                                    <p className={`text-[10px] font-bold uppercase ${
                                                        tx.status === 'completed' || tx.status === 'approved' ? 'text-[#00e700]' : tx.status === 'rejected' ? 'text-red-500' : 'text-[#ffcc00]'
                                                    }`}>
                                                        {tx.status}
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Deposit Tab */}
                    {activeTab === 'deposit' && (
                        <div className="bg-[#1e2328] rounded-2xl border border-[#2a3038] shadow-xl overflow-hidden animate-fade-in-up max-w-lg mx-auto">
                            <div className="bg-[#24292e] p-6 border-b border-[#3b4148] text-center relative overflow-hidden">
                                <div className="absolute -top-10 -right-10 text-8xl opacity-5">💰</div>
                                <h2 className="text-2xl font-black text-white relative z-10">ገንዘብ አስገባ (Deposit)</h2>
                                <p className="text-slate-400 text-xs mt-2 relative z-10">በቴሌብር (Telebirr) ወይም በባንክ ብር በማስገባት ሂሳብዎን ይሙሉ</p>
                            </div>
                            
                            <div className="p-6">
                                {/* የድርጅቱ አካውንት ቁጥሮች (ማሳያ) */}
                                <div className="bg-[#16191c] border border-[#ffcc00]/30 rounded-xl p-4 mb-6 relative">
                                    <span className="absolute -top-2.5 left-4 bg-[#ffcc00] text-black text-[10px] font-black px-2 py-0.5 rounded uppercase">Pay To</span>
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-slate-400 text-xs font-bold">ቴሌብር (Telebirr)</span>
                                        <span className="text-white font-black tracking-wider">0900000000</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-slate-400 text-xs font-bold">ንግድ ባንክ (CBE)</span>
                                        <span className="text-white font-black tracking-wider">1000000000000</span>
                                    </div>
                                </div>

                                {paymentMessage && (
                                    <div className={`p-3 rounded-lg text-sm font-bold text-center mb-4 border ${paymentMessage.type === 'success' ? 'bg-[#00e700]/10 text-[#00e700] border-[#00e700]/30' : 'bg-red-500/10 text-red-500 border-red-500/30'}`}>
                                        {paymentMessage.text}
                                    </div>
                                )}

                                <form onSubmit={handleDeposit} className="flex flex-col gap-4">
                                    <div>
                                        <label className="text-xs font-bold text-slate-400 mb-1.5 block uppercase tracking-wider">የክፍያ መንገድ</label>
                                        <div className="grid grid-cols-2 gap-3">
                                            <button type="button" onClick={() => setPaymentMethod('telebirr')} className={`py-2.5 border rounded-lg text-sm font-bold transition-colors ${paymentMethod === 'telebirr' ? 'bg-blue-500/10 border-blue-500 text-blue-400' : 'bg-[#16191c] border-[#3b4148] text-slate-400 hover:border-slate-500'}`}>Telebirr</button>
                                            <button type="button" onClick={() => setPaymentMethod('cbe')} className={`py-2.5 border rounded-lg text-sm font-bold transition-colors ${paymentMethod === 'cbe' ? 'bg-[#ffcc00]/10 border-[#ffcc00] text-[#ffcc00]' : 'bg-[#16191c] border-[#3b4148] text-slate-400 hover:border-slate-500'}`}>CBE Bank</button>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-xs font-bold text-slate-400 mb-1.5 block uppercase tracking-wider">ያስገቡት የብር መጠን (Amount)</label>
                                        <div className="relative">
                                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold">Br</span>
                                            <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} required min={50} placeholder="ቢያንስ 50..." className="w-full bg-[#0d1117] border border-[#3b4148] text-white pl-10 pr-4 py-3 rounded-lg outline-none focus:border-[#ffcc00] font-black text-lg transition" />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-xs font-bold text-slate-400 mb-1.5 block uppercase tracking-wider">የትራንዛክሽን ቁጥር (Ref / TXN ID)</label>
                                        <input type="text" value={reference} onChange={(e) => setReference(e.target.value)} required placeholder="ለምሳሌ: 8EX... ወይም FT24..." className="w-full bg-[#0d1117] border border-[#3b4148] text-white px-4 py-3 rounded-lg outline-none focus:border-[#ffcc00] font-bold text-sm uppercase transition" />
                                        <p className="text-[10px] text-slate-500 mt-1">ክፍያውን እንደፈፀሙ ከባንክ/ቴሌብር የሚላክልዎትን የማረጋገጫ ቁጥር ያስገቡ።</p>
                                    </div>

                                    <button type="submit" disabled={isSubmitting || !amount || !reference} className="w-full bg-[#ffcc00] hover:bg-[#e6b800] text-black font-black py-3.5 rounded-lg shadow-md transition-colors mt-2 disabled:opacity-50 disabled:cursor-not-allowed text-base">
                                        {isSubmitting ? 'እየተላከ ነው...' : 'የማስገባት ጥያቄ ላክ (Submit)'}
                                    </button>
                                </form>
                            </div>
                        </div>
                    )}

                    {/* Withdraw Tab */}
                    {activeTab === 'withdraw' && (
                        <div className="bg-[#1e2328] rounded-2xl border border-[#2a3038] shadow-xl overflow-hidden animate-fade-in-up max-w-lg mx-auto">
                            <div className="bg-[#24292e] p-6 border-b border-[#3b4148] text-center relative overflow-hidden">
                                <div className="absolute -top-10 -right-10 text-8xl opacity-5">💸</div>
                                <h2 className="text-2xl font-black text-white relative z-10">ገንዘብ አውጣ (Withdraw)</h2>
                                <p className="text-slate-400 text-xs mt-2 relative z-10">ያሸነፉትን ገንዘብ ወደ ሂሳብዎ ይውሰዱ</p>
                            </div>
                            
                            <div className="p-6">
                                <div className="bg-[#0d1117] border border-[#3b4148] rounded-xl p-4 mb-6 flex justify-between items-center shadow-inner">
                                    <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">ማውጣት የሚችሉት ሂሳብ</span>
                                    <span className="text-[#00e700] font-black text-xl">{Number(user.current_balance || 0).toFixed(2)} Br</span>
                                </div>

                                {paymentMessage && (
                                    <div className={`p-3 rounded-lg text-sm font-bold text-center mb-4 border ${paymentMessage.type === 'success' ? 'bg-[#00e700]/10 text-[#00e700] border-[#00e700]/30' : 'bg-red-500/10 text-red-500 border-red-500/30'}`}>
                                        {paymentMessage.text}
                                    </div>
                                )}

                                <form onSubmit={handleWithdraw} className="flex flex-col gap-4">
                                    <div>
                                        <label className="text-xs font-bold text-slate-400 mb-1.5 block uppercase tracking-wider">የሚፈልጉት የክፍያ መንገድ</label>
                                        <div className="grid grid-cols-2 gap-3">
                                            <button type="button" onClick={() => setPaymentMethod('telebirr')} className={`py-2.5 border rounded-lg text-sm font-bold transition-colors ${paymentMethod === 'telebirr' ? 'bg-blue-500/10 border-blue-500 text-blue-400' : 'bg-[#16191c] border-[#3b4148] text-slate-400 hover:border-slate-500'}`}>Telebirr</button>
                                            <button type="button" onClick={() => setPaymentMethod('cbe')} className={`py-2.5 border rounded-lg text-sm font-bold transition-colors ${paymentMethod === 'cbe' ? 'bg-[#ffcc00]/10 border-[#ffcc00] text-[#ffcc00]' : 'bg-[#16191c] border-[#3b4148] text-slate-400 hover:border-slate-500'}`}>CBE Bank</button>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-xs font-bold text-slate-400 mb-1.5 block uppercase tracking-wider">የሚያወጡት የብር መጠን (Amount)</label>
                                        <div className="relative">
                                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold">Br</span>
                                            <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} required min={100} max={user.current_balance} placeholder="ቢያንስ 100..." className="w-full bg-[#0d1117] border border-[#3b4148] text-white pl-10 pr-4 py-3 rounded-lg outline-none focus:border-[#ffcc00] font-black text-lg transition" />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-xs font-bold text-slate-400 mb-1.5 block uppercase tracking-wider">የእርስዎ አካውንት ቁጥር / ስልክ</label>
                                        <input type="text" value={reference} onChange={(e) => setReference(e.target.value)} required placeholder={paymentMethod === 'telebirr' ? "የቴሌብር ስልክ ቁጥርዎ..." : "የባንክ አካውንት ቁጥርዎ..."} className="w-full bg-[#0d1117] border border-[#3b4148] text-white px-4 py-3 rounded-lg outline-none focus:border-[#ffcc00] font-bold text-sm transition" />
                                    </div>

                                    <button type="submit" disabled={isSubmitting || !amount || !reference || Number(amount) > user.current_balance} className="w-full bg-slate-200 hover:bg-white text-black font-black py-3.5 rounded-lg shadow-md transition-colors mt-2 disabled:opacity-50 disabled:cursor-not-allowed text-base">
                                        {isSubmitting ? 'እየተላከ ነው...' : 'የማውጣት ጥያቄ ላክ (Withdraw)'}
                                    </button>
                                </form>
                            </div>
                        </div>
                    )}

                    {/* የትኬት ታሪክ (Bet History) */}
                    {activeTab === 'history' && (
                        <div className="bg-[#1e2328] rounded-2xl border border-[#2a3038] shadow-xl overflow-hidden animate-fade-in-up">
                            <div className="p-6 border-b border-[#3b4148] flex justify-between items-center bg-[#24292e]">
                                <h2 className="text-xl font-bold text-white">የትኬት ታሪክ (My Bets)</h2>
                                <span className="text-xs bg-[#16191c] text-slate-400 px-3 py-1 rounded-full border border-[#3b4148] font-bold">Total: {betHistory.length}</span>
                            </div>
                            
                            {betHistory.length === 0 ? (
                                <div className="p-16 text-center text-slate-500 bg-[#16191c]">
                                    <div className="text-5xl mb-4 opacity-50">🧾</div>
                                    <p className="font-bold">ምንም የተቆረጠ ትኬት የለዎትም።</p>
                                    <button onClick={() => router.push('/')} className="mt-4 text-[#ffcc00] text-xs font-bold underline hover:text-white transition">አሁን ትኬት ይቁረጡ</button>
                                </div>
                            ) : (
                                <div className="overflow-x-auto bg-[#16191c]">
                                    <table className="w-full text-left text-sm text-slate-300">
                                        <thead className="bg-[#0d1117] text-slate-400 font-bold text-[10px] uppercase tracking-wider">
                                            <tr>
                                                <th className="px-5 py-4 border-b border-[#3b4148]">Ticket ID</th>
                                                <th className="px-5 py-4 border-b border-[#3b4148]">Date</th>
                                                <th className="px-5 py-4 border-b border-[#3b4148] text-right">Stake</th>
                                                <th className="px-5 py-4 border-b border-[#3b4148] text-right">To Win</th>
                                                <th className="px-5 py-4 border-b border-[#3b4148] text-center">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {betHistory.map((bet, idx) => (
                                                <tr key={idx} className="border-b border-[#2a3038] hover:bg-[#24292e] transition-colors">
                                                    <td className="px-5 py-3.5 font-black text-white tracking-widest text-xs">{bet.ticket_number || bet.booking_code}</td>
                                                    <td className="px-5 py-3.5 text-[11px] text-slate-400 font-medium">
                                                        {new Date(bet.created_at).toLocaleDateString()} <span className="text-slate-600 text-[10px]">{new Date(bet.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                                    </td>
                                                    <td className="px-5 py-3.5 font-bold text-right">{Number(bet.stake_amount).toFixed(2)}</td>
                                                    <td className="px-5 py-3.5 font-bold text-[#ffcc00] text-right">{Number(bet.potential_win).toFixed(2)}</td>
                                                    <td className="px-5 py-3.5 text-center">
                                                        {bet.status === 'won' && <span className="bg-[#00e700]/10 text-[#00e700] px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider border border-[#00e700]/20 inline-block w-[70px] shadow-sm">Won</span>}
                                                        {bet.status === 'paid' && <span className="bg-blue-500/10 text-blue-400 px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider border border-blue-500/20 inline-block w-[70px] shadow-sm">Paid</span>}
                                                        {bet.status === 'lost' && <span className="bg-red-500/10 text-red-500 px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider border border-red-500/20 inline-block w-[70px] shadow-sm">Lost</span>}
                                                        {(bet.status === 'pending' || bet.status === 'active') && <span className="bg-[#1e2328] text-slate-300 px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider border border-[#3b4148] inline-block w-[70px] shadow-sm">Pending</span>}
                                                        {bet.status === 'void' && <span className="bg-slate-500/10 text-slate-400 px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider border border-slate-500/20 inline-block w-[70px] shadow-sm">Void</span>}
                                                        {bet.status === 'expired' && <span className="bg-orange-500/10 text-orange-500 px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider border border-orange-500/20 inline-block w-[70px] shadow-sm">Expired</span>}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
            
            <style jsx global>{`
                @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
                .animate-fade-in-up { animation: fadeInUp 0.2s ease-out forwards; }
                .custom-scrollbar::-webkit-scrollbar { width: 4px; height: 4px; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #3b4148; border-radius: 10px; }
                input[type=number]::-webkit-inner-spin-button, input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
                input[type=number] { -moz-appearance: textfield; }
            `}</style>
        </div>
    );
}