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
        const handleAuth = (e) => {
            e.preventDefault();
            setAuthError('');

            if (isLoginMode) {
                // Sign In
                const res = signin(email, password);
                if (!res.success) setAuthError(res.error);
            } else {
                // Sign Up
                if (!username) { setAuthError('Username required'); return; }
                const res = signup(email, username, password);
                if (!res.success) setAuthError(res.error);
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

                    <form onSubmit={handleAuth}>
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
                            <label className="text-sm" style={{ marginBottom: '8px', display: 'block' }}>Email</label>
                            <input
                                type="email"
                                required
                                className="input"
                                placeholder="you@example.com"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                            />
                        </div>
                        <div className="input-group">
                            <label className="text-sm" style={{ marginBottom: '8px', display: 'block' }}>Password</label>
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

    const handleBet = () => {
        setError('');
        setSuccess('');
        if (!wager || parseFloat(wager) <= 0) {
            setError('Enter a valid amount');
            return;
        }
        const res = placeBet(selectedOutcome.eventId, selectedOutcome.outcomeId, parseFloat(wager));
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
                    <p className="text-sm">Balance: <span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>${user.balance.toFixed(2)}</span></p>
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

            {/* --- Active Events --- */}
            <div style={{ marginBottom: '32px' }}>
                <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                    <span style={{ width: '4px', height: '20px', background: 'var(--primary)', borderRadius: '2px' }}></span>
                    Live & Upcoming
                </h2>

                {activeEvents.length === 0 ? <p className="text-sm" style={{ fontStyle: 'italic' }}>No active events right now.</p> : null}

                {activeEvents.map((event) => (
                    <div key={event.id} className="card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                            <span className="badge" style={{ background: event.status === 'open' ? '#22c55e20' : '#eab30820', color: event.status === 'open' ? '#22c55e' : '#eab308' }}>
                                {event.status === 'open' ? 'OPEN' : 'LOCKED'}
                            </span>
                            <span className="text-sm">{new Date(event.startAt).toLocaleDateString()}</span>
                        </div>

                        <h3 style={{ fontSize: '18px', marginBottom: '4px' }}>{event.title}</h3>
                        <p className="text-sm" style={{ marginBottom: '8px' }}>{event.description}</p>
                        {event.deadline && (
                            <p className="text-sm" style={{ marginBottom: '16px', color: 'var(--accent-lock)', fontSize: '12px' }}>
                                🕒 Deadline: {new Date(event.deadline).toLocaleString()}
                            </p>
                        )}

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                            {event.outcomes.map(outcome => (
                                <button
                                    key={outcome.id}
                                    disabled={event.status !== 'open'}
                                    className="btn btn-outline"
                                    style={{
                                        display: 'flex', flexDirection: 'column', padding: '10px',
                                        borderColor: (selectedOutcome?.outcomeId === outcome.id && selectedOutcome?.eventId === event.id) ? 'var(--primary)' : 'var(--border)',
                                        background: (selectedOutcome?.outcomeId === outcome.id && selectedOutcome?.eventId === event.id) ? 'rgba(34, 197, 94, 0.1)' : 'transparent',
                                        opacity: event.status !== 'open' ? 0.5 : 1
                                    }}
                                    onClick={() => setSelectedOutcome({ eventId: event.id, outcomeId: outcome.id, odds: outcome.odds, label: outcome.label, eventTitle: event.title })}
                                >
                                    <span style={{ fontSize: '14px' }}>{outcome.label}</span>
                                    <span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>x{outcome.odds.toFixed(2)}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                ))}
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
                        {success && <p style={{ color: 'var(--accent-win)', marginBottom: '12px', fontSize: '14px', textAlign: 'center' }}>{success}</p>}

                        <button className="btn btn-primary" onClick={handleBet}>
                            Place Bet
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}
