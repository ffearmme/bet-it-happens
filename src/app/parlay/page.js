"use client";
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useApp } from '../../lib/store';
import { collection, query, orderBy, onSnapshot, where, limit } from 'firebase/firestore';

export default function ParlayPage() {
    const { user, events, db, createParlay, placeParlayBet, getUserStats, deleteParlay, bets, addParlayComment } = useApp();
    const [mode, setMode] = useState('active'); // 'active' | 'create'
    const [parlays, setParlays] = useState([]);

    // Create Mode State
    const [selectedLegs, setSelectedLegs] = useState([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [expandedCategories, setExpandedCategories] = useState([]); // Track expanded categories
    const [expandedParlays, setExpandedParlays] = useState([]); // Track expanded parlay cards

    // Betting State
    const [bettingParlay, setBettingParlay] = useState(null); // The parlay currently being bet on
    const [wager, setWager] = useState('');
    const [creationWager, setCreationWager] = useState('10'); // Default initial wager
    const [parlayTitle, setParlayTitle] = useState(''); // New State for Title

    // Collapsible Sections State
    const [openSections, setOpenSections] = useState({
        onFire: true, // Auto-open this exciting category? Or start closed? Let's auto-open for excitement.
        heatingUp: false,
        upcoming: false,
        busted: false
    });

    const toggleSection = (section) => {
        setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
    };

    // Comments State
    const [expandedParlayId, setExpandedParlayId] = useState(null);
    const [parlayComments, setParlayComments] = useState([]);
    const [commentText, setCommentText] = useState('');
    // const { addParlayComment } = useApp(); // Destructure new function (Already in main destructure above now)

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
    const isEventOpen = (event) => {
        if (!event) return false;
        if (event.status !== 'open') return false;

        const now = new Date();

        // 1. Check Deadline (Explicit Betting Cutoff)
        if (event.deadline) {
            let deadline;
            if (event.deadline.seconds) {
                deadline = new Date(event.deadline.seconds * 1000);
            } else {
                deadline = new Date(event.deadline);
            }

            if (!isNaN(deadline.getTime()) && deadline < now) {
                return false;
            }
        }

        // 2. Check startAt (Resolution Time / Game Start) - Sanity check
        if (event.startAt) {
            let start;
            if (event.startAt.seconds) {
                // Firestore Timestamp
                start = new Date(event.startAt.seconds * 1000);
            } else {
                // String or Date
                start = new Date(event.startAt);
            }

            // Check if valid date
            if (isNaN(start.getTime())) {
                console.warn("Invalid startAt for event:", event.title, event.startAt);
                return true;
            }

            // Check if start time is in the past
            if (start < new Date()) {
                return false;
            }
        }
        return true;
    };

    const toggleLeg = (event, outcome) => {
        // Loyalty Check: Prevent betting on opposite side if already verified in history
        if (bets && bets.length > 0) {
            // Check single bets
            const conflict = bets.find(b =>
                b.eventId === event.id &&
                b.outcomeId !== outcome.id &&
                b.type !== 'parlay' && // Only specific single bets block (or maybe all bets?)
                b.status === 'pending' // Only pending bets matter? Or settled too? 'Loyalty' implies pending usually.
            );

            // Note: If they have a pending parlay with the OTHER side, should that block? 
            // The prompt says "individual bet". sticking to that interpretation.
            if (conflict) {
                setError("Loyalty Check! You already bet on the other side of this event.");
                setTimeout(() => setError(''), 3000);
                return;
            }

            // check limit
            const existingCount = bets.filter(b => {
                if (b.userId !== user.id) return false;
                if (b.eventId === event.id) return true;
                if (b.legs && b.legs.some(l => l.eventId === event.id)) return true;
                return false;
            }).length;

            if (existingCount >= 3) {
                setError("Limit reached! You already have 3 bets on this event.");
                setTimeout(() => setError(''), 3000);
                return;
            }
        }

        // limit to 1 leg per event
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

    const toggleParlayLegs = (parlayId) => {
        if (expandedParlays.includes(parlayId)) {
            setExpandedParlays(expandedParlays.filter(id => id !== parlayId));
        } else {
            setExpandedParlays([...expandedParlays, parlayId]);
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

        // Validate that all legs are from OPEN events and haven't started
        const closedLeg = selectedLegs.find(leg => {
            const event = events.find(e => e.id === leg.eventId);
            return !isEventOpen(event);
        });

        if (closedLeg) {
            setError("One or more selected events have closed or started. Please remove them.");
            return;
        }
        if (!creationWager || parseFloat(creationWager) <= 0) {
            setError("Please enter a valid initial wager.");
            return;
        }
        setIsSubmitting(true);
        setError('');
        const { base, final } = calculateParlay();

        const res = await createParlay(selectedLegs, base, final, creationWager, parlayTitle);
        if (res.success) {
            setSuccess("Parlay Created & Bet Placed! Good luck!");
            setSelectedLegs([]);
            setCreationWager('10');
            setParlayTitle('');
            setMode('active');
            setTimeout(() => setSuccess(''), 3000);
        } else {
            setError(res.error);
        }
        setIsSubmitting(false);
    };

    const handlePlaceBet = async () => {
        if (!bettingParlay) return;

        // Validate that all legs are from OPEN events and haven't started
        const closedLeg = bettingParlay.legs.find(leg => {
            const event = events.find(e => e.id === leg.eventId);
            return !isEventOpen(event);
        });

        if (closedLeg) {
            setError("Cannot bet. One or more events in this parlay have closed or started.");
            return;
        }

        // Check Max Limits (3 bets per event)
        for (const leg of bettingParlay.legs) {
            const count = bets.filter(b => {
                if (b.userId !== user.id) return false;
                if (b.eventId === leg.eventId) return true;
                if (b.legs && b.legs.some(l => l.eventId === leg.eventId)) return true;
                return false;
            }).length;

            if (count >= 3) {
                setError(`Limit reached (3 max) for event: ${leg.eventTitle}`);
                return;
            }
        }
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

    // Filter events for creation (only Open & Future events)
    // Filter events for creation (only Open & Future events)
    const activeEvents = events.filter(e => isEventOpen(e));

    // --- Helper for Leg Status ---
    const getLegStatus = (leg) => {
        const event = events.find(e => e.id === leg.eventId);
        if (!event) return 'pending';
        if (event.status === 'settled' || event.winnerOutcomeId) {
            return event.winnerOutcomeId === leg.outcomeId ? 'won' : 'lost';
        }
        return 'pending';
    };

    // --- Categorize Parlays ---
    // --- Categorize Parlays ---
    const upcomingParlays = [];
    const activeParlays = []; // 1+ won, others pending
    const onFireParlays = []; // All won except 1 pending
    const lostParlays = [];

    parlays.forEach(p => {
        let legsWon = 0;
        let legsLost = 0;
        let legsPending = 0;

        p.legs.forEach(leg => {
            const status = getLegStatus(leg);
            if (status === 'won') legsWon++;
            if (status === 'lost') legsLost++;
            if (status === 'pending') legsPending++;
        });

        if (legsLost > 0) {
            lostParlays.push(p);
        } else if (legsWon > 0) {
            // It has started winning.
            // Check if it's "On Fire" (Meaning only 1 leg left)
            if (legsPending === 1 && legsWon === (p.legs.length - 1)) {
                onFireParlays.push(p);
            } else {
                activeParlays.push(p);
            }
        } else {
            // No wins, no losses -> All Pending (Upcoming)
            upcomingParlays.push(p);
        }
    });

    const renderParlayCard = (parlay) => (
        <div key={parlay.id} className="card bet-card" style={{ padding: '0', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ padding: '16px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                {parlay.title && (
                    <div style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '12px', color: '#fff' }}>
                        {parlay.title}
                    </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#333', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', overflow: 'hidden', flexShrink: 0 }}>
                            {parlay.creatorProfilePic ? (
                                <img src={parlay.creatorProfilePic} alt={parlay.creatorName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                                parlay.creatorName[0].toUpperCase()
                            )}
                        </div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                            <div
                                onClick={() => setViewingUser({ id: parlay.creatorId, username: parlay.creatorName })}
                                style={{ fontSize: '14px', fontWeight: 'bold', cursor: 'pointer', textDecoration: 'underline', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
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
                {/* Collapse/Expand Toggle (Replacing the always visible legs) */}
                <div
                    onClick={() => toggleParlayLegs(parlay.id)}
                    style={{
                        fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center',
                        padding: '8px', cursor: 'pointer', background: 'rgba(255,255,255,0.03)',
                        borderRadius: '4px', marginTop: '8px'
                    }}
                >
                    {expandedParlays.includes(parlay.id) ? 'Hide Legs ▲' : `View ${parlay.legs.length} Legs ▼`}
                </div>

                {expandedParlays.includes(parlay.id) && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }} className="animate-fade">
                        {parlay.legs.map((leg, idx) => {
                            const status = getLegStatus(leg);
                            let bg = 'rgba(255,255,255,0.03)';
                            let borderColor = 'transparent';
                            let icon = null;

                            if (status === 'won') {
                                bg = 'rgba(34, 197, 94, 0.15)';
                                borderColor = '#22c55e';
                                icon = '✅';
                            } else if (status === 'lost') {
                                bg = 'rgba(239, 68, 68, 0.15)';
                                borderColor = '#ef4444';
                                icon = '❌';
                            }

                            return (
                                <div key={idx} style={{
                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                    fontSize: '13px', padding: '8px',
                                    background: bg,
                                    border: `1px solid ${borderColor}`,
                                    borderRadius: '6px'
                                }}>
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                        <span style={{ color: status === 'lost' ? '#fca5a5' : status === 'won' ? '#86efac' : '#fff', fontWeight: 'bold' }}>
                                            {leg.outcomeId === 'over' ? 'Over' : leg.outcomeId === 'under' ? 'Under' : leg.label} {icon}
                                        </span>
                                        <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>{leg.eventTitle}</span>
                                    </div>
                                    <span style={{ color: '#fbbf24', fontWeight: 'bold' }}>{leg.odds}x</span>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
            <div style={{ padding: '12px', background: 'rgba(0,0,0,0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    <span style={{ color: '#fff', fontWeight: 'bold' }}>{parlay.wagersCount || 0}</span> Tailing
                </div>
                {/* Tailing Button Logic */}
                {(() => {
                    // Check if any leg has started/closed/settled
                    // The simplest check given our categorization: 
                    // If it's Heating Up, it means something WON.
                    // If it's Busted, it means something LOST.
                    // In both cases, we can't tail.
                    // We can check if any leg status is NOT 'pending'.
                    const hasStarted = parlay.legs.some(leg => getLegStatus(leg) !== 'pending');

                    if (hasStarted) {
                        return (
                            <button
                                className="btn"
                                style={{ width: 'auto', padding: '8px 20px', fontSize: '13px', background: 'rgba(255,255,255,0.1)', color: 'var(--text-muted)', cursor: 'not-allowed' }}
                                disabled
                            >
                                Closed
                            </button>
                        );
                    }

                    return (
                        <button
                            className="btn btn-primary"
                            style={{ width: 'auto', padding: '8px 20px', fontSize: '13px' }}
                            onClick={() => setBettingParlay(parlay)}
                        >
                            Tail This Bet
                        </button>
                    );
                })()}
            </div>

            {/* COMMENTS TOGGLE & SECTION */}
            <div style={{ padding: '0 12px 12px 12px', background: 'rgba(0,0,0,0.2)', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                <div
                    onClick={() => setExpandedParlayId(expandedParlayId === parlay.id ? null : parlay.id)}
                    style={{ cursor: 'pointer', paddingTop: '8px' }}
                >
                    {expandedParlayId === parlay.id ? (
                        <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px', paddingBottom: '4px' }}>Hide Chat ▲</div>
                    ) : (
                        parlay.lastComment ? (
                            <div style={{
                                padding: '8px 12px',
                                background: 'rgba(0,0,0,0.2)',
                                borderRadius: '8px',
                                display: 'flex', gap: '8px', alignItems: 'center',
                                border: '1px solid rgba(255,255,255,0.03)'
                            }}>
                                <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: '#27272a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', flexShrink: 0 }}>💬</div>
                                <div style={{ flex: 1, overflow: 'hidden', display: 'flex', gap: '6px', minWidth: 0 }}>
                                    <span style={{ fontWeight: 'bold', color: '#a1a1aa', flexShrink: 0 }}>{parlay.lastComment.username}:</span>
                                    <span style={{ color: '#71717a', fontStyle: 'italic', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        "{parlay.lastComment.text}"
                                    </span>
                                </div>
                                <span style={{ fontSize: '10px', color: 'var(--text-muted)', flexShrink: 0 }}>▼</span>
                            </div>
                        ) : (
                            <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>Show Chat ▼</div>
                        )
                    )}
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
        </div >
    );

    const renderOnFireCard = (parlay) => (
        <div key={parlay.id} className="card animate-pulse-slow" style={{
            padding: '0',
            background: 'linear-gradient(135deg, #2a0a0a 0%, #1a0505 100%)', // Deep red/dark theme
            border: '2px solid #ef4444',
            boxShadow: '0 0 25px rgba(239, 68, 68, 0.3)',
            position: 'relative',
            overflow: 'hidden'
        }}>
            {/* Fire Background Effect */}
            <div style={{
                position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                background: 'radial-gradient(circle at 50% 0%, rgba(239, 68, 68, 0.2), transparent 70%)',
                pointerEvents: 'none'
            }} />

            <div style={{ padding: '20px', borderBottom: '1px solid rgba(239, 68, 68, 0.3)', position: 'relative', zIndex: 1 }}>

                {/* Header: Title + Creator */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                    <div>
                        {parlay.title ? (
                            <div style={{ fontSize: '20px', fontWeight: '900', color: '#fff', textShadow: '0 0 10px rgba(239, 68, 68, 0.5)', marginBottom: '4px' }}>
                                {parlay.title}
                            </div>
                        ) : (
                            <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#fff', fontStyle: 'italic', marginBottom: '4px' }}>
                                {parlay.creatorName}'s Bet
                            </div>
                        )}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ color: '#a1a1aa', fontSize: '12px' }}>by</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: '#444', overflow: 'hidden' }}>
                                    {parlay.creatorProfilePic ? (
                                        <img src={parlay.creatorProfilePic} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    ) : (
                                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '8px' }}>
                                            {parlay.creatorName[0].toUpperCase()}
                                        </div>
                                    )}
                                </div>
                                <span style={{ color: '#fff', fontSize: '13px', fontWeight: 'bold' }}>{parlay.creatorName}</span>
                            </div>
                        </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '28px', fontWeight: '900', color: '#fbbf24', textShadow: '0 0 15px rgba(251, 191, 36, 0.4)' }}>
                            {parlay.finalMultiplier.toFixed(2)}x
                        </div>
                        <div style={{ fontSize: '10px', color: '#ef4444', fontWeight: 'bold', textTransform: 'uppercase' }}>POTENTIAL PAYOUT</div>
                    </div>
                </div>

                {/* Social Proof */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', background: 'rgba(0,0,0,0.3)', padding: '8px 12px', borderRadius: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '14px' }}>👥</span>
                        <span style={{ color: '#e5e7eb', fontSize: '13px' }}><b>{parlay.wagersCount || 0}</b> Tailing</span>
                    </div>
                    <div style={{ width: '1px', height: '12px', background: 'rgba(255,255,255,0.2)' }}></div>
                    <div style={{ fontSize: '13px', color: '#fca5a5', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        🔥 1 LEG AWAY
                    </div>
                </div>

                {/* LEGS DISPLAY (Always Expanded for On Fire) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {parlay.legs.map((leg, idx) => {
                        const status = getLegStatus(leg);
                        // Special Styles for On Fire
                        let bg = 'rgba(0,0,0,0.4)';
                        let borderColor = 'rgba(255,255,255,0.1)';
                        let icon = null;
                        let labelColor = '#d1d5db';

                        if (status === 'won') {
                            bg = 'rgba(34, 197, 94, 0.1)';
                            borderColor = 'rgba(34, 197, 94, 0.4)';
                            icon = '✅';
                            labelColor = '#86efac';
                        } else if (status === 'pending') {
                            // Highlight the pending leg!
                            bg = 'rgba(251, 191, 36, 0.1)';
                            borderColor = '#fbbf24';
                            icon = '⏳';
                            labelColor = '#fbbf24';
                        }

                        return (
                            <div key={idx} style={{
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                fontSize: '13px', padding: '10px',
                                background: bg,
                                border: `1px solid ${borderColor}`,
                                borderRadius: '6px',
                                transition: 'transform 0.2s',
                            }}>
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <span style={{ color: labelColor, fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        {icon} {leg.outcomeId === 'over' ? 'Over' : leg.outcomeId === 'under' ? 'Under' : leg.label}
                                    </span>
                                    <span style={{ color: '#a1a1aa', fontSize: '11px' }}>{leg.eventTitle}</span>
                                </div>

                                {status === 'pending' && (
                                    <div style={{ fontSize: '10px', background: '#fbbf24', color: '#000', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold', textTransform: 'uppercase' }}>
                                        Needs This
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Footer: Chat Preview */}
            <div style={{ background: 'rgba(0,0,0,0.6)', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', borderTop: '1px solid rgba(239, 68, 68, 0.2)' }}>
                {/* Chat Preview - Absolute Left */}
                {parlay.lastComment && (
                    <div
                        onClick={() => setExpandedParlayId(expandedParlayId === parlay.id ? null : parlay.id)}
                        style={{ position: 'absolute', left: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', maxWidth: '40%' }}
                    >
                        <div style={{ fontSize: '14px' }}>💬</div>
                        <div style={{ display: 'flex', gap: '4px', overflow: 'hidden', alignItems: 'center', color: '#d4d4d8', fontSize: '12px' }}>
                            <span style={{ fontWeight: 'bold', color: '#fff' }}>{parlay.lastComment.username}:</span>
                            <span style={{ fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>"{parlay.lastComment.text}"</span>
                        </div>
                    </div>
                )}

                {/* "View" Button - Centered */}
                <button
                    onClick={() => setExpandedParlayId(expandedParlayId === parlay.id ? null : parlay.id)}
                    className="btn"
                    style={{
                        fontSize: '11px',
                        padding: '6px 24px',
                        height: 'auto',
                        background: 'rgba(239, 68, 68, 0.15)',
                        color: '#fca5a5',
                        border: '1px solid rgba(239, 68, 68, 0.4)',
                        borderRadius: '20px',
                        flexShrink: 0,
                        fontWeight: 'bold',
                        letterSpacing: '0.5px'
                    }}
                >
                    CHAT
                </button>
            </div>

            {/* Expanded Chat Section (Reused logic, just need to ensure container is correct) */}
            {expandedParlayId === parlay.id && (
                <div className="animate-fade" style={{ background: '#09090b', padding: '12px', borderTop: '1px solid #333' }}>
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
                            placeholder="Cheer them on..."
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
    );

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
                <div style={{ display: 'grid', gap: '16px', maxWidth: '100%', overflowX: 'hidden' }}>
                    {parlays.length === 0 && (
                        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                            No active parlays right now. Be the first to build one!
                        </div>
                    )}

                    {/* 0. ON FIRE PARLAYS (1 LEG AWAY) */}
                    {onFireParlays.length > 0 && (
                        <div style={{ marginBottom: '32px' }}>
                            {/* Section Header */}
                            <div
                                onClick={() => toggleSection('onFire')}
                                style={{
                                    padding: '12px 0',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    marginBottom: '16px'
                                }}
                            >
                                <h2 style={{
                                    fontSize: '24px',
                                    fontWeight: '900',
                                    color: '#fff',
                                    margin: 0,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px',
                                    textShadow: '0 0 15px rgba(239, 68, 68, 0.6)',
                                    letterSpacing: '1px'
                                }}>
                                    🔥 ON FIRE <span style={{ fontSize: '14px', color: '#fca5a5', fontWeight: 'bold', background: '#991b1b', padding: '2px 8px', borderRadius: '12px' }}>{onFireParlays.length} ACTIVE</span>
                                </h2>
                                <span style={{ color: '#fff', fontSize: '14px', opacity: 0.7 }}>{openSections.onFire ? 'Collapse ▲' : 'Expand ▼'}</span>
                            </div>

                            {openSections.onFire && (
                                <div className="animate-fade" style={{
                                    display: 'flex',
                                    gap: '16px',
                                    overflowX: 'auto',
                                    margin: '0 -16px', // Break out of container padding for full bleed
                                    padding: '0 16px 24px 16px', // Add internal padding to align first item
                                    scrollSnapType: 'x mandatory',
                                    scrollbarWidth: 'none', // Firefox
                                    msOverflowStyle: 'none', // IE/Edge
                                }}>
                                    {/* Hide scrollbar for Chrome/Safari/Opera */}
                                    <style jsx>{`
                                        div::-webkit-scrollbar {
                                            display: none;
                                        }
                                    `}</style>
                                    {onFireParlays.map((parlay, idx) => (
                                        <div key={parlay.id} style={{
                                            flex: '0 0 85vw', // Use Viewport Width for consistent mobile feel
                                            maxWidth: '350px',
                                            scrollSnapAlign: 'center',
                                            marginLeft: idx === 0 ? 'calc(50% - 42.5vw)' : 0 // Center the FIRST item perfectly
                                        }}>
                                            {renderOnFireCard(parlay)}
                                        </div>
                                    ))}
                                    {/* Spacer to allow scrolling the last item into center view */}
                                    <div style={{ flex: '0 0 calc(50% - 42.5vw - 16px)' }} />
                                </div>
                            )}
                        </div>
                    )}

                    {/* 1. ACTIVE PARLAYS ("Heating Up") */}
                    {activeParlays.length > 0 && (
                        <div style={{ marginBottom: '16px', border: '1px solid rgba(74, 222, 128, 0.3)', borderRadius: '12px', background: 'rgba(74, 222, 128, 0.05)', overflow: 'hidden', maxWidth: '100%' }}>
                            <div
                                onClick={() => toggleSection('heatingUp')}
                                style={{
                                    padding: '16px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    background: 'rgba(74, 222, 128, 0.1)'
                                }}
                            >
                                <h2 style={{ fontSize: '18px', color: '#4ade80', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    🔥 Heating Up <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)', fontWeight: 'normal' }}>({activeParlays.length})</span>
                                </h2>
                                <span style={{ color: '#4ade80', fontSize: '12px' }}>{openSections.heatingUp ? '▼' : '►'}</span>
                            </div>

                            {openSections.heatingUp && (
                                <div style={{ padding: '16px', display: 'grid', gap: '16px' }} className="animate-fade">
                                    {activeParlays.map(parlay => renderParlayCard(parlay))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* 2. UPCOMING PARLAYS */}
                    {upcomingParlays.length > 0 && (
                        <div style={{ marginBottom: '16px', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '12px', background: 'rgba(255, 255, 255, 0.05)', overflow: 'hidden', maxWidth: '100%' }}>
                            <div
                                onClick={() => toggleSection('upcoming')}
                                style={{
                                    padding: '16px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    background: 'rgba(255, 255, 255, 0.05)'
                                }}
                            >
                                <h2 style={{ fontSize: '18px', color: '#fff', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    📅 Upcoming <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', fontWeight: 'normal' }}>({upcomingParlays.length})</span>
                                </h2>
                                <span style={{ color: '#aaa', fontSize: '12px' }}>{openSections.upcoming ? '▼' : '►'}</span>
                            </div>

                            {openSections.upcoming && (
                                <div style={{ padding: '16px', display: 'grid', gap: '16px' }} className="animate-fade">
                                    {upcomingParlays.map(parlay => renderParlayCard(parlay))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* 3. LOST PARLAYS */}
                    {lostParlays.length > 0 && (
                        <div style={{ marginBottom: '16px', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '12px', background: 'rgba(239, 68, 68, 0.05)', overflow: 'hidden', maxWidth: '100%' }}>
                            <div
                                onClick={() => toggleSection('busted')}
                                style={{
                                    padding: '16px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    background: 'rgba(239, 68, 68, 0.1)'
                                }}
                            >
                                <h2 style={{ fontSize: '18px', color: '#ef4444', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    💀 Busted <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', fontWeight: 'normal' }}>({lostParlays.length})</span>
                                </h2>
                                <span style={{ color: '#ef4444', fontSize: '12px' }}>{openSections.busted ? '▼' : '►'}</span>
                            </div>

                            {openSections.busted && (
                                <div style={{ padding: '16px', display: 'grid', gap: '16px', opacity: 0.75 }} className="animate-fade">
                                    {lostParlays.map(parlay => renderParlayCard(parlay))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
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

                                <div style={{ marginBottom: '12px' }}>
                                    <input
                                        type="text"
                                        className="input"
                                        style={{ width: '100%', padding: '8px', fontSize: '14px' }}
                                        placeholder="Parlay Title (Optional) e.g. 'Sunday Funday'"
                                        value={parlayTitle}
                                        onChange={e => setParlayTitle(e.target.value)}
                                        maxLength={50}
                                    />
                                </div>

                                <div style={{ marginBottom: '12px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                                    <div className="input-group" style={{ flex: 1, margin: 0 }}>
                                        <label style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '2px', display: 'block' }}>Initial Wager</label>
                                        <div style={{ position: 'relative' }}>
                                            <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#fff' }}>$</span>
                                            <input
                                                type="number"
                                                className="input"
                                                style={{ paddingLeft: '24px', height: '36px' }}
                                                value={creationWager}
                                                onChange={e => setCreationWager(e.target.value)}
                                                placeholder="10"
                                            />
                                        </div>
                                    </div>
                                    <div style={{ flex: 1, textAlign: 'right' }}>
                                        <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Potential Win</div>
                                        <div style={{ color: '#fbbf24', fontWeight: 'bold' }}>
                                            ${((parseFloat(creationWager) || 0) * calculateParlay().final).toFixed(2)}
                                        </div>
                                    </div>
                                </div>

                                <button
                                    className="btn btn-primary"
                                    disabled={selectedLegs.length < 2 || isSubmitting}
                                    onClick={handleCreate}
                                >
                                    {isSubmitting ? 'Creating...' : 'Place Bet & Share Parlay'}
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
                                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                                                                    <h3 style={{ fontSize: '16px', margin: 0 }}>{event.title}</h3>
                                                                    {(event.deadline || event.startAt) && (
                                                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                                                                            <div style={{ fontSize: '9px', textTransform: 'uppercase', color: '#ef4444', fontWeight: 'bold' }}>Betting Ends</div>
                                                                            <div style={{ fontSize: '10px', color: 'var(--text-muted)', textAlign: 'right' }}>
                                                                                {(() => {
                                                                                    // Prefer deadline, fallback to startAt
                                                                                    const dateVal = event.deadline || event.startAt;
                                                                                    if (!dateVal) return '';
                                                                                    const d = dateVal.seconds ? new Date(dateVal.seconds * 1000) : new Date(dateVal);
                                                                                    return isNaN(d.getTime()) ? 'Invalid Date' : d.toLocaleString([], { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                                                                                })()}
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </div>
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

