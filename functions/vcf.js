/**
 * functions/vcf.js
 * - generateVcf: callable admin-only function
 *   - checks public/stats count
 *   - fetches all contacts (server-side)
 *   - constructs VCF string (v3.0)
 *   - saves file to Storage under vcfs/
 *   - returns signed URL (short-lived)
 *
 * Usage: client should call via firebase.functions().httpsCallable('generateVcf', { force: true/false })
 */

const { Readable } = require("stream");

function init({ admin, db, storage, functions }) {
  const TARGET = Number(process.env.TARGET_COUNT || 800);
  const BUCKET_NAME = process.env.FUNCTIONS_BUCKET || (admin.storage().bucket().name);

  const generateVcf = functions.https.onCall(async (data, context) => {
    // Admin check
    if (!context.auth || context.auth.token.admin !== true) {
      throw new functions.https.HttpsError("permission-denied", "Only admin may generate VCF.");
    }

    // Read stats
    const statsDoc = await db.doc("public/stats").get();
    const count = (statsDoc.exists && statsDoc.data().count) ? statsDoc.data().count : 0;

    // Allow override if admin passes force=true
    const force = data && data.force === true;
    if (count < TARGET && !force) {
      throw new functions.https.HttpsError("failed-precondition", `Target not reached (${count}/${TARGET}).`);
    }

    // Fetch contacts server-side (admin-only operation)
    const snapshot = await db.collection("contacts3").get();
    if (snapshot.empty) {
      throw new functions.https.HttpsError("not-found", "No contacts available to export.");
    }

    // Build VCF
    let vcf = "";
    snapshot.forEach(doc => {
      const d = doc.data() || {};
      const fn = (d.name || "").toString().replace(/\r?\n/g, " ");
      const tel = (d.phone || "").toString().replace(/\r?\n/g, " ");
      vcf += `BEGIN:VCARD
VERSION:3.0
FN:${fn}
TEL;TYPE=CELL:${tel}
END:VCARD
`;
    });

    // Save to storage
    try {
      const bucket = storage.bucket();
      const filename = `vcfs/contacts_${Date.now()}.vcf`;
      const file = bucket.file(filename);

      // Save buffer
      await file.save(Buffer.from(vcf, "utf8"), {
        metadata: { contentType: "text/vcard" },
        resumable: false
      });

      // Generate signed URL (24 hours)
      const [url] = await file.getSignedUrl({
        action: "read",
        expires: Date.now() + 24 * 60 * 60 * 1000
      });

      // Optionally: write an audit record
      await db.collection("exports").add({
        type: "vcf",
        path: filename,
        createdBy: context.auth.uid,
        createdAt: Date.now(),
        count
      });

      return { url, count, filename };
    } catch (err) {
      console.error("generateVcf storage error:", err);
      throw new functions.https.HttpsError("internal", "Failed to store VCF.");
    }
  });

  return { generateVcf };
}

module.exports = { init };
