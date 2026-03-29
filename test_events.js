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
  const eventsSnap = await getDocs(query(collection(db, 'events')));
  const statusSet = new Set();
  eventsSnap.forEach(d => {
      statusSet.add(d.data().status);
  });
  console.log('Unique Event Statuses:', Array.from(statusSet).join(', '));
}
run().then(() => process.exit(0)).catch(e => {console.error(e); process.exit(1);});
