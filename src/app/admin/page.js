"use client";
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '../../lib/store';

export default function Admin() {
    const { user, events, createEvent, resolveEvent, ideas } = useApp();
    const router = useRouter();
    const [newEvent, setNewEvent] = useState({
        title: '', description: '', outcome1: '', odds1: '', outcome2: '', odds2: ''
    });

    useEffect(() => {
        if (!user || user.role !== 'admin') {
            router.push('/');
        }
    }, [user, router]);

    if (!user || user.role !== 'admin') return null;

    const handleCreate = (e) => {
        e.preventDefault();
        createEvent({
            title: newEvent.title,
            description: newEvent.description,
            startAt: new Date(Date.now() + 86400000).toISOString(),
            outcomes: [
                { id: 'o-' + Date.now() + '-1', label: newEvent.outcome1, odds: parseFloat(newEvent.odds1) },
                { id: 'o-' + Date.now() + '-2', label: newEvent.outcome2, odds: parseFloat(newEvent.odds2) },
            ]
        });
        setNewEvent({ title: '', description: '', outcome1: '', odds1: '', outcome2: '', odds2: '' });
    };

    return (
        <div className="container animate-fade">
            <h1 style={{ marginTop: '20px' }}>Admin Dashboard</h1>

            <div className="card">
                <h2>Create Event</h2>
                <form onSubmit={handleCreate}>
                    <div className="input-group">
                        <input className="input" placeholder="Event Title" value={newEvent.title} onChange={e => setNewEvent({ ...newEvent, title: e.target.value })} required />
                    </div>
                    <div className="input-group">
                        <input className="input" placeholder="Description" value={newEvent.description} onChange={e => setNewEvent({ ...newEvent, description: e.target.value })} required />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '8px', marginBottom: '8px' }}>
                        <input className="input" placeholder="Outcome AA" value={newEvent.outcome1} onChange={e => setNewEvent({ ...newEvent, outcome1: e.target.value })} required />
                        <input className="input" type="number" step="0.01" placeholder="Odds" value={newEvent.odds1} onChange={e => setNewEvent({ ...newEvent, odds1: e.target.value })} required />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '8px', marginBottom: '16px' }}>
                        <input className="input" placeholder="Outcome BB" value={newEvent.outcome2} onChange={e => setNewEvent({ ...newEvent, outcome2: e.target.value })} required />
                        <input className="input" type="number" step="0.01" placeholder="Odds" value={newEvent.odds2} onChange={e => setNewEvent({ ...newEvent, odds2: e.target.value })} required />
                    </div>
                    <button className="btn btn-primary">Create Event</button>
                </form>
            </div>

            <div className="card">
                <h2>Resolve Events</h2>
                {events.filter(e => e.status === 'open' || e.status === 'locked').map(event => (
                    <div key={event.id} style={{ borderBottom: '1px solid var(--border)', paddingBottom: '16px', marginBottom: '16px' }}>
                        <p style={{ fontWeight: 600 }}>{event.title}</p>
                        <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                            {event.outcomes.map(o => (
                                <button key={o.id} className="btn btn-outline" style={{ fontSize: '12px', padding: '8px' }} onClick={() => resolveEvent(event.id, o.id)}>
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
                                <span className="text-sm" style={{ fontSize: '12px', color: 'var(--primary)' }}>By: {idea.username}</span>
                                <span className="text-sm" style={{ fontSize: '10px' }}>{new Date(idea.submittedAt).toLocaleDateString()}</span>
                            </div>
                        </div>
                    ))
                ) : (
                    <p className="text-sm">No ideas submitted yet.</p>
                )}
            </div>
        </div>
    );
}
