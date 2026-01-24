"use client";
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '../../lib/store';

export default function MyBets() {
    const { user, bets } = useApp();
    const router = useRouter();

    useEffect(() => {
        if (!user) {
            router.push('/');
        }
    }, [user, router]);

    // If used directly via URL without login
    if (!user) return null;

    const myBets = bets.filter(b => b.userId === user.id).sort((a, b) => new Date(b.placedAt) - new Date(a.placedAt));

    return (
        <div className="container animate-fade">
            <h1 style={{ marginTop: '20px' }}>My Bets</h1>

            {myBets.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: '40px' }}>
                    <p>No bets placed yet.</p>
                </div>
            ) : (
                myBets.map(bet => {
                    let statusColor = '#eab308'; // pending
                    if (bet.status === 'won') statusColor = '#22c55e';
                    if (bet.status === 'lost') statusColor = '#ef4444';

                    return (
                        <div key={bet.id} className="card" style={{ borderLeft: `4px solid ${statusColor}` }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                <span style={{ fontWeight: 600 }}>{bet.outcomeLabel}</span>
                                <span style={{ fontWeight: 700, color: statusColor }}>{bet.status.toUpperCase()}</span>
                            </div>
                            <p className="text-sm" style={{ marginBottom: '4px' }}>{bet.eventTitle}</p>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border)' }}>
                                <div style={{ fontSize: '14px' }}>
                                    <span className="text-sm">Wager:</span> ${bet.amount.toFixed(2)}
                                </div>
                                <div style={{ fontSize: '14px' }}>
                                    <span className="text-sm">Payout:</span> <span style={{ color: statusColor }}>${bet.potentialPayout.toFixed(2)}</span>
                                </div>
                            </div>
                        </div>
                    )
                })
            )}
        </div>
    );
}
