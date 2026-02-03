"use client";
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useApp } from '../../lib/store';
import { collection, query, orderBy, onSnapshot, where, limit } from 'firebase/firestore';

export default function ParlayPage() {
    const { user, events, db, createParlay, placeParlayBet, getUserStats, deleteParlay } = useApp();
    const [mode, setMode] = useState('active'); // 'active' | 'create'
    const [parlays, setParlays] = useState([]);

    // Create Mode State
    const [selectedLegs, setSelectedLegs] = useState([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [expandedCategories, setExpandedCategories] = useState([]); // Track expanded categories

    // Betting State
    const [bettingParlay, setBettingParlay] = useState(null); // The parlay currently being bet on
    const [wager, setWager] = useState('');

    // Comments State
    const [expandedParlayId, setExpandedParlayId] = useState(null);
    const [parlayComments, setParlayComments] = useState([]);
    const [commentText, setCommentText] = useState('');
    const { addParlayComment } = useApp(); // Destructure new function

    // Profile Viewing State
    const [viewingUser, setViewingUser] = useState(null);
    const [viewingProfile, setViewingProfile] = useState(null);

    // Fetch User Stats when viewingUser changes
    useEffect(() => {
        if (viewingUser) {
            setViewingProfile(null);
            getUserStats(viewingUser.id).then(res => {
                if (res.success) setViewingProfile(res);
            });
        }
    }, [viewingUser]);

    // Fetch Comments for Expanded Parlay
    useEffect(() => {
        if (!expandedParlayId || !db) {
            setParlayComments([]);
            return;
        }
        const q = query(collection(db, 'comments'), where('parlayId', '==', expandedParlayId));
        const unsub = onSnapshot(q, (snap) => {
            const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            list.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
            setParlayComments(list);
        });
        return () => unsub();
    }, [expandedParlayId, db]);

    const handlePostComment = async () => {
        if (!commentText.trim()) return;
        if (!user) { alert("Login to comment"); return; }

        const res = await addParlayComment(expandedParlayId, commentText);
        if (res.success) {
            setCommentText('');
        } else {
            alert(res.error);
        }
    };

    // Fetch Parlays
    useEffect(() => {
        if (!db) return;
        // Fetch recent parlays
        const q = query(collection(db, 'parlays'), orderBy('createdAt', 'desc'), limit(50));
        const unsub = onSnapshot(q, (snap) => {
            const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            setParlays(list);
        });
        return () => unsub();
    }, [db]);

    // Helpers
    const toggleLeg = (event, outcome) => {
        // limit to 1 leg per event? usually parlays allow same game parlays but let's restrict to 1 leg per event for MVP simplicity to avoid conflicting logic
        const existingLeg = selectedLegs.find(l => l.eventId === event.id);

        if (existingLeg) {
            if (existingLeg.outcomeId === outcome.id) {
                // Remove if clicking same
                setSelectedLegs(selectedLegs.filter(l => l.eventId !== event.id));
            } else {
                // Switch outcome for same event
                const newLegs = selectedLegs.filter(l => l.eventId !== event.id);
                newLegs.push({
                    eventId: event.id,
                    eventTitle: event.title,
                    outcomeId: outcome.id,
                    label: outcome.label,
                    odds: outcome.odds
                });
                setSelectedLegs(newLegs);
            }
        } else {
            // Check max limit
            if (selectedLegs.length >= 10) {
                setError("Max 10 legs per parlay!");
                setTimeout(() => setError(''), 3000);
                return;
            }

            // Add new leg
            setSelectedLegs([...selectedLegs, {
                eventId: event.id,
                eventTitle: event.title,
                outcomeId: outcome.id,
                label: outcome.label,
                odds: outcome.odds
            }]);
        }
    };

    const toggleCategory = (category) => {
        if (expandedCategories.includes(category)) {
            setExpandedCategories(expandedCategories.filter(c => c !== category));
        } else {
            setExpandedCategories([...expandedCategories, category]);
        }
    };

    const calculateParlay = () => {
        if (selectedLegs.length < 2) return { base: 0, final: 0, bonus: 0 };
        const base = selectedLegs.reduce((acc, leg) => acc * leg.odds, 1);
        const bonus = (selectedLegs.length - 1) * 0.05;
        const final = base * (1 + bonus);
        return { base, bonus, final };
    };

    const handleCreate = async () => {
        if (selectedLegs.length < 2) {
            setError("Need at least 2 legs for a parlay.");
            return;
        }
        setIsSubmitting(true);
        setError('');
        const { base, final } = calculateParlay();

        const res = await createParlay(selectedLegs, base, final);
        if (res.success) {
            setSuccess("Parlay Created! It's now public for everyone to tail.");
            setSelectedLegs([]);
            setMode('active');
            setTimeout(() => setSuccess(''), 3000);
        } else {
            setError(res.error);
        }
        setIsSubmitting(false);
    };

    const handlePlaceBet = async () => {
        if (!bettingParlay) return;
        if (!wager || parseFloat(wager) <= 0) {
            setError("Enter a valid wager");
            return;
        }
        setIsSubmitting(true);
        const res = await placeParlayBet(bettingParlay.id, parseFloat(wager));
        if (res.success) {
            setSuccess("Bet Placed on Parlay!");
            setBettingParlay(null);
            setWager('');
            setTimeout(() => setSuccess(''), 3000);
        } else {
            setError(res.error);
        }
        setIsSubmitting(false);
    };

    const handleDelete = async (parlayId) => {
        if (!confirm('Are you sure you want to delete this parlay?')) return;
        const res = await deleteParlay(parlayId);
        if (res.success) {
            setSuccess('Parlay deleted successfully');
            setTimeout(() => setSuccess(''), 3000);
        } else {
            setError(res.error);
        }
    };

    // Filter events for creation (only Open events)
    const activeEvents = events.filter(e => e.status === 'open');

    return (
        <div className="container animate-fade" style={{ paddingBottom: '100px' }}>
            <header style={{ marginBottom: '24px', textAlign: 'center' }}>
                <h1 style={{
                    fontSize: '32px',
                    background: 'linear-gradient(to right, #4ade80, #3b82f6)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    marginBottom: '8px'
                }}>Shared Parlays</h1>
                <p className="text-sm">Build a massive multiplier. Share it. Win together.</p>
            </header>

            {/* ERROR / SUCCESS TOASTS */}
            {error && (
                <div style={{ background: 'rgba(239, 68, 68, 0.2)', border: '1px solid var(--accent-loss)', color: '#fff', padding: '12px', borderRadius: '8px', marginBottom: '16px', textAlign: 'center' }}>
                    {error}
                </div>
            )}
            {success && (
                <div style={{ background: 'rgba(34, 197, 94, 0.2)', border: '1px solid var(--primary)', color: '#fff', padding: '12px', borderRadius: '8px', marginBottom: '16px', textAlign: 'center' }}>
                    {success}
                </div>
            )}

            {/* TABS */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', background: 'var(--bg-card)', padding: '4px', borderRadius: '12px' }}>
                <button
                    onClick={() => setMode('active')}
                    className="btn"
                    style={{
                        background: mode === 'active' ? 'rgba(255,255,255,0.1)' : 'transparent',
                        color: mode === 'active' ? '#fff' : 'var(--text-muted)',
                        fontSize: '14px',
                        padding: '10px'
                    }}
                >
                    🔥 Active Parlays
                </button>
                <button
                    onClick={() => setMode('create')}
                    className="btn"
                    style={{
                        background: mode === 'create' ? 'rgba(34, 197, 94, 0.15)' : 'transparent',
                        color: mode === 'create' ? 'var(--primary)' : 'var(--text-muted)',
                        border: mode === 'create' ? '1px solid var(--primary)' : 'none',
                        fontSize: '14px',
                        padding: '10px'
                    }}
                >
                    Build New Parlay
                </button>
            </div>

            {/* MODE: ACTIVE PARLAYS */}
            {mode === 'active' && (
                <div style={{ display: 'grid', gap: '16px' }}>
                    {parlays.length === 0 && (
                        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                            No active parlays right now. Be the first to build one!
                        </div>
                    )}
                    {parlays.map(parlay => (
                        <div key={parlay.id} className="card bet-card" style={{ padding: '0' }}>
                            <div style={{ padding: '16px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#333', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px' }}>
                                            {parlay.creatorName[0].toUpperCase()}
                                        </div>
                                        <div>
                                            <div
                                                onClick={() => setViewingUser({ id: parlay.creatorId, username: parlay.creatorName })}
                                                style={{ fontSize: '14px', fontWeight: 'bold', cursor: 'pointer', textDecoration: 'underline' }}
                                            >
                                                {parlay.creatorName}
                                            </div>
                                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{new Date(parlay.createdAt).toLocaleDateString()}</div>
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontSize: '24px', fontWeight: '900', color: 'var(--primary)' }}>
                                            {parlay.finalMultiplier.toFixed(2)}x
                                        </div>
                                        <div style={{ fontSize: '11px', color: '#a1a1aa' }}>PAYOUT</div>
                                        {user?.role === 'admin' && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDelete(parlay.id);
                                                }}
                                                style={{ marginTop: '4px', fontSize: '10px', background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', border: '1px solid #ef4444', borderRadius: '4px', padding: '2px 6px', cursor: 'pointer' }}
                                            >
                                                DELETE
                                            </button>
                                        )}
                                    </div>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {parlay.legs.map((leg, idx) => (
                                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '8px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px' }}>
                                            <span style={{ color: '#fff' }}>{leg.outcomeId === 'over' ? 'Over' : leg.outcomeId === 'under' ? 'Under' : leg.label}</span>
                                            <span style={{ color: 'var(--text-muted)' }}>{leg.eventTitle}</span>
                                            <span style={{ color: '#fbbf24', fontWeight: 'bold' }}>{leg.odds}x</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div style={{ padding: '12px', background: 'rgba(0,0,0,0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                    <span style={{ color: '#fff', fontWeight: 'bold' }}>{parlay.wagersCount || 0}</span> Tailing
                                </div>
                                <button
                                    className="btn btn-primary"
                                    style={{ width: 'auto', padding: '8px 20px', fontSize: '13px' }}
                                    onClick={() => setBettingParlay(parlay)}
                                >
                                    Tail This Bet
                                </button>
                            </div>

                            {/* COMMENTS TOGGLE & SECTION */}
                            <div style={{ padding: '0 12px 12px 12px', background: 'rgba(0,0,0,0.2)', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                <div style={{ display: 'flex', justifyContent: 'center' }}>
                                    <button
                                        onClick={() => setExpandedParlayId(expandedParlayId === parlay.id ? null : parlay.id)}
                                        style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '12px', cursor: 'pointer', padding: '8px', width: '100%' }}
                                    >
                                        {expandedParlayId === parlay.id ? 'Hide Chat ▲' : 'Show Chat ▼'}
                                    </button>
                                </div>

                                {expandedParlayId === parlay.id && (
                                    <div className="animate-fade" style={{ background: 'var(--bg-app)', borderRadius: '8px', padding: '12px', marginTop: '4px' }}>
                                        <div style={{ maxHeight: '200px', overflowY: 'auto', marginBottom: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            {parlayComments.length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: '12px', textAlign: 'center' }}>No comments yet.</div>}
                                            {parlayComments.map(c => (
                                                <div key={c.id} style={{ fontSize: '13px' }}>
                                                    <span style={{ fontWeight: 'bold', color: c.userId === user?.id ? 'var(--primary)' : '#fff' }}>{c.username}: </span>
                                                    <span style={{ color: 'var(--text-muted)' }}>{c.text}</span>
                                                </div>
                                            ))}
                                        </div>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <input
                                                type="text"
                                                className="input"
                                                style={{ padding: '8px', fontSize: '13px' }}
                                                placeholder="Say something..."
                                                value={commentText}
                                                onChange={e => setCommentText(e.target.value)}
                                                onKeyDown={e => e.key === 'Enter' && handlePostComment()}
                                            />
                                            <button className="btn btn-primary" style={{ width: 'auto', padding: '0 16px' }} onClick={handlePostComment}>
                                                Send
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div >
            )}

            {/* BETTING MODAL */}
            {
                bettingParlay && (
                    <div style={{
                        position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
                        background: 'rgba(0,0,0,0.85)', zIndex: 9999,
                        display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px'
                    }} onClick={() => setBettingParlay(null)}>
                        <div className="card" style={{ width: '100%', maxWidth: '350px', border: '1px solid var(--primary)' }} onClick={e => e.stopPropagation()}>
                            <h2 style={{ marginBottom: '16px' }}>Place Bet</h2>
                            <div style={{ marginBottom: '16px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px' }}>
                                    <span>Multiplier</span>
                                    <span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>{bettingParlay.finalMultiplier.toFixed(2)}x</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px' }}>
                                    <span>Your Wager</span>
                                    <input
                                        type="number"
                                        className="input"
                                        style={{ width: '100px', padding: '4px 8px' }}
                                        value={wager}
                                        onChange={e => setWager(e.target.value)}
                                        placeholder="$"
                                        autoFocus
                                    />
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px', fontSize: '14px', borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
                                    <span>Potential Payout</span>
                                    <span style={{ color: '#fbbf24', fontWeight: 'bold' }}>
                                        ${((parseFloat(wager) || 0) * bettingParlay.finalMultiplier).toFixed(2)}
                                    </span>
                                </div>
                            </div>
                            <button className="btn btn-primary" onClick={handlePlaceBet} disabled={isSubmitting}>
                                {isSubmitting ? 'Placing...' : 'Confirm Bet'}
                            </button>
                        </div>
                    </div>
                )
            }

            {/* MODE: CREATE PARLAY */}
            {
                mode === 'create' && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px' }}>
                        {/* SLIP (Floating on Mobile bottom, Sticky on Desktop) */}
                        {selectedLegs.length > 0 && (
                            <div style={{
                                position: 'fixed', bottom: '80px', left: '16px', right: '16px',
                                background: '#18181b', border: '1px solid var(--primary)',
                                borderRadius: '12px', padding: '16px', zIndex: 50,
                                boxShadow: '0 -4px 20px rgba(0,0,0,0.5)'
                            }} className="animate-fade">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                    <span style={{ fontWeight: 'bold', color: '#fff' }}>
                                        {selectedLegs.length} Legs Selected <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 'normal' }}>(Max 10)</span>
                                    </span>
                                    <span style={{ color: 'var(--primary)', fontWeight: '900', fontSize: '18px' }}>
                                        {calculateParlay().final.toFixed(2)}x
                                    </span>
                                </div>
                                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                                    Includes {((selectedLegs.length - 1) * 5)}% Parlay Bonus
                                </p>
                                <button
                                    className="btn btn-primary"
                                    disabled={selectedLegs.length < 2 || isSubmitting}
                                    onClick={handleCreate}
                                >
                                    {isSubmitting ? 'Creating...' : 'Post Shared Parlay'}
                                </button>
                            </div>
                        )}

                        {/* EVENT LIST */}
                        <div style={{ paddingBottom: selectedLegs.length > 0 ? '140px' : '0' }}>

                            {/* EVENT LIST (Grouped by Category) */}
                            <div style={{ paddingBottom: selectedLegs.length > 0 ? '140px' : '0' }}>
                                {(() => {
                                    // 1. Get Unique Categories
                                    const uniqueCategories = [...new Set(activeEvents.map(e => e.category || 'Other'))];

                                    // 2. Define Priority Order
                                    const priorityOrder = ['Sports', 'Super Bowl', 'Pop Culture', 'Politics', 'Crypto', 'Stocks', 'Weather'];

                                    // 3. Sort Categories
                                    uniqueCategories.sort((a, b) => {
                                        const idxA = priorityOrder.indexOf(a);
                                        const idxB = priorityOrder.indexOf(b);

                                        // "Other" always goes last
                                        if (a === 'Other') return 1;
                                        if (b === 'Other') return -1;

                                        // Use priority order if available
                                        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
                                        if (idxA !== -1) return -1; // A is priority, goes first
                                        if (idxB !== -1) return 1;  // B is priority, goes first

                                        // Default alphabetical
                                        return a.localeCompare(b);
                                    });

                                    return uniqueCategories.map(category => {
                                        const categoryEvents = activeEvents.filter(e => (e.category || 'Other') === category);
                                        if (categoryEvents.length === 0) return null;

                                        if (categoryEvents.length === 0) return null;

                                        return (
                                            <div key={category} style={{ marginBottom: '24px' }}>
                                                <div
                                                    onClick={() => toggleCategory(category)}
                                                    style={{
                                                        display: 'flex',
                                                        justifyContent: 'space-between',
                                                        alignItems: 'center',
                                                        cursor: 'pointer',
                                                        marginBottom: '12px',
                                                        borderBottom: '1px solid rgba(255,255,255,0.1)',
                                                        paddingBottom: '8px'
                                                    }}
                                                >
                                                    <h2 style={{
                                                        fontSize: '18px',
                                                        color: 'var(--primary)',
                                                        textTransform: 'uppercase',
                                                        letterSpacing: '1px',
                                                        fontWeight: 'bold',
                                                        margin: 0
                                                    }}>
                                                        {category}
                                                    </h2>
                                                    <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                                                        {expandedCategories.includes(category) ? 'Hide ▲' : 'Show ▼'}
                                                    </span>
                                                </div>

                                                {expandedCategories.includes(category) && (
                                                    <div style={{ display: 'grid', gap: '12px' }} className="animate-fade">
                                                        {categoryEvents.map(event => (
                                                            <div key={event.id} className="card" style={{ marginBottom: '0' }}>
                                                                <h3 style={{ fontSize: '16px', marginBottom: '12px' }}>{event.title}</h3>
                                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '8px' }}>
                                                                    {event.outcomes.map(outcome => {
                                                                        const isSelected = selectedLegs.some(l => l.eventId === event.id && l.outcomeId === outcome.id);
                                                                        return (
                                                                            <button
                                                                                key={outcome.id}
                                                                                onClick={() => toggleLeg(event, outcome)}
                                                                                className={`outcome-btn ${isSelected ? 'selected' : ''}`}
                                                                                style={{
                                                                                    padding: '10px',
                                                                                    borderRadius: '8px',
                                                                                    border: isSelected ? '1px solid var(--primary)' : '1px solid var(--border)',
                                                                                    background: isSelected ? 'rgba(34, 197, 94, 0.1)' : 'transparent',
                                                                                    color: '#fff',
                                                                                    cursor: 'pointer',
                                                                                    textAlign: 'center'
                                                                                }}
                                                                            >
                                                                                <div style={{ fontSize: '13px', fontWeight: '600' }}>{outcome.label}</div>
                                                                                <div style={{ fontSize: '12px', color: isSelected ? 'var(--primary)' : 'var(--text-muted)' }}>
                                                                                    {outcome.odds}x
                                                                                </div>
                                                                            </button>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    });
                                })()}
                            </div>
                        </div>
                    </div>
                )
            }
            {/* --- Public User Profile Modal --- */}
            {viewingUser && (
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
                                    <div style={{ gridColumn: '1 / -1', background: 'var(--bg-input)', padding: '12px', borderRadius: '8px' }}>
                                        <div className="text-sm">Total Bets</div>
                                        <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#fff' }}>{viewingProfile.stats.total}</div>
                                    </div>
                                </div>
                            ) : <p className="text-sm">Loading stats...</p>}
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
}

