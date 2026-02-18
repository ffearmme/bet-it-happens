"use client";
import { useState, useEffect } from 'react';
import { useApp } from '../../../../lib/store';
import { doc, onSnapshot, updateDoc, runTransaction, serverTimestamp, increment, collection } from 'firebase/firestore';
import { Swords, Clock, User, Trophy, AlertTriangle, ArrowLeft, BookOpen, X, Lock } from 'lucide-react';
import Link from 'next/link';

export default function TicTacToePage({ params }) {
    const { db, user } = useApp();
    const { gameId } = params;
    const [game, setGame] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showRules, setShowRules] = useState(false);

    // Hide Bottom Nav when Rules are open
    useEffect(() => {
        const nav = document.querySelector('.bottom-nav');
        if (nav) {
            if (showRules) {
                nav.style.display = 'none';
            } else {
                nav.style.display = '';
            }
        }
        return () => {
            if (nav) nav.style.display = '';
        };
    }, [showRules]);

    // Listen to Game Data
    useEffect(() => {
        if (!gameId) return;
        const unsub = onSnapshot(doc(db, 'arena_games', gameId), (docSnap) => {
            if (docSnap.exists()) {
                setGame({ id: docSnap.id, ...docSnap.data() });
            }
            setLoading(false);
        });
        return () => unsub();
    }, [db, gameId]);

    // Derived State
    const isPlayer = user && game?.players?.[user.id];
    const playerSymbol = isPlayer ? game.players[user.id].symbol : null;
    const isMyTurn = game?.status === 'active' && game?.currentTurn === user?.id;

    // Timer Logic
    const [timeLeft, setTimeLeft] = useState('');
    useEffect(() => {
        if (game?.status !== 'active' || !game?.lastMoveAt) return;

        const interval = setInterval(() => {
            const now = new Date();
            const lastMove = game.lastMoveAt?.toDate ? game.lastMoveAt.toDate() : new Date(game.lastMoveAt);
            const deadline = new Date(lastMove.getTime() + (game.config.turnTimer * 60 * 60 * 1000));
            const diff = deadline - now;

            if (diff <= 0) {
                setTimeLeft('Expired');
            } else {
                const hours = Math.floor(diff / (1000 * 60 * 60));
                const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                setTimeLeft(`${hours}h ${minutes}m`);
            }
        }, 1000);
        return () => clearInterval(interval);
    }, [game]);


    // --- ACTIONS ---

    const handleCancelChallenge = async () => {
        if (!isCreator || game.status !== 'open') return;
        if (!confirm("Cancel this challenge and refund your wager?")) return;

        try {
            await runTransaction(db, async (transaction) => {
                const gameRef = doc(db, 'arena_games', gameId);
                const gameSnap = await transaction.get(gameRef);
                if (gameSnap.data().status !== 'open') throw "Game not open";

                // Refund
                const userRef = doc(db, 'users', user.id);
                transaction.update(userRef, {
                    balance: increment(game.wager),
                    lockedBalance: increment(-game.wager)
                });

                // Set status cancelled
                transaction.update(gameRef, {
                    status: 'cancelled',
                    cancelledAt: serverTimestamp()
                });
            });
        } catch (e) {
            console.error(e);
            alert("Cancellation failed: " + e);
        }
    };

    const handleJoinGame = async () => {
        if (!user) return alert("Login required");
        if (user.requiresVerification && !user.emailVerified) return alert("Please verify your email to join this duel!");
        if (user.balance < game.wager) return alert("Insufficient funds");

        try {
            await runTransaction(db, async (transaction) => {
                // 1. Check User Balance
                const userRef = doc(db, 'users', user.id);
                const userSnap = await transaction.get(userRef);
                if (userSnap.data().balance < game.wager) throw "Insufficient funds";

                // 2. Read Game again
                const gameRef = doc(db, 'arena_games', gameId);
                const gameSnap = await transaction.get(gameRef);
                const gameData = gameSnap.data();

                if (gameData.status !== 'open') throw "Game already started";

                // Security Check: Private Game
                if (gameData.config?.isPrivate && gameData.config.opponentId !== user.id) {
                    throw "This is a private duel.";
                }

                // 3. Deduct Balance
                transaction.update(userRef, {
                    balance: increment(-game.wager),
                    lockedBalance: increment(game.wager)
                });

                // 4. Update Game (Start it!)
                const players = gameSnap.data().players;
                const creatorId = gameSnap.data().creatorId;



                // Let's rewrite the update cleanly
                const finalPlayers = {
                    ...players,
                    [user.id]: {
                        username: user.username,
                        avatar: userSnap.data().avatar || null,
                        joinedAt: serverTimestamp(),
                        symbol: 'O',
                        roundWins: 0
                    }
                };
                // Let's randomize symbols too
                const symbols = Math.random() > 0.5 ? ['X', 'O'] : ['O', 'X'];
                finalPlayers[creatorId].symbol = symbols[0];
                finalPlayers[user.id].symbol = symbols[1];

                // Ensure creator also has roundWins init
                if (finalPlayers[creatorId]) {
                    finalPlayers[creatorId].roundWins = 0;
                }

                const firstId = Math.random() > 0.5 ? creatorId : user.id;

                transaction.update(gameRef, {
                    status: 'active',
                    pot: increment(game.wager),
                    players: finalPlayers,
                    currentTurn: firstId,
                    lastMoveAt: serverTimestamp(),
                    board: Array(9).fill(null)
                });

                // Notify Creator
                const notifRef = doc(collection(db, 'notifications'));
                transaction.set(notifRef, {
                    type: 'arena_accepted',
                    userId: creatorId,
                    title: 'Challenge Accepted!',
                    message: `${user.username} accepted your challenge! Game on!`,
                    link: `/arena/tictactoe/${gameId}`,
                    read: false,
                    createdAt: serverTimestamp()
                });
            });
        } catch (e) {
            console.error(e);
            alert("Join failed: " + e);
        }
    };

    const handleMove = async (index) => {
        if (!isMyTurn) return;
        if (game.board[index]) return; // Occupied

        const newBoard = [...game.board];
        newBoard[index] = playerSymbol;

        // Check Win
        let roundWinner = null;
        let isRoundDraw = false;

        const lines = [
            [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
            [0, 3, 6], [1, 4, 7], [2, 5, 8], // Cols
            [0, 4, 8], [2, 4, 6] // Diagonals
        ];

        for (let line of lines) {
            const [a, b, c] = line;
            if (newBoard[a] && newBoard[a] === newBoard[b] && newBoard[a] === newBoard[c]) {
                roundWinner = user.id;
            }
        }

        if (!roundWinner && !newBoard.includes(null)) {
            isRoundDraw = true;
        }

        try {
            await runTransaction(db, async (transaction) => {
                const gameDoc = await transaction.get(doc(db, 'arena_games', gameId));
                if (!gameDoc.exists()) throw "Game not found";

                const currentData = gameDoc.data();
                const players = currentData.players;
                const matchType = parseInt(currentData.config.matchType || '1');
                const targetWins = Math.ceil(matchType / 2);

                // If Round Over
                if (roundWinner || isRoundDraw) {

                    let newPlayers = { ...players };
                    let matchOver = false;
                    let finalWinner = null;

                    if (roundWinner) {
                        const currentWins = (newPlayers[roundWinner].roundWins || 0) + 1;
                        newPlayers[roundWinner] = {
                            ...newPlayers[roundWinner],
                            roundWins: currentWins
                        };

                        if (currentWins >= targetWins) {
                            matchOver = true;
                            finalWinner = roundWinner;
                        }
                    }

                    // If Match Completely Over
                    if (matchOver) {
                        const gameRef = doc(db, 'arena_games', gameId);
                        transaction.update(gameRef, {
                            board: newBoard, // Show final move
                            players: newPlayers,
                            status: 'completed',
                            winnerId: finalWinner,
                            result: 'win',
                            settledAt: serverTimestamp()
                        });

                        // Payout Winner
                        const winnerRef = doc(db, 'users', finalWinner);
                        transaction.update(winnerRef, {
                            balance: increment(currentData.pot),
                            lockedBalance: increment(-currentData.wager),
                            wins: increment(1)
                        });

                        // Handle Loser
                        const loserId = Object.keys(newPlayers).find(id => id !== finalWinner);
                        if (loserId) {
                            const loserRef = doc(db, 'users', loserId);
                            transaction.update(loserRef, {
                                lockedBalance: increment(-currentData.wager)
                            });

                            // Notify Loser
                            const notifRef = doc(collection(db, 'notifications'));
                            transaction.set(notifRef, {
                                type: 'arena_lost',
                                userId: loserId,
                                title: 'Duel Lost',
                                message: `You lost the ${matchType > 1 ? 'Best of ' + matchType : ''} Tic Tac Toe duel against ${user.username}.`,
                                link: `/arena/tictactoe/${gameId}`,
                                read: false,
                                createdAt: serverTimestamp()
                            });
                        }

                    } else if (isRoundDraw && matchType === 1) {
                        // Standard Draw for Bo1
                        const gameRef = doc(db, 'arena_games', gameId);
                        transaction.update(gameRef, {
                            board: newBoard,
                            status: 'completed',
                            result: 'draw',
                            settledAt: serverTimestamp()
                        });

                        // Refund
                        Object.keys(players).forEach(uid => {
                            const pRef = doc(db, 'users', uid);
                            transaction.update(pRef, {
                                balance: increment(currentData.wager),
                                lockedBalance: increment(-currentData.wager)
                            });
                        });

                    } else {
                        // NEXT ROUND (Bo3/Bo5 continuation or Draw in Multi-round)
                        // If it's a draw in Bo3, we just replay the round (no score change)
                        // If someone won round but not match, we continue.

                        const gameRef = doc(db, 'arena_games', gameId);

                        // Who starts next? The loser of this round, or if draw, swap from last starter.
                        // Simple logic: Swap from whoever just moved (which was 'user').
                        const nextPlayer = Object.keys(players).find(id => id !== user.id);

                        transaction.update(gameRef, {
                            board: Array(9).fill(null), // Reset Board
                            players: newPlayers,
                            currentTurn: nextPlayer,
                            lastMoveAt: serverTimestamp(),
                            round: increment(1)
                        });
                    }

                } else {
                    // Normal Move (Not Round Over)
                    const gameRef = doc(db, 'arena_games', gameId);
                    const nextPlayer = Object.keys(players).find(id => id !== user.id);
                    transaction.update(gameRef, {
                        board: newBoard,
                        currentTurn: nextPlayer,
                        lastMoveAt: serverTimestamp()
                    });

                    // Only notify on turn if needed, or maybe just UI updates
                }
            });
        } catch (e) {
            console.error(e);
            alert("Move failed");
        }
    };

    const handleClaimTimeout = async () => {
        if (timeLeft !== 'Expired') return;

        // Determine who timed out (currentTurn) and who wins (the other player)
        const loserId = game.currentTurn;
        const winnerId = Object.keys(game.players).find(id => id !== loserId);

        if (user.id !== winnerId) {
            return alert("Only the opponent can claim this timeout!");
        }

        try {
            await runTransaction(db, async (transaction) => {
                const gameRef = doc(db, 'arena_games', gameId);

                transaction.update(gameRef, {
                    status: 'completed',
                    winnerId: winnerId,
                    result: 'timeout',
                    settledAt: serverTimestamp()
                });

                // Payout Winner
                const winnerRef = doc(db, 'users', winnerId);
                transaction.update(winnerRef, {
                    balance: increment(game.pot),
                    lockedBalance: increment(-game.wager),
                    wins: increment(1)
                });

                // Loser
                if (loserId) {
                    const loserRef = doc(db, 'users', loserId);
                    transaction.update(loserRef, {
                        lockedBalance: increment(-game.wager)
                    });

                    // Notify Loser (Timeout)
                    const notifRef = doc(collection(db, 'notifications'));
                    transaction.set(notifRef, {
                        type: 'arena_lost',
                        userId: loserId,
                        title: 'Duel Timeout',
                        message: `You ran out of time! You lost the duel.`,
                        link: `/arena/tictactoe/${gameId}`,
                        read: false,
                        createdAt: serverTimestamp()
                    });
                }
            });
        } catch (e) {
            console.error(e);
            alert("Claim failed");
        }
    };

    // ...

    if (loading) return <div className="p-10 text-center text-white">Loading Arena Data...</div>;
    if (!game) return <div className="p-10 text-center text-white">Game not found</div>;

    // Correctly identify the winner for the button condition
    // The winner is the one who is NOT the current turn player
    const expectedWinnerId = game.players && game.currentTurn ? Object.keys(game.players).find(id => id !== game.currentTurn) : null;
    const canClaimTimeout = game.status === 'active' && timeLeft === 'Expired' && user?.id === expectedWinnerId;

    // Fix: We want to display Creator vs "The Other Player" (Challenger)
    // Previously we looked for "Not Me", which meant for the Challenger, "Not Me" was the Creator, causing duplicate display.
    const player2Id = Object.keys(game.players || {}).find(id => id !== game.creatorId);
    const player2 = player2Id ? game.players[player2Id] : null;

    // For Logic (e.g. "Your Opponent" in text), we might still want "Not Me", but for the VS visual, we want Player 2.
    const isCreator = user?.id === game.creatorId;

    return (
        <div style={{
            minHeight: '100vh',
            background: 'radial-gradient(circle at top center, #2e1065 0%, #000000 60%)',
            padding: '20px',
            color: '#fff',
            display: 'flex', flexDirection: 'column', alignItems: 'center'
        }}>
            {/* Header */}
            <div style={{ width: '100%', maxWidth: '600px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '40px' }}>
                <div style={{ display: 'flex', gap: '20px' }}>
                    <Link href="/arena" style={{ color: '#a1a1aa', display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}>
                        <ArrowLeft size={18} /> Back
                    </Link>
                    <button
                        onClick={() => setShowRules(true)}
                        style={{
                            background: 'rgba(255, 255, 255, 0.1)',
                            border: '1px solid rgba(255, 255, 255, 0.2)',
                            borderRadius: '20px',
                            color: '#fff',
                            cursor: 'pointer',
                            padding: '6px 12px',
                            display: 'flex', alignItems: 'center', gap: '6px',
                            fontSize: '12px', fontWeight: 'bold'
                        }}
                    >
                        <BookOpen size={14} /> RULES
                    </button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ec4899', fontWeight: 'bold' }}>
                    {game.config?.isPrivate ? (
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: '6px',
                            background: 'rgba(236, 72, 153, 0.1)',
                            border: '1px solid rgba(236, 72, 153, 0.2)',
                            padding: '6px 12px', borderRadius: '20px',
                            fontSize: '11px',
                            letterSpacing: '0.5px'
                        }}>
                            <Lock size={12} />
                            <span>PRIVATE DUEL</span>
                        </div>
                    ) : (
                        <>
                            <Swords size={20} /> <span style={{ fontSize: '14px' }}>ARENA DUEL</span>
                        </>
                    )}
                </div>
            </div>

            {/* Match Info Card */}
            <div style={{
                width: '100%', maxWidth: '500px',
                background: 'rgba(255,255,255,0.05)', borderRadius: '24px',
                border: '1px solid rgba(255,255,255,0.1)',
                padding: '24px', marginBottom: '40px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                boxShadow: '0 20px 50px -10px rgba(0,0,0,0.5)'
            }}>
                {/* Player 1 (Creator) */}
                <div style={{ textAlign: 'center' }}>
                    <div style={{
                        width: '64px', height: '64px', borderRadius: '50%',
                        background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                        margin: '0 auto 12px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        border: game.currentTurn === game.creatorId ? '3px solid #f59e0b' : '3px solid transparent',
                        boxShadow: game.currentTurn === game.creatorId ? '0 0 20px rgba(245, 158, 11, 0.5)' : 'none'
                    }}>
                        <span style={{ fontSize: '24px', fontWeight: 'bold' }}>{game.players[game.creatorId]?.symbol || '?'}</span>
                    </div>
                    <div style={{ fontWeight: 'bold', fontSize: '14px' }}>{game.creatorUsername}</div>
                    <div style={{ fontSize: '12px', color: '#71717a' }}>${game.wager}</div>
                </div>

                {/* VS / Status */}
                <div style={{ textAlign: 'center', flex: 1 }}>
                    {parseInt(game.config?.matchType || 1) > 1 ? (
                        <div style={{ marginBottom: '8px' }}>
                            <div style={{ fontSize: '10px', color: '#a1a1aa', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px' }}>
                                BEST OF {game.config.matchType}
                            </div>
                            <div style={{ fontSize: '32px', fontWeight: '900', color: '#fff', lineHeight: '1' }}>
                                {game.players[game.creatorId]?.roundWins || 0} - {player2?.roundWins || 0}
                            </div>
                        </div>
                    ) : (
                        <div style={{ fontSize: '32px', fontWeight: '900', fontStyle: 'italic', marginBottom: '8px', color: '#fff' }}>VS</div>
                    )}
                    <div style={{
                        display: 'inline-block', padding: '6px 16px', borderRadius: '20px',
                        background: 'rgba(236, 72, 153, 0.2)', color: '#ec4899', fontSize: '12px', fontWeight: 'bold'
                    }}>
                        POT: ${game.pot}
                    </div>
                    {game.status === 'active' && (
                        <div style={{ marginTop: '12px', fontSize: '12px', color: timeLeft === 'Expired' ? '#ef4444' : '#a1a1aa', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                            <Clock size={12} /> {timeLeft === 'Expired' ? 'TIME EXPIRED' : timeLeft} left
                        </div>
                    )}
                </div>

                {/* Player 2 (Challenger) */}
                <div style={{ textAlign: 'center' }}>
                    {player2 ? (
                        <>
                            <div style={{
                                width: '64px', height: '64px', borderRadius: '50%',
                                background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)',
                                margin: '0 auto 12px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                border: game.currentTurn === player2Id ? '3px solid #8b5cf6' : '3px solid transparent',
                                boxShadow: game.currentTurn === player2Id ? '0 0 20px rgba(139, 92, 246, 0.5)' : 'none',
                                overflow: 'hidden', position: 'relative'
                            }}>
                                {player2.avatar ? (
                                    <img
                                        src={player2.avatar}
                                        alt="P2"
                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                    />
                                ) : (
                                    <span style={{ fontSize: '24px', fontWeight: 'bold' }}>{player2.symbol || 'O'}</span>
                                )}
                            </div>
                            <div style={{ fontWeight: 'bold', fontSize: '14px' }}>{player2.username}</div>
                            <div style={{ fontSize: '12px', color: '#71717a' }}>${game.wager}</div>
                        </>
                    ) : (
                        <div style={{
                            width: '64px', height: '64px', borderRadius: '50%',
                            border: '2px dashed rgba(255,255,255,0.2)',
                            margin: '0 auto 12px', display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                            <User size={24} color="rgba(255,255,255,0.2)" />
                        </div>
                    )}
                </div>
            </div>

            {/* GAME COMPONENT (TIC TAC TOE) */}
            <div style={{ position: 'relative' }}>
                {game.status === 'cancelled' && (
                    <div style={{ textAlign: 'center', padding: '40px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '24px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                        <h3>Challenge Cancelled</h3>
                        <p style={{ color: '#fca5a5' }}>The creator has withdrawn this challenge.</p>
                    </div>
                )}

                {game.status === 'open' && (
                    <div style={{ textAlign: 'center', padding: '40px', background: '#18181b', borderRadius: '24px', border: '1px solid #333' }}>
                        {isCreator ? (
                            <>
                                <div className="loader" style={{ marginBottom: '20px' }}></div>
                                <h3>Waiting for opponent...</h3>
                                <p style={{ color: '#71717a', fontSize: '14px', marginBottom: '16px' }}>Share this link or wait for a match.</p>
                                <button
                                    onClick={handleCancelChallenge}
                                    style={{
                                        background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)',
                                        color: '#ef4444', padding: '8px 16px', borderRadius: '8px',
                                        fontWeight: 'bold', fontSize: '12px', cursor: 'pointer'
                                    }}
                                >
                                    CANCEL & REFUND
                                </button>
                            </>
                        ) : (
                            <>
                                {game.config?.isPrivate && game.config.opponentId !== user.id ? (
                                    <div style={{ padding: '20px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '12px' }}>
                                        <Lock size={48} className="text-red-500 mb-2" />
                                        <h3 style={{ color: '#ef4444' }}>Private Duel</h3>
                                        <p style={{ color: '#a1a1aa' }}>This challenge is reserved for a specific opponent.</p>
                                    </div>
                                ) : (
                                    <>
                                        <h3>Ready to Duel?</h3>
                                        <p style={{ color: '#a1a1aa', marginBottom: '20px' }}>
                                            Wager: <span style={{ color: '#10b981', fontWeight: 'bold' }}>${game.wager}</span>
                                        </p>
                                        <button
                                            onClick={handleJoinGame}
                                            style={{
                                                background: 'linear-gradient(90deg, #f59e0b, #ec4899)',
                                                border: 'none', color: '#fff', fontWeight: 'bold',
                                                padding: '16px 40px', borderRadius: '12px',
                                                fontSize: '16px', cursor: 'pointer',
                                                boxShadow: '0 4px 15px rgba(236, 72, 153, 0.4)'
                                            }}
                                        >
                                            ACCEPT CHALLENGE
                                        </button>
                                    </>
                                )}
                            </>
                        )}
                    </div>
                )}

                {(game.status === 'active' || game.status === 'completed') && (
                    <div style={{
                        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px',
                        background: '#18181b', padding: '10px', borderRadius: '16px',
                        border: '1px solid #333',
                        opacity: game.status === 'completed' ? 0.5 : 1
                    }}>
                        {Array(9).fill(null).map((_, i) => (
                            <button
                                key={i}
                                disabled={game.status !== 'active' || !!game.board[i]}
                                onClick={() => handleMove(i)}
                                style={{
                                    width: '80px', height: '80px',
                                    background: '#27272a', borderRadius: '12px',
                                    border: 'none',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: '40px', fontWeight: 'bold',
                                    color: game.board[i] === 'X' ? '#f59e0b' : '#8b5cf6',
                                    cursor: (isMyTurn && !game.board[i]) ? 'pointer' : 'default',
                                    transition: 'background 0.2s'
                                }}
                                onMouseEnter={e => {
                                    if (isMyTurn && !game.board[i]) e.currentTarget.style.background = '#3f3f46';
                                }}
                                onMouseLeave={e => {
                                    e.currentTarget.style.background = '#27272a';
                                }}
                            >
                                {game.board[i]}
                            </button>
                        ))}
                    </div>
                )}

                {/* GAME OVER OVERLAY */}
                {game.status === 'completed' && (
                    <div style={{
                        position: 'absolute', inset: -20,
                        background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(5px)',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        borderRadius: '24px', zIndex: 10
                    }}>
                        <Trophy size={48} color="#fbbf24" style={{ marginBottom: '16px' }} />
                        <h2 style={{ fontSize: '32px', fontWeight: 'bold', marginBottom: '8px' }}>
                            {game.result === 'draw' ? 'DRAW!' : (game.winnerId === user?.id ? 'VICTORY!' : 'DEFEAT')}
                        </h2>
                        {game.result === 'draw' ? (
                            <p style={{ color: '#f59e0b', fontSize: '18px', fontWeight: 'bold' }}>Refunding Wagers</p>
                        ) : (
                            game.winnerId === user?.id ? (
                                <p style={{ color: '#10b981', fontSize: '24px', fontWeight: 'bold' }}>
                                    +${game.pot?.toFixed(2)}
                                </p>
                            ) : (
                                <p style={{ color: '#ef4444', fontSize: '24px', fontWeight: 'bold' }}>
                                    -${game.wager?.toFixed(2)}
                                </p>
                            )
                        )}
                        <Link href="/arena">
                            <button style={{
                                marginTop: '24px',
                                background: '#3f3f46', color: '#fff',
                                border: 'none', padding: '12px 24px', borderRadius: '50px',
                                fontWeight: 'bold', cursor: 'pointer'
                            }}>
                                Return to Arena
                            </button>
                        </Link>
                    </div>
                )}
            </div>

            {/* TIMEOUT CLAIM BUTTON */}
            {
                canClaimTimeout && (
                    <div style={{ marginTop: '20px' }}>
                        <button
                            onClick={handleClaimTimeout}
                            style={{
                                background: '#ef4444', color: '#fff', border: 'none',
                                padding: '12px 24px', borderRadius: '12px',
                                fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer'
                            }}
                        >
                            <AlertTriangle size={18} /> CLAIM VICTORY (TIMEOUT)
                        </button>
                    </div>
                )
            }

            {/* Turn Indicator */}
            {
                game.status === 'active' && (
                    <div style={{ marginTop: '24px', textAlign: 'center', color: '#a1a1aa' }}>
                        {isMyTurn ? (
                            <span style={{ color: '#ec4899', fontWeight: 'bold', fontSize: '18px' }}>YOUR TURN</span>
                        ) : (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                                Waiting for <span style={{ color: '#fff', fontWeight: 'bold' }}>{game.players[game.currentTurn]?.username}</span>...
                            </span>
                        )}
                    </div>
                )
            }

            {/* RULES MODAL */}
            {
                showRules && (
                    <div style={{
                        position: 'fixed', inset: 0, zIndex: 10005,
                        background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(5px)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        padding: '20px'
                    }} onClick={() => setShowRules(false)}>
                        <div style={{
                            background: '#18181b', border: '1px solid #3f3f46', borderRadius: '24px',
                            padding: '32px', maxWidth: '500px', width: '100%', position: 'relative',
                            maxHeight: '90vh', overflowY: 'auto'
                        }} onClick={e => e.stopPropagation()}>
                            <button
                                onClick={() => setShowRules(false)}
                                style={{
                                    position: 'absolute', top: '20px', right: '20px',
                                    background: 'transparent', border: 'none', color: '#a1a1aa', cursor: 'pointer'
                                }}
                            >
                                <X size={24} />
                            </button>

                            <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <BookOpen size={24} className="text-primary" /> Tic Tac Toe Rules
                            </h2>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', color: '#d4d4d8', lineHeight: '1.6' }}>
                                <div>
                                    <strong style={{ color: '#fff', display: 'block', marginBottom: '4px' }}>Objective</strong>
                                    Be the first to get 3 of your symbols in a row (horizontal, vertical, or diagonal).
                                </div>
                                <div>
                                    <strong style={{ color: '#fff', display: 'block', marginBottom: '4px' }}>Gameplay</strong>
                                    Players take turns placing their symbol (X or O) on the 3x3 grid. The player who creates the challenge sets the wager.
                                </div>
                                <div>
                                    <strong style={{ color: '#fff', display: 'block', marginBottom: '4px' }}>Winning</strong>
                                    Access the full pot by winning the game. The loser forfeits their wager.
                                </div>
                                <div>
                                    <strong style={{ color: '#fff', display: 'block', marginBottom: '4px' }}>Draw</strong>
                                    If all 9 squares are filled and no player has 3 in a row, the game is a draw. Both players' wagers are refunded.
                                </div>
                                <div>
                                    <strong style={{ color: '#fff', display: 'block', marginBottom: '4px' }}>Time Limit</strong>
                                    Each player must make their move within the game's time limit (default 24h). If time expires, the opponent can claim victory.
                                </div>
                            </div>

                            <button
                                onClick={() => setShowRules(false)}
                                style={{
                                    width: '100%', marginTop: '32px', padding: '12px',
                                    background: '#3f3f46', color: '#fff', border: 'none', borderRadius: '12px',
                                    fontWeight: 'bold', cursor: 'pointer'
                                }}
                            >
                                Got it
                            </button>
                        </div>
                    </div>
                )
            }
        </div >
    );
}
