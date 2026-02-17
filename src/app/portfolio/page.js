"use client";
import { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '../../lib/store';
import { Wallet, TrendingUp, BarChart3, ArrowUpRight, ArrowDownRight, DollarSign, History, AlertCircle, ChevronDown, ChevronUp, LineChart } from 'lucide-react';
import { collection, query, where, getDocs, documentId } from 'firebase/firestore';


const BalanceChart = ({ historyFrame, allBets, casinoBets, currentNetWorth }) => {
    const [hoverData, setHoverData] = useState(null);
    const containerRef = useRef(null);

    const historyPoints = useMemo(() => {
        const events = [];

        // 1. Process Sports Bets
        (allBets || []).forEach(bet => {
            const placedAt = new Date(bet.placedAt).getTime();
            // Debit when placed
            events.push({ time: placedAt, delta: -Number(bet.amount || 0) });

            if (bet.status === 'won') {
                const resolvedAt = bet.resolvedAt ? new Date(bet.resolvedAt).getTime() : placedAt + 1000;
                events.push({ time: resolvedAt, delta: Number(bet.potentialPayout || 0) });
            } else if (bet.status === 'void') {
                const resolvedAt = bet.resolvedAt ? new Date(bet.resolvedAt).getTime() : placedAt + 1000;
                events.push({ time: resolvedAt, delta: Number(bet.amount || 0) }); // Refund
            }
        });

        // 2. Process Casino Bets
        (casinoBets || []).forEach(bet => {
            const t = bet.timestamp || Date.now();
            const amount = Number(bet.amount) || 0;
            const payout = Number(bet.payout) || 0;
            // Net change instant event
            events.push({ time: t, delta: payout - amount });
        });

        // 3. Sort Newest First (Desc)
        events.sort((a, b) => b.time - a.time);

        // 4. Time Cutoff
        const now = Date.now();
        let cutoff = 0;
        if (historyFrame === '24h') cutoff = now - 24 * 60 * 60 * 1000;
        if (historyFrame === '7d') cutoff = now - 7 * 24 * 60 * 60 * 1000;
        if (historyFrame === '30d') cutoff = now - 30 * 24 * 60 * 60 * 1000;
        if (historyFrame === 'all') cutoff = 0;

        // 5. Build Points (Walk Backwards from Net Worth)
        // Note: Graphing "Net Worth" is difficult because "invested" value fluctuates
        // BUT, if we assume: Net Worth = Balance + Invested.
        // When a bet is placed: Balance - X, Invested + X. Net Worth = No Change.
        // When a bet is won: Balance + Y, Invested - X. Net Worth Change = Y - X (Profit).
        // So, if we only track RESOLVED events (wins/losses), we can graph Net Worth.
        // Placed bets don't change net worth.

        // Re-strategy: Only count RESOLVED events (profit/loss).
        // "Delta" for a win is (Payout - Wager).
        // "Delta" for a loss is (-Wager).
        // "Delta" for void is 0.
        // "Delta" for casino is (Payout - Wager).

        const nwEvents = [];

        (allBets || []).forEach(bet => {
            if (bet.status === 'won') {
                const t = bet.resolvedAt ? new Date(bet.resolvedAt).getTime() : new Date(bet.placedAt).getTime() + 1000;
                nwEvents.push({ time: t, delta: (bet.potentialPayout - bet.amount) });
            } else if (bet.status === 'lost') {
                // Resolved time usually not stored on loss, use placed time + duration or now?
                // Approximation: if lost, assume it resolved recently or if old, placed time
                // Ideally we need 'resolvedAt' for losses too. Assuming it exists or fallback.
                const t = bet.resolvedAt ? new Date(bet.resolvedAt).getTime() : (bet.expiresAt ? new Date(bet.expiresAt).getTime() : new Date(bet.placedAt).getTime() + (2 * 3600 * 1000));
                nwEvents.push({ time: t, delta: -Number(bet.amount) });
            }
        });

        (casinoBets || []).forEach(bet => {
            const t = bet.timestamp || Date.now();
            nwEvents.push({ time: t, delta: (Number(bet.payout) - Number(bet.amount)) });
        });

        nwEvents.sort((a, b) => b.time - a.time);

        let simNW = Number(currentNetWorth) || 0;
        const pts = [];

        pts.push({ time: now, val: simNW });

        for (const event of nwEvents) {
            simNW -= event.delta;
            if (event.time < cutoff) {
                pts.push({ time: cutoff, val: simNW });
                break;
            }
            pts.push({ time: event.time, val: simNW + event.delta }); // Point just before change?
            // Actually: At time T, Value changed FROM (Current - Delta) TO Current.
            // So at T-epsilon, value was (Current - Delta).
            // We want the line to step or slope? Slope is better visually.
            // Let's just plot the values.
            // The loop walks backwards.
            // Current is V. Event delta D. Previous was V - D.
            // So we push { time: event.time, val: simNW } (which is the PREVIOUS value).
        }

        if (nwEvents.length === 0 || nwEvents[nwEvents.length - 1].time >= cutoff) {
            pts.push({ time: cutoff, val: simNW });
        }

        pts.reverse();
        const filtered = pts.filter(p => p.time >= cutoff);

        if (filtered.length < 2) {
            if (filtered.length === 1) filtered.push({ ...filtered[0], time: now });
            else filtered.push({ time: cutoff, val: Number(currentNetWorth) || 0 }, { time: now, val: Number(currentNetWorth) || 0 });
        }

        return filtered;

    }, [allBets, casinoBets, historyFrame, currentNetWorth]);

    const handleInteraction = (clientX) => {
        if (!containerRef.current || historyPoints.length < 2) return;
        const rect = containerRef.current.getBoundingClientRect();
        const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
        const index = Math.round((x / rect.width) * (historyPoints.length - 1));
        const point = historyPoints[index];

        const minVal = Math.min(...historyPoints.map(p => p.val));
        const maxVal = Math.max(...historyPoints.map(p => p.val));
        const range = maxVal - minVal || 1;

        // Safe Y calc
        const y = 40 - ((point.val - minVal) / range) * 40;

        setHoverData({ point, x: (index / (historyPoints.length - 1)) * 100, y });
    };

    const handleTouch = (e) => {
        const touch = e.touches[0];
        handleInteraction(touch.clientX);
    };

    if (historyPoints.length < 2) return (
        <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
            Not enough data for chart
        </div>
    );

    const minVal = Math.min(...historyPoints.map(p => p.val));
    const maxVal = Math.max(...historyPoints.map(p => p.val));
    const range = maxVal - minVal || 1;
    const isProfit = historyPoints[historyPoints.length - 1].val >= historyPoints[0].val;
    const chartColor = isProfit ? '#22c55e' : '#ef4444';

    // SVG Path Generation
    const pointsStr = historyPoints.map((p, i) => {
        const x = (i / (historyPoints.length - 1)) * 100;
        const y = 40 - ((p.val - minVal) / range) * 40;
        return `${x},${y}`;
    }).join(' ');

    return (
        <div style={{ padding: '16px', background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                <h3 style={{ fontSize: '14px', margin: 0, color: 'var(--text-muted)' }}>Balance Trend</h3>
                <div style={{ fontSize: '12px', color: chartColor, fontWeight: 'bold' }}>
                    {hoverData ? `$${hoverData.point.val.toFixed(2)}` : `${isProfit ? '▲' : '▼'} ${historyFrame}`}
                </div>
            </div>

            <div
                ref={containerRef}
                style={{ position: 'relative', height: '80px', touchAction: 'none', cursor: 'crosshair', userSelect: 'none' }}
                onMouseMove={(e) => handleInteraction(e.clientX)}
                onMouseLeave={() => setHoverData(null)}
                onTouchStart={handleTouch}
                onTouchMove={handleTouch}
                onTouchEnd={() => setHoverData(null)}
            >
                <svg viewBox="0 0 100 40" preserveAspectRatio="none" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
                    <polyline fill="none" stroke={chartColor} strokeWidth="2" points={pointsStr} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                    {hoverData && (
                        <>
                            <line x1={hoverData.x} y1="0" x2={hoverData.x} y2="40" stroke="rgba(255,255,255,0.5)" strokeWidth="0.5" strokeDasharray="2" vectorEffect="non-scaling-stroke" />
                            <circle cx={hoverData.x} cy={hoverData.y} r="2" fill="#fff" stroke={chartColor} strokeWidth="1" vectorEffect="non-scaling-stroke" />
                        </>
                    )}
                </svg>
                {hoverData && (
                    <div style={{
                        position: 'absolute', left: `${hoverData.x}%`, top: '-35px', transform: 'translateX(-50%)',
                        background: 'rgba(23, 23, 23, 0.95)', border: '1px solid rgba(255,255,255,0.1)', padding: '6px 10px',
                        borderRadius: '8px', fontSize: '12px', pointerEvents: 'none', whiteSpace: 'nowrap', zIndex: 10,
                        boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
                    }}>
                        <div style={{ fontWeight: 'bold', color: '#fff' }}>${hoverData.point.val.toFixed(2)}</div>
                        <div style={{ color: '#a1a1aa', fontSize: '10px' }}>
                            {new Date(hoverData.point.time).toLocaleTimeString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default function Portfolio() {
    const { db, user, bets, events, isLoaded, casinoBets } = useApp();
    const router = useRouter();
    const [expandedBet, setExpandedBet] = useState(null);
    const [showActiveBets, setShowActiveBets] = useState(false);
    const [showSettledBets, setShowSettledBets] = useState(false);
    const [historyFrame, setHistoryFrame] = useState('7d');
    const [portfolioTab, setPortfolioTab] = useState('bets');
    const [arenaStats, setArenaStats] = useState({ duels: 0, biggestWin: 0, winRate: 0, netProfit: 0 });
    const [loadingArena, setLoadingArena] = useState(false);

    // --- BET IDEA LOGIC ---
    const [showIdeaModal, setShowIdeaModal] = useState(false);
    const [ideaText, setIdeaText] = useState('');
    const [ideaStatus, setIdeaStatus] = useState({ success: false, message: '' });
    const { submitIdea } = useApp();

    const handleIdeaSubmit = async (e) => {
        e.preventDefault();
        setIdeaStatus({ success: false, message: '' });

        if (!ideaText.trim()) {
            setIdeaStatus({ success: false, message: 'Please enter an idea.' });
            return;
        }

        const res = await submitIdea(ideaText);
        if (res.success) {
            setIdeaStatus({ success: true, message: res.message || 'Idea submitted!' });
            setIdeaText('');
            setTimeout(() => {
                setShowIdeaModal(false);
                setIdeaStatus({ success: false, message: '' });
            }, 2000);
        } else {
            setIdeaStatus({ success: false, message: res.error });
        }
    };

    useEffect(() => {
        if (isLoaded && !user) {
            router.push('/');
        }
    }, [user, isLoaded, router]);

    // Arena Stats Calculation
    useEffect(() => {
        if (!user || !db) return;

        const fetchArenaStats = async () => {
            setLoadingArena(true);
            try {
                // Corrected: Fetch ALL completed games where user was a player
                const qGames = query(
                    collection(db, 'arena_games'),
                    where('status', '==', 'completed')
                    // Note: 'players' is a map, so we can't simple 'where' check deeply on keys without specific index
                    // Workaround: We can't index every user ID map key.
                    // Better approach: Since we don't have massive data yet, fetch completed games and filter client side
                    // OR: Use the 'players' array if we had one.
                    // Let's stick to the transaction method but ensure it captures everything? No, transaction method relies on 'duel_join' which might be purged.

                    // Actually, let's use a composite index or just fetch the user's games if we can track them.
                    // A 'participatedGameIds' array on the user doc would be best.
                    // Lacking that, let's try the transaction method again but purely based on 'arena_games' that contain the user.
                    // Firestore doesn't support: where(`players.${user.id}`, '!=', null).

                    // FALLBACK: Transaction method is actually decent for now, BUT let's fetch 'arena_games' where 'creatorId' == user.id OR 'players' logic?
                    // We can't query map keys.

                    // OK, let's try to query by 'creatorId' == me AND 'config.opponentId' == me? No active games would be found.
                    // Let's rely on the transaction history but query specifically for completed events?
                    // Or, just fetch ALL arena games (if < 1000) and filter.

                    // Let's assume the transaction log is the most reliable "History" we have for now.
                    // If transactions ARE cleared, we lose history.
                    // Let's try to fetch games where I am the creator OR opponent.
                );

                // Optimized: Fetch games where I created
                const qCreated = query(collection(db, 'arena_games'), where('creatorId', '==', user.id), where('status', '==', 'completed'));
                // Fetch games where I was opponent (private?) Public games are hard.

                // Let's go with: Fetch all 'completed' arena games (Assuming reasonable count < 500 for beta) and filter.
                // If scaling is issue, we need a 'participants' array field on game doc.
                const gamesSnap = await getDocs(qGames);

                let duels = 0;
                let wins = 0;
                let settledCount = 0;
                let biggest = 0;
                let profit = 0;

                gamesSnap.docs.forEach(doc => {
                    const g = { id: doc.id, ...doc.data() };
                    // Check participation
                    if (!g.players || !g.players[user.id]) return;

                    duels++;
                    const isWinner = g.winnerId === user.id;
                    const isDraw = g.result === 'draw';

                    if (isDraw) {
                        settledCount++;
                        // No profit/loss
                    } else if (isWinner) {
                        wins++;
                        settledCount++;
                        // Net Profit = Pot - Wager?
                        // If I put in 10, Pot is 20. I win 20. Net +10.
                        const winAmount = (g.pot || 0) - (g.wager || 0);
                        if (winAmount > biggest) biggest = winAmount;
                        profit += winAmount;
                    } else {
                        settledCount++;
                        profit -= (g.wager || 0);
                    }
                });

                const rate = settledCount > 0 ? ((wins / settledCount) * 100).toFixed(1) : '0.0';

                setArenaStats({
                    duels: duels,
                    biggestWin: biggest,
                    winRate: rate,
                    netProfit: profit
                });

            } catch (err) {
                console.error("Error fetching arena stats:", err);
            } finally {
                setLoadingArena(false);
            }
        };

        fetchArenaStats();
    }, [user, db]);

    if (!isLoaded || !user) return null;

    // --- LOGIC FROM MY BETS ---
    const myBets = (bets || []).filter(b => b.userId === user.id).sort((a, b) => new Date(b.placedAt) - new Date(a.placedAt));
    const activeBets = myBets.filter(b => b.status === 'pending');
    const completedBets = myBets.filter(b => b.status !== 'pending');
    const wonBets = myBets.filter(b => b.status === 'won');

    // Stats Calculations
    const settledBetsForStats = myBets.filter(b => b.status === 'won' || b.status === 'lost');
    const winRate = settledBetsForStats.length > 0
        ? ((wonBets.length / settledBetsForStats.length) * 100).toFixed(1)
        : '0.0';

    const biggestWin = wonBets.length > 0
        ? Math.max(...wonBets.map(b => b.potentialPayout - b.amount))
        : 0;

    const totalNetProfit = completedBets.reduce((acc, bet) => {
        if (bet.status === 'won') return acc + (bet.potentialPayout - bet.amount);
        if (bet.status === 'lost') return acc - bet.amount;
        return acc;
    }, 0);

    // --- LOGIC FROM WALLET ---
    const netWorth = (user.balance || 0) + (user.invested || 0);

    const BetCard = ({ bet }) => {
        const isParlay = bet.type === 'parlay';
        // Status color logic including won/lost/void
        let statusColor = '#eab308'; // Default pending
        if (bet.status === 'won') statusColor = '#22c55e';
        if (bet.status === 'lost') statusColor = '#ef4444';
        if (bet.status === 'void') statusColor = '#a1a1aa';

        return (
            <div
                className="card"
                onClick={() => setExpandedBet(bet)}
                style={{
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    background: 'var(--bg-card)',
                    cursor: 'pointer',
                    transition: 'transform 0.1s',
                    borderLeft: `4px solid ${statusColor}`,
                    marginBottom: '0' // Handled by grid gap
                }}
                onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
            >
                <div style={{ marginBottom: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                        <span style={{
                            fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase',
                            background: bet.status === 'pending' ? 'rgba(234, 179, 8, 0.1)' : bet.status === 'won' ? 'rgba(34, 197, 94, 0.1)' : bet.status === 'lost' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(255,255,255,0.1)',
                            color: statusColor,
                            padding: '2px 8px', borderRadius: '4px'
                        }}>
                            {bet.status === 'pending' ? (isParlay ? 'Parlay' : 'Single') : bet.status}
                        </span>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            {new Date(bet.placedAt).toLocaleDateString()}
                        </span>
                    </div>

                    <div style={{ fontWeight: 600, fontSize: '14px', lineHeight: '1.4', marginBottom: '4px', color: '#fff' }}>
                        {isParlay ? `${bet.legs.length}-Leg Parlay Ticket` : bet.eventTitle}
                    </div>

                    {!isParlay && (
                        <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                            Pick: <span style={{ color: '#fff' }}>{bet.outcomeLabel}</span>
                        </div>
                    )}
                </div>

                <div style={{ paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Wager</div>
                        <div style={{ fontWeight: 'bold', fontSize: '14px' }}>${bet.amount.toFixed(0)}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{bet.status === 'won' ? 'P.L' : 'Payout'}</div>
                        <div style={{ fontWeight: 'bold', fontSize: '14px', color: bet.status === 'won' ? '#22c55e' : bet.status === 'lost' ? '#ef4444' : '#eab308' }}>
                            {bet.status === 'won' ? `+$${(bet.potentialPayout - bet.amount).toFixed(0)}` : `$${bet.potentialPayout.toFixed(0)}`}
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    // --- HISTORY FILTERS & CHART DATA ---
    const getFilteredHistory = () => {
        const now = Date.now();
        let cutoff = 0;
        if (historyFrame === '24h') cutoff = now - 24 * 60 * 60 * 1000;
        if (historyFrame === '7d') cutoff = now - 7 * 24 * 60 * 60 * 1000;
        if (historyFrame === '30d') cutoff = now - 30 * 24 * 60 * 60 * 1000;

        return completedBets.filter(b => {
            // Use resolvedAt if available, else placedAt
            const time = b.resolvedAt ? new Date(b.resolvedAt).getTime() : new Date(b.placedAt).getTime();
            return time >= cutoff;
        });
    };

    const filteredBets = getFilteredHistory();



    return (
        <div className="container animate-fade">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px', marginBottom: '24px' }}>
                <h1 style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: 0 }}>
                    <Wallet className="text-primary" size={32} />
                    Portfolio
                </h1>
                <button
                    onClick={() => setShowIdeaModal(true)}
                    className="btn"
                    style={{
                        background: 'linear-gradient(90deg, rgba(39, 39, 42, 1) 0%, rgba(34,197,94,0.1) 100%)',
                        border: '1px solid var(--primary)',
                        color: 'var(--primary)',
                        fontSize: '11px',
                        fontWeight: '800',
                        padding: '4px 10px',
                        width: 'auto',
                        height: 'auto',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        boxShadow: '0 0 10px rgba(34, 197, 94, 0.2)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px'
                    }}
                >
                    <span style={{ fontSize: '16px' }}>💡</span>
                    <span>Bet Idea</span>
                </button>
            </div>

            {/* --- TOP SECTION: WALLET & STATS --- */}
            <div style={{ display: 'grid', gap: '16px', marginBottom: '32px' }}>

                {/* 1. Main Wallet Card */}
                <div className="card" style={{
                    padding: '24px',
                    background: 'linear-gradient(145deg, var(--bg-card) 0%, rgba(34,197,94,0.05) 100%)',
                    border: '1px solid rgba(34, 197, 94, 0.2)'
                }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

                        {/* Balance */}
                        <div style={{ textAlign: 'center', width: '100%' }}>
                            <div className="text-sm" style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', opacity: 0.8 }}>
                                Available Balance
                            </div>
                            <div style={{ fontSize: '48px', fontWeight: '900', color: '#fff', letterSpacing: '-1.5px', lineHeight: '1' }}>
                                ${user.balance.toFixed(2)}
                            </div>
                        </div>

                        {/* Net Worth & Active Details */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '16px', textAlign: 'center' }}>
                                <div className="text-sm" style={{ marginBottom: '6px', color: 'var(--text-muted)' }}>Net Worth</div>
                                <div style={{ fontSize: '22px', fontWeight: 'bold', color: 'var(--primary)' }}>
                                    ${netWorth.toFixed(2)}
                                </div>
                            </div>
                            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '16px', textAlign: 'center' }}>
                                <div className="text-sm" style={{ marginBottom: '6px', color: 'var(--text-muted)' }}>Active Bets</div>
                                <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#fbbf24' }}>
                                    ${(user.invested || 0).toFixed(2)}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 2. Performance Stats Grid */}
                {/* 2. Performance Stats Grid */}
                {/* 2. Stats & Tabs */}
                <div style={{ marginBottom: '16px' }}>
                    {/* Tab Switcher */}
                    <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-card)', padding: '4px', borderRadius: '12px', border: '1px solid var(--border)', width: 'fit-content', marginBottom: '16px' }}>
                        <button
                            onClick={() => setPortfolioTab('bets')}
                            style={{
                                padding: '6px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', border: 'none', cursor: 'pointer',
                                background: portfolioTab === 'bets' ? 'var(--primary)' : 'transparent',
                                color: portfolioTab === 'bets' ? '#000' : 'var(--text-muted)'
                            }}
                        >
                            Sports Bets
                        </button>
                        <button
                            onClick={() => setPortfolioTab('arena')}
                            style={{
                                padding: '6px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', border: 'none', cursor: 'pointer',
                                background: portfolioTab === 'arena' ? 'var(--primary)' : 'transparent',
                                color: portfolioTab === 'arena' ? '#000' : 'var(--text-muted)'
                            }}
                        >
                            Arena
                        </button>
                    </div>

                    {/* Stats Grid */}
                    {portfolioTab === 'bets' ? (
                        <div className="animate-fade" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px' }}>
                            {/* Win Rate */}
                            <div className="card" style={{ padding: '16px', textAlign: 'center', marginBottom: 0 }}>
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px', fontWeight: 'bold' }}>
                                    Win Rate
                                </div>
                                <div style={{ fontSize: '20px', fontWeight: '900', color: 'var(--primary)' }}>
                                    {winRate}%
                                </div>
                            </div>
                            {/* Streak */}
                            <div className="card" style={{ padding: '16px', textAlign: 'center', marginBottom: 0 }}>
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px', fontWeight: 'bold' }}>
                                    Streak
                                </div>
                                <div style={{ fontSize: '20px', fontWeight: '900', color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                                    <span style={{ fontSize: '16px' }}>🔥</span> {user.longestStreak || 0}
                                </div>
                            </div>
                            {/* Biggest Win */}
                            <div className="card" style={{ padding: '16px', textAlign: 'center', marginBottom: 0 }}>
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px', fontWeight: 'bold' }}>
                                    Best Win
                                </div>
                                <div style={{ fontSize: '20px', fontWeight: '900', color: '#22c55e' }}>
                                    ${biggestWin.toFixed(0)}
                                </div>
                            </div>
                            {/* Profit */}
                            <div className="card" style={{ padding: '16px', textAlign: 'center', marginBottom: 0 }}>
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px', fontWeight: 'bold' }}>
                                    Profit
                                </div>
                                <div style={{ fontSize: '20px', fontWeight: '900', color: totalNetProfit >= 0 ? '#22c55e' : '#ef4444' }}>
                                    {totalNetProfit >= 0 ? '+' : ''}${totalNetProfit.toFixed(0)}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="animate-fade" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px' }}>
                            {/* Arena Stats */}
                            <div className="card" style={{ padding: '16px', textAlign: 'center', marginBottom: 0 }}>
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px', fontWeight: 'bold' }}>
                                    Duels
                                </div>
                                <div style={{ fontSize: '20px', fontWeight: '900', color: '#fff' }}>
                                    {loadingArena ? '...' : arenaStats.duels}
                                </div>
                            </div>
                            <div className="card" style={{ padding: '16px', textAlign: 'center', marginBottom: 0 }}>
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px', fontWeight: 'bold' }}>
                                    Best Win
                                </div>
                                <div style={{ fontSize: '20px', fontWeight: '900', color: '#22c55e' }}>
                                    ${loadingArena ? '...' : arenaStats.biggestWin.toFixed(2)}
                                </div>
                            </div>
                            <div className="card" style={{ padding: '16px', textAlign: 'center', marginBottom: 0 }}>
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px', fontWeight: 'bold' }}>
                                    Win Rate
                                </div>
                                <div style={{ fontSize: '20px', fontWeight: '900', color: '#eab308' }}>
                                    {loadingArena ? '...' : arenaStats.winRate}%
                                </div>
                            </div>
                            <div className="card" style={{ padding: '16px', textAlign: 'center', marginBottom: 0 }}>
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px', fontWeight: 'bold' }}>
                                    Net Profit
                                </div>
                                <div style={{ fontSize: '20px', fontWeight: '900', color: arenaStats.netProfit >= 0 ? '#22c55e' : '#ef4444' }}>
                                    {loadingArena ? '...' : (arenaStats.netProfit >= 0 ? '+' : '-') + '$' + Math.abs(arenaStats.netProfit).toFixed(2)}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* --- MIDDLE SECTION: OPEN BETS --- */}
            {/* --- MIDDLE SECTION: OPEN BETS (Collapsible) --- */}
            {/* Time Filters - Moved Above Active Bets */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', overflowX: 'auto', paddingBottom: '4px' }}>
                {['24h', '7d', '30d'].map(frame => (
                    <button
                        key={frame}
                        onClick={() => setHistoryFrame(frame)}
                        style={{
                            padding: '6px 12px',
                            borderRadius: '20px',
                            border: '1px solid',
                            borderColor: historyFrame === frame ? 'var(--primary)' : 'rgba(255,255,255,0.1)',
                            background: historyFrame === frame ? 'rgba(34, 197, 94, 0.1)' : 'transparent',
                            color: historyFrame === frame ? 'var(--primary)' : 'var(--text-muted)',
                            fontSize: '12px',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                        }}
                    >
                        {frame.toUpperCase()}
                    </button>
                ))}
            </div>

            <div style={{ marginBottom: '16px' }}>
                <div
                    onClick={() => setShowActiveBets(!showActiveBets)}
                    style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        cursor: 'pointer',
                        padding: '12px 16px',
                        background: 'var(--bg-card)',
                        borderRadius: showActiveBets ? '12px 12px 0 0' : '12px',
                        border: '1px solid var(--border)',
                        marginBottom: showActiveBets ? '0' : '16px',
                        transition: 'all 0.2s'
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <AlertCircle size={20} className="text-primary" />
                        <h2 style={{ fontSize: '16px', margin: 0 }}>Active Bets</h2>
                        <span style={{ fontSize: '12px', background: 'rgba(255,255,255,0.1)', padding: '2px 8px', borderRadius: '12px', color: 'var(--text-muted)' }}>
                            {activeBets.length}
                        </span>
                    </div>
                    {showActiveBets ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </div>

                {showActiveBets && (
                    <div className="animate-fade" style={{
                        background: 'rgba(0,0,0,0.2)',
                        border: '1px solid var(--border)',
                        borderTop: 'none',
                        borderRadius: '0 0 12px 12px',
                        padding: '16px'
                    }}>
                        {activeBets.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '24px 0' }}>
                                <p style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '14px' }}>No active bets.</p>
                                <button onClick={() => router.push('/')} className="btn btn-primary" style={{ width: 'auto', margin: '12px auto 0', padding: '6px 16px', fontSize: '12px' }}>
                                    Browse Lines
                                </button>
                            </div>
                        ) : (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
                                {activeBets.map(bet => <BetCard key={bet.id} bet={bet} />)}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* --- BOTTOM SECTION: SETTLED HISTORY --- */}
            <div style={{ marginBottom: '32px' }}>
                {/* Time Filters - Moved Above */}


                <div
                    onClick={() => setShowSettledBets(!showSettledBets)}
                    style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        cursor: 'pointer',
                        padding: '12px 16px',
                        background: 'var(--bg-card)',
                        borderRadius: showSettledBets ? '12px 12px 0 0' : '12px',
                        border: '1px solid var(--border)',
                        marginBottom: showSettledBets ? '0' : '16px',
                        transition: 'all 0.2s'
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <History size={20} className="text-muted" />
                        <h2 style={{ fontSize: '16px', margin: 0, color: 'var(--text-muted)' }}>Settled History</h2>
                        <span style={{ fontSize: '12px', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: '12px', color: 'var(--text-muted)' }}>
                            {completedBets.length}
                        </span>
                    </div>
                    {showSettledBets ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </div>

                {showSettledBets && (
                    <div className="animate-fade" style={{
                        background: 'rgba(0,0,0,0.2)',
                        border: '1px solid var(--border)',
                        borderTop: 'none',
                        borderRadius: '0 0 12px 12px',
                        padding: '16px'
                    }}>
                        {filteredBets.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '14px' }}>
                                No settled bets in this period.
                            </div>
                        ) : (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '8px' }}>
                                {filteredBets.map(bet => <BetCard key={bet.id} bet={bet} />)}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* --- BALANCE CHART --- */}
            <BalanceChart
                historyFrame={historyFrame}
                allBets={bets}
                casinoBets={casinoBets}
                currentNetWorth={netWorth}
            />


            {/* --- BET IDEA MODAL --- */}
            {showIdeaModal && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
                    background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(5px)', zIndex: 9999,
                    display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px'
                }} onClick={() => setShowIdeaModal(false)}>
                    <div
                        className="animate-fade"
                        onClick={e => e.stopPropagation()}
                        style={{
                            width: '100%',
                            maxWidth: '360px',
                            background: '#09090b',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '24px',
                            padding: '32px',
                            position: 'relative',
                            boxShadow: '0 0 40px rgba(0,0,0,0.5), 0 0 100px rgba(34, 197, 94, 0.1)',
                            overflow: 'hidden'
                        }}
                    >
                        {/* Decorative Gradient Top */}
                        <div style={{
                            position: 'absolute', top: 0, left: 0, right: 0, height: '6px',
                            background: 'linear-gradient(90deg, #22c55e, #16a34a, #22c55e)',
                            boxShadow: '0 0 15px rgba(34, 197, 94, 0.5)'
                        }} />

                        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                            <div style={{
                                width: '70px', height: '70px', margin: '0 auto 16px',
                                background: 'rgba(34, 197, 94, 0.15)', borderRadius: '50%',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                border: '1px solid rgba(34, 197, 94, 0.3)',
                                boxShadow: '0 0 20px rgba(34, 197, 94, 0.2)'
                            }}>
                                <span style={{ fontSize: '32px', filter: 'drop-shadow(0 0 5px rgba(34, 197, 94, 0.5))' }}>💡</span>
                            </div>
                            <h2 style={{ fontSize: '24px', fontWeight: '800', color: '#fff', marginBottom: '8px', letterSpacing: '-0.5px' }}>
                                Spark a Bet Idea
                            </h2>
                            <p style={{ color: '#a1a1aa', fontSize: '14px', lineHeight: '1.5', marginBottom: '8px' }}>
                                Valid ideas earn approval.<br />
                                <span style={{ color: '#22c55e', fontWeight: 'bold' }}>Earn $15.00</span> per submission.
                            </p>
                            <div style={{
                                display: 'inline-block',
                                padding: '4px 12px',
                                background: 'rgba(255,255,255,0.05)',
                                borderRadius: '12px',
                                fontSize: '12px',
                                color: '#a1a1aa',
                                border: '1px solid rgba(255,255,255,0.1)'
                            }}>
                                Daily Limit: <span style={{ color: '#fff', fontWeight: 'bold' }}>
                                    {(() => {
                                        const today = new Date().toDateString();
                                        const count = (user?.submissionData?.date === today) ? (user.submissionData.count || 0) : 0;
                                        return count;
                                    })()}/5
                                </span>
                            </div>
                        </div>

                        <form onSubmit={handleIdeaSubmit}>
                            <div style={{ marginBottom: '20px', position: 'relative' }}>
                                <textarea
                                    className="input"
                                    placeholder="e.g. Will users hit 10k by Friday?"
                                    rows={4}
                                    value={ideaText}
                                    onChange={e => setIdeaText(e.target.value)}
                                    style={{
                                        width: '100%',
                                        background: 'rgba(255,255,255,0.03)',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        borderRadius: '16px',
                                        padding: '16px',
                                        color: '#fff',
                                        fontSize: '15px',
                                        marginBottom: '0',
                                        resize: 'none',
                                        outline: 'none',
                                        transition: 'all 0.2s',
                                        boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.2)'
                                    }}
                                    onFocus={(e) => {
                                        e.target.style.borderColor = '#22c55e';
                                        e.target.style.background = 'rgba(255,255,255,0.05)';
                                        e.target.style.boxShadow = '0 0 0 2px rgba(34, 197, 94, 0.2)';
                                    }}
                                    onBlur={(e) => {
                                        e.target.style.borderColor = 'rgba(255,255,255,0.1)';
                                        e.target.style.background = 'rgba(255,255,255,0.03)';
                                        e.target.style.boxShadow = 'none';
                                    }}
                                />
                                <div style={{
                                    position: 'absolute', bottom: '12px', right: '12px',
                                    fontSize: '11px', color: '#52525b', fontWeight: 'bold'
                                }}>
                                    {ideaText.length}/100
                                </div>
                            </div>

                            {ideaStatus.message && (
                                <div className="animate-fade" style={{
                                    padding: '12px',
                                    background: ideaStatus.success ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                    border: `1px solid ${ideaStatus.success ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
                                    borderRadius: '12px',
                                    marginBottom: '20px',
                                    display: 'flex', alignItems: 'center', gap: '10px'
                                }}>
                                    <span style={{ fontSize: '18px' }}>{ideaStatus.success ? '✅' : '⚠️'}</span>
                                    <p style={{
                                        color: ideaStatus.success ? '#4ade80' : '#f87171',
                                        fontSize: '13px',
                                        fontWeight: '600',
                                        margin: 0
                                    }}>
                                        {ideaStatus.message}
                                    </p>
                                </div>
                            )}

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                <button type="button" className="btn btn-outline" onClick={() => setShowIdeaModal(false)}>Cancel</button>
                                <button
                                    type="submit"
                                    style={{
                                        background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                                        border: 'none',
                                        color: '#000',
                                        borderRadius: '12px',
                                        padding: '14px',
                                        fontSize: '14px',
                                        fontWeight: '800',
                                        cursor: 'pointer',
                                        boxShadow: '0 4px 15px rgba(34, 197, 94, 0.3)',
                                        transition: 'transform 0.1s',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.5px'
                                    }}
                                    onMouseDown={e => e.target.style.transform = 'scale(0.98)'}
                                    onMouseUp={e => e.target.style.transform = 'scale(1)'}
                                >
                                    Submit
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* --- BET DETAILS MODAL --- */}
            {
                expandedBet && (
                    <div style={{
                        position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
                        background: 'rgba(0,0,0,0.85)', zIndex: 1100,
                        display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px'
                    }} onClick={() => setExpandedBet(null)}>
                        <div className="card animate-fade" style={{ width: '100%', maxWidth: '400px', border: '1px solid var(--border)', maxHeight: '80vh', overflowY: 'auto', background: '#09090b', position: 'relative' }} onClick={e => e.stopPropagation()}>
                            <button
                                onClick={() => setExpandedBet(null)}
                                style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', color: '#666', cursor: 'pointer' }}
                            >
                                <ArrowDownRight size={24} style={{ transform: 'rotate(225deg)' }} /> {/* Close Iconish */}
                            </button>

                            <div style={{ paddingBottom: '16px', marginBottom: '16px', borderBottom: '1px solid var(--border)' }}>
                                <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#eab308', textTransform: 'uppercase', marginBottom: '4px', letterSpacing: '1px' }}>
                                    Active Wager
                                </div>
                                <h3 style={{ fontSize: '20px', margin: 0, color: '#fff' }}>
                                    {expandedBet.type === 'parlay' ? 'Parlay Ticket' : 'Single Bet'}
                                </h3>
                            </div>

                            {/* Event Details */}
                            <div style={{ marginBottom: '24px' }}>
                                {!expandedBet.type === 'parlay' && (
                                    <>
                                        <div style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '4px' }}>Event</div>
                                        <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#fff', marginBottom: '8px' }}>
                                            {expandedBet.eventTitle}
                                        </div>
                                    </>
                                )}

                                {expandedBet.type === 'parlay' ? (
                                    <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '12px', overflow: 'hidden' }}>
                                        <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Legs ({expandedBet.legs.length})</span>
                                            <span style={{ fontSize: '12px', color: 'var(--primary)' }}>Combined Odds: {expandedBet.odds.toFixed(2)}x</span>
                                        </div>
                                        <div style={{ padding: '8px' }}>
                                            {expandedBet.legs.map((leg, idx) => (
                                                <div key={idx} style={{ padding: '12px', borderRadius: '8px', marginBottom: '4px', background: idx % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent' }}>
                                                    <div style={{ fontSize: '13px', fontWeight: '500', color: '#e4e4e7', marginBottom: '4px' }}>
                                                        {leg.eventTitle}
                                                    </div>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Pick</span>
                                                        <span style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--primary)' }}>{leg.label}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    <div style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '12px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                            <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Selection</span>
                                            <span style={{ fontWeight: 'bold', color: 'var(--primary)', fontSize: '14px' }}>{expandedBet.outcomeLabel}</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Odds</span>
                                            <span style={{ fontWeight: 'bold', color: '#fff', fontSize: '14px' }}>{expandedBet.odds.toFixed(2)}x</span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Financials */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                <div style={{ background: 'var(--bg-input)', padding: '16px', borderRadius: '12px', textAlign: 'center' }}>
                                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Risk Amount</div>
                                    <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#fff' }}>${expandedBet.amount.toFixed(2)}</div>
                                </div>
                                <div style={{ background: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.2)', padding: '16px', borderRadius: '12px', textAlign: 'center' }}>
                                    <div style={{ fontSize: '11px', color: '#22c55e', textTransform: 'uppercase', marginBottom: '4px' }}>Potential Payout</div>
                                    <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#22c55e' }}>${expandedBet.potentialPayout.toFixed(2)}</div>
                                </div>
                            </div>

                            {/* <div style={{ marginTop: '24px', textAlign: 'center', fontSize: '12px', color: 'var(--text-muted)' }}>
                                Bet ID: <span style={{ fontFamily: 'monospace' }}>{expandedBet.id}</span>
                            </div> */}
                        </div>
                    </div>
                )
            }
        </div>
    );
}
