"use client";
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useApp } from '../lib/store';
import { collection, query, orderBy, onSnapshot, where } from 'firebase/firestore';

const FUNNY_QUOTES = [
    "Loading luck...",
    "Consulting the betting oracle...",
    "Convincing your wallet to open...",
    "Calculating the odds of you winning...",
    "Shuffling virtual deck...",
    "Polishing the participation trophies..."
];

export default function Home() {
    const { user, events, placeBet, signup, signin, isLoaded, addComment, deleteComment, db, getUserStats, deleteEvent } = useApp();
    const chatContainerRef = useRef(null);
    const [selectedOutcome, setSelectedOutcome] = useState(null);
    const [wager, setWager] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [expandedEvent, setExpandedEvent] = useState(null);
    const [comments, setComments] = useState([]);
    const [commentText, setCommentText] = useState('');
    const [showWelcome, setShowWelcome] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [now, setNow] = useState(new Date()); // Live clock
    const [expandedCategories, setExpandedCategories] = useState({});

    useEffect(() => {
        // Update 'now' every second to keep time-sensitive UI (like betting deadlines) accurate
        const timer = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        if (typeof window !== 'undefined' && localStorage.getItem('justSignedUp')) {
            setShowWelcome(true);
            localStorage.removeItem('justSignedUp');
        }
    }, []);

    // Public Profile Viewer
    const [viewingUser, setViewingUser] = useState(null);
    const [viewingProfile, setViewingProfile] = useState(null);

    useEffect(() => {
        if (viewingUser) {
            setViewingProfile(null);
            getUserStats(viewingUser.id).then(res => {
                if (res.success) setViewingProfile(res);
            });
        }
    }, [viewingUser]);

    useEffect(() => {
        if (!expandedEvent || !db) return;
        const q = query(collection(db, 'comments'), where('eventId', '==', expandedEvent.id));
        const unsub = onSnapshot(q, (snap) => {
            const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            list.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
            setComments(list);
        });
        return () => unsub();
    }, [expandedEvent, db]);



    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [comments, expandedEvent]);

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
                } else if (res.suggestedEmail) {
                    setEmail(res.suggestedEmail);
                    setAuthError(`We found your account! We switched the field to your email (${res.suggestedEmail}). Please try the password again.`);
                } else {
                    setAuthError(getFriendlyError(res.error));
                }
            } else {
                // Sign Up
                if (!username) { setAuthError('Username required'); return; }
                const res = await signup(email, username, password);
                if (res.success) {
                    if (typeof window !== 'undefined') {
                        localStorage.setItem('justSignedUp', 'true');
                    }
                    window.location.reload();
                } else {
                    setAuthError(getFriendlyError(res.error));
                }
            }
        };

        return (
            <div className="container animate-fade" style={{ height: '90vh', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <div style={{ textAlign: 'center', marginBottom: '40px' }}>
                    <img src="/logo.png" alt="Bet It Happens" style={{ width: '160px', height: 'auto', marginBottom: '16px', display: 'inline-block' }} />
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
    const rawActiveEvents = events.filter(e => {
        // 1. Status Check
        if (e.status !== 'open' && e.status !== 'locked') return false;

        // 2. Group Access Check (Private Bets)
        // Ensure restrictedToGroup is a valid string and not empty
        if (e.restrictedToGroup && typeof e.restrictedToGroup === 'string' && e.restrictedToGroup.trim() !== '') {

            // If user is not logged in, they can't belong to a group -> HIDE
            if (!user) return false;

            // Admin sees everything (with a visual indicator later maybe)
            if (user.role === 'admin') return true;

            // Check if user has the group
            const userGroups = user.groups || [];
            if (Array.isArray(userGroups)) {
                if (userGroups.includes(e.restrictedToGroup)) return true;
            } else if (typeof userGroups === 'string') {
                // Fallback if somehow stored as string
                if (userGroups === e.restrictedToGroup) return true;
            }

            // If we reached here, it's a private bet and user doesn't have access -> HIDE
            return false;
        }

        // Public event -> SHOW
        return true;
    });

    // Robust date parsing helper
    const getDate = (dateStr) => {
        if (!dateStr) return new Date(0);
        if (dateStr.seconds) return new Date(dateStr.seconds * 1000);
        return new Date(dateStr);
    };

    // 1. LIVE (Betting Open): Now < Deadline
    const activeEvents = rawActiveEvents.filter(e => {
        const deadline = e.deadline ? getDate(e.deadline) : getDate(e.startAt);
        return now < deadline;
    });

    // 2. CLOSED (Betting Closed, Game is Running): Deadline <= Now < Resolution
    const closedEvents = rawActiveEvents.filter(e => {
        const deadline = e.deadline ? getDate(e.deadline) : getDate(e.startAt);
        const resolution = getDate(e.startAt);
        // If deadline and resolution are same (legacy), it skips this phase and goes to pending
        return now >= deadline && now < resolution;
    });

    // 3. PENDING (Resolution/Game Over): Now >= Resolution
    const pendingResolutionEvents = rawActiveEvents.filter(e => {
        const resolution = getDate(e.startAt);
        return now >= resolution;
    });

    const finishedEvents = events.filter(e => e.status === 'settled');

    console.log("Time:", now.toLocaleTimeString(), "Live:", activeEvents.length, "Closed:", closedEvents.length, "Pending:", pendingResolutionEvents.length);



    const handleBet = async () => {
        if (isSubmitting) return; // Prevent double click

        setError('');
        setSuccess('');

        if (!wager || parseFloat(wager) <= 0) {
            setError('Enter a valid amount');
            return;
        }

        setIsSubmitting(true);

        try {
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
        } catch (e) {
            setError("Something went wrong. Try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="container animate-fade">

            <header style={{ marginBottom: '32px', paddingTop: '10px' }}>


                <div style={{ textAlign: 'center' }}>
                    <p style={{
                        fontSize: '16px',
                        color: '#fff',
                        marginBottom: '12px',
                        fontWeight: '600',
                        background: 'linear-gradient(90deg, #fff, #a1a1aa)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        display: 'inline-block'
                    }}>
                        Prediction markets for real life — make predictions, earn coins, climb the leaderboard.
                    </p>
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px' }}>
                        <p className="text-sm" style={{ background: 'var(--bg-card)', padding: '4px 12px', borderRadius: '12px', border: '1px solid var(--border)' }}>
                            Balance: <span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>
                                {user.balance !== undefined ? `$${user.balance.toFixed(2)}` : '...'}
                            </span></p>
                        <Link href="/rules" style={{ fontSize: '11px', color: 'var(--text-muted)', textDecoration: 'underline' }}>
                            Resolutions & Rules ℹ️
                        </Link>
                    </div>
                </div>
            </header>

            {/* --- 🏆 SUPER BOWL SPECIAL --- */}
            {activeEvents.filter(e => e.category === 'Super Bowl').length > 0 && (
                <div style={{ marginBottom: '40px', animation: 'fadeIn 0.5s ease-out' }}>
                    <div style={{
                        background: 'linear-gradient(135deg, #111 0%, #1e1e24 100%)',
                        border: '1px solid #333',
                        borderRadius: '16px',
                        padding: '2px', // Border gradient trick container
                        position: 'relative',
                        overflow: 'hidden',
                        boxShadow: '0 0 20px rgba(0,0,0,0.5)'
                    }}>
                        {/* Animated Border Gradient */}
                        <div style={{
                            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                            background: 'linear-gradient(90deg, #ff0000, #ffffff, #0033cc, #ff0000)',
                            backgroundSize: '400% 400%',
                            animation: 'gradientborder 3s ease infinite',
                            borderRadius: '16px',
                            zIndex: 0,
                            opacity: 0.5
                        }}></div>

                        {/* Content Container */}
                        <div style={{
                            background: '#09090b',
                            borderRadius: '15px',
                            position: 'relative',
                            zIndex: 1,
                            padding: '24px'
                        }}>
                            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                                <h1 style={{
                                    fontSize: '32px',
                                    fontWeight: '900',
                                    textTransform: 'uppercase',
                                    letterSpacing: '2px',
                                    marginBottom: '8px',
                                    background: 'linear-gradient(to right, #ef4444, #fff, #3b82f6)',
                                    WebkitBackgroundClip: 'text',
                                    WebkitTextFillColor: 'transparent',
                                    display: 'inline-block'
                                }}>
                                    Super Bowl LIX
                                </h1>
                                <p style={{ color: '#a1a1aa', fontSize: '14px' }}>The Big Game is Here. Place your bets.</p>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                                {/* 1. The MAIN EVENT (Vertical, Full Width) */}
                                {activeEvents.filter(e => e.category === 'Super Bowl').map(event => {
                                    const hasMain = event.outcomes.some(o => o.type === 'main');
                                    if (!hasMain) return null; // Skip non-main events here

                                    return (
                                        <div key={event.id} onClick={() => setExpandedEvent(event)} style={{
                                            cursor: 'pointer',
                                            border: '2px solid rgba(74, 222, 128, 0.4)',
                                            background: 'linear-gradient(180deg, rgba(34, 197, 94, 0.05) 0%, rgba(0,0,0,0.2) 100%)',
                                            borderRadius: '16px',
                                            padding: '20px',
                                            boxShadow: '0 0 40px rgba(34, 197, 94, 0.15)',
                                            position: 'relative',
                                            overflow: 'hidden',
                                            transition: 'transform 0.2s',
                                        }}
                                            className="animate-pulse-slow"
                                        >
                                            {/* Main Event Badge at TOP */}
                                            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                                                <h2 style={{
                                                    fontSize: '16px', fontWeight: '900', color: 'var(--primary)',
                                                    textTransform: 'uppercase', letterSpacing: '4px',
                                                    textShadow: '0 0 15px rgba(34, 197, 94, 0.8)',
                                                    marginTop: '0',
                                                    marginBottom: '0'
                                                }}>★ MAIN EVENT ★</h2>
                                            </div>

                                            {/* Title & Info Section */}
                                            <div style={{
                                                display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px',
                                                borderBottom: '1px solid rgba(255,255,255,0.1)',
                                                paddingBottom: '16px'
                                            }}>
                                                <div style={{ textAlign: 'left' }}>
                                                    <h3 style={{ fontSize: '22px', color: '#fff', marginBottom: '6px', fontWeight: 'bold' }}>{event.title}</h3>
                                                    <p style={{ fontSize: '13px', color: '#a1a1aa' }}>{event.description}</p>
                                                </div>
                                                <div style={{ textAlign: 'right', minWidth: '80px' }}>
                                                    <div style={{ fontSize: '11px', color: '#ef4444', fontWeight: 'bold', textTransform: 'uppercase' }}>ENDS IN</div>
                                                    <div style={{ fontFamily: 'monospace', fontSize: '15px', color: '#fff', fontWeight: 'bold' }}>
                                                        {Math.max(0, Math.floor((getDate(event.startAt) - now) / (1000 * 60 * 60 * 24)))}d :
                                                        {Math.max(0, Math.floor(((getDate(event.startAt) - now) % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)))}h
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Main Bets Buttons - Scrollable on mobile */}
                                            <div style={{
                                                display: 'grid',
                                                gridAutoFlow: 'column',
                                                gridAutoColumns: 'minmax(160px, 1fr)',
                                                gap: '16px',
                                                marginBottom: '24px',
                                                overflowX: 'auto',
                                                paddingBottom: '12px',
                                                scrollSnapType: 'x mandatory',
                                                WebkitOverflowScrolling: 'touch'
                                            }}>
                                                {event.outcomes.filter(o => o.type === 'main').map(outcome => (
                                                    <button
                                                        key={outcome.id}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            if (user) setSelectedOutcome({ eventId: event.id, outcomeId: outcome.id, odds: outcome.odds, label: outcome.label, eventTitle: event.title });
                                                            else alert("Login to bet!");
                                                        }}
                                                        className="btn"
                                                        style={{
                                                            background: 'linear-gradient(180deg, #18181b 0%, #000 100%)',
                                                            border: '2px solid var(--primary)',
                                                            boxShadow: '0 0 30px rgba(34, 197, 94, 0.2)',
                                                            padding: '40px 20px',
                                                            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px',
                                                            transition: 'transform 0.2s',
                                                            cursor: 'pointer',
                                                            borderRadius: '12px',
                                                            scrollSnapAlign: 'center'
                                                        }}
                                                    >
                                                        <span style={{ fontSize: '28px', fontWeight: '900', color: '#fff', textTransform: 'uppercase', textAlign: 'center', lineHeight: '1.2' }}>{outcome.label}</span>
                                                        <span style={{ fontSize: '22px', color: 'var(--primary)', fontWeight: 'bold' }}>x{outcome.odds.toFixed(2)}</span>
                                                    </button>
                                                ))}
                                            </div>

                                            {/* Sub Bets / Props Section */}
                                            {event.outcomes.filter(o => o.type !== 'main').length > 0 && (
                                                <div style={{ borderTop: '1px dashed #333', paddingTop: '16px' }}>
                                                    <h4 style={{ fontSize: '11px', color: '#71717a', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '2px', textAlign: 'center' }}>- Side Bets & Props -</h4>
                                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                                        {event.outcomes.filter(o => o.type !== 'main').map(outcome => (
                                                            <button
                                                                key={outcome.id}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    if (user) setSelectedOutcome({ eventId: event.id, outcomeId: outcome.id, odds: outcome.odds, label: outcome.label, eventTitle: event.title });
                                                                    else alert("Login to bet!");
                                                                }}
                                                                className="btn"
                                                                style={{
                                                                    background: '#18181b', // Darker background
                                                                    border: '1px solid #3f3f46',
                                                                    padding: '24px 16px', // Heavily increased padding
                                                                    borderRadius: '12px', // More rounded
                                                                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
                                                                    height: 'auto',
                                                                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                                                                    transition: 'transform 0.1s, border-color 0.1s',
                                                                    cursor: 'pointer'
                                                                }}
                                                            >
                                                                <span style={{ color: '#fff', fontWeight: '900', fontSize: '18px', textTransform: 'uppercase' }}>{outcome.label}</span>
                                                                <span style={{ color: '#4ade80', fontWeight: 'bold', fontSize: '15px' }}>x{outcome.odds.toFixed(2)}</span>
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Last Comment Display */}
                                            {event.lastComment && (
                                                <div style={{ marginTop: '16px', padding: '10px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '8px', textAlign: 'center', fontSize: '12px', display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(255,255,255,0.05)' }}>
                                                    <span style={{ fontWeight: 'bold', color: '#fff' }}>{event.lastComment.username}:</span>
                                                    <span style={{ color: '#d1d5db', fontStyle: 'italic', maxWidth: '300px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                        "{event.lastComment.text}"
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}

                                {/* 2. OTHER SUPER BOWL EVENTS (Horizontal Scroll) */}
                                <div style={{
                                    display: 'flex',
                                    gap: '16px',
                                    overflowX: 'auto',
                                    paddingBottom: '16px', // Space for scrollbar
                                    scrollSnapType: 'x mandatory'
                                }}>
                                    {activeEvents.filter(e => e.category === 'Super Bowl').map(event => {
                                        const hasMain = event.outcomes.some(o => o.type === 'main');
                                        if (hasMain) return null; // Skip main event (already rendered above)

                                        return (
                                            <div key={event.id} onClick={() => setExpandedEvent(event)} style={{
                                                minWidth: '320px', // Fixed width for carousel items
                                                maxWidth: '320px',
                                                cursor: 'pointer',
                                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                                background: 'rgba(255, 255, 255, 0.02)',
                                                borderRadius: '16px',
                                                padding: '20px',
                                                position: 'relative',
                                                overflow: 'hidden',
                                                scrollSnapAlign: 'start',
                                                display: 'flex',
                                                flexDirection: 'column'
                                            }}>
                                                {/* Title & Info Section */}
                                                <div style={{
                                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px'
                                                }}>
                                                    <div style={{ textAlign: 'left', overflow: 'hidden' }}>
                                                        <h3 style={{ fontSize: '18px', color: '#fff', marginBottom: '4px', fontWeight: 'bold', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{event.title}</h3>
                                                        <p style={{ fontSize: '13px', color: '#a1a1aa' }}>{event.description}</p>
                                                    </div>
                                                </div>

                                                {/* Outcomes (Vertical inside the card for familiarity, or could be grid) */}
                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                                    {event.outcomes.map(outcome => (
                                                        <button
                                                            key={outcome.id}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                if (user) setSelectedOutcome({ eventId: event.id, outcomeId: outcome.id, odds: outcome.odds, label: outcome.label, eventTitle: event.title });
                                                                else alert("Login to bet!");
                                                            }}
                                                            className="btn"
                                                            style={{
                                                                background: '#18181b', // Darker background
                                                                border: '1px solid #3f3f46',
                                                                padding: '16px 8px', // Slightly smaller padding for side cards
                                                                borderRadius: '8px',
                                                                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
                                                                height: 'auto',
                                                                cursor: 'pointer'
                                                            }}
                                                        >
                                                            <span style={{ color: '#fff', fontWeight: '900', fontSize: '14px', textTransform: 'uppercase', textAlign: 'center' }}>{outcome.label}</span>
                                                            <span style={{ color: '#4ade80', fontWeight: 'bold', fontSize: '12px' }}>x{outcome.odds.toFixed(2)}</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                            <style jsx>{`
                                @keyframes gradientborder { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
                            `}</style>
                        </div>
                    </div>
                </div>
            )}

            {/* --- Profile Update Prompt --- */}
            {user && (!user.profilePic || !user.bio) && (
                <div className="card" style={{ marginBottom: '24px', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid var(--primary)', display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ fontSize: '32px' }}>🤳</div>
                    <div style={{ flex: 1 }}>
                        <h3 style={{ fontSize: '16px', color: '#fff', marginBottom: '4px' }}>Stand out in the crowd!</h3>
                        <p className="text-sm" style={{ color: '#bae6fd', margin: 0 }}>
                            Add a profile picture and bio to let others know who they're betting against.
                        </p>
                    </div>
                    <Link href="/profile" className="btn btn-primary" style={{ width: 'auto', fontSize: '12px', whiteSpace: 'nowrap', textDecoration: 'none', padding: '8px 16px' }}>
                        Update Profile
                    </Link>
                </div>
            )}

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
                                    <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginBottom: '6px' }}>
                                        {event.outcomes.map(o => (
                                            <span key={o.id} style={{ background: 'rgba(251, 191, 36, 0.2)', padding: '2px 8px', borderRadius: '4px' }}>
                                                {o.label}: x{o.odds.toFixed(2)}
                                            </span>
                                        ))}
                                    </div>
                                </div>

                                {event.lastComment && (
                                    <div style={{ marginTop: '8px', padding: '6px', background: 'rgba(251, 191, 36, 0.1)', borderRadius: '4px', textAlign: 'left', fontSize: '11px', display: 'flex', gap: '6px', alignItems: 'center' }}>
                                        <span style={{ fontWeight: 'bold' }}>{event.lastComment.username}:</span>
                                        <span style={{ color: '#fbbf24', fontStyle: 'italic', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '150px' }}>
                                            "{event.lastComment.text}"
                                        </span>
                                    </div>
                                )}

                                <div style={{
                                    marginTop: '12px',
                                    paddingTop: '8px',
                                    borderTop: '1px dashed rgba(251, 191, 36, 0.3)',
                                    textAlign: 'center',
                                    color: '#fbbf24',
                                    fontSize: '11px',
                                    fontWeight: 'bold',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '6px'
                                }}>
                                    <span>👉 Click to Bet & View Trash Talk</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}


            {/* --- Pending Resolution Events (Game Over) --- */}
            {
                pendingResolutionEvents.length > 0 && (
                    <div style={{ marginBottom: '32px' }}>
                        <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', color: '#eab308' }}>
                            ⏳ Pending Resolution
                        </h2>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
                            {pendingResolutionEvents.map(event => (
                                <div
                                    key={event.id}
                                    className="card"
                                    onClick={() => setExpandedEvent(event)}
                                    style={{ border: '1px solid #eab308', background: 'rgba(234, 179, 8, 0.05)', cursor: 'pointer' }}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                        <span className="badge" style={{ background: '#eab308', color: '#000' }}>FINISHED</span>
                                        <span style={{ fontSize: '12px', color: '#eab308' }}>Awaiting Admin...</span>
                                    </div>
                                    <h3 style={{ fontSize: '18px', color: '#eab308' }}>{event.title}</h3>
                                    <p className="text-sm" style={{ color: '#a1a1aa' }}>Event over. Decisions coming soon.</p>

                                    {event.lastComment && (
                                        <div style={{ marginTop: '8px', padding: '6px', background: 'rgba(234, 179, 8, 0.1)', borderRadius: '4px', textAlign: 'left', fontSize: '11px', display: 'flex', gap: '6px', alignItems: 'center' }}>
                                            <span style={{ fontWeight: 'bold', color: '#eab308' }}>{event.lastComment.username}:</span>
                                            <span style={{ color: '#eab308', fontStyle: 'italic', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '150px' }}>
                                                "{event.lastComment.text}"
                                            </span>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )
            }

            {/* --- Betting Closed Events (Game Running) --- */}
            {
                closedEvents.length > 0 && (
                    <div style={{ marginBottom: '32px' }}>
                        <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', color: '#f59e0b' }}>
                            🔒 Betting Closed
                        </h2>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
                            {closedEvents.map(event => (
                                <div
                                    key={event.id}
                                    className="card"
                                    onClick={() => setExpandedEvent(event)}
                                    style={{ border: '1px solid #f59e0b', background: 'rgba(245, 158, 11, 0.05)', cursor: 'pointer' }}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                        <span className="badge" style={{ background: '#f59e0b', color: '#000' }}>LIVE</span>
                                        <span style={{ fontSize: '12px', color: '#f59e0b', fontWeight: 'bold' }}>BETS LOCKED</span>
                                    </div>
                                    <h3 style={{ fontSize: '18px', color: '#f59e0b' }}>{event.title}</h3>
                                    <p className="text-sm" style={{ color: '#a1a1aa' }}>Game in progress. Good luck!</p>

                                    {event.lastComment && (
                                        <div style={{ marginTop: '8px', padding: '6px', background: 'rgba(245, 158, 11, 0.1)', borderRadius: '4px', textAlign: 'left', fontSize: '11px', display: 'flex', gap: '6px', alignItems: 'center' }}>
                                            <span style={{ fontWeight: 'bold', color: '#f59e0b' }}>{event.lastComment.username}:</span>
                                            <span style={{ color: '#f59e0b', fontStyle: 'italic', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '150px' }}>
                                                "{event.lastComment.text}"
                                            </span>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )
            }

            {/* --- Active Events By Category --- */}
            {(() => {
                const grouped = {};
                const categories = ['The Boys', 'The Fam', 'Sports', 'Video Games', 'Local/Community', 'Weather', 'Tech', 'Pop Culture', 'Other'];
                categories.forEach(c => grouped[c] = []);

                activeEvents.filter(e => !e.featured && e.category !== 'Super Bowl').forEach(e => {
                    const cat = e.category || 'Sports';
                    // If event has a category we don't track explicitly, dump it in 'Other' or create it?
                    // For now, if it matches one of our private groups, it will be caught.
                    if (grouped[cat]) {
                        grouped[cat].push(e);
                    } else {
                        // Fallback handling if you add new categories later without updating this list
                        if (!grouped['Other']) grouped['Other'] = [];
                        grouped['Other'].push(e);
                    }
                });

                return Object.entries(grouped).map(([category, catEvents]) => {
                    if (catEvents.length === 0) return null;

                    const isExpanded = expandedCategories[category];
                    const isPrivate = ['The Boys', 'The Fam'].includes(category);

                    return (
                        <div key={category} style={{ marginBottom: '40px' }}>
                            <div
                                style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', cursor: 'pointer' }}
                                onClick={() => setExpandedCategories(prev => ({ ...prev, [category]: !prev[category] }))}
                            >
                                <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                                    <span style={{ width: '4px', height: '20px', background: isPrivate ? '#ef4444' : 'var(--primary)', borderRadius: '2px' }}></span>
                                    {isPrivate && <span>🔒</span>}
                                    {category}
                                </h2>
                                <button
                                    className="btn btn-outline"
                                    style={{
                                        padding: '2px 8px',
                                        fontSize: '12px',
                                        height: '24px',
                                        color: '#a1a1aa',
                                        borderColor: '#3f3f46',
                                        minWidth: '24px'
                                    }}
                                >
                                    {isExpanded ? '−' : '+'}
                                </button>
                                {!isExpanded && <span className="text-sm" style={{ color: '#52525b' }}>({catEvents.length} events hidden)</span>}
                            </div>

                            {isExpanded && (

                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                                    gap: '20px'
                                }}>
                                    {catEvents.map((event) => (
                                        <div
                                            key={event.id}
                                            className="card"
                                            onClick={() => setExpandedEvent(event)}
                                            style={{
                                                display: 'flex',
                                                flexDirection: 'column',
                                                cursor: 'pointer',
                                                transition: 'transform 0.2s',
                                                border: '1px solid var(--border)'
                                            }}
                                        >
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
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                if (user) {
                                                                    setSelectedOutcome({ eventId: event.id, outcomeId: outcome.id, odds: outcome.odds, label: outcome.label, eventTitle: event.title });
                                                                } else {
                                                                    alert("Login to bet!");
                                                                }
                                                            }}
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
                                            <div style={{ marginTop: '12px', textAlign: 'center', fontSize: '11px', color: '#52525b' }}>
                                                {event.lastComment ? (
                                                    <div style={{ padding: '6px', background: 'var(--bg-input)', borderRadius: '4px', textAlign: 'left', display: 'flex', gap: '6px', alignItems: 'center' }}>
                                                        <span style={{ fontWeight: 'bold', color: 'var(--primary)' }}>{event.lastComment.username}:</span>
                                                        <span style={{ color: 'var(--text-muted)', fontStyle: 'italic', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '180px' }}>
                                                            "{event.lastComment.text}"
                                                        </span>
                                                    </div>
                                                ) : "(Click card for Chat & Analysis)"}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                });
            })()}

            {/* --- Finished Events --- */}
            {
                finishedEvents.length > 0 && (
                    <div style={{ paddingTop: '16px', borderTop: '1px dashed var(--border)' }}>
                        <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', color: 'var(--text-muted)' }}>
                            Completed
                        </h2>
                        {finishedEvents.map(event => (
                            <div key={event.id} className="card" style={{ opacity: 0.7, background: 'transparent', border: '1px solid #27272a', position: 'relative' }}>
                                {user && user.role === 'admin' && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (confirm('Delete this completed event?')) deleteEvent(event.id);
                                        }}
                                        style={{
                                            position: 'absolute', top: '10px', right: '10px',
                                            background: 'rgba(239, 68, 68, 0.2)', color: 'var(--accent-loss)',
                                            border: 'none', borderRadius: '4px', padding: '4px 8px',
                                            fontSize: '11px', cursor: 'pointer', fontWeight: 'bold'
                                        }}
                                    >
                                        DELETE EVENT
                                    </button>
                                )}
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
                )
            }


            {/* Bet Modal (Centered Popup) - Fixed Animation */}
            {
                selectedOutcome && (
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

                                    <p className="text-sm" style={{ marginBottom: '8px', color: 'var(--primary)', fontWeight: 'bold' }}>
                                        Your Balance: ${user.balance.toFixed(2)}
                                    </p>

                                    <div className="input-group">
                                        <input
                                            type="text"
                                            inputMode="decimal"
                                            className="input"
                                            placeholder="Wager Amount ($)"
                                            value={wager}
                                            onChange={(e) => {
                                                // Allow user to type '$', but strip it for state
                                                // We want to show what they type? No, standard is to strip currency symbols immediately or format on blur.
                                                // Simple approach: Strip non-numeric chars immediately EXCEPT '.'
                                                const val = e.target.value;
                                                // If start with $, remove it
                                                const clean = val.replace(/^\$/, '');
                                                // Ensure only numbers and one dot
                                                if (/^\d*\.?\d*$/.test(clean)) {
                                                    setWager(clean);
                                                }
                                            }}
                                        />
                                    </div>

                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', fontSize: '14px', background: 'rgba(255,255,255,0.05)', padding: '10px', borderRadius: '8px' }}>
                                        <span className="text-sm">Potential Payout:</span>
                                        <span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>
                                            ${(parseFloat(wager || '0') * selectedOutcome.odds).toFixed(2)}
                                        </span>
                                    </div>

                                    {error && <p style={{ color: 'var(--accent-loss)', marginBottom: '12px', fontSize: '14px', textAlign: 'center' }}>{error}</p>}

                                    <button
                                        className="btn btn-primary"
                                        onClick={handleBet}
                                        disabled={isSubmitting}
                                        style={{ opacity: isSubmitting ? 0.7 : 1, cursor: isSubmitting ? 'not-allowed' : 'pointer' }}
                                    >
                                        {isSubmitting ? 'Processing...' : 'Place Bet'}
                                    </button>
                                </>
                            )}
                        </div>
                    </>
                )
            }
            {/* --- Expanded Event Modal --- */}
            {
                expandedEvent && (
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

                            {/* Expiration Check */}
                            {(now >= (expandedEvent.deadline ? getDate(expandedEvent.deadline) : getDate(expandedEvent.startAt))) && (
                                <div style={{
                                    background: 'rgba(234, 179, 8, 0.15)',
                                    border: '1px solid #eab308',
                                    color: '#eab308',
                                    padding: '10px',
                                    borderRadius: '8px',
                                    textAlign: 'center',
                                    marginBottom: '20px',
                                    fontWeight: 'bold',
                                    fontSize: '14px'
                                }}>
                                    🔒 BETTING CLOSED
                                </div>
                            )}

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                {expandedEvent.outcomes.map(outcome => {
                                    const stats = expandedEvent.stats || {};
                                    const total = stats.totalBets || 0;
                                    const count = stats.counts?.[outcome.id] || 0;
                                    const percent = total > 0 ? Math.round((count / total) * 100) : 0;

                                    const bettingDeadline = expandedEvent.deadline ? getDate(expandedEvent.deadline) : getDate(expandedEvent.startAt);
                                    const isExpired = now >= bettingDeadline;
                                    const isDisabled = expandedEvent.status !== 'open' || isExpired;

                                    return (
                                        <button
                                            key={outcome.id}
                                            disabled={isDisabled}
                                            onClick={() => {
                                                if (isDisabled) return;
                                                if (user) {
                                                    setSelectedOutcome({ eventId: expandedEvent.id, outcomeId: outcome.id, label: outcome.label, odds: outcome.odds, title: expandedEvent.title });
                                                    setExpandedEvent(null);
                                                } else {
                                                    alert("Login to bet!");
                                                }
                                            }}
                                            className="btn btn-outline"
                                            style={{
                                                borderColor: '#fbbf24',
                                                color: '#fbbf24',
                                                padding: '16px',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                gap: '4px',
                                                opacity: isDisabled ? 0.5 : 1,
                                                cursor: isDisabled ? 'not-allowed' : 'pointer'
                                            }}
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

                            <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid #333' }}>
                                <h3 style={{ fontSize: '16px', marginBottom: '12px', color: '#a1a1aa' }}>Trash Talk 🗣️</h3>
                                <div ref={chatContainerRef} style={{ maxHeight: '150px', overflowY: 'auto', marginBottom: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {comments.length === 0 && <p className="text-sm">No chatter yet. Start the beef!</p>}
                                    {comments.map(c => (
                                        <div key={c.id} style={{ background: 'rgba(255,255,255,0.05)', padding: '8px', borderRadius: '4px', position: 'relative' }}>
                                            {user && user.role === 'admin' && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (confirm('Delete message?')) {
                                                            deleteComment(c.id).then(res => {
                                                                if (!res.success) alert("Delete Failed: " + res.error);
                                                            });
                                                        }
                                                    }}
                                                    style={{
                                                        position: 'absolute', top: '4px', right: '4px',
                                                        background: 'none', border: 'none', color: '#ef4444',
                                                        fontSize: '10px', cursor: 'pointer', padding: '2px', opacity: 0.7
                                                    }}
                                                    title="Delete Message"
                                                >
                                                    (x)
                                                </button>
                                            )}
                                            <div
                                                style={{ fontSize: '10px', color: 'var(--primary)', fontWeight: 'bold', cursor: 'pointer', display: 'inline-block', marginBottom: '2px' }}
                                                onClick={() => setViewingUser({ id: c.userId, username: c.username })}
                                                onMouseEnter={e => e.target.style.textDecoration = 'underline'}
                                                onMouseLeave={e => e.target.style.textDecoration = 'none'}
                                            >
                                                {c.username || 'Anon'}
                                            </div>
                                            <div style={{ fontSize: '12px', paddingRight: '16px' }}>{c.text}</div>
                                        </div>
                                    ))}
                                </div>
                                {user ? (
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <input
                                            className="input"
                                            placeholder="Say something..."
                                            style={{ padding: '8px', fontSize: '12px' }}
                                            value={commentText}
                                            onChange={e => setCommentText(e.target.value)}
                                            onKeyDown={async (e) => {
                                                if (e.key === 'Enter' && commentText.trim()) {
                                                    const text = commentText;
                                                    setCommentText(''); // Optimistic update
                                                    console.log("Sending:", text);
                                                    const res = await addComment(expandedEvent.id, text);
                                                    if (!res.success) {
                                                        console.error("Failed:", res.error);
                                                        alert("Failed to send: " + res.error);
                                                        setCommentText(text); // Revert
                                                    }
                                                }
                                            }}
                                        />
                                        <button
                                            className="btn btn-primary"
                                            style={{ width: 'auto', padding: '8px 12px', fontSize: '12px' }}
                                            onClick={async () => {
                                                if (commentText.trim()) {
                                                    const text = commentText;
                                                    setCommentText('');
                                                    console.log("Sending:", text);
                                                    const res = await addComment(expandedEvent.id, text);
                                                    if (!res.success) {
                                                        console.error("Failed:", res.error);
                                                        alert("Failed to send: " + res.error);
                                                        setCommentText(text);
                                                    }
                                                }
                                            }}
                                        >
                                            Send
                                        </button>
                                    </div>
                                ) : <p className="text-sm">Login to comment.</p>}
                            </div>
                        </div>
                    </div>
                )
            }

            {/* --- Public User Profile Modal --- */}
            {
                viewingUser && (
                    <div style={{
                        position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
                        background: 'rgba(0,0,0,0.85)', zIndex: 1100,
                        display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px'
                    }} onClick={() => setViewingUser(null)}>
                        <div className="card animate-fade" style={{ width: '100%', maxWidth: '350px', border: '1px solid var(--primary)', position: 'relative' }} onClick={e => e.stopPropagation()}>
                            <button
                                onClick={() => setViewingUser(null)}
                                style={{ position: 'absolute', top: '10px', right: '10px', background: 'none', border: 'none', color: '#fff', fontSize: '20px' }}
                            >
                                &times;
                            </button>

                            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                                <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'var(--bg-input)', margin: '0 auto 12px', overflow: 'hidden', border: '2px solid var(--primary)' }}>
                                    {viewingProfile?.profile?.profilePic ? (
                                        <img src={viewingProfile.profile.profilePic} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                                    ) : (
                                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px' }}>
                                            {(viewingProfile?.profile?.username || viewingUser.username || '?').charAt(0).toUpperCase()}
                                        </div>
                                    )}
                                </div>
                                <h2 style={{ fontSize: '20px', marginBottom: '4px' }}>{viewingProfile?.profile?.username || viewingUser.username}</h2>
                                {viewingProfile?.profile?.bio && (
                                    <p style={{ fontSize: '13px', color: '#a1a1aa', fontStyle: 'italic', margin: '0 0 16px 0' }}>
                                        "{viewingProfile.profile.bio}"
                                    </p>
                                )}

                                {viewingProfile?.stats ? (
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '16px' }}>
                                        <div style={{ background: 'var(--bg-input)', padding: '12px', borderRadius: '8px' }}>
                                            <div className="text-sm">Win Rate</div>
                                            <div style={{ fontSize: '18px', fontWeight: 'bold', color: 'var(--primary)' }}>{viewingProfile.stats.winRate}%</div>
                                        </div>
                                        <div style={{ background: 'var(--bg-input)', padding: '12px', borderRadius: '8px' }}>
                                            <div className="text-sm">Profit</div>
                                            <div style={{ fontSize: '18px', fontWeight: 'bold', color: viewingProfile.stats.profit >= 0 ? 'var(--primary)' : 'var(--accent-loss)' }}>
                                                ${viewingProfile.stats.profit.toFixed(0)}
                                            </div>
                                        </div>
                                    </div>
                                ) : <p className="text-sm">Loading stats...</p>}
                            </div>
                        </div>
                    </div>
                )
            }

            {/* --- Welcome Modal --- */}
            {
                showWelcome && (
                    <div style={{
                        position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
                        background: 'rgba(0,0,0,0.85)', zIndex: 2000,
                        display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px'
                    }}>
                        <div className="card" style={{ maxWidth: '400px', textAlign: 'center', border: '1px solid var(--primary)', background: '#000' }}>
                            <div style={{ fontSize: '48px', marginBottom: '16px' }}>👋</div>
                            <h2 style={{ fontSize: '24px', color: 'var(--primary)', marginBottom: '8px' }}>Welcome to Bet It Happens!</h2>
                            <p style={{ marginBottom: '20px', lineHeight: '1.6', color: '#e4e4e7' }}>
                                <b>Bet It Happens</b> is a social prediction market.
                                <br /><br />
                                1. <b>Pick a side</b> on real-life events.
                                <br />
                                2. <b>Wager</b> your free points.
                                <br />
                                3. <b>Climb</b> the leaderboard and earn bragging rights.
                                <br /><br />
                                <i>No real money. Just real glory.</i>
                            </p>
                            <button className="btn btn-primary" onClick={() => setShowWelcome(false)} style={{ width: '100%' }}>
                                Let's Go!
                            </button>
                        </div>
                    </div>
                )
            }
        </div >
    );
}
