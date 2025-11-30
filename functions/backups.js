/**
 * functions/backups.js
 * - backupOnWrite: onWrite for contacts3/{id} to create a periodic JSON backup
 * - forceBackup: admin callable to force a full backup (manual)
 *
 * Backups are stored in Storage under backups/ with timestamped filenames.
 * You can add Cloud Scheduler to call a nightly HTTP function if desired.
 */

const { Parser } = require("json2csv");

function init({ admin, db, storage, functions }) {
  const BUCKET = storage.bucket();
  const KEEP_DAYS = Number(process.env.BACKUP_KEEP_DAYS || 7);

  // Helper: write contacts snapshot to storage
  async function writeBackup(contacts, filename) {
    const json = JSON.stringify(contacts, null, 2);

    const file = BUCKET.file(filename);
    await file.save(json, { contentType: "application/json", resumable: false });

    // Optionally store CSV as well
    try {
      const parser = new Parser({ fields: ["id", "name", "phone", "time", "verified"] });
      const csv = parser.parse(contacts);
      const csvFile = BUCKET.file(filename.replace(/\.json$/, ".csv"));
      await csvFile.save(csv, { contentType: "text/csv", resumable: false });
    } catch (csvErr) {
      console.warn("CSV export failed (non-fatal):", csvErr.message || csvErr);
    }

    return file.name;
  }

  // Trigger: onWrite (create/update/delete) -> create a lightweight backup snapshot
  const backupOnWrite = functions.firestore
    .document("contacts3/{id}")
    .onWrite(async (change, ctx) => {
      try {
        // keep this lightweight: only run a snapshot every N minutes (throttle)
        // For simplicity here we run on every write but in production you can throttle using Firestore doc/state or Pub/Sub.
        const snapshot = await db.collection("contacts3").get();
        const contacts = [];
        snapshot.forEach(doc => contacts.push({ id: doc.id, ...doc.data() }));

        const filename = `backups/contacts_snapshot_${Date.now()}.json`;
        await writeBackup(contacts, filename);

        // Optionally cleanup old backups
        if (KEEP_DAYS > 0) {
          const [files] = await BUCKET.getFiles({ prefix: "backups/" });
          const cutoff = Date.now() - KEEP_DAYS * 24 * 60 * 60 * 1000;
          const toDelete = files.filter(f => {
            const time = Number(f.metadata && f.metadata.timeCreated ? new Date(f.metadata.timeCreated).getTime() : 0);
            return time && time < cutoff;
          });
          await Promise.all(toDelete.map(f => f.delete().catch(() => null)));
        }

        console.log("BackupOnWrite completed:", ctx.params.id);
        return null;
      } catch (err) {
        console.error("backupOnWrite error:", err);
        return null; // don't crash the trigger
      }
    });

  // Admin callable: forceBackup
  const forceBackup = functions.https.onCall(async (data, context) => {
    if (!context.auth || context.auth.token.admin !== true) {
      throw new functions.https.HttpsError("permission-denied", "Only admin may perform backups.");
    }
    try {
      const snapshot = await db.collection("contacts3").get();
      const contacts = [];
      snapshot.forEach(doc => contacts.push({ id: doc.id, ...doc.data() }));

      const filename = `backups/manual_backup_${Date.now()}.json`;
      await writeBackup(contacts, filename);

      // Return signed URL for the JSON backup (short-lived)
      const file = BUCKET.file(filename);
      const [url] = await file.getSignedUrl({ action: "read", expires: Date.now() + 24 * 60 * 60 * 1000 });

      await db.collection("adminLogs").add({
        type: "backup",
        path: filename,
        createdBy: context.auth.uid,
        createdAt: Date.now()
      });

      return { message: "Backup completed", filename, url };
    } catch (err) {
      console.error("forceBackup error:", err);
      throw new functions.https.HttpsError("internal", "Backup failed.");
    }
  });

  return { backupOnWrite, forceBackup };
}

module.exports = { init };
