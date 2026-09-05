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
                
            const res = await axios.post(`http://localhost:5000${endpoint}`, payload);
            
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
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose}></div>
            <div className="bg-[#1e293b] border border-slate-700 rounded-2xl w-full max-w-md p-6 sm:p-8 relative z-10 shadow-2xl animate-fade-in-up">
                <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-white">✕</button>
                
                <div className="text-center mb-6">
                    <div className="w-12 h-12 bg-yellow-500 rounded-xl mx-auto flex items-center justify-center font-black text-slate-900 text-xl mb-3">A</div>
                    <h2 className="text-2xl font-bold text-white">
                        {authMode === 'login' ? 'ወደ አካውንትዎ ይግቡ' : 'አዲስ አካውንት ይክፈቱ'}
                    </h2>
                </div>

                {authError && (
                    <div className={`p-3 rounded-lg mb-4 text-sm text-center ${authError.includes('በተሳካ ሁኔታ') ? 'bg-green-500/20 text-green-300 border border-green-500/30' : 'bg-red-500/20 text-red-300 border border-red-500/30'}`}>
                        {authError}
                    </div>
                )}

                <form onSubmit={handleAuthSubmit} className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-400 mb-1">የተጠቃሚ ስም (Username)</label>
                        <input 
                            type="text" 
                            required
                            value={authForm.username}
                            onChange={(e) => setAuthForm({...authForm, username: e.target.value})}
                            className="w-full bg-slate-900 border border-slate-700 text-white p-3 rounded-lg outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500" 
                        />
                    </div>
                    
                    {/* ሪጅስተር ሲሆን ብቻ የሚታዩት የኢሜይል እና የስልክ መሙያዎች */}
                    {authMode === 'register' && (
                        <>
                            <div>
                                <label className="block text-xs font-bold text-slate-400 mb-1">ኢሜይል (Email)</label>
                                <input 
                                    type="email" 
                                    required
                                    placeholder="example@gmail.com"
                                    value={authForm.email}
                                    onChange={(e) => setAuthForm({...authForm, email: e.target.value})}
                                    className="w-full bg-slate-900 border border-slate-700 text-white p-3 rounded-lg outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500" 
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-400 mb-1">ስልክ ቁጥር (Phone)</label>
                                <input 
                                    type="tel" 
                                    required
                                    placeholder="09..."
                                    value={authForm.phone}
                                    onChange={(e) => setAuthForm({...authForm, phone: e.target.value})}
                                    className="w-full bg-slate-900 border border-slate-700 text-white p-3 rounded-lg outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500" 
                                />
                            </div>
                        </>
                    )}

                    <div>
                        <label className="block text-xs font-bold text-slate-400 mb-1">የይለፍ ቃል (Password)</label>
                        <input 
                            type="password" 
                            required
                            value={authForm.password}
                            onChange={(e) => setAuthForm({...authForm, password: e.target.value})}
                            className="w-full bg-slate-900 border border-slate-700 text-white p-3 rounded-lg outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500" 
                        />
                    </div>
                    
                    <button 
                        type="submit" 
                        disabled={authLoading}
                        className={`w-full font-bold py-3 rounded-xl shadow-lg mt-4 transition-all ${
                            authLoading ? 'bg-slate-700 text-slate-400' : 'bg-yellow-500 hover:bg-yellow-400 text-slate-900'
                        }`}
                    >
                        {authLoading ? 'በማስኬድ ላይ...' : (authMode === 'login' ? 'ግባ (Login)' : 'ተመዝገብ')}
                    </button>
                </form>

                <div className="mt-6 text-center text-sm text-slate-400">
                    {authMode === 'login' ? (
                        <p>አካውንት የለዎትም? <button type="button" onClick={() => { setAuthMode('register'); setAuthError(null); }} className="text-yellow-500 font-bold hover:underline">ተመዝገብ</button></p>
                    ) : (
                        <p>ቀድሞ አካውንት አሎት? <button type="button" onClick={() => { setAuthMode('login'); setAuthError(null); }} className="text-yellow-500 font-bold hover:underline">ግባ</button></p>
                    )}
                </div>
            </div>
        </div>
    );
}