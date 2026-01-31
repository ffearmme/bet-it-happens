"use client";
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '../../lib/store';

export default function ModDashboard() {
    const { user, isLoaded, ideas, sendIdeaToAdmin } = useApp();
    const router = useRouter();
    const [collapsed, setCollapsed] = useState({
        ideas: false
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
                                </div>
                                <button
                                    onClick={async () => {
                                        if (idea.modRecommended) return;
                                        if (confirm(`Recommend "${idea.text}" to Admin?`)) {
                                            const res = await sendIdeaToAdmin(idea.id, idea.text);
                                            if (res.success) alert("Sent to Admin!");
                                            else alert("Error: " + res.error);
                                        }
                                    }}
                                    disabled={idea.modRecommended}
                                    style={{
                                        background: idea.modRecommended ? '#333' : 'var(--primary)',
                                        color: idea.modRecommended ? '#888' : '#000',
                                        border: 'none',
                                        padding: '4px 8px',
                                        borderRadius: '4px',
                                        fontSize: '11px',
                                        fontWeight: 'bold',
                                        cursor: idea.modRecommended ? 'default' : 'pointer'
                                    }}
                                >
                                    {idea.modRecommended ? 'Sent ✓' : 'Send to Admin 📤'}
                                </button>
                            </div>
                        </div>
                    ))
                ) : (
                    <p className="text-sm">No ideas submitted yet.</p>
                ))}
            </div>
        </div>
    );
}
