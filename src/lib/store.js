"use client";
import React, { createContext, useContext, useEffect, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';

const AppContext = createContext();

const INITIAL_EVENTS = [
  {
    id: '1',
    title: 'Lakers vs Warriors',
    description: 'NBA Regular Season. Who wins?',
    startAt: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
    status: 'open',
    outcomes: [
      { id: 'o1', label: 'Lakers', odds: 1.90 },
      { id: 'o2', label: 'Warriors', odds: 1.90 }
    ]
  },
  {
    id: '2',
    title: 'Super Bowl LVIII Coin Toss',
    description: 'Heads or Tails?',
    startAt: new Date(Date.now() + 3600000).toISOString(), // 1 hour
    status: 'open',
    outcomes: [
      { id: 'o3', label: 'Heads', odds: 1.95 },
      { id: 'o4', label: 'Tails', odds: 1.95 }
    ]
  },
  {
    id: '3',
    title: 'Bitcoin > $100k in 2026',
    description: 'Will BTC break 100k?',
    startAt: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago (Active/Locked testing)
    status: 'locked',
    outcomes: [
      { id: 'o5', label: 'Yes', odds: 2.50 },
      { id: 'o6', label: 'No', odds: 1.50 }
    ]
  }
];

export function AppProvider({ children }) {
  const [user, setUser] = useState(null);
  const [events, setEvents] = useState(INITIAL_EVENTS);
  const [bets, setBets] = useState([]);
  const [isLoaded, setIsLoaded] = useState(false);

  const [users, setUsers] = useState([]); // "Database" of users
  const [ideas, setIdeas] = useState([]); // Submitted ideas

  // Load data from LocalStorage
  useEffect(() => {
    const savedUser = localStorage.getItem('bet_user');
    const savedEvents = localStorage.getItem('bet_events');
    const savedBets = localStorage.getItem('bet_bets');
    const savedUsersDB = localStorage.getItem('bet_users_db');
    const savedIdeas = localStorage.getItem('bet_ideas');

    if (savedUser) setUser(JSON.parse(savedUser));
    if (savedEvents) setEvents(JSON.parse(savedEvents));
    if (savedBets) setBets(JSON.parse(savedBets));
    if (savedUsersDB) setUsers(JSON.parse(savedUsersDB));
    if (savedIdeas) setIdeas(JSON.parse(savedIdeas));

    setIsLoaded(true);
  }, []);

  // Save on change
  useEffect(() => {
    if (!isLoaded) return;
    if (user) localStorage.setItem('bet_user', JSON.stringify(user));
    localStorage.setItem('bet_events', JSON.stringify(events));
    localStorage.setItem('bet_bets', JSON.stringify(bets));
    localStorage.setItem('bet_users_db', JSON.stringify(users));
    localStorage.setItem('bet_ideas', JSON.stringify(ideas));
  }, [user, events, bets, users, ideas, isLoaded]);

  const signup = (email, username, password) => {
    if (users.find(u => u.email === email)) {
      return { success: false, error: 'User already exists' };
    }

    const newUser = {
      id: uuidv4(),
      email,
      username: username || email.split('@')[0],
      password, // In a real app, hash this!
      balance: 1000,
      role: email.includes('admin') ? 'admin' : 'user', // simple hack for demo
      isAdmin: email.includes('admin')
    };

    const newUsersList = [...users, newUser];
    setUsers(newUsersList);
    setUser(newUser);
    return { success: true };
  };

  const signin = (email, password) => {
    const existingUser = users.find(u => u.email === email && u.password === password);
    if (!existingUser) {
      return { success: false, error: 'Invalid credentials' };
    }
    setUser(existingUser);
    return { success: true };
  };

  const updateUser = (updates) => {
    if (!user) return { success: false, error: 'Not logged in' };

    // Check email uniqueness if changing email
    if (updates.email && updates.email !== user.email && users.find(u => u.email === updates.email)) {
      return { success: false, error: 'Email already taken' };
    }

    const updatedUser = { ...user, ...updates };

    const updatedUsersList = users.map(u => u.id === user.id ? updatedUser : u);
    setUsers(updatedUsersList);
    setUser(updatedUser);

    return { success: true };
  };

  const submitIdea = (ideaText) => {
    if (!user) return { success: false, error: 'Not logged in' };

    const REWARD = 15;
    const DAILY_LIMIT = 5;
    const today = new Date().toDateString();

    // Initialize or check daily tracking
    let submissionData = user.submissionData || { date: today, count: 0 };

    if (submissionData.date !== today) {
      submissionData = { date: today, count: 0 }; // Reset if new day
    }

    if (submissionData.count >= DAILY_LIMIT) {
      return { success: false, error: `Daily limit reached (${DAILY_LIMIT}/${DAILY_LIMIT})` };
    }

    // Update user balance and counts
    const newSubmissionData = { date: today, count: submissionData.count + 1 };
    const updatedUser = {
      ...user,
      balance: user.balance + REWARD,
      submissionData: newSubmissionData
    };

    // Save the Idea
    const newIdea = {
      id: uuidv4(),
      userId: user.id,
      username: user.username,
      text: ideaText,
      submittedAt: new Date().toISOString()
    };
    setIdeas([newIdea, ...ideas]);

    const updatedUsersList = users.map(u => u.id === user.id ? updatedUser : u);
    setUsers(updatedUsersList);
    setUser(updatedUser);

    return { success: true, message: `Idea submitted! +$${REWARD}`, newBalance: updatedUser.balance };
  };

  const logout = () => {
    // We update the User DB with the latest balance before logging out
    if (user) {
      const updatedUsers = users.map(u => u.id === user.id ? user : u);
      setUsers(updatedUsers);
    }
    setUser(null);
    localStorage.removeItem('bet_user');
  };

  const placeBet = (eventId, outcomeId, amount) => {
    if (!user) return { success: false, error: 'Not logged in' };
    if (user.balance < amount) return { success: false, error: 'Insufficient funds' };

    const event = events.find(e => e.id === eventId);
    if (!event || event.status !== 'open') return { success: false, error: 'Event locked' };

    const outcome = event.outcomes.find(o => o.id === outcomeId);
    const newBet = {
      id: uuidv4(),
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
    };

    setBets([newBet, ...bets]);
    setUser({ ...user, balance: user.balance - amount });
    return { success: true };
  };

  const createEvent = (eventData) => {
    const newEvent = {
      id: uuidv4(),
      status: 'open',
      deadline: eventData.deadline || eventData.startAt, // Use provided deadline or fallback to startAt
      ...eventData
    };
    setEvents([newEvent, ...events]);
  };

  const deleteEvent = (eventId) => {
    setEvents(events.filter(e => e.id !== eventId));
    // Optionally remove bets associated with the deleted event?
    // For now, let's keep them or filter them out in the UI.
    // Ideally we should probably refund pending bets.

    // Refund pending bets logic:
    const betsToRefund = bets.filter(b => b.eventId === eventId && b.status === "pending");
    if (betsToRefund.length > 0) {
      let totalRefund = 0;
      // In a real multi-user system, we'd refund each user.
      // For local user:
      const myRefund = betsToRefund
        .filter(b => b.userId === user?.id)
        .reduce((sum, b) => sum + b.amount, 0);

      if (myRefund > 0) {
        setUser(u => ({ ...u, balance: u.balance + myRefund }));
      }
    }

    // Remove bets from list
    setBets(bets.filter(b => b.eventId !== eventId));
  };

  const resolveEvent = (eventId, winnerOutcomeId) => {
    // Lock event and set winner
    const updatedEvents = events.map(e =>
      e.id === eventId ? { ...e, status: 'settled', winnerOutcomeId } : e
    );
    setEvents(updatedEvents);

    // Payout bets
    // Note: In a real app, this should be transactional. Here we just update all at once.
    let totalPayout = 0;
    const updatedBets = bets.map(b => {
      if (b.eventId === eventId && b.status === 'pending') {
        const isWin = b.outcomeId === winnerOutcomeId;
        if (isWin) totalPayout += b.potentialPayout;
        return { ...b, status: isWin ? 'won' : 'lost' };
      }
      return b;
    });

    setBets(updatedBets);

    // If current user has winning bets, update their balance immediately (simplified)
    // Realistically we'd query all users, but here we only have local user.
    // We only update balance if the winning bet belongs to the local user.
    // We only update balance if the winning bet belongs to the local user.
    const myWinnings = updatedBets
      .filter(b => b.eventId === eventId && b.userId === user.id && b.status === 'won' && bets.find(old => old.id === b.id).status === 'pending')
      .reduce((sum, b) => sum + b.potentialPayout, 0);

    if (myWinnings > 0) {
      setUser(u => ({ ...u, balance: u.balance + myWinnings }));
    }
  };

  return (
    <AppContext.Provider value={{
      user, signup, signin, logout, updateUser, submitIdea,
      events, createEvent, resolveEvent, deleteEvent,
      bets, placeBet, isLoaded, ideas, users
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}
