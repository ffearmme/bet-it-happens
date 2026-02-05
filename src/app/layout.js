import { Inter } from 'next/font/google';
import Script from 'next/script';
import './globals.css';
import Navbar from '../components/Navbar';
import TopHeader from '../components/TopHeader';
import InstallPrompt from '../components/InstallPrompt';
import { AppProvider } from '../lib/store';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
    title: 'Bet It Happens',
    description: 'The risk is fake. The thrill is real. Join the ultimate social betting platform for sports, pop culture, and more.',
    openGraph: {
        title: 'Bet It Happens',
        description: 'The risk is fake. The thrill is real. Join the ultimate social betting platform for sports, pop culture, and more.',
        url: 'https://betithappens.com',
        siteName: 'Bet It Happens',
        images: [
            {
                url: '/logo.png',
                width: 1200,
                height: 630,
            },
        ],
        type: 'website',
    },
    icons: {
        icon: '/text_logo.svg',
        apple: [
            { url: '/text_logo.svg' },
        ],
    },
    manifest: '/manifest.json',
};

export const viewport = {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
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
