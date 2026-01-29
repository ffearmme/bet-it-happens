"use client";
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '../../lib/store';

export default function Leaderboard() {
    const { user, users, isLoaded, getUserStats, getWeeklyLeaderboard } = useApp();
    const router = useRouter();

    const [viewingUser, setViewingUser] = useState(null);
    const [viewingProfile, setViewingProfile] = useState(null);
    const [tab, setTab] = useState('all');
    const [weeklyData, setWeeklyData] = useState([]);

    useEffect(() => {
        // if (isLoaded && !user) router.push('/'); // Allow guest view
    }, [user, isLoaded, router]);

    useEffect(() => {
        if (viewingUser) {
            setViewingProfile(null);
            getUserStats(viewingUser.id).then(res => {
                if (res.success) setViewingProfile(res);
            });
        }
    }, [viewingUser]);

    useEffect(() => {
        if (tab === 'weekly' && users) {
            getWeeklyLeaderboard().then(res => {
                if (res.success) {
                    const enriched = res.data.map(item => {
                        const u = users.find(u => u.id === item.userId);
                        // Filter out admins (Production Ready)
                        return (u && u.role !== 'admin') ? { ...u, profit: item.profit } : null;
                    }).filter(u => u);
                    setWeeklyData(enriched);
                } else {
                    console.error(res.error);
                }
            });
        }
    }, [tab, users]);

    const activePlayers = users
        ? users.filter(u => u.role !== 'admin')
            .sort((a, b) => ((b.balance + (b.invested || 0)) - (a.balance + (a.invested || 0))))
            .slice(0, 20)
        : [];

    const displayList = tab === 'all' ? activePlayers : weeklyData;

    return (
        <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }} className="animate-fade">
            <h1 className="text-2xl font-bold mb-6">Leaderboard</h1>

            <div style={{ display: 'flex', gap: '32px', borderBottom: '1px solid #27272a', marginBottom: '32px' }}>
                <button
                    onClick={() => setTab('all')}
                    style={{
                        paddingBottom: '12px',
                        background: 'none',
                        border: 'none',
                        borderBottom: tab === 'all' ? '2px solid var(--primary)' : '2px solid transparent',
                        color: tab === 'all' ? '#fff' : '#a1a1aa',
                        fontWeight: tab === 'all' ? '600' : '500',
                        fontSize: '15px',
                        cursor: 'pointer',
                        transition: 'color 0.2s, border-color 0.2s',
                        marginBottom: '-1px'
                    }}
                >
                    All Time
                </button>
                <button
                    onClick={() => setTab('weekly')}
                    style={{
                        paddingBottom: '12px',
                        background: 'none',
                        border: 'none',
                        borderBottom: tab === 'weekly' ? '2px solid var(--primary)' : '2px solid transparent',
                        color: tab === 'weekly' ? '#fff' : '#a1a1aa',
                        fontWeight: tab === 'weekly' ? '600' : '500',
                        fontSize: '15px',
                        cursor: 'pointer',
                        transition: 'color 0.2s, border-color 0.2s',
                        marginBottom: '-1px'
                    }}
                >
                    This Week
                </button>
            </div>

            {displayList.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', background: 'var(--bg-card)', borderRadius: '12px' }}>
                    <p style={{ color: 'var(--text-secondary)' }}>
                        {tab === 'all' ? 'No active players found.' : 'No bets settled this week yet.'}
                    </p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {displayList.map((player, index) => (
                        <div
                            key={player.id}
                            className="card"
                            onClick={() => {
                                if (user) setViewingUser(player);
                                else alert("Login to view player stats!"); // Simple prompt as requested
                            }}
                            style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '16px 24px',
                                borderLeft: index < 3 ? `4px solid ${index === 0 ? '#FFD700' : index === 1 ? '#C0C0C0' : '#CD7F32'}` : '4px solid transparent',
                                cursor: 'pointer',
                                transition: 'transform 0.1s'
                            }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                                <span style={{
                                    fontSize: '1em',
                                    fontWeight: 'bold',
                                    color: index < 3 ? 'var(--primary)' : 'var(--text-secondary)',
                                    width: '24px',
                                    flexShrink: 0
                                }}>
                                    #{index + 1}
                                </span>
                                {player.profilePic ? (
                                    <img
                                        src={player.profilePic}
                                        alt={player.username}
                                        style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--border)', flexShrink: 0 }}
                                    />
                                ) : (
                                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--bg-input)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666', fontSize: '10px', flexShrink: 0 }}>
                                        {player.username.charAt(0).toUpperCase()}
                                    </div>
                                )}
                                <div style={{ minWidth: 0 }}>
                                    <p style={{ fontWeight: '600', fontSize: '1em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{player.username}</p>
                                    <p style={{ fontSize: '0.7em', color: 'var(--text-secondary)' }}>
                                        {tab === 'all' ? 'Net Worth' : 'Weekly Profit'}
                                    </p>
                                </div>
                                {player.currentStreak > 1 && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '2px', marginLeft: '12px' }} title="Current Betting Streak">
                                        <span style={{ fontSize: '16px' }}>🔥</span>
                                        <span style={{ fontWeight: 'bold', color: '#f59e0b', fontSize: '14px' }}>{player.currentStreak}</span>
                                    </div>
                                )}
                            </div>
                            <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                                <p style={{ fontWeight: 'bold', color: tab === 'all' ? '#4ade80' : (player.profit >= 0 ? '#4ade80' : '#ef4444'), fontSize: '1.1em', margin: 0 }}>
                                    ${tab === 'all' ? ((player.balance || 0) + (player.invested || 0)).toFixed(2) : player.profit?.toFixed(2)}
                                </p>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                                    {player.lastBetPercent !== undefined && tab === 'all' && (
                                        <span style={{
                                            fontSize: '10px',
                                            fontWeight: 'bold',
                                            color: player.lastBetPercent >= 0 ? '#4ade80' : '#ef4444',
                                            background: player.lastBetPercent >= 0 ? 'rgba(74, 222, 128, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                            padding: '2px 6px',
                                            borderRadius: '4px',
                                            whiteSpace: 'nowrap'
                                        }}>
                                            {player.lastBetPercent > 0 ? '+' : ''}{player.lastBetPercent.toFixed(1)}%
                                        </span>
                                    )}
                                    {tab === 'all' && (player.invested > 0) && (
                                        <span style={{ fontSize: '10px', color: '#a1a1aa', whiteSpace: 'nowrap' }}>
                                            (${player.invested.toFixed(0)} active)
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* --- Public User Profile Modal --- */}
            {viewingUser && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
                    background: 'rgba(0,0,0,0.85)', zIndex: 1100,
                    display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px'
                }} onClick={() => setViewingUser(null)}>
                    <div className="card animate-fade" style={{ width: '100%', maxWidth: '350px', border: '1px solid var(--primary)', position: 'relative' }} onClick={e => e.stopPropagation()}>
                        <button
                            onClick={() => setViewingUser(null)}
                            style={{ position: 'absolute', top: '10px', right: '10px', background: 'none', border: 'none', color: '#fff', fontSize: '20px' }}
                        >
                            &times;
                        </button>

                        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                            <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'var(--bg-input)', margin: '0 auto 12px', overflow: 'hidden', border: '2px solid var(--primary)' }}>
                                {viewingProfile?.profile?.profilePic ? (
                                    <img src={viewingProfile.profile.profilePic} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                                ) : (
                                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px' }}>
                                        {(viewingProfile?.profile?.username || viewingUser.username || '?').charAt(0).toUpperCase()}
                                    </div>
                                )}
                            </div>
                            <h2 style={{ fontSize: '20px', marginBottom: '4px' }}>{viewingProfile?.profile?.username || viewingUser.username}</h2>
                            {viewingProfile?.profile?.bio && (
                                <p style={{ fontSize: '13px', color: '#a1a1aa', fontStyle: 'italic', margin: '0 0 16px 0' }}>
                                    "{viewingProfile.profile.bio}"
                                </p>
                            )}

                            {viewingProfile?.stats ? (
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '16px' }}>
                                    <div style={{ background: 'var(--bg-input)', padding: '12px', borderRadius: '8px' }}>
                                        <div className="text-sm">Win Rate</div>
                                        <div style={{ fontSize: '18px', fontWeight: 'bold', color: 'var(--primary)' }}>{viewingProfile.stats.winRate}%</div>
                                    </div>
                                    <div style={{ background: 'var(--bg-input)', padding: '12px', borderRadius: '8px' }}>
                                        <div className="text-sm">Profit</div>
                                        <div style={{ fontSize: '18px', fontWeight: 'bold', color: viewingProfile.stats.profit >= 0 ? 'var(--primary)' : 'var(--accent-loss)' }}>
                                            ${viewingProfile.stats.profit.toFixed(0)}
                                        </div>
                                    </div>
                                    <div style={{ gridColumn: '1 / -1', background: 'var(--bg-input)', padding: '12px', borderRadius: '8px' }}>
                                        <div className="text-sm">Total Bets</div>
                                        <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#fff' }}>{viewingProfile.stats.total}</div>
                                    </div>
                                </div>
                            ) : <p className="text-sm">Loading stats...</p>}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
