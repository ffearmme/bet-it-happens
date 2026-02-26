"use client";
import { usePathname } from 'next/navigation';
import Navbar from './Navbar';
import TopHeader from './TopHeader';
import InstallPrompt from './InstallPrompt';
import JackpotAnnouncer from './JackpotAnnouncer';
import ChallengeModal from './ChallengeModal';

function BetaBanner() {
    return (
        <div className="beta-banner">
            <span className="beta-tag">BETA</span>
            <span className="beta-message">
                This app is in beta. Play money only - no real gambling.
            </span>
        </div>
    );
}

export default function GlobalUIWrapper({ children }) {
    const pathname = usePathname();
    const isInviteRoute = pathname && pathname.startsWith('/invite');

    if (isInviteRoute) {
        return <>{children}</>;
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
