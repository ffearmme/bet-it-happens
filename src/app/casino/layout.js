"use client";
import Link from 'next/link';
import { Lock } from 'lucide-react';
import { useApp } from '../../lib/store';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function CasinoLayout({ children }) {
    const { user, isLoaded, casinoSettings } = useApp();
    const router = useRouter();
    const pathname = usePathname();
    const [accessDenied, setAccessDenied] = useState(false);
    const [maintenanceMode, setMaintenanceMode] = useState(false);

    useEffect(() => {
        if (!isLoaded) return;

        if (!user) {
            router.push('/');
            return;
        }

        if (!user.profilePic) {
            setAccessDenied(true);
        } else {
            setAccessDenied(false);
        }

        // Check for Disabled Games
        if (pathname.includes('/casino/slots') && casinoSettings?.slots === false) {
            setMaintenanceMode(true);
        } else if (pathname.includes('/casino/crash') && casinoSettings?.crash === false) {
            setMaintenanceMode(true);
        } else if (pathname.includes('/casino/blackjack') && casinoSettings?.blackjack === false) {
            setMaintenanceMode(true);
        } else {
            setMaintenanceMode(false);
        }

    }, [user, isLoaded, router, pathname, casinoSettings]);

    if (!isLoaded) return (
        <div style={{
            minHeight: '100vh',
            background: '#0f172a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#94a3b8'
        }}>
            Loading...
        </div>
    );

    if (maintenanceMode) {
        return (
            <div className="animate-fade" style={{
                minHeight: '100vh',
                background: '#0f172a',
                padding: '20px',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center'
            }}>
                <div style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    backdropFilter: 'blur(10px)',
                    padding: '40px',
                    borderRadius: '24px',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    maxWidth: '500px',
                    width: '100%',
                    boxShadow: '0 20px 50px rgba(0,0,0,0.5)'
                }}>
                    <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '16px', color: '#f59e0b' }}>
                        🚧 Game Maintenance
                    </h1>
                    <p style={{ color: '#cbd5e1', marginBottom: '32px', lineHeight: '1.6' }}>
                        This game is currently disabled for maintenance or updates. Please check back later!
                    </p>
                    <Link href="/casino" style={{
                        display: 'inline-block',
                        background: '#333',
                        color: '#fff',
                        fontWeight: 'bold',
                        padding: '12px 24px',
                        borderRadius: '8px',
                        textDecoration: 'none'
                    }}>
                        Back to Casino
                    </Link>
                </div>
            </div>
        );
    }

    if (accessDenied) {
        return (
            <div className="animate-fade" style={{
                minHeight: '100vh',
                background: 'radial-gradient(circle at top center, #2e1065 0%, #000000 60%)',
                padding: '20px',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center'
            }}>
                <div style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    backdropFilter: 'blur(10px)',
                    padding: '40px',
                    borderRadius: '24px',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    maxWidth: '500px',
                    width: '100%',
                    boxShadow: '0 20px 50px rgba(0,0,0,0.5)'
                }}>
                    <div style={{
                        background: 'rgba(239, 68, 68, 0.2)',
                        padding: '20px',
                        borderRadius: '50%',
                        width: '80px',
                        height: '80px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 24px auto',
                        border: '2px solid rgba(239, 68, 68, 0.5)',
                        boxShadow: '0 0 20px rgba(239, 68, 68, 0.3)'
                    }}>
                        <Lock size={40} className="text-red-500" />
                    </div>

                    <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '16px' }}>
                        Casino Access Restricted
                    </h1>

                    <p style={{ color: '#cbd5e1', marginBottom: '32px', lineHeight: '1.6' }}>
                        To ensure a safe and verified community, all players must have a profile picture set before entering the casino.
                    </p>

                    <Link href="/profile" style={{
                        display: 'inline-block',
                        background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                        color: '#fff',
                        fontWeight: 'bold',
                        padding: '14px 32px',
                        borderRadius: '12px',
                        textDecoration: 'none',
                        transition: 'all 0.2s',
                        width: '100%',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
                    }}
                        onMouseEnter={e => {
                            e.currentTarget.style.transform = 'translateY(-2px)';
                            e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(245, 158, 11, 0.4)';
                        }}
                        onMouseLeave={e => {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)';
                        }}
                    >
                        Update Profile Picture
                    </Link>

                    <div style={{ marginTop: '20px' }}>
                        <Link href="/" style={{ color: '#94a3b8', fontSize: '14px', textDecoration: 'none' }}>
                            Return Home
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <>
            {children}
        </>
    );
}
