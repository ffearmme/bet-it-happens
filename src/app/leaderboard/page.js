"use client";
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '../../lib/store';
import { collection, query, limit, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../../lib/firebase';

export default function Leaderboard() {
    const { user } = useApp();
    const router = useRouter();
    const [users, setUsers] = useState([]);

    useEffect(() => {
        if (!user) router.push('/');
    }, [user, router]);

    // Fetch users ONLY when on this page
    useEffect(() => {
        // Query top 50 (removing orderBy for now to reliable fetch without specific index)
        const q = query(collection(db, 'users'), limit(50));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            console.log("DEBUG: Raw Firestore Docs Found:", snapshot.size);
            const list = snapshot.docs.map(doc => {
                const d = doc.data();
                console.log(`DEBUG DOC [${doc.id}]: role=${d.role}, balance=${d.balance}, username=${d.username}`);
                return { id: doc.id, ...d };
            });
            setUsers(list);
        }, (error) => {
            console.error("Leaderboard error:", error);
        });
        return () => unsubscribe();
    }, []);

    // Filter out admins and sort by balance (redundant sort but safe), then take Top 20
    const activePlayers = users
        .filter(u => u.role !== 'admin')
        .sort((a, b) => b.balance - a.balance)
        .slice(0, 20);

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
        <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
            <h1 className="text-2xl font-bold mb-6">Leaderboard</h1>

            {/* DEBUG DIAGNOSTICS REMOVED */}

            {activePlayers.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', background: 'var(--bg-card)', borderRadius: '12px' }}>
                    <p style={{ color: 'var(--text-secondary)' }}>No active players found on the leaderboard yet.</p>
                    <p style={{ marginTop: '10px', fontSize: '0.8em', color: '#666' }}>
                        (Admins are hidden. Create a normal user account to see it here.)
                    </p>

                    {/* SHOW RAW LIST IF EMPTY SO USER KNOWS DATA IS THERE */}
                    {users.length > 0 && (
                        <div style={{ marginTop: '20px', textAlign: 'left' }}>
                            <p>Raw Database Contents:</p>
                            <ul style={{ listStyle: 'disc', paddingLeft: '20px' }}>
                                {users.map(u => (
                                    <li key={u.id}>{u.username} ({u.role}) - ${u.balance}</li>
                                ))}
                            </ul>
                        </div>
                    )}
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
                                <div>
                                    <p style={{ fontWeight: '600', fontSize: '1.1em' }}>{player.username}</p>
                                    <p style={{ fontSize: '0.8em', color: 'var(--text-secondary)' }}>
                                        {player.badges?.includes('ver') && 'Verified'} Player
                                    </p>
                                </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <p style={{ fontWeight: 'bold', color: '#4ade80', fontSize: '1.1em' }}>
                                    ${typeof player.balance === 'number' ? player.balance.toFixed(2) : '0.00'}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            )}
            <p className="text-sm" style={{ textAlign: 'center', marginTop: '20px', opacity: 0.5 }}>
                * Admins are hidden from rank.
            </p>
        </div>
    );
}
