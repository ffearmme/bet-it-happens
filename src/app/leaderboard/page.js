"use client";
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '../../lib/store';

export default function Leaderboard() {
    const { user, users } = useApp();
    const router = useRouter();

    useEffect(() => {
        if (!user) router.push('/');
    }, [user, router]);

    // Filter out admins and sort by balance
    const activePlayers = users
        .filter(u => u.role !== 'admin')
        .sort((a, b) => b.balance - a.balance);

    // If we don't have enough real users, we can keep some "Bot" clutter if desired, 
    // but for a persistent app, better to just show real users + maybe a few always-bottom bots.
    // For now, let's just show real users.

    const mockBots = [
        { id: 'b1', username: 'HouseBot', balance: 500000, isBot: true }
    ];

    // Combine Real Players + 1 House Bot (optional, nice for comparison)
    // Let's stick to ONLY REAL PLAYERS per request implied by "don't see others"
    // Actually, request says "I don't see others users", so let's show all registered non-admin users.

    return (
        <div className="container animate-fade">
            <h1 style={{ marginTop: '20px' }}>Leaderboard</h1>

            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                {activePlayers.length === 0 ? (
                    <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                        No active players yet.
                    </div>
                ) : (
                    activePlayers.map((u, index) => (
                        <div key={u.id} style={{
                            display: 'flex', alignItems: 'center', padding: '16px',
                            borderBottom: index !== activePlayers.length - 1 ? '1px solid var(--border)' : 'none',
                            background: u.id === user?.id ? 'rgba(34, 197, 94, 0.1)' : 'transparent',
                        }}>
                            <div style={{
                                width: '30px', fontWeight: 'bold',
                                color: index === 0 ? '#fbbf24' : index === 1 ? '#94a3b8' : index === 2 ? '#b45309' : 'var(--text-muted)'
                            }}>
                                #{index + 1}
                            </div>

                            <div style={{ marginRight: '12px' }}>
                                {u.profilePic ? (
                                    <img src={u.profilePic} style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover', display: 'block' }} alt="" />
                                ) : (
                                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--bg-input)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', color: 'var(--text-muted)' }}>
                                        {u.username.charAt(0).toUpperCase()}
                                    </div>
                                )}
                            </div>

                            <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 600 }}>{u.username}</div>
                            </div>

                            <div style={{ fontWeight: 700, color: '#fff' }}>
                                ${u.balance.toFixed(2)}
                            </div>
                        </div>
                    ))
                )}
            </div>

            <p className="text-sm" style={{ textAlign: 'center', marginTop: '20px', opacity: 0.5 }}>
                * Admins are hidden from rank.
            </p>
        </div>
    );
}
