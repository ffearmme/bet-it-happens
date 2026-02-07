import { Inter } from 'next/font/google';
import Script from 'next/script';
import './globals.css';
import Navbar from '../components/Navbar';
import TopHeader from '../components/TopHeader';
import InstallPrompt from '../components/InstallPrompt';
import { AppProvider } from '../lib/store';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
    metadataBase: new URL('https://betithappens.com'),
    title: {
        default: 'Bet It Happens | The Social Betting Platform',
        template: '%s | Bet It Happens',
    },
    description: 'Join the ultimate social prediction market. Bet on sports, pop culture, and viral events with play money. Compete on leaderboards, earn badges, and prove you knew it all along.',
    keywords: ['betting', 'prediction market', 'social betting', 'sports betting', 'pop culture', 'play money', 'leaderboard', 'risk free'],
    authors: [{ name: 'Bet It Happens Team' }],
    creator: 'Bet It Happens',
    publisher: 'Bet It Happens',
    openGraph: {
        title: 'Bet It Happens | The Social Betting Platform',
        description: 'The risk is fake. The thrill is real. Join thousands of players predicting the future of sports, tech, and culture without losing a dime.',
        url: 'https://betithappens.com',
        siteName: 'Bet It Happens',
        images: [
            {
                url: '/logo.png', // Ensure this image is high quality
                width: 1200,
                height: 630,
                alt: 'Bet It Happens Preview',
            },
        ],
        locale: 'en_US',
        type: 'website',
    },
    twitter: {
        card: 'summary_large_image',
        title: 'Bet It Happens',
        description: 'The risk is fake. The thrill is real. Join the ultimate social betting platform.',
        images: ['/logo.png'], // Better to have a specific twitter card image if possible
    },
    icons: {
        icon: '/text_logo.svg',
        apple: [
            { url: '/text_logo.svg' },
        ],
    },
    manifest: '/manifest.json',
    verification: {
        google: 'google-site-verification-code', // Placeholder, user should replace
    },
};

export const viewport = {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
    themeColor: '#000000',
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
                <Script
                    src="https://www.googletagmanager.com/gtag/js?id=G-ZXH1JV20DC"
                    strategy="afterInteractive"
                />
                <Script id="google-analytics" strategy="afterInteractive">
                    {`
                        window.dataLayer = window.dataLayer || [];
                        function gtag(){dataLayer.push(arguments);}
                        gtag('js', new Date());

                        gtag('config', 'G-ZXH1JV20DC');
                    `}
                </Script>
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
