const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
const lines = env.split('\n');
const config = {};
lines.forEach(line => {
  if (line.trim() && !line.startsWith('#')) {
    const [key, ...rest] = line.split('=');
    if (key && rest.length) config[key.trim()] = rest.join('=').trim().replace(/['\"]+/g, '');
  }
});

const { initializeApp } = require('firebase/app');
const { getFirestore, getDocs, collection, query, where, doc, getDoc } = require('firebase/firestore');

const app = initializeApp({
  apiKey: config.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: config.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: config.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: config.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: config.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: config.NEXT_PUBLIC_FIREBASE_APP_ID
});

const db = getFirestore(app);

async function run() {
  const parlaySnap = await getDocs(query(collection(db, 'parlays')));
  const parlays = parlaySnap.docs.map(d => ({id: d.id, ...d.data()}));
  console.log("Found parlays:", parlays.length);
  const recentParlays = [...parlays].sort((a,b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5);
  console.log("Recent Parlays:", JSON.stringify(recentParlays, null, 2));

  for (const p of recentParlays) {
      console.log(`\n--- Checking Parlay ${p.id} ---`);
      for (const leg of p.legs) {
          const eSnap = await getDoc(doc(db, 'events', leg.eventId));
          if (eSnap.exists()) {
              console.log(`Leg Event ${leg.eventId}: ${eSnap.data().title} [${eSnap.data().status}]`);
          } else {
              console.log(`Leg Event ${leg.eventId}: NOT FOUND IN DB!`);
          }
      }
      
      const betsSnap = await getDocs(query(collection(db, 'bets'), where('parlayId', '==', p.id)));
      console.log(`Bets for this parlay:`, betsSnap.size, "found.");
      betsSnap.forEach(b => console.log('Bet fields:', Object.keys(b.data()).join(', '), '-> eventIds:', b.data().eventIds));
  }
}
run().then(() => process.exit(0)).catch(e => {console.error(e); process.exit(1);});
