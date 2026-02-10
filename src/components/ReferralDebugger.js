"use client";
import { useState } from 'react';
import { useApp } from '../lib/store';
import { collection, addDoc, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';

export default function ReferralDebugger() {
    const { user, db } = useApp();
    const [testCode, setTestCode] = useState('');
    const [msg, setMsg] = useState('');
    const [loading, setLoading] = useState(false);

    // New State for Lookup
    const [lookupCode, setLookupCode] = useState('');
    const [lookupResult, setLookupResult] = useState(null);
    const [lookupLoading, setLookupLoading] = useState(false);

    // New State for Backfill
    const [bfUserEntry, setBfUserEntry] = useState(''); // Email or Username
    const [bfCode, setBfCode] = useState('');
    const [bfLoading, setBfLoading] = useState(false);
    const [bfMsg, setBfMsg] = useState('');

    // Import query related functions


    const handleSimulate = async () => {
        if (!user) return;
        setLoading(true);
        setMsg('');

        try {
            // Simulate: Create the notification DIRECTLY for the current user
            // This tests 1) Permission to create 'referral_claim' 2) UI display

            console.log("Starting Simulation...");
            await addDoc(collection(db, 'notifications'), {
                userId: user.id,
                type: 'referral_claim',
                title: 'Test Referral Reward!',
                message: `This is a test notification. Anyone can claim this.`,
                amount: 500,
                read: false,
                claimed: false,
                createdAt: new Date().toISOString()
            });
            console.log("Notification payload sent.");
            setMsg('Success! Check your notification bell now.');
        } catch (e) {
            console.error("Simulation Failed", e);
            setMsg('Error: ' + e.message + " (Check console/Firestore Rules)");
        } finally {
            setLoading(false);
        }
    };

    const handleCheckCode = async () => {
        if (!lookupCode.trim()) return;
        setLookupLoading(true);
        setLookupResult(null);

        try {
            const usersRef = collection(db, 'users');
            // Query exactly as signup does
            const q = query(usersRef, where('referralCode', '==', lookupCode.trim().toUpperCase()));
            const snapshot = await getDocs(q);

            if (snapshot.empty) {
                setLookupResult({ found: false, message: `No user found with code "${lookupCode.trim().toUpperCase()}"` });
            } else {
                const userDoc = snapshot.docs[0].data();
                setLookupResult({
                    found: true,
                    username: userDoc.username,
                    email: userDoc.email,
                    id: snapshot.docs[0].id
                });
            }
        } catch (e) {
            console.error(e);
            setLookupResult({ found: false, error: e.message });
        } finally {
            setLookupLoading(false);
        }
    };

    const handleBackfill = async () => {
        if (!bfUserEntry || !bfCode) return;
        setBfLoading(true);
        setBfMsg('');

        try {
            // 1. Find the NEW USER (who signed up)
            const usersRef = collection(db, 'users');
            let qUser = query(usersRef, where('username', '==', bfUserEntry.trim()));
            let snapUser = await getDocs(qUser);

            if (snapUser.empty) {
                // Try email
                qUser = query(usersRef, where('email', '==', bfUserEntry.trim()));
                snapUser = await getDocs(qUser);
            }

            if (snapUser.empty) {
                setBfMsg('❌ User not found (checked email and username).');
                setBfLoading(false);
                return;
            }
            const newUserDoc = snapUser.docs[0];
            const newUserData = newUserDoc.data();

            if (newUserData.referredBy) {
                if (!confirm(`User ${newUserData.username} was already referred by ${newUserData.referredBy}. Overwrite?`)) {
                    setBfLoading(false);
                    return;
                }
            }

            // 2. Find the REFERRER (who owns the code)
            const qCode = query(usersRef, where('referralCode', '==', bfCode.trim().toUpperCase()));
            const snapCode = await getDocs(qCode);

            if (snapCode.empty) {
                setBfMsg('❌ Invalid Referral Code.');
                setBfLoading(false);
                return;
            }
            const referrerDoc = snapCode.docs[0];
            const referrerData = referrerDoc.data();

            if (referrerDoc.id === newUserDoc.id) {
                setBfMsg(`❌ Cannot refer yourself. The user '${newUserData.username}' owns the referral code '${bfCode}'. Are you entering the right code?`);
                setBfLoading(false);
                return;
            }

            // 3. Update New User Link
            await updateDoc(doc(db, 'users', newUserDoc.id), {
                referredBy: referrerDoc.id
            });

            // 4. Send Reward Notification to Referrer
            await addDoc(collection(db, 'notifications'), {
                userId: referrerDoc.id,
                type: 'referral_claim',
                title: 'Referral Fixed / Credited!',
                message: `${newUserData.username} was manually linked to your code. Claim your $500 reward!`,
                amount: 500,
                read: false,
                claimed: false,
                createdAt: new Date().toISOString()
            });

            setBfMsg(`✅ Success! Linked ${newUserData.username} to ${referrerData.username} and sent notification.`);
            setBfUserEntry('');
            setBfCode('');

        } catch (e) {
            console.error(e);
            setBfMsg('Error: ' + e.message);
        } finally {
            setBfLoading(false);
        }
    };

    return (
        <div style={{ marginTop: '30px', padding: '16px', border: '1px solid #333', borderRadius: '8px', background: 'rgba(255, 255, 0, 0.05)' }}>
            <h3 style={{ fontSize: '16px', marginBottom: '8px', color: '#fde047' }}>🛠️ Admin Referral Tools</h3>
            <p style={{ fontSize: '12px', color: '#a1a1aa', marginBottom: '12px' }}>
                Use this to test if the referral notification system is working for your account permissions.
            </p>

            <button
                onClick={handleSimulate}
                disabled={loading}
                style={{
                    padding: '8px 16px',
                    background: '#fde047',
                    color: '#000',
                    border: 'none',
                    borderRadius: '6px',
                    fontWeight: 'bold',
                    cursor: loading ? 'wait' : 'pointer',
                    opacity: loading ? 0.7 : 1
                }}
            >
                {loading ? 'Testing...' : 'Simulate Incoming Referral ($500)'}
            </button>

            {msg && (
                <p style={{
                    marginTop: '8px',
                    fontSize: '13px',
                    color: msg.startsWith('Error') ? '#ef4444' : '#22c55e',
                    fontWeight: 'bold'
                }}>
                    {msg}
                </p>
            )}

            <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid #555' }}>
                <h4 style={{ fontSize: '14px', marginBottom: '8px', color: '#fff' }}>🔎 Test Referral Lookup</h4>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                        type="text"
                        placeholder="Enter Code (e.g. ABC12345)"
                        value={lookupCode}
                        onChange={e => setLookupCode(e.target.value)}
                        style={{ padding: '8px', borderRadius: '4px', border: '1px solid #555', background: '#222', color: '#fff' }}
                    />
                    <button
                        onClick={handleCheckCode}
                        disabled={lookupLoading}
                        style={{ padding: '8px 12px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                    >
                        {lookupLoading ? 'Checking...' : 'Check'}
                    </button>
                </div>

                {lookupResult && (
                    <div style={{ marginTop: '12px', padding: '10px', background: lookupResult.found ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)', borderRadius: '6px' }}>
                        {lookupResult.found ? (
                            <div>
                                <p style={{ color: '#4ade80', fontWeight: 'bold' }}>✅ Owner Found!</p>
                                <p style={{ fontSize: '13px', color: '#bbb' }}>Username: <span style={{ color: '#fff' }}>{lookupResult.username}</span></p>
                                <p style={{ fontSize: '13px', color: '#bbb' }}>Email: <span style={{ color: '#fff' }}>{lookupResult.email}</span></p>
                                <p style={{ fontSize: '10px', color: '#666' }}>ID: {lookupResult.id}</p>
                            </div>
                        ) : (
                            <p style={{ color: '#f87171' }}>❌ {lookupResult.error ? `Error: ${lookupResult.error}` : lookupResult.message}</p>
                        )}
                    </div>
                )}
            </div>

            <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid #555' }}>
                <h4 style={{ fontSize: '14px', marginBottom: '8px', color: '#fff' }}>🔧 Backfill Missed Referral</h4>
                <p style={{ fontSize: '12px', color: '#aaa', marginBottom: '8px' }}>
                    Manually link a user to a referrer and send the $500 reward.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <input
                        type="text"
                        placeholder="The Friend's Email or Username (NOT YOURS)"
                        value={bfUserEntry}
                        onChange={e => setBfUserEntry(e.target.value)}
                        style={{ padding: '8px', borderRadius: '4px', border: '1px solid #555', background: '#222', color: '#fff' }}
                    />
                    <input
                        type="text"
                        placeholder="Referral Code (Your Code)"
                        value={bfCode}
                        onChange={e => setBfCode(e.target.value)}
                        style={{ padding: '8px', borderRadius: '4px', border: '1px solid #555', background: '#222', color: '#fff' }}
                    />
                    <button
                        onClick={handleBackfill}
                        disabled={bfLoading}
                        style={{ padding: '8px', background: '#ec4899', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                    >
                        {bfLoading ? 'Processing...' : 'Link Users & Send Reward'}
                    </button>
                    {bfMsg && <p style={{ fontSize: '13px', fontWeight: 'bold', color: bfMsg.startsWith('Error') || bfMsg.startsWith('❌') ? '#f87171' : '#4ade80' }}>{bfMsg}</p>}
                </div>
            </div>
        </div>
    );
}
