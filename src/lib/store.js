
"use client";
import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import {
  collection, addDoc, onSnapshot, query, orderBy,
  doc, setDoc, updateDoc, getDoc, where, increment, deleteDoc, getDocs, limit, writeBatch, deleteField,
  arrayUnion, arrayRemove
} from 'firebase/firestore';

import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, onAuthStateChanged, updateEmail, updatePassword, verifyBeforeUpdateEmail
} from 'firebase/auth';
import { db, auth } from './firebase';

const AppContext = createContext();

export function useAppContext() {
  return useContext(AppContext);
}

export function AppProvider({ children }) {
  const [user, setUser] = useState(null);
  const [events, setEvents] = useState([]);
  const [bets, setBets] = useState([]);
  const [ideas, setIdeas] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Ref to track if we are currently deleting the account to prevent auto-recreation
  const isDeletingAccount = useRef(false);


  // Create state, init false. We load from storage in a useEffect to allow hydration.
  const [isGuestMode, setIsGuestMode] = useState(false);

  // Load Guest Mode from LocalStorage
  useEffect(() => {
    const stored = localStorage.getItem('isGuestMode');
    if (stored === 'true') setIsGuestMode(true);
  }, []);

  // Save Guest Mode to LocalStorage
  useEffect(() => {
    localStorage.setItem('isGuestMode', isGuestMode);
  }, [isGuestMode]);

  // Safety timeout: If Firebase auth hangs for >1s, just load the app (as signed out) to prevent being stuck.
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoaded(prev => {
        if (!prev) console.warn("Firebase auth slow - forcing load state");
        return true;
      });
    }, 1200);
    return () => clearTimeout(timer);
  }, []);

  // --- 1. Auth & User Profile Listener ---
  useEffect(() => {
    let unsubscribeProfile = null;

    // Auth Listener
    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      // 1. Clean up previous profile listener if any
      if (unsubscribeProfile) {
        unsubscribeProfile();
        unsubscribeProfile = null;
      }

      if (firebaseUser) {
        // User is signed in -> Set basic auth user immediately to prevent logout loop
        // We will enrich this with DB data in a moment
        setUser(prev => prev || {
          id: firebaseUser.uid,
          email: firebaseUser.email,
          username: firebaseUser.displayName || firebaseUser.email.split('@')[0],
          role: 'user',
        });

        // Listen to Firestore Profile
        const userRef = doc(db, 'users', firebaseUser.uid);
        unsubscribeProfile = onSnapshot(userRef, (docSnap) => {
          if (docSnap.exists()) {
            const userData = docSnap.data();

            // Check for missing referral code (Backfill for existing users)
            if (!userData.referralCode) {
              const newCode = Math.random().toString(36).substring(2, 10).toUpperCase();
              updateDoc(userRef, { referralCode: newCode })
                .catch(err => console.error("Error backfilling referral code", err));
              // We don't need to manually update state here, the snapshot will fire again instantly
            }

            setUser({ id: firebaseUser.uid, ...userData });
            setUser({ id: firebaseUser.uid, ...userData });
          } else {
            // Check if we are intentionally deleting the account
            if (isDeletingAccount.current) {
              console.log(">>> ACCOUNT BEING DELETED - Skipping Profile Recreation");
              return;
            }

            // Document does not exist (e.g. first login or previous error).
            console.log(">>> DETECTED NEW USER (No Profile Found) - Creating Profile...");
            // Auto-create the user profile in Firestore

            const myReferralCode = Math.random().toString(36).substring(2, 10).toUpperCase();

            const newUser = {
              email: firebaseUser.email,
              username: firebaseUser.displayName || firebaseUser.email.split('@')[0],
              role: (firebaseUser.email.toLowerCase().includes('admin')) ? 'admin' : 'user',
              balance: 1000,
              createdAt: new Date().toISOString(),
              referralCode: myReferralCode
            };

            // Write to DB
            setDoc(userRef, newUser)
              .then(() => {
                console.log(">>> SUCCESSFULLY CREATED PROFILE FOR:", newUser.email);
                // alert("Welcome! Your profile has been created with $1000.");
              })
              .catch(err => {
                console.error(">>> ERROR CREATING PROFILE:", err);
                alert("Error creating profile. Check permissions.");
              });

            // Set local state
            setUser({ id: firebaseUser.uid, ...newUser });
          }
          setIsLoaded(true);
        });
      } else {
        // User is signed out
        setUser(null);
        setBets([]);
        setIsLoaded(true);
      }
    });

    // Cleanup function when component unmounts
    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) {
        unsubscribeProfile();
      }
    };
  }, []);

  const [users, setUsers] = useState([]); // List of all users for leaderboard
  const [squads, setSquads] = useState([]); // List of all squads
  const [systemAnnouncement, setSystemAnnouncement] = useState(null);

  // ... (existing timeout code) ...

  // --- 2. Data Listeners (Events, Ideas, Users, Announcement) ---
  useEffect(() => {
    // Listen to System Announcement
    const announcementRef = doc(db, 'system', 'announcement');
    const unsubAnnouncement = onSnapshot(announcementRef, (docSnap) => {
      if (docSnap.exists()) {
        setSystemAnnouncement(docSnap.data());
      } else {
        setSystemAnnouncement(null);
      }
    });

    // Listen to Events (Limit 50 active)
    const eventsQuery = query(collection(db, 'events'), limit(50));
    const unsubEvents = onSnapshot(eventsQuery, (snapshot) => {
      const eventsList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      eventsList.sort((a, b) => {
        // 1. Sort by manual order if exists (ascending: low numbers first)
        const orderA = a.order !== undefined ? a.order : 9999;
        const orderB = b.order !== undefined ? b.order : 9999;
        if (orderA !== orderB) return orderA - orderB;

        // 2. Open events first
        if (a.status === 'open' && b.status !== 'open') return -1;
        if (a.status !== 'open' && b.status === 'open') return 1;

        // 3. Then sort by startAt date (ascending: earliest date first)
        return new Date(a.startAt) - new Date(b.startAt);
      });
      setEvents(eventsList);
    });

    // Listen to Ideas (Limit 50 recent)
    // Removed orderBy to avoid missing index issues. Sorting client-side.
    const ideasQuery = query(collection(db, 'ideas'), limit(50));
    const unsubIdeas = onSnapshot(ideasQuery, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      list.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
      setIdeas(list);
    }, (error) => {
      console.error("Error listening to ideas:", error);
    });

    // Listen to Users (Global List for Leaderboard & Admin)
    const usersQuery = query(collection(db, 'users'), limit(50));
    const unsubUsers = onSnapshot(usersQuery, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Client-side sort by balance desc
      list.sort((a, b) => (b.balance || 0) - (a.balance || 0));
      setUsers(list);
    });

    // Listen to Squads (No limit for now, squads are important)
    const squadsQuery = query(collection(db, 'squads'));
    const unsubSquads = onSnapshot(squadsQuery, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Sort: My squad first? Or by size? Or by name? lets do by size (members count)
      list.sort((a, b) => (b.members?.length || 0) - (a.members?.length || 0));
      setSquads(list);
    });

    return () => {
      unsubEvents();
      unsubIdeas();
      unsubUsers();
      unsubSquads();
    };


  }, []);

  // --- 3. Bets Listener (Only for logged in user) ---
  useEffect(() => {
    if (!user) {
      setBets([]);
      return;
    }

    const betsQuery = query(collection(db, 'bets'), where('userId', '==', user.id), limit(100));
    const unsubBets = onSnapshot(betsQuery, (snapshot) => {
      // We'll trust the client side sorting for now or add orderBy index later
      const myBets = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      myBets.sort((a, b) => new Date(b.placedAt) - new Date(a.placedAt));
      setBets(myBets);
      // localStorage.setItem('bet_bets_cache', JSON.stringify(myBets));
    });

    return () => unsubBets();
  }, [user?.id]); // Only re-run if user ID changes is tricky, better safe dependency

  // --- 4. Notifications Listener ---
  useEffect(() => {
    if (!user) {
      setNotifications([]);
      return;
    }
    const q = query(collection(db, 'notifications'), where('userId', '==', user.id), limit(20));
    const unsub = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      // Sort by date desc (client side)
      list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setNotifications(list);
    });
    return () => unsub();
  }, [user?.id]);

  // --- 5. Manual Parlay Calculation (For retroactive fixes) ---
  const calculateParlays = async () => {
    if (!user || user.role !== 'admin') return { success: false, error: 'Unauthorized' };

    try {
      // FIX: Query ALL parlays and filter client side to catch those with undefined status (legacy)
      // const parlaysQ = query(collection(db, 'parlays'), where('status', '==', 'active'));
      const parlaysQ = query(collection(db, 'parlays'));
      const parlaysSnap = await getDocs(parlaysQ);

      // Fetch all events for lookup
      // Ideally we only fetch events in the parlays, but simpler to fetch active/recent events or just all for this admin tool
      // Let's fetch all events since this is an admin tool
      const eventsSnap = await getDocs(collection(db, 'events'));
      const eventMap = new Map(eventsSnap.docs.map(d => [d.id, d.data()]));

      const batch = writeBatch(db);
      let updatesCount = 0;
      let pCount = 0;

      for (const parlayDoc of parlaysSnap.docs) {
        const parlay = { id: parlayDoc.id, ...parlayDoc.data() };

        // Skip already settled
        if (parlay.status === 'won' || parlay.status === 'lost') continue;

        let isLost = false;
        let isFullyWon = true;

        for (const leg of parlay.legs) {
          const event = eventMap.get(leg.eventId);
          let legStatus = 'pending';

          if (!event) {
            // removing leg? or keeping pending
            legStatus = 'pending';
          } else if (event.status === 'settled' && event.winnerOutcomeId) {
            legStatus = event.winnerOutcomeId === leg.outcomeId ? 'won' : 'lost';
          } else {
            legStatus = 'pending';
          }

          if (legStatus === 'lost') {
            isLost = true;
            break;
          }
          if (legStatus !== 'won') {
            isFullyWon = false;
          }
        }

        let newStatus = 'active';
        if (isLost) newStatus = 'lost';
        else if (isFullyWon) newStatus = 'won';

        if (newStatus === 'active') continue;

        // Found a change!
        pCount++;
        batch.update(parlayDoc.ref, { status: newStatus });
        updatesCount++;

        // Settle Bets
        const betsQ = query(collection(db, 'bets'), where('parlayId', '==', parlay.id), where('status', '==', 'pending'));
        const betsSnap = await getDocs(betsQ);

        for (const betDoc of betsSnap.docs) {
          const bet = betDoc.data();
          const payout = newStatus === 'won' ? (bet.amount * parlay.finalMultiplier) : 0;

          batch.update(betDoc.ref, {
            status: newStatus,
            payout: payout,
            settledAt: new Date().toISOString()
          });
          updatesCount++;

          if (newStatus === 'won') {
            const userRef = doc(db, 'users', bet.userId);
            batch.update(userRef, {
              balance: increment(payout),
              invested: increment(-bet.amount)
            });
            updatesCount++;
          } else {
            const userRef = doc(db, 'users', bet.userId);
            batch.update(userRef, {
              invested: increment(-bet.amount)
            });
            updatesCount++;
          }

          // Chunk commit
          if (updatesCount >= 450) {
            await batch.commit();
            updatesCount = 0;
          }
        }
      }

      if (updatesCount > 0) {
        await batch.commit();
      }
      return { success: true, message: `Processed ${pCount} parlays.` };

    } catch (e) {
      return { success: false, error: e.message };
    }
  };

  // --- Actions ---

  const signup = async (email, username, password, referralCode) => {
    try {
      const resp = await createUserWithEmailAndPassword(auth, email, password);

      // Generate a simple unique referral code (8 chars)
      // In a real app, you'd check for collisions, but this is sufficient for now.
      const myReferralCode = Math.random().toString(36).substring(2, 10).toUpperCase();

      let referredBy = null;

      // Handle Referral Reward
      if (referralCode && referralCode.trim() !== '') {
        try {
          // Find the user who owns this code
          const q = query(collection(db, 'users'), where('referralCode', '==', referralCode.trim().toUpperCase()));
          const snapshot = await getDocs(q);

          if (!snapshot.empty) {
            const referrerDoc = snapshot.docs[0];
            const referrerId = referrerDoc.id;

            // Notify Referrer with Claimable Reward
            console.log(`Creating referral notification for ${referrerId}`);
            await addDoc(collection(db, 'notifications'), {
              userId: referrerId,
              type: 'referral_claim',
              title: 'New Referral Reward!',
              message: `Someone signed up using your code! Claim your $500 reward.`,
              amount: 500,
              read: false,
              claimed: false,
              createdAt: new Date().toISOString()
            });
            console.log("Referral notification created successfully.");

            // LINK THE REFERRAL
            referredBy = referrerId;

          }
        } catch (err) {
          console.error("Error processing referral:", err);
        }
      }

      // Create User Document
      await setDoc(doc(db, 'users', resp.user.uid), {
        email,
        username: username || email.split('@')[0],
        role: email.toLowerCase().includes('admin') ? 'admin' : 'user',
        balance: 1000,
        createdAt: new Date().toISOString(),
        referralCode: myReferralCode,
        referredBy: referredBy
      });

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const signin = async (emailOrUsername, password) => {
    try {
      let email = emailOrUsername.trim();

      // If it looks like an email, just try it directly
      if (email.includes('@')) {
        try {
          await signInWithEmailAndPassword(auth, email, password);
          return { success: true };
        } catch (e) {
          console.error("Email login failed", e);
          return { success: false, error: e.message };
        }
      }

      // Username lookup logic
      const usernameInput = email;
      const col = collection(db, 'users');
      let candidateEmails = new Set();

      // Helper to fetch and add emails (No LIMIT to ensure we find the right one)
      const addCandidates = async (param, val) => {
        try {
          const q = query(col, where(param, '==', val)); // Removed limit
          const snap = await getDocs(q);
          snap.forEach(doc => {
            const data = doc.data();
            if (data.email) candidateEmails.add(data.email);
          });
        } catch (err) {
          console.error("Query failed for", val, err);
        }
      };

      // 1. Exact Match
      await addCandidates('username', usernameInput);
      // 2. Lowercase
      await addCandidates('username', usernameInput.toLowerCase());
      // 3. Capitalized (Try standard First Capital)
      const capitalized = usernameInput.charAt(0).toUpperCase() + usernameInput.slice(1).toLowerCase();
      await addCandidates('username', capitalized);

      // 4. UPPERCASE
      await addCandidates('username', usernameInput.toUpperCase());

      if (candidateEmails.size === 0) {
        return { success: false, error: `Username '${usernameInput}' does not exist.` };
      }

      // Try each email
      let tried = [];
      for (let candidateEmail of candidateEmails) {
        if (typeof candidateEmail !== 'string') continue;
        candidateEmail = candidateEmail.trim();

        try {
          // Attempt 1: Standard
          await signInWithEmailAndPassword(auth, candidateEmail, password);
          return { success: true };
        } catch (error) {
          // Attempt 2: Trimmed Password
          if (password.trim() !== password) {
            try {
              await signInWithEmailAndPassword(auth, candidateEmail, password.trim());
              return { success: true };
            } catch (e2) { }
          }

          // Attempt 3: Email with all whitespace removed (just in case)
          const emailNoWhitespace = candidateEmail.replace(/\s/g, '');
          if (emailNoWhitespace !== candidateEmail) {
            try {
              await signInWithEmailAndPassword(auth, emailNoWhitespace, password);
              return { success: true };
            } catch (e3) { }
          }

          tried.push(candidateEmail);
          if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password') {
            continue;
          }
          // Return technical error
          return { success: false, error: `System Error (${error.code})` };
        }
      }

      // If loop finishes, none worked.
      // Return the email found so the UI can switch to it.
      const firstEmail = tried[0];
      return {
        success: false,
        suggestedEmail: firstEmail,
        error: 'Password incorrect.'
      };

    } catch (error) {
      console.error(error);
      return { success: false, error: "System Error: " + error.message };
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      return { success: true };
    } catch (error) {
      console.error(error);
    }
  };

  const placeBet = async (eventId, outcomeId, amount) => {
    if (!user) return { success: false, error: 'Not logged in' };
    if (user.balance < amount) return { success: false, error: 'Insufficient funds' };

    const event = events.find(e => e.id === eventId);
    if (!event || event.status !== 'open') return { success: false, error: 'Event is locked' };

    // Check for existing bets on OTHER sides
    const qExisting = query(collection(db, 'bets'), where('userId', '==', user.id), where('eventId', '==', eventId));
    const snapExisting = await getDocs(qExisting);
    const otherSideBet = snapExisting.docs.find(d => d.data().outcomeId !== outcomeId);

    if (otherSideBet) {
      return { success: false, error: "Loyalty check! You already bet on the other side. No switching." };
    }

    const outcome = event.outcomes.find(o => o.id === outcomeId);

    try {
      // 1. Deduct Balance & Add to Invested
      const userRef = doc(db, 'users', user.id);
      // Streak Logic
      const today = new Date();
      const todayStr = today.toDateString();
      const yesterday = new Date();
      yesterday.setDate(today.getDate() - 1);
      const yesterdayStr = yesterday.toDateString();

      let newStreak = user.currentStreak || 0;
      const lastDate = user.lastBetDate || ""; // Assuming stored as toDateString()

      let streakType = 'none';
      // Only update logic if we haven't already processed a streak for today
      // (Or if the user had 0 streak and just started today)
      if (lastDate !== todayStr) {
        if (lastDate === yesterdayStr) {
          newStreak += 1;
          streakType = 'increased';
        } else {
          newStreak = 1; // Broken streak or first bet
          streakType = 'started';
        }
      } else {
        if (newStreak === 0) {
          newStreak = 1;
          streakType = 'started';
        }
      }

      const newLongest = Math.max(newStreak, user.longestStreak || 0);

      // 1. Deduct Balance, Add to Invested, Update Streak

      await updateDoc(userRef, {
        balance: increment(-amount),
        invested: increment(amount), // Track active wagers for leaderboard
        currentStreak: newStreak,
        longestStreak: newLongest,
        lastBetDate: todayStr
      });

      // 2. Create Bet
      await addDoc(collection(db, 'bets'), {
        userId: user.id,
        username: user.username,
        eventId,
        outcomeId,
        outcomeLabel: outcome.label,
        eventTitle: event.title,
        amount: parseFloat(amount),
        odds: outcome.odds,
        potentialPayout: amount * outcome.odds,
        status: 'pending',
        placedAt: new Date().toISOString()
      });

      // 3. Update Event Stats (Best Effort - ignore permission errors for now)
      try {
        const eventRef = doc(db, 'events', eventId);
        await updateDoc(eventRef, {
          [`stats.counts.${outcomeId}`]: increment(1),
          [`stats.amounts.${outcomeId}`]: increment(amount),
          'stats.totalBets': increment(1),
          'stats.totalPool': increment(amount)
        });
      } catch (statsErr) {
        console.warn("Could not update event stats (likely permission issue):", statsErr);
      }

      return { success: true, streakType, newStreak };
    } catch (e) {
      return { success: false, error: e.message };
    }
  };



  const createEvent = async (eventData) => {
    try {
      await addDoc(collection(db, 'events'), {
        status: 'open',
        createdAt: new Date().toISOString(),
        ...eventData
      });
    } catch (e) {
      console.error("Error creating event", e);
    }
  };

  const updateEventOrder = async (eventId, newOrder) => {
    try {
      if (!user || user.role !== 'admin') return { success: false, error: 'Unauthorized' };
      await updateDoc(doc(db, 'events', eventId), { order: newOrder });
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  };

  const deleteEvent = async (eventId) => {
    try {
      // Note: This does NOT refund bets automatically in this simple version
      // You would need Cloud Functions for robust backend logic
      const eventRef = doc(db, 'events', eventId);
      await updateDoc(eventRef, { status: 'deleted' }); // Soft delete is safer?
      // For now, let's just actually delete it for cleanliness in the UI as requested previously
      // but usually on local version we just filtered.
      // Wait, Firestore deleteDoc is better.
      // await deleteDoc(doc(db, 'events', eventId)); 
      // Let's stick to update to 'deleted' or just rely on the UI filter?
      // Let's actually delete.
      await deleteDoc(doc(db, 'events', eventId));
    } catch (e) {
      console.error(e);
    }
  };

  const toggleFeatured = async (eventId, currentStatus) => {
    try {
      await updateDoc(doc(db, 'events', eventId), {
        featured: !currentStatus
      });
    } catch (e) { console.error(e); }
  };

  const claimReferralReward = async (notificationId, amount) => {
    if (!user) return;
    try {
      // 1. Update Balance (User updates OWN balance - allowed)
      const userRef = doc(db, 'users', user.id);
      await updateDoc(userRef, {
        balance: increment(amount)
      });

      // 2. Mark Notification as Claimed
      const notifRef = doc(db, 'notifications', notificationId);
      await updateDoc(notifRef, {
        claimed: true,
        read: true,
        message: `Reward claimed! You earned $${amount}.`
      });

      return { success: true };
    } catch (e) {
      console.error("Claim failed", e);
      return { success: false, error: e.message };
    }
  };

  const resolveEvent = async (eventId, winnerOutcomeId) => {
    try {
      const batch = writeBatch(db);
      const eventRef = doc(db, 'events', eventId);

      // 1. Mark Event as Settled
      batch.update(eventRef, {
        status: 'settled',
        winnerOutcomeId,
        settledAt: new Date().toISOString()
      });

      // 2. Fetch Squads & Determine Ranks(for Boosts: #1 +15 %, #2 +7 %, #3 +3 %)
      const squadsSnap = await getDocs(query(collection(db, 'squads')));
      const squadsList = squadsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      squadsList.sort((a, b) => (b.stats?.score || 0) - (a.stats?.score || 0));

      const rank1Id = squadsList[0]?.id;
      const rank2Id = squadsList[1]?.id;
      const rank3Id = squadsList[2]?.id;

      // 3. Get Bets
      const betsQ = query(collection(db, 'bets'), where('eventId', '==', eventId));
      const betsSnap = await getDocs(betsQ);

      // 4. Identify Users & Fetch Profiles(Need squadId for boost)
      const userIds = new Set();
      betsSnap.docs.forEach(d => {
        if (d.data().status === 'pending') userIds.add(d.data().userId);
      });

      const userProfiles = {};
      await Promise.all([...userIds].map(async (uid) => {
        try {
          const snap = await getDoc(doc(db, 'users', uid));
          if (snap.exists()) userProfiles[uid] = snap.data();
        } catch (e) {
          console.error(`Failed to fetch user ${uid}`, e);
        }
      }));

      // 5. Process Bets
      const userUpdates = {}; // { userId: { balance: 0, invested: 0, profit: 0 ... } }

      // --- BRANCH A: VOID EVENT ---
      if (winnerOutcomeId === 'void') {
        // A1. Void Bets (Single) - Handle Pending AND Settled
        for (const betDoc of betsSnap.docs) {
          const bet = betDoc.data();
          // Skip if already voided to avoid double refund
          if (bet.status === 'voided') continue;

          if (!userUpdates[bet.userId]) userUpdates[bet.userId] = { balance: 0, invested: 0, profit: 0 };

          // Logic based on previous status
          if (bet.status === 'won') {
            // Reverse Win: Take back payout, return original stake? 
            // Net effect: User has (Balance + Payout). We want (Balance + Stake).
            // diff = Stake - Payout.
            userUpdates[bet.userId].balance += (bet.amount - (bet.payout || 0));
            // Invested was already cleared, so no change to invested.
            // Profit was (Payout - Stake). We need to reverse it.
            userUpdates[bet.userId].profit -= (bet.payout - bet.amount);
          } else if (bet.status === 'lost') {
            // Reverse Loss: Give back stake.
            userUpdates[bet.userId].balance += bet.amount;
            // Invested was already cleared.
            // Profit was (-Stake). Reverse it.
            userUpdates[bet.userId].profit += bet.amount;
          } else {
            // Pending
            // Refund stake.
            userUpdates[bet.userId].balance += bet.amount;
            userUpdates[bet.userId].invested -= bet.amount; // Clear from invested
          }

          batch.update(betDoc.ref, { status: 'voided', settledAt: new Date().toISOString(), payout: 0, boostApplied: 0 });
        }

        // A2. Handle Parlays
        // Fetch ALL parlays and filter client-side for this event
        const allParlaysSnap = await getDocs(collection(db, 'parlays'));
        // Include settled parlays to allow retroactive voiding
        const relevantParlays = allParlaysSnap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(p => p.legs.some(l => l.eventId === eventId));

        for (const parlay of relevantParlays) {
          // If parlay previously voided, skip? Or re-process? 
          // If already voided, no legs matter.
          if (parlay.status === 'voided') continue;

          const oldStatus = parlay.status;
          const newLegs = parlay.legs.filter(l => l.eventId !== eventId);

          // Re-calculate Stats for new legs
          let newMultiplier = 1;
          newLegs.forEach(leg => { newMultiplier *= (leg.odds || 1); });

          // Fetch bets for this parlay (Pending AND Settled)
          const parlayBetsSnap = await getDocs(query(collection(db, 'bets'), where('parlayId', '==', parlay.id)));

          if (newLegs.length === 0) {
            // Empty Parlay -> Void Entirely
            batch.update(doc(db, 'parlays', parlay.id), { status: 'voided', finalMultiplier: 1, legs: [] });

            for (const pBetDoc of parlayBetsSnap.docs) {
              const pBet = pBetDoc.data();
              if (pBet.status === 'voided') continue;

              if (!userUpdates[pBet.userId]) userUpdates[pBet.userId] = { balance: 0, invested: 0, profit: 0 };

              // Refund Logic matching Single Bets
              if (pBet.status === 'won') {
                userUpdates[pBet.userId].balance += (pBet.amount - (pBet.payout || 0));
                userUpdates[pBet.userId].profit -= ((pBet.payout || 0) - pBet.amount);
              } else if (pBet.status === 'lost') {
                userUpdates[pBet.userId].balance += pBet.amount;
                userUpdates[pBet.userId].profit += pBet.amount;
              } else {
                userUpdates[pBet.userId].balance += pBet.amount;
                userUpdates[pBet.userId].invested -= pBet.amount;
              }

              batch.update(pBetDoc.ref, { status: 'voided', settledAt: new Date().toISOString(), payout: 0 });
            }
          } else {
            // Parlay Continues (with reduced legs)
            // We need to determine the NEW status of the parlay based on REMAINING legs.
            // If it was 'won', it stays 'won' (unless legs missing?).
            // If it was 'lost', it MIGHT become 'won' (if the voided leg was the loser).
            // If 'active', stays 'active'.

            // We need to check status of remaining legs.
            // Fetch events for remaining legs? Expensive loop.
            // Optimization: We assume `resolveEvent` is called. 
            // Rely on existing leg outcomes if possible? 
            // Parlay objects don't store leg outcomes in standard structure usually.
            // We have to check if remaining legs are winners.

            // Let's simplified approach:
            // 1. Update Parlay Docs with newMultiplier and Legs.
            // 2. Determine New Status.
            //    - Fetch all events for remaining legs.
            const legEventsQ = query(collection(db, 'events'), where('id', 'in', newLegs.map(l => l.eventId).slice(0, 10))); // Limit 10 for 'in' query
            // If specific limitations, just fetch all needed.
            // Actually, let's just fetch them one by one or all events.
            // Given standard usage, we can fetch all events (cached in state?) - No access to state here.
            // Fetch relevant events.
            let isLost = false;
            let isFullyWon = true;

            // We need to know the outcome of remaining legs.
            // Since this is a backend function, we must fetch fresh data.
            const evIds = newLegs.map(l => l.eventId);
            const legEventsSnap = await getDocs(query(collection(db, 'events'), where('documentId', 'in', evIds.length > 0 ? evIds : ['dummy'])));
            const legEventsMap = new Map(legEventsSnap.docs.map(d => [d.id, d.data()]));

            for (const leg of newLegs) {
              const ev = legEventsMap.get(leg.eventId);
              if (!ev || ev.status !== 'settled') {
                isFullyWon = false; // Pending leg exists
              } else {
                if (ev.winnerOutcomeId !== leg.outcomeId && ev.winnerOutcomeId !== 'void') {
                  isLost = true; // Lost leg exists
                }
              }
            }

            let newStatus = 'active';
            if (isLost) newStatus = 'lost';
            else if (isFullyWon) newStatus = 'won';

            batch.update(doc(db, 'parlays', parlay.id), {
              legs: newLegs,
              finalMultiplier: newMultiplier,
              status: newStatus
            });

            // Process Bets adjustments
            for (const pBetDoc of parlayBetsSnap.docs) {
              const pBet = pBetDoc.data();
              if (pBet.status === 'voided') continue; // Should not happen for active/won/lost but safety check

              if (!userUpdates[pBet.userId]) userUpdates[pBet.userId] = { balance: 0, invested: 0, profit: 0 };

              const oldPayout = pBet.status === 'won' ? (pBet.payout || 0) : 0;
              const newPotentialPayout = pBet.amount * newMultiplier;
              const newRealPayout = newStatus === 'won' ? newPotentialPayout : 0;

              // Balance Adjustment:
              // We need to reverse old financial effect and apply new one.

              // REVERSE OLD:
              if (pBet.status === 'won') {
                balanceChange -= oldPayout;
                profitChange -= (oldPayout - pBet.amount);
                // invested no change
                balanceChange += pBet.amount; // Return stake to "hand"
              } else if (pBet.status === 'lost') {
                balanceChange += pBet.amount; // Return stake to "hand"
                profitChange += pBet.amount; // Reverse loss stats
              } else { // pending
                balanceChange += pBet.amount; // Return stake
                investedChange -= pBet.amount; // Clear lock
              }

              // Apply New
              if (newStatus === 'won') {
                balanceChange -= pBet.amount; // Take stake
                balanceChange += newRealPayout; // Give payout
                profitChange += (newRealPayout - pBet.amount);
              } else if (newStatus === 'lost') {
                balanceChange -= pBet.amount; // Take stake (it's gone)
                profitChange -= pBet.amount;
              } else { // active or pending
                balanceChange -= pBet.amount; // Take stake
                investedChange += pBet.amount; // Lock it
              }

              userUpdates[pBet.userId].balance += balanceChange;
              userUpdates[pBet.userId].invested += investedChange;
              userUpdates[pBet.userId].profit += profitChange;

              batch.update(pBetDoc.ref, {
                odds: newMultiplier,
                potentialPayout: newPotentialPayout,
                payout: newRealPayout,
                status: newStatus,
                settledAt: newStatus === 'active' ? null : new Date().toISOString()
              });

              // If previously pending and now settled, settledAt updates.
              // If previously settled and now active (rare), clear settledAt? (using null/deleteField might be needed if strictly typed, but null is fine/undefined)
              if (newStatus === 'active') {
                batch.update(pBetDoc.ref, { settledAt: deleteField() });
              }
            }
          }
        }

      } else {
        // --- BRANCH B: STANDARD RESOLUTION ---
        for (const betDoc of betsSnap.docs) {
          const bet = betDoc.data();
          if (bet.status !== 'pending') continue;

          const isWinner = bet.outcomeId === winnerOutcomeId;
          const user = userProfiles[bet.userId]; // Might be undefined

          let boostMultiplier = 0;
          let boostAmount = 0;
          let finalPayout = 0;

          if (isWinner) {
            const rawProfit = bet.potentialPayout - bet.amount;
            // Squad Boost Logic
            if (user && user.squadId) {
              if (user.squadId === rank1Id) boostMultiplier = 0.15;
              else if (user.squadId === rank2Id) boostMultiplier = 0.07;
              else if (user.squadId === rank3Id) boostMultiplier = 0.03;
            }
            boostAmount = rawProfit * boostMultiplier;
            finalPayout = bet.potentialPayout + boostAmount;
          }

          if (!userUpdates[bet.userId]) userUpdates[bet.userId] = { balance: 0, invested: 0, profit: 0 };

          userUpdates[bet.userId].invested -= bet.amount; // Always remove active investment

          if (isWinner) {
            userUpdates[bet.userId].balance += finalPayout;
            // Profit = Payout - Stake
            userUpdates[bet.userId].profit += (finalPayout - bet.amount);

            // Queue Bet Update
            batch.update(betDoc.ref, {
              status: 'won',
              payout: finalPayout,
              boostApplied: boostAmount > 0 ? boostAmount : 0,
              settledAt: new Date().toISOString()
            });

            // Notification
            const notifRef = doc(collection(db, 'notifications'));
            let msg = `You won $${finalPayout.toFixed(2)} on ${bet.eventTitle} (${bet.outcomeLabel})`;
            if (boostAmount > 0) msg += ` (Includes Squad Boost!)`;

            batch.set(notifRef, {
              userId: bet.userId,
              type: 'result',
              eventId: eventId,
              title: 'You Won!',
              message: msg,
              read: false,
              createdAt: new Date().toISOString()
            });

          } else {
            // Loss = -Stake
            userUpdates[bet.userId].profit -= bet.amount;

            batch.update(betDoc.ref, { status: 'lost', settledAt: new Date().toISOString() });

            // Notification
            const notifRef = doc(collection(db, 'notifications'));
            batch.set(notifRef, {
              userId: bet.userId,
              type: 'result',
              eventId: eventId,
              title: 'Bet Lost',
              message: `You lost $${bet.amount.toFixed(2)} on ${bet.eventTitle} (${bet.outcomeLabel})`,
              read: false,
              createdAt: new Date().toISOString()
            });
          }
        }
      }

      // 6. Commit User Balance Updates
      for (const [uid, updates] of Object.entries(userUpdates)) {
        const userRef = doc(db, 'users', uid);
        batch.update(userRef, {
          balance: increment(updates.balance),
          invested: increment(updates.invested),
          // We could track profit/loss stats here too if needed
        });
      }

      await batch.commit();

      // 7. Process Parlay Resolutions (Only for Standard Resolution)
      // If void, we already handled parlays in Branch A.
      if (winnerOutcomeId !== 'void') {
        try {
          await processParlayResults(eventId, winnerOutcomeId, rank1Id, rank2Id, rank3Id);
        } catch (parlayErr) {
          console.error("Error processing parlays:", parlayErr);
        }
      }

      return { success: true };
    } catch (e) {
      console.error("Resolve Event Error:", e);
      return { success: false, error: e.message };
    }
  };

  const processParlayResults = async (eventId, winnerOutcomeId, rank1Id, rank2Id, rank3Id) => {
    // 1. Fetch all parlays (Efficiency note: In prod, use array-contains on eventIds)
    // We must fetch fresh data here
    const parlaysQ = query(collection(db, 'parlays'));
    const parlaysSnap = await getDocs(parlaysQ);

    const relevantParlays = parlaysSnap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      // FIX: Check for != won/lost/voided instead of == active to handle legacy parlays with undefined status
      .filter(p => p.legs.some(l => l.eventId === eventId) && p.status !== 'won' && p.status !== 'lost' && p.status !== 'voided');

    if (relevantParlays.length === 0) return;

    // Fetch Reference Events for Multi-Leg Checks?
    // Actually we only need to check the CURRENT event status against the leg.
    // However, if a parlay has OTHER settled events, we need to know that to determine if the WHOLE parlay is won/lost.
    // But `processParlayResults` usually iterates legs and checks their status.
    // If we only have eventId and winnerOutcomeId passed in, we know the status of THIS event.
    // For other legs, we need to know if they are settled.
    // IF the parlay object stores `legs` with `status`, we are good.
    // BUT usually `legs` only stores `eventId` and `outcomeId`.
    // So we DO need to fetch other events or check them.

    // Let's rely on the events state if available? `events` is in scope from `useApp`.
    // But `events` state might be stale or partial (limited to 50).
    // Safest to fetch all events or just rely on what we have + the current one.
    // Let's fetch all events since this is a backend-like operation.
    const allEventsSnap = await getDocs(collection(db, 'events'));
    const eventMap = new Map(allEventsSnap.docs.map(e => [e.id, { id: e.id, ...e.data() }]));

    // Update current event in map just in case (though it should be in snap if settled)
    // Actually `resolveEvent` just set it to settled. The snap might catch it or not depending on timing.
    // Let's manually enforce the current event result in our map for calculation
    const currentEventObj = eventMap.get(eventId);
    if (currentEventObj) {
      currentEventObj.status = 'settled';
      currentEventObj.winnerOutcomeId = winnerOutcomeId;
    }

    // Batch Helper to avoid 500 limit
    let batch = writeBatch(db);
    let opCount = 0;
    const commitThreshold = 450;

    const commitBatchIfFull = async () => {
      if (opCount >= commitThreshold) {
        await batch.commit();
        batch = writeBatch(db);
        opCount = 0;
      }
    };

    for (const parlay of relevantParlays) {
      let isLost = false;
      let isFullyWon = true;

      // Check all legs
      for (const leg of parlay.legs) {
        let legStatus = 'pending';

        if (leg.eventId === eventId) {
          // This is the event being resolved right now
          legStatus = leg.outcomeId === winnerOutcomeId ? 'won' : 'lost';
        } else {
          // Check other events
          const ev = eventMap.get(leg.eventId);
          if (!ev) {
            // Event missing? specific error handling or treat as pending
            legStatus = 'pending';
          } else if (ev.status === 'settled' && ev.winnerOutcomeId) {
            if (ev.winnerOutcomeId === 'void') {
              // If another leg was voided but parlay wasn't processed? 
              // Should have been handled by void resolution. 
              // Treat as void/push? But this function handles Win/Loss.
              // If we find a void leg that wasn't removed, it's an edge case.
              // Let's assume it's pending for now or handle strictly?
              // Actually, if a leg is void, it should have been removed from the parlay.
              // If it's still there, maybe handle as 'void' leg (push)?
              // For now, let's just assume valid outcomes.
              legStatus = ev.winnerOutcomeId === leg.outcomeId ? 'won' : 'lost';
            } else {
              legStatus = ev.winnerOutcomeId === leg.outcomeId ? 'won' : 'lost';
            }
          } else {
            legStatus = 'pending';
          }
        }

        if (legStatus === 'lost') {
          isLost = true;
          isFullyWon = false;
          break; // Parlay dead
        }
        if (legStatus === 'pending') {
          isFullyWon = false;
        }
      }

      if (isLost) {
        const parlayRef = doc(db, 'parlays', parlay.id);
        batch.update(parlayRef, { status: 'lost', settledAt: new Date().toISOString() });
        opCount++;
        await commitBatchIfFull();

        // Also update all bets on this parlay to lost
        // Query bets? Or assuming bets are resolved via parlay status?
        // Usually bets on parlays are pending until parlay resolves.
        // We need to fetch bets for this parlay.
        const pBets = await getDocs(query(collection(db, 'bets'), where('parlayId', '==', parlay.id), where('status', '==', 'pending')));
        for (const pb of pBets.docs) {
          batch.update(pb.ref, { status: 'lost', settledAt: new Date().toISOString() });

          // Deduct from profit stats
          const uid = pb.data().userId;
          const amt = pb.data().amount;
          const uRef = doc(db, 'users', uid);
          // We can't batch read/write same doc easily for aggregation without transaction.
          // But we can use increments.
          batch.update(uRef, {
            invested: increment(-amt),
            // profit: increment(-amt) // We track profit on settlement
            // Actually logic in resolveEvent for single bets:
            // Loss = -Stake in profitData
            // So yes, subtract amount from profit? Not strictly necessary if we only track net P/L on wins?
            // Let's follow single bet logic:
            // userUpdates[bet.userId].profit -= bet.amount;
            // So we decrement profit by amount.
          });

          // Notification
          const notifRef = doc(collection(db, 'notifications'));
          batch.set(notifRef, {
            userId: uid,
            type: 'result',
            eventId: 'parlay-' + parlay.id,
            title: 'Parlay Busted',
            message: `Your parlay including ${currentEventObj ? currentEventObj.title : 'an event'} ended in defeat.`,
            read: false,
            createdAt: new Date().toISOString()
          });

          opCount += 3;
          await commitBatchIfFull();
        }

      } else if (isFullyWon) {
        const parlayRef = doc(db, 'parlays', parlay.id);
        batch.update(parlayRef, { status: 'won', settledAt: new Date().toISOString() });
        opCount++;
        await commitBatchIfFull();

        // Payout Bets
        const pBets = await getDocs(query(collection(db, 'bets'), where('parlayId', '==', parlay.id), where('status', '==', 'pending')));
        for (const pb of pBets.docs) {
          const betData = pb.data();

          let boostMultiplier = 0;
          let boostAmount = 0;

          // Fetch User for Boost Logic
          try {
            const uSnap = await getDoc(doc(db, 'users', betData.userId));
            if (uSnap.exists()) {
              const uData = uSnap.data();
              if (uData.squadId) {
                if (uData.squadId === rank1Id) boostMultiplier = 0.15;
                else if (uData.squadId === rank2Id) boostMultiplier = 0.07;
                else if (uData.squadId === rank3Id) boostMultiplier = 0.03;
              }
            }
          } catch (err) { console.error("Error checking user squad boost:", err); }

          const rawProfit = betData.potentialPayout - betData.amount;
          boostAmount = rawProfit * boostMultiplier;
          const payout = betData.potentialPayout + boostAmount;

          batch.update(pb.ref, {
            status: 'won',
            payout: payout,
            boostApplied: boostAmount > 0 ? boostAmount : 0,
            settledAt: new Date().toISOString()
          });

          const uRef = doc(db, 'users', betData.userId);

          // Check for Tail Boost (Creator Only)
          let tailBoostAmount = 0;
          if (betData.userId === parlay.creatorId) {
            const uniqueTails = (parlay.tailedBy || []).length;
            // Boost: 0.5x per unique tail, capped at 5x multiplier boost (so 500% increase max)
            // Does "capped at 5x" mean the Multiplier is 5x total or added?
            // "tail boost is capped at 5x". 
            // If multiplier is 0.5 per tail. 10 tails = 5.0x boost.
            // Let's assume max boost multiplier is 5.0.
            const boostMult = Math.min(uniqueTails * 0.5, 5);

            if (boostMult > 0) {
              // Apply to Profit? Or Payout? Usually Boosts are on Profit or Payout.
              // Let's apply to Profit for typical boost behavior, or Payout implies "Tail Boost".
              // Prompt: "creator of the parlay gets a tail boost of 0.5x... tail boost only effects the creators payout"
              // Let's add (Profit * boostMult) to the payout.
              const profit = betData.potentialPayout - betData.amount;
              tailBoostAmount = profit * boostMult;
            }
          }

          const totalPayout = payout + tailBoostAmount;

          batch.update(uRef, {
            balance: increment(totalPayout),
            invested: increment(-betData.amount),
          });

          // Update bet with final details
          batch.update(pb.ref, {
            status: 'won',
            payout: totalPayout,
            boostApplied: boostAmount > 0 ? boostAmount : 0, // Squad Boost
            tailBoostApplied: tailBoostAmount > 0 ? tailBoostAmount : 0, // Tail Boost
            settledAt: new Date().toISOString()
          });

          const notifRef = doc(collection(db, 'notifications'));
          let msg = `Congratulations! Your parlay hit for $${totalPayout.toFixed(2)}`;
          if (boostAmount > 0) msg += ` (Includes Squad Boost!)`;
          if (tailBoostAmount > 0) msg += ` (Includes Tail Boost!)`;

          batch.set(notifRef, {
            userId: betData.userId,
            type: 'result',
            eventId: 'parlay-' + parlay.id,
            title: 'Parlay Winner!',
            message: msg,
            read: false,
            createdAt: new Date().toISOString()
          });

          opCount += 3;
          await commitBatchIfFull();
        }
      }
    }

    await batch.commit();
  };




  const fixStuckBets = async () => {
    try {
      const eventsQ = query(collection(db, 'events'), where('status', '==', 'settled'));
      const eventsSnap = await getDocs(eventsQ);

      let totalFixed = 0;
      const batch = writeBatch(db);

      for (const eventDoc of eventsSnap.docs) {
        const event = eventDoc.data();
        const winnerOutcomeId = event.winnerOutcomeId;
        if (!winnerOutcomeId) continue;

        const betsQ = query(collection(db, 'bets'), where('eventId', '==', eventDoc.id), where('status', '==', 'pending'));
        const betsSnap = await getDocs(betsQ);

        for (const betDoc of betsSnap.docs) {
          const bet = betDoc.data();
          // Double check it's pending
          if (bet.status !== 'pending') continue;

          const isWinner = bet.outcomeId === winnerOutcomeId;
          const userRef = doc(db, 'users', bet.userId);

          let percentChange = 0;
          try {
            // Fetch User for Net Worth Calc
            const userSnap = await getDoc(userRef);
            const userData = userSnap.exists() ? userSnap.data() : { balance: 0, invested: 0 };
            const currentNetWorth = (userData.balance || 0) + (userData.invested || 0);

            // Profit (or Loss) from this specific bet
            const profit = isWinner
              ? (bet.potentialPayout - bet.amount) // Net Profit
              : -bet.amount;                       // Net Loss

            // Portfolio Impact % = (Profit / currentNetWorth) * 100
            percentChange = currentNetWorth > 0
              ? (profit / currentNetWorth) * 100
              : 0;
          } catch (err) { console.error(err); }

          batch.update(betDoc.ref, {
            status: isWinner ? 'won' : 'lost',
            settledAt: new Date().toISOString()
          });

          if (isWinner) {
            batch.update(userRef, {
              balance: increment(bet.potentialPayout),
              invested: increment(-bet.amount),
              lastBetPercent: percentChange
            });
          } else {
            batch.update(userRef, {
              invested: increment(-bet.amount),
              lastBetPercent: percentChange
            });
          }
          totalFixed++;
        }
      }

      if (totalFixed > 0) {
        await batch.commit();
      }
      return { success: true, message: `Fixed ${totalFixed} stuck bets.` };
    } catch (e) {
      return { success: false, error: e.message };
    }
  };



  const deleteBet = async (betId) => {
    if (!user || user.role !== 'admin') return { success: false, error: 'Unauthorized' };
    try {
      await deleteDoc(doc(db, 'bets', betId));
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  };

  const updateEvent = async (eventId, data) => {
    try {
      await updateDoc(doc(db, 'events', eventId), data);
      return { success: true };
    } catch (e) {
      console.error(e);
      return { success: false, error: e.message };
    }
  };

  const setMainBet = async (eventId, mainOutcomeId) => {
    try {
      if (!user || user.role !== 'admin') return { success: false, error: 'Unauthorized' };
      const eventRef = doc(db, 'events', eventId);
      const snap = await getDoc(eventRef);
      if (!snap.exists()) return { success: false, error: "Event not found" };

      const evt = snap.data();
      // Remove 'main' type from all, then set it for the chosen one plus its sibling?
      // Wait, "Main Bet" usually implies a PAIR of outcomes (e.g. Chiefs vs 49ers).
      // If the user selects "Chiefs" as main, we likely want "49ers" (the other one in that pair) to also be main.
      // But outcomes are just a flat list. 
      // Simplification: The admin clicks "Highlight This Pair" on one outcome, and we assume the next one is its pair?
      // Or we just flag THIS outcome's pair as main.

      // Let's iterate and just toggle the type 'main' for the targeted outcome(s).
      // Actually, cleaner design: toggle "type: main" for specific outcomes.

      const newOutcomes = evt.outcomes.map(o => {
        if (o.id === mainOutcomeId) return { ...o, type: 'main' };
        // If we want to unset others? Maybe not, maybe multiple main bets allowed.
        return o;
      });

      await updateDoc(eventRef, { outcomes: newOutcomes });
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  };

  const submitIdea = async (ideaText) => {
    if (!user) return { success: false, error: 'Not logged in' };

    // Duplicate Check
    const qDup = query(collection(db, 'ideas'), where('userId', '==', user.id), where('text', '==', ideaText));
    const snapDup = await getDocs(qDup);
    if (!snapDup.empty) {
      return { success: false, error: "You already suggested this! Switch it up." };
    }

    // Check Daily Limit (Client-side check based on local user data, ideally backend does this)
    const today = new Date().toDateString();
    let currentCount = 0;

    if (user.submissionData && user.submissionData.date === today) {
      currentCount = user.submissionData.count;
    }

    if (currentCount >= 5) {
      return { success: false, error: 'Daily limit reached (5/5). Come back tomorrow!' };
    }

    try {
      // 1. Create Idea Doc
      await addDoc(collection(db, 'ideas'), {
        userId: user.id,
        username: user.username,
        text: ideaText,
        submittedAt: new Date().toISOString()
      });

      // 2. Update User (Reward + Submission Count)
      const newCount = currentCount + 1;

      await updateDoc(doc(db, 'users', user.id), {
        balance: increment(15), // Reward $15
        submissionData: {
          date: today,
          count: newCount
        }
      });

      return { success: true, message: 'Idea submitted! +$15.00' };
    } catch (e) {
      return { success: false, error: e.message };
    }
  };

  const updateUserGroups = async (targetUserId, groups) => {
    try {
      if (!user || user.role !== 'admin') return { success: false, error: 'Unauthorized' };
      const userRef = doc(db, 'users', targetUserId);
      await updateDoc(userRef, { groups: groups || [] });
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  };

  const deleteIdea = async (ideaId) => {
    if (!user || user.role !== 'admin') return { success: false, error: 'Unauthorized' };
    try {
      await updateDoc(doc(db, 'ideas', ideaId), { status: 'deleted' });
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  };

  const cascadeUserUpdates = async (userId, updates) => {
    const { username, profilePic } = updates;
    if (!username && !profilePic) return;

    try {
      console.log(`Starting cascade update for user ${userId}...`);
      let batch = writeBatch(db);
      let opCount = 0;
      const commitThreshold = 450;

      const commitBatchIfFull = async () => {
        if (opCount >= commitThreshold) {
          await batch.commit();
          batch = writeBatch(db);
          opCount = 0;
        }
      };

      // 1. Update Bets (username)
      if (username) {
        const betsQ = query(collection(db, 'bets'), where('userId', '==', userId));
        const betsSnap = await getDocs(betsQ);
        for (const docSnap of betsSnap.docs) {
          batch.update(docSnap.ref, { username: username });
          opCount++;
          await commitBatchIfFull();
        }
      }

      // 2. Update Parlays (creatorName, creatorProfilePic)
      const parlaysQ = query(collection(db, 'parlays'), where('creatorId', '==', userId));
      const parlaysSnap = await getDocs(parlaysQ);
      for (const docSnap of parlaysSnap.docs) {
        const updateData = {};
        if (username) updateData.creatorName = username;
        if (profilePic) updateData.creatorProfilePic = profilePic;

        if (Object.keys(updateData).length > 0) {
          batch.update(docSnap.ref, updateData);
          opCount++;
          await commitBatchIfFull();
        }
      }

      // 3. Update Ideas (username)
      if (username) {
        const ideasQ = query(collection(db, 'ideas'), where('userId', '==', userId));
        const ideasSnap = await getDocs(ideasQ);
        for (const docSnap of ideasSnap.docs) {
          batch.update(docSnap.ref, { username: username });
          opCount++;
          await commitBatchIfFull();
        }
      }

      // 4. Update Comments (username)
      if (username) {
        const commentsQ = query(collection(db, 'comments'), where('userId', '==', userId));
        const commentsSnap = await getDocs(commentsQ);
        for (const docSnap of commentsSnap.docs) {
          batch.update(docSnap.ref, { username: username });
          opCount++;
          await commitBatchIfFull();
        }
      }

      // 5. Update Squads (memberDetails)
      const squadsQ = query(collection(db, 'squads'), where('members', 'array-contains', userId));
      const squadsSnap = await getDocs(squadsQ);

      for (const docSnap of squadsSnap.docs) {
        const squad = docSnap.data();
        let changed = false;

        // Update memberDetails
        const newMemberDetails = (squad.memberDetails || []).map(member => {
          if (member.id === userId) {
            const newMember = { ...member };
            if (username) newMember.username = username;
            if (profilePic) newMember.profilePic = profilePic;

            if (newMember.username !== member.username || newMember.profilePic !== member.profilePic) {
              changed = true;
            }
            return newMember;
          }
          return member;
        });

        // Update requests if present
        let newRequests = squad.requests;
        if (squad.requests && squad.requests.length > 0) {
          newRequests = squad.requests.map(req => {
            if (req.userId === userId) {
              const newReq = { ...req };
              if (username) newReq.username = username;
              if (newReq.username !== req.username) changed = true;
              return newReq;
            }
            return req;
          });
        }

        if (changed) {
          const squadUpdate = { memberDetails: newMemberDetails };
          if (newRequests) squadUpdate.requests = newRequests;

          batch.update(docSnap.ref, squadUpdate);
          opCount++;
          await commitBatchIfFull();
        }
      }

      if (opCount > 0) {
        await batch.commit();
      }
      console.log("Cascade update complete.");

    } catch (e) {
      console.error("Cascade Update Failed:", e);
    }
  };

  const syncAllUsernames = async () => {
    if (!user || user.role !== 'admin') return { success: false, error: 'Unauthorized' };

    try {
      console.log("Starting full username sync...");
      const usersSnap = await getDocs(collection(db, 'users'));
      let totalUpdated = 0;

      for (const userDoc of usersSnap.docs) {
        const userData = userDoc.data();
        const userId = userDoc.id;

        // Trigger update with current data
        // This forces the cascade logic to run and overwrite any stale data in other collections
        await cascadeUserUpdates(userId, {
          username: userData.username,
          profilePic: userData.profilePic
        });
        totalUpdated++;
        console.log(`Synced user ${totalUpdated}/${usersSnap.size}: ${userData.username}`);
      }

      return { success: true, message: `Synced ${totalUpdated} users.` };
    } catch (e) {
      console.error("Sync All Failed:", e);
      return { success: false, error: e.message };
    }
  };

  const updateUser = async (updates) => {
    if (!user) return { success: false, error: 'Not logged in' };

    try {
      // Capture old state for comparison
      const oldUsername = user.username;
      const oldProfilePic = user.profilePic;

      // 1. Update Firestore FIRST
      const firestoreUpdates = { ...updates };
      delete firestoreUpdates.password;

      await updateDoc(doc(db, 'users', user.id), firestoreUpdates);

      // Update local state immediately
      setUser(prev => ({ ...prev, ...firestoreUpdates }));

      // --- TRIGGER CASCADE UPDATES ---
      const shouldCascade = (updates.username && updates.username !== oldUsername) ||
        (updates.profilePic && updates.profilePic !== oldProfilePic);

      if (shouldCascade) {
        await cascadeUserUpdates(user.id, {
          username: updates.username !== oldUsername ? updates.username : null,
          profilePic: updates.profilePic !== oldProfilePic ? updates.profilePic : null
        });
      }

      // 2. Attempt Auth Updates
      let authUpdated = false;
      let authErrorMsg = '';

      try {
        if (updates.email && auth.currentUser) {
          const currentAuthEmail = auth.currentUser.email;
          if (updates.email.toLowerCase() !== currentAuthEmail.toLowerCase()) {
            try {
              await updateEmail(auth.currentUser, updates.email);
              authUpdated = true;
            } catch (emailErr) {
              if (emailErr.code === 'auth/operation-not-allowed' || emailErr.message.includes('verify')) {
                await verifyBeforeUpdateEmail(auth.currentUser, updates.email);
                return { success: true, message: `Profile saved & Verification sent to ${updates.email}.` };
              }
              throw emailErr;
            }
          }
        }

        if (updates.password && updates.password.length > 0) {
          if (auth.currentUser) {
            await updatePassword(auth.currentUser, updates.password);
            authUpdated = true;
          }
        }

        if (authUpdated && auth.currentUser) {
          await auth.currentUser.reload();
        }

      } catch (authErr) {
        console.error("Auth Update Failed:", authErr);
        if (authErr.code === 'auth/requires-recent-login') {
          authErrorMsg = " (Note: Re-login required to update Email/Password)";
        } else {
          authErrorMsg = ` (Auth Error: ${authErr.message})`;
        }
      }

      const successMsg = authUpdated
        ? 'Account & Profile updated!'
        : 'Profile updated!' + authErrorMsg;

      return { success: true, message: authUpdated ? 'Account & Profile updated!' : 'Profile updated!' + authErrorMsg };

    } catch (e) {
      console.error("Firestore Update Error:", e);
      return { success: false, error: e.message };
    }
  }

  const recalculateLeaderboard = async () => {
    if (!user || user.role !== 'admin') return { success: false, error: 'Unauthorized' };
    try {
      // 1. Fetch all pending bets
      const betsQ = query(collection(db, 'bets'), where('status', '==', 'pending'));
      const betsSnap = await getDocs(betsQ);
      // If index missing, this line throws.

      const investmentsByUser = {};
      betsSnap.docs.forEach(doc => {
        const bet = doc.data();
        if (!investmentsByUser[bet.userId]) investmentsByUser[bet.userId] = 0;
        investmentsByUser[bet.userId] += (bet.amount || 0);
      });

      // 2. Fetch all users to update their stats
      const usersSnap = await getDocs(collection(db, 'users'));
      const batch = writeBatch(db);
      let updateCount = 0;

      usersSnap.docs.forEach(userDoc => {
        const uid = userDoc.id;
        const currentInvested = userDoc.data().invested || 0;
        const correctInvested = investmentsByUser[uid] || 0;

        // Only update if different to save writes
        if (Math.abs(currentInvested - correctInvested) > 0.01) {
          batch.update(userDoc.ref, { invested: correctInvested });
          updateCount++;
        }
      });

      if (updateCount > 0) await batch.commit();
      return { success: true, message: `Recalculated! Updated ${updateCount} users.` };
    } catch (e) {
      console.error("Recalc Detailed Error:", e);
      let errMsg = e.message || String(e);
      if (errMsg.includes("index")) errMsg = "Missing Index! Check Browser Console (F12) for the creation link.";
      return { success: false, error: errMsg };
    }
  };

  const backfillLastBetPercent = async () => {
    if (!user || user.role !== 'admin') return { success: false, error: 'Unauthorized' };
    try {
      console.log("Starting Backfill...");
      const usersSnap = await getDocs(collection(db, 'users'));
      const batch = writeBatch(db);
      let updateCount = 0;

      // Process users in chunks to avoid blowing up memory/batch limits if many users
      // But for <500 users, loop is fine. Batch limit is 500 ops.

      for (const userDoc of usersSnap.docs) {
        const uid = userDoc.id;

        // Get all bets for user (we crave the most recent settled one)
        const betsQ = query(collection(db, 'bets'), where('userId', '==', uid));
        const betsSnap = await getDocs(betsQ);

        let lastSettledBet = null;

        // Find latest settled bet in memory
        const settledBets = betsSnap.docs
          .map(d => ({ ...d.data(), id: d.id }))
          .filter(b => b.status === 'won' || b.status === 'lost')
          .sort((a, b) => {
            const dateA = new Date(a.settledAt || a.placedAt || 0);
            const dateB = new Date(b.settledAt || b.placedAt || 0);
            return dateB - dateA; // Descending
          });

        if (settledBets.length > 0) {
          lastSettledBet = settledBets[0];

          const isWinner = lastSettledBet.status === 'won';
          const userData = userDoc.data();
          const currentNetWorth = (userData.balance || 0) + (userData.invested || 0);

          const profit = isWinner
            ? (lastSettledBet.potentialPayout - lastSettledBet.amount)
            : -lastSettledBet.amount;

          // Approximate Pre-Bet Net Worth
          // Current Net Worth DOES include this bet's result (since it's settled).
          // So we subtract the profit to get the pre-bet value.
          const preBetNetWorth = currentNetWorth - profit;

          // Avoid division by zero
          const percentChange = preBetNetWorth > 0
            ? (profit / preBetNetWorth) * 100
            : 0;

          batch.update(userDoc.ref, { lastBetPercent: percentChange });
          updateCount++;
        }
      }

      if (updateCount > 0) await batch.commit();
      return { success: true, message: `Updated ${updateCount} users with last bet stats.` };

    } catch (e) {
      console.error(e);
      return { success: false, error: e.message };
    }
  };

  const demoteSelf = async () => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'users', user.id), { role: 'user' });
      // setUser({...user, role: 'user'}); // Optimistic update
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  };

  const deleteAccount = async () => {
    if (!user) return { success: false };
    isDeletingAccount.current = true; // Set flag to prevent resurrection
    try {
      const userId = user.id;

      // Helper to delete in batches
      const commitBatchBuffer = async (docsToDelete) => {
        const CHUNK_SIZE = 400;
        for (let i = 0; i < docsToDelete.length; i += CHUNK_SIZE) {
          const chunk = docsToDelete.slice(i, i + CHUNK_SIZE);
          const batch = writeBatch(db);
          chunk.forEach(ref => batch.delete(ref));
          await batch.commit();
        }
      };

      const allDocsToDelete = [];

      // 1. Bets
      const betsSnap = await getDocs(query(collection(db, 'bets'), where('userId', '==', userId)));
      betsSnap.docs.forEach(d => allDocsToDelete.push(d.ref));

      // 2. Ideas
      const ideasSnap = await getDocs(query(collection(db, 'ideas'), where('userId', '==', userId)));
      ideasSnap.docs.forEach(d => allDocsToDelete.push(d.ref));

      // 3. Comments (To ensure complete erasure)
      const commentsSnap = await getDocs(query(collection(db, 'comments'), where('userId', '==', userId)));
      commentsSnap.docs.forEach(d => allDocsToDelete.push(d.ref));

      // 4. Notifications
      const notifSnap = await getDocs(query(collection(db, 'notifications'), where('userId', '==', userId)));
      notifSnap.docs.forEach(d => allDocsToDelete.push(d.ref));

      // 5. User Profile
      allDocsToDelete.push(doc(db, 'users', userId));

      console.log(`Deleting account ${userId}: ${allDocsToDelete.length} documents total.`);

      // Execute Firestore Deletions
      await commitBatchBuffer(allDocsToDelete);

      // 6. Delete Auth Account
      if (auth.currentUser) {
        await auth.currentUser.delete();
      }

      return { success: true };
    } catch (e) {
      isDeletingAccount.current = false; // Reset flag on error
      console.error("Delete Error:", e);
      if (e.code === 'auth/requires-recent-login') {
        return { success: false, error: "Please log out and log in again to delete your account." };
      }
      return { success: false, error: e.message };
    }
  };

  const deleteUser = async (targetUserId) => {
    if (!user || user.role !== 'admin') return { success: false, error: 'Unauthorized' };
    try {
      // Helper to delete in batches
      const commitBatchBuffer = async (docsToDelete) => {
        const CHUNK_SIZE = 400; // Safety margin below 500
        for (let i = 0; i < docsToDelete.length; i += CHUNK_SIZE) {
          const chunk = docsToDelete.slice(i, i + CHUNK_SIZE);
          const batch = writeBatch(db);
          chunk.forEach(ref => batch.delete(ref));
          await batch.commit();
        }
      };

      const allDocsToDelete = [];

      // 1. Bets
      const betsSnap = await getDocs(query(collection(db, 'bets'), where('userId', '==', targetUserId)));
      betsSnap.docs.forEach(d => allDocsToDelete.push(d.ref));

      // 2. Ideas
      const ideasSnap = await getDocs(query(collection(db, 'ideas'), where('userId', '==', targetUserId)));
      ideasSnap.docs.forEach(d => allDocsToDelete.push(d.ref));

      // 3. Comments (New)
      const commentsSnap = await getDocs(query(collection(db, 'comments'), where('userId', '==', targetUserId)));
      commentsSnap.docs.forEach(d => allDocsToDelete.push(d.ref));

      // 4. Notifications (New)
      const notifSnap = await getDocs(query(collection(db, 'notifications'), where('userId', '==', targetUserId)));
      notifSnap.docs.forEach(d => allDocsToDelete.push(d.ref));

      // 5. User Profile
      allDocsToDelete.push(doc(db, 'users', targetUserId));

      console.log(`Deleting user ${targetUserId}: ${allDocsToDelete.length} documents total.`);

      await commitBatchBuffer(allDocsToDelete);

      return { success: true };
    } catch (e) {
      console.error("Delete User Error:", e);
      return { success: false, error: e.message };
    }
  };

  const syncEventStats = async () => {
    if (!user || user.role !== 'admin') return { success: false, error: 'Unauthorized' };
    try {
      // 1. Fetch all bets
      const betsSnap = await getDocs(collection(db, 'bets'));
      const allBets = betsSnap.docs.map(d => d.data());

      // 2. Aggregate Stats
      const statsMap = {}; // eventId -> { counts: {}, amounts: {}, totalBets: 0, totalPool: 0 }

      for (const bet of allBets) {
        if (!statsMap[bet.eventId]) {
          statsMap[bet.eventId] = { counts: {}, amounts: {}, totalBets: 0, totalPool: 0 };
        }
        const s = statsMap[bet.eventId];
        s.totalBets += 1;
        s.totalPool += (bet.amount || 0);
        s.counts[bet.outcomeId] = (s.counts[bet.outcomeId] || 0) + 1;
        s.amounts[bet.outcomeId] = (s.amounts[bet.outcomeId] || 0) + (bet.amount || 0);
      }

      // 3. Update Events
      const eventsSnap = await getDocs(collection(db, 'events'));
      const updatePromises = eventsSnap.docs.map(async (docSnap) => {
        const stats = statsMap[docSnap.id] || { counts: {}, amounts: {}, totalBets: 0, totalPool: 0 };
        await updateDoc(doc(db, 'events', docSnap.id), { stats });
      });

      await Promise.all(updatePromises);
      return { success: true };
    } catch (e) {
      console.error(e);
      return { success: false, error: e.message };
    }
  };

  const addComment = async (eventId, text) => {
    if (!user) return { success: false, error: 'Login to comment' };
    try {
      const commentData = {
        eventId,
        userId: user.id,
        username: user.username,
        text,
        createdAt: new Date().toISOString()
      };
      await addDoc(collection(db, 'comments'), commentData);

      // Update Event with lastComment for preview
      await updateDoc(doc(db, 'events', eventId), {
        lastComment: {
          username: user.username,
          text: text.length > 50 ? text.substring(0, 50) + '...' : text,
          createdAt: commentData.createdAt
        }
      });

      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  };

  const deleteComment = async (commentId) => {
    if (!user || user.role !== 'admin') return { success: false, error: 'Unauthorized' };
    try {
      // 1. Get comment details before deleting (to find parent event)
      const commentRef = doc(db, 'comments', commentId);
      const commentSnap = await getDoc(commentRef);

      if (!commentSnap.exists()) {
        return { success: false, error: 'Comment already deleted' };
      }

      const val = commentSnap.data();
      const eventId = val.eventId;
      const commentCreatedAt = val.createdAt;

      // 2. Delete the comment
      await deleteDoc(commentRef);

      // 3. Check if this was the "lastComment" on the event card
      if (eventId) {
        const eventRef = doc(db, 'events', eventId);
        const eventSnap = await getDoc(eventRef);

        if (eventSnap.exists()) {
          const eventData = eventSnap.data();
          // Check if the displayed lastComment matches the one we just deleted
          if (eventData.lastComment && eventData.lastComment.createdAt === commentCreatedAt) {
            // It was the one displayed! We need to find the new latest comment.
            // Fetch all remaining comments for this event
            const q = query(collection(db, 'comments'), where('eventId', '==', eventId));
            const snap = await getDocs(q);

            if (!snap.empty) {
              // Find the newest one
              const all = snap.docs.map(d => d.data());
              all.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
              const newest = all[0];

              await updateDoc(eventRef, {
                lastComment: {
                  username: newest.username,
                  text: newest.text.length > 50 ? newest.text.substring(0, 50) + '...' : newest.text,
                  createdAt: newest.createdAt
                }
              });
            } else {
              // No comments left
              await updateDoc(eventRef, {
                lastComment: deleteField()
              });
            }
          }
        }
      }

      return { success: true };
    } catch (e) {
      console.error(e);
      return { success: false, error: e.message };
    }
  };

  const toggleLikeComment = async (commentId, currentLikes = []) => {
    if (!user) return { success: false, error: 'Login to like' };
    try {
      const commentRef = doc(db, 'comments', commentId);
      const isLiked = currentLikes.includes(user.id);

      if (isLiked) {
        await updateDoc(commentRef, { likes: arrayRemove(user.id) });
      } else {
        await updateDoc(commentRef, { likes: arrayUnion(user.id) });
      }
      return { success: true };
    } catch (e) {
      console.error(e);
      return { success: false, error: e.message };
    }
  };

  const markNotificationAsRead = async (notifId) => {
    try {
      await updateDoc(doc(db, 'notifications', notifId), { read: true });
    } catch (e) { console.error(e); }
  };



  const getUserStats = async (targetUserId) => {
    try {
      const userRef = doc(db, 'users', targetUserId);
      const userSnap = await getDoc(userRef);
      const userData = userSnap.exists() ? userSnap.data() : {};

      const betsQ = query(collection(db, 'bets'), where('userId', '==', targetUserId));
      const snap = await getDocs(betsQ);
      let wins = 0;
      let losses = 0;
      let profit = 0;
      let settledCount = 0;

      snap.docs.forEach(d => {
        const b = d.data();
        if (b.status === 'won') {
          wins++;
          settledCount++;
          profit += ((b.potentialPayout || (b.amount * b.odds)) - b.amount);
        } else if (b.status === 'lost') {
          losses++;
          settledCount++;
          profit -= b.amount;
        }
      });

      const total = snap.size;
      const winRate = settledCount > 0 ? ((wins / settledCount) * 100).toFixed(1) : 0;

      return {
        success: true,
        stats: { wins, losses, total, winRate, profit },
        profile: { bio: userData.bio || '', profilePic: userData.profilePic, username: userData.username, groups: userData.groups || [] }
      };
    } catch (e) { console.error(e); return { success: false, error: e.message }; }
  };

  const getWeeklyLeaderboard = async () => {
    try {
      const now = new Date();
      const dayOfWeek = now.getDay(); // 0 (Sun) - 6 (Sat)
      const startOfWeek = new Date(now);
      // Reset to most recent Sunday (or today if it is Sunday)
      startOfWeek.setDate(now.getDate() - dayOfWeek);
      startOfWeek.setHours(0, 0, 0, 0);
      const isoStr = startOfWeek.toISOString();

      console.log("Fetching weekly stats since:", isoStr);

      const q = query(collection(db, 'bets'), where('status', 'in', ['won', 'lost']), where('settledAt', '>=', isoStr));
      const snap = await getDocs(q);

      const stats = {};
      snap.docs.forEach(doc => {
        const b = doc.data();
        if (!stats[b.userId]) stats[b.userId] = 0;
        if (b.status === 'won') {
          // Profit = Payout - Wager
          const payout = b.potentialPayout || (b.amount * b.odds);
          stats[b.userId] += (payout - b.amount);
        } else {
          // Loss = -Wager
          stats[b.userId] -= b.amount;
        }
      });

      const leaderboard = Object.entries(stats).map(([userId, profit]) => ({ userId, profit }));
      leaderboard.sort((a, b) => b.profit - a.profit);
      return { success: true, data: leaderboard };
    } catch (e) {
      console.error("Weekly Leaderboard Error:", e);
      let msg = e.message;
      if (msg.includes("index")) msg = "Missing Index! Check console (F12) for the creation link.";
      return { success: false, error: msg };
    }
  };

  const updateSystemAnnouncement = async (data) => {
    if (!user || user.role !== 'admin') return { success: false, error: 'Unauthorized' };
    try {
      const docRef = doc(db, 'system', 'announcement');
      // Merge true to allow partial updates if needed, though usually we replace content
      await setDoc(docRef, data, { merge: true });
      return { success: true };
    } catch (e) {
      console.error(e);
      alert("Error posting announcement: " + e.message); // Debug
      return { success: false, error: e.message };
    }
  };


  const reviewIdea = async (ideaId, status) => {
    if (!user || (!user.groups?.includes('Moderator') && user.role !== 'admin')) return { success: false, error: 'Unauthorized' };
    try {
      const ideaRef = doc(db, 'ideas', ideaId);

      // Fetch idea to get text for notification
      const ideaSnap = await getDoc(ideaRef);
      const ideaText = ideaSnap.exists() ? ideaSnap.data().text : 'Unknown Idea';

      await updateDoc(ideaRef, {
        status: status, // 'approved' or 'denied'
        reviewedBy: user.username,
        reviewedAt: new Date().toISOString()
      });

      // Notify Admins
      const adminsQ = query(collection(db, 'users'), where('role', '==', 'admin'));
      const adminsSnap = await getDocs(adminsQ);

      if (!adminsSnap.empty) {
        const batch = writeBatch(db);
        const icon = status === 'approved' ? '✅' : '❌';
        const title = `Mod ${status === 'approved' ? 'Approved' : 'Denied'} Idea`;

        adminsSnap.forEach(adminDoc => {
          // Verify we aren't notifying ourselves if we are also an admin (optional, but good UX)
          if (adminDoc.id === user.id) return; // Skip self-notification? Actually maybe admin wants to see it too. Let's keep it for record.

          const notifRef = doc(collection(db, 'notifications'));
          batch.set(notifRef, {
            userId: adminDoc.id,
            type: 'mod_review',
            title: title,
            message: `${icon} ${user.username} ${status} idea: "${ideaText}"`,
            read: false,
            relatedIdeaId: ideaId,
            createdAt: new Date().toISOString()
          });
        });

        // Only commit if we have updates
        // (If there are other admins besides me)
        // If I am the only admin and I am the mod, I probably don't need a notification? 
        // User request: "notifies the admin". 
        // Let's just commit whatever is in the batch.
        await batch.commit();
      }

      return { success: true };
    } catch (e) {
      console.error(e); // Helpful for debugging
      return { success: false, error: e.message };
    }
  };

  const replyToIdea = async (ideaId, replyMessage) => {
    if (!user || user.role !== 'admin') return { success: false, error: 'Unauthorized' };
    if (!replyMessage.trim()) return { success: false, error: 'Message empty' };

    console.log("replyToIdea running with message:", replyMessage);

    try {
      const ideaRef = doc(db, 'ideas', ideaId);
      const ideaSnap = await getDoc(ideaRef);
      if (!ideaSnap.exists()) return { success: false, error: 'Idea not found' };

      const ideaData = ideaSnap.data();

      // 1. Update Idea with Admin Reply
      await updateDoc(ideaRef, {
        adminReply: replyMessage,
        repliedBy: user.username,
        repliedAt: new Date().toISOString(),
        status: 'reviewed' // Optional: Mark as reviewed
      });

      // 2. Notify the User (if userId exists)
      if (ideaData.userId) {
        const safeTitle = ideaData.text.length > 50 ? ideaData.text.substring(0, 50) + '...' : ideaData.text;
        await addDoc(collection(db, 'notifications'), {
          userId: ideaData.userId,
          type: 'admin_reply',
          title: `New Response to ${safeTitle}!`,
          message: replyMessage,
          read: false,
          createdAt: new Date().toISOString(),
          relatedIdeaId: ideaId
        });
      }

      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  };

  const sendIdeaToAdmin = async (ideaId, ideaText) => {
    if (!user || (!user.groups?.includes('Moderator') && user.role !== 'admin')) return { success: false, error: 'Unauthorized' };
    try {
      // 1. Mark idea as recommended
      const ideaRef = doc(db, 'ideas', ideaId);
      await updateDoc(ideaRef, {
        modRecommended: true,
        recommendedBy: user.username,
        recommendedAt: new Date().toISOString()
      });

      // 2. Notify Admins
      const adminsQ = query(collection(db, 'users'), where('role', '==', 'admin'));
      const adminsSnap = await getDocs(adminsQ);
      const batch = writeBatch(db);

      adminsSnap.forEach(adminDoc => {
        const notifRef = doc(collection(db, 'notifications'));
        batch.set(notifRef, {
          userId: adminDoc.id,
          type: 'admin_alert',
          title: '🛡️ Mod Recommendation',
          message: `Mod ${user.username} thinks this looks good: "${ideaText}"`,
          read: false,
          createdAt: new Date().toISOString()
        });
      });

      await batch.commit();
      return { success: true };
    } catch (e) {
      console.error(e);
      return { success: false, error: e.message };
    }
  };

  const clearAllNotifications = async () => {
    if (!user) return { success: false, error: 'Not logged in' };
    try {
      const q = query(collection(db, 'notifications'), where('userId', '==', user.id));
      const snap = await getDocs(q);
      const batch = writeBatch(db);
      snap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
      setNotifications([]); // Optimistic update
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  };

  const submitModConcern = async (message) => {
    if (!user || (!user.groups?.includes('Moderator') && user.role !== 'admin')) return { success: false, error: 'Unauthorized' };
    if (!message.trim()) return { success: false, error: 'Message empty' };

    try {
      const adminsQ = query(collection(db, 'users'), where('role', '==', 'admin'));
      const adminsSnap = await getDocs(adminsQ);
      const batch = writeBatch(db);

      adminsSnap.forEach(adminDoc => {
        const notifRef = doc(collection(db, 'notifications'));
        batch.set(notifRef, {
          userId: adminDoc.id,
          type: 'mod_concern',
          title: '🚨 Mod Concern',
          message: `${user.username}: ${message}`,
          read: false,
          createdAt: new Date().toISOString()
        });
      });

      await batch.commit();
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  };

  const createParlay = async (legs, baseMultiplier, finalMultiplier, initialWager, title = '') => {
    if (!user) return { success: false, error: 'Not logged in' };
    if (initialWager <= 0) return { success: false, error: 'Initial bet required' };
    if (user.balance < initialWager) return { success: false, error: 'Insufficient funds for initial bet' };

    try {
      // 1. Create the Parlay Document
      const parlayRef = await addDoc(collection(db, 'parlays'), {
        creatorId: user.id,
        creatorName: user.username,
        creatorProfilePic: user.profilePic || null,
        title: title || '', // Add title here
        legs,
        baseMultiplier,
        finalMultiplier,
        status: 'active',
        createdAt: new Date().toISOString(),
        wagersCount: 0,
        totalPool: 0
      });

      // 2. Place the initial bet
      const betRes = await placeParlayBet(parlayRef.id, parseFloat(initialWager));
      if (!betRes.success) {
        // Fallback: If bet fails (rare), we might want to delete the parlay or just warn?
        // For now, let's just return partial success error, or maybe just delete the parlay to be safe.
        // await deleteDoc(parlayRef); // Safest
        // return { success: false, error: "Failed to place initial bet: " + betRes.error };

        // Actually, let's keep it simple. If bet logic is sound, this shouldn't fail given balance check.
        return { success: false, error: "Parlay created but bet failed: " + betRes.error };
      }

      return { success: true, parlayId: parlayRef.id };
    } catch (e) {
      return { success: false, error: e.message };
    }
  };

  const placeParlayBet = async (parlayId, amount) => {
    if (!user) return { success: false, error: 'Not logged in' };
    if (user.balance < amount) return { success: false, error: 'Insufficient funds' };

    try {
      const parlayRef = doc(db, 'parlays', parlayId);
      const parlaySnap = await getDoc(parlayRef);
      if (!parlaySnap.exists()) return { success: false, error: "Parlay not found" };
      const parlay = parlaySnap.data();

      // Deduct Balance
      const userRef = doc(db, 'users', user.id);

      // Update streak (Reuse logic from placeBet if I had it extracted, but duplicating for safety now to avoid refactor risks)
      const today = new Date();
      const todayStr = today.toDateString();
      const yesterday = new Date();
      yesterday.setDate(today.getDate() - 1);
      const yesterdayStr = yesterday.toDateString();

      let newStreak = user.currentStreak || 0;
      const lastDate = user.lastBetDate || "";

      let streakType = 'none';
      if (lastDate !== todayStr) {
        if (lastDate === yesterdayStr) {
          newStreak += 1;
          streakType = 'increased';
        } else {
          newStreak = 1;
          streakType = 'started';
        }
      } else {
        if (newStreak === 0) {
          newStreak = 1;
          streakType = 'started';
        }
      }
      const newLongest = Math.max(newStreak, user.longestStreak || 0);

      await updateDoc(userRef, {
        balance: increment(-amount),
        invested: increment(amount),
        currentStreak: newStreak,
        longestStreak: newLongest,
        lastBetDate: todayStr
      });

      // Create Parlay Bet
      // Note: outcomeId is null, outcomeLabel is "Parlay", but we store legs.
      await addDoc(collection(db, 'bets'), {
        userId: user.id,
        username: user.username,
        type: 'parlay',
        parlayId: parlayId,
        legs: parlay.legs,
        amount: parseFloat(amount),
        odds: parlay.finalMultiplier, // Store as 'odds' for compatibility with display if needed
        potentialPayout: amount * parlay.finalMultiplier,
        status: 'pending',
        placedAt: new Date().toISOString(),
        eventTitle: 'Parlay Ticket', // For basic display compatibility
        outcomeLabel: `${parlay.legs.length} Legs`
      });

      // Check if parlay has started (Locked Boost Logic)
      // We must fetch leg events to be sure about start time
      let boostLocked = false;
      const legEventSnaps = await Promise.all(parlay.legs.map(l => getDoc(doc(db, 'events', l.eventId))));
      const now = new Date();

      for (const snap of legEventSnaps) {
        if (snap.exists()) {
          const e = snap.data();
          let start;
          if (e.startAt && e.startAt.seconds) start = new Date(e.startAt.seconds * 1000);
          else if (e.startAt) start = new Date(e.startAt);

          if (start && start < now) {
            boostLocked = true;
            // CRITICAL: If a leg has started, the parlay is locked/closed. No new bets allowed.
            // Unless user is creator? No, even creator should not bet on started legs (would manipulate odds).
            throw new Error(`Event "${e.title}" has already started.`);
          }
        }
      }

      // Update Parlay Stats
      // Only count unique tails if not creator and not locked
      const isCreator = user.id === parlay.creatorId;

      const parlayUpdate = {
        wagersCount: increment(1),
        totalPool: increment(amount)
      };

      if (!isCreator && !boostLocked) {
        parlayUpdate.tailedBy = arrayUnion(user.id);
      }

      await updateDoc(parlayRef, parlayUpdate);

      return { success: true, streakType, newStreak };
    } catch (e) {
      return { success: false, error: e.message };
    }
  };

  const addParlayComment = async (parlayId, text) => {
    if (!user) return { success: false, error: 'Login to comment' };
    try {
      const commentData = {
        parlayId,
        userId: user.id,
        username: user.username,
        text,
        createdAt: new Date().toISOString()
      };
      await addDoc(collection(db, 'comments'), commentData);

      // Update Parlay with lastComment for preview
      await updateDoc(doc(db, 'parlays', parlayId), {
        lastComment: {
          username: user.username,
          text: text.length > 50 ? text.substring(0, 50) + '...' : text,
          createdAt: commentData.createdAt
        }
      });

      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  };

  const deleteParlay = async (parlayId) => {
    if (user?.role !== 'admin') return { success: false, error: 'Unauthorized' };
    try {
      await deleteDoc(doc(db, 'parlays', parlayId));
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  };


  const createSquad = async (name, privacy = 'open', description = '') => {
    if (!user) return { success: false, error: 'Not logged in' };
    if (user.squadId) return { success: false, error: 'You are already in a squad!' };

    // Validate name uniqueness (simple check)
    const existingSquad = squads.find(s => s.name.toLowerCase() === name.trim().toLowerCase());
    if (existingSquad) return { success: false, error: 'Squad name already taken.' };

    try {
      const batch = writeBatch(db);
      const squadRef = doc(collection(db, 'squads'));
      const userRef = doc(db, 'users', user.id);

      const newSquad = {
        name: name.trim(),
        description: description.trim(),
        privacy, // 'open', 'request', 'invite'
        createdBy: user.id,
        leaderId: user.id,
        createdAt: new Date().toISOString(),
        members: [user.id],
        memberDetails: [{ // Store basic details for quicker access without joining users
          id: user.id,
          username: user.username,
          profilePic: user.profilePic || null,
          role: 'leader'
        }],
        requests: [], // Apply requests
        wallet: { balance: 0, history: [] },
        parlays: [] // Parlay IDs
      };

      batch.set(squadRef, newSquad);
      batch.update(userRef, { squadId: squadRef.id });

      await batch.commit();

      // Optimistic user update
      setUser(prev => ({ ...prev, squadId: squadRef.id }));

      return { success: true, squadId: squadRef.id };
    } catch (e) {
      console.error(e);
      return { success: false, error: e.message };
    }
  };

  const joinSquad = async (squadId) => {
    if (!user) return { success: false, error: 'Not logged in' };
    if (user.squadId) return { success: false, error: 'Leave your current squad first.' };

    try {
      const squadRef = doc(db, 'squads', squadId);
      const userRef = doc(db, 'users', user.id);

      const squad = squads.find(s => s.id === squadId);
      if (!squad) return { success: false, error: 'Squad not found' };

      if (squad.privacy === 'invite-only') return { success: false, error: 'This squad is invite only' };

      if (squad.privacy === 'request') {
        // Check if already requested
        if (squad.requests?.some(r => r.userId === user.id)) {
          return { success: false, error: 'Already requested' };
        }
        await updateDoc(squadRef, {
          requests: arrayUnion({
            userId: user.id,
            username: user.username,
            requestedAt: new Date().toISOString()
          })
        });
        return { success: true, status: 'requested', message: 'Request sent to squad leader.' };
      }

      // If Open, join directly
      const batch = writeBatch(db);

      // Add to squad members
      batch.update(squadRef, {
        members: arrayUnion(user.id),
        memberDetails: arrayUnion({
          id: user.id,
          username: user.username,
          profilePic: user.profilePic || null,
          role: 'member'
        })
      });

      // Update user
      batch.update(userRef, { squadId: squadId });

      await batch.commit();

      setUser(prev => ({ ...prev, squadId: squadId }));

      // Send notification to leader
      if (squad.leaderId && squad.leaderId !== user.id) {
        try {
          await addDoc(collection(db, 'notifications'), {
            userId: squad.leaderId,
            type: 'squad_join',
            title: 'New Squad Member',
            message: `${user.username} has joined your squad!`,
            read: false,
            createdAt: new Date().toISOString(),
            metadata: {
              squadId: squadId,
              newMemberId: user.id
            }
          });
        } catch (err) {
          console.error("Failed to notify leader", err);
        }
      }

      return { success: true, status: 'joined', message: 'Welcome to the squad!' };

    } catch (e) {
      return { success: false, error: e.message };
    }
  };

  const leaveSquad = async () => {
    if (!user || !user.squadId) return { success: false, error: 'Not in a squad' };

    try {
      const squadRef = doc(db, 'squads', user.squadId);
      const userRef = doc(db, 'users', user.id);

      const squad = squads.find(s => s.id === user.squadId);
      if (!squad) {
        // Data inconsistency handling: just clear the user's squadId
        await updateDoc(userRef, { squadId: null });
        setUser(prev => ({ ...prev, squadId: null }));
        return { success: true };
      }

      const batch = writeBatch(db);

      // Remove from members
      // ArrayRemove for objects only works if the object is IDENTICAL. 
      // This is risky if member details changed. safer to read, filter, write back.
      // But for concurrent safety, we should use arrayRemove.
      // Let's rely on filter-write pattern for memberDetails since it's cleaner to manage roles there.

      const newMemberDetails = squad.memberDetails.filter(m => m.id !== user.id);
      const newMembers = squad.members.filter(uid => uid !== user.id);

      if (newMembers.length === 0) {
        // Squad empty -> Delete it
        batch.delete(squadRef);
      } else {
        // If leader is leaving, assign new leader (oldest member?)
        if (squad.leaderId === user.id) {
          const newLeader = newMemberDetails[0]; // First one remaining
          newLeader.role = 'leader';
          batch.update(squadRef, {
            members: newMembers,
            memberDetails: newMemberDetails,
            leaderId: newLeader.id
          });
        } else {
          batch.update(squadRef, {
            members: newMembers,
            memberDetails: newMemberDetails
          });
        }
      }

      batch.update(userRef, { squadId: null });

      await batch.commit();
      setUser(prev => ({ ...prev, squadId: null }));
      return { success: true };

    } catch (e) {
      return { success: false, error: e.message };
    }
  };

  const manageSquadRequest = async (squadId, targetUserId, action) => {
    // action: 'accept' | 'reject'
    if (!user) return { success: false, error: 'Not logged in' };
    const squad = squads.find(s => s.id === squadId);
    if (!squad) return { success: false, error: 'Squad not found' };
    if (squad.leaderId !== user.id && user.role !== 'admin') return { success: false, error: 'Only leader can manage requests' };

    try {
      const squadRef = doc(db, 'squads', squadId);
      const targetUserRef = doc(db, 'users', targetUserId);

      // Use filter to remove the request
      const newRequests = (squad.requests || []).filter(r => r.userId !== targetUserId);

      if (action === 'reject') {
        await updateDoc(squadRef, { requests: newRequests });
        return { success: true };
      }

      if (action === 'accept') {
        // Fetch target user strictly to get latest profile (pic/name)
        const targetSnap = await getDoc(targetUserRef);
        const targetData = targetSnap.data();

        const batch = writeBatch(db);

        // Update Squad: remove request, add member
        batch.update(squadRef, {
          requests: newRequests,
          members: arrayUnion(targetUserId),
          memberDetails: arrayUnion({
            id: targetUserId,
            username: targetData.username,
            profilePic: targetData.profilePic || null,
            role: 'member'
          })
        });

        // Update User
        batch.update(targetUserRef, { squadId: squadId });

        await batch.commit();
        return { success: true };
      }
    } catch (e) {
      return { success: false, error: e.message };
    }
  };

  const kickMember = async (squadId, targetUserId) => {
    if (!user) return { success: false, error: 'Not logged in' };
    const squad = squads.find(s => s.id === squadId);
    if (!squad) return { success: false, error: 'Squad not found' };
    if (squad.leaderId !== user.id && user.role !== 'admin') return { success: false, error: 'Only leader can kick' };

    try {
      const squadRef = doc(db, 'squads', squadId);
      const targetUserRef = doc(db, 'users', targetUserId);

      const newMembers = squad.members.filter(m => m !== targetUserId);
      const newMemberDetails = squad.memberDetails.filter(m => m.id !== targetUserId);

      const batch = writeBatch(db);
      batch.update(squadRef, {
        members: newMembers,
        memberDetails: newMemberDetails
      });
      batch.update(targetUserRef, { squadId: null });

      await batch.commit();

      // Notify kicked user
      try {
        await addDoc(collection(db, 'notifications'), {
          userId: targetUserId,
          type: 'squad_kick',
          title: 'Removed from Squad',
          message: `You have been removed from ${squad.name}.`,
          read: false,
          createdAt: new Date().toISOString()
        });
      } catch (err) { console.error("Notification Error:", err); }

      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  const transferSquadLeadership = async (squadId, newLeaderId) => {
    if (!user) return { success: false, error: 'Not logged in' };
    const squad = squads.find(s => s.id === squadId);
    if (!squad) return { success: false, error: 'Squad not found' };
    if (squad.leaderId !== user.id && user.role !== 'admin') return { success: false, error: 'Only leader can transfer leadership' };

    if (newLeaderId === user.id) return { success: false, error: "You are already the leader." };

    try {
      const squadRef = doc(db, 'squads', squadId);

      const newMemberDetails = squad.memberDetails.map(m => {
        if (m.id === newLeaderId) {
          return { ...m, role: 'leader' };
        }
        if (m.id === user.id) {
          return { ...m, role: 'top_dog' };
        }
        return m;
      });

      await updateDoc(squadRef, {
        leaderId: newLeaderId,
        memberDetails: newMemberDetails
      });

      // Notify new leader
      try {
        await addDoc(collection(db, 'notifications'), {
          userId: newLeaderId,
          type: 'squad_promotion',
          title: 'Promoted to Leader!',
          message: `You are now the LEADER of ${squad.name}!`,
          read: false,
          createdAt: new Date().toISOString()
        });
      } catch (err) { console.error("Notification Error:", err); }

      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  };

  const updateMemberRole = async (squadId, targetUserId, newRole) => {
    if (!user) return { success: false, error: 'Not logged in' };
    const squad = squads.find(s => s.id === squadId);
    if (!squad) return { success: false, error: 'Squad not found' };
    if (squad.leaderId !== user.id && user.role !== 'admin') return { success: false, error: 'Only leader can change roles' };

    if (targetUserId === squad.leaderId) return { success: false, error: "Cannot change leader's role this way." };

    try {
      const squadRef = doc(db, 'squads', squadId);
      const newMemberDetails = squad.memberDetails.map(m => {
        if (m.id === targetUserId) {
          return { ...m, role: newRole };
        }
        return m;
      });

      await updateDoc(squadRef, { memberDetails: newMemberDetails });

      // Notify user
      try {
        let title = 'Role Updated';
        let message = `Your role in ${squad.name} is now ${newRole}.`;
        if (newRole === 'top_dog') {
          title = 'Promoted to Top Dog!';
          message = `Congratulations! You've been promoted to Top Dog in ${squad.name}.`;
        } else if (newRole === 'member') {
          title = 'Role Changed';
          message = `Your role in ${squad.name} has been changed to Member.`;
        }

        await addDoc(collection(db, 'notifications'), {
          userId: targetUserId,
          type: 'squad_role_update',
          title: title,
          message: message,
          read: false,
          createdAt: new Date().toISOString()
        });
      } catch (err) { console.error("Notification Error:", err); }

      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  };

  const updateSquad = async (squadId, updates) => {
    if (!user) return { success: false, error: 'Not logged in' };
    const squad = squads.find(s => s.id === squadId);
    if (!squad) return { success: false, error: 'Squad not found' };
    if (squad.leaderId !== user.id && user.role !== 'admin') return { success: false, error: 'Only leader can update squad settings' };

    try {
      const squadRef = doc(db, 'squads', squadId);

      // Basic validation
      if (updates.name && updates.name.trim().length < 3) return { success: false, error: "Squad name must be at least 3 chars" };

      await updateDoc(squadRef, updates);
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  };

  const inviteUserToSquad = async (squadId, targetUsername) => {
    if (!user) return { success: false, error: 'Not logged in' };
    const squad = squads.find(s => s.id === squadId);
    if (!squad) return { success: false, error: 'Squad not found' };
    if (squad.leaderId !== user.id && user.role !== 'admin') return { success: false, error: 'Only leader can invite' };

    try {
      // 1. Find User by Username
      const q = query(collection(db, "users"), where("username", "==", targetUsername));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        return { success: false, error: "User not found." };
      }

      const targetDoc = querySnapshot.docs[0];
      const targetUser = targetDoc.data();
      const targetUserId = targetDoc.id;

      if (targetUser.squadId) {
        return { success: false, error: "User is already in a squad." };
      }

      if (targetUser.squadInvites && targetUser.squadInvites.some(inv => inv.squadId === squadId)) {
        return { success: false, error: "User already has an invite from this squad." };
      }

      // 2. Add Invite to User
      await updateDoc(doc(db, 'users', targetUserId), {
        squadInvites: arrayUnion({
          squadId: squadId,
          squadName: squad.name,
          invitedAt: new Date().toISOString(),
          invitedBy: user.username
        })
      });

      // 3. Send Notification
      try {
        await addDoc(collection(db, 'notifications'), {
          userId: targetUserId,
          type: 'squad_invite',
          title: 'Squad Invite',
          message: `You have been invited to join ${squad.name} by ${user.username}.`,
          read: false,
          createdAt: new Date().toISOString(),
          metadata: {
            squadId: squadId,
            invitedBy: user.username
          }
        });
      } catch (err) {
        console.error("Failed to send invite notification", err);
        // Continue, as core invite succeeded
      }

      return { success: true, message: `Invite sent to ${targetUsername}` };

    } catch (e) {
      console.error("Invite Error:", e);
      return { success: false, error: e.message };
    }
  };

  const respondToSquadInvite = async (squadId, action) => {
    // action: 'accept' | 'reject'
    if (!user) return { success: false, error: 'Not logged in' };
    if (!user.squadInvites) return { success: false, error: "No invites found." };

    const invite = user.squadInvites.find(i => i.squadId === squadId);
    if (!invite) return { success: false, error: "Invite no longer valid." };

    try {
      const userRef = doc(db, 'users', user.id);

      // Remove the invite first (optimistic for reject, necessary for accept)
      // Note: arrayRemove needs exact object match which is tricky if timestamps vary. 
      // Better to filter and update.
      const newInvites = user.squadInvites.filter(i => i.squadId !== squadId);

      if (action === 'reject') {
        await updateDoc(userRef, { squadInvites: newInvites });
        setUser(prev => ({ ...prev, squadInvites: newInvites }));
        return { success: true };
      }

      if (action === 'accept') {
        const squadRef = doc(db, 'squads', squadId);
        const squadSnap = await getDoc(squadRef);

        if (!squadSnap.exists()) {
          // Squad deleted?
          await updateDoc(userRef, { squadInvites: newInvites });
          setUser(prev => ({ ...prev, squadInvites: newInvites }));
          return { success: false, error: "Squad no longer exists." };
        }

        const batch = writeBatch(db);

        // Update Squad: Add member
        batch.update(squadRef, {
          members: arrayUnion(user.id),
          memberDetails: arrayUnion({
            id: user.id,
            username: user.username,
            profilePic: user.profilePic || null,
            role: 'member'
          })
        });

        // Update User: Set squadId, Remove invite
        batch.update(userRef, {
          squadId: squadId,
          squadInvites: newInvites
        });

        await batch.commit();

        const squadData = squadSnap.data();
        if (squadData.leaderId && squadData.leaderId !== user.id) {
          try {
            await addDoc(collection(db, 'notifications'), {
              userId: squadData.leaderId,
              type: 'squad_join',
              title: 'New Squad Member',
              message: `${user.username} has joined your squad!`,
              read: false,
              createdAt: new Date().toISOString(),
              metadata: {
                squadId: squadId,
                newMemberId: user.id
              }
            });
          } catch (e) { console.error(e); }
        }

        // Local state update handled by listener usually, but for immediate UI:
        setUser(prev => ({ ...prev, squadId: squadId, squadInvites: newInvites }));
        return { success: true };
      }

    } catch (e) {
      console.error("Respond Invite Error:", e);
      return { success: false, error: e.message };
    }
  };

  const depositToSquad = async (amount) => {
    if (!user || !user.squadId) return { success: false, error: 'Not in a squad' };
    if (amount <= 0) return { success: false, error: 'Invalid amount' };
    if ((user.balance || 0) < amount) return { success: false, error: 'Insufficient funds' };

    try {
      const batch = writeBatch(db);
      const userRef = doc(db, 'users', user.id);
      const squadRef = doc(db, 'squads', user.squadId);

      // Deduct from user
      batch.update(userRef, { 'balance': increment(-amount) });

      // Add to squad
      batch.update(squadRef, { 'wallet.balance': increment(amount) });

      // Record Transaction
      const transRef = doc(collection(db, 'transactions'));
      batch.set(transRef, {
        type: 'squad_deposit',
        userId: user.id,
        squadId: user.squadId,
        amount: amount,
        createdAt: new Date().toISOString()
      });

      await batch.commit();

      // Local update
      setUser(prev => ({ ...prev, balance: (prev.balance || 0) - amount }));

      return { success: true };
    } catch (e) {
      console.error("Deposit Error:", e);
      return { success: false, error: e.message };
    }
  };

  const withdrawFromSquad = async (amount) => {
    if (!user || !user.squadId) return { success: false, error: 'Not in a squad' };
    const squad = squads.find(s => s.id === user.squadId);
    if (!squad) return { success: false, error: 'Squad not found' };
    if (squad.leaderId !== user.id) return { success: false, error: 'Only leader can withdraw' };
    if (amount <= 0) return { success: false, error: 'Invalid amount' };
    if ((squad.wallet?.balance || 0) < amount) return { success: false, error: 'Insufficient squad funds' };

    try {
      const batch = writeBatch(db);
      const userRef = doc(db, 'users', user.id);
      const squadRef = doc(db, 'squads', user.squadId);

      // Add to user
      batch.update(userRef, { 'balance': increment(amount) });

      // Deduct from squad
      batch.update(squadRef, { 'wallet.balance': increment(-amount) });

      await batch.commit();

      setUser(prev => ({ ...prev, balance: (prev.balance || 0) + amount }));
      return { success: true };

    } catch (e) {
      return { success: false, error: e.message };
    }
  };

  const requestSquadWithdrawal = async (amount, reason) => {
    if (!user || !user.squadId) return { success: false, error: 'Not in a squad' };
    if (amount <= 0) return { success: false, error: 'Invalid amount' };

    const squad = squads.find(s => s.id === user.squadId);
    if (!squad) return { success: false, error: 'Squad not found' };
    if ((squad.wallet?.balance || 0) < amount) return { success: false, error: 'Insufficient squad funds' };

    try {
      const squadRef = doc(db, 'squads', user.squadId);
      const request = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        userId: user.id,
        username: user.username,
        amount: parseFloat(amount),
        reason,
        createdAt: new Date().toISOString(),
        status: 'pending'
      };

      await updateDoc(squadRef, {
        withdrawalRequests: arrayUnion(request)
      });
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  };

  const respondToWithdrawalRequest = async (squadId, request, approved) => {
    if (!user) return { success: false, error: 'Not logged in' };
    const squad = squads.find(s => s.id === squadId);
    if (!squad) return { success: false, error: 'Squad not found' };
    if (squad.leaderId !== user.id && user.role !== 'admin') return { success: false, error: 'Only leader can manage requests' };

    try {
      const squadRef = doc(db, 'squads', squadId);
      const userRef = doc(db, 'users', request.userId);
      const batch = writeBatch(db);

      if (approved) {
        if ((squad.wallet?.balance || 0) < request.amount) return { success: false, error: 'Insufficient squad funds' };
        // Transfer
        batch.update(squadRef, { 'wallet.balance': increment(-request.amount) });
        batch.update(userRef, { 'balance': increment(request.amount) });
      }

      // Remove request
      batch.update(squadRef, {
        withdrawalRequests: arrayRemove(request)
      });

      await batch.commit();
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  };

  const getSquadStats = async (squadId) => {
    try {
      const squadRef = doc(db, 'squads', squadId);
      const squadSnap = await getDoc(squadRef);
      if (!squadSnap.exists()) return { success: false, error: 'Squad not found' };

      const squadData = squadSnap.data();
      const memberIds = squadData.members || [];

      if (memberIds.length === 0) {
        return { success: true, stats: { bets: 0, wins: 0, winRate: 0, profit: 0 } };
      }

      // Query all bets where userId is in memberIds
      // optimized: iterate members and query their bets. Parallelize for speed.
      const promises = memberIds.map(async (mid) => {
        const q = query(collection(db, 'bets'), where('userId', '==', mid));
        const snap = await getDocs(q);
        return snap.docs.map(d => d.data());
      });

      const results = await Promise.all(promises);
      const allBets = results.flat();

      let totalBets = 0;
      let totalWins = 0;
      let totalSettled = 0;
      let totalProfit = 0;

      allBets.forEach(b => {
        if (b.status === 'won') {
          totalWins++;
          totalSettled++;
          totalProfit += ((b.potentialPayout || (b.amount * b.odds)) - b.amount);
          totalBets++;
        } else if (b.status === 'lost') {
          totalSettled++;
          totalProfit -= b.amount;
          totalBets++;
        } else {
          // open/pending
          totalBets++;
        }
      });
      const winRate = totalSettled > 0 ? ((totalWins / totalSettled) * 100).toFixed(1) : 0;

      // Calculate Squad Score
      // Rules: Min 50 total bets (activity) AND 10 settled bets (validity)
      let score = 0;
      if (totalSettled >= 10 && totalBets >= 50) {
        // Formula: Profit * (WinRate / 100)
        // Example: $1000 profit * 0.60 = 600
        // Formula: Profit * (WinRate / 10000)
        score = Math.floor(totalProfit * (parseFloat(winRate) / 10000));
      }

      // Update squad doc with new stats for sorting
      await updateDoc(squadRef, {
        stats: {
          bets: totalBets,
          wins: totalWins,
          winRate: parseFloat(winRate),
          profit: totalProfit,
          score: score
        }
      });

      return {
        success: true,
        stats: {
          bets: totalBets,
          wins: totalWins,
          winRate: winRate,
          profit: totalProfit,
          score: score
        }
      };

    } catch (e) {
      console.error("Squad Stats Error:", e);
      return { success: false, error: e.message };
    }
  };

  const searchUsers = (queryStr) => {

    if (!queryStr || queryStr.length === 0) {
      return users.filter(u => u.id !== user?.id).slice(0, 50);
    }
    const lower = queryStr.toLowerCase();
    return users.filter(u =>
      u.username && u.username.toLowerCase().includes(lower) && u.id !== user?.id
    ).slice(0, 50); // increased limit for better UX
  };

  const sendSystemNotification = async (title, message, targetGroup = 'all') => {
    if (!user || user.role !== 'admin') return { success: false, error: 'Unauthorized' };
    try {
      // Fetch ALL users (no limit)
      const usersSnap = await getDocs(collection(db, 'users'));

      let targets = [];
      if (targetGroup === 'all') {
        targets = usersSnap.docs;
      } else {
        targets = usersSnap.docs.filter(doc => {
          const u = doc.data();
          return u.groups && u.groups.includes(targetGroup);
        });
      }

      if (targets.length === 0) return { success: true, count: 0 };

      // Chunk batches (limit 500)
      const CHUNK_SIZE = 400;
      const chunks = [];

      for (let i = 0; i < targets.length; i += CHUNK_SIZE) {
        chunks.push(targets.slice(i, i + CHUNK_SIZE));
      }

      let count = 0;
      for (const chunk of chunks) {
        const batch = writeBatch(db);
        chunk.forEach(docSnap => {
          const notifRef = doc(collection(db, 'notifications'));
          batch.set(notifRef, {
            userId: docSnap.id,
            type: 'system',
            title: title,
            message: message,
            read: false,
            createdAt: new Date().toISOString()
          });
          count++;
        });
        await batch.commit();
      }

      return { success: true, count };
    } catch (e) {
      return { success: false, error: e.message };
    }
  };

  const sendSquadMessage = async (squadId, text) => {
    if (!user) return { success: false, error: 'Login required' };
    if (!text.trim()) return { success: false, error: 'Message empty' };

    try {
      // 1. Add Message
      await addDoc(collection(db, 'squads', squadId, 'messages'), {
        text: text.trim(),
        senderId: user.id,
        senderName: user.username,
        timestamp: new Date().toISOString(),
        isSystem: false
      });

      // 2. Notify Members (Async - don't block return)
      // Fetch squad to get members list
      // Creating an Immediately Invoked Async Function Expression (IIFE) or just running a promise chain without await
      // to keep UI responsive. However, in this simple app, we can just await it briefly or run it.
      (async () => {
        try {
          const squadRef = doc(db, 'squads', squadId);
          const squadSnap = await getDoc(squadRef);
          if (!squadSnap.exists()) return;

          const squadData = squadSnap.data();
          const members = squadData.members || [];

          const batch = writeBatch(db);
          let notificationCount = 0;

          members.forEach(memberId => {
            // Don't notify self
            if (memberId === user.id) return;

            const notifRef = doc(collection(db, 'notifications'));
            batch.set(notifRef, {
              userId: memberId,
              type: 'squad_chat',
              title: `New Message in ${squadData.name || 'Squad'}`,
              message: `${user.username}: ${text.length > 50 ? text.substring(0, 50) + '...' : text}`,
              read: false,
              squadId: squadId,
              createdAt: new Date().toISOString(),
              relatedId: squadId // Link to open squad?
            });
            notificationCount++;
          });

          if (notificationCount > 0) {
            await batch.commit();
          }
        } catch (err) {
          console.error("Error sending squad chat notifications:", err);
        }
      })();

      return { success: true };
    } catch (e) {
      console.error("Send Msg Error:", e);
      return { success: false, error: e.message };
    }
  };

  return (
    <AppContext.Provider value={{
      user, signup, signin, logout, updateUser, submitIdea, deleteIdea, deleteAccount, deleteUser, demoteSelf, syncEventStats,
      events, createEvent, resolveEvent, updateEvent, updateEventOrder, fixStuckBets, deleteBet, deleteEvent, toggleFeatured, recalculateLeaderboard, backfillLastBetPercent, addComment, deleteComment, toggleLikeComment, getUserStats, getWeeklyLeaderboard, setMainBet, updateUserGroups, updateSystemAnnouncement, systemAnnouncement, sendIdeaToAdmin, reviewIdea, replyToIdea,
      bets, placeBet, isLoaded, isFirebase: true, users, ideas, db,
      isGuestMode, setIsGuestMode,
      notifications, markNotificationAsRead, clearAllNotifications, submitModConcern, claimReferralReward,
      createParlay, placeParlayBet, addParlayComment, calculateParlays, deleteParlay, sendSystemNotification,
      squads, createSquad, joinSquad, leaveSquad, manageSquadRequest, kickMember, updateSquad, inviteUserToSquad, respondToSquadInvite, searchUsers, getSquadStats,
      depositToSquad, withdrawFromSquad, updateMemberRole, transferSquadLeadership, requestSquadWithdrawal, respondToWithdrawalRequest, sendSquadMessage,
      syncAllUsernames
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}
