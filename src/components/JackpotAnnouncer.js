"use client";
import { useState, useEffect } from 'react';
import { useApp } from '../lib/store';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { Trophy, Zap } from 'lucide-react';

export default function JackpotAnnouncer() {
    const { db } = useApp();
    const [jackpot, setJackpot] = useState(null);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (!db) return;

        // Listen for the latest jackpot
        const q = query(
            collection(db, 'jackpots'),
            orderBy('timestamp', 'desc'),
            limit(1)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            if (!snapshot.empty) {
                const data = snapshot.docs[0].data();
                // Filter: Recent (< 60s) AND Amount >= 300
                const now = Date.now();
                if (now - data.timestamp < 60000 && data.amount >= 300) {
                    setJackpot(data);
                    setVisible(true);

                    // Auto hide after 8 seconds
                    const timer = setTimeout(() => {
                        setVisible(false);
                    }, 8000);
                    return () => clearTimeout(timer);
                }
            }
        });

        return () => unsubscribe();
    }, [db]);

    if (!visible || !jackpot) return null;

    return (
        <div className="jackpot-banner" style={{
            position: 'fixed',
            top: '80px', // Below header
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 9999,
            width: '90%',
            maxWidth: '600px',
            background: 'linear-gradient(90deg, #fbbf24, #f59e0b, #fbbf24)',
            backgroundSize: '200% 100%',
            animation: 'shimmer 2s infinite linear, slideDown 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
            borderRadius: '50px',
            padding: '12px 24px',
            boxShadow: '0 10px 25px -5px rgba(245, 158, 11, 0.6), 0 0 20px rgba(251, 191, 36, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            color: '#000',
            fontWeight: 'bold',
            fontSize: '14px',
            pointerEvents: 'none' // Let clicks pass through if it covers something? Maybe better to allow clicking to close?
        }}>
            <style jsx>{`
                @keyframes slideDown {
                    from { transform: translate(-50%, -100%); opacity: 0; }
                    to { transform: translate(-50%, 0); opacity: 1; }
                }
                @keyframes shimmer {
                    0% { background-position: 100% 0; }
                    100% { background-position: -100% 0; }
                }
            `}</style>

            <div style={{
                background: '#fff',
                borderRadius: '50%',
                padding: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
            }}>
                <Trophy size={20} className="text-yellow-600" />
            </div>

            <div style={{ textAlign: 'center' }}>
                <div style={{ textTransform: 'uppercase', fontSize: '10px', fontWeight: '900', letterSpacing: '1px', opacity: 0.8 }}>
                    Casino Jackpot Alert
                </div>
                <div style={{ fontSize: '14px', whiteSpace: 'nowrap' }}>
                    <span style={{ fontWeight: '900' }}>{jackpot.username}</span> just won <span style={{ fontWeight: '900', fontSize: '16px' }}>${parseFloat(jackpot.amount).toFixed(2)}</span>
                    <span style={{ fontSize: '12px', opacity: 0.7, marginLeft: '4px' }}> on {jackpot.game.toUpperCase()}</span>
                </div>
            </div>

            <div style={{
                background: '#fff',
                borderRadius: '50%',
                padding: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
            }}>
                <Zap size={20} className="text-yellow-600" />
            </div>
        </div>
    );
}
