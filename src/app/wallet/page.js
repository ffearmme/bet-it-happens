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

    // Force re-render on day change (midnight)
    const [currentDateStr, setCurrentDateStr] = useState('');
    useEffect(() => {
        setCurrentDateStr(new Date().toDateString());
        const interval = setInterval(() => {
            const now = new Date().toDateString();
            if (now !== currentDateStr) {
                setCurrentDateStr(now);
            }
        }, 60000); // Check every minute
        return () => clearInterval(interval);
    }, [currentDateStr]);

    if (!isLoaded) return null; // or a spinner
    if (!user) return null;

    const handleSubmitIdea = async (e) => {
        e.preventDefault();
        if (idea.length < 10) {
            setMsg({ type: 'error', text: 'Idea must be at least 10 characters.' });
            return;
        }

        const res = await submitIdea(idea);
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

            {/* Referral Code Card */}
            <div className="card" style={{ marginBottom: '16px', border: '1px solid var(--primary)', background: 'linear-gradient(135deg, rgba(34,197,94,0.1) 0%, rgba(0,0,0,0) 100%)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                        <h4 style={{ fontSize: '18px', color: '#fff', margin: '0 0 4px 0' }}>Invite Friends</h4>
                        <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
                            Get <span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>$500</span> for every friend who joins!
                        </p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <div style={{
                            fontSize: '24px',
                            fontWeight: '900',
                            color: '#fff',
                            fontFamily: 'monospace',
                            letterSpacing: '2px',
                            background: 'rgba(0,0,0,0.3)',
                            padding: '4px 12px',
                            borderRadius: '8px',
                            border: '1px dashed var(--primary)'
                        }}>
                            {user.referralCode || '...'}
                        </div>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '8px', marginTop: '16px', alignItems: 'center' }}>
                    <button
                        className="btn btn-primary"
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', flex: 1 }}
                        onClick={() => {
                            const shareData = {
                                title: 'Bet It Happens',
                                text: `Join me on Bet It Happens! Use my code ${user.referralCode} to get started with $1000 free play money!`,
                                url: 'https://betithappens.com'
                            };
                            if (navigator.share) {
                                navigator.share(shareData).catch(console.error);
                            } else {
                                navigator.clipboard.writeText(`Join me on Bet It Happens! Use code ${user.referralCode} for $1000 start!`).then(() => alert('Copied to clipboard!'));
                            }
                        }}
                    >
                        <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" style={{ width: '18px', height: '18px' }}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
                        </svg>
                        Share Code
                    </button>
                    <button
                        className="btn"
                        style={{ width: 'auto', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.1)' }}
                        onClick={(e) => {
                            navigator.clipboard.writeText(user.referralCode).then(() => {
                                const originalText = e.currentTarget.innerText;
                                e.currentTarget.innerText = 'Copied!';
                                setTimeout(() => e.target.innerText = 'Copy', 2000);
                            });
                        }}
                    >
                        Copy
                    </button>
                </div>
                <p style={{ fontSize: '12px', color: '#71717a', marginTop: '12px', fontStyle: 'italic' }}>
                    Share your unique code. When they sign up using it, you instantly get paid.
                </p>
            </div>

            <div className="card">
                <h3 style={{ fontSize: '18px' }}>Submit Bet Idea</h3>
                {(() => {
                    const DAILY_LIMIT = 5;
                    // We use the state 'today' (which updates live) to ensure the UI flips at midnight 
                    // even if the user doesn't refresh the page.
                    const nowStr = new Date().toDateString();
                    const count = (user.submissionData && user.submissionData.date === nowStr) ? user.submissionData.count : 0;
                    const remaining = Math.max(0, DAILY_LIMIT - count);

                    return (
                        <p className="text-sm" style={{ marginBottom: '12px' }}>
                            Got a good idea for a bet? Submit it to the admin! <br />
                            Reward: <span style={{ color: 'var(--primary)' }}>$15.00</span> per idea.
                            <br />
                            <span style={{ fontSize: '10px', color: '#71717a' }}>Quota resets daily at midnight.</span>
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
