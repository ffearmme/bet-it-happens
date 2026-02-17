"use client";
import { useState, useEffect } from 'react';
import { useApp } from '../lib/store';
import { Swords, X, Check, DollarSign } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function ChallengeModal() {
    const { pendingChallenges, user } = useApp();
    const [viewedChallenges, setViewedChallenges] = useState(new Set());
    const [currentChallenge, setCurrentChallenge] = useState(null);
    const router = useRouter();

    useEffect(() => {
        if (!user || pendingChallenges.length === 0) {
            setCurrentChallenge(null);
            return;
        }

        // Find the newest challenge that hasn't been viewed in this session's "modal queue"
        // actually, we should show the newest one if it's not the one we just closed?
        // Let's keep it simple: Show the top one if we haven't explicitly dismissed it from state.

        const newest = pendingChallenges[0];

        // If we have a current challenge and it's still in the list, keep showing it (unless dismissed)
        // If we don't have one, or the list changed, check if we should show the new top one.

        if (!viewedChallenges.has(newest.id)) {
            setCurrentChallenge(newest);
        } else {
            setCurrentChallenge(null);
        }

    }, [pendingChallenges, user, viewedChallenges]);

    const handleDismiss = () => {
        if (currentChallenge) {
            setViewedChallenges(prev => new Set(prev).add(currentChallenge.id));
            setCurrentChallenge(null);
        }
    };

    const handleAccept = () => {
        if (currentChallenge) {
            router.push(`/arena/${currentChallenge.type}/${currentChallenge.id}`);
            handleDismiss(); // Close modal so they can see the page
        }
    };

    if (!currentChallenge) return null;

    return (
        <div style={{
            position: 'fixed',
            bottom: '80px', // Above navbar
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 9999,
            width: '90%',
            maxWidth: '400px',
            animation: 'slideUp 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
        }}>
            <style jsx>{`
                @keyframes slideUp {
                    from { transform: translate(-50%, 100%); opacity: 0; }
                    to { transform: translate(-50%, 0); opacity: 1; }
                }
            `}</style>

            <div style={{
                background: 'rgba(24, 24, 27, 0.95)',
                backdropFilter: 'blur(10px)',
                border: '1px solid #ec4899',
                borderRadius: '20px',
                padding: '16px',
                boxShadow: '0 10px 30px -5px rgba(236, 72, 153, 0.4)',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                            width: '40px', height: '40px', borderRadius: '12px',
                            background: 'linear-gradient(135deg, #f59e0b, #ec4899)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            boxShadow: '0 0 10px rgba(236, 72, 153, 0.3)'
                        }}>
                            <Swords size={20} color="#fff" />
                        </div>
                        <div>
                            <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#ec4899', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                Challenge Incoming!
                            </div>
                            <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#fff' }}>
                                {currentChallenge.creatorUsername}
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={handleDismiss}
                        style={{ background: 'transparent', border: 'none', color: '#a1a1aa', cursor: 'pointer' }}
                    >
                        <X size={20} />
                    </button>
                </div>

                <div style={{
                    background: 'rgba(255,255,255,0.05)', borderRadius: '12px', padding: '12px',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                }}>
                    <div style={{ fontSize: '13px', color: '#d4d4d8' }}>
                        <span style={{ textTransform: 'capitalize' }}>{currentChallenge.type === 'tictactoe' ? 'Tic Tac Toe' : currentChallenge.type}</span>
                        <span style={{ margin: '0 6px', opacity: 0.3 }}>|</span>
                        Best of {currentChallenge.config?.matchType || 1}
                    </div>
                    <div style={{ fontWeight: 'bold', color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <DollarSign size={14} />{currentChallenge.wager}
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                        onClick={handleDismiss}
                        style={{
                            flex: 1, padding: '10px', borderRadius: '10px',
                            background: 'transparent', border: '1px solid #3f3f46',
                            color: '#a1a1aa', fontWeight: 'bold', fontSize: '13px',
                            cursor: 'pointer'
                        }}
                    >
                        Later
                    </button>
                    <button
                        onClick={handleAccept}
                        style={{
                            flex: 1, padding: '10px', borderRadius: '10px',
                            background: '#ec4899', border: 'none',
                            color: '#fff', fontWeight: 'bold', fontSize: '13px',
                            cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
                        }}
                    >
                        <Swords size={16} /> Fight
                    </button>
                </div>
            </div>
        </div>
    );
}
