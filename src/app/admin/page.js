"use client";
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '../../lib/store';

import { db } from '../../lib/firebase';
import { collection, query, limit, onSnapshot } from 'firebase/firestore';

export default function Admin() {
    const { user, events, createEvent, resolveEvent, deleteEvent, updateEvent, updateEventOrder, fixStuckBets, deleteBet, toggleFeatured, ideas, deleteIdea, users, deleteUser, updateUserGroups, syncEventStats, recalculateLeaderboard, backfillLastBetPercent, isLoaded, updateSystemAnnouncement, systemAnnouncement } = useApp();
    const router = useRouter();

    // State for Creating Events
    const [newEvent, setNewEvent] = useState({
        title: '', description: '', resolutionCriteria: '', outcome1: '', odds1: '', outcome2: '', odds2: '', deadline: '', startAt: '', category: 'Uncategorized', createdBy: ''
    });

    // State for Editing Events (Separated to avoid conflicts)
    const [editingEvent, setEditingEvent] = useState(null);

    const [editingId, setEditingId] = useState(null);
    const [showRules, setShowRules] = useState(false);
    const [allBets, setAllBets] = useState([]);
    const [showEditModal, setShowEditModal] = useState(false);
    const [collapsed, setCollapsed] = useState({
        form: true,
        resolve: true,
        edit: true,
        ideas: true,
        users: true,
        bets: true,
        announce: true
    });

    const toggle = (key) => setCollapsed(prev => ({ ...prev, [key]: !prev[key] }));
    const Minimizer = ({ section }) => (
        <div style={{
            background: 'var(--bg-input)',
            width: '28px', height: '28px',
            borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '14px', color: '#888',
            marginLeft: 'auto'
        }}>
            {collapsed[section] ? '+' : '−'}
        </div>
    );

    const sectionHeaderStyle = (isOpen) => ({
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px',
        margin: '-16px -16px ' + (isOpen ? '16px' : '-16px'), // Negative margin to fill card width
        borderBottom: isOpen ? '1px solid var(--border)' : 'none',
        cursor: 'pointer',
        borderRadius: isOpen ? '12px 12px 0 0' : '12px',
        background: 'rgba(255,255,255,0.02)',
        transition: 'all 0.2s'
    });

    useEffect(() => {
        if (isLoaded && (!user || user.role !== 'admin')) {
            router.push('/');
        }
    }, [user, isLoaded, router]);

    // Fetch Global Bets (Admin Only)
    useEffect(() => {
        if (!user || user.role !== 'admin') return;

        const q = query(collection(db, 'bets'), limit(50));
        const unsub = onSnapshot(q, (snapshot) => {
            const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            list.sort((a, b) => new Date(b.placedAt) - new Date(a.placedAt));
            setAllBets(list);
        });
        return () => unsub();
    }, [user]);

    if (!isLoaded) return null;
    if (!user || user.role !== 'admin') return null;

    const handleCreate = async (e) => {
        e.preventDefault();
        // Create Logic Only
        const outcomes = [];
        if (newEvent.outcome1 && newEvent.outcome2) {
            outcomes.push({ id: 'o-' + Date.now() + '-1', label: newEvent.outcome1, odds: parseFloat(newEvent.odds1), type: 'sub' });
            outcomes.push({ id: 'o-' + Date.now() + '-2', label: newEvent.outcome2, odds: parseFloat(newEvent.odds2), type: 'sub' });
        }

        createEvent({
            title: newEvent.title,
            description: newEvent.description,
            resolutionCriteria: newEvent.resolutionCriteria || '',
            category: newEvent.category,
            restrictedToGroup: ['The Boys', 'The Fam'].includes(newEvent.category) ? newEvent.category : null,
            startAt: newEvent.startAt || new Date(Date.now() + 86400000).toISOString(),
            deadline: newEvent.deadline || null,
            createdBy: newEvent.createdBy || null,
            outcomes: outcomes
        });
        setNewEvent({ title: '', description: '', resolutionCriteria: '', outcome1: '', odds1: '', outcome2: '', odds2: '', deadline: '', startAt: '', category: 'Uncategorized', createdBy: '' });
        alert("Event Created!");
    };

    const handleUpdate = async (e) => {
        e.preventDefault();
        if (!editingId || !editingEvent) return;
        await updateEvent(editingId, {
            title: editingEvent.title,
            description: editingEvent.description,
            resolutionCriteria: editingEvent.resolutionCriteria || '',
            startAt: editingEvent.startAt,
            deadline: editingEvent.deadline,
            category: editingEvent.category
        });
        alert('Event updated!');
        setShowEditModal(false);
        setEditingId(null);
        setEditingEvent(null);
    };

    const startEdit = (event) => {
        setEditingId(event.id);
        setEditingEvent({
            title: event.title,
            description: event.description,
            resolutionCriteria: event.resolutionCriteria || '',
            deadline: event.deadline || '',
            startAt: event.startAt || '',
            category: event.category || 'Uncategorized'
        });
        setShowEditModal(true);
    };

    return (
        <div className="container animate-fade">
            <h1 style={{ marginTop: '20px' }}>Admin Dashboard</h1>

            <div className="card">
                <div onClick={() => toggle('form')} style={sectionHeaderStyle(!collapsed.form)}>
                    <h2 style={{ fontSize: '18px', margin: 0 }}>Create Event</h2>
                    <Minimizer section="form" />
                </div>
                {!collapsed.form && (
                    <form onSubmit={handleCreate}>
                        <div className="input-group">
                            <input className="input" placeholder="Event Title" value={newEvent.title} onChange={e => setNewEvent({ ...newEvent, title: e.target.value })} required />
                        </div>
                        <div className="input-group">
                            <label className="text-sm">Category</label>
                            <select className="input" value={newEvent.category || 'Uncategorized'} onChange={e => setNewEvent({ ...newEvent, category: e.target.value })} style={{ background: 'var(--bg-card)', color: '#fff' }}>
                                <option value="Uncategorized">Uncategorized</option>
                                <option value="Super Bowl">Super Bowl 🏆</option>
                                <option value="Sports">Sports</option>
                                <option value="Video Games">Video Games</option>
                                <option value="Local/Community">Local/Community</option>
                                <option value="Weather">Weather</option>
                                <option value="Tech">Tech</option>
                                <option value="Pop Culture">Pop Culture</option>
                                <option disabled>───────</option>
                                <option value="The Boys">🔒 The Boys</option>
                                <option value="The Fam">🔒 The Fam</option>
                            </select>
                        </div>
                        <div className="input-group">
                            <input className="input" placeholder="Description" value={newEvent.description} onChange={e => setNewEvent({ ...newEvent, description: e.target.value })} required />
                        </div>
                        <div className="input-group">
                            <label className="text-sm">How This Resolves (Optional)</label>
                            <textarea
                                className="input"
                                placeholder="Details on exactly what determines the winner..."
                                style={{ height: '60px', fontFamily: 'inherit' }}
                                value={newEvent.resolutionCriteria || ''}
                                onChange={e => setNewEvent({ ...newEvent, resolutionCriteria: e.target.value })}
                            />
                        </div>
                        <div className="input-group">
                            <label className="text-sm">Created By (Optional)</label>
                            <input
                                className="input"
                                placeholder="Username (e.g. 'CoolUser123')"
                                value={newEvent.createdBy || ''}
                                onChange={e => setNewEvent({ ...newEvent, createdBy: e.target.value })}
                            />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                            <div className="input-group">
                                <label className="text-sm">Deadline</label>
                                <input className="input" type="datetime-local" value={newEvent.deadline} onChange={e => setNewEvent({ ...newEvent, deadline: e.target.value })} />
                            </div>
                            <div className="input-group">
                                <label className="text-sm">Resolution Date</label>
                                <input className="input" type="datetime-local" required value={newEvent.startAt} onChange={e => setNewEvent({ ...newEvent, startAt: e.target.value })} />
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '8px', marginBottom: '8px' }}>
                            <input className="input" placeholder="Outcome A" value={newEvent.outcome1 || ''} onChange={e => setNewEvent({ ...newEvent, outcome1: e.target.value })} />
                            <input className="input" type="number" step="0.01" placeholder="Odds" value={newEvent.odds1 || ''} onChange={e => setNewEvent({ ...newEvent, odds1: e.target.value })} />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '8px', marginBottom: '16px' }}>
                            <input className="input" placeholder="Outcome B" value={newEvent.outcome2 || ''} onChange={e => setNewEvent({ ...newEvent, outcome2: e.target.value })} />
                            <input className="input" type="number" step="0.01" placeholder="Odds" value={newEvent.odds2 || ''} onChange={e => setNewEvent({ ...newEvent, odds2: e.target.value })} />
                        </div>

                        <button className="btn btn-primary" style={{ width: '100%' }}>Create Event</button>
                    </form>
                )}
            </div>

            <div className="card">
                <div onClick={() => toggle('resolve')} style={sectionHeaderStyle(!collapsed.resolve)}>
                    <h2 style={{ fontSize: '18px', margin: 0 }}>Resolve Events</h2>
                    <Minimizer section="resolve" />
                </div>
                {!collapsed.resolve && (() => {
                    const activeEvents = events.filter(e => e.status === 'open' || e.status === 'locked');
                    if (activeEvents.length === 0) return <p className="text-sm">No active events to resolve.</p>;

                    activeEvents.sort((a, b) => new Date(a.deadline || a.startAt) - new Date(b.deadline || b.startAt));

                    return activeEvents.map(event => (
                        <div key={event.id} style={{ border: '1px solid #333', borderRadius: '8px', padding: '12px', marginBottom: '12px', background: 'rgba(255,255,255,0.02)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                <div>
                                    <p style={{ fontWeight: 600 }}>{event.title}</p>
                                    <p style={{ fontSize: '11px', color: '#666' }}>ID: {event.id}</p>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <p style={{ fontSize: '11px', color: '#ef4444', fontWeight: 'bold' }}>
                                        DEADLINE: {new Date(event.deadline || event.startAt).toLocaleString()}
                                    </p>
                                    <p style={{ fontSize: '11px', color: '#3b82f6', fontWeight: 'bold' }}>
                                        RESOLVE: {new Date(event.startAt).toLocaleString()}
                                    </p>
                                </div>
                            </div>

                            {(() => {
                                let pairs = [];
                                for (let i = 0; i < event.outcomes.length; i += 2) pairs.push(event.outcomes.slice(i, i + 2));
                                const mainPairs = pairs.filter(p => p.some(o => o.type === 'main'));
                                const subPairs = pairs.filter(p => !p.some(o => o.type === 'main'));

                                const renderPair = (pair) => (
                                    <div key={pair[0].id} style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                                        {pair.map(o => (
                                            <button
                                                key={o.id}
                                                className="btn btn-outline"
                                                style={{ flex: 1, fontSize: '11px', padding: '8px', borderColor: '#444' }}
                                                onClick={async () => {
                                                    if (window.confirm(`RESOLVE: ${o.label} WINS?`)) {
                                                        await resolveEvent(event.id, o.id);
                                                    }
                                                }}
                                            >
                                                <span style={{ fontSize: '12px', fontWeight: 'bold' }}>{o.label}</span>
                                                <span style={{ display: 'block', fontSize: '10px', color: '#888' }}>x{o.odds}</span>
                                                <div style={{ color: 'var(--primary)', fontWeight: 'bold', fontSize: '10px' }}>WINNER?</div>
                                            </button>
                                        ))}
                                    </div>
                                );

                                return (
                                    <div>
                                        {mainPairs.map(p => renderPair(p))}
                                        {subPairs.length > 0 && <div style={{ borderBottom: '1px solid #333', margin: '8px 0' }}></div>}
                                        {subPairs.map(p => renderPair(p))}
                                    </div>
                                );
                            })()}
                        </div>
                    ));
                })()}
            </div>

            <div className="card">
                <div onClick={() => toggle('edit')} style={sectionHeaderStyle(!collapsed.edit)}>
                    <h2 style={{ fontSize: '18px', margin: 0 }}>Edit Events</h2>
                    <Minimizer section="edit" />
                </div>
                {!collapsed.edit && (() => {
                    const activeEvents = events.filter(e => e.status === 'open' || e.status === 'locked');
                    if (activeEvents.length === 0) return <p className="text-sm">No active events.</p>;

                    const grouped = activeEvents.reduce((acc, event) => {
                        const cat = event.category || 'Uncategorized';
                        if (!acc[cat]) acc[cat] = [];
                        acc[cat].push(event);
                        return acc;
                    }, {});

                    const sortedCategories = Object.keys(grouped).sort((a, b) => {
                        if (a === 'Super Bowl') return -1;
                        if (b === 'Super Bowl') return 1;
                        return a.localeCompare(b);
                    });

                    return sortedCategories.map(category => (
                        <div key={category} style={{ marginBottom: '24px' }}>
                            <h3 style={{
                                fontSize: '14px',
                                textTransform: 'uppercase',
                                color: category === 'Super Bowl' ? 'var(--primary)' : '#a1a1aa',
                                borderBottom: '1px solid #333',
                                paddingBottom: '4px',
                                marginBottom: '12px'
                            }}>
                                {category}
                            </h3>
                            {grouped[category].map(event => (
                                <div key={event.id} style={{ border: '1px solid #333', borderRadius: '8px', padding: '12px', marginBottom: '12px', background: 'rgba(255,255,255,0.02)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div>
                                            <p style={{ fontWeight: 600 }}>{event.title}</p>
                                            <p style={{ fontSize: '11px', color: '#888' }}>{event.description}</p>
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-end' }}>
                                            <button
                                                onClick={() => startEdit(event)}
                                                style={{ background: 'transparent', border: '1px solid var(--primary)', color: 'var(--primary)', cursor: 'pointer', fontSize: '11px', padding: '4px 12px', borderRadius: '4px' }}
                                            >
                                                Edit Details
                                            </button>
                                            <button
                                                onClick={() => { if (confirm('Delete event?')) deleteEvent(event.id) }}
                                                style={{ background: 'transparent', border: 'none', color: 'var(--accent-loss)', cursor: 'pointer', fontSize: '11px' }}
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    </div>
                                    <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                                        <button
                                            onClick={() => toggleFeatured(event.id, event.featured)}
                                            style={{
                                                background: event.featured ? 'var(--primary)' : 'transparent',
                                                color: event.featured ? '#000' : 'var(--primary)',
                                                border: '1px solid var(--primary)',
                                                padding: '4px 8px',
                                                borderRadius: '4px',
                                                fontSize: '11px',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            {event.featured ? '★ Featured' : '☆ set Featured'}
                                        </button>

                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#333', padding: '2px 6px', borderRadius: '4px' }}>
                                            <span style={{ fontSize: '10px', color: '#aaa', marginRight: '4px' }}>Sort: {event.order ?? 'Auto'}</span>
                                            <button onClick={() => updateEventOrder(event.id, (event.order ?? 9999) - 1)} style={{ cursor: 'pointer', background: 'none', border: 'none', color: '#fff', fontSize: '12px' }}>⬆</button>
                                            <button onClick={() => updateEventOrder(event.id, (event.order ?? 9999) + 1)} style={{ cursor: 'pointer', background: 'none', border: 'none', color: '#fff', fontSize: '12px' }}>⬇</button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ));
                })()}
            </div>

            <div className="card">
                <div onClick={() => toggle('ideas')} style={sectionHeaderStyle(!collapsed.ideas)}>
                    <h2 style={{ fontSize: '18px', margin: 0 }}>User Bet Ideas</h2>
                    <Minimizer section="ideas" />
                </div>

                {!collapsed.ideas && (ideas && ideas.length > 0 ? (
                    ideas.sort((a, b) => {
                        // Priority 1: Mod Recommended
                        if (a.modRecommended && !b.modRecommended) return -1;
                        if (!a.modRecommended && b.modRecommended) return 1;
                        // Priority 2: Date
                        return new Date(b.submittedAt) - new Date(a.submittedAt);
                    }).map(idea => (
                        <div key={idea.id} style={{
                            borderBottom: '1px solid var(--border)',
                            paddingBottom: '12px',
                            marginBottom: '12px',
                            background: idea.modRecommended ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                            border: idea.modRecommended ? '1px solid #3b82f6' : 'none',
                            padding: idea.modRecommended ? '12px' : '0 0 12px 0',
                            borderRadius: idea.modRecommended ? '8px' : '0'
                        }}>
                            {idea.modRecommended && (
                                <div style={{ fontSize: '10px', color: '#3b82f6', fontWeight: 'bold', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    🛡️ RECOMMENDED BY {idea.recommendedBy?.toUpperCase() || 'MOD'}
                                </div>
                            )}
                            <p style={{ fontWeight: 600, fontSize: '14px', marginBottom: '4px' }}>"{idea.text}"</p>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <span className="text-sm" style={{ fontSize: '12px', color: 'var(--primary)', marginRight: '8px' }}>By: {idea.username}</span>
                                    <span className="text-sm" style={{ fontSize: '10px' }}>{new Date(idea.submittedAt).toLocaleDateString()}</span>
                                </div>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <button
                                        onClick={() => {
                                            setNewEvent({
                                                ...newEvent,
                                                title: idea.text,
                                                description: `Suggested by ${idea.username}`,
                                                createdBy: idea.username,
                                                category: 'Community' // Default to a community category? or keep Uncategorized
                                            });
                                            setCollapsed(prev => ({ ...prev, form: false }));
                                            window.scrollTo({ top: 0, behavior: 'smooth' });
                                        }}
                                        style={{ background: 'var(--primary)', border: 'none', cursor: 'pointer', color: '#000', fontSize: '10px', padding: '4px 8px', borderRadius: '4px', fontWeight: 'bold' }}
                                    >
                                        CONVERT TO BET
                                    </button>
                                    <button
                                        onClick={() => { if (confirm('Delete idea?')) deleteIdea(idea.id) }}
                                        style={{ background: 'var(--accent-loss)', border: 'none', cursor: 'pointer', color: '#fff', fontSize: '10px', padding: '4px 8px', borderRadius: '4px', fontWeight: 'bold' }}
                                    >
                                        DELETE IDEA
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))
                ) : (
                    <p className="text-sm">No ideas submitted yet.</p>
                ))}
            </div>

            <div className="card">
                <div onClick={() => toggle('users')} style={sectionHeaderStyle(!collapsed.users)}>
                    <h2 style={{ fontSize: '18px', margin: 0 }}>Manage Users</h2>
                    <Minimizer section="users" />
                </div>
                {!collapsed.users && (
                    <div style={{ maxHeight: '400px', overflowY: 'auto', paddingRight: '4px' }}>
                        {users.sort((a, b) => (b.balance || 0) - (a.balance || 0)).map(u => (
                            <div key={u.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', padding: '12px 0' }}>
                                <div>
                                    <div style={{ fontWeight: 'bold' }}>{u.username} <span style={{ fontSize: '10px', color: '#666', fontWeight: 'normal' }}>({u.role})</span></div>
                                    <div style={{ fontSize: '12px', color: '#888' }}>ID: {u.id} • Balance: ${u.balance?.toFixed(2)}</div>
                                </div>
                                {u.id !== user.id && (
                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                        <div style={{ display: 'flex', gap: '4px' }}>
                                            {['The Boys', 'The Fam', 'Moderator'].map(g => {
                                                const hasGroup = (u.groups || []).includes(g);
                                                const isMod = g === 'Moderator';
                                                return (
                                                    <button
                                                        key={g}
                                                        onClick={() => {
                                                            const current = u.groups || [];
                                                            const newGroups = hasGroup ? current.filter(x => x !== g) : [...current, g];
                                                            updateUserGroups(u.id, newGroups);
                                                        }}
                                                        style={{
                                                            padding: '2px 6px', fontSize: '10px',
                                                            background: hasGroup ? (isMod ? '#3b82f6' : 'var(--primary)') : '#333',
                                                            color: hasGroup ? '#000' : '#888',
                                                            border: 'none', borderRadius: '4px', cursor: 'pointer',
                                                            fontWeight: isMod ? 'bold' : 'normal'
                                                        }}
                                                    >
                                                        {g === 'Moderator' ? '🛡️ Mod' : g}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                        <button
                                            className="btn btn-outline"
                                            style={{ padding: '4px 8px', fontSize: '12px', color: 'var(--accent-loss)', borderColor: 'var(--accent-loss)' }}
                                            onClick={async () => {
                                                if (confirm(`Permanently delete user "${u.username}" and all their data?`)) {
                                                    const res = await deleteUser(u.id);
                                                    if (res.success) alert('User deleted.');
                                                    else alert('Error: ' + res.error);
                                                }
                                            }}
                                        >
                                            Delete
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="card">
                <div onClick={() => toggle('bets')} style={sectionHeaderStyle(!collapsed.bets)}>
                    <h2 style={{ fontSize: '18px', margin: 0 }}>Recent Bets</h2>
                    <Minimizer section="bets" />
                </div>
                {!collapsed.bets && (allBets.length === 0 ? <p className="text-sm">No bets placed yet.</p> : (
                    <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                        {allBets.map(bet => {
                            const betUser = users.find(u => u.id === bet.userId);
                            const displayName = bet.username || betUser?.username || (bet.userId ? bet.userId.slice(0, 8) : 'User');

                            return (
                                <div key={bet.id} style={{ borderBottom: '1px solid var(--border)', paddingBottom: '8px', marginBottom: '8px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <div>
                                            <span style={{ fontWeight: 'bold', color: 'var(--primary)', marginRight: '8px' }}>{displayName}</span>
                                            {bet.status !== 'pending' && <span style={{ fontSize: '10px', background: '#333', padding: '2px 4px', borderRadius: '4px' }}>{bet.status.toUpperCase()}</span>}
                                        </div>
                                        <div>
                                            <span style={{ fontSize: '12px', color: '#888', marginRight: '8px' }}>{new Date(bet.placedAt).toLocaleTimeString()}</span>
                                            <button
                                                onClick={async () => {
                                                    if (confirm('Delete this bet record? (History only, no refund)')) {
                                                        const res = await deleteBet(bet.id);
                                                        if (!res.success) alert(res.error);
                                                    }
                                                }}
                                                style={{ color: 'var(--accent-loss)', border: 'none', background: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold' }}
                                                title="Delete Bet Record"
                                            >
                                                ×
                                            </button>
                                        </div>
                                    </div>
                                    <div style={{ fontSize: '14px' }}>
                                        Bet <b>${bet.amount}</b> on <b>{bet.outcomeLabel}</b>
                                        <br />
                                        <span style={{ fontSize: '12px', color: '#666' }}>{bet.eventTitle}</span>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                ))}
            </div>

            {/* --- SYSTEM ANNOUNCEMENT SECTION --- */}
            <div className="card" style={{ marginTop: '20px', border: '1px solid #eab308' }}>
                <div onClick={() => toggle('announce')} style={{ ...sectionHeaderStyle(!collapsed.announce), background: 'rgba(234, 179, 8, 0.1)', borderBottom: !collapsed.announce ? '1px solid #eab308' : 'none' }}>
                    <h2 style={{ fontSize: '18px', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>📣 System Announcement</h2>
                    <Minimizer section="announce" />
                </div>
                {!collapsed.announce && (
                    <div style={{ marginTop: '16px' }}>
                        <p className="text-sm" style={{ marginBottom: '12px', color: '#a1a1aa' }}>
                            Post a global message to all users (Bug fixes, downtime, updates).
                        </p>

                        <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                            <input
                                id="announce-input"
                                type="text"
                                className="input"
                                placeholder="Message... (e.g. 'We are fixing the payout bug!')"
                                defaultValue={systemAnnouncement?.message || ''}
                            />
                            <select id="announce-type" className="input" style={{ width: '100px' }} defaultValue={systemAnnouncement?.type || 'info'}>
                                <option value="info">Info ℹ️</option>
                                <option value="success">Good ✅</option>
                                <option value="warning">Warn ⚠️</option>
                            </select>
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                                className="btn btn-primary"
                                onClick={async () => {
                                    const msg = document.getElementById('announce-input').value;
                                    const type = document.getElementById('announce-type').value;
                                    if (!msg) return alert("Enter a message");
                                    const res = await updateSystemAnnouncement({ message: msg, type, active: true, postedAt: new Date().toISOString() });
                                    if (res.success) alert("Announcement Posted!");
                                }}
                            >
                                Post Announcement
                            </button>
                            <button
                                className="btn"
                                style={{ background: '#333' }}
                                onClick={async () => {
                                    const res = await updateSystemAnnouncement({ active: false });
                                    if (res.success) alert("Announcement Cleared!");
                                }}
                            >
                                Clear
                            </button>
                        </div>
                    </div>
                )}
            </div>



            {/* --- EDIT MODAL --- */}
            {
                showEditModal && editingEvent && (
                    <div style={{
                        position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
                        background: 'rgba(0,0,0,0.85)', zIndex: 9999,
                        display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px'
                    }}>
                        <div className="card" style={{ width: '100%', maxWidth: '500px', border: '1px solid var(--primary)', maxHeight: '90vh', overflowY: 'auto' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                                <h2 style={{ fontSize: '20px' }}>Edit Event</h2>
                                <button onClick={() => setShowEditModal(false)} style={{ color: '#888', background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer' }}>×</button>
                            </div>
                            <form onSubmit={handleUpdate}>
                                <div className="input-group">
                                    <label className="text-sm">Title</label>
                                    <input className="input" value={editingEvent.title} onChange={e => setEditingEvent({ ...editingEvent, title: e.target.value })} required />
                                </div>
                                <div className="input-group">
                                    <label className="text-sm">Category</label>
                                    <select className="input" value={editingEvent.category || 'Uncategorized'} onChange={e => setEditingEvent({ ...editingEvent, category: e.target.value })} style={{ background: 'var(--bg-card)', color: '#fff' }}>
                                        <option value="Uncategorized">Uncategorized</option>
                                        <option value="Super Bowl">Super Bowl 🏆</option>
                                        <option value="Sports">Sports</option>
                                        <option value="Video Games">Video Games</option>
                                        <option value="Local/Community">Local/Community</option>
                                        <option value="Weather">Weather</option>
                                        <option value="Tech">Tech</option>
                                        <option value="Pop Culture">Pop Culture</option>
                                        <option disabled>───────</option>
                                        <option value="The Boys">🔒 The Boys</option>
                                        <option value="The Fam">🔒 The Fam</option>
                                    </select>
                                </div>
                                <div className="input-group">
                                    <label className="text-sm">Description</label>
                                    <textarea className="input" style={{ height: '80px', fontFamily: 'inherit' }} value={editingEvent.description} onChange={e => setEditingEvent({ ...editingEvent, description: e.target.value })} required />
                                </div>
                                <div className="input-group">
                                    <label className="text-sm">How This Resolves</label>
                                    <textarea
                                        className="input"
                                        style={{ height: '60px', fontFamily: 'inherit' }}
                                        value={editingEvent.resolutionCriteria || ''}
                                        onChange={e => setEditingEvent({ ...editingEvent, resolutionCriteria: e.target.value })}
                                        placeholder="Specific rules for resolution..."
                                    />
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px', marginBottom: '16px' }}>
                                    <div className="input-group">
                                        <label className="text-sm">Deadline</label>
                                        <input className="input" type="datetime-local" value={editingEvent.deadline} onChange={e => setEditingEvent({ ...editingEvent, deadline: e.target.value })} />
                                    </div>
                                    <div className="input-group">
                                        <label className="text-sm">Start At</label>
                                        <input className="input" type="datetime-local" required value={editingEvent.startAt} onChange={e => setEditingEvent({ ...editingEvent, startAt: e.target.value })} />
                                    </div>
                                </div>
                                <p className="text-sm" style={{ color: 'orange', marginBottom: '16px' }}>⚠️ Editing Outcomes/Odds is disabled to prevent corruption of existing bets.</p>
                                <button className="btn btn-primary" style={{ width: '100%' }}>Save Changes</button>
                            </form>
                        </div>
                    </div>
                )
            }
        </div >
    );
}
