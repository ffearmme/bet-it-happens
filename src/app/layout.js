import { Inter } from 'next/font/google';
import './globals.css';
import Navbar from '../components/Navbar';
import TopHeader from '../components/TopHeader';
import InstallPrompt from '../components/InstallPrompt';
import { AppProvider } from '../lib/store';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
    title: 'Bet It Happens',
    description: 'Fake Money Betting App',
    viewport: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0',
    icons: {
        icon: '/logo.png',
    },
    manifest: '/manifest.json',
};

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

export default function RootLayout({ children }) {
    return (
        <html lang="en">
            <body className={inter.className}>
                <AppProvider>
                    <BetaBanner />
                    <TopHeader />
                    {children}
                    <Navbar />
                    <InstallPrompt />
                </AppProvider>
            </body>
        </html>
    );
}
