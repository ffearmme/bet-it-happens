"use client";
import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useApp } from '../../lib/store';

import { db } from '../../lib/firebase';
import { collection, query, limit, onSnapshot, doc, updateDoc, where, getDocs, orderBy, writeBatch, increment, getDoc } from 'firebase/firestore';

function AdminContent() {
    const {
        user, events, createEvent, resolveEvent, deleteEvent, updateEvent,
        updateEventOrder, deleteBet, toggleFeatured, ideas, deleteIdea, replyToIdea,
        users, deleteUser, updateUserGroups, updateSystemAnnouncement, systemAnnouncement, sendSystemNotification,
        syncAllUsernames, casinoSettings, updateCasinoStatus
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
    const [editingBets, setEditingBets] = useState([]);

    // State for viewing bets in Completed tab
    const [viewingBetsEventId, setViewingBetsEventId] = useState(null);
    const [viewingBetsList, setViewingBetsList] = useState([]);
    const [expandedCategories, setExpandedCategories] = useState({});

    // State for Ideas
    const [ideaFilter, setIdeaFilter] = useState('pending');
    const [openReplyId, setOpenReplyId] = useState(null);
    const [replyText, setReplyText] = useState('');

    const runSlotsClawback = async () => {
        if (!confirm("⚠️ WARNING: This will scan all slots history, calculate net profits, and deduct them from user balances (and their squad wallets if necessary). \n\nAre you sure?")) return;

        try {
            // 1. Get all slots bets
            const q = query(collection(db, 'casino_bets'), where('game', '==', 'slots'));
            const snapshot = await getDocs(q);

            const userProfits = {}; // { userId: { won: 0, bet: 0, profit: 0 } }

            snapshot.forEach(doc => {
                const bet = doc.data();
                if (!userProfits[bet.userId]) userProfits[bet.userId] = { won: 0, bet: 0, profit: 0, username: bet.username || bet.userId };

                userProfits[bet.userId].bet += (bet.amount || 0);
                userProfits[bet.userId].won += (bet.payout || 0);
            });

            // Calculate profits
            const targets = [];
            Object.keys(userProfits).forEach(uid => {
                const stats = userProfits[uid];
                stats.profit = stats.won - stats.bet;
                if (stats.profit > 0) {
                    targets.push({ id: uid, ...stats });
                }
            });

            if (targets.length === 0) {
                alert("No users found with net profits from slots.");
                return;
            }

            const totalProfit = targets.reduce((acc, t) => acc + t.profit, 0);
            if (!confirm(`Found ${targets.length} users with total slots profit of $${totalProfit.toLocaleString()}. Proceed with clawback?`)) {
                return;
            }

            const batch = writeBatch(db);
            const report = [];
            let opCount = 0;

            for (const target of targets) {
                let remainingUrl = target.profit;
                let recoveredFromUser = 0;
                let recoveredFromSquad = 0;

                // 2. User Balance
                const userRef = doc(db, 'users', target.id);
                const userSnap = await getDoc(userRef);

                if (userSnap.exists()) {
                    const userData = userSnap.data();
                    const userBalance = userData.balance || 0;

                    if (userBalance > 0) {
                        const take = Math.min(userBalance, remainingUrl);
                        if (take > 0) {
                            recoveredFromUser = take;
                            remainingUrl -= take;
                            batch.update(userRef, { balance: increment(-take) });
                            opCount++;
                        }
                    }

                    // 3. Squad Balance (if needed)
                    if (remainingUrl > 0 && userData.squadId) {
                        const squadRef = doc(db, 'squads', userData.squadId);
                        const squadSnap = await getDoc(squadRef);

                        if (squadSnap.exists()) {
                            const squadData = squadSnap.data();
                            const squadBalance = squadData.wallet?.balance || 0;

                            if (squadBalance > 0) {
                                const takeSquad = Math.min(squadBalance, remainingUrl);
                                if (takeSquad > 0) {
                                    recoveredFromSquad = takeSquad;
                                    remainingUrl -= takeSquad;
                                    batch.update(squadRef, { 'wallet.balance': increment(-takeSquad) });
                                    opCount++;
                                }
                            }
                        }
                    }
                }

                report.push(`${target.username}: Profit $${target.profit.toFixed(2)} -> Took $${recoveredFromUser.toFixed(2)} (User) + $${recoveredFromSquad.toFixed(2)} (Squad). Unrecovered: $${remainingUrl.toFixed(2)}`);
            }

            if (opCount > 0) {
                await batch.commit();
                console.log("Clawback Report:", report);
                alert("Clawback Complete!\n\nCheck console for full report.\n\nSummary:\n" + report.slice(0, 10).join("\n") + (report.length > 10 ? "\n...and " + (report.length - 10) + " more." : ""));
            } else {
                alert("No funds could be recovered (balances were 0).");
            }

        } catch (e) {
            console.error(e);
            alert("Error: " + e.message);
        }
    };

    // Hardcoded Categories List
    const CATEGORIES = [
        "Uncategorized", "Super Bowl", "Sports", "Video Games", "Local/Community",
        "Weather", "Tech", "Pop Culture", "The Boys", "The Fam"
    ];

    // Fetch Bets for Editing Event
    useEffect(() => {
        if (!editingId) return;
        const q = query(collection(db, 'bets'), where('eventId', '==', editingId));
        getDocs(q).then(snap => {
            const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            // Sort by placedAt
            list.sort((a, b) => new Date(b.placedAt) - new Date(a.placedAt));
            setEditingBets(list);
        });
    }, [editingId]);

    // Fetch Bets for Completed Event View
    useEffect(() => {
        if (!viewingBetsEventId) {
            setViewingBetsList([]);
            return;
        }
        const q = query(collection(db, 'bets'), where('eventId', '==', viewingBetsEventId));
        getDocs(q).then(snap => {
            const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            list.sort((a, b) => new Date(b.placedAt) - new Date(a.placedAt));
            setViewingBetsList(list);
        });
    }, [viewingBetsEventId]);

    // Fetch Global Bets
    useEffect(() => {
        if (!user || user.role !== 'admin') return;
        const q = query(collection(db, 'bets'), limit(50), orderBy('placedAt', 'desc'));
        const unsub = onSnapshot(q, (snapshot) => {
            const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
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

    const adjustUserBalance = async (targetUser) => {
        const current = targetUser.balance || 0;
        const input = prompt(`Update balance for ${targetUser.username}?\nCurrent: $${current.toFixed(2)}`, current);
        if (input === null) return;
        const newVal = parseFloat(input);
        if (isNaN(newVal)) return alert("Invalid number");

        if (confirm(`Set balance of ${targetUser.username} to $${newVal.toFixed(2)}?`)) {
            try {
                await updateDoc(doc(db, 'users', targetUser.id), { balance: newVal });
                alert("Balance updated.");
            } catch (e) {
                alert("Error: " + e.message);
            }
        }
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
        <div className="mod-container">

            {/* SIDEBAR NAVIGATION */}
            <nav className="mod-sidebar">
                <h1 className="mod-title">
                    <span className="mod-title-text">Admin Panel</span>
                </h1>

                <div className="mod-nav-links">
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
                            className={`mod-nav-btn ${activeTab === item.id ? 'active' : ''}`}
                        >
                            <span>{item.icon}</span>
                            <span className="mod-nav-label">{item.label}</span>
                        </button>
                    ))}
                </div>

                <div className="mod-footer">
                    v1.1.0 Admin
                </div>
            </nav>

            {/* MAIN CONTENT AREA */}
            <div className="mod-content">

                {/* TOP BAR */}
                <header className="mod-header">
                    <div className="mod-header-title">
                        {activeTab}
                    </div>

                    {/* Global Search */}
                    <div className="mod-search-container">
                        <input
                            type="text"
                            placeholder="Search events, users, bets..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="mod-search-input"
                        />
                    </div>
                </header>

                {/* SCROLLABLE PAGE CONTENT */}
                <div className="mod-scroll-content">

                    {/* --- DASHBOARD TAB --- */}
                    {activeTab === 'dashboard' && (
                        <div className="animate-fade">
                            {/* Stats Overview (Optional Placeholder) */}
                            {/* Stats Overview (Optional Placeholder) */}
                            <div className="mod-dashboard-grid">
                                <div className="card mod-stat-card">
                                    <h3>Open Events</h3>
                                    <p>{events.filter(e => e.status === 'open').length}</p>
                                </div>
                                <div className="card mod-stat-card">
                                    <h3>Total Users</h3>
                                    <p>{users.length}</p>
                                </div>
                                <div className="card mod-stat-card">
                                    <h3>Pending Ideas</h3>
                                    <p>{ideas.length}</p>
                                </div>
                                <div className="card mod-stat-card">
                                    <h3>System Status</h3>
                                    <p style={{ color: '#10b981', fontSize: '14px', marginTop: '6px' }}>Online</p>
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
                                        {ideas.filter(idea => idea.status !== 'deleted').slice(0, 5).map(idea => (
                                            <div key={idea.id} style={{ marginBottom: '12px', borderBottom: '1px solid #333', paddingBottom: '8px' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                    <div>
                                                        <span style={{ fontWeight: '600', display: 'block', fontSize: '13px' }}>"{idea.text}"</span>
                                                        <span style={{ fontSize: '11px', color: '#666' }}>By {idea.username} • {new Date(idea.submittedAt).toLocaleDateString()}</span>
                                                        {idea.adminReply && <div style={{ fontSize: '11px', color: '#10b981', marginTop: '2px' }}>↩ Replied: "{idea.adminReply}"</div>}
                                                    </div>
                                                    <span className={`mod-status-badge ${idea.status || 'pending'}`}
                                                        style={{
                                                            marginLeft: '8px',
                                                            background: !idea.status || idea.status === 'pending' ? '#333' : undefined,
                                                            color: !idea.status || idea.status === 'pending' ? '#888' : undefined
                                                        }}>
                                                        {idea.status ? idea.status.toUpperCase() : 'PENDING'}
                                                    </span>
                                                </div>
                                                <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                                                    <button
                                                        onClick={() => {
                                                            setNewEvent({ ...newEvent, title: idea.text, description: `Suggested by ${idea.username}`, createdBy: idea.username, category: 'Community' });
                                                            setActiveTab('events'); setEventSubTab('create');
                                                        }}
                                                        style={{ fontSize: '10px', background: 'var(--primary)', color: '#000', border: 'none', borderRadius: '4px', padding: '4px 8px', cursor: 'pointer', fontWeight: 'bold' }}>
                                                        Convert
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            if (openReplyId === idea.id) {
                                                                setOpenReplyId(null);
                                                            } else {
                                                                setOpenReplyId(idea.id);
                                                                setReplyText(idea.adminReply || '');
                                                            }
                                                        }}
                                                        style={{ fontSize: '10px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '4px', padding: '4px 8px', cursor: 'pointer' }}>
                                                        Reply
                                                    </button>
                                                    <button
                                                        onClick={() => deleteIdea(idea.id)}
                                                        style={{ fontSize: '10px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '4px', padding: '4px 8px', cursor: 'pointer' }}>
                                                        Delete
                                                    </button>
                                                </div>

                                                {/* Reply Box (Inline) */}
                                                {openReplyId === idea.id && (
                                                    <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #333' }}>
                                                        <textarea
                                                            value={replyText}
                                                            onChange={e => setReplyText(e.target.value)}
                                                            placeholder="Reply..."
                                                            style={{ width: '100%', padding: '6px', background: '#111', color: '#fff', border: '1px solid #444', borderRadius: '4px', minHeight: '40px', marginBottom: '6px', fontSize: '12px' }}
                                                        />
                                                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                                                            <button onClick={() => setOpenReplyId(null)} style={{ padding: '4px 8px', background: 'transparent', color: '#888', border: 'none', cursor: 'pointer', fontSize: '10px' }}>Cancel</button>
                                                            <button
                                                                onClick={async () => {
                                                                    const res = await replyToIdea(idea.id, replyText);
                                                                    if (res.success) {
                                                                        setOpenReplyId(null);
                                                                        setReplyText('');
                                                                    } else {
                                                                        alert('Error: ' + res.error);
                                                                    }
                                                                }}
                                                                style={{ padding: '4px 8px', background: 'var(--primary)', color: '#000', borderRadius: '4px', border: 'none', fontWeight: 'bold', cursor: 'pointer', fontSize: '10px' }}
                                                            >
                                                                Send
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
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
                                {['create', 'edit', 'resolve', 'completed'].map(sub => (
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
                                            <div className="mod-form-row">
                                                <input className="input" placeholder="Creator (Optional)" value={newEvent.createdBy || ''} onChange={e => setNewEvent({ ...newEvent, createdBy: e.target.value })} />
                                                <input className="input" placeholder="Res Criteria (Optional)" value={newEvent.resolutionCriteria || ''} onChange={e => setNewEvent({ ...newEvent, resolutionCriteria: e.target.value })} />
                                            </div>
                                        </div>

                                        <div className="mod-form-row" style={{ margin: '12px 0' }}>
                                            <div className="input-group" style={{ flex: 1, minWidth: '140px' }}>
                                                <label className="text-sm">Deadline</label>
                                                <input className="input" type="datetime-local" value={newEvent.deadline} onChange={e => setNewEvent({ ...newEvent, deadline: e.target.value })} style={{ width: '100%' }} />
                                            </div>
                                            <div className="input-group" style={{ flex: 1, minWidth: '140px' }}>
                                                <label className="text-sm">Start / Resolve Date</label>
                                                <input className="input" type="datetime-local" required value={newEvent.startAt} onChange={e => setNewEvent({ ...newEvent, startAt: e.target.value })} style={{ width: '100%' }} />
                                            </div>
                                        </div>

                                        <div style={{ padding: '12px', background: '#222', borderRadius: '8px', marginBottom: '16px' }}>
                                            <h3 style={{ fontSize: '14px', marginBottom: '8px', color: '#888' }}>Outcomes (Moneyline)</h3>
                                            <div className="mod-form-row" style={{ marginBottom: '8px' }}>
                                                <input className="input" placeholder="Outcome A" value={newEvent.outcome1 || ''} onChange={e => setNewEvent({ ...newEvent, outcome1: e.target.value })} style={{ flex: 1 }} />
                                                <input className="input" type="number" step="0.01" placeholder="Odds" style={{ width: '80px' }} value={newEvent.odds1 || ''} onChange={e => setNewEvent({ ...newEvent, odds1: e.target.value })} />
                                            </div>
                                            <div className="mod-form-row">
                                                <input className="input" placeholder="Outcome B" value={newEvent.outcome2 || ''} onChange={e => setNewEvent({ ...newEvent, outcome2: e.target.value })} style={{ flex: 1 }} />
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

                                    {/* Categorized List */}
                                    {(() => {
                                        // Helper to determine display category
                                        const getDisplayCategory = (e) => {
                                            if (e.status === 'resolved' || e.status === 'completed' || e.status === 'settled') return 'Settled';
                                            return e.category || 'Uncategorized';
                                        };

                                        // Get all unique categories from events + predefined list
                                        const eventCats = new Set(filteredEvents.map(e => getDisplayCategory(e)));
                                        const allCats = Array.from(new Set([...CATEGORIES, ...eventCats, 'Settled']));

                                        // Remove 'Settled' from the list if it's empty in filteredEvents? 
                                        // Actually the loop below handles empty categories by returning null.

                                        // Sort categories? Maybe 'Settled' should be last?
                                        // For now, let's just use the order. CATEGORIES is hardcoded.
                                        // We can force 'Settled' to be at the end if we want.
                                        const sortedCats = allCats.sort((a, b) => {
                                            if (a === 'Settled') return 1;
                                            if (b === 'Settled') return -1;
                                            return 0; // Keep original order for others
                                        });


                                        return sortedCats.map(category => {
                                            const catEvents = filteredEvents.filter(e => getDisplayCategory(e) === category);
                                            if (catEvents.length === 0) return null;

                                            const isExpanded = expandedCategories[category];

                                            return (
                                                <div key={category} style={{ marginBottom: '8px', background: '#222', borderRadius: '8px', overflow: 'hidden' }}>
                                                    <button
                                                        onClick={() => setExpandedCategories(prev => ({ ...prev, [category]: !prev[category] }))}
                                                        style={{
                                                            width: '100%',
                                                            padding: '12px',
                                                            background: '#333',
                                                            border: 'none',
                                                            color: '#fff',
                                                            display: 'flex',
                                                            justifyContent: 'space-between',
                                                            alignItems: 'center',
                                                            cursor: 'pointer',
                                                            fontWeight: 'bold'
                                                        }}
                                                    >
                                                        <span>{category} ({catEvents.length})</span>
                                                        <span>{isExpanded ? '▼' : '▶'}</span>
                                                    </button>

                                                    {isExpanded && (
                                                        <div style={{ padding: '8px' }}>
                                                            {catEvents.map(event => (
                                                                <div key={event.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: '#111', marginBottom: '8px', borderRadius: '6px', border: '1px solid #333' }}>
                                                                    <div>
                                                                        <div style={{ fontWeight: 'bold' }}>{event.title}</div>
                                                                        <div style={{ fontSize: '12px', color: '#888' }}>{event.status} • {new Date(event.startAt).toLocaleDateString()}</div>
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
                                                </div>
                                            );
                                        });
                                    })()}
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

                                                <button
                                                    onClick={() => { if (confirm('Mark event as VOID? Bets will be refunded.')) resolveEvent(event.id, 'void'); }}
                                                    style={{ padding: '12px', background: '#333', border: '1px solid #444', color: '#fff', borderRadius: '6px', cursor: 'pointer', textAlign: 'left', gridColumn: 'span 2' }}
                                                >
                                                    <div style={{ fontWeight: 'bold', color: '#aaa', textAlign: 'center' }}>🚫 VOID EVENT</div>
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {eventSubTab === 'completed' && (
                                <div className="card">
                                    <h2 style={{ fontSize: '18px', marginBottom: '16px' }}>Completed Events</h2>
                                    {events.filter(e => ['resolved', 'settled', 'completed'].includes(e.status)).sort((a, b) => new Date(b.settledAt || b.startAt) - new Date(a.settledAt || a.startAt)).map(event => (
                                        <div key={event.id} style={{ padding: '16px', background: '#222', borderRadius: '8px', marginBottom: '16px' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <div>
                                                    <h3 style={{ fontSize: '16px', color: event.status === 'voided' ? '#aaa' : '#fff' }}>
                                                        {event.title}
                                                        {event.status === 'voided' && <span style={{ color: '#ef4444', marginLeft: '8px' }}>(VOIDED)</span>}
                                                    </h3>
                                                    <div style={{ fontSize: '12px', color: '#888' }}>
                                                        Ended: {new Date(event.settledAt || event.startAt).toLocaleString()}
                                                    </div>
                                                    {event.winnerOutcomeId && event.winnerOutcomeId !== 'void' && (
                                                        <div style={{ marginTop: '4px', fontSize: '13px', color: 'var(--primary)' }}>
                                                            Winner: {event.outcomes?.find(o => o.id === event.winnerOutcomeId)?.label || 'Unknown'}
                                                        </div>
                                                    )}
                                                </div>
                                                <div style={{ display: 'flex', gap: '8px' }}>
                                                    {(!event.winnerOutcomeId || event.winnerOutcomeId !== 'void') && (
                                                        <button
                                                            onClick={() => { if (confirm('Wait! Only do this if you need to Refund everyone. Mark event as VOID?')) resolveEvent(event.id, 'void'); }}
                                                            style={{ padding: '6px 12px', background: '#333', color: '#ef4444', border: '1px solid #ef4444', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                                                        >
                                                            VOID
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => setViewingBetsEventId(viewingBetsEventId === event.id ? null : event.id)}
                                                        style={{ padding: '6px 12px', background: '#444', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                                                    >
                                                        {viewingBetsEventId === event.id ? 'Hide Bets' : 'View Bets'}
                                                    </button>
                                                </div>
                                            </div>

                                            {viewingBetsEventId === event.id && (
                                                <div style={{ marginTop: '12px', borderTop: '1px solid #333', paddingTop: '12px' }}>
                                                    <h4 style={{ fontSize: '14px', marginBottom: '8px', color: '#ccc' }}>Bets ({viewingBetsList.length})</h4>
                                                    {viewingBetsList.length === 0 ? (
                                                        <div style={{ color: '#666', fontStyle: 'italic' }}>No bets found or loading...</div>
                                                    ) : (
                                                        <div style={{ display: 'grid', gap: '8px' }}>
                                                            {viewingBetsList.map(bet => (
                                                                <div key={bet.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px', background: '#111', borderRadius: '4px' }}>
                                                                    <div>
                                                                        <div style={{ fontWeight: 'bold', color: 'var(--primary)' }}>{bet.username}</div>
                                                                        <div style={{ fontSize: '12px', color: '#aaa' }}>{bet.outcomeLabel} (${bet.amount.toFixed(2)})</div>
                                                                    </div>
                                                                    <div style={{ textAlign: 'right' }}>
                                                                        <div style={{ fontWeight: 'bold', color: bet.status === 'won' ? 'var(--primary)' : bet.status === 'lost' ? '#ef4444' : '#888' }}>
                                                                            {bet.status === 'won' ? `+$${(bet.payout || 0).toFixed(2)}` : bet.status === 'voided' ? 'Refunded' : `-$${bet.amount.toFixed(2)}`}
                                                                        </div>
                                                                        <div style={{ fontSize: '12px', color: '#666' }}>{bet.status}</div>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
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

                            <div className="mod-table">
                                {/* Table Header */}
                                <div className="mod-table-header">
                                    <div className="mod-col">User</div>
                                    <div className="mod-col">Balance</div>
                                    <div className="mod-col">Role</div>
                                    <div className="mod-col">Groups</div>
                                    <div className="mod-col">Actions</div>
                                </div>

                                {/* Table Rows */}
                                <div className="mod-table-body">
                                    {filteredUsers.sort((a, b) => (b.balance || 0) - (a.balance || 0)).map(u => (
                                        <div key={u.id} className="mod-table-row">
                                            <div className="mod-col" data-label="User">
                                                <div style={{ fontWeight: 'bold' }}>{u.username}</div>
                                                <div style={{ fontSize: '10px', color: '#666' }}>{u.email}</div>
                                                <div style={{ fontSize: '10px', color: '#444' }}>ID: {u.id}</div>
                                            </div>
                                            <div className="mod-col" data-label="Balance">
                                                <span className="mod-balance">${u.balance?.toFixed(2)}</span>
                                                <button
                                                    onClick={() => adjustUserBalance(u)}
                                                    style={{ marginLeft: '6px', cursor: 'pointer', background: 'none', border: 'none', fontSize: '12px' }}
                                                    title="Edit Balance"
                                                >
                                                    ✏️
                                                </button>
                                            </div>
                                            <div className="mod-col" data-label="Role">
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
                                            </div>
                                            <div className="mod-col" data-label="Groups">
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
                                            </div>
                                            <div className="mod-col" data-label="Actions">
                                                <div style={{ display: 'flex', gap: '4px' }}>
                                                    {u.id !== user.id && (
                                                        <button
                                                            onClick={async () => {
                                                                if (confirm('Delete user? This action cannot be undone.')) {
                                                                    const res = await deleteUser(u.id);
                                                                    if (res.success) {
                                                                        alert('User deleted successfully.');
                                                                    } else {
                                                                        alert('Error deleting user: ' + res.error);
                                                                    }
                                                                }
                                                            }}
                                                            style={{ padding: '4px 8px', background: '#333', color: '#ef4444', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '10px' }}
                                                        >
                                                            Delete
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* --- COMMUNITY TAB --- */}
                    {activeTab === 'community' && (
                        <div className="card">
                            <h2 style={{ fontSize: '18px', marginBottom: '16px' }}>Bet Ideas Management</h2>

                            {/* Filter Tabs */}
                            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', borderBottom: '1px solid #333', paddingBottom: '8px' }}>
                                {['pending', 'approved', 'denied', 'reviewed', 'deleted', 'all'].map(status => {
                                    const count = ideas.filter(i => {
                                        const s = i.status || 'pending';
                                        if (status === 'all') return s !== 'deleted';
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
                                    if (ideaFilter === 'all') return status !== 'deleted';
                                    return status === ideaFilter;
                                })
                                .map(idea => (
                                    <div key={idea.id} style={{ marginBottom: '8px', background: '#222', borderRadius: '8px', borderLeft: idea.status === 'approved' ? '4px solid #10b981' : (idea.status === 'denied' ? '4px solid #ef4444' : '4px solid #f59e0b'), padding: '12px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div>
                                                <div style={{ fontStyle: 'italic', marginBottom: '4px' }}>"{idea.text}"</div>
                                                <div style={{ fontSize: '12px', color: '#888' }}>
                                                    By {idea.username} • <span style={{ color: idea.status === 'approved' ? '#10b981' : (idea.status === 'denied' ? '#ef4444' : '#f59e0b') }}>{idea.status ? idea.status.toUpperCase() : 'PENDING'}</span>
                                                </div>
                                                {idea.adminReply && <div style={{ fontSize: '12px', color: '#10b981', marginTop: '4px' }}>↩ Replied: "{idea.adminReply}"</div>}
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
                                                <button
                                                    onClick={() => {
                                                        if (openReplyId === idea.id) {
                                                            setOpenReplyId(null);
                                                        } else {
                                                            setOpenReplyId(idea.id);
                                                            setReplyText(idea.adminReply || '');
                                                        }
                                                    }}
                                                    style={{ padding: '4px 8px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                                                >
                                                    Reply
                                                </button>
                                                <button onClick={() => deleteIdea(idea.id)} style={{ padding: '4px 8px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>Del</button>
                                            </div>
                                        </div>

                                        {/* Reply Box */}
                                        {openReplyId === idea.id && (
                                            <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #333' }}>
                                                <textarea
                                                    value={replyText}
                                                    onChange={e => setReplyText(e.target.value)}
                                                    placeholder="Write a reply to the user..."
                                                    style={{ width: '100%', padding: '8px', background: '#111', color: '#fff', border: '1px solid #444', borderRadius: '4px', minHeight: '60px', marginBottom: '8px', fontSize: '13px' }}
                                                />
                                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                                                    <button onClick={() => setOpenReplyId(null)} style={{ padding: '6px 12px', background: 'transparent', color: '#888', border: 'none', cursor: 'pointer', fontSize: '12px' }}>Cancel</button>
                                                    <button
                                                        onClick={async () => {
                                                            console.log("Sending reply. Content:", replyText);
                                                            const res = await replyToIdea(idea.id, replyText);
                                                            if (res.success) {
                                                                setOpenReplyId(null);
                                                                setReplyText('');
                                                                alert('Reply sent and user notified!');
                                                            } else {
                                                                alert('Error: ' + res.error);
                                                            }
                                                        }}
                                                        style={{ padding: '6px 12px', background: 'var(--primary)', color: '#000', borderRadius: '4px', border: 'none', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}
                                                    >
                                                        Send Reply
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            {ideas.length === 0 && <p style={{ color: '#888', fontStyle: 'italic' }}>No ideas found.</p>}
                        </div>
                    )}

                    {/* --- SYSTEM TAB --- */}
                    {activeTab === 'system' && (
                        <div>
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
                                        Send a notification to specific user groups or everyone.
                                    </p>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                        <div>
                                            <label style={{ fontSize: '12px', color: '#888', display: 'block', marginBottom: '4px' }}>Target Audience</label>
                                            <select id="notif-target" className="input" style={{ width: '100%', background: '#222' }}>
                                                <option value="all">Everyone (All Users)</option>
                                                <option value="The Boys">The Boys</option>
                                                <option value="The Fam">The Fam</option>
                                                <option value="Moderator">Moderators</option>
                                                <option value="admin">Admins</option>
                                            </select>
                                        </div>

                                        <div>
                                            <label style={{ fontSize: '12px', color: '#888', display: 'block', marginBottom: '4px' }}>Title</label>
                                            <input id="notif-title" className="input" placeholder="Notification Title" style={{ width: '100%' }} />
                                        </div>

                                        <div>
                                            <label style={{ fontSize: '12px', color: '#888', display: 'block', marginBottom: '4px' }}>Message Body</label>
                                            <textarea id="notif-msg" className="input" style={{ width: '100%', height: '80px', resize: 'vertical' }} placeholder="Message body..." />
                                        </div>

                                        <button
                                            className="btn btn-primary"
                                            onClick={async () => {
                                                const targetSelect = document.getElementById('notif-target');
                                                const target = targetSelect.value;
                                                const title = document.getElementById('notif-title').value;
                                                const msg = document.getElementById('notif-msg').value;

                                                if (!title || !msg) return alert("Please fill both title and message.");

                                                const targetLabel = targetSelect.options[targetSelect.selectedIndex].text;

                                                if (confirm(`Send to ${targetLabel}?\nTitle: ${title}`)) {
                                                    const res = await sendSystemNotification(title, msg, target);
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
                                            Send Notification
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Casino Management Section */}
                            <div className="card" style={{ marginTop: '24px', maxWidth: '1200px' }}>
                                <h2 style={{ fontSize: '18px', marginBottom: '16px' }}>🎰 Casino Game Status</h2>
                                <p style={{ fontSize: '13px', color: '#888', marginBottom: '16px' }}>
                                    Disable games temporarily for maintenance or to resolve issues. Users will see a locked screen.
                                </p>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
                                    {['slots', 'crash', 'blackjack'].map(gameId => {
                                        const isEnabled = casinoSettings?.[gameId] !== false; // Default true
                                        return (
                                            <div key={gameId} style={{
                                                padding: '16px',
                                                background: '#222',
                                                borderRadius: '8px',
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                border: isEnabled ? '1px solid #10b981' : '1px solid #ef4444'
                                            }}>
                                                <div>
                                                    <strong style={{ textTransform: 'capitalize', display: 'block', color: '#fff' }}>{gameId}</strong>
                                                    <span style={{ fontSize: '12px', color: isEnabled ? '#10b981' : '#ef4444' }}>
                                                        {isEnabled ? 'Active' : 'Disabled'}
                                                    </span>
                                                </div>
                                                <button
                                                    onClick={() => updateCasinoStatus(gameId, !isEnabled)}
                                                    style={{
                                                        padding: '6px 12px',
                                                        borderRadius: '20px',
                                                        border: 'none',
                                                        cursor: 'pointer',
                                                        fontWeight: 'bold',
                                                        fontSize: '12px',
                                                        background: isEnabled ? '#10b981' : '#ef4444',
                                                        color: '#000'
                                                    }}
                                                >
                                                    {isEnabled ? 'Turn OFF' : 'Turn ON'}
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Data Maintenance Section */}
                            <div className="card" style={{ marginTop: '24px', maxWidth: '1200px' }}>
                                <h2 style={{ fontSize: '18px', marginBottom: '16px' }}>🔧 Data Maintenance</h2>
                                <p style={{ fontSize: '13px', color: '#888', marginBottom: '12px' }}>
                                    Run these tasks to ensure data consistency across the database.
                                </p>
                                <div style={{ display: 'flex', gap: '12px' }}>
                                    <button
                                        className="btn"
                                        style={{ background: '#f59e0b', color: '#000', fontWeight: 'bold' }}
                                        onClick={async () => {
                                            if (confirm("This will overwrite username/profilePic on ALL past bets, parlays, and ideas with the current user profile data. Continue?")) {
                                                const res = await syncAllUsernames();
                                                if (res.success) alert(res.message);
                                                else alert("Error: " + res.error);
                                            }
                                        }}
                                    >
                                        🔄 Sync All Usernames
                                    </button>
                                    <button
                                        className="btn"
                                        style={{ background: '#ef4444', color: '#fff', fontWeight: 'bold' }}
                                        onClick={runSlotsClawback}
                                    >
                                        🎰 Clawback Slots Profits
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

                        {/* --- BETS MANAGEMENT --- */}
                        <hr style={{ borderColor: '#333', margin: '24px 0' }} />
                        <h3 style={{ fontSize: '16px', marginBottom: '12px' }}>Event Bets</h3>

                        {(() => {
                            const active = editingBets.filter(b => b.status === 'pending');
                            const completed = editingBets.filter(b => b.status !== 'pending');

                            // Helper to group by outcome
                            const groupByOutcome = (list) => {
                                const grouped = {};
                                list.forEach(b => {
                                    const key = b.outcomeLabel || 'Unknown';
                                    if (!grouped[key]) grouped[key] = [];
                                    grouped[key].push(b);
                                });
                                return grouped;
                            };

                            const activeGrouped = groupByOutcome(active);
                            const completedGrouped = groupByOutcome(completed);

                            return (
                                <div>
                                    {/* ACTIVE */}
                                    <div style={{ marginBottom: '24px' }}>
                                        <h4 style={{ fontSize: '14px', color: '#10b981', marginBottom: '8px', borderBottom: '1px solid #333', paddingBottom: '4px' }}>
                                            Active / Pending ({active.length})
                                        </h4>
                                        {active.length === 0 ? <p style={{ fontSize: '12px', color: '#666' }}>No active bets.</p> : (
                                            Object.entries(activeGrouped).map(([outcome, bets]) => (
                                                <div key={outcome} style={{ marginBottom: '12px' }}>
                                                    <div style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--primary)', marginBottom: '4px' }}>
                                                        {outcome}
                                                    </div>
                                                    {bets.map(b => (
                                                        <div key={b.id} style={{ fontSize: '12px', padding: '4px 8px', background: '#222', marginBottom: '2px', display: 'flex', justifyContent: 'space-between' }}>
                                                            <span>{b.username}: ${b.amount}</span>
                                                            <button onClick={() => { if (confirm('Delete?')) deleteBet(b.id) }} style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}>x</button>
                                                        </div>
                                                    ))}
                                                </div>
                                            ))
                                        )}
                                    </div>

                                    {/* COMPLETED */}
                                    <div>
                                        <h4 style={{ fontSize: '14px', color: '#666', marginBottom: '8px', borderBottom: '1px solid #333', paddingBottom: '4px' }}>
                                            Completed / Settled ({completed.length})
                                        </h4>
                                        {completed.length === 0 ? <p style={{ fontSize: '12px', color: '#666' }}>No settled bets.</p> : (
                                            Object.entries(completedGrouped).map(([outcome, bets]) => (
                                                <div key={outcome} style={{ marginBottom: '12px' }}>
                                                    <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#888', marginBottom: '4px' }}>
                                                        {outcome}
                                                    </div>
                                                    {bets.map(b => (
                                                        <div key={b.id} style={{ fontSize: '12px', padding: '4px 8px', background: '#222', marginBottom: '2px', display: 'flex', justifyContent: 'space-between', opacity: 0.7 }}>
                                                            <span>{b.username}: ${b.amount} ({b.status})</span>
                                                            <button onClick={() => { if (confirm('Delete?')) deleteBet(b.id) }} style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}>x</button>
                                                        </div>
                                                    ))}
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            );
                        })()}
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
