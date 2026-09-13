"use client";

import { useState, useEffect } from 'react';
import axios from 'axios';

interface AuthModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (user: any, token: string) => void;
    initialMode: 'login' | 'register';
}

export default function AuthModal({ isOpen, onClose, onSuccess, initialMode }: AuthModalProps) {
    const [authMode, setAuthMode] = useState<'login' | 'register'>(initialMode);
    
    // ኢሜይል እና ስልክ ቁጥር ወደ ስቴቱ ጨምረናል
    const [authForm, setAuthForm] = useState({ 
        username: '', 
        password: '', 
        email: '', 
        phone: '' 
    });
    const [authLoading, setAuthLoading] = useState(false);
    const [authError, setAuthError] = useState<string | null>(null);

    // ሞዳሉ ሲከፈት ፎርሙን ባዶ እንዲያደርግ
    useEffect(() => {
        setAuthMode(initialMode);
        setAuthError(null);
        setAuthForm({ username: '', password: '', email: '', phone: '' });
    }, [initialMode, isOpen]);

    if (!isOpen) return null;

    const handleAuthSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setAuthLoading(true);
        setAuthError(null);
        try {
            const endpoint = authMode === 'login' ? '/api/auth/login' : '/api/auth/register';
            
            // ሎጊን ከሆነ ስም እና ፓስዎርድ ብቻ ይልካል፣ ሪጅስተር ከሆነ ሁሉንም መረጃ ይልካል
            const payload = authMode === 'register' 
                ? { ...authForm, role: 'player' } 
                : { username: authForm.username, password: authForm.password };
                
            // 🌟 ማስተካከያ: Localhost የነበረው ወደ ዳይናሚክ (Env Variable) ተቀይሯል 🌟
            const res = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}${endpoint}`, payload);
            
            if (res.data.success) {
                if (authMode === 'register') {
                    setAuthMode('login');
                    setAuthError("በተሳካ ሁኔታ ተመዝግበዋል! እባክዎ ሎጊን ያድርጉ።");
                } else {
                    onSuccess(res.data.user, res.data.token);
                }
            }
        } catch (err: any) {
            setAuthError(err.response?.data?.message || "ስህተት ተፈጥሯል");
        } finally {
            setAuthLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose}></div>
            
            {/* 🌟 ማስተካከያ: ዲዛይኑ ወደ ፕሪሚየም Vibe Bet ገፅታ (Dark Theme) ተቀይሯል 🌟 */}
            <div className="bg-[#1e2328] border border-[#3b4148] rounded-2xl w-full max-w-md p-6 sm:p-8 relative z-10 shadow-2xl animate-fade-in-down overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1.5 bg-[#ffcc00]"></div>
                
                <button onClick={onClose} className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-[#1a1f24] border border-[#3b4148] text-slate-400 hover:text-white hover:bg-red-500 hover:border-red-500 transition-colors">
                    ✕
                </button>
                
                <div className="text-center mb-6 mt-2">
                    <div className="w-16 h-16 bg-[#1c2024] rounded-[15px] mx-auto flex items-center justify-center mb-4 shadow-inner border border-[#3b4148] p-2">
                        <img src="/icon.svg" alt="Vibe Bet" className="w-full h-full object-contain" />
                    </div>
                    <h2 className="text-2xl font-black text-white italic tracking-wide leading-none">
                        VIBE <span className="text-[#ffcc00]">BET</span>
                    </h2>
                    <p className="text-sm font-bold text-slate-400 mt-2 tracking-wider">
                        {authMode === 'login' ? 'ወደ አካውንትዎ ይግቡ' : 'አዲስ አካውንት ይክፈቱ'}
                    </p>
                </div>

                {authError && (
                    <div className={`p-3.5 rounded-lg mb-5 text-sm font-bold text-center border ${authError.includes('በተሳካ ሁኔታ') ? 'bg-[#00e700]/10 text-[#00e700] border-[#00e700]/30' : 'bg-red-500/10 text-red-400 border-red-500/30'}`}>
                        {authError}
                    </div>
                )}

                <form onSubmit={handleAuthSubmit} className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider">የተጠቃሚ ስም (Username)</label>
                        <input 
                            type="text" 
                            required
                            value={authForm.username}
                            onChange={(e) => setAuthForm({...authForm, username: e.target.value})}
                            className="w-full bg-[#1a1f24] border border-[#3b4148] text-white px-4 py-3 rounded-lg outline-none focus:border-[#ffcc00] transition shadow-inner" 
                        />
                    </div>
                    
                    {authMode === 'register' && (
                        <>
                            <div>
                                <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider">ኢሜይል (Email)</label>
                                <input 
                                    type="email" 
                                    required
                                    placeholder="example@gmail.com"
                                    value={authForm.email}
                                    onChange={(e) => setAuthForm({...authForm, email: e.target.value})}
                                    className="w-full bg-[#1a1f24] border border-[#3b4148] text-white px-4 py-3 rounded-lg outline-none focus:border-[#ffcc00] transition shadow-inner" 
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider">ስልክ ቁጥር (Phone)</label>
                                <input 
                                    type="tel" 
                                    required
                                    placeholder="09..."
                                    value={authForm.phone}
                                    onChange={(e) => setAuthForm({...authForm, phone: e.target.value})}
                                    className="w-full bg-[#1a1f24] border border-[#3b4148] text-white px-4 py-3 rounded-lg outline-none focus:border-[#ffcc00] transition shadow-inner" 
                                />
                            </div>
                        </>
                    )}

                    <div>
                        <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider">የይለፍ ቃል (Password)</label>
                        <input 
                            type="password" 
                            required
                            value={authForm.password}
                            onChange={(e) => setAuthForm({...authForm, password: e.target.value})}
                            className="w-full bg-[#1a1f24] border border-[#3b4148] text-white px-4 py-3 rounded-lg outline-none focus:border-[#ffcc00] transition shadow-inner" 
                        />
                    </div>
                    
                    <button 
                        type="submit" 
                        disabled={authLoading}
                        className="w-full bg-[#ffcc00] hover:bg-[#e6b800] disabled:bg-[#3b4148] disabled:text-slate-500 disabled:cursor-not-allowed text-black font-black py-3.5 rounded-lg mt-2 transition transform active:scale-[0.98] uppercase tracking-wider shadow-md"
                    >
                        {authLoading ? 'በማስኬድ ላይ...' : (authMode === 'login' ? 'ግባ (Login)' : 'ተመዝገብ')}
                    </button>
                </form>

                <div className="mt-6 text-center text-sm font-bold text-slate-400 pt-5 border-t border-[#3b4148]">
                    {authMode === 'login' ? (
                        <p>አካውንት የለዎትም? <button type="button" onClick={() => { setAuthMode('register'); setAuthError(null); }} className="text-[#ffcc00] ml-1 hover:underline">ተመዝገብ</button></p>
                    ) : (
                        <p>ቀድሞ አካውንት አሎት? <button type="button" onClick={() => { setAuthMode('login'); setAuthError(null); }} className="text-[#ffcc00] ml-1 hover:underline">ግባ</button></p>
                    )}
                </div>
            </div>
            
            <style jsx>{`
                @keyframes fadeInDown { from { opacity: 0; transform: translateY(-20px); } to { opacity: 1; transform: translateY(0); } }
                .animate-fade-in-down { animation: fadeInDown 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
            `}</style>
        </div>
    );
}
