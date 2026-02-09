"use client";
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useApp } from '../lib/store';
import { Briefcase } from 'lucide-react';

export default function Navbar() {
    const { user, isGuestMode, setIsGuestMode } = useApp();
    const pathname = usePathname();
    const router = useRouter();

    // Hide tabs ONLY if not logged in AND not in guest browsing mode
    if (!user && !isGuestMode) return null; // Logic requested by user

    const isActive = (path) => pathname === path;

    return (
        <nav className="bottom-nav">
            <Link href="/" className={`nav-item ${isActive('/') ? 'active' : ''}`}>
                <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="nav-icon">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
                </svg>
                <span>Home</span>
            </Link>

            {!user && (
                <button
                    onClick={() => {
                        setIsGuestMode(false);
                        if (pathname !== '/') router.push('/');
                    }}
                    className="nav-item"
                    style={{ color: 'var(--primary)', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
                >
                    <svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="nav-icon">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                    </svg>
                    <span style={{ fontWeight: 'bold' }}>Sign Up</span>
                </button>
            )}

            {user && (
                <Link href="/parlay" className={`nav-item ${isActive('/parlay') ? 'active' : ''}`}>
                    <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="nav-icon">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 6.878V6a2.25 2.25 0 012.25-2.25h7.5A2.25 2.25 0 0118 6v.878m-12 0c.235-.083.487-.128.75-.128h10.5c.263 0 .515.045.75.128m-12 0A2.25 2.25 0 004.5 9v.878m13.5-3A2.25 2.25 0 0119.5 9v.878m0 0a2.246 2.246 0 00-.75-.128H5.25c-.263 0-.515.045-.75.128m15 0A2.25 2.25 0 0121 12v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6c0-.98.626-1.813 1.5-2.122" />
                    </svg>
                    <span>Parlays</span>
                </Link>
            )}

            {user && (
                <Link href="/portfolio" className={`nav-item ${isActive('/portfolio') ? 'active' : ''}`}>
                    <Briefcase className="nav-icon" />
                    <span>Portfolio</span>
                </Link>
            )}

            {user && (
                <Link href="/squads" className={`nav-item ${isActive('/squads') ? 'active' : ''}`}>
                    <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="nav-icon">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
                    </svg>
                    <span>Squads</span>
                </Link>
            )}

            <Link href="/leaderboard" className={`nav-item ${isActive('/leaderboard') ? 'active' : ''}`}>
                <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="nav-icon">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.504-1.125-1.125-1.125h-6.75a1.125 1.125 0 01-1.125-1.125v-9.375c0-.621.504-1.125 1.125-1.125h9.75a1.125 1.125 0 011.125 1.125v9.375c0 .621-.504 1.125-1.125 1.125H5.25a1.125 1.125 0 01-1.125-1.125v-3.375" />
                </svg>
                <span>Rank</span>
            </Link>

            {user?.role === 'admin' && (
                <Link href="/admin" className={`nav-item ${isActive('/admin') ? 'active' : ''}`}>
                    <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="nav-icon">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 110-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 01-1.44-4.282m3.102.069a18.03 18.03 0 01-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 018.835 2.535M10.34 6.66a23.847 23.847 0 008.835-2.535m0 0A23.74 23.74 0 0018.795 3m.38 1.125a23.91 23.91 0 011.014 5.395m-1.014 8.855c-.118.38-.245.754-.38 1.125m.38-1.125a23.91 23.91 0 001.014-5.395m0-3.46c.495.43.816 1.035.816 1.73 0 .695-.32 1.3-.816 1.73" />
                    </svg>
                    <span>Admin</span>
                </Link>
            )}

            {(user?.groups?.includes('Moderator') || user?.role === 'admin') && (
                <Link href="/mod" className={`nav-item ${isActive('/mod') ? 'active' : ''}`}>
                    <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="nav-icon">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
                    </svg>
                    <span>Mod</span>
                </Link>
            )}
        </nav>
    );
}
