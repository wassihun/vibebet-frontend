"use client";

import { useState } from 'react';

interface MatchDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    match: any;
    betSlip: any[];
    toggleSelection: (game: any, odd: any) => void;
}

export default function MatchDetailsModal({ isOpen, onClose, match, betSlip, toggleSelection }: MatchDetailsModalProps) {
    const [activeTab, setActiveTab] = useState('all');

    if (!isOpen || !match) return null;

    // ለዲዛይን ማሳያ የሚሆኑ ተጨማሪ የገበያ አይነቶች (በእውነተኛው ሲስተም ከባክኤንድ ይመጣሉ)
    const extraMarkets = [
        {
            title: "ድርብ ዕድል (Double Chance)",
            odds: [
                { odd_id: `dc_1x_${match.id}`, option: "1X", value: "1.25" },
                { odd_id: `dc_12_${match.id}`, option: "12", value: "1.30" },
                { odd_id: `dc_x2_${match.id}`, option: "X2", value: "1.55" }
            ]
        },
        {
            title: "ከ/በታች 2.5 (Over/Under 2.5)",
            odds: [
                { odd_id: `ou_over_${match.id}`, option: "Over 2.5", value: "1.85" },
                { odd_id: `ou_under_${match.id}`, option: "Under 2.5", value: "1.95" }
            ]
        },
        {
            title: "ሁለቱም ያገባሉ (Both Teams to Score)",
            odds: [
                { odd_id: `btts_yes_${match.id}`, option: "አዎ (Yes)", value: "1.75" },
                { odd_id: `btts_no_${match.id}`, option: "አይ (No)", value: "2.05" }
            ]
        }
    ];

    return (
        <div className="fixed inset-0 z-50 flex justify-end">
            {/* ጀርባውን ማጨለሚያ */}
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose}></div>
            
            {/* ከቀኝ በኩል የሚንሸራተት ሞዳል (Right Side Drawer) */}
            <div className="relative w-full md:w-[600px] h-full bg-[#0f172a] shadow-2xl flex flex-col transform transition-transform duration-300">
                
                {/* Header */}
                <div className="bg-[#1e293b] p-6 border-b border-slate-700 relative">
                    <button onClick={onClose} className="absolute top-6 right-6 w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center text-slate-400 hover:text-white border border-slate-700 transition">✕</button>
                    <div className="text-center mt-4">
                        <span className="text-xs font-medium text-slate-400 bg-slate-900 px-3 py-1 rounded-full mb-3 inline-block">
                            {new Date(match.match_time).toLocaleString()}
                        </span>
                        <div className="flex justify-center items-center gap-6">
                            <h2 className="text-xl sm:text-2xl font-black text-white">{match.home_team}</h2>
                            <span className="text-yellow-500 font-bold bg-yellow-500/10 px-3 py-1 rounded-lg">VS</span>
                            <h2 className="text-xl sm:text-2xl font-black text-white">{match.away_team}</h2>
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex px-6 pt-4 gap-6 border-b border-slate-800 text-sm font-bold overflow-x-auto custom-scrollbar">
                    {['all', 'goals', 'halves', 'corners'].map((tab) => (
                        <button 
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`pb-3 capitalize transition-colors whitespace-nowrap ${activeTab === tab ? 'text-yellow-500 border-b-2 border-yellow-500' : 'text-slate-400 hover:text-slate-300'}`}
                        >
                            {tab === 'all' ? 'ሁሉም (All)' : tab === 'goals' ? 'ግቦች (Goals)' : tab === 'halves' ? 'አጋማሾች' : 'ማዕዘን ምት'}
                        </button>
                    ))}
                </div>

                {/* Markets Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                    
                    {/* ዋናው 1X2 (ከባክኤንድ የመጣው) */}
                    <div className="bg-[#1e293b] rounded-2xl p-4 border border-slate-800">
                        <h3 className="text-white font-bold mb-3 flex items-center gap-2">
                            <span className="w-1.5 h-4 bg-yellow-500 rounded-full"></span> አሸናፊ/አቻ (1X2)
                        </h3>
                        <div className="grid grid-cols-3 gap-2">
                            {match.odds.map((odd: any) => {
                                const isSelected = betSlip.some(item => item.odd_id === odd.odd_id);
                                return (
                                    <button 
                                        key={odd.odd_id} onClick={() => toggleSelection(match, odd)}
                                        className={`py-3 rounded-xl font-bold border transition-all ${isSelected ? 'bg-yellow-500 text-slate-900 border-yellow-500' : 'bg-slate-900/50 text-slate-300 border-slate-700 hover:bg-slate-800'}`}
                                    >
                                        <span className="text-xs block mb-1">{odd.option}</span>
                                        <span className="text-lg">{odd.value}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* ተጨማሪ ገበያዎች (ሞክ የተደረጉ) */}
                    {extraMarkets.map((market, idx) => (
                        <div key={idx} className="bg-[#1e293b] rounded-2xl p-4 border border-slate-800">
                            <h3 className="text-white font-bold mb-3 flex items-center gap-2">
                                <span className="w-1.5 h-4 bg-slate-500 rounded-full"></span> {market.title}
                            </h3>
                            <div className={`grid gap-2 ${market.odds.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
                                {market.odds.map((odd: any) => {
                                    const isSelected = betSlip.some(item => item.odd_id === odd.odd_id);
                                    return (
                                        <button 
                                            key={odd.odd_id} onClick={() => toggleSelection(match, odd)}
                                            className={`py-3 rounded-xl font-bold border transition-all ${isSelected ? 'bg-yellow-500 text-slate-900 border-yellow-500' : 'bg-slate-900/50 text-slate-300 border-slate-700 hover:bg-slate-800'}`}
                                        >
                                            <span className="text-xs block mb-1">{odd.option}</span>
                                            <span className="text-lg">{odd.value}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ))}

                </div>
            </div>
        </div>
    );
}