/**
 * functions/index.js
 * Entrypoint: exports cloud functions from modular files.
 */

const admin = require("firebase-admin");
const functions = require("firebase-functions");

// Initialize admin SDK only once
try {
  admin.initializeApp();
} catch (e) {
  // ignore if already initialized in emulator or hot reload
}

// export admin and firestore references for other modules
const db = admin.firestore();
const storage = admin.storage();

module.exports = {
  // domain handlers
  ...require("./contacts").init({ admin, db, functions }),
  ...require("./vcf").init({ admin, db, storage, functions }),
  ...require("./backups").init({ admin, db, storage, functions })
};
