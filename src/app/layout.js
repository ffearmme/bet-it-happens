import { Inter } from 'next/font/google';
import './globals.css';
import Navbar from '../components/Navbar';
import { AppProvider } from '../lib/store';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
    title: 'Bet It Happens',
    description: 'Fake Money Betting App',
    viewport: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0',
};

export default function RootLayout({ children }) {
    return (
        <html lang="en">
            <body className={inter.className}>
                <AppProvider>
                    {children}
                    <Navbar />
                </AppProvider>
            </body>
        </html>
    );
}
