"use client";
import { useState, useEffect } from 'react';
import { useApp } from '../../../../lib/store';
import { doc, onSnapshot, updateDoc, runTransaction, serverTimestamp, increment, collection } from 'firebase/firestore';
import { Swords, Clock, User, Trophy, Play, Users, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import KnockoutBoard from '../KnockoutBoard';
import { calculateRoundOutcome, PHYSICS_CONFIG } from '../physics';

export default function KnockoutGamePage({ params }) {
    const { db, user } = useApp();
    const { gameId } = params;

    // Unified State Object
    const [state, setState] = useState({
        game: null,
        playbackFrames: null,
        loading: true
    });

    const { game, playbackFrames, loading } = state;

    // Hide Bottom Nav on mount
    useEffect(() => {
        const nav = document.querySelector('.bottom-nav');
        if (nav) nav.style.display = 'none';
        return () => {
            if (nav) nav.style.display = '';
        };
    }, []);

    // --- INIT ---

    useEffect(() => {
        if (!gameId) return;
        const unsub = onSnapshot(doc(db, 'arena_games', gameId), (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                const newGame = { id: docSnap.id, ...data };

                setState(current => {
                    const currentGame = current.game;
                    let frames = null;

                    // Condition 1: Witnessing a new round
                    const isNewRound = currentGame && currentGame.id === newGame.id && data.round > currentGame.round && data.lastRoundFrames;

                    // Condition 2: Initial Load Replay (User enters mid-game or refreshes)
                    const isInitialLoad = current.loading && data.lastRoundFrames;

                    if (isNewRound || isInitialLoad) {
                        try {
                            frames = JSON.parse(data.lastRoundFrames);
                        } catch (e) {
                            console.error("Failed to parse playback frames", e);
                        }
                    }

                    return {
                        game: newGame,
                        playbackFrames: frames || current.playbackFrames,
                        loading: false
                    };
                });
            } else {
                setState(prev => ({ ...prev, loading: false }));
            }
        });
        return () => unsub();
    }, [db, gameId]);

    // Derived State
    const isOwner = user?.id === game?.creatorId;
    const isPlayer = user && game?.players?.[user.id];
    const playerArray = game ? Object.entries(game.players).map(([id, p]) => ({ id, ...p })) : [];
    const activePlayerCount = playerArray.filter(p => !p.isEliminated).length;
    const isGameFull = playerArray.length >= (game?.config?.playerLimit || 6);

    // --- ACTIONS ---

    const handleJoin = async () => {
        if (!user) return alert("Login required");
        if (user.balance < game.wager) return alert("Insufficient funds");
        if (isGameFull) return alert("Game is full");

        try {
            await runTransaction(db, async (t) => {
                const ref = doc(db, 'arena_games', gameId);
                const s = await t.get(ref);
                const g = s.data();

                if (g.status !== 'open') throw "Game already started";
                if (Object.keys(g.players || {}).length >= (g.config.playerLimit || 6)) throw "Full";

                const uRef = doc(db, 'users', user.id);
                const uSnap = await t.get(uRef);
                if (uSnap.data().balance < g.wager) throw "Insufficient funds";

                // Deduct
                t.update(uRef, {
                    balance: increment(-g.wager),
                    lockedBalance: increment(g.wager)
                });

                // Add Player
                const players = g.players || {};
                players[user.id] = {
                    username: user.username,
                    avatar: uSnap.data().avatar || null,
                    joinedAt: new Date().toISOString()
                };

                t.update(ref, {
                    players: players,
                    pot: increment(g.wager)
                });
            });
        } catch (e) {
            console.error(e);
            alert(e);
        }
    };

    const handleStartGame = async () => {
        if (!isOwner) return;
        // Allow Admins to force start with < 3 players for testing
        if (playerArray.length < 3 && user?.role !== 'admin') return alert("Need at least 3 players!");

        try {
            await updateDoc(doc(db, 'arena_games', gameId), {
                status: 'active',
                round: 1,
                platformRadius: PHYSICS_CONFIG.PLATFORM_INITIAL_RADIUS,
                startedAt: serverTimestamp(),
                // Initialize physics state
                physicsState: {} // Will be populated by physics engine on first move or client-side init? 
                // Actually, let's just let the board/physics engine handle defaults for undefined positions.
            });
        } catch (e) {
            alert(e);
        }
    };

    const handleCancelGame = async () => {
        if (!isOwner) return;
        if (!confirm("Are you sure you want to cancel? All wagers will be refunded.")) return;

        try {
            await runTransaction(db, async (t) => {
                const ref = doc(db, 'arena_games', gameId);
                const s = await t.get(ref);
                const g = s.data();

                if (g.status !== 'open') throw "Game not open";

                // Refund all players
                const pIds = Object.keys(g.players || {});
                for (const pid of pIds) {
                    const userRef = doc(db, 'users', pid);
                    t.update(userRef, {
                        balance: increment(g.wager),
                        lockedBalance: increment(-g.wager)
                    });
                }

                // Update Game Status
                t.update(ref, {
                    status: 'cancelled',
                    cancelledAt: serverTimestamp()
                });
            });
            // Redirect happens automatically if we listen or user clicks back, but status change handles UI
        } catch (e) {
            console.error(e);
            alert("Cancel failed: " + e);
        }
    };

    const handleCommitMove = async (move) => {
        if (!isPlayer) return;
        if (game.status !== 'active') return;

        try {
            // Optimistically checking if all players have moved is hard without a transaction,
            // but we can just submit our move.
            // But wait! We need to know if we are the LAST one.

            await runTransaction(db, async (t) => {
                const ref = doc(db, 'arena_games', gameId);
                const s = await t.get(ref);
                const g = s.data();

                if (g.status !== 'active') throw "Game not active";

                // Update My Move
                const currentMoves = g.currentMoves || {};
                currentMoves[user.id] = move;

                // Check if all active players have moved
                const activeIds = Object.keys(g.players).filter(pid => !g.players[pid].isEliminated).sort();
                const allMoved = activeIds.every(pid => currentMoves[pid]);

                if (allMoved) {
                    // RESOLVE ROUND (I am the authority for this round)
                    console.log("All moves in! Resolving physics...");

                    const { finalState, frames, events } = calculateRoundOutcome(
                        g.physicsState || {},
                        currentMoves,
                        g.platformRadius || PHYSICS_CONFIG.PLATFORM_INITIAL_RADIUS,
                        activeIds
                    );

                    // Shrink Platform
                    const newRadius = (g.platformRadius || PHYSICS_CONFIG.PLATFORM_INITIAL_RADIUS) * 0.9;

                    // Check Eliminations (Update Player Status)
                    const updatedPlayers = { ...g.players };
                    // We need to merge elimination status from physics state to player object
                    // Actually, physics state tracks `isEliminated`.
                    // But we also want it on the player object for easy UI access
                    let activeCount = 0;
                    let lastSurvivor = null;

                    Object.keys(finalState).forEach(pid => {
                        if (finalState[pid].isEliminated) {
                            if (!updatedPlayers[pid].isEliminated) {
                                // Just got eliminated
                                updatedPlayers[pid].isEliminated = true;
                                updatedPlayers[pid].eliminatedRound = g.round;
                            }
                        } else {
                            activeCount++;
                            lastSurvivor = pid;
                        }
                    });

                    // Check Win Condition
                    let isGameOver = false;
                    let winnerId = null;

                    if (activeCount <= 1) {
                        isGameOver = true;
                        winnerId = activeCount === 1 ? lastSurvivor : null; // If 0 (draw), null
                    }

                    // Update Doc
                    const updateData = {
                        currentMoves: {}, // Validated reset
                        physicsState: finalState, // Save new positions
                        players: updatedPlayers,
                        platformRadius: newRadius,
                        round: increment(1),
                        lastRoundFrames: JSON.stringify(frames) // Save animation
                    };

                    if (isGameOver) {
                        updateData.status = 'completed';
                        updateData.winnerId = winnerId;
                        updateData.endedAt = serverTimestamp();

                        // Handle Payouts (Trigger logic here or via cloud function? Let's do here for sim)
                        // ... Payout logic similar to TicTacToe ...
                        // NOTE: Simple version: Winner takes all. Draw = Split?
                    }

                    t.update(ref, updateData);

                    // If game over, handle payout
                    if (isGameOver && winnerId) {
                        const wRef = doc(db, 'users', winnerId);
                        t.update(wRef, {
                            balance: increment(g.pot),
                            lockedBalance: increment(-g.wager),
                            wins: increment(1)
                        });
                        // Handle losers locked balance clearing
                        // Iterate all other players
                        Object.keys(g.players).forEach(pid => {
                            if (pid !== winnerId) {
                                const lRef = doc(db, 'users', pid);
                                t.update(lRef, { lockedBalance: increment(-g.wager) });
                            }
                        });
                    } else if (isGameOver && !winnerId) {
                        // DRAW (Everyone fell off same turn)
                        // Split pot? Or Refund? 
                        // Let's Refund.
                        const share = g.pot / activeIds.length; // Split logic complex if multiple eliminated same turn.
                        // Simplest: Refund everyone their wager.
                        Object.keys(g.players).forEach(pid => {
                            const pRef = doc(db, 'users', pid);
                            t.update(pRef, {
                                balance: increment(g.wager),
                                lockedBalance: increment(-g.wager)
                            });
                        });
                    }

                } else {
                    // Just save my move
                    t.update(ref, {
                        [`currentMoves.${user.id}`]: move
                    });
                }
            });
        } catch (e) {
            console.error(e);
            alert("Move failed: " + e);
        }
    };


    const handleReplay = () => {
        if (game?.lastRoundFrames) {
            try {
                const frames = JSON.parse(game.lastRoundFrames);
                setState(prev => ({ ...prev, playbackFrames: frames }));
            } catch (e) {
                console.error("Failed to parse replay:", e);
                alert("Replay data unavailable.");
            }
        } else {
            alert("No replay available.");
        }
    };

    // --- RENDER ---

    if (loading) return <div className="p-20 text-center text-white">Loading Arena...</div>;
    if (!game) return <div className="p-20 text-center text-white">Game not found</div>;

    const gamePlayers = Object.entries(game.players || {});

    return (
        <div style={{
            minHeight: '100vh',
            background: 'radial-gradient(circle at center, #1e1b4b 0%, #000000 100%)',
            padding: '20px',
            color: '#fff',
            display: 'flex', flexDirection: 'column', alignItems: 'center'
        }}>

            {/* Header */}
            <div style={{ width: '100%', maxWidth: '800px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                <Link href="/arena" style={{ color: '#a1a1aa', display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}>
                    <ArrowLeft size={18} /> Back
                </Link>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold' }}>
                    <span style={{ fontSize: '24px' }}>🥊</span> KNOCKOUT
                </div>
            </div>

            {/* Game / Lobby Container */}
            <div style={{ width: '100%', maxWidth: '800px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

                {/* LOBBY VIEW */}
                {game.status === 'open' && (
                    <div className="animate-fade-in" style={{
                        background: '#18181b', borderRadius: '24px', padding: '40px',
                        border: '1px solid #333', textAlign: 'center'
                    }}>
                        <h2 style={{ fontSize: '32px', marginBottom: '10px' }}>Wager: <span style={{ color: '#10b981' }}>${game.wager}</span></h2>
                        <p style={{ color: '#a1a1aa', marginBottom: '30px' }}>
                            Waiting for players... ({playerArray.length} / {game.config?.playerLimit || 6})
                        </p>

                        <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', flexWrap: 'wrap', marginBottom: '40px' }}>
                            {playerArray.map((p, i) => (
                                <div key={p.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                                    <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: '#3f3f46', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                                        {p.avatar ? <img src={p.avatar} style={{ width: '100%', height: '100%' }} /> : <User />}
                                    </div>
                                    <span style={{ fontWeight: 'bold' }}>{p.username}</span>
                                </div>
                            ))}
                            {/* Placeholders */}
                            {Array.from({ length: (game.config?.playerLimit || 6) - playerArray.length }).map((_, i) => (
                                <div key={i} style={{ width: '64px', height: '64px', borderRadius: '50%', border: '2px dashed #333', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <span style={{ opacity: 0.2, fontSize: '24px' }}>?</span>
                                </div>
                            ))}
                        </div>

                        {!isPlayer ? (
                            <button onClick={handleJoin} className="btn-primary" style={{ padding: '16px 40px', fontSize: '18px', borderRadius: '12px', background: 'linear-gradient(90deg, #10b981, #3b82f6)', border: 'none', color: '#fff', fontWeight: 'bold' }}>
                                JOIN FIGHT (${game.wager})
                            </button>
                        ) : (
                            isOwner ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center' }}>
                                    <button
                                        onClick={handleStartGame}
                                        disabled={playerArray.length < 3 && user?.role !== 'admin'}
                                        style={{
                                            padding: '16px 40px', fontSize: '18px', borderRadius: '12px',
                                            background: (playerArray.length >= 3 || user?.role === 'admin') ? 'linear-gradient(90deg, #f59e0b, #ec4899)' : '#333',
                                            border: 'none', color: '#fff', fontWeight: 'bold',
                                            cursor: (playerArray.length >= 3 || user?.role === 'admin') ? 'pointer' : 'not-allowed',
                                            opacity: (playerArray.length >= 3 || user?.role === 'admin') ? 1 : 0.5,
                                            width: '100%', maxWidth: '300px'
                                        }}
                                    >
                                        {(playerArray.length < 3 && user?.role !== 'admin') ? 'NEED 3 PLAYERS' : 'START RUMBLE'}
                                        {user?.role === 'admin' && playerArray.length < 3 && <span style={{ display: 'block', fontSize: '10px' }}> (Admin Override)</span>}
                                    </button>

                                    <button
                                        onClick={handleCancelGame}
                                        style={{
                                            background: 'transparent', border: '1px solid #ef4444', color: '#ef4444',
                                            padding: '8px 16px', borderRadius: '8px', cursor: 'pointer',
                                            fontSize: '12px', fontWeight: 'bold'
                                        }}
                                    >
                                        CANCEL & REFUND
                                    </button>
                                </div>
                            ) : (
                                <div style={{ color: '#ec4899', fontWeight: 'bold' }}>Waiting for host to start...</div>
                            )
                        )}
                    </div>
                )}

                {/* CANCELLED VIEW */}
                {game.status === 'cancelled' && (
                    <div style={{ textAlign: 'center', padding: '40px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '24px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                        <h3 style={{ color: '#ef4444', marginBottom: '8px' }}>Fight Cancelled</h3>
                        <p style={{ color: '#fca5a5' }}>The host has called off the rumble. Wagers refunded.</p>
                        <Link href="/arena">
                            <button style={{ marginTop: '20px', background: '#3f3f46', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer' }}>
                                Back to Arena
                            </button>
                        </Link>
                    </div>
                )}

                {/* ACTIVE GAME VIEW */}
                {(game.status === 'active' || game.status === 'completed') && (
                    <>
                        {/* Status Bar */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 10px', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ color: '#a1a1aa', fontSize: '14px', fontWeight: 'bold' }}>ROUND {game.round}</div>
                                {game.lastRoundFrames && !playbackFrames && (
                                    <button
                                        onClick={handleReplay}
                                        style={{
                                            background: '#3f3f46', color: '#fff', border: 'none',
                                            padding: '4px 8px', borderRadius: '6px', fontSize: '10px',
                                            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px'
                                        }}
                                    >
                                        <Play size={10} /> REPLAY PREVIOUS
                                    </button>
                                )}
                            </div>
                            <div style={{ color: '#10b981', fontSize: '14px', fontWeight: 'bold' }}>POT: ${game.pot}</div>
                        </div>

                        {/* GAME BOARD */}
                        <div style={{
                            position: 'relative',
                            background: '#000', borderRadius: '24px',
                            overflow: 'hidden', boxShadow: '0 0 50px rgba(0,0,0,0.5)'
                        }}>
                            <KnockoutBoard
                                players={game.players}
                                myId={user?.id}
                                gameState={game.physicsState || {}}
                                activeMoves={game.currentMoves || {}}
                                onCommitMove={handleCommitMove}
                                isSpectator={!isPlayer || game.players[user.id]?.isEliminated || game.status === 'completed'}
                                platformRadius={game.platformRadius}
                                playbackFrames={playbackFrames}
                                onAnimationComplete={() => setState(prev => ({ ...prev, playbackFrames: null }))}
                            />

                            {/* Eliminated Overlay for Player */}
                            {isPlayer && game.players[user.id]?.isEliminated && game.status === 'active' && (
                                <div style={{ position: 'absolute', top: '10px', left: '50%', transform: 'translateX(-50%)', background: 'rgba(239, 68, 68, 0.9)', color: '#fff', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold' }}>
                                    ELIMINATED - SPECTATING
                                </div>
                            )}
                        </div>

                        {/* Player List / Ledger */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '10px' }}>
                            {playerArray.map((p, i) => {
                                const hasMoved = game.currentMoves?.[p.id];
                                return (
                                    <div key={p.id} style={{
                                        background: '#18181b', padding: '10px', borderRadius: '12px',
                                        border: p.isEliminated ? '1px solid #3f3f46' : '1px solid #52525b',
                                        opacity: p.isEliminated ? 0.5 : 1,
                                        display: 'flex', alignItems: 'center', gap: '8px'
                                    }}>
                                        <div style={{
                                            width: '10px', height: '10px', borderRadius: '50%',
                                            background: hasMoved ? '#10b981' : (p.isEliminated ? '#ef4444' : '#fbbf24')
                                        }}></div>
                                        <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                                            <span style={{ fontSize: '12px', fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {p.username}
                                            </span>
                                            <span style={{ fontSize: '10px', color: '#a1a1aa' }}>
                                                {p.isEliminated ? 'ELIMINATED' : (hasMoved ? 'READY' : 'WAITING')}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </>
                )}

                {/* GAME OVER CARD */}
                {game.status === 'completed' && (
                    <div className="animate-scale-in" style={{
                        marginTop: '20px', background: 'linear-gradient(135deg, #f59e0b, #b45309)',
                        padding: '30px', borderRadius: '24px', textAlign: 'center', color: '#fff'
                    }}>
                        <Trophy size={48} style={{ marginBottom: '10px' }} />
                        <h2 style={{ fontSize: '32px', fontWeight: '900', marginBottom: '8px' }}>
                            {game.winnerId ? game.players[game.winnerId].username : 'DRAW'} WINS!
                        </h2>

                        {/* Personal Result */}
                        <div style={{ margin: '20px 0', padding: '15px', background: 'rgba(0,0,0,0.2)', borderRadius: '12px' }}>
                            {game.winnerId === user?.id ? (
                                <>
                                    <div style={{ fontSize: '14px', opacity: 0.8 }}>YOU WON</div>
                                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#10b981' }}>+${game.pot - game.wager}</div>
                                    <div style={{ fontSize: '10px', opacity: 0.6 }}>Total Payout: ${game.pot}</div>
                                </>
                            ) : (
                                <>
                                    <div style={{ fontSize: '14px', opacity: 0.8 }}>YOU LOST</div>
                                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#ef4444' }}>-${game.wager}</div>
                                </>
                            )}
                            {!game.winnerId && (
                                <div style={{ fontSize: '14px', opacity: 0.8 }}>WAGER REFUNDED</div>
                            )}
                        </div>

                        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                            <button
                                onClick={handleReplay}
                                style={{
                                    marginTop: '10px', background: 'rgba(255,255,255,0.2)',
                                    border: 'none', padding: '12px 24px',
                                    borderRadius: '50px', color: '#fff', cursor: 'pointer', fontWeight: 'bold',
                                    display: 'flex', alignItems: 'center', gap: '8px'
                                }}
                            >
                                <Play size={16} /> REPLAY FINAL ROUND
                            </button>

                            <Link href="/arena">
                                <button style={{
                                    marginTop: '10px', background: '#fff',
                                    border: 'none', padding: '12px 24px',
                                    borderRadius: '50px', color: '#b45309', cursor: 'pointer', fontWeight: 'bold'
                                }}>
                                    Back to Arena
                                </button>
                            </Link>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
