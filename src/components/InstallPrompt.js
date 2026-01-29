'use client';
import { useState, useEffect } from 'react';
import { X, Share, PlusSquare } from 'lucide-react';
import { useAppContext } from '../lib/store'; // Import context to check login

export default function InstallPrompt() {
    const { user } = useAppContext(); // Get user state
    const [showPrompt, setShowPrompt] = useState(false);
    const [platform, setPlatform] = useState(null); // 'ios' | 'android'
    const [deferredPrompt, setDeferredPrompt] = useState(null);

    useEffect(() => {
        // Only run logic if user is logged in
        if (!user) return;

        // 1. Check if already installed (Standalone mode)
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
        if (isStandalone) return;

        // 2. Check dismissal cooldown (3 days)
        const lastDismissed = localStorage.getItem('installPromptDismissed');
        if (lastDismissed) {
            const daysSince = (Date.now() - parseInt(lastDismissed)) / (1000 * 60 * 60 * 24);
            if (daysSince < 3) return;
        }

        // 3. Detect Platform
        const ua = navigator.userAgent.toLowerCase();
        const isIOS = /iphone|ipad|ipod/.test(ua);
        const isAndroid = /android/.test(ua);

        if (isIOS) {
            setPlatform('ios');
            setShowPrompt(true);
        } else if (isAndroid) {
            // Check if we already have a deferred prompt from earlier
            // Note: deferredPrompt might be captured *before* login if we listen globally, 
            // but for simplicity, we listen here. If the event fired before this component mounted/login,
            // we might miss it unless we capture it globally. 
            // However, browsers usually fire it on page load. 
            // Since this component is ALWAYS in Layout, it just wasn't showing.
            // We need to move the event listener OUTSIDE the user check or persist it.

            // Actually, let's keep the listener active but only SHOW if logged in.
        }
    }, [user]); // Re-run when user logs in

    // Capture event globally (independent of login status) so we don't miss it
    useEffect(() => {
        const handleBeforeInstallPrompt = (e) => {
            e.preventDefault();
            setDeferredPrompt(e);

            // If user is ALREADY logged in when this fires (rare, usually fires on load), trigger logic
            // But main logic is in the other effect.
        };
        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    }, []);

    // Sync deferredPrompt with showPrompt when user logs in
    useEffect(() => {
        if (user && deferredPrompt) {
            // Check dismissal again here to be safe
            const lastDismissed = localStorage.getItem('installPromptDismissed');
            let onCooldown = false;
            if (lastDismissed) {
                const daysSince = (Date.now() - parseInt(lastDismissed)) / (1000 * 60 * 60 * 24);
                if (daysSince < 3) onCooldown = true;
            }

            if (!onCooldown) {
                setPlatform('android');
                setShowPrompt(true);
            }
        }
    }, [user, deferredPrompt]);


    const handleDismiss = () => {
        localStorage.setItem('installPromptDismissed', Date.now().toString());
        setShowPrompt(false);
    };

    const handleInstallClick = async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            setShowPrompt(false);
        }
        setDeferredPrompt(null);
    };

    if (!showPrompt) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-300">
            <div className="bg-[#1a1b1e] w-full max-w-sm rounded-2xl border border-gray-800 shadow-2xl overflow-hidden relative animate-in zoom-in-95 duration-300">
                <button
                    onClick={handleDismiss}
                    className="absolute top-2 right-2 p-2 text-gray-400 hover:text-white transition-colors z-10"
                    aria-label="Dismiss"
                >
                    <X size={20} />
                </button>

                <div className="p-6 flex flex-col items-center text-center">
                    <div className="w-20 h-20 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl flex items-center justify-center text-white font-bold text-4xl shadow-lg mb-4">
                        B
                    </div>

                    <h3 className="text-xl font-bold text-white mb-2">Get the App Experience</h3>
                    <p className="text-gray-400 text-sm mb-6 leading-relaxed">
                        Install Bet It Happens to your home screen for full-screen betting, faster access, and a smoother experience—just like a native app.
                    </p>

                    {platform === 'ios' && (
                        <div className="w-full bg-gray-800/50 p-4 rounded-xl border border-gray-700/50 space-y-3 text-left">
                            <div className="flex items-center gap-3 text-sm text-gray-200">
                                <span className="flex-shrink-0 w-6 h-6 bg-gray-700 rounded-full flex items-center justify-center text-xs font-bold">1</span>
                                <span className="flex items-center gap-1.5 flex-wrap">
                                    Tap <Share size={16} className="text-blue-400" /> <span className="font-semibold">Share</span>
                                </span>
                            </div>
                            <div className="flex items-center gap-3 text-sm text-gray-200">
                                <span className="flex-shrink-0 w-6 h-6 bg-gray-700 rounded-full flex items-center justify-center text-xs font-bold">2</span>
                                <span className="flex items-center gap-1.5 flex-wrap">
                                    Select <PlusSquare size={16} className="text-gray-300" /> <span className="font-semibold">Add to Home Screen</span>
                                </span>
                            </div>
                        </div>
                    )}

                    {platform === 'android' && (
                        <button
                            onClick={handleInstallClick}
                            className="w-full py-3 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-bold rounded-xl transition-colors shadow-lg shadow-blue-900/20"
                        >
                            Add to Home Screen
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
