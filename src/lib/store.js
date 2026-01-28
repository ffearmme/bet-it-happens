
"use client";
import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  collection, addDoc, onSnapshot, query, orderBy,
  doc, setDoc, updateDoc, getDoc, where, increment, deleteDoc, getDocs, limit, writeBatch, deleteField
} from 'firebase/firestore';
import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, onAuthStateChanged, updateEmail, updatePassword, verifyBeforeUpdateEmail
} from 'firebase/auth';
import { db, auth } from './firebase';

const AppContext = createContext();

export function AppProvider({ children }) {
  const [user, setUser] = useState(null);
  const [events, setEvents] = useState([]);
  const [bets, setBets] = useState([]);
  const [ideas, setIdeas] = useState([]);
  const [isLoaded, setIsLoaded] = useState(false);

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
            setUser({ id: firebaseUser.uid, ...docSnap.data() });
          } else {
            // Document does not exist (e.g. first login or previous error).
            console.log(">>> DETECTED NEW USER (No Profile Found) - Creating Profile...");
            // Auto-create the user profile in Firestore
            const newUser = {
              email: firebaseUser.email,
              username: firebaseUser.displayName || firebaseUser.email.split('@')[0],
              role: (firebaseUser.email.toLowerCase().includes('admin')) ? 'admin' : 'user',
              balance: 1000,
              createdAt: new Date().toISOString()
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

    return () => {
      unsubEvents();
      unsubIdeas();
      unsubUsers();
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

  // --- Actions ---

  const signup = async (email, username, password) => {
    try {
      const resp = await createUserWithEmailAndPassword(auth, email, password);

      // Create User Document
      await setDoc(doc(db, 'users', resp.user.uid), {
        email,
        username: username || email.split('@')[0],
        role: email.toLowerCase().includes('admin') ? 'admin' : 'user', // Basic role assignment
        balance: 1000,
        createdAt: new Date().toISOString()
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
      await updateDoc(userRef, {
        balance: increment(-amount),
        invested: increment(amount) // Track active wagers for leaderboard
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

      return { success: true };
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

  const resolveEvent = async (eventId, winnerOutcomeId) => {
    try {
      const batch = writeBatch(db);
      const eventRef = doc(db, 'events', eventId);

      // 1. Mark Event as Settled (In Batch)
      batch.update(eventRef, {
        status: 'settled',
        winnerOutcomeId
      });

      // 2. Process Bets
      const betsQ = query(collection(db, 'bets'), where('eventId', '==', eventId));
      const betsSnap = await getDocs(betsQ); // Need all bets to settle

      for (const betDoc of betsSnap.docs) {
        const bet = betDoc.data();
        // Skip if already settled to avoid double-pay/deduct
        if (bet.status !== 'pending') continue;

        const isWinner = bet.outcomeId === winnerOutcomeId;
        const userRef = doc(db, 'users', bet.userId);

        // Fetch User to Calc Portfolio Impact
        let percentChange = 0;
        try {
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
            const userData = userSnap.data();
            const currentNetWorth = (userData.balance || 0) + (userData.invested || 0);

            // Profit (or Loss) from this specific bet
            const profit = isWinner
              ? (bet.potentialPayout - bet.amount) // Net Profit
              : -bet.amount;                       // Net Loss

            // Portfolio Impact % = (Profit / currentNetWorth) * 100
            percentChange = currentNetWorth > 0
              ? (profit / currentNetWorth) * 100
              : 0;
          }
        } catch (err) {
          console.error("Error calc legacy stats", err);
        }

        // Settle the bet document
        batch.update(betDoc.ref, {
          status: isWinner ? 'won' : 'lost',
          settledAt: new Date().toISOString()
        });

        // Update User Balance & Invested & Last Bet Stats
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

        // Create Notification
        const notifRef = doc(collection(db, 'notifications'));
        batch.set(notifRef, {
          userId: bet.userId,
          type: 'result',
          eventId: eventId,
          title: isWinner ? 'You Won!' : 'Bet Lost',
          message: isWinner
            ? `You won $${(bet.potentialPayout).toFixed(2)} on ${bet.eventTitle} (${bet.outcomeLabel})`
            : `You lost $${bet.amount.toFixed(2)} on ${bet.eventTitle} (${bet.outcomeLabel})`,
          read: false,
          createdAt: new Date().toISOString()
        });
      }

      await batch.commit();
      return { success: true };
    } catch (e) {
      console.error("Resolve Event Error:", e);
      return { success: false, error: e.message };
    }
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
      return { success: false, error: "You already suggested this! Hey switch it up." };
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
      // If date different, simple set. If same, increment.
      // Firestore update is tricky with nested objects, so we set the whole object.
      // We calculate new count locally to ensure sync with the check.

      const newCount = currentCount + 1;

      await updateDoc(doc(db, 'users', user.id), {
        balance: increment(15), // Reward
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
      await deleteDoc(doc(db, 'ideas', ideaId));
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  };

  const updateUser = async (updates) => {
    if (!user) return { success: false, error: 'Not logged in' };

    try {
      // 1. Update Firestore FIRST (Profile Pic, Username, etc.)
      // This ensures that non-sensitive updates always succeed even if Auth fails.
      const firestoreUpdates = { ...updates };
      delete firestoreUpdates.password; // Don't store raw password in DB

      await updateDoc(doc(db, 'users', user.id), firestoreUpdates);

      // Update local state immediately for the UI
      setUser(prev => ({ ...prev, ...firestoreUpdates }));

      // 2. Attempt Auth Updates (Sensitive: Email/Password)
      let authUpdated = false;
      let authErrorMsg = '';

      try {
        // Update Email
        if (updates.email && auth.currentUser) {
          const currentAuthEmail = auth.currentUser.email;
          if (updates.email.toLowerCase() !== currentAuthEmail.toLowerCase()) {
            console.log(`Debug: Attempting email update from ${currentAuthEmail} to ${updates.email}`);
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

        // Update Password
        if (updates.password && updates.password.length > 0) {
          if (auth.currentUser) {
            await updatePassword(auth.currentUser, updates.password);
            authUpdated = true;
          }
        }

        // Force refresh if Auth changed
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
    try {
      const userId = user.id;
      const batch = writeBatch(db);
      let opCount = 0;

      // 1. Delete all user's bets
      const betsQ = query(collection(db, 'bets'), where('userId', '==', userId));
      const betsSnap = await getDocs(betsQ);
      betsSnap.docs.forEach(doc => {
        batch.delete(doc.ref);
        opCount++;
      });

      // 2. Delete all user's ideas
      const ideasQ = query(collection(db, 'ideas'), where('userId', '==', userId));
      const ideasSnap = await getDocs(ideasQ);
      ideasSnap.docs.forEach(doc => {
        batch.delete(doc.ref);
        opCount++;
      });

      // 3. Delete User Profile
      const userRef = doc(db, 'users', userId);
      batch.delete(userRef);
      opCount++;

      if (opCount > 0) {
        await batch.commit();
      }

      // 4. Delete Auth Account
      if (auth.currentUser) {
        await auth.currentUser.delete();
      }

      return { success: true };
    } catch (e) {
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

  const markNotificationRead = async (notifId) => {
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
        profile: { bio: userData.bio || '', profilePic: userData.profilePic, username: userData.username }
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

  return (
    <AppContext.Provider value={{
      user, signup, signin, logout, updateUser, submitIdea, deleteIdea, deleteAccount, deleteUser, demoteSelf, syncEventStats,
      events, createEvent, resolveEvent, updateEvent, updateEventOrder, fixStuckBets, deleteBet, deleteEvent, toggleFeatured, recalculateLeaderboard, backfillLastBetPercent, addComment, deleteComment, markNotificationRead, getUserStats, getWeeklyLeaderboard, setMainBet, updateUserGroups, updateSystemAnnouncement, systemAnnouncement,
      bets, placeBet, isLoaded, isFirebase: true, users, ideas, db
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}
