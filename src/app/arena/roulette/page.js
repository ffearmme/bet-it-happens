"use client";
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { ChevronLeft, Info, RefreshCw, Trash2, History } from 'lucide-react';
import { useApp } from '../../../lib/store';
import { doc, updateDoc, increment, addDoc, collection } from 'firebase/firestore';
import BiggestWins from '../../../components/BiggestWins';

// Roulette Constants
const NUMBERS = [
    0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26
];

const COLORS = {
    0: 'green',
    1: 'red', 2: 'black', 3: 'red', 4: 'black', 5: 'red', 6: 'black', 7: 'red', 8: 'black', 9: 'red', 10: 'black',
    11: 'black', 12: 'red', 13: 'black', 14: 'red', 15: 'black', 16: 'red', 17: 'black', 18: 'red', 19: 'red', 20: 'black',
    21: 'red', 22: 'black', 23: 'red', 24: 'black', 25: 'red', 26: 'black', 27: 'red', 28: 'black', 29: 'black', 30: 'red',
    31: 'black', 32: 'red', 33: 'black', 34: 'red', 35: 'black', 36: 'red'
};

const PAYOUTS = {
    straight: 35,
    dozens: 2,
    column: 2,
    color: 1,
    parity: 1,
    range: 1
};

export default function RouletteGame() {
    const { user, db } = useApp();
    const [gameState, setGameState] = useState('IDLE'); // 'IDLE', 'SPINNING', 'RESULT'
    const [bets, setBets] = useState({}); // { [betKey]: amount }
    const [chipValue, setChipValue] = useState(1);
    const [result, setResult] = useState(null); // { number, color }
    const [history, setHistory] = useState([]); // Array of numbers
    const [userHistory, setUserHistory] = useState([]);
    const [rotation, setRotation] = useState(0);
    const [message, setMessage] = useState('Place your bets');

    const wheelRef = useRef(null);

    // Helpers
    const getNumberColor = (num) => COLORS[num];
    const getTotalBet = () => Object.values(bets).reduce((a, b) => a + b, 0);

    const handlePlaceBet = (key) => {
        if (gameState !== 'IDLE') return;
        if (!user) return alert("Please login to play.");
        if (user.requiresVerification && !user.emailVerified) return alert("Please verify your email to play!");

        const currentBet = bets[key] || 0;
        const newTotal = getTotalBet() + chipValue;

        if (newTotal > (user.balance || 0)) {
            setMessage("Insufficient balance!");
            setTimeout(() => setMessage('Place your bets'), 2000);
            return;
        }

        setBets(prev => ({
            ...prev,
            [key]: currentBet + chipValue
        }));
    };

    const clearBets = () => {
        if (gameState === 'IDLE') setBets({});
    };

    const spinWheel = async () => {
        if (gameState !== 'IDLE') return;
        const totalBet = getTotalBet();
        if (totalBet <= 0) {
            setMessage("Place a bet first!");
            return;
        }
        if (totalBet > (user.balance || 0)) {
            setMessage("Insufficient balance!");
            return;
        }

        try {
            // Deduct Balance
            const userRef = doc(db, 'users', user.id);
            await updateDoc(userRef, {
                balance: increment(-totalBet)
            });

            setGameState('SPINNING');
            setMessage("Spinning...");

            // Secure Random Number (0-36)
            // Using crypto.getRandomValues if available for better randomness
            let randomNum;
            if (window.crypto && window.crypto.getRandomValues) {
                const array = new Uint32Array(1);
                window.crypto.getRandomValues(array);
                randomNum = array[0] % 37;
            } else {
                randomNum = Math.floor(Math.random() * 37);
            }

            // Calculate rotation
            const winningIndex = NUMBERS.indexOf(randomNum);

            // We need to calculate the delta from the current rotation to the target rotation
            setRotation(prev => {
                const degreesPerSegment = 360 / 37;
                const currentAngle = prev % 360;
                const targetAngle = winningIndex * degreesPerSegment + (degreesPerSegment / 2);

                let delta = targetAngle - currentAngle;
                if (delta < 0) delta += 360;

                // Add extra spins (5 full rotations)
                const totalRotation = prev + delta + (5 * 360);

                // Add minor random offset (optional, kept small to stay within segment)
                // We shouldn't accumulate random offsets indefinitely or it drifts, 
                // but since we recalc from 'prev % 360' which includes previous offset, 
                // we interpret 'current position' as precise. 
                // Let's add a fresh random offset for this spin's final landing visual
                // and subtract the previous randomness if we wanted perfection, but simpler is:
                const randomOffset = (Math.random() - 0.5) * (degreesPerSegment * 0.4);

                return totalRotation + randomOffset;
            });

            // Wait for animation
            setTimeout(async () => {
                const winColor = getNumberColor(randomNum);
                setResult({ number: randomNum, color: winColor });
                setHistory(prev => [randomNum, ...prev].slice(0, 10));

                // Calculate Winnings
                let totalWin = 0;
                Object.entries(bets).forEach(([key, amount]) => {
                    const win = checkWin(key, randomNum, amount);
                    totalWin += win;
                });

                // Update Balance if won
                if (totalWin > 0) {
                    await updateDoc(userRef, {
                        balance: increment(totalWin)
                    });

                    // Check for Jackpot/High Win
                    if (totalWin >= 300 || totalWin >= totalBet * 10) {
                        addDoc(collection(db, 'jackpots'), {
                            userId: user.id,
                            username: user.username || 'User',
                            game: 'roulette',
                            amount: totalWin,
                            multiplier: totalWin / totalBet,
                            timestamp: Date.now()
                        }).catch(console.error);
                    }
                }

                // Log Result
                try {
                    await addDoc(collection(db, 'casino_bets'), {
                        userId: user.id,
                        username: user.username || 'User',
                        game: 'roulette',
                        amount: totalBet,
                        payout: totalWin,
                        result: totalWin > 0 ? 'won' : 'lost',
                        timestamp: Date.now(),
                        details: {
                            winningNumber: randomNum,
                            bets: bets
                        }
                    });
                } catch (e) { console.error(e); }

                // Calculate Net Result
                const net = totalWin - totalBet;
                let resultType = 'loss';
                if (net > 0) resultType = 'win';
                else if (net === 0 && totalBet > 0) resultType = 'even';

                setUserHistory(prev => [{
                    id: Date.now(),
                    number: randomNum,
                    color: winColor,
                    bet: totalBet,
                    payout: totalWin,
                    net: net, // Store net profit/loss
                    result: resultType
                }, ...prev]);

                if (net > 0) {
                    setMessage(`You Won $${totalWin.toFixed(2)} (+$${net.toFixed(2)})`);
                } else if (net < 0) {
                    setMessage(`You Lost $${Math.abs(net).toFixed(2)}`);
                } else {
                    setMessage("Break Even");
                }

                setGameState('RESULT');
            }, 3000); // 3s spin duration matches CSS transition

        } catch (e) {
            console.error(e);
            alert("Error spinning wheel");
            setGameState('IDLE');
        }
    };

    const checkWin = (betKey, winningNum, amount) => {
        const color = getNumberColor(winningNum);

        // Parsing bet keys: 'straight_17', 'red', 'even', 'doz_1', '1_18'
        if (betKey.startsWith('straight_')) {
            const num = parseInt(betKey.split('_')[1]);
            return num === winningNum ? amount * (PAYOUTS.straight + 1) : 0;
        }
        if (betKey === 'red') return color === 'red' ? amount * 2 : 0;
        if (betKey === 'black') return color === 'black' ? amount * 2 : 0;
        if (betKey === 'even') return (winningNum !== 0 && winningNum % 2 === 0) ? amount * 2 : 0;
        if (betKey === 'odd') return (winningNum !== 0 && winningNum % 2 !== 0) ? amount * 2 : 0;
        if (betKey === 'low') return (winningNum >= 1 && winningNum <= 18) ? amount * 2 : 0;
        if (betKey === 'high') return (winningNum >= 19 && winningNum <= 36) ? amount * 2 : 0;
        if (betKey === 'doz_1') return (winningNum >= 1 && winningNum <= 12) ? amount * 3 : 0;
        if (betKey === 'doz_2') return (winningNum >= 13 && winningNum <= 24) ? amount * 3 : 0;
        if (betKey === 'doz_3') return (winningNum >= 25 && winningNum <= 36) ? amount * 3 : 0;

        return 0;
    };

    const resetGame = () => {
        setGameState('IDLE');
        setResult(null);
        setMessage('Place your bets');
        // Optional: Keep bets or clear them? Usually keep for rebet, but let's clear for now or simple "Rebet" button later
        // keeping bets for convenience
    };

    return (
        <div className="animate-fade" style={{
            minHeight: '100vh',
            background: 'radial-gradient(circle at top center, #14532d 0%, #000000 70%)', // darker green for roulette
            padding: '20px',
            color: '#fff',
            fontFamily: 'var(--font-heading)'
        }}>

            <div style={{ maxWidth: '1200px', margin: '0 auto' }}>

                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px' }}>
                    <Link href="/casino" style={{
                        display: 'flex', alignItems: 'center', gap: '8px',
                        color: '#94a3b8', textDecoration: 'none', fontSize: '14px',
                        background: 'rgba(255,255,255,0.05)', padding: '8px 16px', borderRadius: '20px'
                    }}>
                        <ChevronLeft size={16} /> Back
                    </Link>
                    <h1 style={{
                        flex: 1, textAlign: 'center', fontSize: '28px', fontWeight: '900', color: '#fff',
                        textTransform: 'uppercase', letterSpacing: '2px', textShadow: '0 0 20px rgba(16, 185, 129, 0.6)'
                    }}>
                        Roulette
                    </h1>
                    <div style={{ width: '80px' }}></div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px', alignItems: 'start' }}>

                    {/* LEFT COLUMN: GAME */}
                    <div style={{ maxWidth: '800px', width: '100%', margin: '0 auto' }}>

                        {/* Wheel & Stats Area */}
                        <div style={{
                            background: 'rgba(0,0,0,0.5)', borderRadius: '24px', padding: '24px', marginBottom: '24px',
                            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden'
                        }}>
                            {/* History Bar */}
                            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', width: '100%', justifyContent: 'center', overflowX: 'auto', paddingBottom: '4px' }}>
                                {history.map((num, i) => (
                                    <div key={i} className={`animate-fade-in`} style={{
                                        width: '32px', height: '32px', borderRadius: '50%',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        background: COLORS[num] === 'red' ? '#ef4444' : COLORS[num] === 'black' ? '#1f2937' : '#10b981',
                                        color: '#fff', fontSize: '12px', fontWeight: 'bold', border: '1px solid rgba(255,255,255,0.2)',
                                        flexShrink: 0
                                    }}>
                                        {num}
                                    </div>
                                ))}
                            </div>

                            {/* Wheel CSS Drawing */}
                            <div style={{ position: 'relative', width: '300px', height: '300px' }}>
                                {/* Pointer */}
                                <div style={{
                                    position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)', zIndex: 10,
                                    width: 0, height: 0,
                                    borderLeft: '12px solid transparent',
                                    borderRight: '12px solid transparent',
                                    borderTop: '24px solid #f59e0b',
                                    filter: 'drop-shadow(0 4px 4px rgba(0,0,0,0.5))'
                                }}></div>

                                {/* Rotating Wheel */}
                                <div style={{
                                    width: '100%', height: '100%', borderRadius: '50%', border: '8px solid #1e293b',
                                    position: 'relative', overflow: 'hidden',
                                    transition: 'transform 3s cubic-bezier(0.2, 0.8, 0.2, 1)',
                                    transform: `rotate(-${rotation}deg)`
                                }}>
                                    {/* Dynamic Gradient Segments */}
                                    <div style={{
                                        position: 'absolute', inset: 0, borderRadius: '50%',
                                        background: `conic-gradient(${NUMBERS.map((n, i) => {
                                            const color = COLORS[n] === 'red' ? '#ef4444' : COLORS[n] === 'black' ? '#1f2937' : '#10b981';
                                            const start = i * (360 / 37);
                                            const end = (i + 1) * (360 / 37);
                                            return `${color} ${start}deg ${end}deg`;
                                        }).join(', ')
                                            })`
                                    }}></div>

                                    {/* Numbers Overlay */}
                                    {NUMBERS.map((n, i) => {
                                        const angle = i * (360 / 37) + (360 / 37) / 2; // Center of segment
                                        return (
                                            <div key={i} style={{
                                                position: 'absolute',
                                                top: '50%', left: '50%',
                                                width: '20px', height: '120px', // Height = radius roughly
                                                transformOrigin: 'bottom center',
                                                transform: `translate(-50%, -100%) rotate(${angle}deg)`,
                                                textAlign: 'center',
                                                paddingTop: '10px',
                                                pointerEvents: 'none'
                                            }}>
                                                <span style={{
                                                    color: '#fff', fontSize: '10px', fontWeight: 'bold',
                                                    display: 'block', transform: 'rotate(0deg)', // Keep text orient? No, usually text rotates with wheel
                                                    textShadow: '0 1px 2px rgba(0,0,0,0.8)'
                                                }}>
                                                    {n}
                                                </span>
                                            </div>
                                        );
                                    })}

                                    {/* Inner Circle / Hub */}
                                    <div style={{ position: 'absolute', inset: '25%', background: '#0f172a', borderRadius: '50%', boxShadow: '0 0 20px rgba(0,0,0,0.5)', border: '4px solid #334155' }}></div>
                                </div>

                                {/* Center Display - OUTSIDE rotating div */}
                                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 15, pointerEvents: 'none' }}>
                                    {gameState === 'RESULT' && result && (
                                        <div className="animate-pop" style={{ textAlign: 'center' }}>
                                            <div style={{ fontSize: '48px', fontWeight: '900', color: COLORS[result.number] === 'red' ? '#ef4444' : COLORS[result.number] === 'black' ? '#fff' : '#10b981' }}>
                                                {result.number}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div style={{ marginTop: '20px', fontSize: '18px', fontWeight: 'bold', color: '#f59e0b' }}>
                                {message}
                            </div>
                        </div>

                        {/* Betting Board */}
                        <div style={{
                            background: 'rgba(255,255,255,0.03)', borderRadius: '24px', padding: '24px',
                            border: '1px solid rgba(255,255,255,0.1)', overflowX: 'auto'
                        }}>

                            {/* Controls */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    {[1, 5, 10, 25, 100].map(val => {
                                        const getColor = (v) => {
                                            if (v === 1) return '#64748b'; // Slate (Grey)
                                            if (v === 5) return '#dc2626'; // Red
                                            if (v === 10) return '#2563eb'; // Blue
                                            if (v === 25) return '#059669'; // Green
                                            if (v === 100) return '#0f172a'; // Black
                                            return '#fff';
                                        };
                                        const bgColor = getColor(val);
                                        const isSelected = chipValue === val;

                                        return (
                                            <button key={val} onClick={() => setChipValue(val)} style={{
                                                width: '48px', height: '48px', borderRadius: '50%',
                                                padding: 0,
                                                background: bgColor,
                                                border: `4px dashed rgba(255,255,255,0.5)`,
                                                boxShadow: isSelected
                                                    ? `0 0 0 3px #fbbf24, 0 8px 16px rgba(0,0,0,0.5)` // Gold ring for selected
                                                    : `0 4px 6px rgba(0,0,0,0.4), inset 0 2px 4px rgba(255,255,255,0.2)`,
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                transform: isSelected ? 'translateY(-4px) scale(1.1)' : 'scale(1)',
                                                transition: 'all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                                                position: 'relative',
                                                cursor: 'pointer',
                                                flexShrink: 0
                                            }}>
                                                <div style={{
                                                    width: '32px', height: '32px', borderRadius: '50%',
                                                    background: 'rgba(255,255,255,0.1)',
                                                    border: '1px solid rgba(255,255,255,0.3)',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    color: '#fff', fontSize: '13px', fontWeight: '900',
                                                    textShadow: '0 1px 2px rgba(0,0,0,0.8)'
                                                }}>
                                                    {val}
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                    <div style={{ marginRight: '16px', fontSize: '14px', color: '#94a3b8' }}>
                                        Bet: <span style={{ color: '#fff', fontWeight: 'bold' }}>${getTotalBet().toFixed(2)}</span>
                                        {getTotalBet() > 0 && (
                                            <span style={{ marginLeft: '12px', color: '#10b981' }}>
                                                Max Payout: <span style={{ fontWeight: 'bold' }}>${(() => {
                                                    let maxWin = 0;
                                                    // Check all 37 outcomes to find max potential win
                                                    for (let i = 0; i <= 36; i++) {
                                                        let currentWin = 0;
                                                        Object.entries(bets).forEach(([key, amount]) => {
                                                            currentWin += checkWin(key, i, amount);
                                                        });
                                                        if (currentWin > maxWin) maxWin = currentWin;
                                                    }
                                                    return maxWin.toFixed(2);
                                                })()}</span>
                                            </span>
                                        )}
                                    </div>
                                    <button onClick={clearBets} disabled={gameState !== 'IDLE'} style={{ padding: '8px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', border: 'none', cursor: 'pointer' }}><Trash2 size={16} /></button>
                                </div>
                            </div>

                            {/* Responsive Styles */}
                            <style jsx>{`
                                @media (min-width: 769px) {
                                    .desktop-board { display: grid !important; }
                                    .mobile-board { display: none !important; }
                                }
                                @media (max-width: 768px) {
                                    .desktop-board { display: none !important; }
                                    .mobile-board { display: grid !important; }
                                }
                            `}</style>

                            {/* DESKTOP BOARD (Horizontal) */}
                            <div className="desktop-board" style={{ gridTemplateColumns: 'minmax(40px, auto) repeat(12, 1fr)', gap: '4px', maxWidth: '100%', minWidth: '600px' }}>
                                {/* 0 */}
                                <div onClick={() => handlePlaceBet('straight_0')} style={{
                                    gridRow: '1 / span 3', background: COLORS[0],
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', cursor: 'pointer',
                                    borderRadius: '4px 0 0 4px', border: '1px solid rgba(255,255,255,0.1)', position: 'relative'
                                }}>
                                    0
                                    {bets['straight_0'] && <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '24px', height: '24px', borderRadius: '50%', background: 'white', color: 'black', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>{bets['straight_0']}</div>}
                                </div>

                                {/* Numbers 1-36 */}
                                {[3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36].map(n => (
                                    <NumberCell key={n} num={n} handlePlaceBet={handlePlaceBet} bets={bets} />
                                ))}

                                <div style={{ gridColumn: '2 / span 4', gridRow: '4' }}>
                                    <BetButton label="1st 12" onClick={() => handlePlaceBet('doz_1')} amount={bets['doz_1']} />
                                </div>
                                <div style={{ gridColumn: '6 / span 4', gridRow: '4' }}>
                                    <BetButton label="2nd 12" onClick={() => handlePlaceBet('doz_2')} amount={bets['doz_2']} />
                                </div>
                                <div style={{ gridColumn: '10 / span 4', gridRow: '4' }}>
                                    <BetButton label="3rd 12" onClick={() => handlePlaceBet('doz_3')} amount={bets['doz_3']} />
                                </div>

                                <div style={{ gridColumn: '2 / span 2', gridRow: '5' }}>
                                    <BetButton label="1-18" onClick={() => handlePlaceBet('low')} amount={bets['low']} />
                                </div>
                                <div style={{ gridColumn: '4 / span 2', gridRow: '5' }}>
                                    <BetButton label="Even" onClick={() => handlePlaceBet('even')} amount={bets['even']} />
                                </div>
                                <div style={{ gridColumn: '6 / span 2', gridRow: '5' }}>
                                    <BetButton label="Red" bg="#ef4444" onClick={() => handlePlaceBet('red')} amount={bets['red']} />
                                </div>
                                <div style={{ gridColumn: '8 / span 2', gridRow: '5' }}>
                                    <BetButton label="Black" bg="#1f2937" onClick={() => handlePlaceBet('black')} amount={bets['black']} />
                                </div>
                                <div style={{ gridColumn: '10 / span 2', gridRow: '5' }}>
                                    <BetButton label="Odd" onClick={() => handlePlaceBet('odd')} amount={bets['odd']} />
                                </div>
                                <div style={{ gridColumn: '12 / span 2', gridRow: '5' }}>
                                    <BetButton label="19-36" onClick={() => handlePlaceBet('high')} amount={bets['high']} />
                                </div>

                                {/* Middle Row numbers */}
                                {[2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35].map(n => (
                                    <NumberCell key={n} num={n} handlePlaceBet={handlePlaceBet} bets={bets} row={2} />
                                ))}

                                {/* Bottom Row numbers */}
                                {[1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34].map(n => (
                                    <NumberCell key={n} num={n} handlePlaceBet={handlePlaceBet} bets={bets} row={3} />
                                ))}
                            </div>

                            {/* MOBILE BOARD (Vertical) */}
                            <div className="mobile-board" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px', width: '100%' }}>
                                {/* 0 spans top */}
                                <div onClick={() => handlePlaceBet('straight_0')} style={{
                                    gridColumn: '1 / span 3', background: COLORS[0],
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', cursor: 'pointer',
                                    height: '50px', borderRadius: '4px 4px 0 0', border: '1px solid rgba(255,255,255,0.1)', position: 'relative'
                                }}>
                                    0
                                    {bets['straight_0'] && <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '24px', height: '24px', borderRadius: '50%', background: 'white', color: 'black', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>{bets['straight_0']}</div>}
                                </div>

                                {/* Numbers 1-36 Vertical Flow */}
                                {Array.from({ length: 36 }, (_, i) => i + 1).map(n => (
                                    <NumberCell key={n} num={n} handlePlaceBet={handlePlaceBet} bets={bets} />
                                ))}

                                {/* Dozens below numbers */}
                                <div style={{ gridColumn: '1 / span 3', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '4px', marginTop: '8px' }}>
                                    <BetButton label="1st 12" onClick={() => handlePlaceBet('doz_1')} amount={bets['doz_1']} />
                                    <BetButton label="2nd 12" onClick={() => handlePlaceBet('doz_2')} amount={bets['doz_2']} />
                                    <BetButton label="3rd 12" onClick={() => handlePlaceBet('doz_3')} amount={bets['doz_3']} />
                                </div>

                                {/* Even Money Bets */}
                                <div style={{ gridColumn: '1 / span 3', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
                                    <BetButton label="1-18" onClick={() => handlePlaceBet('low')} amount={bets['low']} />
                                    <BetButton label="Even" onClick={() => handlePlaceBet('even')} amount={bets['even']} />
                                    <BetButton label="Red" bg="#ef4444" onClick={() => handlePlaceBet('red')} amount={bets['red']} />
                                    <BetButton label="Black" bg="#1f2937" onClick={() => handlePlaceBet('black')} amount={bets['black']} />
                                    <BetButton label="Odd" onClick={() => handlePlaceBet('odd')} amount={bets['odd']} />
                                    <BetButton label="19-36" onClick={() => handlePlaceBet('high')} amount={bets['high']} />
                                </div>
                            </div>
                        </div>

                        {/* Action Button */}
                        <div style={{ marginTop: '24px' }}>
                            {gameState === 'RESULT' ? (
                                <button onClick={resetGame} className="btn" style={{
                                    width: '100%', padding: '20px', fontSize: '24px', fontWeight: 'bold', borderRadius: '16px',
                                    background: 'linear-gradient(to right, #3b82f6, #2563eb)', border: 'none', color: '#fff',
                                    boxShadow: '0 10px 25px -5px rgba(59, 130, 246, 0.5)'
                                }}>
                                    New Game
                                </button>
                            ) : (
                                <button onClick={spinWheel} disabled={gameState === 'SPINNING'} className="btn" style={{
                                    width: '100%', padding: '20px', fontSize: '24px', fontWeight: 'bold', borderRadius: '16px',
                                    background: gameState === 'SPINNING' ? '#334155' : 'linear-gradient(to right, #10b981, #059669)',
                                    border: 'none', color: '#fff',
                                    boxShadow: gameState === 'SPINNING' ? 'none' : '0 10px 25px -5px rgba(16, 185, 129, 0.5)',
                                    cursor: gameState === 'SPINNING' ? 'not-allowed' : 'pointer'
                                }}>
                                    {gameState === 'SPINNING' ? 'Spinning...' : 'SPIN'}
                                </button>
                            )}
                        </div>

                    </div>

                    {/* RIGHT COLUMN: STATS */}
                    <div className="stats-sidebar" style={{
                        marginTop: '0px',
                        background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(10px)',
                        borderRadius: '24px', padding: '24px', border: '1px solid rgba(255,255,255,0.1)',
                        minHeight: '400px'
                    }}>
                        <BiggestWins game="roulette" />

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px', color: '#94a3b8', marginTop: '30px' }}>
                            <History size={16} />
                            <h3 style={{ fontSize: '14px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px', margin: 0 }}>
                                Session Stats
                            </h3>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {userHistory.map((h) => {
                                const net = h.net !== undefined ? h.net : (h.payout - h.bet);
                                const resultType = h.result === 'win' || h.result === 'won' ? 'win' : h.result === 'even' ? 'even' : 'loss';

                                return (
                                    <div key={h.id} className="animate-fade" style={{
                                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                        padding: '12px', borderRadius: '12px',
                                        background: resultType === 'win' ? 'rgba(16, 185, 129, 0.1)' : resultType === 'even' ? 'rgba(148, 163, 184, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                        border: `1px solid ${resultType === 'win' ? 'rgba(16, 185, 129, 0.2)' : resultType === 'even' ? 'rgba(148, 163, 184, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`
                                    }}>
                                        <div>
                                            <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '2px' }}>
                                                Result: {h.number} ({h.color})
                                            </div>
                                            <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#fff' }}>
                                                Bet: ${h.bet.toFixed(2)}
                                            </div>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '2px' }}>
                                                {resultType === 'win' ? 'Net Win' : resultType === 'even' ? 'Even' : 'Net Loss'}
                                            </div>
                                            <div style={{ fontSize: '16px', fontWeight: 'bold', color: resultType === 'win' ? '#10b981' : resultType === 'even' ? '#94a3b8' : '#ef4444' }}>
                                                {resultType === 'win' ? `+$${net.toFixed(2)}` : resultType === 'even' ? '$0.00' : `-$${Math.abs(net).toFixed(2)}`}
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}

function NumberCell({ num, handlePlaceBet, bets, row }) {
    // Determine grid position based on number if strictly using grid.
    // However, I used map order for rows.
    // Row 3 (top on board? usually 3,6,9 on top row in visuals usually)

    return (
        <div
            onClick={() => handlePlaceBet(`straight_${num}`)}
            style={{
                background: COLORS[num] === 'red' ? '#ef4444' : '#1f2937',
                color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                height: '50px', fontWeight: 'bold', cursor: 'pointer',
                borderRadius: '4px', border: '1px solid rgba(255,255,255,0.1)',
                position: 'relative',
                boxShadow: 'inset 0 0 10px rgba(0,0,0,0.2)'
            }}
        >
            {num}
            {bets[`straight_${num}`] && (
                <div style={{
                    position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                    width: '24px', height: '24px', borderRadius: '50%', background: 'white', color: 'black',
                    fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.5)', zIndex: 2
                }}>
                    {bets[`straight_${num}`]}
                </div>
            )}
        </div>
    )
}

function BetButton({ label, onClick, amount, bg }) {
    return (
        <div
            onClick={onClick}
            style={{
                background: bg || 'rgba(255,255,255,0.05)',
                color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                height: '40px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px',
                borderRadius: '4px', border: '1px solid rgba(255,255,255,0.1)',
                position: 'relative', marginTop: '4px'
            }}
        >
            {label}
            {amount && (
                <div style={{
                    position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                    width: '24px', height: '24px', borderRadius: '50%', background: 'white', color: 'black',
                    fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.5)', zIndex: 2
                }}>
                    {amount}
                </div>
            )}
        </div>
    )
}
