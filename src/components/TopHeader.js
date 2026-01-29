"use client";
import Link from 'next/link';
import { useApp } from '../lib/store';

export default function TopHeader() {
    const { user, isGuestMode, setIsGuestMode } = useApp();

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
            <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <img src="/logo.png" alt="Logo" style={{ height: '50px', width: 'auto' }} />
                <h1 className="header-title" style={{ margin: 0, fontSize: '22px', fontWeight: '800', letterSpacing: '-0.5px', color: '#fff' }}>Bet It Happens</h1>
            </Link>

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
                        <span style={{ color: '#fff' }}>{user.username}</span>
                    </div>
                </Link>
            ) : isGuestMode && (
                <div
                    onClick={() => setIsGuestMode(false)}
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
        </header>
    );
}
