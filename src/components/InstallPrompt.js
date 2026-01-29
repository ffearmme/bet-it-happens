'use client';
import { useState, useEffect } from 'react';
import { X, Share, PlusSquare } from 'lucide-react';
import { useAppContext } from '../lib/store';

export default function InstallPrompt() {
    const { user } = useAppContext();
    const [showPrompt, setShowPrompt] = useState(false);
    const [platform, setPlatform] = useState(null); // 'ios' | 'android'
    const [deferredPrompt, setDeferredPrompt] = useState(null);

    useEffect(() => {
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
            // Android detection logic remains the same (waiting for event or forcing if already captured)
            // If we already have the event from the global listener, show it.
        }
    }, [user]);

    // Capture event globally
    useEffect(() => {
        const handleBeforeInstallPrompt = (e) => {
            e.preventDefault();
            setDeferredPrompt(e);
        };
        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    }, []);

    // Sync deferredPrompt with showPrompt
    useEffect(() => {
        if (user && deferredPrompt) {
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

    // Inline Styles Replacements for Tailwind classes
    const styles = {
        overlay: {
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(4px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            animation: 'fadeIn 0.3s ease-out'
        },
        card: {
            backgroundColor: '#1a1b1e',
            width: '100%',
            maxWidth: '380px',
            borderRadius: '16px',
            border: '1px solid #27272a',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
            position: 'relative',
            overflow: 'hidden',
            animation: 'zoomIn 0.3s ease-out'
        },
        closeBtn: {
            position: 'absolute',
            top: '12px',
            right: '12px',
            background: 'transparent',
            border: 'none',
            color: '#9ca3af',
            cursor: 'pointer',
            padding: '4px',
            zIndex: 10
        },
        content: {
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center'
        },
        iconBox: {
            width: '80px',
            height: '80px',
            background: 'linear-gradient(135deg, #2563eb, #4338ca)',
            borderRadius: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontWeight: 'bold',
            fontSize: '32px',
            marginBottom: '16px',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)'
        },
        title: {
            fontSize: '20px',
            fontWeight: 'bold',
            color: 'white',
            marginBottom: '8px'
        },
        description: {
            color: '#9ca3af',
            fontSize: '14px',
            marginBottom: '24px',
            lineHeight: '1.5'
        },
        iosSteps: {
            width: '100%',
            backgroundColor: 'rgba(31, 41, 55, 0.5)',
            padding: '16px',
            borderRadius: '12px',
            border: '1px solid rgba(55, 65, 81, 0.5)',
            textAlign: 'left',
            marginBottom: '8px'
        },
        stepRow: {
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            fontSize: '14px',
            color: '#e5e7eb',
            marginBottom: '12px'
        },
        stepNum: {
            width: '24px',
            height: '24px',
            backgroundColor: '#374151',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '12px',
            fontWeight: 'bold',
            flexShrink: 0
        },
        actionBtn: {
            width: '100%',
            padding: '14px',
            backgroundColor: '#2563eb',
            color: 'white',
            fontWeight: 'bold',
            borderRadius: '12px',
            border: 'none',
            cursor: 'pointer',
            fontSize: '16px',
            boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.2)',
            transition: 'background 0.2s'
        }
    };

    return (
        <div style={styles.overlay}>
            <style>{`
                @keyframes zoomIn { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
            `}</style>
            <div style={styles.card}>
                <button
                    onClick={handleDismiss}
                    style={styles.closeBtn}
                    aria-label="Dismiss"
                >
                    <X size={20} />
                </button>

                <div style={styles.content}>
                    <div style={styles.iconBox}>
                        B
                    </div>

                    <h3 style={styles.title}>Get the App Experience</h3>
                    <p style={styles.description}>
                        Install Bet It Happens to your home screen for full-screen betting, faster access, and a smoother experience—just like a native app.
                    </p>

                    {platform === 'ios' && (
                        <div style={styles.iosSteps}>
                            <div style={styles.stepRow}>
                                <span style={styles.stepNum}>1</span>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                    Tap <Share size={16} color="#60a5fa" /> <span style={{ fontWeight: 600 }}>Share</span>
                                </span>
                            </div>
                            <div style={{ ...styles.stepRow, marginBottom: 0 }}>
                                <span style={styles.stepNum}>2</span>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                    Select <PlusSquare size={16} color="#d1d5db" /> <span style={{ fontWeight: 600 }}>Add to Home Screen</span>
                                </span>
                            </div>
                        </div>
                    )}

                    {platform === 'android' && (
                        <button
                            onClick={handleInstallClick}
                            style={styles.actionBtn}
                            onMouseOver={e => e.target.style.backgroundColor = '#1d4ed8'}
                            onMouseOut={e => e.target.style.backgroundColor = '#2563eb'}
                        >
                            Add to Home Screen
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
