"use client";
import Link from 'next/link';
import { Swords, ArrowRight, X, User, Users, Lock, Clock, Trophy, Plus, Calendar, Search, DollarSign } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useApp } from '../../lib/store';
import { collection, query, where, getDocs, limit, orderBy, onSnapshot, addDoc, doc, runTransaction, serverTimestamp, deleteDoc } from 'firebase/firestore';

export default function ArenaPage() {
    const { db, user, arenaSettings } = useApp();
    const [tourStep, setTourStep] = useState(-1); // -1: inactive, 0: welcome, 1+: steps
    const [spotlightStyle, setSpotlightStyle] = useState({ top: 0, left: 0, width: 0, height: 0, opacity: 0 });
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [activeGames, setActiveGames] = useState([]);
    const [completedGames, setCompletedGames] = useState([]);

    // Search State
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [showResults, setShowResults] = useState(false);

    // Form State
    const [duelConfig, setDuelConfig] = useState({
        game: '', // Placeholder
        isPrivate: false,
        opponent: '',
        expiry: '24', // hours
        turnTimer: '24', // hours
        matchType: '1', // Best of 1, 3, 5
        wager: '0'
    });

    useEffect(() => {
        // Check if user is new strictly to Arena
        const visited = localStorage.getItem('arena_visited_v1');
        if (!visited) {
            // Small delay to let animations settle
            setTimeout(() => setTourStep(0), 500);
        }
    }, []);

    const endTour = () => {
        setTourStep(-1);
        localStorage.setItem('arena_visited_v1', 'true');
    };

    const nextStep = () => {
        setTourStep(prev => prev + 1);
    };

    // Calculate spotlight position based on step
    useEffect(() => {
        if (tourStep <= 0) {
            setSpotlightStyle(prev => ({ ...prev, opacity: 0 }));
            return;
        }

        const targets = {
            1: 'arena-header',
        };

        const targetId = targets[tourStep];
        if (!targetId && tourStep > 1) { // Adjusted for fewer steps
            endTour();
            return;
        }

        const el = document.getElementById(targetId);
        if (el) {
            const rect = el.getBoundingClientRect();
            // Account for scroll
            const scrollTop = window.scrollY || document.documentElement.scrollTop;
            const scrollLeft = window.scrollX || document.documentElement.scrollLeft;

            // Check if there is space below
            const spaceBelow = window.innerHeight - rect.bottom;
            const placeTop = spaceBelow < 250;

            setSpotlightStyle({
                top: rect.top + scrollTop - 10,
                left: rect.left + scrollLeft - 10,
                width: rect.width + 20,
                height: rect.height + 20,
                opacity: 1,
                borderRadius: '16px',
                placement: placeTop ? 'top' : 'bottom'
            });

            // Scroll to element if needed
            el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
        }
    }, [tourStep]);

    // Lock scroll and hide navbar when tour is active
    useEffect(() => {
        const navbar = document.querySelector('.bottom-nav');
        if (tourStep >= 0 || isCreateModalOpen) {
            document.body.style.overflow = 'hidden';
            if (navbar) navbar.style.display = 'none';
        } else {
            document.body.style.overflow = '';
            if (navbar) navbar.style.display = '';
        }

        return () => {
            document.body.style.overflow = '';
            if (navbar) navbar.style.display = '';
        };
    }, [tourStep, isCreateModalOpen]);

    // Games list cleared as requested, waiting for user instruction to add one
    const games = [];

    // Search Users Debounce
    useEffect(() => {
        const searchUsers = async () => {
            if (!duelConfig.isPrivate || !duelConfig.opponent || duelConfig.opponent.length < 2) {
                // If we have a selected user, don't clear results/search
                if (duelConfig.selectedUser) return;
                setSearchResults([]);
                return;
            }

            // If a user is already selected, don't search
            if (duelConfig.selectedUser) return;

            setIsSearching(true);
            try {
                const term = duelConfig.opponent.trim();
                const lowerTerm = term.toLowerCase();
                const capTerm = lowerTerm.charAt(0).toUpperCase() + lowerTerm.slice(1);

                // We'll run parallel queries to find matches for "bob" (lower), "Bob" (cap), and as-typed (if different)
                const queries = [];
                const terms = new Set([term, lowerTerm, capTerm]);

                terms.forEach(t => {
                    queries.push(query(
                        collection(db, 'users'),
                        where('username', '>=', t),
                        where('username', '<=', t + '\uf8ff'),
                        limit(5)
                    ));
                });

                const snapshots = await Promise.all(queries.map(q => getDocs(q)));

                const resultsMap = new Map();
                snapshots.forEach(snap => {
                    snap.docs.forEach(doc => {
                        // Avoid adding yourself
                        if (doc.id === user?.id) return;
                        resultsMap.set(doc.id, { id: doc.id, ...doc.data() });
                    });
                });

                setSearchResults(Array.from(resultsMap.values()).slice(0, 5));
                setShowResults(true);
            } catch (error) {
                console.error("Error searching users:", error);
            } finally {
                setIsSearching(false);
            }
        };

        const timeoutId = setTimeout(searchUsers, 300);
        return () => clearTimeout(timeoutId);
    }, [duelConfig.opponent, duelConfig.isPrivate, duelConfig.selectedUser, db, user?.id]);

    const selectOpponent = (selectedUser) => {
        setDuelConfig(prev => ({
            ...prev,
            opponent: selectedUser.username,
            selectedUser: selectedUser
        }));
        setShowResults(false);
        setSearchResults([]);
    };

    const clearSelectedOpponent = () => {
        setDuelConfig(prev => ({
            ...prev,
            opponent: '',
            selectedUser: null
        }));
    };


    // Listen for active games
    useEffect(() => {
        const q = query(
            collection(db, 'arena_games'),
            where('status', 'in', ['open', 'active'])
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            let gamesList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            // Filter Private Games
            if (user) {
                gamesList = gamesList.filter(g => {
                    if (!g.config?.isPrivate) return true; // Public
                    if (g.creatorId === user.id) return true; // My game
                    if (g.config.opponent === user.username) return true; // Invited
                    // Also check if I'm already a player (e.g. joined private game)
                    if (g.players && g.players[user.id]) return true;
                    return false;
                });
            } else {
                // Not logged in, only see public
                gamesList = gamesList.filter(g => !g.config?.isPrivate);
            }

            // Client-side sort to avoid index requirement
            gamesList.sort((a, b) => {
                const timeA = a.createdAt?.toMillis?.() || 0;
                const timeB = b.createdAt?.toMillis?.() || 0;
                return timeB - timeA;
            });
            setActiveGames(gamesList);
        });

        return () => unsubscribe();
    }, [db, user]);

    // Listen for COMPLETED games separately
    useEffect(() => {
        // Query for last 20 completed games
        // Note: Ideally needs an index on 'settledAt' for perfect sorting, but we can do basic query + client sort for now if index missing
        const q = query(
            collection(db, 'arena_games'),
            where('status', '==', 'completed'),
            limit(20)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            let gamesList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            // Client-side sort
            gamesList.sort((a, b) => {
                const timeA = a.settledAt?.toMillis?.() || 0;
                const timeB = b.settledAt?.toMillis?.() || 0;
                return timeB - timeA;
            });
            setCompletedGames(gamesList);
        });

        return () => unsubscribe();
    }, [db]);

    const handleJoinGame = async (gameId, wager) => {
        console.log("Handle join triggered for", gameId);

        if (!user) {
            alert('You must be logged in to join a duel.');
            return;
        }

        if (user.balance < wager) {
            alert('Insufficient funds to join this duel.');
            return;
        }

        try {
            console.log("Running transaction...");
            await runTransaction(db, async (transaction) => {
                const gameRef = doc(db, 'arena_games', gameId);
                const userRef = doc(db, 'users', user.id);

                const gameSnap = await transaction.get(gameRef);
                const userSnap = await transaction.get(userRef);

                if (!gameSnap.exists()) throw "Game does not exist!";
                const gameData = gameSnap.data();

                if (gameData.status !== 'waiting') throw "Game is no longer available.";
                if (gameData.players && gameData.players[user.id]) throw "You are already in this game.";

                const userData = userSnap.data();
                if (userData.balance < wager) throw "Insufficient funds.";

                // Calculate fees
                // 5% fee on the pot (2.5% per player effectively)
                // Actually standard is: Each puts in X. Pot becomes 2X. Winner takes 2X * 0.95.
                // Or: Each puts in X. Pot becomes 2X. Winner takes (2X - fee).
                // Let's stick to: Pot = Wager * 2. Winner gets Pot - 5%.
                // Wait, logic in store/game creation might differ.
                // Ideally: Pot = Wager * 2.
                // When game ends, we take fee.

                // Update Game
                const players = gameData.players || {};
                players[user.id] = { username: user.username, profilePic: user.profilePic || null, joinedAt: new Date().toISOString() };

                // Randomize first turn
                const pIds = Object.keys(players);
                const firstTurn = pIds[Math.floor(Math.random() * pIds.length)];

                transaction.update(gameRef, {
                    status: 'active',
                    players: players,
                    currentTurn: firstTurn,
                    startedAt: serverTimestamp(),
                    roundWins: { [pIds[0]]: 0, [pIds[1]]: 0 }, // Initialize round wins for Best of X
                    currentRound: 1,
                    board: Array(9).fill(null), // Reset board for start
                    pot: gameData.wager * 2
                });

                // Deduct Balance
                transaction.update(userRef, {
                    balance: userData.balance - wager,
                    invested: (userData.invested || 0) + wager
                });

                // Create Transaction Record
                const transRef = doc(collection(db, 'transactions'));
                transaction.set(transRef, {
                    userId: user.id,
                    type: 'duel_join',
                    amount: -wager,
                    gameId: gameId,
                    createdAt: new Date().toISOString()
                });
            });
            console.log("Joined successfully!");
            // No need to redirect manually, the active games list will update or we can push
            // router.push(`/arena/tictactoe/${gameId}`);

        } catch (e) {
            console.error("Join Error:", e);
            alert("Failed to join: " + e);
        }
    };

    const handleDeleteGame = async (gameId) => {
        if (!confirm('Are you sure you want to delete this completed challenge?')) return;
        try {
            await deleteDoc(doc(db, 'arena_games', gameId));
        } catch (error) {
            console.error("Error deleting game:", error);
            alert("Failed to delete game.");
        }
    };

    const handleCreateDuel = async () => {
        if (!user) return alert("You must be logged in.");
        if (!duelConfig.game) return alert("Please select a game.");
        if (arenaSettings?.[duelConfig.game] === false) return alert("This game is currently disabled.");

        const wagerAmount = parseFloat(duelConfig.wager);
        if (isNaN(wagerAmount) || wagerAmount < 0) return alert("Invalid wager amount.");
        if (wagerAmount > user.balance) return alert("Insufficient funds.");

        try {
            await runTransaction(db, async (transaction) => {
                // 1. Check Balance again inside transaction
                const userRef = doc(db, 'users', user.id);
                const userSnap = await transaction.get(userRef);
                if (!userSnap.exists()) throw "User does not exist!";

                const userData = userSnap.data();
                if (userData.balance < wagerAmount) throw "Insufficient funds!";

                // 2. Deduct Balance
                transaction.update(userRef, {
                    balance: userData.balance - wagerAmount,
                    lockedBalance: (userData.lockedBalance || 0) + wagerAmount // Optional: track locked funds
                });

                // 3. Create Game
                const gameRef = doc(collection(db, 'arena_games'));
                const newGameData = {
                    type: duelConfig.game,
                    status: 'open',
                    createdAt: serverTimestamp(),
                    creatorId: user.id,
                    creatorUsername: user.username,
                    wager: wagerAmount,
                    pot: wagerAmount, // Initially just creator's wager
                    config: {
                        isPrivate: duelConfig.isPrivate,
                        opponent: duelConfig.isPrivate ? duelConfig.opponent : null,
                        opponentId: duelConfig.isPrivate && duelConfig.selectedUser ? duelConfig.selectedUser.id : null,
                        expiry: parseInt(duelConfig.expiry),
                        turnTimer: parseInt(duelConfig.turnTimer),
                        matchType: parseInt(duelConfig.matchType)
                    },
                    players: {
                        [user.id]: {
                            username: user.username,
                            avatar: userData.avatar || null, // If exists
                            joinedAt: serverTimestamp()
                        }
                    }
                };
                transaction.set(gameRef, newGameData);

                // 4. Notification for Private Invite
                if (duelConfig.isPrivate && duelConfig.selectedUser) {
                    const notifRef = doc(collection(db, 'notifications'));
                    transaction.set(notifRef, {
                        type: 'arena_invite',
                        userId: duelConfig.selectedUser.id,
                        title: 'Arena Challenge',
                        message: `${user.username} challenged you to a ${duelConfig.game} duel for $${wagerAmount}!`,
                        link: `/arena/${duelConfig.game}/${gameRef.id}`,
                        read: false,
                        createdAt: serverTimestamp()
                    });
                }
            });

            setIsCreateModalOpen(false);
            // alert("Challenge created! Your funds have been locked.");
        } catch (e) {
            console.error("Creation failed:", e);
            alert("Failed to create duel: " + e.message || e);
        }
    };

    return (
        <div className="animate-fade" style={{
            minHeight: '100vh',
            background: 'radial-gradient(circle at top center, #2e1065 0%, #000000 60%)',
            padding: '20px 20px 120px 20px',
            color: '#fff',
            position: 'relative'
        }}>

            {/* --- CREATE DUEL MODAL --- */}
            {isCreateModalOpen && (
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 10005,
                    background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(5px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
                }}>
                    <style>{`
                        @keyframes scaleIn {
                            from { transform: scale(0.9); opacity: 0; }
                            to { transform: scale(1); opacity: 1; }
                        }
                        .animate-scale-in {
                            animation: scaleIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                        }
                    `}</style>
                    <div className="animate-scale-in" style={{
                        width: '100%', maxWidth: '500px',
                        maxHeight: '90vh', overflowY: 'auto',
                        background: '#18181b', border: '1px solid #333', borderRadius: '24px',
                        padding: '16px', position: 'relative',
                        boxShadow: '0 20px 50px -10px rgba(0,0,0,0.5)'
                    }}>
                        <button onClick={() => setIsCreateModalOpen(false)} style={{
                            position: 'absolute', top: '16px', right: '16px',
                            background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%',
                            width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: '#fff', cursor: 'pointer'
                        }}>
                            <X size={18} />
                        </button>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                            <div style={{
                                width: '48px', height: '48px', borderRadius: '12px',
                                background: 'linear-gradient(135deg, #f59e0b, #ec4899)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                boxShadow: '0 0 15px rgba(236,72,153,0.3)'
                            }}>
                                <Swords size={24} color="#fff" />
                            </div>
                            <div>
                                <h2 style={{ fontSize: '20px', fontWeight: 'bold', margin: 0 }}>Create Duel</h2>
                                <p style={{ fontSize: '14px', color: '#a1a1aa', margin: 0 }}>Set the terms of battle.</p>
                            </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {/* Game Selection */}
                            <div>
                                <label style={{ display: 'block', textTransform: 'uppercase', fontSize: '11px', fontWeight: 'bold', color: '#71717a', marginBottom: '6px' }}>
                                    Select Game
                                </label>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                                    {['tictactoe'].map(gameId => {
                                        const isEnabled = arenaSettings?.[gameId] !== false;
                                        return (
                                            <button
                                                key={gameId}
                                                disabled={!isEnabled}
                                                onClick={() => isEnabled && setDuelConfig({ ...duelConfig, game: gameId })}
                                                style={{
                                                    background: duelConfig.game === gameId ? 'rgba(236, 72, 153, 0.2)' : (isEnabled ? '#27272a' : '#18181b'),
                                                    border: duelConfig.game === gameId ? '1px solid #ec4899' : (isEnabled ? '1px solid #3f3f46' : '1px dashed #333'),
                                                    borderRadius: '12px',
                                                    padding: '16px',
                                                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
                                                    cursor: isEnabled ? 'pointer' : 'not-allowed',
                                                    transition: 'all 0.2s',
                                                    color: duelConfig.game === gameId ? '#ec4899' : (isEnabled ? '#fff' : '#52525b'),
                                                    opacity: isEnabled ? 1 : 0.6
                                                }}
                                            >
                                                {gameId === 'tictactoe' && <span style={{ fontSize: '24px' }}>❌⭕</span>}
                                                <span style={{ fontWeight: 'bold', fontSize: '14px', textTransform: 'capitalize' }}>
                                                    {gameId === 'tictactoe' ? 'Tic Tac Toe' : gameId}
                                                </span>
                                                {!isEnabled && <span style={{ fontSize: '10px', color: '#ef4444', fontWeight: 'bold' }}>DISABLED</span>}
                                            </button>
                                        );
                                    })}
                                    <button
                                        disabled
                                        style={{
                                            background: '#18181b', border: '1px dashed #3f3f46',
                                            borderRadius: '12px', padding: '16px',
                                            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
                                            cursor: 'not-allowed', opacity: 0.5, color: '#71717a'
                                        }}
                                    >
                                        <span style={{ fontSize: '24px' }}>🔒</span>
                                        <span style={{ fontWeight: 'bold', fontSize: '12px' }}>Coming Soon</span>
                                    </button>
                                </div>
                            </div>

                            {/* Wager Input */}
                            <div>
                                <label style={{ display: 'block', textTransform: 'uppercase', fontSize: '11px', fontWeight: 'bold', color: '#71717a', marginBottom: '6px' }}>
                                    Wager Amount ($)
                                </label>
                                <div style={{ position: 'relative' }}>
                                    <DollarSign size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#10b981' }} />
                                    <input
                                        type="number"
                                        min="0"
                                        placeholder="0.00"
                                        value={duelConfig.wager}
                                        onChange={(e) => setDuelConfig({ ...duelConfig, wager: e.target.value })}
                                        style={{
                                            width: '100%', padding: '12px 12px 12px 36px', background: '#27272a',
                                            border: '1px solid #3f3f46', borderRadius: '12px',
                                            color: '#fff', outline: 'none', fontSize: '16px', fontWeight: 'bold'
                                        }}
                                    />
                                </div>
                                <div style={{ fontSize: '11px', color: '#71717a', marginTop: '4px', textAlign: 'right' }}>
                                    Balance: ${user?.balance?.toFixed(2) || '0.00'}
                                </div>
                            </div>

                            {/* Opponent Selection */}
                            <div>
                                <label style={{ display: 'block', textTransform: 'uppercase', fontSize: '11px', fontWeight: 'bold', color: '#71717a', marginBottom: '6px' }}>
                                    Opponent
                                </label>
                                <div style={{ display: 'flex', gap: '8px', marginBottom: duelConfig.isPrivate ? '12px' : '0' }}>
                                    <button
                                        onClick={() => setDuelConfig({ ...duelConfig, isPrivate: false })}
                                        style={{
                                            flex: 1, padding: '10px', borderRadius: '10px',
                                            background: !duelConfig.isPrivate ? 'rgba(34, 197, 94, 0.15)' : 'transparent',
                                            border: !duelConfig.isPrivate ? '1px solid var(--primary)' : '1px solid #3f3f46',
                                            color: !duelConfig.isPrivate ? 'var(--primary)' : '#a1a1aa',
                                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                            fontWeight: '600', fontSize: '13px'
                                        }}
                                    >
                                        <Users size={16} /> Public
                                    </button>
                                    <button
                                        onClick={() => setDuelConfig({ ...duelConfig, isPrivate: true })}
                                        style={{
                                            flex: 1, padding: '10px', borderRadius: '10px',
                                            background: duelConfig.isPrivate ? 'rgba(34, 197, 94, 0.15)' : 'transparent',
                                            border: duelConfig.isPrivate ? '1px solid var(--primary)' : '1px solid #3f3f46',
                                            color: duelConfig.isPrivate ? 'var(--primary)' : '#a1a1aa',
                                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                            fontWeight: '600', fontSize: '13px'
                                        }}
                                    >
                                        <Lock size={16} /> Private
                                    </button>
                                </div>
                                {duelConfig.isPrivate && (
                                    <div className="animate-fade" style={{ position: 'relative', zIndex: 10 }}>
                                        {duelConfig.selectedUser ? (
                                            <div style={{
                                                display: 'flex', alignItems: 'center', gap: '8px',
                                                background: '#27272a', border: '1px solid #3f3f46', borderRadius: '50px',
                                                padding: '6px 12px 6px 6px', width: 'fit-content'
                                            }}>
                                                <div style={{
                                                    width: '28px', height: '28px', borderRadius: '50%',
                                                    background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    fontSize: '12px', fontWeight: 'bold'
                                                }}>
                                                    {duelConfig.selectedUser.username.charAt(0).toUpperCase()}
                                                </div>
                                                <span style={{ fontWeight: '500', fontSize: '14px' }}>{duelConfig.selectedUser.username}</span>
                                                <button
                                                    onClick={clearSelectedOpponent}
                                                    style={{
                                                        background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%',
                                                        width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        cursor: 'pointer', marginLeft: '4px', color: '#a1a1aa'
                                                    }}
                                                >
                                                    <X size={12} />
                                                </button>
                                            </div>
                                        ) : (
                                            <div style={{ position: 'relative' }}>
                                                <input
                                                    type="text"
                                                    placeholder="Enter opponent's username..."
                                                    value={duelConfig.opponent}
                                                    onChange={(e) => {
                                                        setDuelConfig({ ...duelConfig, opponent: e.target.value });
                                                        setShowResults(true);
                                                    }}
                                                    onFocus={() => setShowResults(true)}
                                                    style={{
                                                        width: '100%', padding: '12px 40px 12px 12px', background: '#27272a',
                                                        border: '1px solid #3f3f46', borderRadius: '12px',
                                                        color: '#fff', outline: 'none'
                                                    }}
                                                />
                                                {isSearching && (
                                                    <div style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)' }}>
                                                        <div className="spinner" style={{
                                                            width: '16px', height: '16px',
                                                            border: '2px solid rgba(255,255,255,0.1)',
                                                            borderTopColor: '#fff', borderRadius: '50%',
                                                            animation: 'spin 1s linear infinite'
                                                        }}></div>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        <style>{`
                                            @keyframes spin { to { transform: rotate(360deg); } }
                                        `}</style>

                                        {/* Dropdown Results */}
                                        {!duelConfig.selectedUser && showResults && searchResults.length > 0 && (
                                            <div style={{
                                                position: 'absolute', top: '100%', left: 0, right: 0,
                                                marginTop: '4px',
                                                background: '#18181b', border: '1px solid #3f3f46',
                                                borderRadius: '12px', overflow: 'hidden', zIndex: 50,
                                                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)'
                                            }}>
                                                {searchResults.map(u => (
                                                    <button
                                                        key={u.id}
                                                        onClick={() => selectOpponent(u)}
                                                        style={{
                                                            width: '100%', padding: '10px 12px',
                                                            display: 'flex', alignItems: 'center', gap: '8px',
                                                            background: 'transparent', border: 'none',
                                                            color: '#fff', textAlign: 'left', cursor: 'pointer',
                                                            borderBottom: '1px solid rgba(255,255,255,0.05)',
                                                            transition: 'background 0.2s'
                                                        }}
                                                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                                                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                                    >
                                                        <div style={{
                                                            width: '24px', height: '24px', borderRadius: '50%',
                                                            background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                            fontSize: '10px', fontWeight: 'bold'
                                                        }}>
                                                            {u.username.charAt(0).toUpperCase()}
                                                        </div>
                                                        <span>{u.username}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Challenge Settings Grid */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                {/* Expiry */}
                                <div>
                                    <label style={{ display: 'block', textTransform: 'uppercase', fontSize: '11px', fontWeight: 'bold', color: '#71717a', marginBottom: '6px' }}>
                                        Expires In
                                    </label>
                                    <div style={{ position: 'relative' }}>
                                        <Calendar size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#71717a' }} />
                                        <select
                                            value={duelConfig.expiry}
                                            onChange={(e) => setDuelConfig({ ...duelConfig, expiry: e.target.value })}
                                            style={{
                                                width: '100%', padding: '12px 12px 12px 36px', background: '#27272a',
                                                border: '1px solid #3f3f46', borderRadius: '12px',
                                                color: '#fff', appearance: 'none', cursor: 'pointer', fontSize: '13px'
                                            }}
                                        >
                                            <option value="1">1 Hour</option>
                                            <option value="6">6 Hours</option>
                                            <option value="12">12 Hours</option>
                                            <option value="24">24 Hours</option>
                                        </select>
                                    </div>
                                </div>

                                {/* Turn Timer */}
                                <div>
                                    <label style={{ display: 'block', textTransform: 'uppercase', fontSize: '11px', fontWeight: 'bold', color: '#71717a', marginBottom: '6px' }}>
                                        Turn Timer
                                    </label>
                                    <div style={{ position: 'relative' }}>
                                        <Clock size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#71717a' }} />
                                        <select
                                            value={duelConfig.turnTimer}
                                            onChange={(e) => setDuelConfig({ ...duelConfig, turnTimer: e.target.value })}
                                            style={{
                                                width: '100%', padding: '12px 12px 12px 36px', background: '#27272a',
                                                border: '1px solid #3f3f46', borderRadius: '12px',
                                                color: '#fff', appearance: 'none', cursor: 'pointer', fontSize: '13px'
                                            }}
                                        >
                                            <option value="6">6 Hours</option>
                                            <option value="12">12 Hours</option>
                                            <option value="24">24 Hours</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* Match Type */}
                            <div>
                                <label style={{ display: 'block', textTransform: 'uppercase', fontSize: '11px', fontWeight: 'bold', color: '#71717a', marginBottom: '6px' }}>
                                    Format
                                </label>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                                    {['1', '3', '5'].map((format) => (
                                        <button
                                            key={format}
                                            onClick={() => setDuelConfig({ ...duelConfig, matchType: format })}
                                            style={{
                                                padding: '10px', borderRadius: '10px',
                                                background: duelConfig.matchType === format ? 'rgba(236, 72, 153, 0.15)' : '#27272a',
                                                border: duelConfig.matchType === format ? '1px solid #ec4899' : '1px solid #3f3f46',
                                                color: duelConfig.matchType === format ? '#ec4899' : '#a1a1aa',
                                                cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                                                fontWeight: '600', fontSize: '12px'
                                            }}
                                        >
                                            <span style={{ fontSize: '10px', opacity: 0.7 }}>Best of</span>
                                            <span style={{ fontSize: '16px' }}>{format}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <button
                                onClick={handleCreateDuel}
                                className="btn-primary" // Assuming global class or we make one
                                style={{
                                    marginTop: '16px',
                                    background: 'linear-gradient(90deg, #f59e0b, #ec4899)',
                                    border: 'none', color: '#fff', fontWeight: '800',
                                    padding: '16px', borderRadius: '12px',
                                    fontSize: '16px', textTransform: 'uppercase', letterSpacing: '1px',
                                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                    boxShadow: '0 4px 15px rgba(236, 72, 153, 0.4)',
                                    transition: 'transform 0.2s',
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
                                onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                            >
                                <Swords size={20} /> Initiate Duel
                            </button>

                        </div>

                    </div>
                </div>
            )}


            {/* --- TOUR OVERLAY --- */}
            {tourStep >= 0 && (
                <div style={{
                    position: 'fixed',
                    top: 0, left: 0, right: 0, bottom: 0,
                    zIndex: 9999,
                    pointerEvents: 'auto',
                }}>
                    <div style={{
                        position: 'absolute', inset: 0,
                        background: 'rgba(0,0,0,0.7)',
                        backdropFilter: 'blur(3px)',
                        transition: 'all 0.5s ease',
                        opacity: tourStep === 0 ? 1 : 0.5
                    }}></div>

                    {/* Welcome Modal (Step 0) */}
                    {tourStep === 0 && (
                        <div className="animate-fade-in-up" style={{
                            position: 'absolute',
                            top: '50%', left: '50%',
                            transform: 'translate(-50%, -50%)',
                            background: 'rgba(20, 20, 30, 0.95)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '24px',
                            padding: '32px',
                            maxWidth: '400px',
                            width: '90%',
                            boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
                            textAlign: 'center',
                            zIndex: 10001
                        }}>
                            <div style={{
                                width: '64px', height: '64px', margin: '0 auto 16px',
                                background: 'linear-gradient(135deg, #f59e0b, #ec4899)',
                                borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                boxShadow: '0 0 20px rgba(236, 72, 153, 0.4)'
                            }}>
                                <Swords size={32} color="white" />
                            </div>
                            <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '8px', color: '#fff' }}>
                                Welcome to the Arena
                            </h2>
                            <p style={{ color: '#94a3b8', lineHeight: '1.6', marginBottom: '24px' }}>
                                Enter the proving grounds. Challenge others, prove your worth, and claim victory.
                                <br />Ready to fight?
                            </p>
                            <div style={{ display: 'flex', gap: '12px', flexDirection: 'column' }}>
                                <button
                                    onClick={nextStep}
                                    style={{
                                        background: 'linear-gradient(90deg, #f59e0b, #ec4899)',
                                        color: '#fff', fontWeight: 'bold',
                                        padding: '12px', borderRadius: '12px', border: 'none',
                                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                                    }}
                                >
                                    Enter Arena <ArrowRight size={18} />
                                </button>
                                <button
                                    onClick={endTour}
                                    style={{
                                        background: 'transparent',
                                        color: '#64748b', fontWeight: '600',
                                        padding: '12px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)',
                                        cursor: 'pointer'
                                    }}
                                >
                                    Maybe Later
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Spotlight (Step > 0) */}
                    {tourStep > 0 && (
                        <>
                            <div style={{
                                position: 'absolute',
                                ...spotlightStyle,
                                borderRadius: '12px',
                                boxShadow: '0 0 0 9999px rgba(0,0,0,0.85), 0 0 20px rgba(255,255,255,0.2)',
                                zIndex: 10000,
                                transition: 'all 0.5s cubic-bezier(0.25, 1, 0.5, 1)',
                                pointerEvents: 'none'
                            }}></div>

                            <div style={{
                                position: 'absolute',
                                top: spotlightStyle.placement === 'top'
                                    ? spotlightStyle.top - 20
                                    : spotlightStyle.top + spotlightStyle.height + 20,
                                left: spotlightStyle.left + (spotlightStyle.width / 2),
                                transform: spotlightStyle.placement === 'top'
                                    ? 'translateX(-50%) translateY(-100%)'
                                    : 'translateX(-50%)',
                                width: '300px',
                                maxWidth: '90vw',
                                background: '#1e293b',
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: '16px',
                                padding: '20px',
                                zIndex: 10002,
                                color: '#fff',
                                boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                                transition: 'all 0.3s ease',
                                opacity: spotlightStyle.opacity,
                                pointerEvents: 'auto'
                            }}>
                                <div style={{
                                    position: 'absolute',
                                    top: spotlightStyle.placement === 'top' ? 'auto' : '-6px',
                                    bottom: spotlightStyle.placement === 'top' ? '-6px' : 'auto',
                                    left: '50%', transform: 'translateX(-50%) rotate(45deg)',
                                    width: '12px', height: '12px',
                                    background: '#1e293b',
                                    borderLeft: spotlightStyle.placement === 'top' ? 'none' : '1px solid rgba(255,255,255,0.1)',
                                    borderTop: spotlightStyle.placement === 'top' ? 'none' : '1px solid rgba(255,255,255,0.1)',
                                    borderRight: spotlightStyle.placement === 'top' ? '1px solid rgba(255,255,255,0.1)' : 'none',
                                    borderBottom: spotlightStyle.placement === 'top' ? '1px solid rgba(255,255,255,0.1)' : 'none'
                                }}></div>

                                <h3 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
                                    {tourStep === 1 && "The Arena Hub"}
                                    <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 'normal' }}>{tourStep}/1</span>
                                </h3>
                                <p style={{ fontSize: '14px', color: '#cbd5e1', marginBottom: '16px', lineHeight: '1.5' }}>
                                    {tourStep === 1 && "Select your challenge and prepare for battle. Victory awaits the bold."}
                                </p>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <button onClick={endTour} style={{ color: '#94a3b8', background: 'none', border: 'none', fontSize: '12px', cursor: 'pointer' }}>Skip</button>
                                    <button onClick={nextStep} style={{
                                        background: 'var(--primary)', color: '#000', padding: '6px 16px', borderRadius: '20px',
                                        border: 'none', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer'
                                    }}>
                                        Finish
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            )}


            {/* Ambient Background Glows */}
            <div style={{ position: 'fixed', top: '10%', left: '0', width: '300px', height: '300px', background: '#f59e0b', filter: 'blur(150px)', opacity: 0.1, pointerEvents: 'none' }}></div>
            <div style={{ position: 'fixed', bottom: '10%', right: '0', width: '400px', height: '400px', background: '#ec4899', filter: 'blur(150px)', opacity: 0.1, pointerEvents: 'none' }}></div>

            <header id="arena-header" style={{ marginBottom: '40px', textAlign: 'center', position: 'relative', zIndex: 1, padding: '10px', borderRadius: '12px' }}>
                <h1 style={{
                    fontSize: '64px',
                    fontWeight: '900',
                    marginBottom: '8px',
                    fontStyle: 'italic',
                    letterSpacing: '-2px',
                    background: 'linear-gradient(to bottom, #fff, #94a3b8)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    textShadow: '0 10px 30px rgba(0,0,0,0.5)'
                }}>
                    ARENA
                </h1>
                <div style={{
                    width: '60px',
                    height: '4px',
                    background: 'linear-gradient(90deg, #f59e0b, #ec4899)',
                    margin: '0 auto 16px auto',
                    borderRadius: '2px'
                }}></div>
                <p style={{ color: '#cbd5e1', fontSize: '16px', fontWeight: '400', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '24px' }}>
                    Player vs Player • Skill Based • Instant Glory
                </p>

                {/* CREATE GAME BUTTON */}
                <button
                    onClick={() => setIsCreateModalOpen(true)}
                    style={{
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        padding: '12px 24px',
                        borderRadius: '50px',
                        color: '#fff',
                        fontWeight: '600',
                        fontSize: '14px',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        backdropFilter: 'blur(10px)',
                        transition: 'all 0.3s ease',
                        boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                    }}
                    onMouseEnter={e => {
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                        e.currentTarget.style.transform = 'translateY(-2px)';
                    }}
                    onMouseLeave={e => {
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                        e.currentTarget.style.transform = 'translateY(0)';
                    }}
                >
                    <Plus size={18} className="text-primary" /> Create Challenge
                </button>
            </header>

            {/* SEPARATE SECTIONS FOR ACTIVE vs OPEN */}

            {/* 1. Active Battles */}
            <div style={{ maxWidth: '1200px', margin: '0 auto 40px auto' }}>
                <h3 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '10px', height: '10px', background: '#10b981', borderRadius: '50%', boxShadow: '0 0 10px #10b981' }}></div>
                    Active Battles
                </h3>

                {activeGames.filter(g => g.status === 'active').length === 0 ? (
                    <div style={{
                        padding: '30px',
                        border: '1px dashed rgba(255,255,255,0.1)',
                        borderRadius: '20px',
                        color: '#64748b',
                        textAlign: 'center',
                        fontSize: '14px'
                    }}>
                        No active battles right now. Start one!
                    </div>
                ) : (
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                        gap: '20px'
                    }}>
                        {activeGames.filter(g => g.status === 'active').map(game => {
                            const isPlayer = user && game.players && game.players[user.id];
                            const isMyTurn = user && game.currentTurn === user.id;
                            let statusText = "Watch";
                            let statusBg = "rgba(16, 185, 129, 0.2)";
                            let statusColor = "#10b981";

                            if (isPlayer) {
                                if (isMyTurn) {
                                    statusText = "YOUR TURN";
                                    statusBg = "rgba(239, 68, 68, 0.2)";
                                    statusColor = "#ef4444";
                                } else {
                                    statusText = "WAITING FOR OPPONENT";
                                    statusBg = "rgba(245, 158, 11, 0.2)";
                                    statusColor = "#f59e0b";
                                }
                            }

                            return (
                                <Link href={`/arena/${game.type}/${game.id}`} key={game.id} style={{ textDecoration: 'none' }}>
                                    <div className="game-card" style={{
                                        position: 'relative',
                                        background: 'rgba(16, 185, 129, 0.05)',
                                        backdropFilter: 'blur(10px)',
                                        borderRadius: '24px',
                                        border: '1px solid rgba(16, 185, 129, 0.2)',
                                        padding: '24px',
                                        overflow: 'hidden',
                                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                        height: '100%',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        textAlign: 'center'
                                    }}
                                        onMouseEnter={e => {
                                            e.currentTarget.style.transform = 'translateY(-5px) scale(1.02)';
                                            e.currentTarget.style.background = 'rgba(16, 185, 129, 0.1)';
                                            e.currentTarget.style.borderColor = '#10b981';
                                            e.currentTarget.style.boxShadow = `0 20px 40px -5px rgba(0,0,0,0.3), 0 0 20px -5px rgba(16, 185, 129, 0.3)`;
                                        }}
                                        onMouseLeave={e => {
                                            e.currentTarget.style.transform = 'translateY(0) scale(1)';
                                            e.currentTarget.style.background = 'rgba(16, 185, 129, 0.05)';
                                            e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.2)';
                                            e.currentTarget.style.boxShadow = 'none';
                                        }}
                                    >
                                        <div style={{
                                            position: 'absolute', top: 10, right: 10,
                                            background: '#10b981', color: '#000',
                                            fontSize: '10px', fontWeight: 'bold', padding: '4px 8px', borderRadius: '10px'
                                        }}>IN PROGRESS</div>

                                        <div style={{ marginBottom: '16px' }}>
                                            {game.type === 'tictactoe' ? <Swords size={32} color="#10b981" /> : <Trophy size={32} color="#10b981" />}
                                        </div>

                                        <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '8px', textTransform: 'capitalize' }}>
                                            {game.type === 'tictactoe' ? 'Tic Tac Toe' : game.type}
                                        </h2>

                                        <div style={{ fontSize: '14px', color: '#a1a1aa', marginBottom: '16px' }}>
                                            {game.creatorUsername} <span style={{ color: '#666' }}>vs</span> {Object.values(game.players || {}).find(p => p.username !== game.creatorUsername)?.username || '???'}
                                            {parseInt(game.config?.matchType || 1) > 1 && (
                                                <div style={{
                                                    marginTop: '8px',
                                                    background: 'rgba(0,0,0,0.2)',
                                                    padding: '4px 12px',
                                                    borderRadius: '12px',
                                                    fontSize: '12px',
                                                    fontWeight: 'bold',
                                                    color: '#fff',
                                                    display: 'inline-block'
                                                }}>
                                                    {game.players[game.creatorId]?.roundWins || 0} - {Object.values(game.players || {}).find(p => p.username !== game.creatorUsername)?.roundWins || 0}
                                                    <span style={{ marginLeft: '6px', fontSize: '10px', color: '#ec4899' }}>
                                                        (Bo{game.config.matchType})
                                                    </span>
                                                </div>
                                            )}
                                        </div>

                                        <div style={{
                                            padding: '6px 16px', background: statusBg,
                                            borderRadius: '20px', color: statusColor, fontWeight: 'bold', fontSize: '12px'
                                        }}>
                                            {statusText}
                                        </div>
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* 2. Open Challenges */}
            <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
                <h3 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '10px', height: '10px', background: '#f59e0b', borderRadius: '50%' }}></div>
                    Open Challenges
                </h3>

                {activeGames.filter(g => g.status === 'open').length === 0 ? (
                    <div style={{
                        padding: '40px',
                        border: '1px dashed rgba(255,255,255,0.1)',
                        borderRadius: '24px',
                        color: '#64748b',
                        textAlign: 'center'
                    }}>
                        <Swords size={48} style={{ opacity: 0.5, marginBottom: '16px' }} />
                        <p>No open challenges found. Create one to be the first!</p>
                    </div>
                ) : (
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                        gap: '20px'
                    }}>
                        {activeGames.filter(g => g.status === 'open').map(game => {
                            const isCreator = user && game.creatorId === user.id;
                            return (
                                <Link href={`/arena/${game.type}/${game.id}`} key={game.id} style={{ textDecoration: 'none' }}>
                                    <div className="game-card" style={{
                                        position: 'relative',
                                        background: 'rgba(255, 255, 255, 0.03)',
                                        backdropFilter: 'blur(10px)',
                                        borderRadius: '24px',
                                        border: '1px solid rgba(255, 255, 255, 0.1)',
                                        padding: '24px',
                                        overflow: 'hidden',
                                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                        height: '100%',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        textAlign: 'center',
                                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
                                    }}
                                        onMouseEnter={e => {
                                            e.currentTarget.style.transform = 'translateY(-5px) scale(1.02)';
                                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.07)';
                                            e.currentTarget.style.borderColor = '#ec4899'; // Default accent
                                            e.currentTarget.style.boxShadow = `0 20px 40px -5px rgba(0,0,0,0.3), 0 0 20px -5px rgba(236,72,153,0.3)`;
                                        }}
                                        onMouseLeave={e => {
                                            e.currentTarget.style.transform = 'translateY(0) scale(1)';
                                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                                            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                                            e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)';
                                        }}
                                    >
                                        {/* Card Background Gradient Blob */}
                                        <div style={{
                                            position: 'absolute',
                                            top: '-50%',
                                            left: '50%',
                                            transform: 'translateX(-50%)',
                                            width: '150%',
                                            height: '100%',
                                            background: `radial-gradient(circle, rgba(236,72,153,0.1) 0%, transparent 70%)`,
                                            pointerEvents: 'none',
                                            transition: 'opacity 0.3s'
                                        }}></div>

                                        {/* Private Badge */}
                                        {game.config?.isPrivate && (
                                            <div style={{
                                                position: 'absolute', top: 12, right: 12,
                                                background: 'rgba(139, 92, 246, 0.2)', border: '1px solid rgba(139, 92, 246, 0.4)',
                                                color: '#a78bfa',
                                                fontSize: '10px', fontWeight: 'bold', padding: '4px 8px', borderRadius: '8px',
                                                display: 'flex', alignItems: 'center', gap: '4px', zIndex: 2
                                            }}>
                                                <Lock size={10} /> PRIVATE
                                            </div>
                                        )}

                                        <div style={{
                                            position: 'relative',
                                            marginBottom: '20px',
                                            padding: '20px',
                                            background: 'rgba(0,0,0,0.3)',
                                            borderRadius: '20px',
                                            border: '1px solid rgba(255,255,255,0.05)',
                                            color: '#ec4899',
                                            boxShadow: 'inset 0 0 20px rgba(0,0,0,0.5)'
                                        }}>
                                            {game.type === 'tictactoe' ? <Swords size={32} /> : <Trophy size={32} />}
                                        </div>

                                        <h2 style={{
                                            fontSize: '24px',
                                            fontWeight: 'bold',
                                            color: '#fff',
                                            marginBottom: '8px',
                                            textTransform: 'capitalize'
                                        }}>
                                            {game.type === 'tictactoe' ? 'Tic Tac Toe' : game.type}
                                        </h2>

                                        <div style={{ marginBottom: '16px' }}>
                                            <span style={{
                                                fontSize: '20px', fontWeight: 'bold', color: '#10b981',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px'
                                            }}>
                                                ${game.wager?.toFixed(2)} <span style={{ fontSize: '12px', color: '#94a3b8' }}>POOL</span>
                                            </span>
                                        </div>

                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: '#cbd5e1' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <User size={14} /> {game.creatorUsername}
                                            </div>
                                            <span style={{ opacity: 0.3 }}>|</span>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <Clock size={14} /> {game.config?.turnTimer}h Turn
                                            </div>
                                        </div>

                                        <div style={{
                                            marginTop: '20px',
                                            padding: '8px 24px',
                                            background: 'rgba(255,255,255,0.1)',
                                            borderRadius: '50px',
                                            fontSize: '12px',
                                            fontWeight: 'bold',
                                            color: '#fff',
                                            textTransform: 'uppercase',
                                            letterSpacing: '1px'
                                        }}>
                                            {isCreator ? 'Waiting for Opponent' : 'Join Fight'}
                                        </div>
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* 3. Finished Challenges */}
            <div style={{ maxWidth: '1200px', margin: '40px auto 0 auto', opacity: 0.8 }}>
                <h3 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px', color: '#a1a1aa' }}>
                    <Trophy size={20} /> Finished Challenges
                </h3>

                {completedGames.length === 0 ? (
                    <div style={{ padding: '20px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
                        No finished battles yet.
                    </div>
                ) : (
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                        gap: '12px'
                    }}>
                        {completedGames.map(game => {
                            const isWinner = user && game.winnerId === user.id;
                            const isLoser = user && game.players && game.players[user.id] && game.winnerId !== user.id && game.result !== 'draw';
                            const isDraw = game.result === 'draw';

                            let resultColor = '#a1a1aa';
                            let resultText = 'Ended';

                            if (isWinner) { resultColor = '#10b981'; resultText = 'VICTORY'; }
                            else if (isLoser) { resultColor = '#ef4444'; resultText = 'DEFEAT'; }
                            else if (isDraw) { resultColor = '#f59e0b'; resultText = 'DRAW'; }

                            // Format Date
                            const date = game.settledAt?.toDate ? game.settledAt.toDate() : new Date(game.settledAt || Date.now());
                            const dateStr = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

                            return (
                                <Link href={`/arena/${game.type}/${game.id}`} key={game.id} style={{ textDecoration: 'none' }}>
                                    <div className="game-card" style={{
                                        background: 'rgba(255, 255, 255, 0.02)',
                                        borderRadius: '16px',
                                        border: '1px solid rgba(255, 255, 255, 0.05)',
                                        padding: '16px',
                                        transition: 'all 0.2s ease',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        gap: '12px'
                                    }}
                                        onMouseEnter={e => {
                                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                                            e.currentTarget.style.transform = 'translateY(-2px)';
                                        }}
                                        onMouseLeave={e => {
                                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)';
                                            e.currentTarget.style.transform = 'translateY(0)';
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <div style={{
                                                width: '36px', height: '36px', borderRadius: '10px',
                                                background: game.type === 'tictactoe' ? 'rgba(236, 72, 153, 0.1)' : 'rgba(255,255,255,0.05)',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                color: game.type === 'tictactoe' ? '#ec4899' : '#fff'
                                            }}>
                                                {game.type === 'tictactoe' ? <Swords size={18} /> : <Trophy size={18} />}
                                            </div>
                                            <div>
                                                <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#fff', textTransform: 'capitalize' }}>
                                                    {game.type === 'tictactoe' ? 'Tic Tac Toe' : game.type}
                                                </div>
                                                <div style={{ fontSize: '11px', color: '#71717a' }}>
                                                    {dateStr} • {game.players && Object.keys(game.players).length} Players
                                                </div>
                                            </div>
                                        </div>

                                        <div style={{ textAlign: 'right' }}>
                                            <div style={{ fontSize: '14px', fontWeight: 'bold', color: isLoser ? '#ef4444' : '#10b981' }}>
                                                {isLoser ? `-$${game.wager?.toFixed(2)}` : `+$${game.pot?.toFixed(2)}`}
                                            </div>
                                            <div style={{ fontSize: '10px', fontWeight: 'bold', color: resultColor, marginTop: '2px' }}>
                                                {resultText}
                                            </div>
                                            {user?.role === 'admin' && (
                                                <button
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        handleDeleteGame(game.id);
                                                    }}
                                                    style={{ display: 'block', marginTop: '4px', fontSize: '10px', color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', float: 'right', padding: 0 }}
                                                >
                                                    Delete
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
