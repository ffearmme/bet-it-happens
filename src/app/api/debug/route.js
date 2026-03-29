import { NextResponse } from 'next/server';
import { collection, getDocs, query } from 'firebase/firestore';
import { db } from '../../../lib/firebase';

export async function GET() {
  try {
    const eventsSnap = await getDocs(query(collection(db, 'events')));
    const statuses = {};
    const missingEvents = [];

    eventsSnap.forEach(d => {
       const data = d.data();
       const id = d.id;
       const status = data.status || 'UNDEFINED';
       
       if (!statuses[status]) statuses[status] = 0;
       statuses[status]++;

       if (!['open', 'locked', 'resolved', 'settled', 'completed'].includes(status)) {
           missingEvents.push({ id, status, title: data.title });
       }
    });

    return NextResponse.json({
        total: eventsSnap.size,
        statuses,
        missingEvents
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
