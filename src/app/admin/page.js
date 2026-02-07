"use client";
import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useApp } from '../../lib/store';

import { db } from '../../lib/firebase';
import { collection, query, limit, onSnapshot, doc, updateDoc } from 'firebase/firestore';

function AdminContent() {
    const {
        user, events, createEvent, resolveEvent, deleteEvent, updateEvent,
        updateEventOrder, deleteBet, toggleFeatured, ideas, deleteIdea,
        users, deleteUser, updateUserGroups, updateSystemAnnouncement, systemAnnouncement, sendSystemNotification
    } = useApp();
    const router = useRouter();
    const searchParams = useSearchParams();

    // Navigation State
    // We strive to use the URL as the source of truth, but we keep local state for immediate UI feedback
    const [activeTab, setActiveTabState] = useState('dashboard');

    useEffect(() => {
        const tab = searchParams.get('tab');
        if (tab) setActiveTabState(tab);
    }, [searchParams]);

    const setActiveTab = (tab) => {
        setActiveTabState(tab);
        // Use replace to avoid cluttering history stack with every tab click, or push if you want back button to work
        router.push(`/admin?tab=${tab}`);
    };
    const [eventSubTab, setEventSubTab] = useState('create');
    const [searchQuery, setSearchQuery] = useState('');

    // State for Creating Events
    const [newEvent, setNewEvent] = useState({
        title: '', description: '', resolutionCriteria: '', outcome1: '', odds1: '', outcome2: '', odds2: '', deadline: '', startAt: '', category: 'Uncategorized', createdBy: ''
    });

    // State for Editing Events
    const [editingEvent, setEditingEvent] = useState(null);
    const [editingId, setEditingId] = useState(null);
    const [allBets, setAllBets] = useState([]);
    const [showEditModal, setShowEditModal] = useState(false);

    // State for Ideas
    const [ideaFilter, setIdeaFilter] = useState('pending');

    // Hardcoded Categories List
    const CATEGORIES = [
        "Uncategorized", "Super Bowl", "Sports", "Video Games", "Local/Community",
        "Weather", "Tech", "Pop Culture", "The Boys", "The Fam"
    ];

    // Fetch Global Bets
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

    if (!user || user.role !== 'admin') return null;

    // --- Actions ---
    const handleCreate = async (e) => {
        e.preventDefault();
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
        setActiveTab('events');
        setEventSubTab('edit'); // Switch to view list?
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

    // Helper to toggle User Role (Admin <-> User)
    const toggleUserRole = async (targetUser) => {
        if (targetUser.id === user.id) return alert("You cannot change your own role.");
        const newRole = targetUser.role === 'admin' ? 'user' : 'admin';
        if (confirm(`Change role of ${targetUser.username} to ${newRole.toUpperCase()}?`)) {
            try {
                await updateDoc(doc(db, 'users', targetUser.id), { role: newRole });
                alert("Role updated.");
            } catch (e) {
                alert("Error updating role: " + e.message);
            }
        }
    };

    // Helper to toggle User Groups
    const toggleGroup = async (targetUser, groupName) => {
        const currentGroups = targetUser.groups || [];
        const isActive = currentGroups.includes(groupName);
        const newGroups = isActive
            ? currentGroups.filter(g => g !== groupName)
            : [...currentGroups, groupName];

        await updateUserGroups(targetUser.id, newGroups);
    };


    // --- Search Filtering Helpers ---
    const filteredEvents = events.filter(e =>
        e.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.description.toLowerCase().includes(searchQuery.toLowerCase())
    );
    const filteredUsers = users.filter(u =>
        u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.email?.toLowerCase().includes(searchQuery.toLowerCase())
    );
    const filteredBets = allBets.filter(b =>
        b.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.eventTitle?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // --- Main Render ---
    return (
        <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#000', color: '#fff' }}>

            {/* SIDEBAR NAVIGATION */}
            <div style={{ width: '220px', background: '#111', borderRight: '1px solid #333', display: 'flex', flexDirection: 'column', padding: '20px' }}>
                <h1 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '32px', color: 'var(--primary)' }}>Admin Panel</h1>

                <nav style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {[
                        { id: 'dashboard', label: 'Dashboard', icon: '📊' },
                        { id: 'events', label: 'Events', icon: '📅' },
                        { id: 'bets', label: 'Bets', icon: '💰' },
                        { id: 'users', label: 'Users', icon: '👥' },
                        { id: 'community', label: 'Community', icon: '💡' },
                        { id: 'system', label: 'System', icon: '📢' },
                    ].map(item => (
                        <button
                            key={item.id}
                            onClick={() => setActiveTab(item.id)}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '12px',
                                padding: '10px 12px',
                                borderRadius: '8px',
                                border: 'none',
                                background: activeTab === item.id ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                                color: activeTab === item.id ? '#fff' : '#888',
                                cursor: 'pointer',
                                textAlign: 'left',
                                fontSize: '14px',
                                fontWeight: activeTab === item.id ? '600' : 'normal',
                                transition: 'all 0.2s'
                            }}
                        >
                            <span>{item.icon}</span>
                            {item.label}
                        </button>
                    ))}
                </nav>

                <div style={{ marginTop: 'auto', fontSize: '12px', color: '#444' }}>
                    v1.1.0 Admin
                </div>
            </div>

            {/* MAIN CONTENT AREA */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

                {/* TOP BAR */}
                <div style={{ height: '64px', borderBottom: '1px solid #333', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', background: '#111' }}>
                    <div style={{ fontSize: '16px', fontWeight: '600', textTransform: 'capitalize' }}>
                        {activeTab}
                    </div>

                    {/* Global Search */}
                    <div style={{ position: 'relative', width: '300px' }}>
                        <input
                            type="text"
                            placeholder="Search events, users, bets..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            style={{
                                width: '100%',
                                background: '#222',
                                border: '1px solid #333',
                                borderRadius: '6px',
                                padding: '8px 12px',
                                color: '#fff',
                                fontSize: '14px',
                                outline: 'none'
                            }}
                        />
                    </div>
                </div>

                {/* SCROLLABLE PAGE CONTENT */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>

                    {/* --- DASHBOARD TAB --- */}
                    {activeTab === 'dashboard' && (
                        <div className="animate-fade">
                            {/* Stats Overview (Optional Placeholder) */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
                                <div className="card" style={{ padding: '16px', textAlign: 'center' }}>
                                    <h3 style={{ fontSize: '12px', color: '#888' }}>Open Events</h3>
                                    <p style={{ fontSize: '24px', fontWeight: 'bold' }}>{events.filter(e => e.status === 'open').length}</p>
                                </div>
                                <div className="card" style={{ padding: '16px', textAlign: 'center' }}>
                                    <h3 style={{ fontSize: '12px', color: '#888' }}>Total Users</h3>
                                    <p style={{ fontSize: '24px', fontWeight: 'bold' }}>{users.length}</p>
                                </div>
                                <div className="card" style={{ padding: '16px', textAlign: 'center' }}>
                                    <h3 style={{ fontSize: '12px', color: '#888' }}>Pending Ideas</h3>
                                    <p style={{ fontSize: '24px', fontWeight: 'bold' }}>{ideas.length}</p>
                                </div>
                                <div className="card" style={{ padding: '16px', textAlign: 'center' }}>
                                    <h3 style={{ fontSize: '12px', color: '#888' }}>System Status</h3>
                                    <p style={{ fontSize: '14px', fontWeight: 'bold', color: '#10b981', marginTop: '6px' }}>Online</p>
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
                                {/* Left Column: Actionable Items */}
                                <div>
                                    <div className="card" style={{ marginBottom: '24px' }}>
                                        <h2 style={{ fontSize: '18px', marginBottom: '16px', borderBottom: '1px solid #333', paddingBottom: '8px' }}>📝 Events to Resolve</h2>
                                        {events.filter(e => e.status === 'open' && new Date(e.startAt) <= new Date()).length > 0 ? (
                                            events.filter(e => e.status === 'open' && new Date(e.startAt) <= new Date())
                                                .map(e => (
                                                    <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #333' }}>
                                                        <span>{e.title}</span>
                                                        <button
                                                            onClick={() => { setActiveTab('events'); setEventSubTab('resolve'); }}
                                                            style={{ fontSize: '12px', color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer' }}>
                                                            Resolve Now &rarr;
                                                        </button>
                                                    </div>
                                                ))
                                        ) : (
                                            <p style={{ fontSize: '14px', color: '#888' }}>No events pending immediate resolution.</p>
                                        )}
                                    </div>

                                    <div className="card">
                                        <h2 style={{ fontSize: '18px', marginBottom: '16px', borderBottom: '1px solid #333', paddingBottom: '8px' }}>💬 Recent Bet Ideas</h2>
                                        {ideas.slice(0, 5).map(idea => (
                                            <div key={idea.id} style={{ marginBottom: '12px' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                    <span style={{ fontWeight: '600' }}>"{idea.text}"</span>
                                                    <span style={{ fontSize: '12px', color: '#666' }}>{new Date(idea.submittedAt).toLocaleDateString()}</span>
                                                </div>
                                                <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                                                    <button
                                                        onClick={() => {
                                                            setNewEvent({ ...newEvent, title: idea.text, description: `Suggested by ${idea.username}`, createdBy: idea.username, category: 'Community' });
                                                            setActiveTab('events'); setEventSubTab('create');
                                                        }}
                                                        style={{ fontSize: '10px', background: 'var(--primary)', color: '#000', border: 'none', borderRadius: '4px', padding: '2px 6px', cursor: 'pointer' }}>
                                                        Review & Create
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                        {ideas.length === 0 && <p style={{ fontSize: '14px', color: '#888' }}>No new ideas.</p>}
                                    </div>
                                </div>

                                {/* Right Column: Quick Actions & Recent Bets */}
                                <div>
                                    <div className="card" style={{ marginBottom: '24px' }}>
                                        <h2 style={{ fontSize: '18px', marginBottom: '16px' }}>⚡ Quick Actions</h2>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            <button
                                                onClick={() => { setActiveTab('events'); setEventSubTab('create'); }}
                                                className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                                                + Create New Event
                                            </button>
                                            <button
                                                onClick={() => setActiveTab('system')}
                                                className="btn" style={{ width: '100%', background: '#333', justifyContent: 'center' }}>
                                                📣 Post Announcement
                                            </button>
                                        </div>
                                    </div>

                                    <div className="card">
                                        <h2 style={{ fontSize: '18px', marginBottom: '16px' }}>💰 Recent Bets</h2>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            {allBets.slice(0, 5).map(bet => (
                                                <div key={bet.id} style={{ fontSize: '12px', paddingBottom: '8px', borderBottom: '1px solid #333' }}>
                                                    <span style={{ color: 'var(--primary)' }}>${bet.amount}</span> on
                                                    <span style={{ color: '#aaa' }}> {bet.outcomeLabel}</span>
                                                    <div style={{ color: '#666' }}>by {bet.username || 'User'}</div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* --- EVENTS TAB --- */}
                    {activeTab === 'events' && (
                        <div>
                            {/* Sub Tabs */}
                            <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
                                {['create', 'edit', 'resolve'].map(sub => (
                                    <button
                                        key={sub}
                                        onClick={() => setEventSubTab(sub)}
                                        style={{
                                            padding: '8px 16px', borderRadius: '6px',
                                            background: eventSubTab === sub ? 'var(--primary)' : '#222',
                                            color: eventSubTab === sub ? '#000' : '#888',
                                            border: 'none', cursor: 'pointer', textTransform: 'capitalize', fontWeight: 'bold'
                                        }}
                                    >
                                        {sub}
                                    </button>
                                ))}
                            </div>

                            {eventSubTab === 'create' && (
                                <div className="card" style={{ maxWidth: '800px' }}>
                                    <h2 style={{ fontSize: '18px', marginBottom: '16px' }}>Create Event</h2>
                                    <form onSubmit={handleCreate}>
                                        <div className="input-group">
                                            <input className="input" placeholder="Event Title" value={newEvent.title} onChange={e => setNewEvent({ ...newEvent, title: e.target.value })} required />
                                        </div>
                                        <div className="input-group">
                                            <label className="text-sm">Category</label>
                                            <select className="input" value={newEvent.category || 'Uncategorized'} onChange={e => setNewEvent({ ...newEvent, category: e.target.value })} style={{ background: 'var(--bg-card)', color: '#fff' }}>
                                                {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                            </select>
                                        </div>
                                        <div className="input-group">
                                            <input className="input" placeholder="Description" value={newEvent.description} onChange={e => setNewEvent({ ...newEvent, description: e.target.value })} required />
                                        </div>
                                        <div className="input-group">
                                            <label className="text-sm">Created By / Resolution</label>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                                <input className="input" placeholder="Creator (Optional)" value={newEvent.createdBy || ''} onChange={e => setNewEvent({ ...newEvent, createdBy: e.target.value })} />
                                                <input className="input" placeholder="Res Criteria (Optional)" value={newEvent.resolutionCriteria || ''} onChange={e => setNewEvent({ ...newEvent, resolutionCriteria: e.target.value })} />
                                            </div>
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', margin: '12px 0' }}>
                                            <div className="input-group">
                                                <label className="text-sm">Deadline</label>
                                                <input className="input" type="datetime-local" value={newEvent.deadline} onChange={e => setNewEvent({ ...newEvent, deadline: e.target.value })} />
                                            </div>
                                            <div className="input-group">
                                                <label className="text-sm">Start / Resolve Date</label>
                                                <input className="input" type="datetime-local" required value={newEvent.startAt} onChange={e => setNewEvent({ ...newEvent, startAt: e.target.value })} />
                                            </div>
                                        </div>
                                        <div style={{ padding: '12px', background: '#222', borderRadius: '8px', marginBottom: '16px' }}>
                                            <h3 style={{ fontSize: '14px', marginBottom: '8px', color: '#888' }}>Outcomes (Moneyline)</h3>
                                            <div style={{ display: 'flex', gap: '12px', marginBottom: '8px' }}>
                                                <input className="input" placeholder="Outcome A" value={newEvent.outcome1 || ''} onChange={e => setNewEvent({ ...newEvent, outcome1: e.target.value })} />
                                                <input className="input" type="number" step="0.01" placeholder="Odds" style={{ width: '80px' }} value={newEvent.odds1 || ''} onChange={e => setNewEvent({ ...newEvent, odds1: e.target.value })} />
                                            </div>
                                            <div style={{ display: 'flex', gap: '12px' }}>
                                                <input className="input" placeholder="Outcome B" value={newEvent.outcome2 || ''} onChange={e => setNewEvent({ ...newEvent, outcome2: e.target.value })} />
                                                <input className="input" type="number" step="0.01" placeholder="Odds" style={{ width: '80px' }} value={newEvent.odds2 || ''} onChange={e => setNewEvent({ ...newEvent, odds2: e.target.value })} />
                                            </div>
                                        </div>
                                        <button className="btn btn-primary" style={{ width: '100%' }}>Create Event</button>
                                    </form>
                                </div>
                            )}

                            {eventSubTab === 'edit' && (
                                <div className="card">
                                    <h2 style={{ fontSize: '18px', marginBottom: '16px' }}>Manage Events ({filteredEvents.length})</h2>
                                    {filteredEvents.map(event => (
                                        <div key={event.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: '#222', marginBottom: '8px', borderRadius: '8px' }}>
                                            <div>
                                                <div style={{ fontWeight: 'bold' }}>{event.title}</div>
                                                <div style={{ fontSize: '12px', color: '#888' }}>{event.category} • {event.status}</div>
                                            </div>
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <button onClick={() => toggleFeatured(event.id, event.featured)} style={{ fontSize: '12px', padding: '4px 8px', borderRadius: '4px', background: event.featured ? 'gold' : '#444', color: event.featured ? '#000' : '#fff', border: 'none', cursor: 'pointer' }}>★</button>
                                                <button onClick={() => startEdit(event)} style={{ fontSize: '12px', padding: '4px 8px', borderRadius: '4px', background: '#444', color: '#fff', border: 'none', cursor: 'pointer' }}>Edit</button>
                                                <button onClick={() => { if (confirm('Delete?')) deleteEvent(event.id) }} style={{ fontSize: '12px', padding: '4px 8px', borderRadius: '4px', background: '#ef4444', color: '#fff', border: 'none', cursor: 'pointer' }}>Del</button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {eventSubTab === 'resolve' && (
                                <div className="card">
                                    <h2 style={{ fontSize: '18px', marginBottom: '16px' }}>Resolve Active Events</h2>
                                    {events.filter(e => (e.status === 'open' || e.status === 'locked') && (e.title.toLowerCase().includes(searchQuery.toLowerCase()))).map(event => (
                                        <div key={event.id} style={{ padding: '16px', background: '#222', borderRadius: '8px', marginBottom: '16px' }}>
                                            <div style={{ marginBottom: '12px', display: 'flex', justifyContent: 'space-between' }}>
                                                <h3 style={{ fontSize: '16px' }}>{event.title}</h3>
                                                <span style={{ fontSize: '12px', color: '#888' }}>Resolve: {new Date(event.startAt).toLocaleString()}</span>
                                            </div>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                                {event.outcomes.map(o => (
                                                    <button
                                                        key={o.id}
                                                        onClick={() => { if (confirm(`${o.label} WON?`)) resolveEvent(event.id, o.id); }}
                                                        style={{ padding: '12px', background: '#333', border: '1px solid #444', color: '#fff', borderRadius: '6px', cursor: 'pointer', textAlign: 'left' }}
                                                    >
                                                        <div style={{ fontWeight: 'bold', color: 'var(--primary)' }}>{o.label}</div>
                                                        <div style={{ fontSize: '11px', color: '#888' }}>x{o.odds}</div>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* --- BETS TAB --- */}
                    {activeTab === 'bets' && (
                        <div className="card">
                            <h2 style={{ fontSize: '18px', marginBottom: '16px' }}>All Bets ({filteredBets.length})</h2>
                            <div style={{ maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }}>
                                {filteredBets.map(bet => (
                                    <div key={bet.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', borderBottom: '1px solid #333' }}>
                                        <div>
                                            <div style={{ color: 'var(--primary)', fontWeight: 'bold' }}>{bet.username || 'User'}</div>
                                            <div style={{ fontSize: '12px', color: '#fff' }}>${bet.amount} on {bet.outcomeLabel}</div>
                                            <div style={{ fontSize: '11px', color: '#888' }}>{bet.eventTitle}</div>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <div style={{ fontSize: '11px', color: '#666' }}>{new Date(bet.placedAt).toLocaleString()}</div>
                                            <button onClick={() => { if (confirm('Delete?')) deleteBet(bet.id) }} style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', marginTop: '4px' }}>x</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* --- USERS TAB --- */}
                    {activeTab === 'users' && (
                        <div className="card">
                            <h2 style={{ fontSize: '18px', marginBottom: '16px' }}>Users Directory ({filteredUsers.length})</h2>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                                <thead style={{ textAlign: 'left', color: '#888', borderBottom: '1px solid #333' }}>
                                    <tr>
                                        <th style={{ padding: '8px' }}>User</th>
                                        <th style={{ padding: '8px' }}>Balance</th>
                                        <th style={{ padding: '8px' }}>Role</th>
                                        <th style={{ padding: '8px' }}>Groups</th>
                                        <th style={{ padding: '8px' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredUsers.sort((a, b) => (b.balance || 0) - (a.balance || 0)).map(u => (
                                        <tr key={u.id} style={{ borderBottom: '1px solid #222' }}>
                                            <td style={{ padding: '8px' }}>
                                                <div style={{ fontWeight: 'bold' }}>{u.username}</div>
                                                <div style={{ fontSize: '10px', color: '#666' }}>{u.email}</div>
                                                <div style={{ fontSize: '10px', color: '#444' }}>ID: {u.id}</div>
                                            </td>
                                            <td style={{ padding: '8px' }}>${u.balance?.toFixed(2)}</td>
                                            <td style={{ padding: '8px' }}>
                                                {/* Role Toggle Button */}
                                                <button
                                                    onClick={() => toggleUserRole(u)}
                                                    style={{
                                                        padding: '4px 8px', borderRadius: '4px',
                                                        background: u.role === 'admin' ? '#ef4444' : '#333',
                                                        fontSize: '11px', fontWeight: 'bold',
                                                        color: u.role === 'admin' ? '#fff' : '#888',
                                                        border: '1px solid transparent',
                                                        cursor: u.id === user.id ? 'not-allowed' : 'pointer',
                                                        opacity: u.id === user.id ? 0.7 : 1
                                                    }}
                                                    title={u.id === user.id ? "Cannot change own role" : "Click to toggle Admin/User"}
                                                    disabled={u.id === user.id}
                                                >
                                                    {u.role ? u.role.toUpperCase() : 'USER'}
                                                </button>
                                            </td>
                                            <td style={{ padding: '8px' }}>
                                                {/* Groups Toggles */}
                                                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                                    {['The Boys', 'The Fam', 'Moderator'].map(g => {
                                                        const isActive = (u.groups || []).includes(g);
                                                        return (
                                                            <button
                                                                key={g}
                                                                onClick={() => toggleGroup(u, g)}
                                                                style={{
                                                                    padding: '4px 8px', fontSize: '10px', borderRadius: '4px',
                                                                    border: isActive ? (g === 'Moderator' ? '1px solid #3b82f6' : '1px solid var(--primary)') : '1px solid #333',
                                                                    background: isActive ? (g === 'Moderator' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(234, 179, 8, 0.2)') : 'transparent',
                                                                    color: isActive ? (g === 'Moderator' ? '#3b82f6' : 'var(--primary)') : '#666',
                                                                    cursor: 'pointer', transition: 'all 0.2s', fontWeight: isActive ? 'bold' : 'normal'
                                                                }}
                                                            >
                                                                {g === 'Moderator' ? '🛡️ Mod' : g}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </td>
                                            <td style={{ padding: '8px' }}>
                                                <div style={{ display: 'flex', gap: '4px' }}>
                                                    {u.id !== user.id && (
                                                        <button
                                                            onClick={() => { if (confirm('Delete user?')) deleteUser(u.id); }}
                                                            style={{ padding: '4px 8px', background: '#333', color: '#ef4444', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '10px' }}
                                                        >
                                                            Delete
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* --- COMMUNITY TAB --- */}
                    {activeTab === 'community' && (
                        <div className="card">
                            <h2 style={{ fontSize: '18px', marginBottom: '16px' }}>Bet Ideas Management</h2>

                            {/* Filter Tabs */}
                            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', borderBottom: '1px solid #333', paddingBottom: '8px' }}>
                                {['pending', 'approved', 'denied', 'all'].map(status => {
                                    const count = ideas.filter(i => {
                                        const s = i.status || 'pending';
                                        if (status === 'all') return true;
                                        return s === status;
                                    }).length;

                                    return (
                                        <button
                                            key={status}
                                            onClick={() => setIdeaFilter(status)}
                                            style={{
                                                padding: '4px 12px',
                                                borderRadius: '16px',
                                                border: 'none',
                                                background: ideaFilter === status ? 'var(--primary)' : '#333',
                                                color: ideaFilter === status ? '#000' : '#888',
                                                fontSize: '12px',
                                                fontWeight: 'bold',
                                                cursor: 'pointer',
                                                textTransform: 'capitalize'
                                            }}
                                        >
                                            {status} ({count})
                                        </button>
                                    );
                                })}
                            </div>

                            {ideas
                                .filter(idea => {
                                    const status = idea.status || 'pending'; // Default to pending
                                    if (ideaFilter === 'all') return true;
                                    return status === ideaFilter;
                                })
                                .map(idea => (
                                    <div key={idea.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: '#222', marginBottom: '8px', borderRadius: '8px', borderLeft: idea.status === 'approved' ? '4px solid #10b981' : (idea.status === 'denied' ? '4px solid #ef4444' : '4px solid #f59e0b') }}>
                                        <div>
                                            <div style={{ fontStyle: 'italic', marginBottom: '4px' }}>"{idea.text}"</div>
                                            <div style={{ fontSize: '12px', color: '#888' }}>
                                                By {idea.username} • <span style={{ color: idea.status === 'approved' ? '#10b981' : (idea.status === 'denied' ? '#ef4444' : '#f59e0b') }}>{idea.status ? idea.status.toUpperCase() : 'PENDING'}</span>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <button
                                                onClick={() => {
                                                    setNewEvent({ ...newEvent, title: idea.text, description: `Suggested by ${idea.username}`, createdBy: idea.username, category: 'Community' });
                                                    setActiveTab('events'); setEventSubTab('create');
                                                }}
                                                className="btn btn-primary" style={{ padding: '4px 8px', fontSize: '12px' }}>
                                                Convert
                                            </button>
                                            <button onClick={() => deleteIdea(idea.id)} style={{ padding: '4px 8px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Del</button>
                                        </div>
                                    </div>
                                ))}
                            {ideas.length === 0 && <p style={{ color: '#888', fontStyle: 'italic' }}>No ideas found.</p>}
                        </div>
                    )}

                    {/* --- SYSTEM TAB --- */}
                    {activeTab === 'system' && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 1fr) minmax(300px, 1fr)', gap: '24px', maxWidth: '1200px' }}>
                            {/* Left Column: System Announcements */}
                            <div className="card">
                                <h2 style={{ fontSize: '18px', marginBottom: '16px' }}>📢 System Announcements</h2>
                                <div style={{ marginBottom: '24px' }}>
                                    <label className="text-sm" style={{ display: 'block', marginBottom: '8px' }}>Current Announcement</label>
                                    <div style={{ padding: '12px', background: '#333', borderRadius: '8px', marginBottom: '12px', color: '#ddd' }}>
                                        {systemAnnouncement?.active ? systemAnnouncement.message : 'No active announcement'}
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                                        <input id="sys-msg" className="input" placeholder="New announcement..." style={{ flex: 1 }} />
                                        <select id="sys-type" className="input" style={{ width: '100px' }}>
                                            <option value="info">Info</option>
                                            <option value="warning">Warning</option>
                                        </select>
                                    </div>
                                    <div style={{ display: 'flex', gap: '12px' }}>
                                        <button
                                            className="btn btn-primary"
                                            onClick={() => {
                                                const msg = document.getElementById('sys-msg').value;
                                                const type = document.getElementById('sys-type').value;
                                                if (msg) updateSystemAnnouncement({ message: msg, type, active: true, postedAt: new Date().toISOString() });
                                            }}
                                        >
                                            Post
                                        </button>
                                        <button
                                            className="btn"
                                            style={{ background: '#444' }}
                                            onClick={() => updateSystemAnnouncement({ active: false })}
                                        >
                                            Clear Active
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Right Column: Global Notification */}
                            <div className="card">
                                <h2 style={{ fontSize: '18px', marginBottom: '16px' }}>🔔 Send Global Notification</h2>
                                <p style={{ fontSize: '13px', color: '#888', marginBottom: '12px' }}>
                                    This will send a notification to ALL users. Use sparingly!
                                </p>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    <input id="notif-title" className="input" placeholder="Notification Title" />
                                    <textarea id="notif-msg" className="input" style={{ height: '80px', resize: 'vertical' }} placeholder="Message body..." />

                                    <button
                                        className="btn btn-primary"
                                        onClick={async () => {
                                            const title = document.getElementById('notif-title').value;
                                            const msg = document.getElementById('notif-msg').value;
                                            if (!title || !msg) return alert("Please fill both title and message.");

                                            if (confirm(`Send to ALL users?\nTitle: ${title}`)) {
                                                const res = await sendSystemNotification(title, msg);
                                                if (res.success) {
                                                    alert(`Sent to ${res.count} users.`);
                                                    document.getElementById('notif-title').value = '';
                                                    document.getElementById('notif-msg').value = '';
                                                } else {
                                                    alert("Error: " + res.error);
                                                }
                                            }
                                        }}
                                    >
                                        Send to Everyone
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                </div>
            </div>

            {/* EDIT MODAL REMAINS SAME */}
            {showEditModal && editingEvent && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.85)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
                    <div className="card" style={{ width: '100%', maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto', border: '1px solid var(--primary)', padding: '24px' }}>
                        <h2 style={{ marginBottom: '20px', fontSize: '20px' }}>Edit Event</h2>
                        <form onSubmit={handleUpdate}>
                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ display: 'block', fontSize: '12px', color: '#888', marginBottom: '4px' }}>Title</label>
                                <input className="input" value={editingEvent.title} onChange={e => setEditingEvent({ ...editingEvent, title: e.target.value })} />
                            </div>

                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ display: 'block', fontSize: '12px', color: '#888', marginBottom: '4px' }}>Description</label>
                                <textarea className="input" style={{ height: '80px', resize: 'vertical' }} value={editingEvent.description} onChange={e => setEditingEvent({ ...editingEvent, description: e.target.value })} />
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '12px', color: '#888', marginBottom: '4px' }}>Deadline (Betting Closes)</label>
                                    <input type="datetime-local" className="input" style={{ width: '100%' }} value={editingEvent.deadline} onChange={e => setEditingEvent({ ...editingEvent, deadline: e.target.value })} />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '12px', color: '#888', marginBottom: '4px' }}>Start Time (Resolution)</label>
                                    <input type="datetime-local" className="input" style={{ width: '100%' }} value={editingEvent.startAt} onChange={e => setEditingEvent({ ...editingEvent, startAt: e.target.value })} />
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '12px' }}>
                                <button className="btn btn-primary" style={{ flex: 1 }}>Save Changes</button>
                                <button type="button" onClick={() => setShowEditModal(false)} className="btn" style={{ flex: 1, background: '#333' }}>Cancel</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

        </div>
    );
}

export default function Admin() {
    return (
        <Suspense fallback={<div className="container" style={{ padding: '20px', color: '#fff' }}>Loading Admin Dashboard...</div>}>
            <AdminContent />
        </Suspense>
    );
}
