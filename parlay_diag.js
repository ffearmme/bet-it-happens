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
const { getFirestore, getDocs, collection, query, doc, getDoc } = require('firebase/firestore');

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
  const q = query(collection(db, 'parlays'));
  const snap = await getDocs(q);
  const parlays = snap.docs.map(d => ({id: d.id, ...d.data()}))
    .sort((a,b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 10);
  
  for (const p of parlays) {
    console.log('\n=======================================');
    console.log('Parlay ID:', p.id, '| Status:', p.status, '| Created:', p.createdAt);
    console.log('Creator:', p.creatorName);
    for (const leg of p.legs) {
       const eSnap = await getDoc(doc(db, 'events', leg.eventId));
       if (eSnap.exists()) {
           const e = eSnap.data();
           console.log('  -> LEg ' + leg.eventId + ' : ' + e.title);
           console.log('     Status: ' + e.status + ' | Winner: ' + e.winnerOutcomeId + ' | Settled: ' + e.settledAt);
           console.log('     Event Document Data keys:', Object.keys(e).join(', '));
       } else {
           console.log('  -> LEg ' + leg.eventId + ' : DELETED / NOT FOUND IN DB');
       }
    }
  }
}
run().then(() => process.exit(0)).catch(e => {console.error(e); process.exit(1);});
