"use client";
import { useEffect, useRef, useState } from 'react';
import { PHYSICS_CONFIG } from './physics';

const COLORS = [
    '#f59e0b', // Amber
    '#ec4899', // Pink
    '#8b5cf6', // Violet
    '#10b981', // Emerald
    '#3b82f6', // Blue
    '#ef4444'  // Red
];

// Helper to get color for index
const getPlayerColor = (index) => COLORS[index % COLORS.length];

export default function KnockoutBoard({
    players = {},
    myId,
    gameState,
    activeMoves = {},
    onCommitMove,
    isSpectator,
    playbackFrames = null, // If provided, we play this animation
    platformRadius = PHYSICS_CONFIG.PLATFORM_INITIAL_RADIUS,
    onAnimationComplete
}) {
    const canvasRef = useRef(null);
    const containerRef = useRef(null);

    // Input State
    const [aimAngle, setAimAngle] = useState(0); // Radians
    const [power, setPower] = useState(50); // 0-100
    const [isInputLocked, setIsInputLocked] = useState(false);

    // Playback State
    const [playbackIndex, setPlaybackIndex] = useState(0);
    const playbackIndexRef = useRef(0);
    // Derived "isAnimating" from prop presence
    const isAnimating = !!(playbackFrames && playbackFrames.length > 0);

    // Sync REF with STATE when animation starts/resets
    useEffect(() => {
        if (playbackFrames && playbackFrames.length > 0) {
            setPlaybackIndex(0);
            playbackIndexRef.current = 0;
        }
    }, [playbackFrames]);

    // Touch Interaction State
    const [isDragging, setIsDragging] = useState(false);

    // Initial Setup & Resize
    const [dimensions, setDimensions] = useState({ width: 800, height: 800 });

    useEffect(() => {
        const updateSize = () => {
            if (containerRef.current) {
                const { clientWidth } = containerRef.current;
                // Keep aspect ratio 1:1 or fit screen
                const size = Math.min(clientWidth, window.innerHeight * 0.6);
                setDimensions({ width: size, height: size });
            }
        };

        window.addEventListener('resize', updateSize);
        updateSize();
        return () => window.removeEventListener('resize', updateSize);
    }, []);

    // Animation Loop
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');

        let animationId;
        let lastTime = 0;
        let frameAccumulator = 0;
        const TARGET_FPS = 60;
        const FRAME_TIME = 1000 / TARGET_FPS;

        const render = (timestamp) => {
            if (!lastTime) lastTime = timestamp;
            const deltaTime = timestamp - lastTime;
            lastTime = timestamp;

            const { width, height } = dimensions;
            canvas.width = width;
            canvas.height = height;

            const centerX = width / 2;
            const centerY = height / 2;
            const scale = width / (PHYSICS_CONFIG.PLATFORM_INITIAL_RADIUS * 2.5); // Zoom to fit platform

            // Next Frame logic for Playback (Time-Based)
            let isComplete = false;

            if (isAnimating) {
                frameAccumulator += deltaTime;

                // While we have enough accumulated time for one or more frames, advance
                if (playbackFrames && playbackFrames.length > 0) {
                    while (frameAccumulator >= FRAME_TIME) {
                        if (playbackIndexRef.current < playbackFrames.length - 1) {
                            playbackIndexRef.current++;
                        } else {
                            // Reached end
                            isComplete = true;
                        }
                        frameAccumulator -= FRAME_TIME;
                    }
                }
            }

            // Background
            ctx.fillStyle = '#18181b';
            ctx.fillRect(0, 0, width, height);

            ctx.save();
            ctx.translate(centerX, centerY);
            ctx.scale(scale, scale);

            // 1. Draw Platform
            ctx.beginPath();
            ctx.arc(0, 0, platformRadius, 0, Math.PI * 2);
            ctx.fillStyle = '#27272a';
            ctx.fill();
            ctx.lineWidth = 10;
            ctx.strokeStyle = '#3f3f46';
            ctx.stroke();

            // Grid for depth perception
            ctx.beginPath();
            ctx.arc(0, 0, platformRadius * 0.7, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(255,255,255,0.05)';
            ctx.lineWidth = 2;
            ctx.stroke();

            // 2. Draw Players
            const playerIds = Object.keys(players).sort();

            // Determine source of positions: Playback (REF) or Live State
            let currentPositions = gameState;
            if (isAnimating && playbackFrames && playbackFrames[playbackIndexRef.current]) {
                currentPositions = playbackFrames[playbackIndexRef.current];
            }

            playerIds.forEach((uid, index) => {
                const pState = currentPositions[uid] || { isEliminated: false, x: 0, y: 0 }; // Default if missing

                // If eliminated, do not draw (vanish)
                if (pState.isEliminated) return;

                // If initializing (waiting room), place them in circle if no position
                let x = pState.x || 0;
                let y = pState.y || 0;

                // If it's pure waiting room (no positions yet), calculating spawn visual just for lobby
                if (!pState.x && !pState.y && !isAnimating) {
                    const angle = (index / playerIds.length) * Math.PI * 2;
                    x = Math.cos(angle) * platformRadius * 0.6;
                    y = Math.sin(angle) * platformRadius * 0.6;
                }

                // Draw Height/Shadow (Fake 3D)
                ctx.beginPath();
                ctx.arc(x, y + 5, PHYSICS_CONFIG.PLAYER_RADIUS, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(0,0,0,0.5)';
                ctx.fill();

                // Draw Body
                ctx.beginPath();
                ctx.arc(x, y, PHYSICS_CONFIG.PLAYER_RADIUS, 0, Math.PI * 2);
                ctx.fillStyle = getPlayerColor(index);
                ctx.fill();

                // Draw Border/Highlight
                ctx.lineWidth = 4;
                ctx.strokeStyle = 'rgba(255,255,255,0.3)';
                ctx.stroke();

                // Draw Username
                ctx.fillStyle = '#fff';
                ctx.font = 'bold 20px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                // ctx.fillText(players[uid]?.username?.substring(0, 2) || '?', x, y);

                // Highlight "Me"
                if (uid === myId) {
                    ctx.beginPath();
                    ctx.arc(x, y, PHYSICS_CONFIG.PLAYER_RADIUS + 10, 0, Math.PI * 2);
                    ctx.strokeStyle = '#fff';
                    ctx.lineWidth = 2;
                    ctx.stroke();

                    // 3. Draw Aim Vector (Only if my turn, active, not animating)
                    if (!isSpectator && !pState.isEliminated && !isAnimating && !activeMoves[myId]) {
                        const aimLen = 50 + (power / 100) * 100;
                        const aimX = x + Math.cos(aimAngle) * aimLen;
                        const aimY = y + Math.sin(aimAngle) * aimLen;

                        // Arrow Shaft
                        ctx.beginPath();
                        ctx.moveTo(x, y);
                        ctx.lineTo(aimX, aimY);
                        ctx.lineWidth = 8;
                        ctx.lineCap = 'round';
                        ctx.strokeStyle = `rgba(255, 255, 255, ${0.3 + (power / 200)})`;
                        ctx.stroke();

                        // Arrow Head
                        ctx.beginPath();
                        ctx.moveTo(aimX, aimY);
                        ctx.lineTo(
                            aimX - 20 * Math.cos(aimAngle - Math.PI / 6),
                            aimY - 20 * Math.sin(aimAngle - Math.PI / 6)
                        );
                        ctx.lineTo(
                            aimX - 20 * Math.cos(aimAngle + Math.PI / 6),
                            aimY - 20 * Math.sin(aimAngle + Math.PI / 6)
                        );
                        ctx.fillStyle = '#fff';
                        ctx.fill();
                    }
                }

                ctx.globalAlpha = 1;
            });

            ctx.restore();

            // Handle Completion
            if (isComplete) {
                // Trigger completion callback ONCE
                if (onAnimationComplete) {
                    // Use timeout to break render cycle and let React state update
                    setTimeout(() => {
                        onAnimationComplete();
                    }, 500); // Small pause at end
                    return; // Stop animation loop
                }
            }

            animationId = requestAnimationFrame(render);
        };

        animationId = requestAnimationFrame(render);
        return () => cancelAnimationFrame(animationId);
    }, [dimensions, players, myId, gameState, aimAngle, power, isAnimating, playbackFrames, activeMoves, onAnimationComplete]);

    // Listen for animation completion
    useEffect(() => {
        if (isAnimating && playbackFrames && playbackIndex >= playbackFrames.length - 1) {
            const timer = setTimeout(() => {
                if (onAnimationComplete) onAnimationComplete();
            }, 500); // Small pause at end before resetting
            return () => clearTimeout(timer);
        }
    }, [playbackIndex, isAnimating, playbackFrames, onAnimationComplete]);


    // Interaction Handlers (Touch/Mouse for Aiming)
    const handleStart = (clientX, clientY) => {
        if (isSpectator || isAnimating || activeMoves[myId]) return;
        setIsDragging(true);
        updateAim(clientX, clientY);
    };

    const handleMove = (clientX, clientY) => {
        if (!isDragging) return;
        updateAim(clientX, clientY);
    };

    const handleEnd = () => {
        setIsDragging(false);
    };

    const updateAim = (cx, cy) => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();

        // Transform screen coords to canvas center-relative
        // (Not strictly necessary to match scale, just getting angle)
        const relX = cx - rect.left - (rect.width / 2);
        const relY = cy - rect.top - (rect.height / 2);

        // Calculate angle from center of screen 
        const angle = Math.atan2(relY, relX);
        setAimAngle(angle);

        // Power from distance check
        const dist = Math.sqrt(relX * relX + relY * relY);
        const maxDist = rect.width / 3;
        const newPower = Math.min(100, (dist / maxDist) * 100);
        setPower(newPower);
    };

    return (
        <div ref={containerRef} style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <canvas
                ref={canvasRef}
                onMouseDown={e => handleStart(e.clientX, e.clientY)}
                onMouseMove={e => handleMove(e.clientX, e.clientY)}
                onMouseUp={handleEnd}
                onMouseLeave={handleEnd}
                onTouchStart={e => handleStart(e.touches[0].clientX, e.touches[0].clientY)}
                onTouchMove={e => handleMove(e.touches[0].clientX, e.touches[0].clientY)}
                onTouchEnd={handleEnd}
                style={{
                    borderRadius: '16px',
                    cursor: (isSpectator || isAnimating) ? 'default' : 'crosshair',
                    touchAction: 'none'
                }}
            />

            {/* Controls (Overlay or Bottom) */}
            {!isSpectator && !activeMoves[myId] && !isAnimating && (
                <div style={{
                    marginTop: '20px',
                    width: '100%',
                    maxWidth: '400px',
                    background: '#18181b',
                    padding: '20px',
                    borderRadius: '16px',
                    border: '1px solid #333'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', color: '#a1a1aa', fontSize: '12px', fontWeight: 'bold' }}>
                        <span>POWER: {Math.round(power)}%</span>
                        <span>ANGLE: {(aimAngle * 180 / Math.PI).toFixed(0)}°</span>
                    </div>

                    <input
                        type="range"
                        min="0" max="100"
                        value={power}
                        onChange={e => setPower(parseFloat(e.target.value))}
                        style={{ width: '100%', accentColor: '#ec4899', marginBottom: '20px' }}
                    />

                    <button
                        onClick={() => onCommitMove({ angle: aimAngle, power })}
                        style={{
                            width: '100%',
                            padding: '16px',
                            background: 'linear-gradient(90deg, #ec4899, #8b5cf6)',
                            border: 'none',
                            borderRadius: '12px',
                            color: '#fff',
                            fontWeight: 'bold',
                            fontSize: '18px',
                            textTransform: 'uppercase',
                            letterSpacing: '1px',
                            boxShadow: '0 4px 15px rgba(236, 72, 153, 0.4)'
                        }}
                    >
                        LOCK IN
                    </button>
                    <div style={{ textAlign: 'center', marginTop: '10px', color: '#71717a', fontSize: '12px' }}>
                        Drag on arena to aim • Slider for precision
                    </div>
                </div>
            )}

            {activeMoves[myId] && !isAnimating && (
                <div style={{ marginTop: '20px', padding: '10px 20px', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', borderRadius: '50px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                    <span className="animate-pulse">Waiting for opponents...</span>
                </div>
            )}

            {isAnimating && (
                <div style={{ marginTop: '20px', padding: '10px 20px', background: 'rgba(236, 72, 153, 0.1)', color: '#ec4899', borderRadius: '50px', border: '1px solid rgba(236, 72, 153, 0.2)' }}>
                    <span className="animate-pulse">Resolving Round...</span>
                </div>
            )}
        </div>
    );
}
