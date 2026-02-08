"use client";
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '../../lib/store';

export default function MyBets() {
    const { user, bets, events } = useApp();
    const router = useRouter();

    useEffect(() => {
        if (!user) {
            router.push('/');
        }
    }, [user, router]);

    // If used directly via URL without login
    if (!user) return null;

    const myBets = bets.filter(b => b.userId === user.id).sort((a, b) => new Date(b.placedAt) - new Date(a.placedAt));

    const activeBets = myBets.filter(b => b.status === 'pending');
    const completedBets = myBets.filter(b => b.status !== 'pending');
    const wonBets = myBets.filter(b => b.status === 'won');

    // Stats Calculations
    const winRate = completedBets.length > 0
        ? ((wonBets.length / completedBets.length) * 100).toFixed(1)
        : '0.0';

    const biggestWin = wonBets.length > 0
        ? Math.max(...wonBets.map(b => b.potentialPayout - b.amount))
        : 0;

    // Calculate total net profit across all bets
    const totalNetProfit = completedBets.reduce((acc, bet) => {
        const profit = bet.status === 'won' ? (bet.potentialPayout - bet.amount) : -bet.amount;
        return acc + profit;
    }, 0);

    const categoryStats = {};
    completedBets.forEach(bet => {
        const ev = events.find(e => e.id === bet.eventId);
        const cat = ev?.category || 'Archived/Unknown';
        if (!categoryStats[cat]) categoryStats[cat] = 0;
        const profit = bet.status === 'won' ? (bet.potentialPayout - bet.amount) : -bet.amount;
        categoryStats[cat] += profit;
    });

    const BetCard = ({ bet }) => {
        let statusColor = '#eab308'; // pending
        if (bet.status === 'won') statusColor = '#22c55e';
        if (bet.status === 'lost') statusColor = '#ef4444';

        const isParlay = bet.type === 'parlay';

        return (
            <div className="card" style={{
                borderTop: `3px solid ${statusColor}`,
                padding: '12px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                height: '100%',
                fontSize: '12px',
                background: 'var(--bg-card)'
            }}>
                <div style={{ marginBottom: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <span style={{ fontWeight: 700, color: statusColor, fontSize: '10px', textTransform: 'uppercase' }}>{bet.status}</span>
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{new Date(bet.placedAt).toLocaleDateString()}</span>
                    </div>

                    <div style={{ fontWeight: 600, fontSize: '13px', lineHeight: '1.3', marginBottom: '8px', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', minHeight: '34px' }}>
                        {isParlay ? 'Parlay Ticket' : bet.eventTitle}
                    </div>

                    {isParlay ? (
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            {bet.legs.length} Legs
                        </div>
                    ) : (
                        <div style={{ fontSize: '12px' }}>
                            <span style={{ color: 'var(--text-muted)' }}>Pick:</span> <span style={{ fontWeight: 'bold', color: '#fff', marginLeft: '4px' }}>{bet.outcomeLabel}</span>
                        </div>
                    )}
                </div>

                <div style={{ paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Wager</div>
                        <div style={{ fontWeight: 'bold' }}>${bet.amount.toFixed(0)}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{bet.status === 'won' ? 'Won' : 'Payout'}</div>
                        <div style={{ fontWeight: 'bold', color: statusColor }}>${bet.potentialPayout.toFixed(0)}</div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="container animate-fade">
            <h1 style={{ marginTop: '20px', marginBottom: '20px' }}>My Bets</h1>

            {myBets.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: '40px' }}>
                    <p>No bets placed yet.</p>
                </div>
            ) : (
                <>
                    {/* --- STATS DASHBOARD --- */}
                    {myBets.length > 0 && (
                        <div style={{ marginBottom: '32px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '16px' }}>
                                <div className="card" style={{ textAlign: 'center', padding: '12px 4px' }}>
                                    <div style={{ fontSize: '11px', color: '#888', marginBottom: '4px', textTransform: 'uppercase' }}>Win Rate</div>
                                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: 'var(--primary)' }}>{winRate}%</div>
                                </div>
                                <div className="card" style={{ textAlign: 'center', padding: '12px 4px' }}>
                                    <div style={{ fontSize: '11px', color: '#888', marginBottom: '4px', textTransform: 'uppercase' }}>Longest Streak</div>
                                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#f59e0b' }}>
                                        🔥 {user.longestStreak || 0}
                                    </div>
                                </div>
                                <div className="card" style={{ textAlign: 'center', padding: '12px 4px' }}>
                                    <div style={{ fontSize: '11px', color: '#888', marginBottom: '4px', textTransform: 'uppercase' }}>Biggest Win</div>
                                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#22c55e' }}>${biggestWin.toFixed(0)}</div>
                                </div>
                                <div className="card" style={{ textAlign: 'center', padding: '12px 4px' }}>
                                    <div style={{ fontSize: '11px', color: '#888', marginBottom: '4px', textTransform: 'uppercase' }}>Net Profit</div>
                                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: totalNetProfit >= 0 ? '#22c55e' : '#ef4444' }}>
                                        {totalNetProfit >= 0 ? '+' : ''}${totalNetProfit.toFixed(0)}
                                    </div>
                                </div>
                            </div>

                            <div className="card" style={{ padding: '16px' }}>
                                <h3 style={{ fontSize: '14px', marginBottom: '12px', color: '#888', textTransform: 'uppercase', borderBottom: '1px solid #333', paddingBottom: '8px' }}>
                                    Performance by Category
                                </h3>
                                <div>
                                    {Object.entries(categoryStats).sort(([, a], [, b]) => b - a).map(([cat, profit]) => (
                                        <div key={cat} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', fontSize: '14px' }}>
                                            <span>{cat}</span>
                                            <span style={{ fontWeight: 'bold', color: profit >= 0 ? '#22c55e' : '#ef4444' }}>
                                                {profit >= 0 ? '+' : ''}${profit.toFixed(2)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Active Section */}
                    {activeBets.length > 0 && (
                        <div style={{ marginBottom: '32px' }}>
                            <h2 style={{ fontSize: '18px', marginBottom: '12px', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--primary)', boxShadow: '0 0 10px var(--primary)' }}></span>
                                Active Bets
                            </h2>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '12px' }}>
                                {activeBets.map(bet => <BetCard key={bet.id} bet={bet} />)}
                            </div>
                        </div>
                    )}

                    {/* Completed Section */}
                    {completedBets.length > 0 && (
                        <div style={{ opacity: 0.9 }}>
                            <h2 style={{ fontSize: '18px', marginBottom: '12px', color: 'var(--text-muted)' }}>History</h2>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '12px' }}>
                                {completedBets.map(bet => <BetCard key={bet.id} bet={bet} />)}
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
