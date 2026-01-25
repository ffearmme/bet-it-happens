"use client";
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useApp } from '../lib/store';

const FUNNY_QUOTES = [
    "Loading luck...",
    "Consulting the betting oracle...",
    "Convincing your wallet to open...",
    "Calculating the odds of you winning...",
    "Shuffling virtual deck...",
    "Polishing the participation trophies..."
];

export default function Home() {
    const { user, events, placeBet, signup, signin, isLoaded } = useApp();
    const [selectedOutcome, setSelectedOutcome] = useState(null);
    const [wager, setWager] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [expandedEvent, setExpandedEvent] = useState(null);

    // Login State
    const [isLoginMode, setIsLoginMode] = useState(true); // Toggle Login/Signup
    const [email, setEmail] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [authError, setAuthError] = useState('');
    const [quote, setQuote] = useState(FUNNY_QUOTES[0]);

    useEffect(() => {
        setQuote(FUNNY_QUOTES[Math.floor(Math.random() * FUNNY_QUOTES.length)]);
    }, []);

    if (!isLoaded) {
        return (
            <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px', textAlign: 'center' }}>
                <div className="spinner" style={{ width: '40px', height: '40px', border: '4px solid var(--bg-card)', borderTop: '4px solid var(--primary)', borderRadius: '50%', marginBottom: '20px', animation: 'spin 1s linear infinite' }}></div>
                <p className="text-sm" style={{ fontStyle: 'italic' }}>"{quote}"</p>
                <style jsx>{`
                @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            `}</style>
            </div>
        );
    }

    // --- LOGIN SCREEN ---
    if (!user) {
        const handleAuth = async (e) => {
            e.preventDefault();
            setAuthError('');

            const getFriendlyError = (msg) => {
                if (msg.includes('user-not-found') || msg.includes('invalid-credential')) {
                    return "Whoops! We don't recognize that email. Did you mean to Sign Up?";
                } else if (msg.includes('wrong-password')) {
                    return "Incorrect password! Try 'password123'... just kidding, don't.";
                } else if (msg.includes('too-many-requests')) {
                    return "Slow down! You're trying too hard. Take a breather.";
                } else if (msg.includes('invalid-email')) {
                    return "You got to put in a valid email, silly!";
                } else if (msg.includes('email-already-in-use')) {
                    return "That email is taken! Try logging in instead.";
                } else if (msg.includes('missing-password')) {
                    return "You forgot to type a password! We can't read your mind... yet.";
                }
                return "Yikes! " + msg;
            };

            if (isLoginMode) {
                // Sign In
                const res = await signin(email, password);
                if (res.success) {
                    window.location.reload();
                } else {
                    setAuthError(getFriendlyError(res.error));
                }
            } else {
                // Sign Up
                if (!username) { setAuthError('Username required'); return; }
                const res = await signup(email, username, password);
                if (res.success) {
                    window.location.reload();
                } else {
                    setAuthError(getFriendlyError(res.error));
                }
            }
        };

        return (
            <div className="container animate-fade" style={{ height: '90vh', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <div style={{ textAlign: 'center', marginBottom: '40px' }}>
                    <h1 style={{ color: 'var(--primary)', fontSize: '42px', lineHeight: '1.1', marginBottom: '10px' }}>BET IT<br />HAPPENS</h1>
                    <p className="text-sm">The risk is fake. The thrill is real.</p>
                </div>

                <div className="card" style={{ padding: '24px' }}>
                    {/* Toggle Switch */}
                    <div style={{ display: 'flex', marginBottom: '20px', background: 'var(--bg-input)', borderRadius: '8px', padding: '4px' }}>
                        <button
                            style={{ flex: 1, padding: '8px', borderRadius: '6px', background: isLoginMode ? 'var(--bg-card)' : 'transparent', border: 'none', color: isLoginMode ? '#fff' : 'var(--text-muted)', fontWeight: isLoginMode ? 'bold' : 'normal', cursor: 'pointer' }}
                            onClick={() => { setIsLoginMode(true); setAuthError(''); }}
                        >
                            Sign In
                        </button>
                        <button
                            style={{ flex: 1, padding: '8px', borderRadius: '6px', background: !isLoginMode ? 'var(--bg-card)' : 'transparent', border: 'none', color: !isLoginMode ? '#fff' : 'var(--text-muted)', fontWeight: !isLoginMode ? 'bold' : 'normal', cursor: 'pointer' }}
                            onClick={() => { setIsLoginMode(false); setAuthError(''); }}
                        >
                            Sign Up
                        </button>
                    </div>

                    <form onSubmit={handleAuth} noValidate>
                        {!isLoginMode && (
                            <div className="input-group">
                                <label className="text-sm" style={{ marginBottom: '8px', display: 'block' }}>Username</label>
                                <input
                                    type="text"
                                    required
                                    className="input"
                                    placeholder="CoolUser123"
                                    value={username}
                                    onChange={e => setUsername(e.target.value)}
                                />
                            </div>
                        )}
                        <div className="input-group">
                            <label className="text-sm" style={{ marginBottom: '8px', display: 'block' }}>Email or Username</label>
                            <input
                                type="text"
                                required
                                className="input"
                                placeholder="you@example.com or CoolUser123"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                            />
                        </div>
                        <div className="input-group">
                            <label className="text-sm" style={{ marginBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
                                Password
                                <span style={{ fontSize: '10px', color: '#a1a1aa', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    🔒 Secure & Encrypted
                                </span>
                            </label>
                            <input
                                type="password"
                                required
                                className="input"
                                placeholder="••••••••"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                            />
                        </div>

                        {authError && <p style={{ color: 'var(--accent-loss)', marginBottom: '12px', fontSize: '14px', textAlign: 'center' }}>{authError}</p>}

                        <button className="btn btn-primary" style={{ marginTop: '10px' }}>
                            {isLoginMode ? 'Sign In' : 'Create Account'}
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    // --- MAIN APP (LOGGED IN) ---
    const activeEvents = events.filter(e => e.status === 'open' || e.status === 'locked');
    const finishedEvents = events.filter(e => e.status === 'settled');

    const handleBet = async () => {
        setError('');
        setSuccess('');
        if (!wager || parseFloat(wager) <= 0) {
            setError('Enter a valid amount');
            return;
        }
        const res = await placeBet(selectedOutcome.eventId, selectedOutcome.outcomeId, parseFloat(wager));
        if (res.success) {
            setSuccess('Bet Placed Successfully! Good Luck Soldier🫡');
            setWager('');
            setTimeout(() => {
                setSelectedOutcome(null);
                setSuccess('');
            }, 1500);
        } else {
            setError(res.error);
        }
    };

    return (
        <div className="container animate-fade">
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', paddingTop: '10px' }}>
                <div>
                    <h1 style={{ marginBottom: '4px', fontSize: '24px' }}>Bet It Happens</h1>
                    <p className="text-sm">Balance: <span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>
                        {user.balance !== undefined ? `$${user.balance.toFixed(2)}` : '...'}
                    </span></p>
                </div>
                <Link href="/profile" style={{ textDecoration: 'none', color: 'inherit' }}>
                    <div style={{
                        padding: '8px 12px',
                        borderRadius: '20px',
                        background: 'var(--bg-card)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: '1px solid var(--border)',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        gap: '6px',
                        cursor: 'pointer'
                    }}>
                        {user.profilePic ? (
                            <img src={user.profilePic} style={{ width: '20px', height: '20px', borderRadius: '50%', objectFit: 'cover' }} alt="" />
                        ) : (
                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--primary)' }}></div>
                        )}
                        {user.username}
                    </div>
                </Link>        </header>

            {/* Earn CTA */}
            <Link href="/wallet" style={{ textDecoration: 'none' }}>
                <div
                    className="card"
                    style={{ marginBottom: '24px', background: 'linear-gradient(90deg, rgba(39, 39, 42, 1) 0%, rgba(34,197,94,0.1) 100%)', border: '1px solid var(--primary)', cursor: 'pointer' }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div>
                            <h3 style={{ fontSize: '16px', color: 'var(--primary)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                💡 Have a Bet Idea?
                            </h3>
                            <p className="text-sm" style={{ margin: 0, color: '#e4e4e7' }}>Submit it and earn <span style={{ color: '#fff', fontWeight: 'bold' }}>$15.00</span> instantly!</p>
                        </div>
                        <div style={{ fontSize: '24px', color: 'var(--primary)' }}>→</div>
                    </div>
                </div>
            </Link>

            {/* --- Featured Events --- */}
            {activeEvents.filter(e => e.featured).length > 0 && (
                <div style={{ marginBottom: '40px' }}>
                    <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', color: '#fbbf24' }}>
                        <span style={{ fontSize: '24px' }}>🔥</span>
                        Featured Bets
                    </h2>
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                        gap: '20px',
                        marginBottom: '40px'
                    }}>
                        {activeEvents.filter(e => e.featured).slice(0, 3).map(event => (
                            <div
                                key={event.id}
                                className="card"
                                onClick={() => setExpandedEvent(event)}
                                style={{
                                    border: '1px solid #fbbf24',
                                    background: 'linear-gradient(145deg, var(--bg-card), rgba(251, 191, 36, 0.05))',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    cursor: 'pointer',
                                    transition: 'transform 0.2s'
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                                    <span className="badge" style={{ background: '#fbbf24', color: '#000', fontWeight: 'bold' }}>FEATURED</span>
                                    <span className="text-sm" style={{ color: '#fbbf24' }}>{new Date(event.startAt).toLocaleDateString()}</span>
                                </div>
                                <h3 style={{ fontSize: '18px', marginBottom: '8px', color: '#fbbf24', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{event.title}</h3>
                                <p className="text-sm" style={{ marginBottom: '16px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{event.description}</p>

                                <div style={{ marginTop: 'auto', textAlign: 'center', color: '#fbbf24', fontSize: '12px' }}>
                                    (Click to Expand & Bet)
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* --- Expanded Event Modal --- */}
            {expandedEvent && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
                    background: 'rgba(0,0,0,0.8)', zIndex: 1000,
                    display: 'flex', justifyContent: 'center', alignItems: 'center',
                    padding: '20px'
                }} onClick={() => setExpandedEvent(null)}>
                    <div
                        className="card"
                        style={{
                            width: '100%', maxWidth: '500px',
                            border: '1px solid #fbbf24',
                            boxShadow: '0 0 30px rgba(251,191,36,0.2)',
                            maxHeight: '80vh', overflowY: 'auto'
                        }}
                        onClick={e => e.stopPropagation()}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                            <h2 style={{ color: '#fbbf24', margin: 0, fontSize: '20px' }}>{expandedEvent.title}</h2>
                            <button onClick={() => setExpandedEvent(null)} style={{ background: 'none', border: 'none', color: '#fff', fontSize: '24px', cursor: 'pointer' }}>&times;</button>
                        </div>
                        <p style={{ marginBottom: '24px', lineHeight: '1.5' }}>{expandedEvent.description}</p>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                            {expandedEvent.outcomes.map(outcome => {
                                const stats = expandedEvent.stats || {};
                                const total = stats.totalBets || 0;
                                const count = stats.counts?.[outcome.id] || 0;
                                const percent = total > 0 ? Math.round((count / total) * 100) : 0;

                                return (
                                    <button
                                        key={outcome.id}
                                        disabled={expandedEvent.status !== 'open'}
                                        onClick={() => {
                                            if (user) {
                                                setSelectedOutcome({ eventId: expandedEvent.id, outcomeId: outcome.id, label: outcome.label, odds: outcome.odds, title: expandedEvent.title });
                                                setExpandedEvent(null);
                                                window.scrollTo({ top: 0, behavior: 'smooth' });
                                            } else {
                                                alert("Login to bet!");
                                            }
                                        }}
                                        className="btn btn-outline"
                                        style={{ borderColor: '#fbbf24', color: '#fbbf24', padding: '16px', display: 'flex', flexDirection: 'column', gap: '4px' }}
                                    >
                                        <div style={{ fontSize: '24px', fontWeight: '800' }}>{outcome.odds.toFixed(2)}x</div>
                                        <div style={{ fontWeight: '600', fontSize: '14px' }}>{outcome.label}</div>
                                        <div style={{ fontSize: '11px', opacity: 0.8, marginTop: '4px' }}>
                                            {percent}% picked
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* --- Active Events --- */}
            <div style={{ marginBottom: '32px' }}>
                <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                    <span style={{ width: '4px', height: '20px', background: 'var(--primary)', borderRadius: '2px' }}></span>
                    Live & Upcoming
                </h2>

                {activeEvents.filter(e => !e.featured).length === 0 ? <p className="text-sm" style={{ fontStyle: 'italic' }}>No other active events.</p> : null}

                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                    gap: '20px'
                }}>
                    {activeEvents.filter(e => !e.featured).map((event) => (
                        <div key={event.id} className="card" style={{ display: 'flex', flexDirection: 'column' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                                <span className="badge" style={{ background: event.status === 'open' ? '#22c55e20' : '#eab30820', color: event.status === 'open' ? '#22c55e' : '#eab308' }}>
                                    {event.status === 'open' ? 'OPEN' : 'LOCKED'}
                                </span>
                                <span className="text-sm">{new Date(event.startAt).toLocaleDateString()}</span>
                            </div>

                            <h3 style={{ fontSize: '18px', marginBottom: '4px' }}>{event.title}</h3>
                            <p className="text-sm" style={{ marginBottom: '12px' }}>{event.description}</p>

                            <div style={{ display: 'flex', gap: '16px', marginBottom: '16px', fontSize: '12px', background: 'var(--bg-input)', padding: '8px', borderRadius: '6px' }}>
                                <div style={{ flex: 1 }}>
                                    <div style={{ color: 'var(--text-muted)', marginBottom: '2px' }}>🛑 Betting Closes:</div>
                                    <div style={{ color: 'var(--accent-loss)', fontWeight: 'bold' }}>
                                        {event.deadline ? new Date(event.deadline).toLocaleString() : 'No deadline'}
                                    </div>
                                </div>
                                <div style={{ flex: 1, borderLeft: '1px solid var(--border)', paddingLeft: '16px' }}>
                                    <div style={{ color: 'var(--text-muted)', marginBottom: '2px' }}>🏁 Resolution/Cashout:</div>
                                    <div style={{ color: 'var(--primary)', fontWeight: 'bold' }}>
                                        {new Date(event.startAt).toLocaleString()}
                                    </div>
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                {event.outcomes.map(outcome => {
                                    const stats = event.stats || {};
                                    const total = stats.totalBets || 0;
                                    const count = stats.counts?.[outcome.id] || 0;
                                    const pct = total > 0 ? Math.round((count / total) * 100) : 0;

                                    return (
                                        <button
                                            key={outcome.id}
                                            disabled={event.status !== 'open'}
                                            className="btn btn-outline"
                                            style={{
                                                display: 'flex', flexDirection: 'column', padding: '10px',
                                                borderColor: (selectedOutcome?.outcomeId === outcome.id && selectedOutcome?.eventId === event.id) ? 'var(--primary)' : 'var(--border)',
                                                background: (selectedOutcome?.outcomeId === outcome.id && selectedOutcome?.eventId === event.id) ? 'rgba(34, 197, 94, 0.1)' : 'transparent',
                                                opacity: event.status !== 'open' ? 0.5 : 1,
                                                position: 'relative',
                                                overflow: 'hidden'
                                            }}
                                            onClick={() => setSelectedOutcome({ eventId: event.id, outcomeId: outcome.id, odds: outcome.odds, label: outcome.label, eventTitle: event.title })}
                                        >
                                            <span style={{ fontSize: '14px', zIndex: 2 }}>{outcome.label}</span>
                                            <span style={{ color: 'var(--primary)', fontWeight: 'bold', zIndex: 2 }}>x{outcome.odds.toFixed(2)}</span>
                                            <span style={{ fontSize: '11px', color: '#a1a1aa', marginTop: '4px', zIndex: 2 }}>
                                                {pct}% picked
                                            </span>
                                            {/* Subtle progress bar background */}
                                            <div style={{
                                                position: 'absolute', bottom: 0, left: 0, height: '4px', width: `${pct}%`,
                                                background: 'var(--primary)', opacity: 0.5, transition: 'width 0.5s ease'
                                            }}></div>
                                        </button>
                                    )
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* --- Finished Events --- */}
            {finishedEvents.length > 0 && (
                <div style={{ paddingTop: '16px', borderTop: '1px dashed var(--border)' }}>
                    <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', color: 'var(--text-muted)' }}>
                        Completed
                    </h2>
                    {finishedEvents.map(event => (
                        <div key={event.id} className="card" style={{ opacity: 0.7, background: 'transparent', border: '1px solid #27272a' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <h3 style={{ fontSize: '16px', color: 'var(--text-muted)' }}>{event.title}</h3>
                                <span className="badge" style={{ background: '#27272a', color: '#fff' }}>ENDED</span>
                            </div>
                            <div style={{ fontSize: '12px', marginTop: '8px', color: '#a1a1aa' }}>
                                Winner: <span style={{ color: 'var(--primary)' }}>{event.outcomes.find(o => o.id === event.winnerOutcomeId)?.label}</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}


            {/* Bet Modal (Centered Popup) - Fixed Animation */}
            {selectedOutcome && (
                <>
                    {/* Backdrop */}
                    <div
                        style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.8)', zIndex: 99, opacity: 1, transition: 'opacity 0.2s' }}
                        onClick={() => setSelectedOutcome(null)}
                    ></div>

                    {/* Modal */}
                    <div style={{
                        position: 'fixed',
                        top: '50%', left: '50%',
                        transform: 'translate(-50%, -50%)',
                        width: '90%', maxWidth: '350px',
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border)',
                        borderRadius: '16px',
                        padding: '20px',
                        zIndex: 100,
                        boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
                        // Removed keyframe animation to prevent transform conflict
                    }}>
                        {success ? (
                            <div style={{ textAlign: 'center', padding: '20px 0' }}>
                                <div style={{ fontSize: '48px', marginBottom: '16px' }}>🫡</div>
                                <h3 style={{ color: 'var(--accent-win)', fontSize: '24px', marginBottom: '8px' }}>Good Luck Soldier</h3>
                                <p style={{ color: 'var(--text-secondary)' }}>Bet Placed Successfully</p>
                            </div>
                        ) : (
                            <>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
                                    <div>
                                        <p className="text-sm">Betting on</p>
                                        <h3 style={{ fontSize: '20px' }}>{selectedOutcome.label} <span style={{ color: 'var(--primary)' }}>x{selectedOutcome.odds}</span></h3>
                                    </div>
                                    <button onClick={() => setSelectedOutcome(null)} style={{ background: 'none', border: 'none', color: '#fff', fontSize: '24px', cursor: 'pointer' }}>&times;</button>
                                </div>

                                <p className="text-sm" style={{ marginBottom: '12px' }}>{selectedOutcome.eventTitle}</p>

                                <div className="input-group">
                                    <input
                                        type="number"
                                        className="input"
                                        placeholder="Wager Amount ($)"
                                        value={wager}
                                        autoFocus
                                        onChange={(e) => setWager(e.target.value)}
                                    />
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', fontSize: '14px', background: 'rgba(255,255,255,0.05)', padding: '10px', borderRadius: '8px' }}>
                                    <span className="text-sm">Potential Payout:</span>
                                    <span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>
                                        ${wager ? (parseFloat(wager) * selectedOutcome.odds).toFixed(2) : '0.00'}
                                    </span>
                                </div>

                                {error && <p style={{ color: 'var(--accent-loss)', marginBottom: '12px', fontSize: '14px', textAlign: 'center' }}>{error}</p>}

                                <button className="btn btn-primary" onClick={handleBet}>
                                    Place Bet
                                </button>
                            </>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
