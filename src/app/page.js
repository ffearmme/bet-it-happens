"use client";
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useApp } from '../lib/store';
import { collection, query, orderBy, onSnapshot, where } from 'firebase/firestore';
import ParlayPage from './parlay/page';

const FUNNY_QUOTES = [
    "Loading luck...",
    "Consulting the betting oracle...",
    "Convincing your wallet to open...",
    "Calculating the odds of you winning...",
    "Shuffling virtual deck...",
    "Polishing the participation trophies..."
];

export default function Home() {
    const {
        user, events, bets, placeBet, isLoaded, users, systemAnnouncement,
        addComment, deleteComment, getUserStats, deleteEvent,
        signin, signup, activeEventsCount, serverTime, isGuestMode, setIsGuestMode, db,
        notifications, markNotificationAsRead, toggleLikeComment
    } = useApp(); // Used destructuring to get EVERYTHING needed from storeRef(null);
    const chatContainerRef = useRef(null);
    const [selectedOutcome, setSelectedOutcome] = useState(null);
    const [wager, setWager] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [expandedEvent, setExpandedEvent] = useState(null);
    const [eventComments, setEventComments] = useState([]);
    const [commentText, setCommentText] = useState('');
    const [showWelcome, setShowWelcome] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [now, setNow] = useState(new Date()); // Live clock
    const [expandedCategories, setExpandedCategories] = useState({});
    const [expandedResolutions, setExpandedResolutions] = useState({});
    const [showProfileNudge, setShowProfileNudge] = useState(false);
    const [streakNotification, setStreakNotification] = useState(null);
    const [showChangelog, setShowChangelog] = useState(false);
    const [showResolution, setShowResolution] = useState(false);
    const [expandedCompleted, setExpandedCompleted] = useState(false);
    const [activeTab, setActiveTab] = useState('bets'); // 'bets' | 'parlays'

    // Featured Bets Auto-Scroll
    const featuredScrollRef = useRef(null);
    const isFeaturedPaused = useRef(false);
    const hasScrolledRef = useRef(false);

    // Drag State
    const isMouseDownRef = useRef(false);
    const startXRef = useRef(0);
    const scrollLeftRef = useRef(0);
    const dragDistanceRef = useRef(0);

    useEffect(() => {
        const container = featuredScrollRef.current;
        if (!container) return;

        // Reset to 0 initially? Or wait for layout?
        // Let's rely on the loop.

        // Sub-pixel scrolling accumulator
        let scrollAccumulator = 0;
        const speed = 0.5; // Back to a reasonable base speed, but we'll use a timer or accumulator if we want it *really* slow visually.
        // Actually, user wants it "a third of that speed" which was 0.08. 
        // 0.08 pixels per frame is 4.8px per second. It's very slow.
        // To handle sub-pixel rendering issues:

        const isMobile = typeof window !== 'undefined' ? window.innerWidth <= 768 : false;
        const targetSpeed = isMobile ? 1.5 : 0.6; // Speed up strictly for mobile users

        let animationFrameId;

        const scroll = () => {
            if (container) {
                const totalWidth = container.scrollWidth;
                const singleSetWidth = totalWidth / 4;

                // Initialize scroll position to the start of Set 2 (so user can scroll left)
                if (!hasScrolledRef.current && singleSetWidth > 0 && activeEvents.length > 0) {
                    container.scrollLeft = singleSetWidth;
                    hasScrolledRef.current = true;
                }

                // Seamless Loop Logic (Bidirectional)
                // Range: Used [Set 1 ... Set 2].
                // If we hit 0 (start of Set 1), jump forward to Set 2 start (singleSetWidth).
                // If we hit 2*Width (start of Set 3), jump back to Set 2 start (singleSetWidth).
                if (Math.abs(container.scrollLeft) <= 1) {
                    // Hit left edge -> jump to middle
                    container.scrollLeft = singleSetWidth;
                } else if (container.scrollLeft >= singleSetWidth * 2) {
                    // Hit right edge of the "safe zone" -> jump back to middle
                    // Use subtraction to maintain sub-pixel offsets if we were precise, but direct assignment is safer for big jumps.
                    container.scrollLeft -= singleSetWidth;
                }

                // Auto Scroll (only if not paused)
                if (!isFeaturedPaused.current) {
                    scrollAccumulator += targetSpeed;
                    if (scrollAccumulator >= 1) {
                        const pixelsToScroll = Math.floor(scrollAccumulator);
                        container.scrollLeft += pixelsToScroll;
                        scrollAccumulator -= pixelsToScroll;
                    }
                }
            }
            animationFrameId = requestAnimationFrame(scroll);
        };
        animationFrameId = requestAnimationFrame(scroll);
        return () => cancelAnimationFrame(animationFrameId);
    }, [events, isLoaded]); // Re-run when events load to ensure ref is attached

    useEffect(() => {
        if (expandedEvent) setShowResolution(false);
    }, [expandedEvent]);

    // Guest Mode State
    // const [isGuestMode, setIsGuestMode] = useState(false); // Removed local state
    const [showAuthModal, setShowAuthModal] = useState(false);
    const [pendingOutcome, setPendingOutcome] = useState(null); // For seamless return

    // Restore pending action after login
    useEffect(() => {
        if (user && pendingOutcome) {
            setSelectedOutcome(pendingOutcome);
            setPendingOutcome(null);
            setIsGuestMode(false);
            setShowAuthModal(false);
        }
    }, [user, pendingOutcome]);

    useEffect(() => {
        // Update 'now' every second to keep time-sensitive UI (like betting deadlines) accurate
        const timer = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const [todayBetCount, setTodayBetCount] = useState(0);

    useEffect(() => {
        if (!db) return;
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const q = query(collection(db, 'bets'), where('placedAt', '>=', startOfDay.toISOString()));
        const unsub = onSnapshot(q, (snap) => setTodayBetCount(snap.size));
        return () => unsub();
    }, [db]);

    const [todayCasinoCount, setTodayCasinoCount] = useState(0);

    useEffect(() => {
        if (!db) return;
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        // Casino bets use timestamp (number), not ISO string
        const q = query(collection(db, 'casino_bets'), where('timestamp', '>=', startOfDay.getTime()));
        const unsub = onSnapshot(q, (snap) => setTodayCasinoCount(snap.size));
        return () => unsub();
    }, [db]);

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
        if (!expandedEvent || !db) {
            setEventComments([]);
            return;
        }

        // Reset state for new event so scroll logic works correctly
        setEventComments([]);
        prevCommentsLength.current = 0;

        const q = query(collection(db, 'comments'), where('eventId', '==', expandedEvent.id));
        const unsub = onSnapshot(q, (snap) => {
            const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            list.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
            setEventComments(list);
        });
        return () => unsub();
    }, [expandedEvent, db]);



    // Track previous comment count to intelligently scroll
    const prevCommentsLength = useRef(0);

    useEffect(() => {
        if (chatContainerRef.current) {
            // Scroll to bottom only if content length INCREASED (e.g. initial load or new message)
            // This prevents scrolling when liking a comment (which updates state but not length)
            if (eventComments.length > prevCommentsLength.current) {
                chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
            }
        }
        prevCommentsLength.current = eventComments.length;
    }, [eventComments]);

    // Login State
    const [isLoginMode, setIsLoginMode] = useState(true); // Toggle Login/Signup
    const [email, setEmail] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [referralCode, setReferralCode] = useState('');
    const [authError, setAuthError] = useState('');
    const [quote, setQuote] = useState(FUNNY_QUOTES[0]);

    useEffect(() => {
        setQuote(FUNNY_QUOTES[Math.floor(Math.random() * FUNNY_QUOTES.length)]);
    }, []);

    // Optimistic Logic for Liking Comments
    const handleLikeComment = (commentId, currentLikes) => {
        if (!user) {
            setShowAuthModal(true);
            return;
        }

        // 1. Optimistic Update
        const isLiked = currentLikes.includes(user.id);
        const newLikes = isLiked
            ? currentLikes.filter(id => id !== user.id)
            : [...currentLikes, user.id];

        setEventComments(prev => prev.map(c =>
            c.id === commentId ? { ...c, likes: newLikes } : c
        ));

        // 2. Server Update
        toggleLikeComment(commentId, currentLikes).catch(err => {
            console.error("Like failed, reverting:", err);
            // Revert on failure
            setEventComments(prev => prev.map(c =>
                c.id === commentId ? { ...c, likes: currentLikes } : c
            ));
        });
    };

    const handleRestrictedAction = (action) => {
        if (!user) {
            setShowAuthModal(true);
            return;
        }
        action();
    };

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

    // Helper for countdown
    const getTimeRemaining = (deadline) => {
        if (!deadline) return null;
        const total = Date.parse(deadline) - now.getTime();
        if (total <= 0) return "Closed";
        const seconds = Math.floor((total / 1000) % 60);
        const minutes = Math.floor((total / 1000 / 60) % 60);
        const hours = Math.floor((total / (1000 * 60 * 60)) % 24);
        const days = Math.floor(total / (1000 * 60 * 60 * 24));

        if (days > 0) return `${days}d ${hours}h`;
        if (hours > 0) return `${hours}h ${minutes}m`;
        return `${minutes}m ${seconds}s`;
    };
    if (!user && !isGuestMode) {
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
                    // window.location.reload(); // Removed to allow state preservation
                } else if (res.suggestedEmail) {
                    setEmail(res.suggestedEmail);
                    setAuthError(`We found your account! We switched the field to your email (${res.suggestedEmail}). Please try the password again.`);
                } else {
                    setAuthError(getFriendlyError(res.error));
                }
            } else {
                // Sign Up
                if (!username) { setAuthError('Username required'); return; }
                const res = await signup(email, username, password, referralCode);
                if (res.success) {
                    if (typeof window !== 'undefined') {
                        localStorage.setItem('justSignedUp', 'true');
                    }
                    // window.location.reload();
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
                            <>
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
                                <div className="input-group">
                                    <label className="text-sm" style={{ marginBottom: '8px', display: 'block' }}>Referral Code (Optional)</label>
                                    <input
                                        type="text"
                                        className="input"
                                        placeholder="Enter code to get $500 bonus for friend"
                                        value={referralCode}
                                        onChange={e => setReferralCode(e.target.value.toUpperCase())}
                                    />
                                </div>
                            </>
                        )}
                        <div className="input-group">
                            <label className="text-sm" style={{ marginBottom: '8px', display: 'block' }}>
                                {isLoginMode ? 'Email or Username' : 'Email'}
                            </label>
                            <input
                                type="text"
                                required
                                className="input"
                                placeholder={isLoginMode ? 'you@example.com or CoolUser123' : 'you@example.com'}
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

                    <div style={{ marginTop: '16px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '16px 0', color: '#52525b' }}>
                            <div style={{ flex: 1, height: '1px', background: 'var(--border)' }}></div>
                            <span style={{ fontSize: '12px' }}>OR</span>
                            <div style={{ flex: 1, height: '1px', background: 'var(--border)' }}></div>
                        </div>
                        <button
                            className="btn btn-outline"
                            onClick={() => setIsGuestMode(true)}
                            style={{ color: '#a1a1aa' }}
                        >
                            Browse as Guest
                        </button>
                    </div>
                </div >
            </div >
        );
    }

    // --- MAIN APP (LOGGED IN OR GUEST) ---
    const rawActiveEvents = events.filter(e => {
        // 1. Status Check
        if (e.status !== 'open' && e.status !== 'locked') return false;

        // 2. Group Access Check (Private Bets)
        // Ensure restrictedToGroup is a valid string and not empty
        if (e.restrictedToGroup && typeof e.restrictedToGroup === 'string' && e.restrictedToGroup.trim() !== '') {

            // If user is not logged in (Guest), they can't belong to a group -> HIDE
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

    const finishedEvents = events.filter(e => e.status === 'settled')
        .sort((a, b) => getDate(b.startAt) - getDate(a.startAt));

    console.log("Time:", now.toLocaleTimeString(), "Live:", activeEvents.length, "Closed:", closedEvents.length, "Pending:", pendingResolutionEvents.length);



    const handleBet = async () => {
        // GUEST CHECK
        if (!user) {
            setShowAuthModal(true);
            return;
        }

        if (isSubmitting) return; // Prevent double click

        setError('');
        setSuccess('');

        if (!wager || parseFloat(wager) <= 0) {
            setError('Enter a valid amount');
            return;
        }

        const myBetsOnThisEvent = bets.filter(b => {
            if (b.userId !== user.id) return false;
            // Single bet on this event
            if (b.eventId === selectedOutcome.eventId) return true;
            // Parlay bet containing this event
            if (b.legs && b.legs.some(leg => leg.eventId === selectedOutcome.eventId)) return true;
            return false;
        });
        if (myBetsOnThisEvent.length >= 3) {
            setError('Maximum of 3 bets allowed per event.');
            return;
        }

        setIsSubmitting(true);

        try {
            const res = await placeBet(selectedOutcome.eventId, selectedOutcome.outcomeId, parseFloat(wager));
            if (res.success) {
                setSuccess('Bet Placed Successfully! Good Luck Soldier🫡');

                // Show Streak Notification
                if (res.streakType === 'started') {
                    setStreakNotification({ type: 'start', count: res.newStreak });
                    setTimeout(() => setStreakNotification(null), 4000);
                } else if (res.streakType === 'increased') {
                    setStreakNotification({ type: 'increase', count: res.newStreak });
                    setTimeout(() => setStreakNotification(null), 4000);
                }

                setWager('');

                // Occasional Nudge for Profile Completion (33% chance)
                if ((!user.bio || !user.profilePic) && Math.random() < 0.33) {
                    setTimeout(() => setShowProfileNudge(true), 1200);
                }

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
            {/* --- GUEST AUTH MODAL --- */}
            {showAuthModal && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
                    background: 'rgba(0,0,0,0.85)', zIndex: 9999,
                    display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px'
                }} onClick={() => setShowAuthModal(false)}>
                    <div className="card animate-fade" style={{ width: '100%', maxWidth: '350px', border: '1px solid var(--primary)', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                        <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔒</div>
                        <h2 style={{ fontSize: '20px', color: '#fff', marginBottom: '8px' }}>Login Required</h2>
                        <p style={{ color: '#a1a1aa', marginBottom: '24px', lineHeight: '1.5' }}>
                            You need to be logged in to place bets, comment, and track your stats!
                        </p>
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button
                                className="btn btn-outline"
                                onClick={() => setShowAuthModal(false)}
                            >
                                Cancel
                            </button>
                            <button
                                className="btn btn-primary"
                                onClick={() => { setShowAuthModal(false); setIsGuestMode(false); }}
                            >
                                Login / Signup
                            </button>
                        </div>
                    </div>
                </div>
            )}



            {/* --- STREAK NOTIFICATION --- */}
            {streakNotification && (
                <div style={{
                    position: 'fixed', top: '20%', left: '50%', transform: 'translate(-50%, -50%)',
                    zIndex: 9999, pointerEvents: 'none',
                    animation: 'popIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                }}>
                    <div className="card" style={{
                        background: 'linear-gradient(135deg, #111 0%, #000 100%)',
                        border: '2px solid #f59e0b',
                        boxShadow: '0 0 40px rgba(245, 158, 11, 0.5)',
                        padding: '32px 48px',
                        textAlign: 'center',
                        borderRadius: '20px'
                    }}>
                        <div style={{ fontSize: '64px', marginBottom: '16px', animation: 'bounce 1s infinite' }}>🔥</div>
                        <h2 style={{
                            fontSize: '28px', fontWeight: '900', color: '#fff',
                            textTransform: 'uppercase', margin: '0 0 8px 0',
                            textShadow: '0 0 10px rgba(245, 158, 11, 0.5)'
                        }}>
                            {streakNotification.type === 'start' ? 'Streak Started!' : 'Streak Increased!'}
                        </h2>
                        <p style={{ fontSize: '18px', color: '#f59e0b', fontWeight: 'bold' }}>
                            {streakNotification.count} {streakNotification.count === 1 ? 'Day' : 'Days'} in a Row!
                        </p>
                        <p style={{ fontSize: '14px', color: '#aaa', marginTop: '8px' }}>Keep the fire burning.</p>
                    </div>
                </div>
            )}

            {/* --- SYSTEM ANNOUNCEMENT --- */}
            {/* --- SYSTEM ANNOUNCEMENT --- */}
            {/* --- SYSTEM ANNOUNCEMENT --- */}
            {/* --- SYSTEM ANNOUNCEMENT --- */}
            {user && systemAnnouncement && systemAnnouncement.active && (
                <div style={{
                    background: systemAnnouncement.type === 'warning'
                        ? 'linear-gradient(135deg, #b45309 0%, #78350f 100%)' // Bold Orange/Red
                        : systemAnnouncement.type === 'success'
                            ? 'linear-gradient(135deg, #15803d 0%, #14532d 100%)' // Bold Green
                            : 'linear-gradient(135deg, #1d4ed8 0%, #1e3a8a 100%)', // Bold Blue
                    border: '1px solid rgba(255,255,255,0.2)',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
                    padding: '16px 20px',
                    borderRadius: '12px',
                    marginBottom: '24px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                    color: '#fff',
                    textAlign: 'center',
                    maxWidth: '100%', // Ensure it doesn't exceed parent
                    width: '100%', // Explicitly set width
                    boxSizing: 'border-box' // Ensure padding is included in width
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px', flexWrap: 'wrap', justifyContent: 'center' }}>
                        <span style={{ fontSize: '20px', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' }}>
                            {systemAnnouncement.type === 'warning' ? '⚠️' : systemAnnouncement.type === 'success' ? '🔥' : '📢'}
                        </span>
                        <span style={{
                            fontSize: '12px',
                            fontWeight: '900',
                            textTransform: 'uppercase',
                            letterSpacing: '2px',
                            opacity: 0.95,
                            color: '#fff'
                        }}>
                            {systemAnnouncement.type === 'warning' ? 'ATTENTION' : systemAnnouncement.type === 'success' ? 'GOOD NEWS' : 'ANNOUNCEMENT'}
                        </span>
                    </div>

                    <p style={{ margin: 0, fontSize: '16px', fontWeight: 'bold', lineHeight: '1.4', textShadow: '0 1px 2px rgba(0,0,0,0.5)', wordBreak: 'break-word', maxWidth: '100%' }}>
                        {systemAnnouncement.message}
                    </p>
                </div>
            )}
            {/* --- GUEST MODE BANNER --- */}
            {!user && (
                <div
                    onClick={() => setIsGuestMode(false)}
                    style={{
                        background: 'linear-gradient(90deg, #f59e0b, #d97706)',
                        cursor: 'pointer',
                        padding: '12px',
                        borderRadius: '12px',
                        marginBottom: '24px',
                        marginTop: '10px',
                        textAlign: 'center',
                        boxShadow: '0 4px 15px rgba(245, 158, 11, 0.3)',
                        border: '1px solid #fbbf24',
                        animation: 'pulse 2s infinite'
                    }}
                >
                    <p style={{ margin: 0, color: '#000', fontWeight: 'bold', fontSize: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                        <span>👀 Viewing as Guest.</span>
                        <span style={{ background: '#fff', padding: '2px 8px', borderRadius: '4px', color: '#d97706' }}>Sign Up = $1000 Free! 💰</span>
                    </p>
                </div>
            )}

            <header style={{ marginBottom: '32px', paddingTop: '10px' }}>


                <div style={{ textAlign: 'center' }}>
                    <p style={{
                        fontSize: '16px',
                        color: '#fff',
                        fontWeight: '600',
                        background: 'linear-gradient(90deg, #fff, #a1a1aa)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        marginBottom: '16px',
                        marginTop: '0'
                    }}>
                        Prediction markets for real life — make predictions, earn coins, climb the leaderboard.
                    </p>

                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '24px', flexWrap: 'wrap', marginBottom: '12px' }}>
                        <div style={{
                            background: 'rgba(34, 197, 94, 0.1)',
                            border: '1px solid var(--primary)',
                            borderRadius: '12px',
                            padding: '8px 16px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            boxShadow: '0 0 15px rgba(34, 197, 94, 0.2)'
                        }}>
                            <span style={{ fontSize: '11px', color: '#fff', textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: '0.5px' }}>Bets Today</span>
                            <span style={{ fontSize: '20px', fontWeight: '900', color: '#fff', textShadow: '0 0 10px var(--primary)' }}>{todayBetCount}</span>
                        </div>
                        <div style={{
                            background: 'rgba(234, 179, 8, 0.1)',
                            border: '1px solid #eab308',
                            borderRadius: '12px',
                            padding: '8px 16px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            boxShadow: '0 0 15px rgba(234, 179, 8, 0.2)'
                        }}>
                            <span style={{ fontSize: '11px', color: '#fff', textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: '0.5px' }}>Casino Rolls</span>
                            <span style={{ fontSize: '20px', fontWeight: '900', color: '#fff', textShadow: '0 0 10px #eab308' }}>{todayCasinoCount}</span>
                        </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px' }}>
                        <p className="text-sm" style={{ background: 'var(--bg-card)', padding: '4px 12px', borderRadius: '12px', border: '1px solid var(--border)' }}>
                            Balance: <span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>
                                {user ? `$${user.balance !== undefined ? user.balance.toFixed(2) : '...'}` : '$0.00'}
                            </span></p>
                        <Link href="/rules" style={{ fontSize: '11px', color: 'var(--text-muted)', textDecoration: 'underline' }}>
                            Resolutions & Rules ℹ️
                        </Link>
                    </div>
                </div>
            </header>

            {/* TABS */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', background: 'var(--bg-card)', padding: '4px', borderRadius: '12px' }}>
                <button
                    onClick={() => setActiveTab('bets')}
                    className="btn"
                    style={{
                        flex: 1,
                        background: activeTab === 'bets' ? 'rgba(255,255,255,0.1)' : 'transparent',
                        color: activeTab === 'bets' ? '#fff' : 'var(--text-muted)',
                        fontWeight: activeTab === 'bets' ? 'bold' : 'normal',
                        fontSize: '14px',
                        padding: '10px'
                    }}
                >
                    🎲 Single Bets
                </button>
                <button
                    onClick={() => setActiveTab('parlays')}
                    className="btn"
                    style={{
                        flex: 1,
                        background: activeTab === 'parlays' ? 'rgba(34, 197, 94, 0.15)' : 'transparent',
                        color: activeTab === 'parlays' ? '#fff' : 'var(--text-muted)',
                        fontWeight: activeTab === 'parlays' ? 'bold' : 'normal',
                        border: activeTab === 'parlays' ? '1px solid var(--primary)' : 'none', // Subtle border
                        fontSize: '14px',
                        padding: '10px'
                    }}
                >
                    🔥 Parlays
                </button>
            </div>

            {activeTab === 'bets' ? (
                <>

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
                                                            {event.createdBy && (
                                                                <p style={{ fontSize: '10px', color: 'var(--primary)', fontStyle: 'italic', marginTop: '4px' }}>
                                                                    Created by {event.createdBy}
                                                                </p>
                                                            )}
                                                        </div>
                                                        <div style={{ textAlign: 'right', minWidth: '80px' }}>
                                                            <div style={{ fontSize: '11px', color: '#ef4444', fontWeight: 'bold', textTransform: 'uppercase' }}>ENDS IN</div>
                                                            <div style={{ fontFamily: 'monospace', fontSize: '15px', color: '#fff', fontWeight: 'bold' }}>
                                                                {Math.max(0, Math.floor((getDate(event.startAt) - now) / (1000 * 60 * 60 * 24)))}d :
                                                                {Math.max(0, Math.floor(((getDate(event.startAt) - now) % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)))}h
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Main Bets Buttons - Fixed Grid (Fit Screen) */}
                                                    <div style={{
                                                        display: 'grid',
                                                        gridTemplateColumns: '1fr 1fr',
                                                        gap: '16px',
                                                        marginBottom: '24px',
                                                    }}>
                                                        {event.outcomes.filter(o => o.type === 'main').map(outcome => (
                                                            <button
                                                                key={outcome.id}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    if (user) {
                                                                        setSelectedOutcome({ eventId: event.id, outcomeId: outcome.id, odds: outcome.odds, label: outcome.label, eventTitle: event.title });
                                                                    } else {
                                                                        setPendingOutcome({ eventId: event.id, outcomeId: outcome.id, odds: outcome.odds, label: outcome.label, eventTitle: event.title });
                                                                        setShowAuthModal(true);
                                                                    }
                                                                }}
                                                                className="btn"
                                                                style={{
                                                                    background: 'linear-gradient(180deg, #18181b 0%, #000 100%)',
                                                                    border: '2px solid var(--primary)',
                                                                    boxShadow: '0 0 30px rgba(34, 197, 94, 0.2)',
                                                                    padding: '24px 12px', // Reduced padding to fit screen improved
                                                                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
                                                                    transition: 'transform 0.2s',
                                                                    cursor: 'pointer',
                                                                    borderRadius: '12px',
                                                                    width: '100%'
                                                                }}
                                                            >
                                                                <span style={{ fontSize: '20px', fontWeight: '900', color: '#fff', textTransform: 'uppercase', textAlign: 'center', lineHeight: '1.2', wordBreak: 'break-word' }}>{outcome.label}</span>
                                                                <span style={{ fontSize: '18px', color: 'var(--primary)', fontWeight: 'bold' }}>x{outcome.odds.toFixed(2)}</span>
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
                                                                            if (user) {
                                                                                setSelectedOutcome({ eventId: event.id, outcomeId: outcome.id, odds: outcome.odds, label: outcome.label, eventTitle: event.title });
                                                                            } else {
                                                                                setPendingOutcome({ eventId: event.id, outcomeId: outcome.id, odds: outcome.odds, label: outcome.label, eventTitle: event.title });
                                                                                setShowAuthModal(true);
                                                                            }
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
                                        <div style={{ position: 'relative' }}>

                                            {/* Left Arrow Indicator */}
                                            <div
                                                className="scroll-arrow-left"
                                                onClick={() => {
                                                    const container = document.getElementById('superbowl-scroll-container');
                                                    if (container) {
                                                        const card = container.querySelector('.sb-carousel-item');
                                                        const scrollAmount = card ? card.offsetWidth + 16 : 320;
                                                        container.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
                                                    }
                                                }}
                                                style={{
                                                    position: 'absolute',
                                                    left: '-12px',
                                                    top: '50%',
                                                    transform: 'translateY(-50%)',
                                                    width: '40px',
                                                    height: '40px',
                                                    background: 'rgba(0,0,0,0.8)',
                                                    borderRadius: '50%',
                                                    border: '1px solid #333',
                                                    cursor: 'pointer',
                                                    zIndex: 20,
                                                    boxShadow: '0 0 15px rgba(0,0,0,0.8)',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    opacity: 0,
                                                    pointerEvents: 'none',
                                                    transition: 'opacity 0.2s',
                                                    backdropFilter: 'blur(4px)'
                                                }}
                                            >
                                                <span style={{ fontSize: '18px', color: '#fff', paddingRight: '2px' }}>❮</span>
                                            </div>

                                            {/* Scroll Container */}
                                            <div
                                                id="superbowl-scroll-container"
                                                onScroll={(e) => {
                                                    const t = e.target;
                                                    const leftArrow = t.parentElement.querySelector('.scroll-arrow-left');
                                                    const rightArrow = t.parentElement.querySelector('.scroll-arrow-right');

                                                    // Show/Hide Left
                                                    if (leftArrow) {
                                                        leftArrow.style.opacity = t.scrollLeft > 20 ? '1' : '0';
                                                        leftArrow.style.pointerEvents = t.scrollLeft > 20 ? 'auto' : 'none';
                                                    }

                                                    // Show/Hide Right
                                                    const maxScroll = t.scrollWidth - t.clientWidth - 20;
                                                    if (rightArrow) {
                                                        rightArrow.style.opacity = t.scrollLeft < maxScroll ? '1' : '0';
                                                        rightArrow.style.pointerEvents = t.scrollLeft < maxScroll ? 'auto' : 'none';
                                                    }
                                                }}
                                                style={{
                                                    display: 'flex',
                                                    gap: '16px',
                                                    overflowX: 'auto',
                                                    padding: '0 4px 16px 4px', // Add slight side padding
                                                    scrollSnapType: 'x mandatory',
                                                }}
                                            >
                                                {activeEvents.filter(e => e.category === 'Super Bowl').map(event => {
                                                    const hasMain = event.outcomes.some(o => o.type === 'main');
                                                    if (hasMain) return null; // Skip main event (already rendered above)

                                                    return (
                                                        <div key={event.id} onClick={() => setExpandedEvent(event)}
                                                            className="sb-carousel-item"
                                                            style={{
                                                                cursor: 'pointer',
                                                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                                                background: 'rgba(255, 255, 255, 0.02)',
                                                                borderRadius: '16px',
                                                                padding: '20px',
                                                                position: 'relative',
                                                                overflow: 'hidden',
                                                                scrollSnapAlign: 'center',
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
                                                                    {event.createdBy && (
                                                                        <p style={{ fontSize: '10px', color: 'var(--primary)', fontStyle: 'italic', marginTop: '2px' }}>
                                                                            By {event.createdBy}
                                                                        </p>
                                                                    )}
                                                                </div>
                                                            </div>

                                                            {/* Outcomes (Vertical inside the card for familiarity, or could be grid) */}
                                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                                                {event.outcomes.map(outcome => (
                                                                    <button
                                                                        key={outcome.id}
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            if (user) {
                                                                                setSelectedOutcome({ eventId: event.id, outcomeId: outcome.id, odds: outcome.odds, label: outcome.label, eventTitle: event.title });
                                                                            } else {
                                                                                setPendingOutcome({ eventId: event.id, outcomeId: outcome.id, odds: outcome.odds, label: outcome.label, eventTitle: event.title });
                                                                                setShowAuthModal(true);
                                                                            }
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

                                            {/* Right Arrow Indicator */}
                                            <div
                                                className="scroll-arrow-right"
                                                onClick={() => {
                                                    const container = document.getElementById('superbowl-scroll-container');
                                                    if (container) {
                                                        const card = container.querySelector('.sb-carousel-item');
                                                        const scrollAmount = card ? card.offsetWidth + 16 : 320;
                                                        container.scrollBy({ left: scrollAmount, behavior: 'smooth' });
                                                    }
                                                }}
                                                style={{
                                                    position: 'absolute',
                                                    right: '-12px',
                                                    top: '50%',
                                                    transform: 'translateY(-50%)',
                                                    width: '40px',
                                                    height: '40px',
                                                    background: 'rgba(0,0,0,0.8)',
                                                    borderRadius: '50%',
                                                    border: '1px solid #333',
                                                    cursor: 'pointer',
                                                    zIndex: 20,
                                                    boxShadow: '0 0 15px rgba(0,0,0,0.8)',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    transition: 'opacity 0.2s',
                                                    backdropFilter: 'blur(4px)'
                                                }}
                                            >
                                                <span style={{ fontSize: '18px', color: '#fff', paddingLeft: '2px' }}>❯</span>
                                            </div>
                                        </div>
                                    </div>
                                    <style jsx>{`
                                .sb-carousel-item {
                                    min-width: 320px;
                                    max-width: 320px;
                                }
                                @media (max-width: 768px) {
                                    .sb-carousel-item {
                                        min-width: calc(100vw - 64px); 
                                        max-width: calc(100vw - 64px);
                                    }
                                }
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





                    {/* --- Featured Events --- */}
                    {
                        activeEvents.filter(e => e.featured).length > 0 && (
                            <div style={{ marginBottom: '40px' }}>
                                <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', color: '#fbbf24' }}>
                                    <span style={{ fontSize: '24px' }}>🔥</span>
                                    Featured Bets
                                </h2>
                                <div
                                    ref={featuredScrollRef}
                                    // Pause on interaction (Touch/Click), NOT hover
                                    onTouchStart={() => isFeaturedPaused.current = true}
                                    onTouchEnd={() => setTimeout(() => isFeaturedPaused.current = false, 2000)}

                                    // Mouse Drag Logic
                                    onMouseDown={(e) => {
                                        isFeaturedPaused.current = true;
                                        isMouseDownRef.current = true;
                                        startXRef.current = e.pageX - featuredScrollRef.current.offsetLeft;
                                        scrollLeftRef.current = featuredScrollRef.current.scrollLeft;
                                        featuredScrollRef.current.style.cursor = 'grabbing';
                                        dragDistanceRef.current = 0; // Reset drag distance
                                    }}
                                    onMouseLeave={() => {
                                        isFeaturedPaused.current = false;
                                        isMouseDownRef.current = false;
                                        if (featuredScrollRef.current) featuredScrollRef.current.style.cursor = 'grab';
                                    }}
                                    onMouseUp={() => {
                                        isFeaturedPaused.current = false;
                                        isMouseDownRef.current = false;
                                        if (featuredScrollRef.current) featuredScrollRef.current.style.cursor = 'grab';
                                    }}
                                    onMouseMove={(e) => {
                                        if (!isMouseDownRef.current) return;
                                        e.preventDefault();
                                        const x = e.pageX - featuredScrollRef.current.offsetLeft;
                                        const walk = (x - startXRef.current) * 1.5; // Multiplier for scroll speed
                                        featuredScrollRef.current.scrollLeft = scrollLeftRef.current - walk;
                                        dragDistanceRef.current += Math.abs(walk); // Track total movement
                                    }}

                                    style={{
                                        display: 'flex',
                                        overflowX: 'auto',
                                        gap: '20px',
                                        paddingBottom: '16px',
                                        marginBottom: '24px',
                                        scrollbarWidth: 'none', // Firefox
                                        msOverflowStyle: 'none', // IE
                                        WebkitOverflowScrolling: 'touch', // Smooth mobile scroll
                                        cursor: 'grab', // Indicate draggable
                                    }}
                                >
                                    <style jsx>{`
                                div::-webkit-scrollbar {
                                    display: none;
                                }
                            `}</style>
                                    {/* Duplicate list 4 times for infinite scroll illusion */}
                                    {[...Array(4)].flatMap((_, i) =>
                                        activeEvents.filter(e => e.featured).map(event => (
                                            <div
                                                key={`${event.id}-${i}`} // Unique key
                                                className="card"
                                                onClick={(e) => {
                                                    // Provide a small buffer (e.g. 5px) to allow sloppy clicks, but prevent drags
                                                    if (dragDistanceRef.current > 5) {
                                                        e.stopPropagation();
                                                        return;
                                                    }
                                                    setExpandedEvent(event);
                                                }}
                                                style={{
                                                    minWidth: '320px', // Fixed width for horizontal scroll
                                                    maxWidth: '320px',
                                                    flexShrink: 0,
                                                    border: '1px solid #fbbf24',
                                                    background: 'linear-gradient(145deg, var(--bg-card), rgba(251, 191, 36, 0.05))',
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    cursor: 'pointer',
                                                    transition: 'transform 0.2s',
                                                    marginRight: '0' // Handled by gap
                                                }}
                                            >
                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                                                    <span className="badge" style={{ background: '#fbbf24', color: '#000', fontWeight: 'bold' }}>FEATURED</span>
                                                    <div style={{ textAlign: 'right' }}>
                                                        {event.deadline && (
                                                            <div className="text-sm" style={{ color: '#fbbf24', fontSize: '11px', fontWeight: 'bold' }}>
                                                                {getTimeRemaining(event.deadline) !== "Closed" ? `⏰ Closes in: ${getTimeRemaining(event.deadline)}` : 'Closed'}
                                                            </div>
                                                        )}
                                                        <div className="text-sm" style={{ color: '#fbbf24', opacity: 0.8, fontSize: '10px' }}>
                                                            Resolves: {new Date(event.startAt).toLocaleDateString()}
                                                        </div>
                                                    </div>
                                                </div>
                                                <h3 style={{ fontSize: '18px', marginBottom: '8px', color: '#fbbf24', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{event.title}</h3>
                                                <p className="text-sm" style={{ marginBottom: '16px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{event.description}</p>
                                                {event.createdBy && (
                                                    <p style={{ fontSize: '10px', color: '#fbbf24', fontStyle: 'italic', marginBottom: '8px' }}>
                                                        Created by {event.createdBy}
                                                    </p>
                                                )}

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
                                        ))
                                    )}
                                </div>
                            </div>
                        )
                    }


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
                                            {event.startAt && (
                                                <p className="text-sm" style={{ color: '#f59e0b', fontSize: '11px', marginTop: '4px', fontWeight: 'bold' }}>
                                                    Resolves in: {getTimeRemaining(event.startAt)}
                                                </p>
                                            )}

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

                    {/* Earn CTA - Hidden for Guests */}
                    {
                        user && (
                            <Link href="/portfolio" style={{ textDecoration: 'none' }}>
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
                        )
                    }

                    {/* --- Active Events By Category --- */}
                    {
                        (() => {
                            const grouped = {};
                            const categories = ['The Boys', 'The Fam', 'Sports', 'Video Games', 'Local/Community', 'Weather', 'Tech', 'Pop Culture', 'Other'];
                            categories.forEach(c => grouped[c] = []);

                            activeEvents.filter(e => e.category !== 'Super Bowl').forEach(e => {
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
                                                gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                                                gap: '10px'
                                            }}>
                                                {catEvents.map((event) => (
                                                    <div
                                                        key={event.id}
                                                        className="bet-card"
                                                        onClick={() => setExpandedEvent(event)}
                                                        style={{ cursor: 'pointer', padding: '10px', minHeight: 'auto', display: 'flex', flexDirection: 'column' }}
                                                    >
                                                        {/* Mini Header */}
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', alignItems: 'center' }}>
                                                            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                                                <span style={{
                                                                    width: '6px', height: '6px', borderRadius: '50%',
                                                                    background: event.status === 'open' ? '#4ade80' : '#facc15',
                                                                    boxShadow: event.status === 'open' ? '0 0 5px #4ade80' : 'none'
                                                                }}></span>
                                                                <span style={{ fontSize: '9px', fontWeight: 'bold', color: event.status === 'open' ? '#4ade80' : '#facc15' }}>
                                                                    {event.status === 'open' ? 'LIVE' : 'LOCKED'}
                                                                </span>
                                                            </div>
                                                            <span style={{ fontSize: '9px', color: '#ef4444', fontWeight: 'bold' }}>
                                                                {event.deadline && getTimeRemaining(event.deadline) !== "Closed"
                                                                    ? `⏰ ${getTimeRemaining(event.deadline)}`
                                                                    : (event.deadline ? "Closed" : '')}
                                                            </span>
                                                        </div>

                                                        <h3 style={{ fontSize: '13px', marginBottom: '4px', color: '#fff', lineHeight: '1.3', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', flex: 1 }}>{event.title}</h3>
                                                        <div style={{ fontSize: '10px', color: '#a1a1aa', fontStyle: 'italic', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                            <span>Tap for details...</span>
                                                        </div>

                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                            {event.outcomes.map(outcome => {
                                                                const isSelected = selectedOutcome?.outcomeId === outcome.id && selectedOutcome?.eventId === event.id;
                                                                return (
                                                                    <button
                                                                        key={outcome.id}
                                                                        disabled={event.status !== 'open'}
                                                                        className="btn outcome-btn"
                                                                        style={{
                                                                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                                                            padding: '6px 8px',
                                                                            borderColor: isSelected ? 'var(--primary)' : 'rgba(255,255,255,0.1)',
                                                                            background: isSelected ? 'rgba(34, 197, 94, 0.15)' : undefined,
                                                                            opacity: event.status !== 'open' ? 0.6 : 1,
                                                                            minHeight: 'auto',
                                                                            borderRadius: '6px',
                                                                            fontSize: '11px',
                                                                            gap: '8px',
                                                                            textAlign: 'left'
                                                                        }}
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            if (user) {
                                                                                setSelectedOutcome({ eventId: event.id, outcomeId: outcome.id, odds: outcome.odds, label: outcome.label, eventTitle: event.title });
                                                                            } else {
                                                                                setPendingOutcome({ eventId: event.id, outcomeId: outcome.id, odds: outcome.odds, label: outcome.label, eventTitle: event.title });
                                                                                setShowAuthModal(true);
                                                                            }
                                                                        }}
                                                                    >
                                                                        <span style={{ fontWeight: '600', color: isSelected ? '#fff' : '#e4e4e7', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{outcome.label}</span>
                                                                        <span style={{ color: '#4ade80', fontWeight: 'bold' }}>x{outcome.odds.toFixed(2)}</span>
                                                                    </button>
                                                                )
                                                            })}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            });
                        })()
                    }

                    {/* --- Finished Events --- */}
                    {
                        finishedEvents.length > 0 && (
                            <div style={{ paddingTop: '16px', borderTop: '1px dashed var(--border)' }}>
                                <div
                                    style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', cursor: 'pointer' }}
                                    onClick={() => setExpandedCompleted(!expandedCompleted)}
                                >
                                    <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0, color: 'var(--text-muted)' }}>
                                        Completed
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
                                        {expandedCompleted ? '−' : '+'}
                                    </button>
                                    {!expandedCompleted && <span className="text-sm" style={{ color: '#52525b' }}>({finishedEvents.length} events hidden)</span>}
                                </div>

                                {expandedCompleted && (
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
                                        {finishedEvents.map(event => (
                                            <div
                                                key={event.id}
                                                className="card"
                                                onClick={() => setExpandedEvent(event)}
                                                style={{
                                                    opacity: 0.8,
                                                    background: 'transparent',
                                                    border: '1px solid #27272a',
                                                    position: 'relative',
                                                    cursor: 'pointer',
                                                    transition: 'opacity 0.2s'
                                                }}
                                                onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                                                onMouseLeave={(e) => e.currentTarget.style.opacity = '0.8'}
                                            >
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                                                    <h3 style={{ fontSize: '16px', color: 'var(--text-muted)', flex: 1 }}>{event.title}</h3>
                                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                        {user && user.role === 'admin' && (
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    if (confirm('Delete this completed event?')) deleteEvent(event.id);
                                                                }}
                                                                style={{
                                                                    background: 'rgba(239, 68, 68, 0.2)', color: 'var(--accent-loss)',
                                                                    border: 'none', borderRadius: '4px', padding: '4px 8px',
                                                                    fontSize: '10px', cursor: 'pointer', fontWeight: 'bold',
                                                                    whiteSpace: 'nowrap'
                                                                }}
                                                            >
                                                                DELETE
                                                            </button>
                                                        )}
                                                        <span className="badge" style={{ background: '#27272a', color: '#fff', whiteSpace: 'nowrap' }}>ENDED</span>
                                                    </div>
                                                </div>
                                                <div style={{ fontSize: '12px', marginTop: '8px', color: '#a1a1aa', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <span>Winner: <span style={{ color: 'var(--primary)' }}>{event.outcomes.find(o => o.id === event.winnerOutcomeId)?.label}</span></span>
                                                    <span style={{ fontSize: '10px', opacity: 0.7 }}>
                                                        {new Date(event.settledAt || event.startAt).toLocaleDateString()}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
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

                                            <p className="text-sm" style={{ marginBottom: '8px', color: 'var(--primary)', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between' }}>
                                                <span>Your Balance: ${user.balance.toFixed(2)}</span>
                                                <span style={{ color: bets.filter(b => b.userId === user.id && (b.eventId === selectedOutcome.eventId || (b.legs && b.legs.some(l => l.eventId === selectedOutcome.eventId)))).length >= 3 ? 'var(--accent-loss)' : 'var(--text-muted)' }}>
                                                    Bets: {bets.filter(b => b.userId === user.id && (b.eventId === selectedOutcome.eventId || (b.legs && b.legs.some(l => l.eventId === selectedOutcome.eventId)))).length}/3
                                                </span>
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
                                    <p style={{ marginBottom: '12px', lineHeight: '1.5' }}>{expandedEvent.description}</p>

                                    {/* Resolution Criteria Toggle */}
                                    {expandedEvent.resolutionCriteria && (
                                        <div style={{ marginBottom: '24px' }}>
                                            <button
                                                onClick={() => setShowResolution(!showResolution)}
                                                style={{
                                                    background: 'transparent',
                                                    border: 'none',
                                                    color: 'var(--primary)',
                                                    fontSize: '12px',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '4px',
                                                    padding: 0,
                                                    fontWeight: 'bold'
                                                }}
                                            >
                                                {showResolution ? 'Hide Resolution Rules' : 'How This Resolves ℹ️'}
                                            </button>
                                            {showResolution && (
                                                <div className="animate-fade" style={{
                                                    marginTop: '8px',
                                                    padding: '12px',
                                                    background: 'rgba(34, 197, 94, 0.1)',
                                                    borderLeft: '2px solid var(--primary)',
                                                    fontSize: '13px',
                                                    color: '#d1d5db',
                                                    lineHeight: '1.4'
                                                }}>
                                                    {expandedEvent.resolutionCriteria}
                                                </div>
                                            )}
                                        </div>
                                    )}

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
                                                            // Close expanded event mostly? Or keep it?
                                                            // Better to keep intent.
                                                            setPendingOutcome({ eventId: expandedEvent.id, outcomeId: outcome.id, label: outcome.label, odds: outcome.odds, title: expandedEvent.title });
                                                            setExpandedEvent(null); // Close the detail view to show auth? Or does modal appear on top?
                                                            // Auth Modal has zIndex 9999, so it appears on top.
                                                            // But if we go to Login Screen, ExpandedEvent is lost?
                                                            // ExpandedEvent is state. It persists.
                                                            // So we can just show auth modal.
                                                            setShowAuthModal(true);
                                                        }
                                                    }} className="btn btn-outline"
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
                                            {eventComments.length === 0 && <p className="text-sm">No chatter yet. Start the beef!</p>}
                                            {eventComments.map(c => (
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
                                                        {users.find(u => u.id === c.userId)?.groups?.includes('Moderator') && (
                                                            <span title="Official Moderator" style={{
                                                                marginLeft: '6px',
                                                                fontSize: '8px',
                                                                display: 'inline-flex',
                                                                alignItems: 'center',
                                                                background: 'linear-gradient(135deg, #3b82f6, #1e40af)',
                                                                color: '#fff',
                                                                padding: '1px 5px',
                                                                borderRadius: '8px',
                                                                fontWeight: '900',
                                                                letterSpacing: '0.5px',
                                                                border: '1px solid rgba(59, 130, 246, 0.5)',
                                                                boxShadow: '0 0 8px rgba(59, 130, 246, 0.3)',
                                                                verticalAlign: 'middle',
                                                                lineHeight: '1'
                                                            }}>MOD ✓</span>
                                                        )}
                                                    </div>
                                                    <div style={{ fontSize: '12px', paddingRight: '16px' }}>{c.text}</div>

                                                    {/* Like Button (Heat) */}
                                                    <div style={{ display: 'flex', alignItems: 'center', marginTop: '6px' }}>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleLikeComment(c.id, c.likes || []);
                                                            }}
                                                            style={{
                                                                background: c.likes?.includes(user?.id) ? 'rgba(245, 158, 11, 0.15)' : 'rgba(255,255,255,0.05)',
                                                                border: c.likes?.includes(user?.id) ? '1px solid rgba(245, 158, 11, 0.5)' : '1px solid transparent',
                                                                cursor: 'pointer',
                                                                fontSize: '12px',
                                                                padding: '4px 10px',
                                                                borderRadius: '20px',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: '6px',
                                                                transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
                                                                transform: c.likes?.includes(user?.id) ? 'scale(1.05)' : 'scale(1)',
                                                                color: c.likes?.includes(user?.id) ? '#f59e0b' : '#a1a1aa'
                                                            }}
                                                        >
                                                            <span style={{
                                                                fontSize: '14px',
                                                                filter: c.likes?.includes(user?.id) ? 'drop-shadow(0 0 5px orange)' : 'grayscale(100%) opacity(0.5)',
                                                                transition: 'filter 0.3s ease'
                                                            }}>
                                                                🔥
                                                            </span>
                                                            <span style={{ fontWeight: 'bold', fontSize: '11px' }}>
                                                                {c.likes?.length || 0}
                                                            </span>
                                                        </button>
                                                    </div>
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
                                        <h2 style={{ fontSize: '20px', marginBottom: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                            {viewingProfile?.profile?.username || viewingUser.username}
                                            {viewingProfile?.profile?.groups?.includes('Moderator') && (
                                                <span title="Official Moderator" style={{
                                                    fontSize: '10px',
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    background: 'linear-gradient(135deg, #3b82f6, #1e40af)',
                                                    color: '#fff',
                                                    padding: '1px 5px',
                                                    borderRadius: '8px',
                                                    fontWeight: '900',
                                                    letterSpacing: '0.5px',
                                                    border: '1px solid rgba(59, 130, 246, 0.5)',
                                                    boxShadow: '0 0 8px rgba(59, 130, 246, 0.3)',
                                                    verticalAlign: 'middle',
                                                    lineHeight: '1'
                                                }}>MOD ✓</span>
                                            )}
                                        </h2>
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

                </>
            ) : (
                <ParlayPage isEmbedded={true} />
            )}

            {/* --- Profile Nudge Modal --- */}
            {
                showProfileNudge && (
                    <div style={{
                        position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
                        background: 'rgba(0,0,0,0.85)', zIndex: 2001,
                        display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px'
                    }}>
                        <div className="card animate-fade" style={{ maxWidth: '350px', textAlign: 'center', border: '1px solid var(--primary)', background: '#09090b' }}>
                            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📸</div>
                            <h2 style={{ fontSize: '20px', color: '#fff', marginBottom: '8px' }}>One small thing...</h2>
                            <p style={{ marginBottom: '20px', lineHeight: '1.5', color: '#a1a1aa', fontSize: '14px' }}>
                                Did you know you can customize your profile? Adding a <b>Bio</b> and <b>Picture</b> helps you stand out on the Leaderboard!
                            </p>
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <button
                                    className="btn"
                                    onClick={() => setShowProfileNudge(false)}
                                    style={{ flex: 1, background: 'transparent', border: '1px solid #333', color: '#888' }}
                                >
                                    Maybe Later
                                </button>
                                <Link href="/profile" className="btn btn-primary" style={{ flex: 1, textDecoration: 'none' }}>
                                    Let's Do It!
                                </Link>
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


            {/* Version Tag */}
            <div style={{ textAlign: 'center', padding: '20px 0 80px 0', color: '#333', fontSize: '10px' }}>
                <button
                    onClick={() => setShowChangelog(true)}
                    style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', textDecoration: 'underline', fontSize: '11px' }}
                >
                    System V0.97
                </button>
            </div>

            {/* --- CHANGELOG MODAL --- */}
            {
                showChangelog && (
                    <div style={{
                        position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
                        background: 'rgba(0,0,0,0.85)', zIndex: 2002,
                        display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px'
                    }} onClick={() => setShowChangelog(false)}>
                        <div className="card animate-fade" style={{ maxWidth: '500px', width: '100%', maxHeight: '80vh', overflowY: 'auto', border: '1px solid var(--border)' }} onClick={e => e.stopPropagation()}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid var(--border)', paddingBottom: '16px' }}>
                                <h2 style={{ fontSize: '20px', fontWeight: 'bold' }}>System Updates</h2>
                                <button onClick={() => setShowChangelog(false)} style={{ background: 'none', border: 'none', color: '#fff', fontSize: '24px' }}>&times;</button>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                <div>
                                    <h3 style={{ fontSize: '16px', color: 'var(--primary)', marginBottom: '8px' }}>Version 0.97 <span style={{ fontSize: '12px', color: '#666', fontWeight: 'normal' }}>(Current)</span></h3>
                                    <ul style={{ paddingLeft: '20px', color: '#d4d4d8', fontSize: '14px', lineHeight: '1.6' }}>
                                        <li><b>Squads:</b> Create or join squads to compete on the squad leaderboard! 🏆</li>
                                        <li><b>Squad Transactions:</b> Deposit and withdraw funds from your squad wallet. 💰</li>
                                        <li><b>Admin Tools:</b> Enhanced moderation for squad management. 🛡️</li>
                                    </ul>
                                </div>

                                <div>
                                    <h3 style={{ fontSize: '16px', color: '#a1a1aa', marginBottom: '8px' }}>Version 0.95</h3>
                                    <ul style={{ paddingLeft: '20px', color: '#a1a1aa', fontSize: '14px', lineHeight: '1.6' }}>
                                        <li><b>Shared Parlays:</b> Create multi-leg parlay bets and share them with the community. 🚀</li>
                                        <li><b>Dynamic Categories:</b> Parlays are auto-grouped by category (e.g., Sports, Super Bowl) for easy browsing. 📂</li>
                                        <li><b>Admin Tools:</b> Security enhanced with better moderation for shared parlays. 🛡️</li>
                                    </ul>
                                </div>

                                <div>
                                    <h3 style={{ fontSize: '16px', color: '#a1a1aa', marginBottom: '8px' }}>Version 0.90</h3>
                                    <ul style={{ paddingLeft: '20px', color: '#a1a1aa', fontSize: '14px', lineHeight: '1.6' }}>
                                        <li><b>Moderator Role:</b> Introduced new Moderator role with "MOD" badges in chat, leaderboard, and profiles. 🛡️</li>
                                        <li><b>Mod Dashboard:</b> Moderators can now review user ideas and recommend the best ones directly to Admins. 📤</li>
                                        <li><b>Live Timers:</b> Added real-time "Closes in" and "Resolves in" countdowns to all bet cards. ⏰</li>
                                        <li><b>Admin Tools:</b> Mod-recommended ideas now float to the top for faster approval.</li>
                                    </ul>
                                </div>

                                <div>
                                    <h3 style={{ fontSize: '16px', color: '#a1a1aa', marginBottom: '8px' }}>Version 0.89</h3>
                                    <ul style={{ paddingLeft: '20px', color: '#a1a1aa', fontSize: '14px', lineHeight: '1.6' }}>
                                        <li><b>Resolution Transparency:</b> Added "How This Resolves" info to bets so you know exactly what determines the winner. ℹ️</li>
                                        <li><b>Guest Mode Enhanced:</b> Better banners and simpler navigation for visiting users.</li>
                                        <li><b>Admin Stability:</b> Fixed issues with event editing overwriting new drafts.</li>
                                    </ul>
                                </div>

                                <div>
                                    <h3 style={{ fontSize: '16px', color: '#a1a1aa', marginBottom: '8px' }}>Version 0.88</h3>
                                    <ul style={{ paddingLeft: '20px', color: '#a1a1aa', fontSize: '14px', lineHeight: '1.6' }}>
                                        <li><b>Guest Mode:</b> Browse events, check the leaderboard, and explore the app without needing an account.</li>
                                        <li><b>Seamless Login:</b> Try to bet as a guest? We'll prompt you to login and place that bet for you instantly.</li>
                                        <li><b>Refined UI:</b> Cleaner home screen for guests avoiding clutter until you sign in.</li>
                                    </ul>
                                </div>

                                <div>
                                    <h3 style={{ fontSize: '16px', color: '#a1a1aa', marginBottom: '8px' }}>Version 0.87</h3>
                                    <ul style={{ paddingLeft: '20px', color: '#a1a1aa', fontSize: '14px', lineHeight: '1.6' }}>
                                        <li><b>Mobile Experience:</b> Added "Add to Home Screen" support for a native app-like experience on iOS and Android.</li>
                                        <li><b>New Logo:</b> Updated app icon for sharper look on home screens.</li>
                                        <li><b>UI Polish:</b> Fixed banner overflow issues on mobile devices and improved layout responsiveness.</li>
                                        <li><b>System:</b> Restored version tracking footer.</li>
                                    </ul>
                                </div>

                                <div>
                                    <h3 style={{ fontSize: '16px', color: '#a1a1aa', marginBottom: '8px' }}>Version 0.85</h3>
                                    <ul style={{ paddingLeft: '20px', color: '#a1a1aa', fontSize: '14px', lineHeight: '1.6' }}>
                                        <li><b>Betting Streaks:</b> Added daily streak tracking. Build your streak by betting on consecutive days! 🔥</li>
                                        <li><b>Advanced Stats:</b> "My Bets" now features a detailed dashboard with Win Rate, Profit, and Biggest Win analysis.</li>
                                        <li><b>Leaderboard Upgrades:</b> Visual indicators for active streaks.</li>
                                        <li><b>Performance:</b> Improved real-time chat sync and stats updates.</li>
                                    </ul>
                                </div>

                                <div>
                                    <h3 style={{ fontSize: '16px', color: '#a1a1aa', marginBottom: '8px' }}>Version 0.80</h3>
                                    <ul style={{ paddingLeft: '20px', color: '#a1a1aa', fontSize: '14px', lineHeight: '1.6' }}>
                                        <li><b>Private Groups:</b> Added support for group-restricted events (e.g., "The Boys").</li>
                                        <li><b>Security:</b> Enhanced admin tools and event management.</li>
                                    </ul>
                                </div>
                            </div>

                            <div style={{ marginTop: '24px', textAlign: 'center' }}>
                                <button className="btn" onClick={() => setShowChangelog(false)} style={{ background: '#333' }}>Close</button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
}
