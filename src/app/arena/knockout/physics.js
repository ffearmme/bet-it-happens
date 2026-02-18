
// Knockout Physics Engine
// Fully deterministic, frame-independent logic for resolving turns.

export const PHYSICS_CONFIG = {
    PLATFORM_INITIAL_RADIUS: 400,
    PLAYER_RADIUS: 25,
    FRICTION: 0.95, // Velocity multiplier per frame
    ELASTICITY: 0.8, // Bounciness
    MOVE_POWER_MULTIPLIER: 15, // Max power -> Initial Velocity
    FRAMES_PER_TURN: 180, // 3 seconds at 60fps
    SUBSTEPS: 4, // Physics iterations per frame for stability
};

export function calculateRoundOutcome(currentPositions, moves, platformRadius, activePlayers) {
    // 1. Initialize State
    // currentPositions: { [userId]: { x, y, vx, vy, isEliminated } }
    // moves: { [userId]: { angle, power } }
    // activePlayers: Array of userIds who are still in

    let state = JSON.parse(JSON.stringify(currentPositions));
    const events = []; // Track collisions/eliminations for playback
    const frames = []; // Snapshots for smooth playback

    // Initialize players who don't have positions (first round)
    const storeDefaults = (uid, index, total) => {
        if (!state[uid] || state[uid].isEliminated) return;

        // Spawn in circle
        if (!state[uid].x && !state[uid].y) {
            const angle = (index / total) * Math.PI * 2;
            const dist = platformRadius * 0.6;
            state[uid] = {
                ...state[uid],
                x: Math.cos(angle) * dist,
                y: Math.sin(angle) * dist,
                vx: 0,
                vy: 0,
                mass: 1,
                radius: PHYSICS_CONFIG.PLAYER_RADIUS
            };
        }
    };

    activePlayers.forEach((uid, i) => storeDefaults(uid, i, activePlayers.length));

    // 2. Apply Moves (Impulse)
    Object.keys(moves).forEach(uid => {
        if (!state[uid] || state[uid].isEliminated) return;

        const move = moves[uid];
        const power = Math.max(0, Math.min(100, move.power)); // Clamp 0-100
        const angle = move.angle; // Radians

        // Add velocity based on power
        const impulse = (power / 100) * PHYSICS_CONFIG.MOVE_POWER_MULTIPLIER;
        state[uid].vx += Math.cos(angle) * impulse;
        state[uid].vy += Math.sin(angle) * impulse;
    });

    // 3. Simulate Frames
    for (let f = 0; f < PHYSICS_CONFIG.FRAMES_PER_TURN; f++) {
        // Record frame snapshot for playback
        const frameSnapshot = {};

        // Sub-stepping for collision stability
        for (let s = 0; s < PHYSICS_CONFIG.SUBSTEPS; s++) {

            // A. Move & Friction
            activePlayers.forEach(uid => {
                const p = state[uid];
                if (!p || p.isEliminated) return;

                p.x += p.vx / PHYSICS_CONFIG.SUBSTEPS;
                p.y += p.vy / PHYSICS_CONFIG.SUBSTEPS;

                // Friction (applied once per full frame, so we scale it)
                if (s === 0) {
                    p.vx *= PHYSICS_CONFIG.FRICTION;
                    p.vy *= PHYSICS_CONFIG.FRICTION;

                    // Stop if too slow
                    if (Math.abs(p.vx) < 0.1) p.vx = 0;
                    if (Math.abs(p.vy) < 0.1) p.vy = 0;
                }
            });

            // B. Resolve Collisions (Player vs Player)
            for (let i = 0; i < activePlayers.length; i++) {
                for (let j = i + 1; j < activePlayers.length; j++) {
                    const idA = activePlayers[i];
                    const idB = activePlayers[j];
                    const pA = state[idA];
                    const pB = state[idB];

                    if (!pA || pA.isEliminated || !pB || pB.isEliminated) continue;

                    const dx = pB.x - pA.x;
                    const dy = pB.y - pA.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    const minDist = pA.radius + pB.radius;

                    if (distance < minDist && distance > 0) {
                        // Collision Detected
                        const angle = Math.atan2(dy, dx);
                        const sin = Math.sin(angle);
                        const cos = Math.cos(angle);

                        // Rotate velocities to collision axis
                        const vxA = pA.vx * cos + pA.vy * sin;
                        const vyA = pA.vy * cos - pA.vx * sin;
                        const vxB = pB.vx * cos + pB.vy * sin;
                        const vyB = pB.vy * cos - pB.vx * sin;

                        // 1D elastic collision on x-axis (mass is equal)
                        // vA' = vB, vB' = vA (perfect swap if elastic=1)
                        // With elasticity e: vA' = ((1-e)vA + (1+e)vB)/2

                        const e = PHYSICS_CONFIG.ELASTICITY;
                        const finalVXA = ((1 - e) * vxA + (1 + e) * vxB) / 2;
                        const finalVXB = ((1 - e) * vxB + (1 + e) * vxA) / 2;

                        // Rotate back
                        pA.vx = finalVXA * cos - vyA * sin;
                        pA.vy = finalVXA * sin + vyA * cos;
                        pB.vx = finalVXB * cos - vyB * sin;
                        pB.vy = finalVXB * sin + vyB * cos;

                        // Separate circles to prevent sticking
                        const overlap = minDist - distance;
                        const separationX = overlap * cos * 0.5;
                        const separationY = overlap * sin * 0.5;

                        pA.x -= separationX;
                        pA.y -= separationY;
                        pB.x += separationX;
                        pB.y += separationY;

                        if (s === 0) { // Log event only once/frame
                            events.push({ type: 'collision', frame: f, players: [idA, idB] });
                        }
                    }
                }
            }
        }

        // C. Check Elimination (Off Platform)
        activePlayers.forEach(uid => {
            const p = state[uid];
            if (!p || p.isEliminated) return;

            const distFromCenter = Math.sqrt(p.x * p.x + p.y * p.y);
            if (distFromCenter > platformRadius + p.radius) {
                p.isEliminated = true;
                events.push({ type: 'elimination', frame: f, player: uid });
            }

            frameSnapshot[uid] = { ...p };
        });

        frames.push(frameSnapshot);
    }

    return {
        finalState: state,
        frames: frames,
        events: events
    };
}
