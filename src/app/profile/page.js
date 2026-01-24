"use client";
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '../../lib/store';

export default function Profile() {
    const { user, updateUser, logout } = useApp();
    const router = useRouter();

    const [formData, setFormData] = useState({ username: '', email: '', password: '', profilePic: '' });
    const [msg, setMsg] = useState({ type: '', text: '' });

    useEffect(() => {
        if (!user) {
            router.push('/');
            return;
        }
        setFormData({
            username: user.username,
            email: user.email,
            password: user.password,
            profilePic: user.profilePic || ''
        });
    }, [user, router]);

    if (!user) return null;

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 500000) { // 500KB limit
                setMsg({ type: 'error', text: 'Image too large (Max 500KB)' });
                return;
            }
            const reader = new FileReader();
            reader.onloadend = () => {
                setFormData(prev => ({ ...prev, profilePic: reader.result }));
            };
            reader.readAsDataURL(file);
        }
    };

    const handleUpdate = (e) => {
        e.preventDefault();
        const res = updateUser(formData);
        if (res.success) {
            setMsg({ type: 'success', text: 'Profile updated successfully!' });
            setTimeout(() => setMsg({ type: '', text: '' }), 2000);
        } else {
            setMsg({ type: 'error', text: res.error });
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
                            type="password" // Show password for simple edit as requested
                            value={formData.password}
                            onChange={e => setFormData({ ...formData, password: e.target.value })}
                            required
                        />
                    </div>

                    {msg.text && <p style={{ color: msg.type === 'success' ? 'var(--accent-win)' : 'var(--accent-loss)', textAlign: 'center', marginBottom: '12px' }}>{msg.text}</p>}

                    <button className="btn btn-primary">Save Changes</button>
                </form>

                <div style={{ marginTop: '24px', paddingTop: '24px', borderTop: '1px solid var(--border)' }}>
                    <button className="btn btn-outline" onClick={logout} style={{ borderColor: 'var(--accent-loss)', color: 'var(--accent-loss)' }}>
                        Sign Out
                    </button>
                </div>
            </div>
        </div>
    );
}
