"use client";
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useApp } from '../lib/store';

export default function TopHeader() {
    const { user, isGuestMode, setIsGuestMode, notifications, markNotificationAsRead, clearAllNotifications, claimReferralReward } = useApp();
    const [showNotifs, setShowNotifs] = useState(false);
    const [claimingId, setClaimingId] = useState(null);
    const notifRef = useRef(null);
    const router = useRouter();

    const unreadCount = notifications ? notifications.filter(n => !n.read).length : 0;

    // Close popup when clicking outside
    useEffect(() => {
        function handleClickOutside(event) {
            if (notifRef.current && !notifRef.current.contains(event.target)) {
                setShowNotifs(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [notifRef]);

    return (
        <header style={{
            padding: '12px 20px',
            borderBottom: '1px solid var(--border)',
            background: 'var(--bg-card)',
            position: 'sticky',
            top: 0,
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <img src="/logo.png" alt="Bet It Happens Logo" style={{ height: '50px', width: 'auto' }} />
                    <div className="header-title" style={{ margin: 0, fontSize: '22px', fontWeight: '800', letterSpacing: '-0.5px', color: '#fff' }}>Bet It Happens</div>
                </Link>
            </div>

            <div className="header-actions">
                {user && (
                    <div className="bell-wrapper" ref={notifRef}>
                        <div
                            style={{ position: 'relative', cursor: 'pointer', padding: '6px' }}
                            className={unreadCount > 0 ? "animate-ring" : ""}
                            onClick={() => setShowNotifs(!showNotifs)}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" style={{ width: '24px', height: '24px', color: '#fff' }}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
                            </svg>
                            {unreadCount > 0 && (
                                <div style={{
                                    position: 'absolute', top: '0', right: '0',
                                    background: 'var(--accent-loss)', color: '#fff',
                                    borderRadius: '50%', width: '16px', height: '16px',
                                    fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontWeight: 'bold', border: '1px solid #000'
                                }}>
                                    {unreadCount}
                                </div>
                            )}
                        </div>

                        {showNotifs && (
                            <div className="card animate-fade notification-popup">
                                <div style={{ padding: '12px', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontWeight: 'bold' }}>Notifications</span>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        {unreadCount > 0 && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    notifications.forEach(n => { if (!n.read) markNotificationAsRead(n.id) });
                                                }}
                                                style={{
                                                    fontSize: '10px',
                                                    color: 'var(--primary)',
                                                    background: '#10b98120',
                                                    border: '1px solid #10b98150',
                                                    padding: '4px 10px',
                                                    borderRadius: '12px',
                                                    cursor: 'pointer',
                                                    fontWeight: '600'
                                                }}
                                            >
                                                Mark Read
                                            </button>
                                        )}
                                        {notifications.length > 0 && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (confirm('Are you sure you want to delete all notifications?')) clearAllNotifications();
                                                }}
                                                style={{
                                                    fontSize: '10px',
                                                    color: '#ef4444',
                                                    background: '#ef444420',
                                                    border: '1px solid #ef444450',
                                                    padding: '4px 10px',
                                                    borderRadius: '12px',
                                                    cursor: 'pointer',
                                                    fontWeight: '600'
                                                }}
                                            >
                                                Clear All
                                            </button>
                                        )}
                                    </div>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    {notifications && notifications.length > 0 ? (
                                        [...notifications].sort((a, b) => {
                                            const getTime = (t) => {
                                                if (!t) return Date.now();
                                                if (typeof t.toMillis === 'function') return t.toMillis();
                                                if (t.seconds) return t.seconds * 1000;
                                                return new Date(t).getTime();
                                            };
                                            return getTime(b.createdAt) - getTime(a.createdAt);
                                        }).map(n => {
                                            return (
                                                <div
                                                    key={n.id}
                                                    onClick={() => markNotificationAsRead(n.id)}
                                                    style={{
                                                        padding: '12px', borderBottom: '1px solid #222',
                                                        background: n.read ? 'transparent' : 'rgba(255,255,255,0.05)',
                                                        cursor: 'pointer', transition: 'background 0.2s'
                                                    }}
                                                    className="hover:bg-white/5"
                                                >
                                                    <div style={{ fontSize: '13px', fontWeight: n.read ? 'normal' : 'bold', color: '#fff', marginBottom: '4px' }}>{n.title || 'Notification'}</div>
                                                    <div style={{ fontSize: '12px', color: '#ccc', whiteSpace: 'pre-wrap' }}>{n.message || 'No details available.'}</div>
                                                    <div style={{ fontSize: '10px', color: '#666', marginTop: '4px' }}>
                                                        {(() => {
                                                            const d = n.createdAt && typeof n.createdAt.toDate === 'function'
                                                                ? n.createdAt.toDate()
                                                                : new Date(n.createdAt || Date.now());
                                                            return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
                                                        })()}
                                                    </div>
                                                    {n.type === 'referral_claim' && !n.claimed && (
                                                        <button
                                                            style={{
                                                                marginTop: '8px', width: '100%',
                                                                background: claimingId === n.id ? '#666' : 'linear-gradient(90deg, #10b981, #059669)',
                                                                border: 'none', borderRadius: '6px',
                                                                color: '#fff', fontSize: '12px', fontWeight: 'bold',
                                                                padding: '6px', cursor: claimingId === n.id ? 'default' : 'pointer'
                                                            }}
                                                            onClick={async (e) => {
                                                                e.stopPropagation();
                                                                if (claimingId) return;
                                                                setClaimingId(n.id);
                                                                await claimReferralReward(n.id, n.amount || 500);
                                                                setClaimingId(null);
                                                            }}
                                                        >
                                                            {claimingId === n.id ? 'Claiming...' : `Claim $${n.amount || 500}`}
                                                        </button>
                                                    )}
                                                </div>
                                            );
                                        })
                                    ) : (
                                        <div style={{ padding: '24px', textAlign: 'center', color: '#666', fontSize: '13px' }}>No notifications</div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {user ? (
                    <Link href="/profile" style={{ textDecoration: 'none', color: 'inherit' }}>
                        <div style={{
                            padding: '6px 12px',
                            borderRadius: '20px',
                            background: 'rgba(255,255,255,0.05)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            border: '1px solid var(--border)',
                            fontSize: '13px',
                            fontWeight: '600',
                            gap: '8px',
                            cursor: 'pointer',
                            transition: 'background 0.2s'
                        }}>
                            {user.profilePic ? (
                                <img src={user.profilePic} style={{ width: '24px', height: '24px', borderRadius: '50%', objectFit: 'cover' }} alt="" />
                            ) : (
                                <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#000', fontSize: '12px', fontWeight: 'bold' }}>
                                    {user.username.charAt(0).toUpperCase()}
                                </div>
                            )}
                            <span style={{ color: '#fff' }} className="hidden md:inline">{user.username}</span>
                        </div>
                    </Link>
                ) : isGuestMode && (
                    <div
                        onClick={() => {
                            setIsGuestMode(false);
                            router.push('/');
                        }}
                        style={{
                            padding: '6px 12px',
                            borderRadius: '20px',
                            background: 'rgba(255,255,255,0.05)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            border: '1px solid var(--border)',
                            fontSize: '13px',
                            fontWeight: '600',
                            gap: '8px',
                            cursor: 'pointer',
                            transition: 'background 0.2s'
                        }}
                    >
                        <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style={{ width: '14px', height: '14px', color: '#000' }}>
                                <path fillRule="evenodd" d="M7.5 6a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM3.751 20.105a8.25 8.25 0 0116.498 0 .75.75 0 01-.437.695A18.683 18.683 0 0112 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 01-.437-.695z" clipRule="evenodd" />
                            </svg>

                        </div>
                        <span style={{ color: '#fff' }}>Login</span>
                    </div>
                )}
            </div>
        </header>
    );
}
