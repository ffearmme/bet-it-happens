"use client";
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { ChevronLeft, Zap, Trophy, History } from 'lucide-react';
import { useApp } from '../../../lib/store';
import { doc, updateDoc, increment, addDoc, collection } from 'firebase/firestore';

// Configuration
const REELS = 5;
const ROWS = 3;
const SYMBOLS = ['🍒', '🍋', '🍇', '🍉', '🔔', '💎', '7️⃣'];
const PAYOUTS = {
    '🍒': 0.5,
    '🍋': 1,
    '🍇': 2,
    '🍉': 4,
    '🔔': 8,
    '💎': 15,
    '7️⃣': 50
};

export default function SlotsGame() {
    const { user, db } = useApp();
    const [reels, setReels] = useState(Array(REELS).fill(Array(ROWS).fill('❓')));
    const [isSpinning, setIsSpinning] = useState(false);
    const [betAmount, setBetAmount] = useState('1.00');
    const [lastWin, setLastWin] = useState(0);
    const [message, setMessage] = useState('Ready to Spin!');
    const [userHistory, setUserHistory] = useState([]);

    const spin = async () => {
        if (!user) return alert("Please login to play.");
        const amount = parseFloat(betAmount);
        if (isNaN(amount) || amount <= 0) return alert("Invalid bet amount.");
        if ((user.balance || 0) < amount) return alert("Insufficient balance.");

        try {
            // 1. Deduct Balance
            const userRef = doc(db, 'users', user.id);
            await updateDoc(userRef, {
                balance: increment(-amount)
            });

            setIsSpinning(true);
            setMessage('Spinning...');
            setLastWin(0);

            // 2. Weighted Random Selection
            const WEIGHTS = [
                { symbol: '🍒', weight: 30 },
                { symbol: '🍋', weight: 25 },
                { symbol: '🍇', weight: 18 },
                { symbol: '🍉', weight: 12 },
                { symbol: '🔔', weight: 8 },
                { symbol: '💎', weight: 5 },
                { symbol: '7️⃣', weight: 2 }
            ];

            const getRandomSymbol = () => {
                const totalWeight = WEIGHTS.reduce((acc, item) => acc + item.weight, 0);
                let random = Math.random() * totalWeight;
                for (const item of WEIGHTS) {
                    if (random < item.weight) return item.symbol;
                    random -= item.weight;
                }
                return WEIGHTS[0].symbol;
            };

            // Generate Reels
            const finalReels = Array(REELS).fill(null).map(() => Array(ROWS).fill(null));
            for (let i = 0; i < REELS; i++) {
                for (let j = 0; j < ROWS; j++) {
                    finalReels[i][j] = getRandomSymbol();
                }
            }

            // Simulate spin delay
            setTimeout(async () => {
                setReels(finalReels);
                setIsSpinning(false);

                // 3. Evaluate Results (Middle Row Payline)
                const r = 1; // Middle row
                const rowSymbols = finalReels.map(col => col[r]);

                // Count Occurrences
                const counts = {};
                rowSymbols.forEach(sym => {
                    counts[sym] = (counts[sym] || 0) + 1;
                });

                let totalWin = 0;
                let matches = [];

                // Rules
                // 🍒 Cherries (Anywhere)
                const cherryCount = counts['🍒'] || 0;
                if (cherryCount === 2) totalWin += amount * 0.25;
                else if (cherryCount === 3) totalWin += amount * 0.5;
                else if (cherryCount === 4) totalWin += amount * 1;
                else if (cherryCount === 5) totalWin += amount * 2;
                if (cherryCount >= 2) matches.push(`${cherryCount}x 🍒`);

                // 🍋 Lemons (Anywhere)
                const lemonCount = counts['🍋'] || 0;
                if (lemonCount === 2) {
                    totalWin += amount * 0.5;
                    matches.push(`2x 🍋`);
                }

                // For other symbols, we can apply standard payouts for 3+ of others
                Object.entries(counts).forEach(([sym, count]) => {
                    if (sym === '🍒' || sym === '🍋') return; // Handled above
                    if (count >= 3) {
                        let winVal = 0;
                        if (count === 3) winVal = amount * (PAYOUTS[sym] || 0);
                        if (count === 4) winVal = amount * (PAYOUTS[sym] || 0) * 2;
                        if (count === 5) winVal = amount * (PAYOUTS[sym] || 0) * 10;

                        if (winVal > 0) {
                            totalWin += winVal;
                            matches.push(`${count}x ${sym}`);
                        }
                    }
                });


                if (totalWin > 0) {
                    setMessage(`WINNER! +$${totalWin.toFixed(2)}`);
                    setLastWin(totalWin);
                    // Add winnings
                    await updateDoc(userRef, {
                        balance: increment(totalWin)
                    });
                } else {
                    setMessage('Try Again!');
                }

                // Save to Casino History
                try {
                    await addDoc(collection(db, 'casino_bets'), {
                        userId: user.id,
                        username: user.username || 'User',
                        game: 'slots',
                        amount: amount,
                        payout: totalWin,
                        multiplier: amount > 0 ? totalWin / amount : 0,
                        result: totalWin > 0 ? 'won' : 'lost',
                        timestamp: Date.now()
                    });

                    // Check for Global Jackpot Announcement (> 5x or > 10000)
                    const actualMultiplier = amount > 0 ? totalWin / amount : 0;
                    if (actualMultiplier > 5 || totalWin >= 10000) {
                        addDoc(collection(db, 'jackpots'), {
                            userId: user.id,
                            username: user.username || 'User',
                            game: 'slots',
                            amount: totalWin,
                            multiplier: actualMultiplier,
                            timestamp: Date.now()
                        }).catch(e => console.error("Error saving jackpot:", e));
                    }
                } catch (err) {
                    console.error("Error saving casino history:", err);
                }

                const profit = totalWin - amount;
                setUserHistory(prev => [{
                    id: Date.now(),
                    result: profit > 0 ? 'won' : profit === 0 ? 'push' : 'loss',
                    profit: profit,
                    amount: amount,
                    match: matches.length > 0 ? matches.join(', ') : 'No Win'
                }, ...prev]);


            }, 1000); // 1 second spin animation

        } catch (e) {
            console.error(e);
            setIsSpinning(false);
            alert("Error spinning slots");
        }
    };

    return (
        <div className="animate-fade" style={{
            minHeight: '100vh',
            background: 'radial-gradient(circle at top center, #2e1065 0%, #000000 60%)',
            padding: '20px',
            color: '#fff',
            fontFamily: 'var(--font-heading)'
        }}>
            {/* Background Glows */}
            <div style={{ position: 'fixed', top: '10%', left: '0', width: '300px', height: '300px', background: '#eab308', filter: 'blur(150px)', opacity: 0.1, pointerEvents: 'none', zIndex: 0 }}></div>

            <div style={{ maxWidth: '1200px', margin: '0 auto', position: 'relative', zIndex: 1 }}>

                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px' }}>
                    <Link href="/casino" style={{
                        display: 'flex', alignItems: 'center', gap: '8px',
                        color: '#94a3b8', textDecoration: 'none', fontSize: '14px',
                        background: 'rgba(255,255,255,0.05)', padding: '8px 16px', borderRadius: '20px',
                        transition: 'background 0.2s',
                        backdropFilter: 'blur(5px)'
                    }}>
                        <ChevronLeft size={16} /> Back
                    </Link>
                    <h1 style={{
                        flex: 1, textAlign: 'center', fontSize: '28px', fontWeight: '900', color: '#fff',
                        textTransform: 'uppercase', letterSpacing: '2px', textShadow: '0 0 20px rgba(234, 179, 8, 0.6)'
                    }}>
                        SLOTS
                    </h1>
                    <div style={{ width: '80px' }}></div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px', alignItems: 'start' }}>

                    {/* GAME AREA */}
                    <div style={{ maxWidth: '800px', width: '100%', margin: '0 auto' }}>

                        {/* Slot Machine Display */}
                        <div style={{
                            background: '#000',
                            border: '4px solid #333',
                            borderRadius: '24px',
                            padding: '20px',
                            position: 'relative',
                            boxShadow: '0 20px 50px -10px rgba(0,0,0,0.5)'
                        }}>
                            {/* Bezel Glow */}
                            <div style={{
                                position: 'absolute', inset: -4, borderRadius: '28px',
                                background: 'linear-gradient(45deg, #eab308, #a855f7, #eab308)',
                                zIndex: -1, opacity: 0.5, filter: 'blur(10px)'
                            }}></div>

                            {/* Reels Container */}
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: `repeat(${REELS}, 1fr)`,
                                gap: '8px',
                                background: '#111',
                                padding: '16px',
                                borderRadius: '12px',
                                border: '1px solid #333',
                                marginBottom: '24px'
                            }}>
                                {reels.map((col, colIndex) => (
                                    <div key={colIndex} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        {col.map((symbol, rowIndex) => (
                                            <div key={rowIndex} style={{
                                                height: '80px',
                                                background: '#222',
                                                borderRadius: '8px',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                fontSize: '32px',
                                                border: '1px solid #333',
                                                boxShadow: 'inset 0 0 10px rgba(0,0,0,0.5)',
                                                animation: isSpinning ? 'pulse 0.2s infinite' : 'none'
                                            }}>
                                                {symbol}
                                            </div>
                                        ))}
                                    </div>
                                ))}
                            </div>

                            {/* Status Info */}
                            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                                <div style={{
                                    fontSize: '24px', fontWeight: 'bold',
                                    color: message.includes('WINNER') ? '#eab308' : '#fff',
                                    textShadow: message.includes('WINNER') ? '0 0 20px rgba(234, 179, 8, 0.8)' : 'none'
                                }}>
                                    {message}
                                </div>
                            </div>

                            {/* Controls */}
                            <div style={{
                                background: 'rgba(255,255,255,0.05)',
                                padding: '16px',
                                borderRadius: '16px',
                                display: 'flex',
                                gap: '16px',
                                alignItems: 'center'
                            }}>
                                <div style={{ flex: 1 }}>
                                    <label style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 'bold', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                                        Bet Amount
                                    </label>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <input
                                            type="number"
                                            value={betAmount}
                                            onChange={e => setBetAmount(e.target.value)}
                                            style={{
                                                background: '#000',
                                                border: '1px solid #333',
                                                color: '#fff',
                                                padding: '8px 12px',
                                                borderRadius: '8px',
                                                width: '100px',
                                                fontWeight: 'bold'
                                            }}
                                        />
                                        <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                                            Bal: <span style={{ color: '#fff' }}>${user?.balance?.toFixed(2) || '0.00'}</span>
                                        </span>
                                    </div>
                                </div>

                                <button
                                    onClick={spin}
                                    disabled={isSpinning}
                                    style={{
                                        background: isSpinning ? '#333' : 'linear-gradient(to bottom, #eab308, #ca8a04)',
                                        border: 'none',
                                        padding: '12px 40px',
                                        borderRadius: '12px',
                                        fontSize: '20px',
                                        fontWeight: '900',
                                        color: '#000',
                                        textTransform: 'uppercase',
                                        cursor: isSpinning ? 'not-allowed' : 'pointer',
                                        boxShadow: isSpinning ? 'none' : '0 4px 0 #854d0e',
                                        transform: isSpinning ? 'translateY(4px)' : 'none',
                                        transition: 'all 0.1s'
                                    }}
                                >
                                    {isSpinning ? '...' : 'SPIN'}
                                </button>
                            </div>

                        </div>

                        {/* Paytable */}
                        <div style={{ marginTop: '24px', display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
                            {Object.entries(PAYOUTS).map(([sym, mult]) => (
                                <div key={sym} style={{
                                    padding: '4px 8px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', fontSize: '12px',
                                    border: '1px solid rgba(255,255,255,0.1)'
                                }}>
                                    {sym} = {mult}x
                                </div>
                            ))}
                        </div>

                    </div>


                    {/* STATS SIDEBAR */}
                    <div style={{
                        marginTop: '0px',
                        background: 'rgba(255,255,255,0.03)',
                        backdropFilter: 'blur(10px)',
                        borderRadius: '24px',
                        padding: '24px',
                        border: '1px solid rgba(255,255,255,0.1)',
                        minHeight: '400px',
                        maxHeight: '600px',
                        overflowY: 'auto'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px', color: '#94a3b8' }}>
                            <History size={16} />
                            <h3 style={{ fontSize: '14px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px', margin: 0 }}>
                                Spin History
                            </h3>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {userHistory.map(h => (
                                <div key={h.id} style={{
                                    padding: '12px',
                                    borderRadius: '12px',
                                    background: h.result === 'won' ? 'rgba(234, 179, 8, 0.1)' : 'rgba(255,255,255,0.02)',
                                    border: `1px solid ${h.result === 'won' ? 'rgba(234, 179, 8, 0.2)' : 'rgba(255,255,255,0.05)'}`,
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center'
                                }}>
                                    <div>
                                        <div style={{ fontSize: '12px', color: '#94a3b8' }}>{h.match}</div>
                                        <div style={{ fontWeight: 'bold', color: h.result === 'won' ? '#eab308' : '#fff' }}>
                                            {h.result === 'won' ? 'WIN' : 'LOSS'}
                                        </div>
                                    </div>
                                    <div style={{ fontWeight: 'bold', color: h.profit >= 0 ? '#10b981' : '#ef4444' }}>
                                        {h.profit > 0 ? '+' : ''}${h.profit.toFixed(2)}
                                    </div>
                                </div>
                            ))}
                            {userHistory.length === 0 && <div style={{ textAlign: 'center', color: '#666', fontSize: '14px' }}>Spin to win!</div>}
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}
