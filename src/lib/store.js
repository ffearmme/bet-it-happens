
"use client";
import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  collection, addDoc, onSnapshot, query, orderBy,
  doc, setDoc, updateDoc, getDoc, where, increment, deleteDoc, getDocs, limit
} from 'firebase/firestore';
import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, onAuthStateChanged
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

  // ... (existing timeout code) ...

  // --- 2. Data Listeners (Events, Ideas, Users) ---
  useEffect(() => {
    // Listen to Events (Limit 50 active)
    const eventsQuery = query(collection(db, 'events'), limit(50));
    const unsubEvents = onSnapshot(eventsQuery, (snapshot) => {
      const eventsList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      eventsList.sort((a, b) => (a.status === 'open' ? -1 : 1) || new Date(a.startAt) - new Date(b.startAt));
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

  const signin = async (email, password) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
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

    const outcome = event.outcomes.find(o => o.id === outcomeId);

    try {
      // 1. Deduct Balance
      const userRef = doc(db, 'users', user.id);
      await updateDoc(userRef, {
        balance: increment(-amount)
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

  const resolveEvent = async (eventId, winnerOutcomeId) => {
    try {
      // 1. Mark Event as Settled
      await updateDoc(doc(db, 'events', eventId), {
        status: 'settled',
        winnerOutcomeId
      });

      // 2. Find all pending bets for this event (This is client side heavy! ideally backend)
      // Since we are doing a client-side admin, we query ALL bets for this event.
      // NOTE: This usually requires a composite index on Firestore: eventId + status
      const betsRef = collection(db, 'bets');
      const q = query(betsRef, where('eventId', '==', eventId), where('status', '==', 'pending'));

      // We can't use await inside map easily without Promise.all
      // But we need to fetch them first. 
      // We actually can't easily query *all* bets from client unless we are admin and security rules allow it.
      // Assuming Admin has permission to read all bets.

      // This part is tricky purely client-side without Cloud Functions.
      // I will implement a "dumb" loop here. It works for small scale.

      // We need to fetch the snapshots once, we don't need a listener.
      const querySnapshot = await getDocs(q);

      const batchPromises = querySnapshot.docs.map(async (betDoc) => {
        const bet = betDoc.data();
        const isWin = bet.outcomeId === winnerOutcomeId;

        // Update Bet Status
        await updateDoc(doc(db, 'bets', betDoc.id), {
          status: isWin ? 'won' : 'lost'
        });

        // If Win, Pay User
        if (isWin) {
          await updateDoc(doc(db, 'users', bet.userId), {
            balance: increment(bet.potentialPayout)
          });
        }
      });

      await Promise.all(batchPromises);

    } catch (e) {
      console.error("Error resolving event", e);
    }
  };

  const submitIdea = async (ideaText) => {
    if (!user) return { success: false, error: 'Not logged in' };

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

  const updateUser = async (updates) => {
    if (!user) return;
    await updateDoc(doc(db, 'users', user.id), updates);
    return { success: true };
  }

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

      // 1. Delete all user's bets (Query first)
      const betsQ = query(collection(db, 'bets'), where('userId', '==', userId));
      const betsSnap = await getDocs(betsQ);
      const batch = [];
      // Note: Firestore batch limit is 500, simple loop for now
      for (const b of betsSnap.docs) {
        await deleteDoc(doc(db, 'bets', b.id));
      }

      // 2. Delete User Profile
      await deleteDoc(doc(db, 'users', userId));

      // 3. Delete Auth Account
      if (auth.currentUser) {
        await auth.currentUser.delete();
      }

      return { success: true };
    } catch (e) {
      console.error("Delete Error:", e);
      // Force logout if auth delete fails (requires re-login usually)
      if (e.code === 'auth/requires-recent-login') {
        return { success: false, error: "Please log out and log in again to delete your account." };
      }
      return { success: false, error: e.message };
    }
  };

  return (
    <AppContext.Provider value={{
      user, signup, signin, logout, updateUser, submitIdea, deleteAccount, demoteSelf,
      events, createEvent, resolveEvent, deleteEvent,
      bets, placeBet, isLoaded, isFirebase: true, users, ideas
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}
