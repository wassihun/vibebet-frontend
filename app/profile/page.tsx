"use client";

import { useState, useEffect } from 'react';
import axios from 'axios';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function ProfilePage() {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<'dashboard' | 'deposit' | 'withdraw' | 'history'>('dashboard');
    
    const [user, setUser] = useState<any>(null);
    const [token, setToken] = useState<string | null>(null);
    
    // የትኬት ታሪክ ስቴት (ከዳታቤዝ የሚመጣ)
    const [betHistory, setBetHistory] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // 1. ዌብሳይቱ ሲከፈት ተጠቃሚው ሎጊን ማድረጉን ማረጋገጥ
        const storedUser = localStorage.getItem('user');
        const storedToken = localStorage.getItem('token');
        
        if (!storedUser || !storedToken) {
            router.push('/'); // ሎጊን ካላደረገ ወደ ዋናው ገጽ ይመልሰዋል
            return;
        }

        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);
        setToken(storedToken);

        // 2. ከባክኤንድ የትኬት ታሪኩን ማምጣት
        const fetchHistory = async () => {
            try {
                const res = await axios.get('${process.env.NEXT_PUBLIC_API_URL}/api/tickets/history', {
                    headers: { Authorization: `Bearer ${storedToken}` }
                });
                if (res.data.success) {
                    setBetHistory(res.data.data);
                }
            } catch (err) {
                console.error("ታሪክ ማምጣት አልተቻለም", err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchHistory();
    }, [router]);

    // ዩዘር ዳታው እስኪመጣ ሎዲንግ እናሳያለን
    if (!user) return <div className="min-h-screen bg-[#0f172a] flex items-center justify-center text-[#ffcc00] font-bold">Loading Profile...</div>;

    return (
        <div className="min-h-screen bg-[#0f172a] text-slate-300 font-sans">
            
            {/* Header */}
            <header className="bg-[#1e293b] border-b border-slate-800 sticky top-0 z-30">
                <div className="max-w-[1200px] mx-auto px-4 h-16 flex items-center justify-between">
                    <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition">
                        <div className="w-8 h-8 bg-[#ffcc00] rounded flex items-center justify-center font-black text-black">A</div>
                        <h1 className="text-xl font-black text-white tracking-tight">AFRO <span className="text-[#ffcc00]">BET</span></h1>
                    </Link>
                    <Link href="/" className="text-xs font-bold text-slate-400 hover:text-white bg-slate-800 px-4 py-2 rounded-lg border border-slate-700">
                        ← ወደ ዋናው ገጽ ተመለስ
                    </Link>
                </div>
            </header>

            <div className="max-w-[1200px] mx-auto flex flex-col md:flex-row gap-6 p-4 pt-8">
                
                {/* የግራ ሜኑ (Sidebar) */}
                <div className="w-full md:w-64 shrink-0">
                    <div className="bg-[#1e293b] rounded-2xl border border-slate-800 p-6 mb-4 text-center shadow-lg">
                        <div className="w-20 h-20 bg-slate-700 rounded-full mx-auto mb-4 flex items-center justify-center text-3xl border-2 border-[#ffcc00]">👤</div>
                        <h2 className="text-xl font-black text-white mb-1 uppercase">{user.username}</h2>
                        <p className="text-xs text-[#00e700] font-bold">Balance: {user.current_balance?.toFixed(2)} Br</p>
                    </div>

                    <div className="bg-[#1e293b] rounded-2xl border border-slate-800 overflow-hidden shadow-lg text-sm">
                        <button onClick={() => setActiveTab('dashboard')} className={`w-full text-left px-6 py-4 font-bold border-b border-slate-800 transition-colors ${activeTab === 'dashboard' ? 'bg-[#ffcc00]/10 text-[#ffcc00] border-l-4 border-l-[#ffcc00]' : 'text-slate-400 hover:bg-slate-800'}`}>
                            📊 ዳሽቦርድ (Overview)
                        </button>
                        <button onClick={() => setActiveTab('deposit')} className={`w-full text-left px-6 py-4 font-bold border-b border-slate-800 transition-colors ${activeTab === 'deposit' ? 'bg-[#ffcc00]/10 text-[#ffcc00] border-l-4 border-l-[#ffcc00]' : 'text-slate-400 hover:bg-slate-800'}`}>
                            💰 ገንዘብ አስገባ (Deposit)
                        </button>
                        <button onClick={() => setActiveTab('withdraw')} className={`w-full text-left px-6 py-4 font-bold border-b border-slate-800 transition-colors ${activeTab === 'withdraw' ? 'bg-[#ffcc00]/10 text-[#ffcc00] border-l-4 border-l-[#ffcc00]' : 'text-slate-400 hover:bg-slate-800'}`}>
                            💸 ገንዘብ አውጣ (Withdraw)
                        </button>
                        <button onClick={() => setActiveTab('history')} className={`w-full text-left px-6 py-4 font-bold transition-colors ${activeTab === 'history' ? 'bg-[#ffcc00]/10 text-[#ffcc00] border-l-4 border-l-[#ffcc00]' : 'text-slate-400 hover:bg-slate-800'}`}>
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
                                <div className="bg-gradient-to-br from-[#1e293b] to-slate-900 rounded-2xl p-6 border border-slate-700 shadow-xl relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-[#ffcc00]/5 rounded-full -mr-10 -mt-10 blur-xl"></div>
                                    <p className="text-slate-400 font-bold mb-2 text-xs uppercase tracking-wider">አጠቃላይ ቀሪ ሂሳብ</p>
                                    <h3 className="text-4xl font-black text-[#00e700]">{user.current_balance?.toFixed(2)} <span className="text-lg text-slate-500">ETB</span></h3>
                                    <div className="mt-8 flex gap-3">
                                        <button onClick={() => setActiveTab('deposit')} className="flex-1 bg-[#ffcc00] hover:bg-[#e6b800] text-black font-black py-2.5 rounded-lg transition text-sm">Deposit</button>
                                        <button onClick={() => setActiveTab('withdraw')} className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-bold py-2.5 rounded-lg transition text-sm">Withdraw</button>
                                    </div>
                                </div>
                                <div className="bg-[#1e293b] rounded-2xl p-6 border border-slate-800 shadow-xl flex flex-col justify-center">
                                    <p className="text-slate-400 font-bold mb-4 text-xs uppercase tracking-wider">የመለያ መረጃዎች</p>
                                    <div className="space-y-4 text-sm">
                                        <div className="flex justify-between border-b border-slate-700/50 pb-2">
                                            <span className="text-slate-500">Username:</span>
                                            <span className="text-white font-bold">{user.username}</span>
                                        </div>
                                        <div className="flex justify-between border-b border-slate-700/50 pb-2">
                                            <span className="text-slate-500">Role:</span>
                                            <span className="text-[#ffcc00] font-bold bg-[#ffcc00]/10 px-2 py-0.5 rounded text-xs uppercase">{user.role}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* የትኬት ታሪክ (Bet History) */}
                    {activeTab === 'history' && (
                        <div className="bg-[#1e293b] rounded-2xl border border-slate-800 shadow-xl overflow-hidden animate-fade-in-up">
                            <div className="p-6 border-b border-slate-800 flex justify-between items-center">
                                <h2 className="text-xl font-bold text-white">የትኬት ታሪክ</h2>
                                <span className="text-xs bg-slate-800 text-slate-400 px-3 py-1 rounded-full border border-slate-700">Total: {betHistory.length}</span>
                            </div>
                            
                            {isLoading ? (
                                <div className="p-10 text-center text-[#ffcc00] font-bold">ዳታ በማምጣት ላይ...</div>
                            ) : betHistory.length === 0 ? (
                                <div className="p-10 text-center text-slate-500">
                                    <div className="text-4xl mb-3">📭</div>
                                    <p>ምንም የተቆረጠ ትኬት አላገኘንም።</p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-sm text-slate-300">
                                        <thead className="bg-slate-900/80 text-slate-400 font-bold text-xs uppercase tracking-wider">
                                            <tr>
                                                <th className="px-6 py-4">Ticket ID</th>
                                                <th className="px-6 py-4">Date</th>
                                                <th className="px-6 py-4">Stake</th>
                                                <th className="px-6 py-4">Potential Win</th>
                                                <th className="px-6 py-4">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {betHistory.map((bet, idx) => (
                                                <tr key={idx} className="border-b border-slate-800/50 hover:bg-slate-800/50 transition-colors">
                                                    <td className="px-6 py-4 font-black text-white">{bet.ticket_number}</td>
                                                    <td className="px-6 py-4 text-xs text-slate-400">{new Date(bet.created_at).toLocaleString()}</td>
                                                    <td className="px-6 py-4 font-bold">{bet.stake_amount} Br</td>
                                                    <td className="px-6 py-4 font-bold text-[#ffcc00]">{bet.potential_win} Br</td>
                                                    <td className="px-6 py-4">
                                                        {bet.status === 'won' && <span className="bg-[#00e700]/10 text-[#00e700] px-3 py-1 rounded-sm text-xs font-black uppercase border border-[#00e700]/20">Won</span>}
                                                        {bet.status === 'lost' && <span className="bg-red-500/10 text-red-500 px-3 py-1 rounded-sm text-xs font-black uppercase border border-red-500/20">Lost</span>}
                                                        {bet.status === 'pending' && <span className="bg-slate-700 text-slate-300 px-3 py-1 rounded-sm text-xs font-black uppercase border border-slate-600">Pending</span>}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}
                    
                    {/* (Deposit እና Withdraw ክፍሎች ለጊዜው UI ብቻ ናቸው) */}
                    {(activeTab === 'deposit' || activeTab === 'withdraw') && (
                        <div className="bg-[#1e293b] rounded-2xl border border-slate-800 p-8 text-center animate-fade-in-up">
                            <div className="text-4xl mb-4">⚙️</div>
                            <h2 className="text-xl font-bold text-white mb-2">በቅርቡ የሚከፈት (Coming Soon)</h2>
                            <p className="text-slate-400 text-sm">ይህ የክፍያ ሲስተም (Telebirr/CBE) ከባንክ API ጋር እየተገናኘ ስለሆነ ገና አላለቀም።</p>
                        </div>
                    )}

                </div>
            </div>
            
            <style jsx global>{`
                @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
                .animate-fade-in-up { animation: fadeInUp 0.2s ease-out forwards; }
            `}</style>
        </div>
    );
}
