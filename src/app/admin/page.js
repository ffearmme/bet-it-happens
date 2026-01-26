"use client";
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '../../lib/store';

import { db } from '../../lib/firebase';
import { collection, query, limit, onSnapshot } from 'firebase/firestore';

export default function Admin() {
    const { user, events, createEvent, resolveEvent, deleteEvent, updateEvent, fixStuckBets, deleteBet, toggleFeatured, ideas, deleteIdea, users, deleteUser, syncEventStats, recalculateLeaderboard, isLoaded } = useApp();
    const router = useRouter();
    const [newEvent, setNewEvent] = useState({
        title: '', description: '', outcome1: '', odds1: '', outcome2: '', odds2: '', deadline: '', startAt: '', category: 'Sports'
    });
    const [editingId, setEditingId] = useState(null);
    const [showRules, setShowRules] = useState(false);
    const [allBets, setAllBets] = useState([]);

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
        if (editingId) {
            await updateEvent(editingId, {
                title: newEvent.title,
                description: newEvent.description,
                startAt: newEvent.startAt,
                deadline: newEvent.deadline,
                category: newEvent.category,
                // We update outcomes 'labels' but warn about odds. To simplify, we'll try to update the array if possible.
                // Re-constructing outcomes array while keeping IDs effectively might be complex if indices match.
                // For now, let's just update main fields.
            });
            alert('Event updated (Title, Desc, dates, category).');
            setEditingId(null);
            setNewEvent({ title: '', description: '', outcome1: '', odds1: '', outcome2: '', odds2: '', deadline: '', startAt: '', category: 'Sports' });
        } else {
            createEvent({
                title: newEvent.title,
                description: newEvent.description,
                category: newEvent.category,
                startAt: newEvent.startAt || new Date(Date.now() + 86400000).toISOString(),
                deadline: newEvent.deadline || null,
                outcomes: [
                    { id: 'o-' + Date.now() + '-1', label: newEvent.outcome1, odds: parseFloat(newEvent.odds1) },
                    { id: 'o-' + Date.now() + '-2', label: newEvent.outcome2, odds: parseFloat(newEvent.odds2) },
                ]
            });
            setNewEvent({ title: '', description: '', outcome1: '', odds1: '', outcome2: '', odds2: '', deadline: '', startAt: '' });
        }
    };

    const startEdit = (event) => {
        setEditingId(event.id);
        setNewEvent({
            title: event.title,
            description: event.description,
            outcome1: event.outcomes[0]?.label || '',
            odds1: event.outcomes[0]?.odds || '',
            outcome2: event.outcomes[1]?.label || '',
            odds2: event.outcomes[1]?.odds || '',
            deadline: event.deadline || '',
            startAt: event.startAt || '',
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    return (
        <div className="container animate-fade">
            <h1 style={{ marginTop: '20px' }}>Admin Dashboard</h1>

            <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h2>{editingId ? 'Edit Event' : 'Create Event'}</h2>
                    {editingId && <button onClick={() => { setEditingId(null); setNewEvent({ title: '', description: '', outcome1: '', odds1: '', outcome2: '', odds2: '', deadline: '', startAt: '', category: 'Sports' }); }} style={{ fontSize: '12px', color: 'red' }}>Cancel Edit</button>}
                </div>
                <form onSubmit={handleCreate}>
                    <div className="input-group">
                        <input className="input" placeholder="Event Title" value={newEvent.title} onChange={e => setNewEvent({ ...newEvent, title: e.target.value })} required />
                    </div>
                    <div className="input-group">
                        <label className="text-sm" style={{ marginBottom: '4px', display: 'block' }}>Category</label>
                        <select
                            className="input"
                            value={newEvent.category || 'Sports'}
                            onChange={e => setNewEvent({ ...newEvent, category: e.target.value })}
                            style={{ background: 'var(--bg-card)', color: '#fff' }}
                        >
                            <option value="Super Bowl">Super Bowl 🏆</option>
                            <option value="Sports">Sports</option>
                            <option value="Video Games">Video Games</option>
                            <option value="Local/Community">Local/Community</option>
                            <option value="Weather">Weather</option>
                            <option value="Tech">Tech</option>
                            <option value="Pop Culture">Pop Culture</option>
                        </select>
                    </div>
                    <div className="input-group">
                        <input className="input" placeholder="Description" value={newEvent.description} onChange={e => setNewEvent({ ...newEvent, description: e.target.value })} required />
                    </div>
                    <div className="input-group">
                        <label className="text-sm" style={{ marginBottom: '4px', display: 'block' }}>Betting Deadline (Locks Bets)</label>
                        <input
                            className="input"
                            type="datetime-local"
                            value={newEvent.deadline}
                            onChange={e => setNewEvent({ ...newEvent, deadline: e.target.value })}
                        />
                    </div>
                    <div className="input-group">
                        <label className="text-sm" style={{ marginBottom: '4px', display: 'block' }}>Resolution Date (Event Starts/Ends)</label>
                        <input
                            className="input"
                            type="datetime-local"
                            required
                            value={newEvent.startAt}
                            onChange={e => setNewEvent({ ...newEvent, startAt: e.target.value })}
                        />
                    </div>
                    {!editingId && (
                        <>
                            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '8px', marginBottom: '8px' }}>
                                <input className="input" placeholder="Outcome AA" value={newEvent.outcome1} onChange={e => setNewEvent({ ...newEvent, outcome1: e.target.value })} required />
                                <input className="input" type="number" step="0.01" placeholder="Odds" value={newEvent.odds1} onChange={e => setNewEvent({ ...newEvent, odds1: e.target.value })} required />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '8px', marginBottom: '16px' }}>
                                <input className="input" placeholder="Outcome BB" value={newEvent.outcome2} onChange={e => setNewEvent({ ...newEvent, outcome2: e.target.value })} required />
                                <input className="input" type="number" step="0.01" placeholder="Odds" value={newEvent.odds2} onChange={e => setNewEvent({ ...newEvent, odds2: e.target.value })} required />
                            </div>
                        </>
                    )}
                    {editingId && <p className="text-sm" style={{ marginBottom: '10px', color: 'orange' }}>Note: Outcome labels/odds cannot be edited safely yet.</p>}
                    <button className="btn btn-primary">{editingId ? 'Update Event' : 'Create Event'}</button>
                </form>
            </div>

            <div className="card">
                <h2>Resolve Events</h2>
                {events.filter(e => e.status === 'open' || e.status === 'locked').map(event => (
                    <div key={event.id} style={{ borderBottom: '1px solid var(--border)', paddingBottom: '16px', marginBottom: '16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <p style={{ fontWeight: 600 }}>{event.title}</p>
                            <div>
                                <button
                                    onClick={() => startEdit(event)}
                                    style={{ background: 'transparent', border: '1px solid var(--primary)', color: 'var(--primary)', cursor: 'pointer', fontSize: '11px', padding: '2px 8px', borderRadius: '4px', marginRight: '8px' }}
                                >
                                    Edit
                                </button>
                                <button
                                    onClick={() => { if (confirm('Delete event?')) deleteEvent(event.id) }}
                                    style={{ background: 'transparent', border: 'none', color: 'var(--accent-loss)', cursor: 'pointer', fontSize: '12px' }}
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                        <div style={{ marginTop: '8px' }}>
                            <button
                                onClick={() => toggleFeatured(event.id, event.featured)}
                                style={{
                                    background: event.featured ? 'var(--primary)' : 'transparent',
                                    color: event.featured ? '#000' : 'var(--primary)',
                                    border: '1px solid var(--primary)',
                                    padding: '4px 8px',
                                    borderRadius: '4px',
                                    fontSize: '11px',
                                    cursor: 'pointer',
                                    marginRight: '10px'
                                }}
                            >
                                {event.featured ? '★ Featured' : '☆ set Featured'}
                            </button>
                        </div>

                        <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                            {event.outcomes.map(o => (
                                <button key={o.id} className="btn btn-outline" style={{ fontSize: '12px', padding: '8px' }} onClick={async () => {
                                    if (window.confirm(`Are you sure you want to resolve this event?\n\nWinner: ${o.label}\n\nThis action cannot be undone.`)) {
                                        const res = await resolveEvent(event.id, o.id);
                                        if (!res.success) alert("Error resolving: " + res.error);
                                    }
                                }}>
                                    {o.label} Wins
                                </button>
                            ))}
                        </div>
                    </div>
                ))}
                {events.filter(e => e.status === 'open' || e.status === 'locked').length === 0 && <p className="text-sm">No active events to resolve.</p>}
            </div>

            <div className="card">
                <h2>User Bet Ideas</h2>

                {ideas && ideas.length > 0 ? (
                    ideas.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt)).map(idea => (
                        <div key={idea.id} style={{ borderBottom: '1px solid var(--border)', paddingBottom: '12px', marginBottom: '12px' }}>
                            <p style={{ fontWeight: 600, fontSize: '14px', marginBottom: '4px' }}>"{idea.text}"</p>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <span className="text-sm" style={{ fontSize: '12px', color: 'var(--primary)', marginRight: '8px' }}>By: {idea.username}</span>
                                    <span className="text-sm" style={{ fontSize: '10px' }}>{new Date(idea.submittedAt).toLocaleDateString()}</span>
                                </div>
                                <button
                                    onClick={() => { if (confirm('Delete idea?')) deleteIdea(idea.id) }}
                                    style={{ background: 'var(--accent-loss)', border: 'none', cursor: 'pointer', color: '#fff', fontSize: '10px', padding: '4px 8px', borderRadius: '4px', fontWeight: 'bold' }}
                                >
                                    DELETE IDEA
                                </button>
                            </div>
                        </div>
                    ))
                ) : (
                    <p className="text-sm">No ideas submitted yet.</p>
                )}
            </div>

            <div className="card">
                <h2>Manage Users (Clean up Leaderboard)</h2>
                <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                    {users.sort((a, b) => (b.balance || 0) - (a.balance || 0)).map(u => (
                        <div key={u.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', padding: '8px 0' }}>
                            <div>
                                <div style={{ fontWeight: 'bold' }}>{u.username} <span style={{ fontSize: '10px', color: '#666', fontWeight: 'normal' }}>({u.role})</span></div>
                                <div style={{ fontSize: '12px', color: '#888' }}>ID: {u.id} • Balance: ${u.balance?.toFixed(2)}</div>
                            </div>
                            {u.id !== user.id && (
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
                            )}
                        </div>
                    ))}
                </div>
            </div>

            <div className="card">
                <h2>Recent Bets (Global)</h2>
                {allBets.length === 0 ? <p className="text-sm">No bets placed yet.</p> : (
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
                )}
            </div>

            <div style={{ textAlign: 'center', marginTop: '40px' }}>
                <button
                    onClick={async () => {
                        if (confirm('Recalculate all event stats? This fetches ALL bets.')) {
                            const res = await syncEventStats();
                            if (res.success) alert('Stats synced!');
                            else alert('Error: ' + res.error);
                        }
                    }}
                    style={{ background: 'transparent', border: '1px solid #333', color: '#666', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer', fontSize: '10px' }}
                >
                    Sync Event Stats
                </button>
                <button
                    onClick={async () => {
                        if (!confirm("Recalculate everyone's invested amounts?")) return;
                        const res = await recalculateLeaderboard();
                        if (res.success) alert(res.message);
                        else alert('Error: ' + res.error);
                    }}
                    style={{ background: 'transparent', border: '1px solid var(--primary)', color: 'var(--primary)', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer', fontSize: '10px', marginLeft: '10px' }}
                >
                    🔄 Recalc User Net Worth
                </button>
                <button
                    onClick={async () => {
                        if (!confirm("This will find ALL pending bets on settled events and force-resolve them. Continue?")) return;
                        const res = await fixStuckBets();
                        alert(res.message || res.error);
                    }}
                    style={{ background: 'var(--primary)', border: 'none', color: '#000', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', marginLeft: '10px' }}
                >
                    🛠️ Fix Stuck Bets
                </button>
            </div>

            <div style={{ textAlign: 'center', marginTop: '40px', marginBottom: '20px' }}>
                <button
                    onClick={() => setShowRules(!showRules)}
                    style={{ background: 'transparent', border: 'none', color: 'var(--accent-loss)', textDecoration: 'underline', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold' }}
                >
                    ⚠️ FIX "Insufficient Permissions" ERROR (REQUIRED)
                </button>
            </div>

            {
                showRules && (
                    <div className="card" style={{ border: '1px solid var(--accent-loss)', background: 'rgba(239, 68, 68, 0.05)' }}>
                        <h3 style={{ color: 'var(--accent-loss)', fontSize: '16px' }}>REQUIRED: Update Firestore Rules</h3>
                        <p className="text-sm" style={{ marginBottom: '12px' }}>
                            You cannot resolve bets or delete users until you update these rules.
                            <br />
                            <b>1. Go to:</b> <a href="https://console.firebase.google.com/" target="_blank" style={{ textDecoration: 'underline' }}>Firebase Console</a> {'>'} Firestore Database {'>'} Rules
                            <br />
                            <b>2. Copy & Paste this EXACTLY:</b>
                        </p>
                        <div style={{ position: 'relative' }}>
                            <textarea
                                readOnly
                                style={{
                                    width: '100%', height: '350px',
                                    background: '#1e1e1e', color: '#a6e3a1',
                                    padding: '10px', fontSize: '11px',
                                    fontFamily: 'monospace', borderRadius: '6px',
                                    border: '1px solid #333'
                                }}
                                value={`rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Check if user is Admin (Hardcoded to bypass 'get' limits for batches)
    function isAdmin() {
      return request.auth != null && request.auth.uid == '${user?.id || 'YOUR_ADMIN_UID'}';
    }

    // USERS: Users manage themselves, Admins manage all
    match /users/{userId} {
      allow read, create: if true;
      allow update, delete: if request.auth != null && (request.auth.uid == userId || isAdmin());
    }

    // BETS & IDEAS: Owners can manage, Admins can manage all
    match /bets/{betId} {
      allow read, create: if true;
      allow update, delete: if request.auth != null && (resource.data.userId == request.auth.uid || isAdmin());
    }
    match /ideas/{ideaId} {
      allow read, create: if true;
      allow update, delete: if request.auth != null && (resource.data.userId == request.auth.uid || isAdmin());
    }

    // EVENTS: Admins full control, Users can update (for betting stats)
    match /events/{eventId} {
      allow read: if true;
      allow create, delete: if isAdmin();
      allow update: if request.auth != null; 
    }
  }
}`}
                            />
                            <button
                                className="btn"
                                style={{ position: 'absolute', top: '10px', right: '10px', padding: '4px 8px', fontSize: '10px' }}
                                onClick={() => {
                                    navigator.clipboard.writeText(`rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    function isAdmin() {
      return request.auth != null && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }

    match /users/{userId} {
      allow read, create: if true;
      allow update, delete: if request.auth != null && (request.auth.uid == userId || isAdmin());
    }

    match /bets/{betId} {
      allow read, create: if true;
      allow update, delete: if request.auth != null && (resource.data.userId == request.auth.uid || isAdmin());
    }
    
    match /ideas/{ideaId} {
      allow read, create: if true;
      allow update, delete: if request.auth != null && (resource.data.userId == request.auth.uid || isAdmin());
    }

    match /events/{eventId} {
      allow read: if true;
      allow create, delete: if isAdmin();
      allow update: if request.auth != null; 
    }
  }
}`);
                                    alert("Production Rules copied! Paste them in Firebase Console.");
                                }}
                            >
                                Copy Rules
                            </button>
                        </div>
                    </div>
                )
            }

            <p className="text-sm" style={{ textAlign: 'center', marginTop: '20px', opacity: 0.5 }}>
                System Version V4.1
            </p>
        </div >
    );
}
