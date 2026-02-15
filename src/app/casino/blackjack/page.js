"use client";
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ChevronLeft, Club, History, AlertCircle } from 'lucide-react';
import { useApp } from '../../../lib/store';
import { doc, updateDoc, increment, addDoc, collection } from 'firebase/firestore';

export default function BlackjackGame() {
    const { user, db } = useApp();
    const [gameState, setGameState] = useState('IDLE'); // 'IDLE', 'PLAYING', 'FINISHED'
    const [betAmount, setBetAmount] = useState('1.00');
    // Balance is tracked via user.balance in context

    // Cards: { suit: '♠', value: '10', display: '10' }
    const [playerHand, setPlayerHand] = useState([]);
    const [dealerHand, setDealerHand] = useState([]);
    const [deck, setDeck] = useState([]);

    const [message, setMessage] = useState('Place your bet to start');
    const [userHistory, setUserHistory] = useState([]);

    // Suits & Values
    const SUITS = ['♠', '♥', '♦', '♣'];
    const VALUES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

    // Calculate Hand Value
    const getHandValue = (hand) => {
        let value = 0;
        let aces = 0;
        for (let card of hand) {
            if (['J', 'Q', 'K'].includes(card.value)) value += 10;
            else if (card.value === 'A') { value += 11; aces++; }
            else value += parseInt(card.value);
        }
        while (value > 21 && aces > 0) {
            value -= 10;
            aces--;
        }
        return value;
    };

    // Initialize Deck
    const createDeck = () => {
        let newDeck = [];
        for (let suit of SUITS) {
            for (let val of VALUES) {
                newDeck.push({ suit, value: val });
            }
        }
        return newDeck.sort(() => Math.random() - 0.5); // Shuffle
    };

    // Start Game
    const deal = async () => {
        if (!user) return alert("Please login to play.");
        const amount = parseFloat(betAmount);
        if (isNaN(amount) || amount <= 0) return alert("Invalid bet amount.");
        if ((user.balance || 0) < amount) return alert("Insufficient balance.");

        try {
            // Deduct Bet
            const userRef = doc(db, 'users', user.id);
            await updateDoc(userRef, { balance: increment(-amount) });

            const newDeck = createDeck();
            const pHand = [newDeck.pop(), newDeck.pop()];
            const dHand = [newDeck.pop(), newDeck.pop()];

            setDeck(newDeck);
            setPlayerHand(pHand);
            setDealerHand(dHand);
            setGameState('PLAYING');
            setMessage('Hit or Stand?');

            // Check Instant Blackjack
            const pVal = getHandValue(pHand);
            if (pVal === 21) {
                // Determine immediately if dealer also has BJ or if player wins 3:2
                // Dealer hidden card is index 0 in our array logic for now, let's peek
                const dVal = getHandValue(dHand);

                if (dVal === 21) {
                    handleGameOver(pHand, dHand, amount, 'Push! Both have Blackjack.'); // Push
                } else {
                    handleGameOver(pHand, dHand, amount * 2.5, 'BLACKJACK! You win!'); // 1.5x payout + bet back
                }
            }

        } catch (e) {
            console.error(e);
            alert("Error starting game");
        }
    };

    // Hit
    const hit = () => {
        const newDeck = [...deck];
        const card = newDeck.pop();
        const newHand = [...playerHand, card];

        setDeck(newDeck);
        setPlayerHand(newHand);

        const val = getHandValue(newHand);
        if (val > 21) {
            handleGameOver(newHand, dealerHand, 0, 'Bust! You went over 21.'); // Bust
        }
    };

    // Stand
    const stand = () => {
        let dHand = [...dealerHand];
        let dDeck = [...deck];

        // Dealer AI: Hit until 17
        while (getHandValue(dHand) < 17) {
            const card = dDeck.pop();
            dHand.push(card);
        }

        setDeck(dDeck);
        setDealerHand(dHand);

        calculateWinner(playerHand, dHand);
    };

    // Determine Winner
    const calculateWinner = async (pHand, dHand) => {
        const pVal = getHandValue(pHand);
        const dVal = getHandValue(dHand);
        const amount = parseFloat(betAmount);
        let winAmount = 0;
        let resultMsg = '';

        if (dVal > 21) {
            winAmount = amount * 2;
            resultMsg = 'Dealer Busts! You Win!';
        } else if (pVal > dVal) {
            winAmount = amount * 2; // 1:1 Payout
            resultMsg = 'You Win!';
        } else if (pVal === dVal) {
            winAmount = amount; // Push
            resultMsg = 'Push (Tie)';
        } else {
            winAmount = 0; // Loss
            resultMsg = 'Dealer Wins';
        }

        handleGameOver(pHand, dHand, winAmount, resultMsg);
    };

    const handleGameOver = async (pHand, dHand, payout, msg) => {
        setGameState('FINISHED');
        if (msg) setMessage(msg);

        if (payout > 0) {
            const userRef = doc(db, 'users', user.id);
            await updateDoc(userRef, { balance: increment(payout) });
        }

        const amount = parseFloat(betAmount);
        const profit = payout - amount;
        const result = profit > 0 ? 'won' : profit === 0 ? 'push' : 'loss';

        // Save to Casino History
        try {
            await addDoc(collection(db, 'casino_bets'), {
                userId: user.id,
                username: user.username || 'User',
                game: 'blackjack',
                amount: amount,
                payout: payout,
                multiplier: amount > 0 ? payout / amount : 0,
                result: result,
                timestamp: Date.now()
            });

            // Check for Jackpot ($10k+ or >5x)
            const multiplier = amount > 0 ? payout / amount : 0;
            if (payout >= 10000 || multiplier > 5) {
                addDoc(collection(db, 'jackpots'), {
                    userId: user.id,
                    username: user.username || 'User',
                    game: 'blackjack',
                    amount: payout,
                    multiplier: multiplier,
                    timestamp: Date.now()
                }).catch(e => console.error("Error saving jackpot:", e));
            }
        } catch (err) {
            console.error(err);
        }

        setUserHistory(prev => [{
            id: Date.now(),
            result: result,
            profit: profit,
            pVal: getHandValue(pHand),
            dVal: getHandValue(dHand)
        }, ...prev]);
    };

    // Display Card Helper
    const Card = ({ card, hidden }) => (
        <div style={{
            width: '80px', height: '112px',
            background: hidden ? 'linear-gradient(135deg, #1e293b, #0f172a)' : '#fff',
            borderRadius: '8px',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
            color: ['♥', '♦'].includes(card?.suit) ? '#ef4444' : '#000',
            border: hidden ? '2px solid #334155' : 'none',
            fontSize: '24px', fontWeight: 'bold',
            userSelect: 'none'
        }}>
            {hidden ? (
                <div style={{ fontSize: '32px' }}>🛡️</div>
            ) : (
                <>
                    <div>{card.value}</div>
                    <div style={{ fontSize: '32px' }}>{card.suit}</div>
                </>
            )}
        </div>
    );

    return (
        <div className="animate-fade" style={{
            minHeight: '100vh',
            background: 'radial-gradient(circle at top center, #2e1065 0%, #000000 60%)',
            padding: '20px',
            color: '#fff',
            fontFamily: 'var(--font-heading)'
        }}>
            {/* Background Glow */}
            <div style={{ position: 'fixed', top: '20%', right: '20%', width: '400px', height: '400px', background: '#10b981', filter: 'blur(200px)', opacity: 0.1, pointerEvents: 'none' }}></div>

            <div style={{ maxWidth: '1000px', margin: '0 auto', position: 'relative', zIndex: 1 }}>

                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '40px' }}>
                    <Link href="/casino" style={{
                        display: 'flex', alignItems: 'center', gap: '8px',
                        color: '#94a3b8', textDecoration: 'none', fontSize: '14px',
                        background: 'rgba(255,255,255,0.05)', padding: '8px 16px', borderRadius: '20px',
                        transition: 'background 0.2s',
                        backdropFilter: 'blur(5px)'
                    }}>
                        <ChevronLeft size={16} /> Back
                    </Link>
                    <h1 style={{ flex: 1, textAlign: 'center', fontSize: '28px', fontWeight: '900', color: '#fff', textShadow: '0 0 20px rgba(16, 185, 129, 0.6)' }}>BLACKJACK</h1>
                    <div style={{ width: '80px' }}></div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px', alignItems: 'start' }}>

                    {/* GAME AREA */}
                    <div style={{
                        background: 'rgba(0,0,0,0.6)', borderRadius: '24px', padding: '40px',
                        border: '1px solid rgba(255,255,255,0.1)', minHeight: '500px',
                        display: 'flex', flexDirection: 'column', justifyContent: 'space-between', alignItems: 'center',
                        boxShadow: '0 20px 50px -10px rgba(0,0,0,0.5)',
                        backdropFilter: 'blur(20px)'
                    }}>

                        {/* Dealer Hand */}
                        <div style={{ textAlign: 'center', width: '100%' }}>
                            <div style={{ marginBottom: '12px', fontSize: '14px', color: '#94a3b8', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px' }}>Dealer</div>
                            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', height: '120px' }}>
                                {gameState === 'IDLE' ? (
                                    <>
                                        <div style={{ width: '80px', height: '112px', border: '2px dashed rgba(255,255,255,0.1)', borderRadius: '8px' }}></div>
                                        <div style={{ width: '80px', height: '112px', border: '2px dashed rgba(255,255,255,0.1)', borderRadius: '8px' }}></div>
                                    </>
                                ) : (
                                    dealerHand.map((card, i) => (
                                        <Card key={i} card={card} hidden={gameState === 'PLAYING' && i === 1} />
                                    ))
                                )}
                            </div>
                            {/* Dealer Score (Hidden during play) */}
                            {gameState === 'FINISHED' && (
                                <div className="animate-fade" style={{ marginTop: '12px', fontWeight: 'bold', fontSize: '18px' }}>{getHandValue(dealerHand)}</div>
                            )}
                        </div>

                        {/* Center Message */}
                        <div style={{ textAlign: 'center', padding: '32px 0' }}>
                            <div style={{
                                fontSize: '32px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '2px',
                                color: message.includes('Win') ? '#10b981' : message.includes('Bust') || message.includes('Dealer Wins') ? '#ef4444' : '#fff',
                                textShadow: message.includes('Win') ? '0 0 20px rgba(16, 185, 129, 0.5)' : 'none'
                            }}>
                                {message}
                            </div>
                        </div>

                        {/* Player Hand */}
                        <div style={{ textAlign: 'center', width: '100%' }}>
                            <div style={{ marginBottom: '12px', fontSize: '14px', color: '#94a3b8', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px' }}>You</div>
                            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', height: '120px' }}>
                                {gameState === 'IDLE' ? (
                                    <>
                                        <div style={{ width: '80px', height: '112px', border: '2px dashed rgba(255,255,255,0.1)', borderRadius: '8px' }}></div>
                                        <div style={{ width: '80px', height: '112px', border: '2px dashed rgba(255,255,255,0.1)', borderRadius: '8px' }}></div>
                                    </>
                                ) : (
                                    playerHand.map((card, i) => (
                                        <Card key={i} card={card} />
                                    ))
                                )}
                            </div>
                            {gameState !== 'IDLE' && (
                                <div style={{ marginTop: '12px', fontWeight: 'bold', fontSize: '18px' }}>{getHandValue(playerHand)}</div>
                            )}
                        </div>

                        {/* Controls */}
                        <div style={{ marginTop: '40px', display: 'flex', gap: '16px', width: '100%', maxWidth: '400px', justifyContent: 'center' }}>
                            {gameState === 'PLAYING' ? (
                                <>
                                    <button onClick={hit} className="btn" style={{
                                        flex: 1, background: 'linear-gradient(to bottom, #3b82f6, #2563eb)',
                                        border: 'none', padding: '16px', borderRadius: '16px', fontSize: '18px', fontWeight: 'bold',
                                        boxShadow: '0 4px 0 #1d4ed8', transform: 'translateY(-2px)'
                                    }}>Hit</button>
                                    <button onClick={stand} className="btn" style={{
                                        flex: 1, background: 'linear-gradient(to bottom, #ef4444, #dc2626)',
                                        border: 'none', padding: '16px', borderRadius: '16px', fontSize: '18px', fontWeight: 'bold',
                                        boxShadow: '0 4px 0 #b91c1c', transform: 'translateY(-2px)'
                                    }}>Stand</button>
                                </>
                            ) : (
                                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center' }}>
                                    <div style={{
                                        display: 'flex', alignItems: 'center', gap: '12px',
                                        background: 'rgba(255,255,255,0.05)', padding: '12px 24px', borderRadius: '16px',
                                        border: '1px solid rgba(255,255,255,0.1)'
                                    }}>
                                        <label style={{ fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase', color: '#94a3b8' }}>Bet Amount</label>
                                        <div style={{ display: 'flex', alignItems: 'center', color: '#fff' }}>
                                            <span style={{ marginRight: '4px', color: '#10b981' }}>$</span>
                                            <input
                                                type="number" value={betAmount} onChange={e => setBetAmount(e.target.value)}
                                                style={{ background: 'transparent', border: 'none', color: '#fff', width: '60px', fontSize: '20px', fontWeight: 'bold', outline: 'none' }}
                                            />
                                        </div>
                                    </div>
                                    <div style={{ fontSize: '12px', color: '#94a3b8' }}>Balance: <span style={{ color: '#fff' }}>${user?.balance?.toFixed(2) || '0.00'}</span></div>

                                    <button onClick={deal} className="btn" style={{
                                        width: '100%', background: 'linear-gradient(to bottom, #10b981, #059669)',
                                        border: 'none', padding: '16px', borderRadius: '16px', fontSize: '20px', fontWeight: 'bold', textTransform: 'uppercase',
                                        boxShadow: '0 4px 0 #047857', transform: 'translateY(-2px)'
                                    }}>
                                        Deal Cards
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* HISTORY SIDEBAR */}
                    <div style={{
                        background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(10px)',
                        borderRadius: '24px', padding: '24px', border: '1px solid rgba(255,255,255,0.1)',
                        minHeight: '400px', maxHeight: '600px', overflowY: 'auto'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px', color: '#94a3b8' }}>
                            <History size={16} />
                            <h3 style={{ fontSize: '14px', fontWeight: 'bold', textTransform: 'uppercase', margin: 0, letterSpacing: '1px' }}>Session History</h3>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {userHistory.map(h => (
                                <div key={h.id} style={{
                                    display: 'flex', justifyContent: 'space-between', padding: '12px',
                                    background: h.result === 'won' ? 'rgba(16, 185, 129, 0.1)' : h.result === 'push' ? 'rgba(255,255,255,0.05)' : 'rgba(239, 68, 68, 0.1)',
                                    borderRadius: '12px',
                                    border: `1px solid ${h.result === 'won' ? 'rgba(16, 185, 129, 0.2)' : h.result === 'push' ? 'rgba(255,255,255,0.1)' : 'rgba(239, 68, 68, 0.2)'}`
                                }}>
                                    <div>
                                        <div style={{ fontSize: '12px', color: '#94a3b8' }}>You: {h.pVal} / Dlr: {h.dVal}</div>
                                        <div style={{ fontWeight: 'bold', color: h.result === 'won' ? '#10b981' : h.result === 'push' ? '#94a3b8' : '#ef4444', textTransform: 'uppercase', fontSize: '14px' }}>
                                            {h.result}
                                        </div>
                                    </div>
                                    <div style={{ fontWeight: 'bold', color: h.result === 'won' ? '#10b981' : h.result === 'push' ? '#94a3b8' : '#ef4444', display: 'flex', alignItems: 'center' }}>
                                        {h.result === 'won' ? '+' : ''}{h.profit.toFixed(2)}
                                    </div>
                                </div>
                            ))}
                            {userHistory.length === 0 && <div style={{ textAlign: 'center', color: '#666', fontSize: '14px', padding: '20px' }}>No hands played yet.</div>}
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}
