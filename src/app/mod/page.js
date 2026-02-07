"use client";
import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useApp } from '../../lib/store';

function ModContent() {
    const { user, isLoaded, ideas, reviewIdea, submitModConcern } = useApp();
    const router = useRouter();
    const searchParams = useSearchParams();

    const [activeTab, setActiveTabState] = useState('dashboard');
    const [searchQuery, setSearchQuery] = useState('');
    const [concernMsg, setConcernMsg] = useState('');

    useEffect(() => {
        const tab = searchParams.get('tab');
        if (tab) setActiveTabState(tab);
    }, [searchParams]);

    const setActiveTab = (tab) => {
        setActiveTabState(tab);
        router.push(`/mod?tab=${tab}`);
    };

    // Auth Check
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

    // Filter Ideas based on search
    const filteredIdeas = (ideas || []).filter(i =>
        i.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
        i.username.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const pendingIdeasCount = (ideas || []).filter(i => !i.status || i.status === 'pending').length;

    return (
        <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#000', color: '#fff' }}>

            {/* SIDEBAR NAVIGATION */}
            <div style={{ width: '220px', background: '#111', borderRight: '1px solid #333', display: 'flex', flexDirection: 'column', padding: '20px' }}>
                <h1 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '32px', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    🛡️ Moderator
                </h1>

                <nav style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {[
                        { id: 'dashboard', label: 'Dashboard', icon: '📊' },
                        { id: 'ideas', label: 'Bet Ideas', icon: '💡' },
                        { id: 'concerns', label: 'Report Issue', icon: '⚠️' },
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
                    Mod Panel v1.0
                </div>
            </div>

            {/* MAIN CONTENT AREA */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

                {/* TOP BAR */}
                <div style={{ height: '64px', borderBottom: '1px solid #333', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', background: '#111' }}>
                    <div style={{ fontSize: '16px', fontWeight: '600', textTransform: 'capitalize' }}>
                        {activeTab === 'ideas' ? 'User Bet Ideas' : activeTab === 'concerns' ? 'Report Concern' : 'Dashboard'}
                    </div>

                    {/* Global Search */}
                    {activeTab === 'ideas' && (
                        <div style={{ position: 'relative', width: '300px' }}>
                            <input
                                type="text"
                                placeholder="Search ideas..."
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
                    )}
                </div>

                {/* SCROLLABLE PAGE CONTENT */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '24px', paddingBottom: '100px' }}>

                    {/* --- DASHBOARD TAB --- */}
                    {activeTab === 'dashboard' && (
                        <div className="animate-fade">
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
                                <div className="card" style={{ padding: '20px', textAlign: 'center', background: '#111', border: '1px solid #333' }}>
                                    <h3 style={{ fontSize: '12px', color: '#888', textTransform: 'uppercase', letterSpacing: '1px' }}>Pending Ideas</h3>
                                    <p style={{ fontSize: '32px', fontWeight: 'bold', margin: '10px 0', color: pendingIdeasCount > 0 ? 'var(--primary)' : '#fff' }}>
                                        {pendingIdeasCount}
                                    </p>
                                    <div style={{ fontSize: '12px', color: '#666' }}>Requires Review</div>
                                </div>
                                <div className="card" style={{ padding: '20px', textAlign: 'center', background: '#111', border: '1px solid #333' }}>
                                    <h3 style={{ fontSize: '12px', color: '#888', textTransform: 'uppercase', letterSpacing: '1px' }}>Reputation</h3>
                                    <p style={{ fontSize: '32px', fontWeight: 'bold', margin: '10px 0', color: '#10b981' }}>Good</p>
                                    <div style={{ fontSize: '12px', color: '#666' }}>System Status</div>
                                </div>
                                <div className="card" style={{ padding: '20px', textAlign: 'center', background: '#111', border: '1px solid #333' }}>
                                    <h3 style={{ fontSize: '12px', color: '#888', textTransform: 'uppercase', letterSpacing: '1px' }}>Your Role</h3>
                                    <p style={{ fontSize: '32px', fontWeight: 'bold', margin: '10px 0' }}>MOD</p>
                                    <div style={{ fontSize: '12px', color: '#666' }}>{user.username}</div>
                                </div>
                            </div>

                            <div className="card" style={{ padding: '24px', background: '#111', border: '1px solid #333' }}>
                                <h2 style={{ fontSize: '18px', marginBottom: '16px' }}>👋 Welcome, Moderator</h2>
                                <p style={{ color: '#aaa', lineHeight: '1.6' }}>
                                    Thanks for helping keep the community clean and fun.
                                    Use the <b>Bet Ideas</b> tab to review user submissions.
                                    If you see something suspicious or need help, use the <b>Report Issue</b> tab to contact admins directly.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* --- IDEAS TAB --- */}
                    {activeTab === 'ideas' && (
                        <div className="animate-fade">
                            <div className="card" style={{ background: '#111', border: '1px solid #333', padding: '0' }}>
                                <div style={{ padding: '20px', borderBottom: '1px solid #333' }}>
                                    <h2 style={{ fontSize: '18px' }}>User Submitted Ideas ({filteredIdeas.length})</h2>
                                </div>
                                <div>
                                    {filteredIdeas.length > 0 ? (
                                        filteredIdeas.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt)).map(idea => (
                                            <div key={idea.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid #222' }}>
                                                <div>
                                                    <p style={{ fontWeight: 600, fontSize: '15px', marginBottom: '6px' }}>"{idea.text}"</p>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '12px', color: '#888' }}>
                                                        <span style={{ color: 'var(--primary)' }}>By: {idea.username}</span>
                                                        <span>•</span>
                                                        <span>{new Date(idea.submittedAt).toLocaleDateString()}</span>
                                                        {idea.status && (
                                                            <span style={{
                                                                padding: '2px 8px', borderRadius: '12px', fontSize: '10px',
                                                                background: idea.status === 'approved' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                                                color: idea.status === 'approved' ? '#10b981' : '#ef4444',
                                                                border: idea.status === 'approved' ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid rgba(239, 68, 68, 0.2)'
                                                            }}>
                                                                {idea.status.toUpperCase()}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                {!idea.status && (
                                                    <div style={{ display: 'flex', gap: '10px' }}>
                                                        <button
                                                            onClick={async () => {
                                                                if (confirm(`Approve idea "${idea.text}"?`)) {
                                                                    await reviewIdea(idea.id, 'approved');
                                                                }
                                                            }}
                                                            style={{
                                                                background: '#10b981', color: '#000', border: 'none',
                                                                padding: '6px 16px', borderRadius: '6px', fontSize: '12px',
                                                                fontWeight: '600', cursor: 'pointer', transition: 'opacity 0.2s'
                                                            }}
                                                            onMouseOver={e => e.target.style.opacity = '0.9'}
                                                            onMouseOut={e => e.target.style.opacity = '1'}
                                                        >
                                                            Approve
                                                        </button>
                                                        <button
                                                            onClick={async () => {
                                                                if (confirm(`Deny idea "${idea.text}"?`)) {
                                                                    await reviewIdea(idea.id, 'denied');
                                                                }
                                                            }}
                                                            style={{
                                                                background: 'transparent', color: '#ef4444', border: '1px solid #ef4444',
                                                                padding: '6px 16px', borderRadius: '6px', fontSize: '12px',
                                                                fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s'
                                                            }}
                                                            onMouseOver={e => { e.target.style.background = '#ef4444'; e.target.style.color = '#fff'; }}
                                                            onMouseOut={e => { e.target.style.background = 'transparent'; e.target.style.color = '#ef4444'; }}
                                                        >
                                                            Deny
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        ))
                                    ) : (
                                        <div style={{ padding: '40px', textAlign: 'center', color: '#666' }}>
                                            No ideas found.
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* --- CONCERNS TAB --- */}
                    {activeTab === 'concerns' && (
                        <div style={{ display: 'flex', justifyContent: 'center' }}>
                            <div className="card animate-fade" style={{ width: '100%', maxWidth: '600px', background: '#111', border: '1px solid #333', padding: '24px' }}>
                                <h2 style={{ fontSize: '18px', marginBottom: '16px' }}>Report Issue to Admin</h2>
                                <p style={{ fontSize: '14px', color: '#888', marginBottom: '20px' }}>
                                    Need to escalate something? Determine a user is cheating? Or just have a general question?
                                    Send a direct message to the admin team here.
                                </p>

                                <textarea
                                    className="input"
                                    style={{
                                        width: '100%', height: '150px', marginBottom: '16px',
                                        background: '#222', border: '1px solid #333', color: '#fff',
                                        padding: '12px', borderRadius: '8px', resize: 'vertical'
                                    }}
                                    placeholder="Describe the issue in detail..."
                                    value={concernMsg}
                                    onChange={(e) => setConcernMsg(e.target.value)}
                                />

                                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                    <button
                                        className="btn btn-primary"
                                        disabled={!concernMsg.trim()}
                                        style={{
                                            padding: '10px 24px', opacity: !concernMsg.trim() ? 0.5 : 1,
                                            cursor: !concernMsg.trim() ? 'not-allowed' : 'pointer'
                                        }}
                                        onClick={async () => {
                                            const res = await submitModConcern(concernMsg);
                                            if (res.success) {
                                                alert('Concern sent to admins.');
                                                setConcernMsg('');
                                                setActiveTab('dashboard');
                                            } else {
                                                alert('Error: ' + res.error);
                                            }
                                        }}
                                    >
                                        Send Report
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
}

export default function ModDashboard() {
    return (
        <Suspense fallback={<div className="container" style={{ padding: '20px', color: '#fff' }}>Loading Moderator Dashboard...</div>}>
            <ModContent />
        </Suspense>
    );
}
