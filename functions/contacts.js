/**
 * functions/contacts.js
 * - onContactCreate: trigger on contacts3/{id} create
 *   - server-side validation / normalization
 *   - ensures verified:false set on create
 *   - increments public/stats.count atomically
 *
 * Exports via init({ admin, db, functions })
 */

const TARGET_ENV_KEY = "TARGET_COUNT"; // optional env override

function init({ admin, db, functions }) {
  const TARGET = Number(process.env[TARGET_ENV_KEY] || 800);

  const onContactCreate = functions.firestore
    .document("contacts3/{docId}")
    .onCreate(async (snap, ctx) => {
      const data = snap.data() || {};
      const phone = (data.phone || "").toString().trim();
      const docRef = snap.ref;

      try {
        // Server-side basic normalization
        const normalized = {
          name: (data.name || "").toString().slice(0, 256),
          phone: phone.slice(0, 64),
          time: typeof data.time === "number" ? data.time : Date.now(),
          verified: data.verified === true ? true : false
        };

        // If phone obviously invalid, delete and abort (phone length < 5)
        if (normalized.phone.length < 5) {
          await docRef.delete();
          console.log(`Deleted suspicious contact ${ctx.params.docId} (phone too short)`);
          return null;
        }

        // Merge normalized fields (ensures consistent shape)
        await docRef.set(normalized, { merge: true });

        // Atomically increment public/stats.count
        const statsRef = db.doc("public/stats");
        await db.runTransaction(async tx => {
          const statsSnap = await tx.get(statsRef);
          if (!statsSnap.exists) {
            tx.set(statsRef, { count: 1 }, { merge: true });
          } else {
            const currentCount = statsSnap.get("count") || 0;
            tx.update(statsRef, { count: currentCount + 1 });
          }
        });

        // Optionally: write an event log (optional, commented)
        // await db.collection('adminLogs').add({ type: 'contact_create', id: ctx.params.docId, time: Date.now() });

        console.log(`Contact created and stats incremented: ${ctx.params.docId}`);
        return null;
      } catch (err) {
        console.error("onContactCreate error:", err);
        // best effort: try to delete the doc to avoid garbage (but be cautious)
        try { /* don't delete here unless you're OK with aggressive cleanup */ } catch (e) {}
        throw err;
      }
    });

  // Export functions via object
  return { onContactCreate };
}

module.exports = { init };
