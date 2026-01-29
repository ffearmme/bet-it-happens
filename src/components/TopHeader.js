"use client";
import Link from 'next/link';
import { useApp } from '../lib/store';

export default function TopHeader() {
    const { user } = useApp();

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

            {user && (
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
            )}
        </header>
    );
}
