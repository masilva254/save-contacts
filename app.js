// -------------------------------
// PRODUCTION APP.JS  
// -------------------------------

// Firebase imports
import { 
  initializeApp 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";

import { 
  getFirestore, collection, addDoc, getDocs, query, where 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import {
  getFunctions, httpsCallable
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-functions.js";

// Firebase Config
const firebaseConfig = {
  apiKey: "AIzaSyDQPWXo0PxlH-ASXsO6WZtEGJ4dv_rbkkY",
  authDomain: "princev-vcf.firebaseapp.com",
  projectId: "princev-vcf",
  storageBucket: "princev-vcf.appspot.com",
  messagingSenderId: "930544921320",
  appId: "1:930544921320:web:13df28cee6f0e9cc96b75d"
};

// Init Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const functions = getFunctions(app);

// Target
const TARGET = 800;

// DOM elements
const nameInput = document.getElementById("name");
const phoneInput = document.getElementById("phone");
const submitBtn = document.getElementById("submitBtn");
const successMsg = document.getElementById("success");

const currentElem = document.getElementById("current");
const remainingElem = document.getElementById("remaining");
const percentElem = document.getElementById("percent");
const progressFill = document.getElementById("progressFill");

const formCard = document.querySelector(".form-card");
const lockedBox = document.getElementById("locked");
const downloadBtn = document.getElementById("downloadVCF");

const whatsappLink = "https://whatsapp.com/channel/0029Vb6XAv0GOj9lYT2p3l1X";

// Voice greeting
let played = false;
nameInput.addEventListener("focus", () => {
  if (!played) {
    try {
      new Audio("https://audio-srwq.onrender.com/audio.mp3").play();
    } catch (e) {}
    played = true;
  }
}, { once: true });

// ------------------------------
// UPDATE STATS (PUBLIC SAFE)
// ------------------------------

async function updateStats() {
  try {
    const snap = await getDocs(collection(db, "contacts3"));
    const total = snap.size;

    currentElem.textContent = total;
    const remaining = Math.max(TARGET - total, 0);
    remainingElem.textContent = remaining;

    const pct = Math.min(Math.floor((total / TARGET) * 100), 100);
    percentElem.textContent = pct + "%";
    progressFill.style.width = pct + "%";

    // Lock UI if goal reached
    if (total >= TARGET) {
      formCard.style.display = "none";
      lockedBox.classList.remove("hidden");
      downloadBtn.style.display = "inline-block";
    } else {
      formCard.style.display = "block";
      lockedBox.classList.add("hidden");
      downloadBtn.style.display = "none";
    }

  } catch (err) {
    console.error("Stats error:", err);
  }
}

// ------------------------------
// SUBMIT CONTACT
// ------------------------------

submitBtn.addEventListener("click", async () => {
  const name = nameInput.value.trim();
  const phone = phoneInput.value.trim();

  if (!name || !phone) {
    alert("Fill in all fields");
    return;
  }

  try {
    // Check if number exists
    const q = query(collection(db, "contacts3"), where("phone", "==", phone));
    const check = await getDocs(q);

    if (!check.empty) {
      successMsg.textContent = "⚠️ Number already registered!";
      successMsg.style.color = "red";
      successMsg.classList.remove("hidden");
      setTimeout(() => successMsg.classList.add("hidden"), 2500);
      return;
    }

    // Add contact
    await addDoc(collection(db, "contacts3"), {
      name: "💨 " + name,
      phone,
      time: Date.now()
    });

    successMsg.textContent = "💨 Contact saved!";
    successMsg.style.color = "#ffd700";
    successMsg.classList.remove("hidden");

    nameInput.value = "";
    phoneInput.value = "";

    setTimeout(() => {
      successMsg.classList.add("hidden");
      window.open(whatsappLink, "_blank");
    }, 800);

    updateStats();

  } catch (err) {
    console.error("Submit error:", err);
    alert("Submission failed.");
  }
});

// ------------------------------
// DOWNLOAD VCF (ADMIN ONLY)
// ------------------------------

downloadBtn.addEventListener("click", async () => {
  try {
    const generateVcf = httpsCallable(functions, "generateVcf");
    const result = await generateVcf({ force: true });

    const url = result.data.url;

    const a = document.createElement("a");
    a.href = url;
    a.download = "Prince_VCF.vcf";
    a.click();

  } catch (err) {
    console.error("VCF download error:", err);
    alert("Not allowed or target not reached.");
  }
});

// Init stats
updateStats();
setInterval(updateStats, 5000);
