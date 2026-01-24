
"use client";
import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  collection, addDoc, onSnapshot, query, orderBy,
  doc, setDoc, updateDoc, getDoc, where, increment
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

  // --- 1. Auth & User Profile Listener ---
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // User is signed in, listen to their profile in Firestore
        const userRef = doc(db, 'users', firebaseUser.uid);

        const unsubscribeProfile = onSnapshot(userRef, (docSnap) => {
          if (docSnap.exists()) {
            setUser({ id: firebaseUser.uid, ...docSnap.data() });
          } else {
            // Should not happen normally if signup works right, but handling edge case
            setUser({ id: firebaseUser.uid, email: firebaseUser.email, role: 'user', balance: 0 });
          }
          setIsLoaded(true);
        });

        return () => unsubscribeProfile();
      } else {
        // User is signed out
        setUser(null);
        setBets([]);
        setIsLoaded(true);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  // --- 2. Data Listeners (Events & Ideas) ---
  useEffect(() => {
    // Listen to Events
    const eventsQuery = query(collection(db, 'events')); // You might want orderBy('startAt')
    const unsubEvents = onSnapshot(eventsQuery, (snapshot) => {
      const eventsList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Sort by open status, then date
      eventsList.sort((a, b) => (a.status === 'open' ? -1 : 1) || new Date(a.startAt) - new Date(b.startAt));
      setEvents(eventsList);
    });

    // Listen to Ideas
    const ideasQuery = query(collection(db, 'ideas'), orderBy('submittedAt', 'desc'));
    const unsubIdeas = onSnapshot(ideasQuery, (snapshot) => {
      setIdeas(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubEvents();
      unsubIdeas();
    };
  }, []);

  // --- 3. Bets Listener (Only for logged in user) ---
  useEffect(() => {
    if (!user) {
      setBets([]);
      return;
    }

    const betsQuery = query(collection(db, 'bets'), where('userId', '==', user.id));
    const unsubBets = onSnapshot(betsQuery, (snapshot) => {
      // We'll trust the client side sorting for now or add orderBy index later
      const myBets = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      myBets.sort((a, b) => new Date(b.placedAt) - new Date(a.placedAt));
      setBets(myBets);
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
      const { deleteDoc } = require('firebase/firestore');
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
      const { getDocs } = require('firebase/firestore');
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
    try {
      await addDoc(collection(db, 'ideas'), {
        userId: user.id,
        username: user.username,
        text: ideaText,
        submittedAt: new Date().toISOString()
      });
      // Reward user (Simplified, no daily limit check database side for now)
      await updateDoc(doc(db, 'users', user.id), {
        balance: increment(15) // Reward
      });
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  };

  const updateUser = async (updates) => {
    if (!user) return;
    await updateDoc(doc(db, 'users', user.id), updates);
    return { success: true };
  }

  return (
    <AppContext.Provider value={{
      user, signup, signin, logout, updateUser, submitIdea,
      events, createEvent, resolveEvent, deleteEvent,
      bets, placeBet, isLoaded, isFirebase: true
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}
