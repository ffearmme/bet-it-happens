"use client";
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '../../lib/store';
import LeaderboardGrid from '../../components/LeaderboardGrid';

export default function Leaderboard() {
    const { user, isLoaded, setIsGuestMode, maintenanceSettings } = useApp();
    const router = useRouter();

    // Maintenance Check
    if (maintenanceSettings?.leaderboard === false && user?.role !== 'admin') {
        return (
            <div style={{ padding: '40px', textAlign: 'center', color: '#888' }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>🚧</div>
                <h2 style={{ color: '#fff', marginBottom: '8px' }}>Leaderboard Under Maintenance</h2>
                <p>Calculating who's really winning. Back soon.</p>
            </div>
        );
    }

    useEffect(() => {
        // if (isLoaded && !user) router.push('/'); // Allow guest view
    }, [user, isLoaded, router]);

    return (
        <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }} className="animate-fade">
            <h1 className="text-2xl font-bold mb-6">Leaderboard</h1>

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

            <LeaderboardGrid />
        </div>
    );
}
