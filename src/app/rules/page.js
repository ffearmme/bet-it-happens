"use client";
import Link from 'next/link';

export default function Rules() {
    return (
        <div className="container animate-fade" style={{ paddingTop: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h1>Rules & How It Works</h1>
                <Link href="/" className="btn btn-outline" style={{ width: 'auto', padding: '8px 16px', fontSize: '12px' }}>
                    &larr; Back Home
                </Link>
            </div>

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
