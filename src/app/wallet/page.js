"use client";
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '../../lib/store';

export default function Wallet() {
    const { user, logout, submitIdea, isLoaded, ideas } = useApp();
    const router = useRouter();

    const [idea, setIdea] = useState('');
    const [msg, setMsg] = useState({ type: '', text: '' });

    useEffect(() => {
        if (isLoaded && !user) router.push('/');
    }, [user, isLoaded, router]);

    if (!isLoaded) return null; // or a spinner
    if (!user) return null;

    const handleSubmitIdea = (e) => {
        e.preventDefault();
        if (idea.length < 10) {
            setMsg({ type: 'error', text: 'Idea must be at least 10 characters.' });
            return;
        }

        const res = submitIdea(idea);
        if (res.success) {
            setMsg({ type: 'success', text: res.message });
            setIdea('');
            // Removed alert for better UX
        } else {
            setMsg({ type: 'error', text: res.error });
        }

        setTimeout(() => setMsg({ type: '', text: '' }), 3000);
    };

    return (
        <div className="container animate-fade">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px' }}>
                <h1>Wallet</h1>
                <button onClick={logout} className="btn btn-outline" style={{ width: 'auto', padding: '8px 16px', fontSize: '12px' }}>
                    Logout
                </button>
            </div>

            <div className="card" style={{ textAlign: 'center', padding: '40px 20px', background: 'linear-gradient(180deg, var(--bg-card) 0%, rgba(34,197,94,0.05) 100%)' }}>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Available to Bet</p>
                <div style={{ fontSize: '48px', fontWeight: 800, color: 'var(--primary)', margin: '5px 0 15px 0' }}>
                    ${user.balance.toFixed(2)}
                </div>

                <div style={{ background: 'rgba(255,255,255,0.05)', padding: '15px', borderRadius: '8px', display: 'inline-flex', flexDirection: 'column', gap: '5px', minWidth: '200px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                        <span style={{ color: 'var(--text-muted)' }}>In Active Bets:</span>
                        <span style={{ fontWeight: 'bold' }}>${(user.invested || 0).toFixed(2)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '5px', marginTop: '2px' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Total Net Worth:</span>
                        <span style={{ fontWeight: 'bold', color: '#fff' }}>${((user.balance || 0) + (user.invested || 0)).toFixed(2)}</span>
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--primary)', marginTop: '4px', fontStyle: 'italic' }}>
                        (This is your Leaderboard Score)
                    </div>
                </div>
            </div>

            {/* Earn Section */}
            <h2 style={{ marginTop: '24px' }}>Earn Credits</h2>
            <div className="card">
                <h3 style={{ fontSize: '18px' }}>Submit Bet Idea</h3>
                {(() => {
                    const DAILY_LIMIT = 5;
                    const today = new Date().toDateString();
                    const count = (user.submissionData && user.submissionData.date === today) ? user.submissionData.count : 0;
                    const remaining = Math.max(0, DAILY_LIMIT - count);

                    return (
                        <p className="text-sm" style={{ marginBottom: '12px' }}>
                            Got a good idea for a bet? Submit it to the admin! <br />
                            Reward: <span style={{ color: 'var(--primary)' }}>$15.00</span> per idea.
                            <span style={{ display: 'block', marginTop: '8px', fontSize: '12px', fontWeight: 'bold', color: remaining === 0 ? 'var(--accent-loss)' : 'var(--text-muted)' }}>
                                Submissions left today: {remaining}/{DAILY_LIMIT}
                            </span>
                        </p>
                    );
                })()}

                <form onSubmit={handleSubmitIdea}>
                    <textarea
                        className="input"
                        rows="3"
                        placeholder="e.g. Will it rain in London tomorrow?"
                        value={idea}
                        onChange={e => setIdea(e.target.value)}
                        style={{ resize: 'none', marginBottom: '12px', fontFamily: 'inherit' }}
                    />

                    {msg.text && (
                        <div style={{
                            padding: '10px',
                            borderRadius: '6px',
                            marginBottom: '12px',
                            background: msg.type === 'success' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                            border: `1px solid ${msg.type === 'success' ? 'var(--accent-win)' : 'var(--accent-loss)'}`
                        }}>
                            <p style={{
                                color: msg.type === 'success' ? 'var(--accent-win)' : 'var(--accent-loss)',
                                margin: 0,
                                fontSize: '14px',
                                fontWeight: '500'
                            }}>
                                {msg.text}
                            </p>
                        </div>
                    )}

                    <button className="btn btn-outline" style={{ borderColor: 'var(--primary)', color: 'var(--primary)' }}>
                        Submit & Earn
                    </button>
                </form>

                {/* List of user submitted ideas */}
                {ideas && ideas.filter(i => i.userId === user.id).length > 0 && (
                    <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
                        <h4 style={{ fontSize: '14px', marginBottom: '12px', color: 'var(--text-muted)' }}>Your Submitted Ideas</h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {ideas.filter(i => i.userId === user.id)
                                .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt)) // Recent first
                                .map(idea => (
                                    <div key={idea.id} style={{ background: 'var(--bg-input)', padding: '10px', borderRadius: '6px', fontSize: '12px', display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ fontStyle: 'italic', color: '#ccc' }}>"{idea.text}"</span>
                                        <span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>✓ Submitted</span>
                                    </div>
                                ))}
                        </div>
                    </div>
                )}
            </div>

            <div className="card">
                <h3>Transactions</h3>
                <p className="text-sm" style={{ padding: '20px 0', textAlign: 'center' }}>No recent transactions</p>
            </div>

            <div style={{ marginTop: '20px', padding: '20px', border: '1px dashed var(--accent-lock)', borderRadius: '12px', background: 'rgba(234, 179, 8, 0.1)' }}>
                <h3 style={{ color: 'var(--accent-lock)', marginBottom: '8px' }}>DISCLAIMER</h3>
                <p className="text-sm" style={{ color: '#fff' }}>
                    This application is for <strong>entertainment purposes only</strong>. The currency used in this app is entirely virtual and has no real-world value.
                </p>
            </div>
        </div >
    );
}
