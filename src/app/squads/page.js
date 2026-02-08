"use client";
import React, { useState, useEffect } from 'react';
import { useApp } from '../../lib/store';
import Navbar from '../../components/Navbar';
import { Users, Shield, Wallet, Trophy, UserPlus, LogOut, Check, X, Plus, Search, Lock, Settings, Image as ImageIcon, ArrowUp, ArrowDown, Crown } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function SquadsPage() {
    const { user, squads, isLoaded, createSquad, joinSquad, leaveSquad, manageSquadRequest, kickMember, updateSquad, inviteUserToSquad, respondToSquadInvite, searchUsers, isGuestMode, getUserStats, getSquadStats, depositToSquad, withdrawFromSquad, updateMemberRole, transferSquadLeadership, requestSquadWithdrawal, respondToWithdrawalRequest } = useApp();
    const [activeTab, setActiveTab] = useState('overview');
    const [squadMode, setSquadMode] = useState('my_squad');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showSettingsModal, setShowSettingsModal] = useState(false);
    const [showInviteModal, setShowInviteModal] = useState(false);
    const router = useRouter();

    const [viewingUser, setViewingUser] = useState(null);
    const [viewingSquad, setViewingSquad] = useState(null);
    const [viewingProfile, setViewingProfile] = useState(null);
    const [squadStats, setSquadStats] = useState(null);

    const squadRanks = React.useMemo(() => {
        const sorted = [...squads].sort((a, b) => (b.stats?.score || 0) - (a.stats?.score || 0));
        const ranks = {};
        sorted.forEach((s, i) => {
            ranks[s.id] = i + 1;
        });
        return ranks;
    }, [squads]);

    // Redirect if not in squad but on "my_squad"
    useEffect(() => {
        if (isLoaded && user && !user.squadId && squadMode === 'my_squad') {
            setSquadMode('browse');
        }
    }, [isLoaded, user?.squadId, squadMode]);
    const [showDepositModal, setShowDepositModal] = useState(false);
    const [showWithdrawModal, setShowWithdrawModal] = useState(false);
    const [transactionAmount, setTransactionAmount] = useState('');
    const [withdrawReason, setWithdrawReason] = useState('');

    // Derived squad
    const mySquad = user?.squadId ? squads.find(s => s.id === user.squadId) : null;
    const isLeader = mySquad && mySquad.leaderId === user.id;

    const openDepositModal = () => {
        setTransactionAmount('');
        setShowDepositModal(true);
    };

    const openWithdrawModal = () => {
        setTransactionAmount('');
        setWithdrawReason('');
        setShowWithdrawModal(true);
    };

    const submitDeposit = async (e) => {
        e.preventDefault();
        const val = parseFloat(transactionAmount);
        if (isNaN(val) || val <= 0) return alert("Invalid amount");

        if (val > (user.balance || 0)) {
            alert(`Insufficient funds. Your wallet balance is $${(user.balance || 0).toLocaleString()}.`);
            return;
        }

        const res = await depositToSquad(val);
        if (!res.success) alert("Deposit Failed: " + res.error);
        else {
            alert("Deposit Successful!");
            setShowDepositModal(false);
        }
    };

    const submitWithdraw = async (e) => {
        e.preventDefault();
        const val = parseFloat(transactionAmount);
        if (isNaN(val) || val <= 0) return alert("Invalid amount");

        if (val > (mySquad.wallet?.balance || 0)) {
            alert(`Insufficient squad funds. Squad wallet has $${(mySquad.wallet?.balance || 0).toLocaleString()}.`);
            return;
        }

        if (isLeader) {
            const res = await withdrawFromSquad(val);
            if (!res.success) alert("Withdraw Failed: " + res.error);
            else {
                alert("Withdraw Successful!");
                setShowWithdrawModal(false);
            }
        } else {
            if (!withdrawReason) return alert("Please provide a reason.");
            const res = await requestSquadWithdrawal(val, withdrawReason);
            if (!res.success) alert("Request Failed: " + res.error);
            else {
                alert("Withdrawal request sent to leader!");
                setShowWithdrawModal(false);
            }
        }
    };


    useEffect(() => {
        if (viewingUser) {
            setViewingProfile(null);
            getUserStats(viewingUser.id).then(res => {
                if (res.success) setViewingProfile(res);
            });
        }
    }, [viewingUser, getUserStats]);


    useEffect(() => {
        if (mySquad) {
            // Try cache first
            const cached = localStorage.getItem(`squad_stats_${mySquad.id}`);
            if (cached) {
                try { setSquadStats(JSON.parse(cached)); } catch (e) { }
            }

            getSquadStats(mySquad.id).then(res => {
                if (res.success) {
                    setSquadStats(res.stats);
                    localStorage.setItem(`squad_stats_${mySquad.id}`, JSON.stringify(res.stats));
                }
            });
        }
    }, [mySquad?.id]);

    // Create Squad Form State
    const [newName, setNewName] = useState('');
    const [newDesc, setNewDesc] = useState('');
    const [newPrivacy, setNewPrivacy] = useState('open');
    const [isCreating, setIsCreating] = useState(false);

    // Edit Squad State
    const [editName, setEditName] = useState('');
    const [editDesc, setEditDesc] = useState('');
    const [editPrivacy, setEditPrivacy] = useState('open');
    const [editImage, setEditImage] = useState('');
    const [isUpdating, setIsUpdating] = useState(false);

    // Invite State
    const [inviteName, setInviteName] = useState('');
    const [isInviting, setIsInviting] = useState(false);
    const [searchResults, setSearchResults] = useState([]);

    useEffect(() => {
        if (showInviteModal) {
            setInviteName('');
            const results = searchUsers('');
            setSearchResults(results.filter(u => u.role !== 'admin'));
        }
    }, [showInviteModal, searchUsers]);



    // Loading State
    if (!isLoaded) {
        return (
            <div style={{ minHeight: '100vh', background: 'var(--bg-app)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div className="animate-spin" style={{ width: '32px', height: '32px', border: '2px solid var(--primary)', borderTopColor: 'transparent', borderRadius: '50%' }}></div>
            </div>
        );
    }

    // Auth Guard
    if (!user && !isGuestMode) {
        router.push('/');
        return null;
    }

    // Guest Guard
    if (isGuestMode) {
        return (
            <div style={{ minHeight: '100vh', background: 'var(--bg-app)', color: '#fff', paddingBottom: '80px' }}>
                <Navbar />
                <div className="container" style={{ textAlign: 'center', padding: '32px 16px' }}>
                    <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '16px' }}>Squads</h1>
                    <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>Join a squad to pool funds and bet together!</p>
                    <div className="card" style={{ padding: '32px', border: '1px solid var(--border)', textAlign: 'center' }}>
                        <Lock size={48} style={{ color: 'var(--primary)', margin: '0 auto 16px' }} />
                        <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '8px' }}>Login Required</h2>
                        <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>You need to be logged in to join or create a squad.</p>
                        <button onClick={() => router.push('/')} className="btn btn-primary" style={{ maxWidth: '200px', margin: '0 auto' }}>
                            Go to Login
                        </button>
                    </div>
                </div>
            </div>
        )
    }



    // --- Actions ---

    const handleCreate = async (e) => {
        e.preventDefault();
        if (!newName.trim()) return;
        setIsCreating(true);
        const res = await createSquad(newName, newPrivacy, newDesc);
        setIsCreating(false);
        if (res.success) {
            setShowCreateModal(false);
            setNewName('');
            setNewDesc('');
            setSquadMode('my_squad');
        } else {
            alert(res.error);
        }
    };

    const openSettings = () => {
        if (!mySquad) return;
        setEditName(mySquad.name);
        setEditDesc(mySquad.description || '');
        setEditPrivacy(mySquad.privacy);
        setEditImage(mySquad.image || '');
        setShowSettingsModal(true);
    };

    const handleUpdate = async (e) => {
        e.preventDefault();
        if (!editName.trim()) return;
        setIsUpdating(true);
        const res = await updateSquad(mySquad.id, {
            name: editName,
            description: editDesc,
            privacy: editPrivacy,
            image: editImage
        });
        setIsUpdating(false);
        if (res.success) {
            setShowSettingsModal(false);
        } else {
            alert(res.error);
        }
    };

    const handleJoin = async (squadId, privacy) => {
        if (privacy === 'invite-only') return;

        const confirmMsg = privacy === 'request'
            ? "Send request to join this squad?"
            : "Join this squad? You will be added immediately.";

        if (!window.confirm(confirmMsg)) return;

        const res = await joinSquad(squadId);
        if (res.success) {
            if (res.status === 'requested') alert("Request sent!");
        } else {
            alert(res.error);
        }
    };

    const handleLeave = async () => {
        const msg = isLeader ? "Disband squad? This cannot be undone." : "Are you sure you want to leave your squad?";
        if (!window.confirm(msg)) return;
        const res = await leaveSquad();
        if (!res.success) alert(res.error);
    };

    const handleKick = async (userId) => {
        if (!window.confirm("Kick this member?")) return;
        const res = await kickMember(mySquad.id, userId);
        if (!res.success) alert(res.error);
    }

    const handleRequest = async (userId, action) => {
        const res = await manageSquadRequest(mySquad.id, userId, action);
        if (!res.success) alert(res.error);
    }

    const handleSearch = (e) => {
        const val = e.target.value;
        setInviteName(val);
        const results = searchUsers(val);
        setSearchResults(results.filter(u => u.role !== 'admin'));
    };

    const onInviteUser = async (targetUsername) => {
        setIsInviting(true);
        const res = await inviteUserToSquad(mySquad.id, targetUsername);
        setIsInviting(false);
        if (res.success) {
            alert(res.message);
            // Re-search to update status ideally, but store.js might not proactively update "invited" status in 'users' list if it's not subscribed.
            // For now just allow closing.
            // setShowInviteModal(false); // keep open for multiple invites
            setSearchResults(prev => prev.map(u => u.username === targetUsername ? { ...u, squadInvites: [...(u.squadInvites || []), { squadId: mySquad.id }] } : u));
        } else {
            alert(res.error);
        }
    }

    const handleRespondToInvite = async (squadId, action) => {
        const res = await respondToSquadInvite(squadId, action);
        if (!res.success) alert(res.error);
        else if (action === 'accept') alert("Welcome to the squad!");
    }

    // --- Renders ---

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

    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 10 * 1024 * 1024) { // 10MB limit
                alert('Image too large (Max 10MB)');
                return;
            }

            try {
                // setMsg({ type: '', text: 'Processing image...' }); // We don't have msg state here, maybe add later if needed
                const compressedBase64 = await compressImage(file);

                if (compressedBase64.length > 1000000) {
                    alert('Image still too complex after compression. Try a simpler image.');
                    return;
                }

                setEditImage(compressedBase64);
            } catch (err) {
                console.error("Compression error:", err);
                alert('Failed to process image.');
            }
        }
    };

    const renderSettingsModal = () => (
        <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50,
            backdropFilter: 'blur(5px)'
        }}>
            <div className="animate-fade" style={{
                background: 'var(--bg-card)', width: '100%', maxWidth: '450px',
                borderRadius: '16px', border: '1px solid var(--border)', overflow: 'hidden', margin: '16px'
            }}>
                <div style={{ padding: '24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h2 style={{ fontSize: '20px', fontWeight: 'bold' }}>Squad Settings</h2>
                    <button onClick={() => setShowSettingsModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                        <X size={24} />
                    </button>
                </div>
                <form onSubmit={handleUpdate} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

                    <div style={{ textAlign: 'center', marginBottom: '8px' }}>
                        <div style={{ position: 'relative', width: '100px', height: '100px', margin: '0 auto 12px' }}>
                            <div style={{
                                width: '100%', height: '100%',
                                borderRadius: '16px', // Squads often square-ish or rounded rect
                                background: 'var(--bg-input)',
                                overflow: 'hidden',
                                border: '2px solid var(--primary)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}>
                                {editImage ? (
                                    <img src={editImage} alt="Squad" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                    <Shield size={48} style={{ color: 'var(--text-muted)' }} />
                                )}
                            </div>
                            <label style={{
                                position: 'absolute', bottom: -8, right: -8,
                                background: 'var(--primary)', color: '#000',
                                width: '32px', height: '32px', borderRadius: '50%',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                cursor: 'pointer', border: '2px solid var(--bg-card)',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                            }}>
                                <ImageIcon size={16} />
                                <input type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
                            </label>
                        </div>
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Tap icon to change squad image</p>
                    </div>

                    <div>
                        <label style={{ display: 'block', fontSize: '14px', color: 'var(--text-muted)', marginBottom: '4px' }}>Squad Name</label>
                        <input
                            className="input"
                            value={editName}
                            onChange={e => setEditName(e.target.value)}
                            maxLength={20}
                            required
                        />
                    </div>
                    {/* Removed old URL input */}

                    <div>
                        <label style={{ display: 'block', fontSize: '14px', color: 'var(--text-muted)', marginBottom: '4px' }}>Description</label>
                        <textarea
                            className="input"
                            style={{ minHeight: '100px', resize: 'none' }}
                            value={editDesc}
                            onChange={e => setEditDesc(e.target.value)}
                            maxLength={100}
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: '14px', color: 'var(--text-muted)', marginBottom: '8px' }}>Privacy</label>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                            {['open', 'request', 'invite-only'].map(type => (
                                <button
                                    key={type}
                                    type="button"
                                    onClick={() => setEditPrivacy(type)}
                                    style={{
                                        padding: '8px', borderRadius: '8px', fontSize: '14px', textTransform: 'capitalize',
                                        border: editPrivacy === type ? '1px solid var(--primary)' : '1px solid var(--border)',
                                        background: editPrivacy === type ? 'rgba(34, 197, 94, 0.15)' : 'transparent',
                                        color: editPrivacy === type ? 'var(--primary)' : 'var(--text-muted)',
                                        cursor: 'pointer', fontWeight: editPrivacy === type ? 'bold' : 'normal'
                                    }}
                                >
                                    {type.replace('-', ' ')}
                                </button>
                            ))}
                        </div>
                    </div>
                    <button
                        type="submit"
                        disabled={isUpdating}
                        className="btn btn-primary"
                        style={{ marginTop: '16px' }}
                    >
                        {isUpdating ? 'Saving...' : 'Save Changes'}
                    </button>
                </form>
            </div>
        </div>
    );

    const renderCreateModal = () => (
        <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50,
            backdropFilter: 'blur(5px)'
        }}>
            <div className="animate-fade" style={{
                background: 'var(--bg-card)', width: '100%', maxWidth: '450px',
                borderRadius: '16px', border: '1px solid var(--border)', overflow: 'hidden', margin: '16px'
            }}>
                <div style={{ padding: '24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h2 style={{ fontSize: '20px', fontWeight: 'bold' }}>Create a Squad</h2>
                    <button onClick={() => setShowCreateModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                        <X size={24} />
                    </button>
                </div>
                <form onSubmit={handleCreate} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div>
                        <label style={{ display: 'block', fontSize: '14px', color: 'var(--text-muted)', marginBottom: '4px' }}>Squad Name</label>
                        <input
                            className="input"
                            placeholder="e.g. The High Rollers"
                            value={newName}
                            onChange={e => setNewName(e.target.value)}
                            maxLength={20}
                            required
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: '14px', color: 'var(--text-muted)', marginBottom: '4px' }}>Description (Optional)</label>
                        <textarea
                            className="input"
                            style={{ minHeight: '100px', resize: 'none' }}
                            placeholder="What's your strategy?"
                            value={newDesc}
                            onChange={e => setNewDesc(e.target.value)}
                            maxLength={100}
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: '14px', color: 'var(--text-muted)', marginBottom: '8px' }}>Privacy</label>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                            {['open', 'request', 'invite-only'].map(type => (
                                <button
                                    key={type}
                                    type="button"
                                    onClick={() => setNewPrivacy(type)}
                                    style={{
                                        padding: '8px', borderRadius: '8px', fontSize: '14px', textTransform: 'capitalize',
                                        border: newPrivacy === type ? '1px solid var(--primary)' : '1px solid var(--border)',
                                        background: newPrivacy === type ? 'rgba(34, 197, 94, 0.15)' : 'transparent',
                                        color: newPrivacy === type ? 'var(--primary)' : 'var(--text-muted)',
                                        cursor: 'pointer', fontWeight: newPrivacy === type ? 'bold' : 'normal'
                                    }}
                                >
                                    {type.replace('-', ' ')}
                                </button>
                            ))}
                        </div>
                    </div>
                    <button
                        type="submit"
                        disabled={isCreating}
                        className="btn btn-primary"
                        style={{ marginTop: '16px' }}
                    >
                        {isCreating ? 'Creating...' : 'Create Squad'}
                    </button>
                </form>
            </div>
        </div>
    );

    const renderInviteModal = () => (
        <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50,
            backdropFilter: 'blur(5px)'
        }}>
            <div className="animate-fade" style={{
                background: 'var(--bg-card)', width: '100%', maxWidth: '450px', height: '600px',
                borderRadius: '16px', border: '1px solid var(--border)', overflow: 'hidden', margin: '16px',
                display: 'flex', flexDirection: 'column'
            }}>
                <div style={{ padding: '24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h2 style={{ fontSize: '20px', fontWeight: 'bold' }}>Invite Member</h2>
                    <button onClick={() => setShowInviteModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                        <X size={24} />
                    </button>
                </div>

                <div style={{ padding: '24px', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ position: 'relative' }}>
                        <Search size={20} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                        <input
                            className="input"
                            style={{ paddingLeft: '48px' }}
                            placeholder="Search by username..."
                            value={inviteName}
                            onChange={handleSearch}
                            autoFocus
                        />
                    </div>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
                    {searchResults.length === 0 ? (
                        <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: '40px' }}>
                            {inviteName ? `No users found matching "${inviteName}".` : 'No users available to invite.'}
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {searchResults.map(u => {
                                const isMember = mySquad.members.includes(u.id);
                                const isInvited = u.squadInvites && u.squadInvites.some(i => i.squadId === mySquad.id);
                                const alreadyInSquad = !!u.squadId;

                                return (
                                    <div key={u.id} style={{
                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                        padding: '16px', background: 'rgba(255,255,255,0.02)',
                                        borderRadius: '12px', border: '1px solid var(--border)'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#374151', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                {u.profilePic ?
                                                    <img src={u.profilePic} alt={u.username} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> :
                                                    <span style={{ fontWeight: 'bold' }}>{u.username?.[0]?.toUpperCase()}</span>
                                                }
                                            </div>
                                            <div>
                                                <div style={{ fontWeight: 'bold', color: '#fff' }}>{u.username}</div>
                                                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                                    {isMember ? 'Already a member' :
                                                        isInvited ? 'Invite Pending' :
                                                            alreadyInSquad ? 'In another squad' : 'Available'}
                                                </div>
                                            </div>
                                        </div>
                                        {!isMember && !isInvited && !alreadyInSquad && (
                                            <button
                                                onClick={() => onInviteUser(u.username)}
                                                className="btn btn-primary"
                                                style={{ padding: '8px 16px', fontSize: '12px', width: 'auto' }}
                                                disabled={isInviting}
                                            >
                                                Invite
                                            </button>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );

    const renderSquadList = () => (
        <div className="container" style={{ paddingBottom: '120px' }}>
            <header style={{ marginBottom: '32px', textAlign: 'center' }}>
                <h1 style={{
                    fontSize: '32px',
                    background: 'linear-gradient(to right, #4ade80, #3b82f6)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    marginBottom: '8px'
                }}>Find Your Squad</h1>
                <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '24px' }}>
                    Join forces, pool funds, and win together.
                </p>
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="btn btn-primary"
                    style={{ maxWidth: '200px', margin: '0 auto', display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                    <Plus size={20} />
                    Create Squad
                </button>
            </header>

            {user.squadInvites && user.squadInvites.length > 0 && (
                <div style={{ marginBottom: '32px' }} className="animate-fade">
                    <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#eab308' }} />
                        Pending Invites
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
                        {user.squadInvites.map((invite, idx) => (
                            <div key={idx} className="card" style={{ padding: '20px', border: '1px solid var(--primary)', background: 'rgba(34, 197, 94, 0.05)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '12px' }}>
                                    <div>
                                        <h4 style={{ fontSize: '18px', fontWeight: 'bold', color: '#fff' }}>{invite.squadName}</h4>
                                        <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Invited by <span style={{ color: '#fff' }}>{invite.invitedBy}</span></p>
                                    </div>
                                    <span style={{ fontSize: '10px', background: 'var(--primary)', color: '#000', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>INVITE</span>
                                </div>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <button
                                        onClick={() => handleRespondToInvite(invite.squadId, 'accept')}
                                        className="btn btn-primary"
                                        style={{ flex: 1, fontSize: '14px', padding: '8px' }}
                                    >
                                        Accept
                                    </button>
                                    <button
                                        onClick={() => handleRespondToInvite(invite.squadId, 'reject')}
                                        className="btn btn-outline"
                                        style={{ flex: 1, fontSize: '14px', padding: '8px' }}
                                    >
                                        Decline
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Squads Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }} className="animate-fade">
                {[...squads].sort((a, b) => (b.stats?.score || 0) - (a.stats?.score || 0)).map((squad, idx) => (
                    <div
                        key={squad.id}
                        className="bet-card"
                        style={{
                            padding: '20px', cursor: 'pointer', display: 'flex', flexDirection: 'column',
                            animationDelay: `${idx * 0.05}s`
                        }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', gap: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                                {squad.image ? (
                                    <img src={squad.image} alt={squad.name} style={{ width: '40px', height: '40px', borderRadius: '8px', objectFit: 'cover', flexShrink: 0 }} />
                                ) : (
                                    <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: 'var(--bg-card)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border)', flexShrink: 0 }}>
                                        <Shield size={20} style={{ color: 'var(--primary)' }} />
                                    </div>
                                )}
                                <div style={{ minWidth: 0 }}>
                                    <h3 style={{ fontSize: '20px', fontWeight: 'bold', color: '#fff', margin: 0, lineHeight: 1.2 }}>
                                        {squad.name}
                                        {squadRanks[squad.id] && (
                                            <span style={{
                                                fontSize: '11px', fontWeight: 'bold',
                                                background: squadRanks[squad.id] === 1 ? '#eab308' : squadRanks[squad.id] === 2 ? '#94a3b8' : squadRanks[squad.id] === 3 ? '#b45309' : 'rgba(255,255,255,0.1)',
                                                color: squadRanks[squad.id] <= 3 ? '#000' : 'var(--text-muted)',
                                                padding: '2px 8px', borderRadius: '12px', verticalAlign: 'middle', marginLeft: '8px', display: 'inline-block'
                                            }}>
                                                #{squadRanks[squad.id]}
                                            </span>
                                        )}
                                    </h3>
                                </div>
                            </div>
                            <span style={{
                                fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', padding: '4px 8px', borderRadius: '4px',
                                border: squad.privacy === 'open' ? '1px solid rgba(34, 197, 94, 0.3)' : squad.privacy === 'request' ? '1px solid rgba(234, 179, 8, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)',
                                background: squad.privacy === 'open' ? 'rgba(34, 197, 94, 0.1)' : squad.privacy === 'request' ? 'rgba(234, 179, 8, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                color: squad.privacy === 'open' ? '#4ade80' : squad.privacy === 'request' ? '#facc15' : '#f87171',
                                flexShrink: 0
                            }}>
                                {squad.privacy.replace('-', ' ')}
                            </span>
                        </div>

                        <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '24px', flex: 1, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                            {squad.description || 'No description provided.'}
                        </p>

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '14px', color: 'var(--text-muted)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <Users size={16} style={{ color: 'var(--primary)' }} />
                                    <span>{squad.members.length}</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <Trophy size={16} style={{ color: '#eab308' }} />
                                    <span style={{ fontWeight: 'bold', color: '#fff' }}>{squad.stats?.score || 0}</span>
                                </div>
                            </div>

                            <button
                                onClick={() => handleJoin(squad.id, squad.privacy)}
                                disabled={squad.privacy === 'invite-only' || squad.requests?.some(r => r.userId === user.id)}
                                style={{
                                    padding: '8px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold',
                                    cursor: (squad.privacy === 'invite-only' || squad.requests?.some(r => r.userId === user.id)) ? 'not-allowed' : 'pointer',
                                    background: squad.requests?.some(r => r.userId === user.id) ? 'rgba(234, 179, 8, 0.1)' : squad.privacy === 'invite-only' ? 'rgba(255,255,255,0.05)' : 'rgba(34, 197, 94, 0.1)',
                                    border: squad.requests?.some(r => r.userId === user.id) ? '1px solid rgba(234, 179, 8, 0.3)' : squad.privacy === 'invite-only' ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(34, 197, 94, 0.3)',
                                    color: squad.requests?.some(r => r.userId === user.id) ? '#eab308' : squad.privacy === 'invite-only' ? 'var(--text-muted)' : 'var(--primary)'
                                }}
                            >
                                {squad.requests?.some(r => r.userId === user.id) ? 'REQUEST SENT' :
                                    squad.privacy === 'invite-only' ? 'INVITE ONLY' :
                                        squad.privacy === 'request' ? 'REQUEST JOIN' : 'JOIN'}
                            </button>
                        </div>
                    </div>
                ))}

                {squads.length === 0 && (
                    <div style={{ gridColumn: '1 / -1', padding: '60px 20px', textAlign: 'center', background: 'var(--bg-card)', borderRadius: '12px', border: '1px dashed var(--border)' }}>
                        <Users size={48} style={{ margin: '0 auto 16px', color: 'var(--text-muted)', opacity: 0.5 }} />
                        <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#fff', marginBottom: '8px' }}>No Squads Found</h3>
                        <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '24px' }}>Be the pioneer! Create the first squad and start your legacy.</p>
                        <button onClick={() => setShowCreateModal(true)} className="btn btn-primary" style={{ width: 'auto', display: 'inline-flex' }}>
                            Create First Squad
                        </button>
                    </div>
                )}
            </div>
        </div>
    );

    const renderSquadDetail = () => {
        if (!mySquad) return <div style={{ padding: '40px', textAlign: 'center', color: 'var(--accent-loss)' }}>Squad data missing. Try refreshing.</div>;

        const isLeader = mySquad.leaderId === user.id;

        return (
            <div className="container animate-fade" style={{ paddingBottom: '120px' }}>
                {/* Header Card */}
                <div className="card" style={{
                    padding: '0', marginBottom: '24px', overflow: 'hidden', position: 'relative',
                    background: 'linear-gradient(135deg, #09090b 0%, #18181b 100%)',
                    border: '1px solid rgba(34, 197, 94, 0.3)',
                    boxShadow: '0 0 30px rgba(34, 197, 94, 0.1)'
                }}>
                    <div style={{
                        position: 'absolute', top: 0, right: 0, width: '70%', height: '100%',
                        background: 'radial-gradient(circle at 100% 0%, rgba(34, 197, 94, 0.15), transparent 70%)',
                        pointerEvents: 'none'
                    }} />

                    <div style={{ padding: '24px', position: 'relative', zIndex: 10 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                            {/* Top Row: Info & Stats */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', flexWrap: 'wrap', gap: '24px' }}>
                                {/* Left: Image & Name */}
                                <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flex: '1 1 300px' }}>
                                    <div style={{
                                        width: '80px', height: '80px', borderRadius: '16px',
                                        background: 'linear-gradient(135deg, #22c55e, #14532d)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: '32px', fontWeight: 'bold', color: '#fff',
                                        boxShadow: '0 4px 12px rgba(34, 197, 94, 0.3)', flexShrink: 0
                                    }}>
                                        {mySquad.image ? <img src={mySquad.image} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '16px' }} /> : mySquad.name[0]}
                                    </div>
                                    <div style={{ minWidth: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                            <h2 style={{ fontSize: '24px', fontWeight: 'bold', lineHeight: 1.2, wordBreak: 'break-word', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                {mySquad.name}
                                                {squadRanks[mySquad.id] && (
                                                    <span style={{
                                                        fontSize: '12px', fontWeight: 'bold', whiteSpace: 'nowrap',
                                                        background: squadRanks[mySquad.id] === 1 ? '#eab308' : squadRanks[mySquad.id] === 2 ? '#94a3b8' : squadRanks[mySquad.id] === 3 ? '#b45309' : 'rgba(255,255,255,0.1)',
                                                        color: squadRanks[mySquad.id] <= 3 ? '#000' : 'var(--text-muted)',
                                                        padding: '4px 8px', borderRadius: '12px'
                                                    }}>
                                                        #{squadRanks[mySquad.id]}
                                                    </span>
                                                )}
                                            </h2>
                                            {/* Privacy Badge */}
                                            {mySquad.privacy === 'invite-only' && <span style={{ fontSize: '10px', background: 'rgba(234, 179, 8, 0.2)', color: '#eab308', padding: '2px 8px', borderRadius: '12px', whiteSpace: 'nowrap' }}>Invite Only</span>}
                                            {mySquad.privacy === 'request' && <span style={{ fontSize: '10px', background: 'rgba(234, 179, 8, 0.2)', color: '#eab308', padding: '2px 8px', borderRadius: '12px', whiteSpace: 'nowrap' }}>Request Only</span>}
                                        </div>
                                        <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px', lineHeight: 1.4 }}>
                                            {mySquad.description || 'No description yet.'}
                                        </p>
                                    </div>
                                </div>

                                {/* Right: Stats */}
                                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', flex: '1 1 auto', justifyContent: 'flex-start' }}>
                                    <div style={{ background: 'rgba(0,0,0,0.4)', padding: '12px 16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', flex: '1 1 100px' }}>
                                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px', whiteSpace: 'nowrap' }}>Squad Score</div>
                                        <div style={{ fontSize: '18px', fontWeight: 'bold', color: 'var(--primary)' }}>
                                            {squadStats?.score || mySquad.stats?.score || 0}
                                        </div>
                                    </div>
                                    <div style={{ background: 'rgba(0,0,0,0.4)', padding: '12px 16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', flex: '1 1 100px' }}>
                                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px', whiteSpace: 'nowrap' }}>Members</div>
                                        <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#fff' }}>{mySquad.members?.length || 0}</div>
                                    </div>
                                </div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '20px', flexWrap: 'wrap', gap: '16px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: '#6b7280' }}>
                                    <Crown size={16} style={{ color: '#eab308' }} />
                                    <span>Leader: <span style={{ color: '#fff', fontWeight: '600' }}>{mySquad.memberDetails?.find(m => m.id === mySquad.leaderId)?.username || 'Unknown'}</span></span>
                                </div>

                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                    {isLeader && (
                                        <>
                                            <button
                                                onClick={() => setShowInviteModal(true)}
                                                style={{
                                                    background: 'var(--primary)', color: '#000',
                                                    border: 'none',
                                                    padding: '8px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold',
                                                    display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', flex: '1 1 auto', justifyContent: 'center'
                                                }}
                                            >
                                                <UserPlus size={14} /> INVITE
                                            </button>
                                            <button
                                                onClick={openSettings}
                                                style={{
                                                    background: 'rgba(255, 255, 255, 0.05)', color: '#fff',
                                                    border: '1px solid rgba(255, 255, 255, 0.1)',
                                                    padding: '8px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold',
                                                    display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', flex: '1 1 auto', justifyContent: 'center'
                                                }}
                                            >
                                                <Settings size={14} /> SETTINGS
                                            </button>
                                        </>
                                    )}
                                    <button
                                        onClick={handleLeave}
                                        style={{
                                            background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444',
                                            border: '1px solid rgba(239, 68, 68, 0.2)',
                                            padding: '8px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold',
                                            display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', flex: '1 1 auto', justifyContent: 'center'
                                        }}
                                    >
                                        <LogOut size={14} /> {isLeader ? 'DISBAND' : 'LEAVE'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', paddingBottom: '8px', overflowX: 'auto' }}>
                    {['overview', 'members', 'parlays'].map(tab => {
                        const active = activeTab === tab;
                        return (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                style={{
                                    padding: '10px 20px', borderRadius: '8px', fontSize: '14px', fontWeight: 'bold',
                                    textTransform: 'capitalize', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
                                    background: active ? 'var(--primary)' : 'transparent',
                                    color: active ? '#000' : 'var(--text-muted)',
                                    display: 'flex', alignItems: 'center', gap: '8px'
                                }}
                            >
                                {tab}
                                {tab === 'requests' && (mySquad.requests?.length > 0) && (
                                    <span style={{
                                        background: '#ef4444', color: '#fff', fontSize: '10px',
                                        padding: '2px 6px', borderRadius: '10px', fontWeight: 'bold'
                                    }}>
                                        {mySquad.requests.length}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>

                <div className="animate-fade">
                    {/* Overview Tab */}
                    {activeTab === 'overview' && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
                            <div className="card bet-card" style={{ padding: '0', overflow: 'hidden' }}>
                                <div style={{ padding: '24px', background: 'linear-gradient(to bottom right, rgba(255,255,255,0.05), transparent)' }}>
                                    <h3 style={{ fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <Wallet size={16} style={{ color: 'var(--primary)' }} /> Squad Wallet
                                    </h3>
                                    <div style={{ textAlign: 'center', padding: '20px 0' }}>
                                        <div style={{ fontSize: '48px', fontWeight: '900', color: '#fff', marginBottom: '8px' }}>
                                            ${(mySquad.wallet?.balance || 0).toLocaleString()}
                                        </div>
                                        <div style={{ fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Available Funds</div>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '16px' }}>
                                        <button
                                            onClick={openDepositModal}
                                            style={{ padding: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                                            Deposit
                                        </button>
                                        <button
                                            onClick={openWithdrawModal}
                                            style={{ padding: '12px', background: isLeader ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.1)', color: isLeader ? '#fff' : 'var(--text-muted)', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                                            {isLeader ? 'Withdraw' : 'Request Funds'}
                                        </button>
                                    </div>

                                    {/* Withdrawal Requests (Leader Only) */}
                                    {isLeader && mySquad.withdrawalRequests?.length > 0 && (
                                        <div style={{ marginTop: '16px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '16px' }}>
                                            <h4 style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-muted)', marginBottom: '12px', textTransform: 'uppercase' }}>Withdrawal Requests</h4>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                {mySquad.withdrawalRequests.map((req) => (
                                                    <div key={req.id} style={{
                                                        background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px',
                                                        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                                                    }}>
                                                        <div>
                                                            <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#fff' }}>
                                                                {req.username} <span style={{ color: 'var(--text-muted)', fontWeight: 'normal' }}>requested</span> ${req.amount.toLocaleString()}
                                                            </div>
                                                            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                                                "{req.reason}"
                                                            </div>
                                                        </div>
                                                        <div style={{ display: 'flex', gap: '8px' }}>
                                                            <button
                                                                onClick={() => {
                                                                    if (confirm(`Approve withdrawal of $${req.amount} for ${req.username}?`))
                                                                        respondToWithdrawalRequest(mySquad.id, req, true);
                                                                }}
                                                                style={{ padding: '6px', background: 'rgba(34, 197, 94, 0.2)', color: '#4ade80', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                                                                title="Approve"
                                                            >
                                                                <Check size={16} />
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    if (confirm(`Deny withdrawal?`))
                                                                        respondToWithdrawalRequest(mySquad.id, req, false);
                                                                }}
                                                                style={{ padding: '6px', background: 'rgba(239, 68, 68, 0.2)', color: '#f87171', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                                                                title="Deny"
                                                            >
                                                                <X size={16} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="card bet-card" style={{ padding: '24px' }}>
                                <h3 style={{ fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Trophy size={16} style={{ color: '#eab308' }} /> Squad Stats
                                </h3>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                    <div style={{ background: 'rgba(0,0,0,0.3)', padding: '16px', borderRadius: '12px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.05)' }}>
                                        <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#fff' }}>{squadStats?.bets || 0}</div>
                                        <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)', marginTop: '4px' }}>Bets</div>
                                    </div>
                                    <div style={{ background: 'rgba(0,0,0,0.3)', padding: '16px', borderRadius: '12px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.05)' }}>
                                        <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#fff' }}>{squadStats?.winRate || 0}%</div>
                                        <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)', marginTop: '4px' }}>Win Rate</div>
                                    </div>
                                    <div style={{ background: 'rgba(0,0,0,0.3)', padding: '16px', borderRadius: '12px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.05)' }}>
                                        <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#fff' }}>{squadStats?.wins || 0}</div>
                                        <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)', marginTop: '4px' }}>Wins</div>
                                    </div>
                                    <div style={{ background: 'rgba(0,0,0,0.3)', padding: '16px', borderRadius: '12px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.05)' }}>
                                        <div style={{ fontSize: '24px', fontWeight: 'bold', color: (squadStats?.profit || 0) >= 0 ? '#4ade80' : '#ef4444' }}>
                                            ${(squadStats?.profit || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </div>
                                        <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)', marginTop: '4px' }}>Profit</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Members Tab */}
                    {activeTab === 'members' && (
                        <div className="card bet-card" style={{ padding: 0, overflow: 'hidden' }}>
                            {/* Requests Section (Moved here) */}
                            {isLeader && mySquad.requests?.length > 0 && (
                                <div style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', background: 'rgba(234, 179, 8, 0.05)' }}>
                                    <div style={{ padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#eab308' }} />
                                            <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: '#eab308', textTransform: 'uppercase' }}>
                                                Pending Requests ({mySquad.requests.length})
                                            </h3>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                        {mySquad.requests.map((req) => (
                                            <div key={req.userId} style={{
                                                padding: '16px 24px', borderTop: '1px solid rgba(255,255,255,0.05)',
                                                display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px'
                                            }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                                                    <div style={{
                                                        width: '32px', height: '32px', borderRadius: '50%', background: '#333',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: '#9ca3af', flexShrink: 0
                                                    }}>
                                                        {req.username[0]}
                                                    </div>
                                                    <div style={{ minWidth: 0 }}>
                                                        <div style={{ fontWeight: 'bold', color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{req.username}</div>
                                                        <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                                                            {new Date(req.requestedAt).toLocaleDateString()}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                                                    <button
                                                        onClick={() => handleRequest(req.userId, 'accept')}
                                                        style={{
                                                            padding: '6px', background: 'rgba(34, 197, 94, 0.2)', color: '#4ade80',
                                                            border: '1px solid rgba(34, 197, 94, 0.3)', borderRadius: '6px', cursor: 'pointer'
                                                        }}
                                                    >
                                                        <Check size={16} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleRequest(req.userId, 'reject')}
                                                        style={{
                                                            padding: '6px', background: 'rgba(239, 68, 68, 0.2)', color: '#f87171',
                                                            border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '6px', cursor: 'pointer'
                                                        }}
                                                    >
                                                        <X size={16} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div style={{
                                padding: '16px 24px', borderBottom: '1px solid rgba(255,255,255,0.05)',
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)'
                            }}>
                                <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Squad Roster</h3>
                                {isLeader && (
                                    <button
                                        onClick={() => setShowInviteModal(true)}
                                        style={{
                                            padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold',
                                            background: 'var(--primary)', color: '#000', border: 'none', cursor: 'pointer',
                                            display: 'flex', alignItems: 'center', gap: '6px'
                                        }}
                                    >
                                        <UserPlus size={14} /> Invite Member
                                    </button>
                                )}
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                {mySquad.memberDetails?.map((member, idx) => (
                                    <div key={member.id} style={{
                                        padding: '16px 24px',
                                        borderBottom: idx === mySquad.memberDetails.length - 1 ? 'none' : '1px solid rgba(255,255,255,0.05)',
                                        display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px'
                                    }}>
                                        {/* Left: User Info */}
                                        <div
                                            onClick={() => setViewingUser(member)}
                                            style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', flex: 1, minWidth: 0 }}
                                        >
                                            <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#374151', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)', flexShrink: 0 }}>
                                                {member.profilePic ?
                                                    <img src={member.profilePic} alt={member.username} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> :
                                                    <span style={{ fontSize: '14px', fontWeight: 'bold' }}>{member.username[0].toUpperCase()}</span>
                                                }
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                                                <span style={{ fontWeight: 'bold', fontSize: '14px', color: member.id === user.id ? 'var(--primary)' : '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                    {member.username}
                                                </span>
                                                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                                                    Joined Today
                                                </span>
                                            </div>
                                        </div>

                                        {/* Right: Badge & Actions */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                                            <span style={{
                                                fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', padding: '4px 8px', borderRadius: '12px',
                                                background: member.role === 'leader' ? 'rgba(234, 179, 8, 0.1)' : member.role === 'top_dog' ? 'rgba(168, 85, 247, 0.1)' : 'rgba(255,255,255,0.05)',
                                                color: member.role === 'leader' ? '#eab308' : member.role === 'top_dog' ? '#a855f7' : 'var(--text-muted)',
                                                border: member.role === 'leader' ? '1px solid rgba(234, 179, 8, 0.2)' : member.role === 'top_dog' ? '1px solid rgba(168, 85, 247, 0.2)' : 'none'
                                            }}>
                                                {member.role === 'top_dog' ? 'Top Dog' : member.role}
                                            </span>

                                            {isLeader && member.id !== user.id && (
                                                <div style={{ display: 'flex', gap: '8px' }}>
                                                    {member.role === 'top_dog' && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                if (window.confirm(`Promote ${member.username} to Leader? You will become a Top Dog.`)) {
                                                                    transferSquadLeadership(mySquad.id, member.id);
                                                                }
                                                            }}
                                                            style={{
                                                                background: 'rgba(234, 179, 8, 0.1)', color: '#eab308',
                                                                border: '1px solid rgba(234, 179, 8, 0.2)',
                                                                cursor: 'pointer', padding: '6px',
                                                                borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center'
                                                            }}
                                                            title="Promote to Leader"
                                                        >
                                                            <Crown size={14} />
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            const newRole = member.role === 'top_dog' ? 'member' : 'top_dog';
                                                            updateMemberRole(mySquad.id, member.id, newRole);
                                                        }}
                                                        style={{
                                                            background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6',
                                                            border: '1px solid rgba(59, 130, 246, 0.2)',
                                                            cursor: 'pointer', padding: '6px',
                                                            borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center'
                                                        }}
                                                        title={member.role === 'top_dog' ? "Demote to Member" : "Promote to Top Dog"}
                                                    >
                                                        {member.role === 'top_dog' ? <ArrowDown size={14} /> : <ArrowUp size={14} />}
                                                    </button>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            if (window.confirm(`Kick ${member.username}?`)) {
                                                                handleKick(member.id);
                                                            }
                                                        }}
                                                        style={{
                                                            background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444',
                                                            border: '1px solid rgba(239, 68, 68, 0.2)',
                                                            cursor: 'pointer', padding: '6px',
                                                            borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center'
                                                        }}
                                                        title="Kick Member"
                                                    >
                                                        <X size={14} />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Parlays Tab (Placeholder) */}
                    {activeTab === 'parlays' && (
                        <div style={{
                            padding: '60px 20px', textAlign: 'center', background: 'rgba(255,255,255,0.02)',
                            borderRadius: '16px', border: '1px dashed rgba(255,255,255,0.1)'
                        }}>
                            <div style={{
                                width: '64px', height: '64px', borderRadius: '50%', background: 'linear-gradient(135deg, rgba(34,197,94,0.2), transparent)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px',
                                boxShadow: 'inset 0 0 20px rgba(0,0,0,0.5)'
                            }}>
                                <span style={{ fontSize: '32px' }}>🎟️</span>
                            </div>
                            <h3 style={{ fontSize: '20px', fontWeight: 'bold', color: '#fff', marginBottom: '8px' }}>Squad Parlays</h3>
                            <p style={{ color: 'var(--text-muted)', maxWidth: '400px', margin: '0 auto 24px' }}>
                                Combine bets with your squad for massive multipliers.
                            </p>
                            <button className="btn btn-outline" disabled style={{ opacity: 0.5, cursor: 'not-allowed', width: 'auto', display: 'inline-block', padding: '10px 24px', fontSize: '13px' }}>
                                Coming Soon
                            </button>
                        </div>
                    )}


                </div>
            </div>
        );
    }

    return (
        <div style={{ minHeight: '100vh', background: 'var(--bg-app)', color: '#fff', paddingBottom: '80px' }}>
            <Navbar />
            {/* Main Tabs */}
            {/* Main Tabs */}
            <div className="container" style={{ marginTop: '24px' }}>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', background: 'var(--bg-card)', padding: '4px', borderRadius: '12px' }}>
                    {(user.squadId ? ['my_squad', 'leaderboard'] : ['leaderboard', 'browse']).map((mode) => (
                        <button
                            key={mode}
                            onClick={() => setSquadMode(mode)}
                            className="btn"
                            style={{
                                flex: 1,
                                background: squadMode === mode ? 'rgba(34, 197, 94, 0.15)' : 'transparent',
                                color: squadMode === mode ? 'var(--primary)' : 'var(--text-muted)',
                                border: squadMode === mode ? '1px solid var(--primary)' : '1px solid transparent',
                                fontWeight: 'bold',
                                fontSize: '14px',
                                padding: '10px',
                                textTransform: 'capitalize'
                            }}
                        >
                            {mode.replace('_', ' ')}
                        </button>
                    ))}
                </div>
            </div>

            <div style={{ minHeight: '80vh' }}>
                {squadMode === 'my_squad' && (user.squadId ? renderSquadDetail() : (
                    <div style={{ textAlign: 'center', marginTop: '60px', padding: '20px' }}>
                        <Users size={64} style={{ color: 'var(--text-muted)', marginBottom: '24px', opacity: 0.5 }} />
                        <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '16px' }}>You are not in a squad yet.</h2>
                        <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>Join a squad to compete, pool funds, and win together!</p>
                        <button onClick={() => setSquadMode('browse')} className="btn btn-primary">Browse Squads</button>
                    </div>
                ))}

                {squadMode === 'leaderboard' && (
                    <div className="container" style={{ paddingBottom: '20px' }}>
                        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                            <Trophy size={48} style={{ color: '#eab308', margin: '0 auto 16px' }} />
                            <h2 style={{ fontSize: '24px', fontWeight: 'bold' }}>Squad Leaderboard</h2>
                            <p style={{ color: 'var(--text-muted)' }}>Top squads by total score</p>
                        </div>

                        <div style={{ display: 'grid', gap: '12px' }}>
                            {[...squads].filter(s => (s.stats?.score || 0) > 0).sort((a, b) => (b.stats?.score || 0) - (a.stats?.score || 0)).map((squad, index) => (
                                <div key={squad.id}
                                    onClick={() => setViewingSquad(squad)}
                                    className="card" style={{
                                        cursor: 'pointer',
                                        padding: '16px',
                                        display: 'flex', alignItems: 'center', gap: '16px',
                                        border: index < 3 ? `1px solid ${index === 0 ? '#eab308' : index === 1 ? '#94a3b8' : '#b45309'}` : '1px solid rgba(255,255,255,0.05)',
                                        background: index < 3 ? `linear-gradient(90deg, ${index === 0 ? 'rgba(234, 179, 8, 0.1)' : index === 1 ? 'rgba(148, 163, 184, 0.1)' : 'rgba(180, 83, 9, 0.1)'}, transparent)` : 'var(--bg-card)'
                                    }}>
                                    <div style={{
                                        width: '32px', height: '32px', borderRadius: '50%',
                                        background: index === 0 ? '#eab308' : index === 1 ? '#94a3b8' : index === 2 ? '#b45309' : '#333',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: index < 3 ? '#000' : '#fff',
                                        flexShrink: 0
                                    }}>
                                        {index + 1}
                                    </div>

                                    <div style={{ width: '48px', height: '48px', borderRadius: '8px', overflow: 'hidden', background: '#333', flexShrink: 0 }}>
                                        {squad.image ?
                                            <img src={squad.image} alt={squad.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> :
                                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', fontWeight: 'bold', color: 'rgba(255,255,255,0.2)' }}>
                                                {squad.name[0].toUpperCase()}
                                            </div>
                                        }
                                    </div>

                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: 'bold', fontSize: '16px', color: '#fff' }}>{squad.name}</div>
                                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span>{squad.members.length} Members</span>
                                            <span>•</span>
                                            <span>{squad.privacy.replace('-', ' ')}</span>
                                        </div>
                                    </div>

                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#eab308' }}>
                                            {squad.stats?.score || 0}
                                        </div>
                                        <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>SCORE</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {squadMode === 'browse' && renderSquadList()}
            </div>
            {showCreateModal && renderCreateModal()}
            {showSettingsModal && renderSettingsModal()}
            {showInviteModal && renderInviteModal()}

            {/* Squad Details Modal (from Leaderboard) */}
            {viewingSquad && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
                    background: 'rgba(0,0,0,0.85)', zIndex: 1100,
                    display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px'
                }} onClick={() => setViewingSquad(null)}>
                    <div className="animate-fade" style={{ background: 'var(--bg-card)', padding: '24px', borderRadius: '16px', width: '100%', maxWidth: '400px', border: '1px solid var(--primary)', position: 'relative' }} onClick={e => e.stopPropagation()}>
                        <button
                            onClick={() => setViewingSquad(null)}
                            style={{ position: 'absolute', top: '12px', right: '12px', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                        >
                            <X size={24} />
                        </button>

                        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                            <div style={{
                                width: '80px', height: '80px', borderRadius: '16px', margin: '0 auto 16px',
                                background: '#333', overflow: 'hidden',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px', fontWeight: 'bold'
                            }}>
                                {viewingSquad.image ? <img src={viewingSquad.image} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : viewingSquad.name[0]}
                            </div>
                            <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '8px', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                {viewingSquad.name}
                                {squadRanks[viewingSquad.id] && (
                                    <span style={{
                                        fontSize: '11px', fontWeight: 'bold',
                                        background: squadRanks[viewingSquad.id] === 1 ? '#eab308' : squadRanks[viewingSquad.id] === 2 ? '#94a3b8' : squadRanks[viewingSquad.id] === 3 ? '#b45309' : 'rgba(255,255,255,0.1)',
                                        color: squadRanks[viewingSquad.id] <= 3 ? '#000' : 'var(--text-muted)',
                                        padding: '2px 8px', borderRadius: '12px', verticalAlign: 'middle'
                                    }}>
                                        #{squadRanks[viewingSquad.id]}
                                    </span>
                                )}
                            </h2>
                            <span style={{
                                fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase', padding: '4px 8px', borderRadius: '4px',
                                border: viewingSquad.privacy === 'open' ? '1px solid rgba(34, 197, 94, 0.3)' : viewingSquad.privacy === 'request' ? '1px solid rgba(234, 179, 8, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)',
                                background: viewingSquad.privacy === 'open' ? 'rgba(34, 197, 94, 0.1)' : viewingSquad.privacy === 'request' ? 'rgba(234, 179, 8, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                color: viewingSquad.privacy === 'open' ? '#4ade80' : viewingSquad.privacy === 'request' ? '#facc15' : '#f87171',
                            }}>
                                {viewingSquad.privacy.replace('-', ' ')}
                            </span>
                        </div>

                        <p style={{ color: 'var(--text-muted)', marginBottom: '24px', textAlign: 'center' }}>
                            {viewingSquad.description || 'No description.'}
                        </p>

                        <div style={{ display: 'flex', justifyContent: 'space-around', marginBottom: '24px', padding: '16px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px' }}>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontWeight: 'bold', fontSize: '18px', color: '#fff' }}>{viewingSquad.members.length}</div>
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>MEMBERS</div>
                            </div>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontWeight: 'bold', fontSize: '18px', color: '#eab308' }}>{viewingSquad.stats?.score || 0}</div>
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>SCORE</div>
                            </div>
                        </div>

                        <button
                            onClick={() => {
                                handleJoin(viewingSquad.id, viewingSquad.privacy);
                                setViewingSquad(null);
                            }}
                            disabled={viewingSquad.privacy === 'invite-only' || viewingSquad.requests?.some(r => r.userId === user.id) || user.squadId === viewingSquad.id}
                            className="btn btn-primary"
                            style={{ width: '100%', opacity: (viewingSquad.privacy === 'invite-only' || viewingSquad.requests?.some(r => r.userId === user.id) || user.squadId === viewingSquad.id) ? 0.5 : 1 }}
                        >
                            {user.squadId === viewingSquad.id ? 'ALREADY JOINED' :
                                viewingSquad.requests?.some(r => r.userId === user.id) ? 'REQUEST SENT' :
                                    viewingSquad.privacy === 'invite-only' ? 'INVITE ONLY' :
                                        viewingSquad.privacy === 'request' ? 'REQUEST JOIN' : 'JOIN SQUAD'}
                        </button>
                    </div>
                </div>
            )}

            {/* --- Public User Profile Modal --- */}
            {viewingUser && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
                    background: 'rgba(0,0,0,0.85)', zIndex: 1100,
                    display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px'
                }} onClick={() => setViewingUser(null)}>
                    <div className="animate-fade" style={{ background: 'var(--bg-card)', padding: '24px', borderRadius: '16px', width: '100%', maxWidth: '350px', border: '1px solid var(--primary)', position: 'relative' }} onClick={e => e.stopPropagation()}>
                        <button
                            onClick={() => setViewingUser(null)}
                            style={{ position: 'absolute', top: '10px', right: '10px', background: 'none', border: 'none', color: '#fff', fontSize: '20px', cursor: 'pointer' }}
                        >
                            <X size={24} />
                        </button>

                        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                            <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'var(--bg-input)', margin: '0 auto 12px', overflow: 'hidden', border: '2px solid var(--primary)' }}>
                                {viewingProfile?.profile?.profilePic ? (
                                    <img src={viewingProfile.profile.profilePic} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                                ) : (
                                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px' }}>
                                        {(viewingProfile?.profile?.username || viewingUser.username || '?').charAt(0).toUpperCase()}
                                    </div>
                                )}
                            </div>
                            <h2 style={{ fontSize: '20px', marginBottom: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                {viewingProfile?.profile?.username || viewingUser.username}
                                {viewingProfile?.profile?.groups?.includes('Moderator') && (
                                    <span title="Official Moderator" style={{
                                        fontSize: '10px',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        background: 'linear-gradient(135deg, #3b82f6, #1e40af)',
                                        color: '#fff',
                                        padding: '1px 5px',
                                        borderRadius: '8px',
                                        fontWeight: '900',
                                        letterSpacing: '0.5px',
                                        border: '1px solid rgba(59, 130, 246, 0.5)',
                                        boxShadow: '0 0 8px rgba(59, 130, 246, 0.3)',
                                        verticalAlign: 'middle',
                                        lineHeight: '1'
                                    }}>MOD ✓</span>
                                )}
                            </h2>
                            {viewingProfile?.profile?.bio && (
                                <p style={{ fontSize: '13px', color: '#a1a1aa', fontStyle: 'italic', margin: '0 0 16px 0' }}>
                                    "{viewingProfile.profile.bio}"
                                </p>
                            )}

                            {viewingProfile?.stats ? (
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '16px' }}>
                                    <div style={{ background: 'var(--bg-input)', padding: '12px', borderRadius: '8px' }}>
                                        <div style={{ fontSize: '14px' }}>Win Rate</div>
                                        <div style={{ fontSize: '18px', fontWeight: 'bold', color: 'var(--primary)' }}>{viewingProfile.stats.winRate}%</div>
                                    </div>
                                    <div style={{ background: 'var(--bg-input)', padding: '12px', borderRadius: '8px' }}>
                                        <div style={{ fontSize: '14px' }}>Profit</div>
                                        <div style={{ fontSize: '18px', fontWeight: 'bold', color: viewingProfile.stats.profit >= 0 ? 'var(--primary)' : 'var(--accent-loss)' }}>
                                            ${viewingProfile.stats.profit.toFixed(0)}
                                        </div>
                                    </div>
                                    <div style={{ gridColumn: '1 / -1', background: 'var(--bg-input)', padding: '12px', borderRadius: '8px' }}>
                                        <div style={{ fontSize: '14px' }}>Total Bets</div>
                                        <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#fff' }}>{viewingProfile.stats.total}</div>
                                    </div>
                                </div>
                            ) : <p style={{ fontSize: '14px' }}>Loading stats...</p>}
                        </div>
                    </div>
                </div>
            )}

            {/* Deposit Modal */}
            {showDepositModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
                    <div style={{ background: '#1c1c1c', border: '1px solid #333', borderRadius: '12px', padding: '24px', width: '100%', maxWidth: '400px' }}>
                        <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '16px', color: '#fff' }}>Deposit to Squad</h3>
                        <p style={{ color: 'var(--text-muted)', marginBottom: '16px', fontSize: '14px' }}>
                            Your Wallet Balance: <span style={{ color: '#fff' }}>${user?.wallet?.balance?.toLocaleString() || 0}</span>
                        </p>
                        <form onSubmit={submitDeposit}>
                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>Amount</label>
                                <input
                                    type="number"
                                    value={transactionAmount}
                                    onChange={(e) => setTransactionAmount(e.target.value)}
                                    placeholder="Amount to deposit"
                                    style={{ width: '100%', padding: '12px', borderRadius: '8px', background: 'var(--bg-input)', border: '1px solid var(--border)', color: '#fff' }}
                                    autoFocus
                                />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                <button type="button" onClick={() => setShowDepositModal(false)} style={{ padding: '12px', borderRadius: '8px', background: 'var(--bg-card)', color: '#fff', border: 'none', cursor: 'pointer' }}>Cancel</button>
                                <button type="submit" style={{ padding: '12px', borderRadius: '8px', background: '#22c55e', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>Deposit</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Withdraw Modal */}
            {showWithdrawModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
                    <div style={{ background: '#1c1c1c', border: '1px solid #333', borderRadius: '12px', padding: '24px', width: '100%', maxWidth: '400px' }}>
                        <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '16px', color: '#fff' }}>{isLeader ? 'Withdraw Funds' : 'Request Funds'}</h3>
                        <p style={{ color: 'var(--text-muted)', marginBottom: '16px', fontSize: '14px' }}>
                            Squad Balance: <span style={{ color: '#fff' }}>${mySquad?.wallet?.balance?.toLocaleString() || 0}</span>
                        </p>
                        <form onSubmit={submitWithdraw}>
                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>Amount</label>
                                <input
                                    type="number"
                                    value={transactionAmount}
                                    onChange={(e) => setTransactionAmount(e.target.value)}
                                    placeholder="Amount"
                                    style={{ width: '100%', padding: '12px', borderRadius: '8px', background: 'var(--bg-input)', border: '1px solid var(--border)', color: '#fff' }}
                                    autoFocus
                                />
                            </div>
                            {!isLeader && (
                                <div style={{ marginBottom: '16px' }}>
                                    <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>Reason</label>
                                    <input
                                        type="text"
                                        value={withdrawReason}
                                        onChange={(e) => setWithdrawReason(e.target.value)}
                                        placeholder="Why do you need funds?"
                                        style={{ width: '100%', padding: '12px', borderRadius: '8px', background: 'var(--bg-input)', border: '1px solid var(--border)', color: '#fff' }}
                                    />
                                </div>
                            )}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                <button type="button" onClick={() => setShowWithdrawModal(false)} style={{ padding: '12px', borderRadius: '8px', background: 'var(--bg-card)', color: '#fff', border: 'none', cursor: 'pointer' }}>Cancel</button>
                                <button type="submit" style={{ padding: '12px', borderRadius: '8px', background: isLeader ? '#ef4444' : '#3b82f6', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>
                                    {isLeader ? 'Withdraw' : 'Request'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
