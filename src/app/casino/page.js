"use client";
import Link from 'next/link';
import { TrendingUp, Gem, Club, ArrowRight, X, Info, Disc } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';

export default function CasinoPage() {
    const [tourStep, setTourStep] = useState(-1); // -1: inactive, 0: welcome, 1+: steps
    const [spotlightStyle, setSpotlightStyle] = useState({ top: 0, left: 0, width: 0, height: 0, opacity: 0 });

    useEffect(() => {
        // Check if user is new strictly to Casino
        const visited = localStorage.getItem('casino_visited_v1');
        if (!visited) {
            // Small delay to let animations settle
            setTimeout(() => setTourStep(0), 500);
        }
    }, []);

    const endTour = () => {
        setTourStep(-1);
        localStorage.setItem('casino_visited_v1', 'true');
    };

    const nextStep = () => {
        setTourStep(prev => prev + 1);
    };

    // Calculate spotlight position based on step
    useEffect(() => {
        if (tourStep <= 0) {
            setSpotlightStyle(prev => ({ ...prev, opacity: 0 }));
            return;
        }

        const targets = {
            1: 'casino-header',
            2: 'game-crash',
            3: 'game-slots'
        };

        const targetId = targets[tourStep];
        if (!targetId && tourStep > 3) {
            endTour();
            return;
        }

        const el = document.getElementById(targetId);
        if (el) {
            const rect = el.getBoundingClientRect();
            // Account for scroll
            const scrollTop = window.scrollY || document.documentElement.scrollTop;
            const scrollLeft = window.scrollX || document.documentElement.scrollLeft;

            // Check if there is space below
            // If distance from bottom of element to bottom of viewport is less than ~250px, place on top
            const spaceBelow = window.innerHeight - rect.bottom;
            const placeTop = spaceBelow < 250;

            setSpotlightStyle({
                top: rect.top + scrollTop - 10,
                left: rect.left + scrollLeft - 10,
                width: rect.width + 20,
                height: rect.height + 20,
                opacity: 1,
                borderRadius: '16px',
                placement: placeTop ? 'top' : 'bottom'
            });

            // Scroll to element if needed
            el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
        }
    }, [tourStep]);

    // Lock scroll and hide navbar when tour is active
    useEffect(() => {
        const navbar = document.querySelector('.bottom-nav');
        if (tourStep >= 0) {
            document.body.style.overflow = 'hidden';
            if (navbar) navbar.style.display = 'none';
        } else {
            document.body.style.overflow = '';
            if (navbar) navbar.style.display = '';
        }

        return () => {
            document.body.style.overflow = '';
            if (navbar) navbar.style.display = '';
        };
    }, [tourStep]);

    const games = [
        {
            id: 'crash',
            name: 'Crash',
            description: 'Predict the peak. Cash out before it crashes.',
            icon: <TrendingUp size={48} className="text-red-500" />,
            color: 'var(--accent-loss)', // Red-ish for Crash typically
            link: '/casino/crash'
        },
        {
            id: 'slots',
            name: 'Slots',
            description: 'Spin the reels to win big prizes.',
            icon: <Gem size={48} className="text-yellow-500" />,
            color: '#eab308', // Gold for Slots
            link: '/casino/slots'
        },
        {
            id: 'blackjack',
            name: 'Blackjack',
            description: 'Beat the dealer to 21.',
            icon: <Club size={48} className="text-green-500" />,
            color: '#10b981', // Green for Blackjack
            link: '/casino/blackjack'
        },
        {
            id: 'roulette',
            name: 'Roulette',
            description: 'Spin the wheel and test your luck.',
            icon: <Disc size={48} className="text-purple-500" />,
            color: '#a855f7', // Purple for Roulette
            link: '/casino/roulette'
        }
    ];

    return (
        <div className="animate-fade" style={{
            minHeight: '100vh',
            background: 'radial-gradient(circle at top center, #2e1065 0%, #000000 60%)',
            padding: '20px 20px 120px 20px',
            color: '#fff',
            position: 'relative' // For absolute positioning context ?? No, backdrop is fixed.
        }}>

            {/* --- TOUR OVERLAY --- */}
            {tourStep >= 0 && (
                <div style={{
                    position: 'fixed',
                    top: 0, left: 0, right: 0, bottom: 0,
                    zIndex: 9999,
                    pointerEvents: 'auto', // Block all clicks to underlying elements
                }}>
                    {/* Dark Backdrop with Hole via Mask or just Boxes? 
                        Using a simpler approach: SVG Overlay masking. 
                        Or just a heavy shadow on the spotlight div.
                    */}
                    <div style={{
                        position: 'absolute', inset: 0,
                        background: 'rgba(0,0,0,0.7)',
                        backdropFilter: 'blur(3px)',
                        transition: 'all 0.5s ease',
                        // If we have a spotlight, we clip it? Complex.
                        // Let's use the 'huge box shadow' trick on the spotlight element instead if active.
                        opacity: tourStep === 0 ? 1 : 0.5
                    }}></div>

                    {/* Welcome Modal (Step 0) */}
                    {tourStep === 0 && (
                        <div className="animate-fade-in-up" style={{
                            position: 'absolute',
                            top: '50%', left: '50%',
                            transform: 'translate(-50%, -50%)',
                            background: 'rgba(20, 20, 30, 0.95)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '24px',
                            padding: '32px',
                            maxWidth: '400px',
                            width: '90%',
                            boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
                            textAlign: 'center',
                            zIndex: 10001
                        }}>
                            <div style={{
                                width: '64px', height: '64px', margin: '0 auto 16px',
                                background: 'linear-gradient(135deg, #f59e0b, #ec4899)',
                                borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                boxShadow: '0 0 20px rgba(236, 72, 153, 0.4)'
                            }}>
                                <Gem size={32} color="white" />
                            </div>
                            <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '8px', color: '#fff' }}>
                                Welcome to the Casino
                            </h2>
                            <p style={{ color: '#94a3b8', lineHeight: '1.6', marginBottom: '24px' }}>
                                Access high-stakes games, provably fair mechanics, and instant payouts.
                                <br />Ready to win big?
                            </p>
                            <div style={{ display: 'flex', gap: '12px', flexDirection: 'column' }}>
                                <button
                                    onClick={nextStep}
                                    style={{
                                        background: 'linear-gradient(90deg, #f59e0b, #ec4899)',
                                        color: '#fff', fontWeight: 'bold',
                                        padding: '12px', borderRadius: '12px', border: 'none',
                                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                                    }}
                                >
                                    Show Me Around <ArrowRight size={18} />
                                </button>
                                <button
                                    onClick={endTour}
                                    style={{
                                        background: 'transparent',
                                        color: '#64748b', fontWeight: '600',
                                        padding: '12px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)',
                                        cursor: 'pointer'
                                    }}
                                >
                                    Maybe Later
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Spotlight (Step > 0) */}
                    {tourStep > 0 && (
                        <>
                            {/* The Spotlight Hole */}
                            <div style={{
                                position: 'absolute',
                                ...spotlightStyle,
                                borderRadius: '12px',
                                boxShadow: '0 0 0 9999px rgba(0,0,0,0.85), 0 0 20px rgba(255,255,255,0.2)', // The hole trick
                                zIndex: 10000,
                                transition: 'all 0.5s cubic-bezier(0.25, 1, 0.5, 1)',
                                pointerEvents: 'none' // Let clicks pass through to the element? Actually maybe not during tour.
                            }}></div>

                            {/* The Tooltip/Explanation */}
                            <div style={{
                                position: 'absolute',
                                top: spotlightStyle.placement === 'top'
                                    ? spotlightStyle.top - 20
                                    : spotlightStyle.top + spotlightStyle.height + 20,
                                left: spotlightStyle.left + (spotlightStyle.width / 2),
                                transform: spotlightStyle.placement === 'top'
                                    ? 'translateX(-50%) translateY(-100%)'
                                    : 'translateX(-50%)',
                                width: '300px',
                                maxWidth: '90vw',
                                background: '#1e293b',
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: '16px',
                                padding: '20px',
                                zIndex: 10002,
                                color: '#fff',
                                boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                                transition: 'all 0.3s ease',
                                opacity: spotlightStyle.opacity,
                                pointerEvents: 'auto' // Fix: Capture clicks so they don't fall through to elements like Crash card
                            }}>
                                {/* Triangle arrow */}
                                <div style={{
                                    position: 'absolute',
                                    top: spotlightStyle.placement === 'top' ? 'auto' : '-6px',
                                    bottom: spotlightStyle.placement === 'top' ? '-6px' : 'auto',
                                    left: '50%', transform: 'translateX(-50%) rotate(45deg)',
                                    width: '12px', height: '12px',
                                    background: '#1e293b',
                                    borderLeft: spotlightStyle.placement === 'top' ? 'none' : '1px solid rgba(255,255,255,0.1)',
                                    borderTop: spotlightStyle.placement === 'top' ? 'none' : '1px solid rgba(255,255,255,0.1)',
                                    borderRight: spotlightStyle.placement === 'top' ? '1px solid rgba(255,255,255,0.1)' : 'none',
                                    borderBottom: spotlightStyle.placement === 'top' ? '1px solid rgba(255,255,255,0.1)' : 'none'
                                }}></div>

                                <h3 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
                                    {tourStep === 1 && "The Casino Hub"}
                                    {tourStep === 2 && "Crash"}
                                    {tourStep === 3 && "Slots"}
                                    <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 'normal' }}>{tourStep}/3</span>
                                </h3>
                                <p style={{ fontSize: '14px', color: '#cbd5e1', marginBottom: '16px', lineHeight: '1.5' }}>
                                    {tourStep === 1 && "Here you can see the latest games and provably fair status."}
                                    {tourStep === 2 && "Our most popular game. Watch the multiplier rise and cash out before it's too late!"}
                                    {tourStep === 3 && "Classic slots with huge multipliers. Spin to win big."}
                                </p>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <button onClick={endTour} style={{ color: '#94a3b8', background: 'none', border: 'none', fontSize: '12px', cursor: 'pointer' }}>Skip</button>
                                    <button onClick={nextStep} style={{
                                        background: 'var(--primary)', color: '#000', padding: '6px 16px', borderRadius: '20px',
                                        border: 'none', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer'
                                    }}>
                                        {tourStep === 3 ? "Finish" : "Next"}
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            )}


            {/* Ambient Background Glows */}
            <div style={{ position: 'fixed', top: '10%', left: '0', width: '300px', height: '300px', background: '#f59e0b', filter: 'blur(150px)', opacity: 0.1, pointerEvents: 'none' }}></div>
            <div style={{ position: 'fixed', bottom: '10%', right: '0', width: '400px', height: '400px', background: '#ec4899', filter: 'blur(150px)', opacity: 0.1, pointerEvents: 'none' }}></div>

            <header id="casino-header" style={{ marginBottom: '40px', textAlign: 'center', position: 'relative', zIndex: 1, padding: '10px', borderRadius: '12px' }}>
                <h1 style={{
                    fontSize: '64px',
                    fontWeight: '900',
                    marginBottom: '8px',
                    fontStyle: 'italic',
                    letterSpacing: '-2px',
                    background: 'linear-gradient(to bottom, #fff, #94a3b8)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    textShadow: '0 10px 30px rgba(0,0,0,0.5)'
                }}>
                    CASINO
                </h1>
                <div style={{
                    width: '60px',
                    height: '4px',
                    background: 'linear-gradient(90deg, #f59e0b, #ec4899)',
                    margin: '0 auto 16px auto',
                    borderRadius: '2px'
                }}></div>
                <p style={{ color: '#cbd5e1', fontSize: '16px', fontWeight: '400', letterSpacing: '1px', textTransform: 'uppercase' }}>
                    Provably Fair • Instant Payouts
                </p>
            </header>

            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: '20px',
                maxWidth: '1200px',
                margin: '0 auto',
                position: 'relative',
                zIndex: 1
            }}>
                {games.map(game => (
                    <Link href={game.link} key={game.id} id={`game-${game.id}`} style={{ textDecoration: 'none' }}>
                        <div className="game-card" style={{
                            position: 'relative',
                            background: 'rgba(255, 255, 255, 0.03)',
                            backdropFilter: 'blur(10px)',
                            borderRadius: '24px',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            padding: '24px',
                            overflow: 'hidden',
                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                            height: '100%',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            textAlign: 'center',
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
                        }}
                            onMouseEnter={e => {
                                e.currentTarget.style.transform = 'translateY(-5px) scale(1.02)';
                                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.07)';
                                e.currentTarget.style.borderColor = game.color;
                                e.currentTarget.style.boxShadow = `0 20px 40px -5px rgba(0,0,0,0.3), 0 0 20px -5px ${game.color}40`; // Add glow of game color
                            }}
                            onMouseLeave={e => {
                                e.currentTarget.style.transform = 'translateY(0) scale(1)';
                                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                                e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)';
                            }}
                        >
                            {/* Card Background Gradient Blob */}
                            <div style={{
                                position: 'absolute',
                                top: '-50%',
                                left: '50%',
                                transform: 'translateX(-50%)',
                                width: '150%',
                                height: '100%',
                                background: `radial-gradient(circle, ${game.color}20 0%, transparent 70%)`,
                                pointerEvents: 'none',
                                transition: 'opacity 0.3s'
                            }}></div>

                            <div style={{
                                position: 'relative',
                                marginBottom: '20px',
                                padding: '20px',
                                background: 'rgba(0,0,0,0.3)',
                                borderRadius: '20px',
                                border: '1px solid rgba(255,255,255,0.05)',
                                color: game.color,
                                boxShadow: 'inset 0 0 20px rgba(0,0,0,0.5)'
                            }}>
                                {game.icon}
                            </div>

                            <h2 style={{
                                fontSize: '24px',
                                fontWeight: 'bold',
                                color: '#fff',
                                marginBottom: '8px',
                                textShadow: '0 2px 5px rgba(0,0,0,0.5)'
                            }}>
                                {game.name}
                            </h2>
                            <p style={{
                                fontSize: '14px',
                                color: '#94a3b8',
                                lineHeight: '1.5',
                                maxWidth: '90%'
                            }}>
                                {game.description}
                            </p>

                            <div style={{
                                marginTop: '20px',
                                padding: '8px 16px',
                                background: 'rgba(255,255,255,0.1)',
                                borderRadius: '50px',
                                fontSize: '12px',
                                fontWeight: 'bold',
                                color: '#fff',
                                textTransform: 'uppercase',
                                letterSpacing: '1px'
                            }}>
                                Play Now
                            </div>
                        </div>
                    </Link>
                ))}
            </div>
        </div>
    );
}
