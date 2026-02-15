"use client";
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { ChevronLeft, Rocket, History } from 'lucide-react';
import { useApp } from '../../../lib/store';
import { doc, updateDoc, increment, addDoc, collection } from 'firebase/firestore';

export default function CrashGame() {
    const { user, db } = useApp();
    const [gameState, setGameState] = useState('IDLE'); // 'IDLE', 'PLAYING', 'CRASHED', 'CASHED_OUT'
    const [multiplier, setMultiplier] = useState(1.00);
    const [betAmount, setBetAmount] = useState('');
    const [payout, setPayout] = useState(0);
    const [history, setHistory] = useState([]); // Global crash points
    const [userHistory, setUserHistory] = useState([]); // User's personal bets in this session

    // Game Logic Refs
    const crashPointRef = useRef(0);
    const startTimeRef = useRef(0);
    const requestRef = useRef();
    const lockedBetAmountRef = useRef(0); // Stores bet amount at start of game
    const gameLoopRef = useRef();

    // Generate Crash Point
    const generateCrashPoint = () => {
        const r = Math.random();
        // 10% chance of instant crash
        if (r < 0.1) {
            return 1.00 + (Math.random() * 0.05);
        }
        // Classic crash curve
        let crash = 0.99 / (1 - Math.random());
        if (crash < 1.05) crash = 1.05;
        if (crash > 50) crash = 50;
        return crash;
    };

    const handleCashOut = async () => {
        if (gameState !== 'PLAYING') return;

        // Stop Game for User
        setGameState('CASHED_OUT');
        const bet = lockedBetAmountRef.current;
        const currentMulti = multiplier;
        const winAmount = bet * currentMulti;
        setPayout(winAmount);

        // Update Balance
        const userRef = doc(db, 'users', user.id);
        await updateDoc(userRef, {
            balance: increment(winAmount)
        });

        // Add to User History (Win)
        setUserHistory(prev => [{
            id: Date.now(),
            multiplier: currentMulti,
            amount: bet,
            payout: winAmount,
            result: 'won'
        }, ...prev]);

        // Save to Casino History
        try {
            await addDoc(collection(db, 'casino_bets'), {
                userId: user.id,
                username: user.username || 'User',
                game: 'crash',
                amount: bet,
                payout: winAmount,
                multiplier: currentMulti,
                result: 'won',
                timestamp: Date.now()
            });

            // Check for Global Jackpot Announcement (> 5x or $10k+)
            if (currentMulti > 5 || winAmount >= 10000) {
                addDoc(collection(db, 'jackpots'), {
                    userId: user.id,
                    username: user.username || 'User',
                    game: 'crash',
                    amount: winAmount,
                    multiplier: currentMulti,
                    timestamp: Date.now()
                }).catch(e => console.error("Error saving jackpot:", e));
            }
        } catch (e) {
            console.error(e);
        }
    };

    // Define Game Loop
    gameLoopRef.current = () => {
        const elapsed = (Date.now() - startTimeRef.current) / 1000; // seconds
        const nextMult = Math.exp(0.12 * elapsed);

        if (nextMult >= crashPointRef.current) {
            // CRASHED
            const crashVal = crashPointRef.current;
            setMultiplier(crashVal);
            setHistory(prev => [crashVal, ...prev].slice(0, 5));

            // Check if user is still playing (caught in crash)
            // We rely on the closure 'gameState' which is fresh because gameLoopRef is updated on render
            if (gameState === 'PLAYING') {
                // USER LOST
                const bet = lockedBetAmountRef.current;
                setUserHistory(h => [{
                    id: Date.now(),
                    multiplier: crashVal,
                    amount: bet,
                    payout: 0,
                    result: 'lost'
                }, ...h]);

                // Save Loss to DB
                addDoc(collection(db, 'casino_bets'), {
                    userId: user.id,
                    username: user.username || 'User',
                    game: 'crash',
                    amount: bet,
                    payout: 0,
                    multiplier: 0,
                    result: 'lost',
                    timestamp: Date.now()
                }).catch(e => console.error("Error saving crash loss:", e));
            }

            setGameState('CRASHED');
        } else {
            // Continuation
            setMultiplier(nextMult);
            requestRef.current = requestAnimationFrame(gameLoopRef.current);
        }
    };

    const handlePlaceBet = async () => {
        if (!user) return alert("Please login to play.");
        const amount = parseFloat(betAmount);
        if (isNaN(amount) || amount <= 0) return alert("Invalid bet amount.");
        if ((user.balance || 0) < amount) return alert("Insufficient balance.");

        try {
            // Lock bet amount
            lockedBetAmountRef.current = amount;

            // Deduct Balance
            const userRef = doc(db, 'users', user.id);
            await updateDoc(userRef, {
                balance: increment(-amount)
            });

            // Reset Game State
            setGameState('PLAYING');
            setPayout(0);
            setMultiplier(1.00);

            // Start Logic
            const crash = generateCrashPoint();
            crashPointRef.current = crash;
            console.log("Crash Point:", crash);

            startTimeRef.current = Date.now();
            requestRef.current = requestAnimationFrame(gameLoopRef.current);

        } catch (e) {
            console.error(e);
            alert("Error placing bet");
        }
    };

    // Cleanup
    useEffect(() => {
        return () => cancelAnimationFrame(requestRef.current);
    }, []);

    // Helper color for history
    const getColor = (val) => val >= 2.0 ? '#10b981' : val >= 1.5 ? '#f59e0b' : '#ef4444';

    return (
        <div className="animate-fade" style={{
            minHeight: '100vh',
            background: 'radial-gradient(circle at top center, #2e1065 0%, #000000 60%)',
            padding: '20px',
            color: '#fff',
            fontFamily: 'var(--font-heading)'
        }}>
            {/* Ambient Background Glows */}
            <div style={{ position: 'fixed', top: '10%', left: '0', width: '300px', height: '300px', background: '#f59e0b', filter: 'blur(150px)', opacity: 0.1, pointerEvents: 'none', zIndex: 0 }}></div>
            <div style={{ position: 'fixed', bottom: '10%', right: '0', width: '400px', height: '400px', background: '#ec4899', filter: 'blur(150px)', opacity: 0.1, pointerEvents: 'none', zIndex: 0 }}></div>

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
                        textTransform: 'uppercase', letterSpacing: '2px', textShadow: '0 0 20px rgba(239, 68, 68, 0.6)'
                    }}>
                        CRASH
                    </h1>
                    <div style={{ width: '80px' }}></div>
                </div>

                {/* Main Grid Layout */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px', alignItems: 'start' }}>

                    {/* LEFT COLUMN: GAME AREA */}
                    <div style={{ maxWidth: '800px', width: '100%', margin: '0 auto' }}>
                        {/* Global History Bar */}
                        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', justifyContent: 'center', minHeight: '30px' }}>
                            {history.map((h, i) => (
                                <div key={i} className="animate-fade" style={{
                                    padding: '4px 12px', borderRadius: '12px',
                                    background: 'rgba(255,255,255,0.05)', fontSize: '12px', fontWeight: 'bold',
                                    color: getColor(h), border: `1px solid ${getColor(h)}40`
                                }}>
                                    {h.toFixed(2)}x
                                </div>
                            ))}
                        </div>

                        {/* Game Canvas */}
                        <div style={{
                            height: '400px',
                            background: 'rgba(0, 0, 0, 0.6)',
                            backdropFilter: 'blur(20px)',
                            borderRadius: '24px',
                            border: gameState === 'CRASHED' ? '1px solid #ef4444' : gameState === 'CASHED_OUT' ? '1px solid #10b981' : '1px solid rgba(255, 255, 255, 0.1)',
                            position: 'relative',
                            overflow: 'hidden',
                            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                            marginBottom: '24px',
                            boxShadow: '0 20px 50px -10px rgba(0, 0, 0, 0.5)',
                            transition: 'border-color 0.3s'
                        }}>
                            {/* ROCKET ANIMATION */}
                            {(gameState === 'PLAYING' || gameState === 'CASHED_OUT') && (
                                <div style={{
                                    position: 'absolute',
                                    bottom: `${Math.min((multiplier - 1) * 20 + 10, 80)}%`,
                                    left: '50%',
                                    transform: `translateX(-50%) rotate(${-45 + (Math.min((multiplier - 1) * 10, 45))}deg)`,
                                    transition: 'bottom 0.1s linear, transform 0.1s linear'
                                }}>
                                    <Rocket size={64} color={gameState === 'CASHED_OUT' ? '#10b981' : '#f59e0b'} fill={gameState === 'CASHED_OUT' ? '#10b981' : '#f59e0b'} />
                                    <div style={{
                                        position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)',
                                        width: '10px', height: '40px', background: 'linear-gradient(to bottom, #f59e0b, transparent)',
                                        filter: 'blur(4px)', opacity: 0.8
                                    }}></div>
                                </div>
                            )}

                            {/* CRASH EXPLOSION */}
                            {gameState === 'CRASHED' && (
                                <div className="animate-pulse" style={{ fontSize: '64px' }}>💥</div>
                            )}

                            <div style={{ textAlign: 'center', zIndex: 2, marginTop: '40px' }}>
                                <div style={{
                                    fontSize: '80px', fontWeight: '900',
                                    color: gameState === 'CRASHED' ? '#ef4444' : gameState === 'CASHED_OUT' ? '#10b981' : '#fff',
                                    fontVariantNumeric: 'tabular-nums',
                                    textShadow: gameState === 'CRASHED' ? '0 0 30px rgba(239, 68, 68, 0.5)' : '0 0 30px rgba(255, 255, 255, 0.3)'
                                }}>
                                    {multiplier.toFixed(2)}x
                                </div>
                                <p style={{ color: '#94a3b8', fontSize: '14px', letterSpacing: '1px', textTransform: 'uppercase', marginTop: '8px' }}>
                                    {gameState === 'IDLE' ? 'Ready to Fly' : gameState === 'CRASHED' ? 'CRASHED' : gameState === 'CASHED_OUT' ? `Cashed Out: +$${payout.toFixed(2)}` : 'Flying...'}
                                </p>
                            </div>

                            <div style={{
                                position: 'absolute', bottom: 0, left: 0, width: '100%', height: '100%',
                                background: `linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)`,
                                backgroundSize: '40px 40px', maskImage: 'linear-gradient(to bottom, transparent, black)', pointerEvents: 'none'
                            }}></div>
                        </div>

                        {/* Controls */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.5fr) minmax(0, 1fr)', gap: '16px' }}>
                            <div style={{
                                background: 'rgba(255, 255, 255, 0.03)', backdropFilter: 'blur(10px)',
                                padding: '20px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.05)',
                                opacity: gameState === 'PLAYING' ? 0.5 : 1,
                                pointerEvents: gameState === 'PLAYING' ? 'none' : 'auto'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                    <label style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 'bold', textTransform: 'uppercase' }}>Bet Amount</label>
                                    <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 'bold' }}>
                                        Balance: <span style={{ color: '#fff' }}>${user?.balance?.toFixed(2) || '0.00'}</span>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                                    <div style={{ position: 'relative', flex: 1 }}>
                                        <span style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}>$</span>
                                        <input
                                            type="number" placeholder="0.00" value={betAmount} onChange={e => setBetAmount(e.target.value)}
                                            style={{
                                                width: '100%', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)',
                                                borderRadius: '12px', padding: '16px 16px 16px 32px', color: '#fff', fontSize: '18px', fontWeight: 'bold', outline: 'none'
                                            }}
                                        />
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <button className="btn" onClick={() => setBetAmount((prev) => (parseFloat(prev || 0) / 2).toFixed(2))} style={{
                                        flex: 1,
                                        background: 'linear-gradient(to bottom, #3b82f6, #2563eb)',
                                        border: 'none',
                                        fontSize: '14px',
                                        fontWeight: 'bold',
                                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.2)'
                                    }}>1/2</button>
                                    <button className="btn" onClick={() => setBetAmount((prev) => (parseFloat(prev || 0) * 2).toFixed(2))} style={{
                                        flex: 1,
                                        background: 'linear-gradient(to bottom, #3b82f6, #2563eb)',
                                        border: 'none',
                                        fontSize: '14px',
                                        fontWeight: 'bold',
                                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.2)'
                                    }}>2x</button>
                                    <button className="btn" onClick={() => setBetAmount((user?.balance || 0).toFixed(0))} style={{
                                        flex: 1,
                                        background: 'linear-gradient(to bottom, #8b5cf6, #7c3aed)',
                                        border: 'none',
                                        fontSize: '14px',
                                        fontWeight: 'bold',
                                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.2)'
                                    }}>Max</button>
                                </div>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                {gameState === 'IDLE' || gameState === 'CRASHED' || (gameState === 'CASHED_OUT' && multiplier >= crashPointRef.current) ? (
                                    <button onClick={handlePlaceBet} className="btn" style={{
                                        height: '100%', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', border: 'none',
                                        borderRadius: '20px', fontSize: '24px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '1px',
                                        boxShadow: '0 10px 30px -5px rgba(16, 185, 129, 0.5)', transition: 'transform 0.1s, box-shadow 0.1s'
                                    }} onMouseDown={e => e.currentTarget.style.transform = 'scale(0.98)'} onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}>
                                        Place Bet
                                    </button>
                                ) : (
                                    <button onClick={handleCashOut} disabled={gameState === 'CASHED_OUT'} className="btn" style={{
                                        height: '100%', background: gameState === 'CASHED_OUT' ? '#334155' : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', border: 'none',
                                        borderRadius: '20px', fontSize: '24px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '1px',
                                        boxShadow: gameState === 'CASHED_OUT' ? 'none' : '0 10px 30px -5px rgba(245, 158, 11, 0.5)', transition: 'transform 0.1s, box-shadow 0.1s'
                                    }}>
                                        {gameState === 'CASHED_OUT' ? 'Cashed!' : 'Cash Out'}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* RIGHT COLUMN: STATS SIDEBAR */}
                    <div className="stats-sidebar" style={{
                        marginTop: '46px', // Align with game canvas (below the 30px history bar + 16px margin)
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
                                Session Stats
                            </h3>
                        </div>

                        {userHistory.length === 0 ? (
                            <div style={{ textAlign: 'center', color: '#64748b', fontSize: '14px', padding: '40px 0' }}>
                                No bets this session.<br />Good luck!
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {userHistory.map((h) => (
                                    <div key={h.id} className="animate-fade" style={{
                                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                        padding: '12px', borderRadius: '12px',
                                        background: h.result === 'won' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                        border: `1px solid ${h.result === 'won' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`
                                    }}>
                                        <div>
                                            <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '2px' }}>
                                                {h.result === 'won' ? 'Cashed Out' : 'Crashed At'}
                                            </div>
                                            <div style={{ fontSize: '16px', fontWeight: 'bold', color: h.result === 'won' ? '#10b981' : '#ef4444' }}>
                                                {h.multiplier.toFixed(2)}x
                                            </div>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '2px' }}>
                                                {h.result === 'won' ? 'Win' : 'Loss'}
                                            </div>
                                            <div style={{ fontSize: '16px', fontWeight: 'bold', color: h.result === 'won' ? '#10b981' : '#ef4444' }}>
                                                {h.result === 'won' ? `+$${(h.payout - h.amount).toFixed(2)}` : `-$${h.amount.toFixed(2)}`}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                    </div>

                </div>
            </div>
        </div>
    );
}
