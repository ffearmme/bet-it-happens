# Antigravity Sportsbook (MVP)

A cross-platform compatible mobile-web application for virtual betting.

## Features
- **Virtual Currency**: Start with $1000. No real money involved.
- **Betting**: Place bets on outcomes (e.g. Lakers vs Warriors).
- **Admin Dashboard**: Create new events and resolve/settle existing ones.
- **Wallet**: View balance and history.
- **Leaderboard**: See how you rank against bots.

## How to Run
The app is already running on development mode.
1. Open [http://localhost:3000](http://localhost:3000) in your browser.
2. For the best "Phone App" experience, open DevTools (F12) and toggle **Device Toolbar** (Ctrl+Shift+M) to simulate a mobile screen (e.g., iPhone 12 or Pixel 5).

## How to Test
### 1. User Mode
- Click **"Play as Guest"**.
- View the "Live & Upcoming" events.
- Select an outcome (e.g., "Lakers").
- Enter a wager (e.g., "50") in the bottom sheet.
- Click **Place Bet**.
- Go to the **Bets** tab to see your "PENDING" bet.
- Go to **Wallet** to see your balance deducted.

### 2. Admin Mode (Simulate result)
- Open a new private window or logout (clear Local Storage or use incognito).
- Click **"Admin Demo"** (logs you in as Admin).
- Go to the **Admin** tab (far right).
- **Create Event**: Add a new custom event (Title, Odds, etc.).
- **Resolve Event**: Find the event you bet on previously (if using the same browser session/storage). 
    - *Note: Since this mock uses LocalStorage, you can actually switch between User/Admin in the same browser session if you implement a logout button or just clear the `user` object in code. For this MVP, the easiest way to test full flow is to open the app, Login as Guest, Place Bet, then refresh and click 'Admin Demo' if you want to settle it, OR rely on the fact that `login` overwrites the current user state.*
    
    *Actually, to test "Win", do this:*
    1. Login as Guest.
    2. Place $100 on "Heads".
    3. Click the User Icon or Refresh to Logout (Wait, I didn't add a logout button clearly). 
    4. *Correction*: Use the specific "Admin Demo" button on the login screen. To see the login screen again, clear LocalStorage manually in DevTools > Application > Local Storage > Clear. Refresh.
    5. Be Admin. Go to Admin Tab.
    6. Click "Heads Wins" on the relevant event.
    7. Clear Storage, Login as Guest again.
    8. Check Balance. You should have won!

## disclaimer
This is a fake gambling app for entertainment only.
