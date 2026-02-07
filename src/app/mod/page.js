"use client";
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '../../lib/store';

export default function ModDashboard() {
    const { user, isLoaded, ideas, sendIdeaToAdmin, reviewIdea, submitModConcern } = useApp();
    const router = useRouter();
    const [collapsed, setCollapsed] = useState({
        ideas: true,
        concerns: true
    });
    const [concernMsg, setConcernMsg] = useState('');

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
        if (isLoaded) {
            const isMod = user && (user.role === 'admin' || user.groups?.includes('Moderator'));
            if (!isMod) {
                router.push('/');
            }
        }
    }, [user, isLoaded, router]);

    if (!isLoaded) return null;
    if (!user || (!user.groups?.includes('Moderator') && user.role !== 'admin')) return null;

    return (
        <div className="container animate-fade">
            <h1 style={{ marginTop: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                🛡️ Moderator Dashboard
            </h1>

            <div className="card">
                <div onClick={() => toggle('ideas')} style={sectionHeaderStyle(!collapsed.ideas)}>
                    <h2 style={{ fontSize: '18px', margin: 0 }}>User Bet Ideas</h2>
                    <Minimizer section="ideas" />
                </div>

                {!collapsed.ideas && (ideas && ideas.length > 0 ? (
                    ideas.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt)).map(idea => (
                        <div key={idea.id} style={{ borderBottom: '1px solid var(--border)', paddingBottom: '12px', marginBottom: '12px' }}>
                            <p style={{ fontWeight: 600, fontSize: '14px', marginBottom: '4px' }}>"{idea.text}"</p>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <span className="text-sm" style={{ fontSize: '12px', color: 'var(--primary)', marginRight: '8px' }}>By: {idea.username}</span>
                                    <span className="text-sm" style={{ fontSize: '10px' }}>{new Date(idea.submittedAt).toLocaleDateString()}</span>
                                    {idea.status && (
                                        <span style={{
                                            marginLeft: '8px', fontSize: '10px', fontWeight: 'bold', padding: '2px 6px', borderRadius: '4px',
                                            background: idea.status === 'approved' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                                            color: idea.status === 'approved' ? '#10b981' : '#ef4444'
                                        }}>
                                            {idea.status.toUpperCase()}
                                        </span>
                                    )}
                                </div>
                                {!idea.status && (
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button
                                            onClick={async () => {
                                                if (confirm(`Approve idea "${idea.text}"?`)) {
                                                    await reviewIdea(idea.id, 'approved');
                                                }
                                            }}
                                            style={{
                                                background: '#10b981', color: '#000', border: 'none', padding: '4px 12px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer'
                                            }}
                                        >
                                            Approve ✓
                                        </button>
                                        <button
                                            onClick={async () => {
                                                if (confirm(`Deny idea "${idea.text}"?`)) {
                                                    await reviewIdea(idea.id, 'denied');
                                                }
                                            }}
                                            style={{
                                                background: '#ef4444', color: '#fff', border: 'none', padding: '4px 12px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer'
                                            }}
                                        >
                                            Deny ✕
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))
                ) : (
                    <p className="text-sm">No ideas submitted yet.</p>
                ))}
            </div>

            <div className="card">
                <div onClick={() => toggle('concerns')} style={sectionHeaderStyle(!collapsed.concerns)}>
                    <h2 style={{ fontSize: '18px', margin: 0 }}>Report Concern to Admin</h2>
                    <Minimizer section="concerns" />
                </div>
                {!collapsed.concerns && (
                    <div>
                        <p style={{ fontSize: '12px', color: '#888', marginBottom: '8px' }}>
                            Something look wrong? Send a direct message to the admins.
                        </p>
                        <textarea
                            className="input"
                            style={{ width: '100%', height: '100px', marginBottom: '8px', resize: 'vertical' }}
                            placeholder="Describe the issue..."
                            value={concernMsg}
                            onChange={(e) => setConcernMsg(e.target.value)}
                        />
                        <button
                            className="btn btn-primary"
                            disabled={!concernMsg.trim()}
                            onClick={async () => {
                                const res = await submitModConcern(concernMsg);
                                if (res.success) {
                                    alert('Concern sent to admins.');
                                    setConcernMsg('');
                                    setCollapsed(prev => ({ ...prev, concerns: true }));
                                } else {
                                    alert('Error: ' + res.error);
                                }
                            }}
                        >
                            Send Report
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
