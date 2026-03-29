"use client";
import { usePathname } from 'next/navigation';
import Navbar from './Navbar';
import TopHeader from './TopHeader';
import InstallPrompt from './InstallPrompt';
import JackpotAnnouncer from './JackpotAnnouncer';
import ChallengeModal from './ChallengeModal';
import { useApp } from '../lib/store';
import LeaderboardGrid from './LeaderboardGrid';

function BetaBanner() {
    return (
        <div className="beta-banner" style={{ zIndex: 10001 }}>
            <span className="beta-tag">BETA</span>
            <span className="beta-message">
                This app is in beta. Play money only - no real gambling.
            </span>
        </div>
    );
}

function RemodelScreen() {
    return (
        <div style={{
            minHeight: '100vh',
            background: 'linear-gradient(135deg, #09090b 0%, #18181b 100%)',
            color: '#fff',
            padding: '40px 20px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            zIndex: 10000,
            position: 'relative'
        }}>
            <div style={{ textAlign: 'center', marginBottom: '48px', maxWidth: '600px' }}>
                <div style={{ fontSize: '64px', marginBottom: '24px', animation: 'bounce 2s infinite' }}>🏗️</div>
                <h1 style={{
                    fontSize: '32px',
                    fontWeight: '800',
                    marginBottom: '16px',
                    background: 'linear-gradient(90deg, #fff, #a1a1aa)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent'
                }}>Closed for Remodel</h1>
                <p style={{ fontSize: '18px', color: '#a1a1aa', lineHeight: '1.6' }}>
                    We're upgrading the arena for the next big season. While we work, check out the Final Standings below!
                </p>
            </div>

            <div style={{
                width: '100%',
                maxWidth: '800px',
                background: 'rgba(24, 24, 27, 0.6)',
                borderRadius: '24px',
                padding: '32px',
                border: '1px solid #27272a',
                backdropFilter: 'blur(12px)',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
            }}>
                <h2 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '24px', textAlign: 'center', color: 'var(--primary)' }}>🏆 Final Leaderboard</h2>
                <LeaderboardGrid limit={50} showWeekly={false} />
            </div>

            <p style={{ marginTop: '48px', color: '#52525b', fontSize: '14px' }}>
                Stay tuned. Something big is coming.
            </p>
        </div>
    );
}

export default function GlobalUIWrapper({ children }) {
    const pathname = usePathname();
    const { user, maintenanceSettings } = useApp();
    
    const isInviteRoute = pathname && pathname.startsWith('/invite');
    const isAdmin = user?.role === 'admin';
    const isRemodelActive = maintenanceSettings?.remodel === true;

    if (isInviteRoute) {
        return <>{children}</>;
    }

    // Site-wide Remodel Lock
    if (isRemodelActive && !isAdmin) {
        return (
            <>
                <BetaBanner />
                <RemodelScreen />
            </>
        );
    }

    return (
        <>
            <BetaBanner />
            <TopHeader />
            <JackpotAnnouncer />
            <ChallengeModal />
            {children}
            <Navbar />
            <InstallPrompt />
        </>
    );
}
