"use client";
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useApp } from '../../lib/store';

export default function Rules() {
    const { user, setIsGuestMode } = useApp();
    const router = useRouter();

    return (
        <div className="container animate-fade" style={{ paddingTop: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h1>Rules & How It Works</h1>
                <Link href="/" className="btn btn-outline" style={{ width: 'auto', padding: '8px 16px', fontSize: '12px' }}>
                    &larr; Back Home
                </Link>
            </div>

            {/* --- GUEST MODE BANNER --- */}
            {!user && (
                <div
                    onClick={() => {
                        setIsGuestMode(false);
                        router.push('/');
                    }}
                    style={{
                        background: 'linear-gradient(90deg, #f59e0b, #d97706)',
                        cursor: 'pointer',
                        padding: '12px',
                        borderRadius: '12px',
                        marginBottom: '24px',
                        textAlign: 'center',
                        boxShadow: '0 4px 15px rgba(245, 158, 11, 0.3)',
                        border: '1px solid #fbbf24',
                        animation: 'pulse 2s infinite'
                    }}
                >
                    <p style={{ margin: 0, color: '#000', fontWeight: 'bold', fontSize: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                        <span>👀 Viewing as Guest.</span>
                        <span style={{ background: '#fff', padding: '2px 8px', borderRadius: '4px', color: '#d97706' }}>Sign Up = $1000 Free! 💰</span>
                    </p>
                </div>
            )}

            <div className="card">
                <h2>🎲 What is this site?</h2>
                <p style={{ lineHeight: '1.6', color: '#d1d5db', marginBottom: '16px' }}>
                    <strong>Bet It Happens</strong> is a risk-free prediction market. You start with virtual currency and bet on the outcome of real-world events.
                    Climb the leaderboard by making smart predictions and growing your net worth.
                </p>
                <div style={{ padding: '12px', background: 'rgba(34, 197, 94, 0.1)', border: '1px solid var(--primary)', borderRadius: '8px', fontSize: '14px', color: 'var(--primary)' }}>
                    Note: No real money is involved. This is purely for competition and bragging rights.
                </div>
            </div>

            <div className="card">
                <h2>🤝 Loyalty Clause</h2>
                <p style={{ lineHeight: '1.6', color: '#d1d5db' }}>
                    <strong>Pick a side and stick to it!</strong>
                    <br />
                    Once you place a bet on an outcome (e.g., "Yes"), you cannot hedge your bets by betting on the other side.
                    You can add more money to your original position, but switching sides is forbidden.
                </p>
            </div>


            <div className="card">
                <h2>🔒 Fixed Odds Guarantee</h2>
                <p style={{ lineHeight: '1.6', color: '#d1d5db' }}>
                    <strong>What you see is what you get.</strong>
                    <br />
                    Once the first bet has been placed on an event, the odds are <strong>LOCKED</strong>.
                    They will never change, ensuring fairness for early and late bettors alike.
                </p>
            </div>

            <div className="card">
                <h2>🧩 Parlays</h2>
                <p style={{ lineHeight: '1.6', color: '#d1d5db', marginBottom: '16px' }}>
                    <strong>Create your own multi-leg bets!</strong>
                </p>
                <ul style={{ paddingLeft: '20px', color: '#a1a1aa', lineHeight: '1.8' }}>
                    <li>Combine <strong>2 to 5 outcomes</strong> into a single Parlay Card.</li>
                    <li>Every selection in your parlay MUST win for the card to payout. If even one leg loses, the entire parlay is lost.</li>
                    <li>The more legs you add, the higher the <strong>Total Multiplier</strong>. High risk, massive reward!</li>
                    <li>You can name your parlay and share it with the community. Other users can comment on it and track its progress "On Fire" 🔥.</li>
                </ul>
            </div>

            <div className="card">
                <h2>🤝 Squads</h2>
                <p style={{ lineHeight: '1.6', color: '#d1d5db', marginBottom: '16px' }}>
                    <strong>Team up and compete together!</strong>
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
                    <div>
                        <h4 style={{ color: '#fff', fontSize: '14px', marginBottom: '4px' }}>Starting a Squad</h4>
                        <p style={{ fontSize: '13px', color: '#a1a1aa' }}>
                            Anyone can create a squad. As the leader, you approve member requests and manage the squad's settings.
                        </p>
                    </div>
                    <div>
                        <h4 style={{ color: '#fff', fontSize: '14px', marginBottom: '4px' }}>Squad Wallet</h4>
                        <p style={{ fontSize: '13px', color: '#a1a1aa' }}>
                            Squads have a shared wallet! Members can <strong>Deposit</strong> funds into the squad to fuel big bets.
                            Only the Leader can withdraw funds back to individual members upon request.
                        </p>
                    </div>
                    <div>
                        <h4 style={{ color: '#fff', fontSize: '14px', marginBottom: '4px' }}>Squad Score & Rank</h4>
                        <p style={{ fontSize: '13px', color: '#a1a1aa' }}>
                            Your squad competes on a dedicated leaderboard. The <strong>Squad Score</strong> is based on total profit and win rate.
                            Work together to climb to the #1 spot and earn the crown! 👑
                        </p>
                    </div>
                </div>
            </div>

            <div className="card">
                <h2>⚖️ How are bets resolved?</h2>
                <p style={{ lineHeight: '1.6', color: '#d1d5db', marginBottom: '16px' }}>
                    Events are resolved by our Admin team based on <strong>definitive public evidence</strong>.
                </p>
                <ul style={{ paddingLeft: '20px', color: '#a1a1aa', lineHeight: '1.8' }}>
                    <li>We use reputable news sources (BBC, CNN, official government reports) to verify outcomes.</li>
                    <li>If an outcome is ambiguous or disputed, the event may be "Locked" until a clear consensus emerges.</li>
                    <li>In rare cases of cancelled events, bets may be refunded (voided).</li>
                </ul>
                <p style={{ marginTop: '16px', fontSize: '14px', fontStyle: 'italic', color: '#fbbf24' }}>
                    The Admin's decision is final.
                </p>
            </div>

            <div className="card">
                <h2>🏆 The Leaderboard</h2>
                <p style={{ lineHeight: '1.6', color: '#d1d5db' }}>
                    Your ranking is determined by your <strong>Total Net Worth</strong>.
                    <br />
                    <code>Net Worth = Available Cash + Active Bets</code>
                </p>
                <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px dashed #333' }}>
                    <h3 style={{ fontSize: '16px', color: '#fff', marginBottom: '8px' }}>📊 Last Bet Impact</h3>
                    <p style={{ fontSize: '14px', color: '#a1a1aa', lineHeight: '1.5' }}>
                        The percentage shown next to players on the leaderboard represents their <strong>Portfolio Impact</strong> from their most recently resolved bet.
                    </p>
                    <ul style={{ fontSize: '13px', color: '#a1a1aa', marginTop: '8px', paddingLeft: '20px' }}>
                        <li><b style={{ color: '#4ade80' }}>Positive %</b>: How much their total net worth grew from that win.</li>
                        <li><b style={{ color: '#ef4444' }}>Negative %</b>: How much of their total net worth was lost on that bet.</li>
                    </ul>
                </div>
            </div>

            <div className="card">
                <h2>🗣️ Community Guidelines</h2>
                <p style={{ lineHeight: '1.6', color: '#d1d5db' }}>
                    Trash talk is encouraged in the comments, but keep it fun. Hate speech, harassment, or spam will get you banned and your balance zeroed.
                </p>
            </div>
        </div>
    );
}
