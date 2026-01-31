"use client";
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '../../lib/store';

export default function Profile() {
    const { user, updateUser, logout, deleteAccount, demoteSelf, isLoaded, getUserStats } = useApp();
    const router = useRouter();

    const [formData, setFormData] = useState({ username: '', email: '', password: '', profilePic: '', bio: '' });
    const [msg, setMsg] = useState({ type: '', text: '' });
    const [stats, setStats] = useState(null);

    useEffect(() => {
        if (!isLoaded) return;
        if (!user) {
            router.push('/');
            return;
        }
        setFormData({
            username: user.username,
            email: user.email,
            password: user.password,
            profilePic: user.profilePic || '',
            bio: user.bio || ''
        });

        getUserStats(user.id).then(res => {
            if (res.success) setStats(res.stats);
        });
    }, [user, isLoaded, router]);

    if (!isLoaded) return <div className="container" style={{ padding: '40px', textAlign: 'center' }}>Loading profile...</div>;
    if (!user) return null;

    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 10 * 1024 * 1024) { // 10MB limit
                setMsg({ type: 'error', text: 'Image too large (Max 10MB)' });
                return;
            }

            try {
                setMsg({ type: '', text: 'Processing image...' });
                const compressedBase64 = await compressImage(file);

                // Final check for Firestore limit (1MB roughly)
                if (compressedBase64.length > 1000000) {
                    setMsg({ type: 'error', text: 'Image still too complex after compression. Try a simpler image.' });
                    return;
                }

                setFormData(prev => ({ ...prev, profilePic: compressedBase64 }));
                setMsg({ type: 'success', text: 'Image processed! Ready to save.' });
                setTimeout(() => setMsg({ type: '', text: '' }), 2000);
            } catch (err) {
                console.error("Compression error:", err);
                setMsg({ type: 'error', text: 'Failed to process image.' });
            }
        }
    };

    const compressImage = (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target.result;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;
                    const MAX_WIDTH = 500;
                    const MAX_HEIGHT = 500;

                    if (width > height) {
                        if (width > MAX_WIDTH) {
                            height *= MAX_WIDTH / width;
                            width = MAX_WIDTH;
                        }
                    } else {
                        if (height > MAX_HEIGHT) {
                            width *= MAX_HEIGHT / height;
                            height = MAX_HEIGHT;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);

                    // Compress to JPEG with 0.7 quality
                    const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
                    resolve(dataUrl);
                };
                img.onerror = (err) => reject(err);
            };
            reader.onerror = (err) => reject(err);
        });
    };

    const handleUpdate = async (e) => {
        e.preventDefault();
        setMsg({ type: '', text: 'Updating...' });

        const res = await updateUser(formData);

        if (res.success) {
            setMsg({ type: 'success', text: res.message || 'Profile updated successfully!' });
            setTimeout(() => setMsg({ type: '', text: '' }), 3000);
        } else {
            console.error("Update failed:", res.error);
            setMsg({ type: 'error', text: res.error || 'Failed to update.' });
        }
    };

    return (
        <div className="container animate-fade">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '20px', marginBottom: '24px' }}>
                <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: 'var(--text-muted)' }}>
                    <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
                </button>
                <h1 style={{ margin: 0, fontSize: '24px' }}>Account Settings</h1>
            </div>

            <div className="card">
                <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                    <div style={{ position: 'relative', width: '100px', height: '100px', margin: '0 auto 12px' }}>
                        <div style={{
                            width: '100%', height: '100%',
                            borderRadius: '50%',
                            background: 'var(--bg-input)',
                            overflow: 'hidden',
                            border: '2px solid var(--primary)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                            {formData.profilePic ? (
                                <img src={formData.profilePic} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                                <span style={{ fontSize: '32px' }}>{user.username.charAt(0).toUpperCase()}</span>
                            )}
                        </div>
                        <label style={{
                            position: 'absolute', bottom: 0, right: 0,
                            background: 'var(--primary)', color: '#000',
                            width: '32px', height: '32px', borderRadius: '50%',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: 'pointer', border: '2px solid var(--bg-card)'
                        }}>
                            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></svg>
                            <input type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
                        </label>
                    </div>
                    <p className="text-sm">User ID: {user.id.slice(0, 8)}...</p>

                    <div style={{ marginTop: '12px', background: 'rgba(34, 197, 94, 0.1)', padding: '12px', borderRadius: '8px', border: '1px solid var(--primary)' }}>
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase', fontWeight: 'bold' }}>Your Referral Code</p>
                        <p style={{ fontSize: '24px', fontWeight: '900', color: '#fff', letterSpacing: '4px', fontFamily: 'monospace', margin: '4px 0' }}>
                            {user.referralCode || '---'}
                        </p>
                        <p style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: 'bold' }}>
                            Give this to friends! You get $500 when they sign up. 💰
                        </p>
                    </div>

                    {stats && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginTop: '16px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
                            <div style={{ background: 'var(--bg-input)', padding: '8px', borderRadius: '8px' }}>
                                <div className="text-sm">Win Rate</div>
                                <div style={{ fontSize: '18px', fontWeight: 'bold', color: 'var(--primary)' }}>{stats.winRate}%</div>
                            </div>
                            <div style={{ background: 'var(--bg-input)', padding: '8px', borderRadius: '8px' }}>
                                <div className="text-sm">Profit</div>
                                <div style={{ fontSize: '18px', fontWeight: 'bold', color: stats.profit >= 0 ? 'var(--primary)' : 'var(--accent-loss)' }}>
                                    ${stats.profit.toFixed(0)}
                                </div>
                            </div>
                            <div style={{ background: 'var(--bg-input)', padding: '8px', borderRadius: '8px' }}>
                                <div className="text-sm">Bets</div>
                                <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#fff' }}>{stats.total}</div>
                            </div>
                        </div>
                    )}
                </div>

                <form onSubmit={handleUpdate}>
                    <div className="input-group">
                        <label className="text-sm" style={{ marginBottom: '8px', display: 'block' }}>Username</label>
                        <input
                            className="input"
                            value={formData.username}
                            onChange={e => setFormData({ ...formData, username: e.target.value })}
                            required
                        />
                    </div>
                    <div className="input-group">
                        <label className="text-sm" style={{ marginBottom: '8px', display: 'block' }}>Email</label>
                        <input
                            className="input"
                            type="email"
                            value={formData.email}
                            onChange={e => setFormData({ ...formData, email: e.target.value })}
                            required
                        />
                    </div>
                    <div className="input-group">
                        <label className="text-sm" style={{ marginBottom: '8px', display: 'block' }}>Password</label>
                        <input
                            className="input"
                            type="password"
                            value={formData.password}
                            onChange={e => setFormData({ ...formData, password: e.target.value })}
                            required
                        />
                    </div>

                    <div className="input-group">
                        <label className="text-sm" style={{ marginBottom: '8px', display: 'block' }}>Bio</label>
                        <textarea
                            className="input"
                            value={formData.bio}
                            onChange={e => setFormData({ ...formData, bio: e.target.value })}
                            placeholder="Tell the world who you are..."
                            rows={3}
                            style={{ resize: 'none' }}
                        />
                    </div>

                    {msg.text && <p style={{ color: msg.type === 'success' ? 'var(--accent-win)' : 'var(--accent-loss)', textAlign: 'center', marginBottom: '12px' }}>{msg.text}</p>}

                    <button className="btn btn-primary">Save Changes</button>
                </form>

                <div style={{ marginTop: '24px', paddingTop: '24px', borderTop: '1px solid var(--border)' }}>
                    <button className="btn btn-outline" onClick={logout} style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>
                        Sign Out
                    </button>
                </div>

                {/* DANGER ZONE */}
                <div style={{ marginTop: '40px', paddingTop: '24px', borderTop: '1px solid #dc2626' }}>
                    <h3 style={{ color: '#ef4444', fontSize: '18px', marginBottom: '16px' }}>Danger Zone</h3>

                    {user.role === 'admin' && (
                        <div style={{ marginBottom: '16px' }}>
                            <p className="text-sm" style={{ marginBottom: '8px' }}>You are currently an Admin.</p>
                            <button
                                className="btn"
                                style={{ background: 'var(--bg-card)', border: '1px solid #f59e0b', color: '#f59e0b', width: '100%' }}
                                onClick={async () => {
                                    if (confirm("Are you sure you want to remove your own Admin privileges? This cannot be undone from here.")) {
                                        const res = await demoteSelf();
                                        if (res.success) alert("You are now a regular user.");
                                        else alert("Error: " + res.error);
                                    }
                                }}
                            >
                                Step Down (Remove Admin)
                            </button>
                        </div>
                    )}

                    <div style={{ padding: '16px', border: '1px solid #7f1d1d', borderRadius: '8px', background: 'rgba(127, 29, 29, 0.1)' }}>
                        <p style={{ color: '#fca5a5', fontSize: '14px', marginBottom: '12px' }}>
                            Permanently delete your account and all data. This action cannot be undone.
                        </p>
                        <button
                            className="btn"
                            style={{ background: '#dc2626', color: 'white', border: 'none', width: '100%' }}
                            onClick={async () => {
                                const confirm1 = confirm("Are you sure you want to delete your account? This is PERMANENT.");
                                if (confirm1) {
                                    const confirm2 = confirm("Last chance: This will wipe your coins, bets, and profile forever. Confirm?");
                                    if (confirm2) {
                                        const res = await deleteAccount();
                                        if (!res.success) {
                                            alert(res.error || "Failed to delete. Try logging out and in again.");
                                        }
                                        // If success, store listener will handle redirect usually, or auth change will
                                    }
                                }
                            }}
                        >
                            Delete Account Permanently
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
