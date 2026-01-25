"use client";
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '../../lib/store';

export default function Leaderboard() {
    const { user, users, isLoaded } = useApp();
    const router = useRouter();

    useEffect(() => {
        if (isLoaded && !user) router.push('/');
    }, [user, isLoaded, router]);

    // Filter out admins and sort by balance (redundant sort but safe), then take Top 20
    // users is already sorted in store.js, but we filter here.
    // calculating Total, sorting, slicing
    const activePlayers = users
        ? users.filter(u => u.role !== 'admin')
            .sort((a, b) => ((b.balance + (b.invested || 0)) - (a.balance + (a.invested || 0))))
            .slice(0, 20)
        : [];

    return (
        <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
            <h1 className="text-2xl font-bold mb-6">Leaderboard</h1>

            {activePlayers.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', background: 'var(--bg-card)', borderRadius: '12px' }}>
                    <p style={{ color: 'var(--text-secondary)' }}>No active players found on the leaderboard yet.</p>
                    <p style={{ marginTop: '10px', fontSize: '0.8em', color: '#666' }}>
                        (Admins are hidden. Create a normal user account to see it here.)
                    </p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {activePlayers.map((player, index) => (
                        <div key={player.id} className="card" style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '16px 24px',
                            borderLeft: index < 3 ? `4px solid ${index === 0 ? '#FFD700' : index === 1 ? '#C0C0C0' : '#CD7F32'}` : '4px solid transparent'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                <span style={{
                                    fontSize: '1.2em',
                                    fontWeight: 'bold',
                                    color: index < 3 ? 'var(--primary)' : 'var(--text-secondary)',
                                    width: '30px'
                                }}>
                                    #{index + 1}
                                </span>
                                {player.profilePic ? (
                                    <img
                                        src={player.profilePic}
                                        alt={player.username}
                                        style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--border)' }}
                                    />
                                ) : (
                                    <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--bg-card)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666', fontSize: '12px' }}>
                                        {player.username.charAt(0).toUpperCase()}
                                    </div>
                                )}
                                <div>
                                    <p style={{ fontWeight: '600', fontSize: '1.1em' }}>{player.username}</p>
                                    <p style={{ fontSize: '0.8em', color: 'var(--text-secondary)' }}>
                                        {player.badges?.includes('ver') && 'Verified'} Player
                                    </p>
                                </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <p style={{ fontWeight: 'bold', color: '#4ade80', fontSize: '1.1em' }}>
                                    ${((player.balance || 0) + (player.invested || 0)).toFixed(2)}
                                </p>
                                {(player.invested > 0) && (
                                    <span style={{ fontSize: '10px', color: '#a1a1aa' }}>
                                        (${player.invested.toFixed(2)} in play)
                                    </span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
