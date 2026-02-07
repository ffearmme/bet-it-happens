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
        <div className="mod-container">

            {/* SIDEBAR NAVIGATION */}
            <nav className="mod-sidebar">
                <h1 className="mod-title">
                    🛡️ <span className="mod-title-text">Moderator</span>
                </h1>

                <div className="mod-nav-links">
                    {[
                        { id: 'dashboard', label: 'Dashboard', icon: '📊' },
                        { id: 'ideas', label: 'Bet Ideas', icon: '💡' },
                        { id: 'concerns', label: 'Report Issue', icon: '⚠️' },
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
                    Mod Panel v1.0
                </div>
            </nav>

            {/* MAIN CONTENT AREA */}
            <div className="mod-content">

                {/* TOP BAR */}
                <header className="mod-header">
                    <div className="mod-header-title">
                        {activeTab === 'ideas' ? 'User Bet Ideas' : activeTab === 'concerns' ? 'Report Concern' : 'Dashboard'}
                    </div>

                    {/* Global Search */}
                    {activeTab === 'ideas' && (
                        <div className="mod-search-container">
                            <input
                                type="text"
                                placeholder="Search ideas..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="mod-search-input"
                            />
                        </div>
                    )}
                </header>

                {/* SCROLLABLE PAGE CONTENT */}
                <div className="mod-scroll-content">

                    {/* --- DASHBOARD TAB --- */}
                    {activeTab === 'dashboard' && (
                        <div className="animate-fade">
                            <div className="mod-dashboard-grid">
                                <div className="card mod-stat-card">
                                    <h3>Pending Ideas</h3>
                                    <p className={pendingIdeasCount > 0 ? 'text-primary' : ''}>
                                        {pendingIdeasCount}
                                    </p>
                                    <div>Requires Review</div>
                                </div>
                                <div className="card mod-stat-card">
                                    <h3>Reputation</h3>
                                    <p style={{ color: '#10b981' }}>Good</p>
                                    <div>System Status</div>
                                </div>
                                <div className="card mod-stat-card">
                                    <h3>Your Role</h3>
                                    <p>MOD</p>
                                    <div>{user.username}</div>
                                </div>
                            </div>

                            <div className="card mod-welcome-card">
                                <h2>👋 Welcome, Moderator</h2>
                                <p>
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
                            <div className="card mod-ideas-card">
                                <div className="mod-ideas-header">
                                    <h2>User Submitted Ideas ({filteredIdeas.length})</h2>
                                </div>
                                <div>
                                    {filteredIdeas.length > 0 ? (
                                        filteredIdeas.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt)).map(idea => (
                                            <div key={idea.id} className="mod-idea-item">
                                                <div className="mod-idea-content">
                                                    <p className="mod-idea-text">"{idea.text}"</p>
                                                    <div className="mod-idea-meta">
                                                        <span style={{ color: 'var(--primary)' }}>By: {idea.username}</span>
                                                        <span>•</span>
                                                        <span>{new Date(idea.submittedAt).toLocaleDateString()}</span>
                                                        {idea.status && (
                                                            <span className={`mod-status-badge ${idea.status}`}>
                                                                {idea.status.toUpperCase()}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                {!idea.status && (
                                                    <div className="mod-idea-actions">
                                                        <button
                                                            onClick={async () => {
                                                                if (confirm(`Approve idea "${idea.text}"?`)) {
                                                                    await reviewIdea(idea.id, 'approved');
                                                                }
                                                            }}
                                                            className="mod-btn-approve"
                                                        >
                                                            Approve
                                                        </button>
                                                        <button
                                                            onClick={async () => {
                                                                if (confirm(`Deny idea "${idea.text}"?`)) {
                                                                    await reviewIdea(idea.id, 'denied');
                                                                }
                                                            }}
                                                            className="mod-btn-deny"
                                                        >
                                                            Deny
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        ))
                                    ) : (
                                        <div className="mod-no-ideas">
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
                            <div className="card animate-fade mod-concern-card">
                                <h2 style={{ fontSize: '18px', marginBottom: '16px' }}>Report Issue to Admin</h2>
                                <p style={{ fontSize: '14px', color: '#888', marginBottom: '20px' }}>
                                    Need to escalate something? Determine a user is cheating? Or just have a general question?
                                    Send a direct message to the admin team here.
                                </p>

                                <textarea
                                    className="input mod-concern-input"
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
