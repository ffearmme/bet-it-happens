"use client";
import { useEffect, useState } from 'react';
import { collection, query, orderBy, limit, onSnapshot, where } from 'firebase/firestore';
import { useApp } from '../lib/store';
import { Trophy } from 'lucide-react';

export default function BiggestWins({ game }) {
    const { db } = useApp();
    const [wins, setWins] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!db) return;

        // Query the 'jackpots' collection for verified big wins
        // This is safer and more performant than querying all casino_bets
        const q = query(
            collection(db, 'jackpots'),
            where('game', '==', game),
            orderBy('amount', 'desc'), // Assuming 'amount' in jackpots is the payout amount
            limit(3)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const winsData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setWins(winsData);
            setLoading(false);
        }, (err) => {
            console.error("Error fetching biggest wins:", err);
            // Fallback: If verifying jackpots fails, we might just show nothing or try casino_bets (but that risks index errors)
            setLoading(false);
        });

        return () => unsubscribe();
    }, [db, game]);

    if (loading) {
        return (
            <div style={{
                marginBottom: '24px',
                background: 'rgba(234, 179, 8, 0.1)',
                border: '1px solid rgba(234, 179, 8, 0.3)',
                borderRadius: '16px',
                padding: '16px',
                textAlign: 'center'
            }}>
                <span style={{ color: '#fbbf24', fontSize: '14px' }}>Loading Top Wins...</span>
            </div>
        );
    }

    if (wins.length === 0) {
        return (
            <div style={{
                marginBottom: '24px',
                background: 'rgba(234, 179, 8, 0.05)',
                border: '1px solid rgba(234, 179, 8, 0.2)',
                borderRadius: '16px',
                padding: '20px',
                textAlign: 'center'
            }}>
                <Trophy size={24} style={{ color: '#fbbf24', marginBottom: '8px' }} />
                <h3 style={{ fontSize: '14px', fontWeight: 'bold', textTransform: 'uppercase', color: '#fbbf24', margin: '0 0 4px 0' }}>Hall of Fame</h3>
                <p style={{ fontSize: '12px', color: '#fbbf24', opacity: 0.8 }}>No big wins recorded yet. Be the first!</p>
            </div>
        );
    }

    return (
        <div className="animate-fade" style={{
            marginBottom: '24px',
            background: 'linear-gradient(145deg, rgba(234, 179, 8, 0.1), rgba(0, 0, 0, 0.4))',
            border: '1px solid rgba(234, 179, 8, 0.3)',
            borderRadius: '16px',
            overflow: 'hidden',
            boxShadow: '0 4px 15px rgba(234, 179, 8, 0.1)'
        }}>
            <div style={{
                padding: '12px 16px',
                borderBottom: '1px solid rgba(234, 179, 8, 0.2)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: 'rgba(234, 179, 8, 0.1)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Trophy size={16} color="#fbbf24" />
                    <span style={{ fontSize: '12px', fontWeight: '900', textTransform: 'uppercase', color: '#fbbf24', letterSpacing: '1px' }}>
                        Biggest Wins
                    </span>
                </div>
            </div>

            <div style={{ padding: '8px 16px' }}>
                {wins.map((win, index) => (
                    <div key={win.id} style={{
                        padding: '10px 0',
                        borderBottom: index < wins.length - 1 ? '1px solid rgba(255, 255, 255, 0.05)' : 'none',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{
                                width: '20px',
                                height: '20px',
                                borderRadius: '50%',
                                background: index === 0 ? '#fbbf24' : index === 1 ? '#94a3b8' : '#b45309',
                                color: index === 0 ? '#000' : '#fff',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '10px',
                                fontWeight: 'bold'
                            }}>
                                {index + 1}
                            </div>
                            <div>
                                <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#fff' }}>
                                    {win.username}
                                </div>
                                <div style={{ fontSize: '10px', color: '#94a3b8' }}>
                                    {new Date(win.timestamp).toLocaleDateString()}
                                </div>
                            </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '14px', fontWeight: '900', color: '#fbbf24', textShadow: '0 0 10px rgba(234, 179, 8, 0.3)' }}>
                                ${win.amount.toLocaleString()}
                            </div>
                            <div style={{ fontSize: '10px', color: '#94a3b8' }}>
                                ({win.multiplier.toFixed(2)}x)
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
