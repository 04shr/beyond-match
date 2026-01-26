/* =========================================================
   FIREBASE SETUP (UNCHANGED)
========================================================= */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import {
  getFirestore,
  serverTimestamp,
  doc,
  setDoc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";


/* =========================================================
   FIREBASE CONFIG (UNCHANGED)
========================================================= */
const firebaseConfig = {
  apiKey: "AIzaSyCbrwCaaQYEFCF1FJto_O3OYi68qTOqGQc",
  authDomain: "beyondmatch-a714f.firebaseapp.com",
  projectId: "beyondmatch-a714f",
  storageBucket: "beyondmatch-a714f.firebasestorage.app",
  messagingSenderId: "16758090560",
  appId: "1:16758090560:web:89f207139970c97592a8a5"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

/* =========================================================
   🔒 SINGLE AUTH STATE LISTENER (FIX)
========================================================= */
onAuthStateChanged(auth, async (user) => {
  const page = window.location.pathname.split("/").pop();

  if (!user) {
    if (page !== "index.html") {
      window.location.replace("index.html");
    }
    return;
  }

  const snap = await getDoc(doc(db, "users", user.uid));
  const role = snap.exists() ? snap.data().role : "candidate";

  if (page === "index.html") {
    const routes = {
      admin: "admin.html",
      recruiter: "rec-dash.html",
      candidate: "candidate-dashboard.html"
    };
    window.location.replace(routes[role] || "candidate-dashboard.html");
    return;
  }

const allowed = {
  admin: ["admin.html", "settings.html"],
  recruiter: ["rec-dash.html", "upload-jd.html", "settings.html"],
  candidate: ["candidate-dashboard.html", "jobmatches.html", "savedjobs.html", "locatehire.html", "settings.html", "upload-jd.html"]
};


  if (!allowed[role]?.includes(page)) {
    window.location.replace("index.html");
  }

});

window.unifiedLogout = async function () {
  try {
    await signOut(auth);
    window.location.replace("index.html");
  } catch (err) {
    console.error("Logout failed:", err);
    alert("Failed to logout. Please try again.");
  }
};



/* =========================================================
   AUTH STATE
========================================================= */
let authMode = "login"; // login | signup
let justSignedUp = false;

/* =========================================================
   AUTH UI CONTROL
========================================================= */
function openAuth(mode) {
  authMode = mode;
  updateAuthUI();
  clearAuthMessage();
  document.getElementById("authOverlay").style.display = "block";
  document.getElementById("authCard").style.display = "block";
}

function closeAuth() {
  document.getElementById("authOverlay").style.display = "none";
  document.getElementById("authCard").style.display = "none";
}

function toggleAuth() {
  authMode = authMode === "login" ? "signup" : "login";
  updateAuthUI();
  clearAuthMessage();
}

function updateAuthUI() {
  const title = document.getElementById("authTitle");
  const text = document.getElementById("authText");
  const link = document.getElementById("authToggleLink");
  const btn = document.querySelector(".auth-btn");
  const roleSelect = document.getElementById("roleSelect");


 if (authMode === "login") {
  title.innerText = "Login";
  text.innerText = "Don’t have an account?";
  link.innerText = "Sign Up";
  btn.innerText = "Login";

  if (roleSelect) roleSelect.style.display = "none";

} else {
  title.innerText = "Sign Up";
  text.innerText = "Already have an account?";
  link.innerText = "Login";
  btn.innerText = "Create Account";

  if (roleSelect) roleSelect.style.display = "block";
}
}

/* =========================================================
   AUTH MESSAGE
========================================================= */
function showMessage(text, type = "error") {
  const msg = document.getElementById("authMessage");
  msg.innerText = text;
  msg.className = `auth-message ${type}`;
  msg.style.display = "block";
}

function clearAuthMessage() {
  const msg = document.getElementById("authMessage");
  if (!msg) return;
  msg.innerText = "";
  msg.style.display = "none";
}

/* =========================================================
   AUTH SUBMIT HANDLER
========================================================= */
document.addEventListener("DOMContentLoaded", () => {
  const emailInput = document.querySelector('.auth-card input[type="email"]');
  const passwordInput = document.querySelector('.auth-card input[type="password"]');
  const btn = document.querySelector(".auth-btn");

  if (!btn) return;

  btn.onclick = async () => {
    clearAuthMessage();

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    const role =
  authMode === "signup"
    ? document.getElementById("roleSelect")?.value
    : null;


    if (!email || !password) {
      showMessage("Please enter email and password.");
      return;
    }

    if (password.length < 6) {
      showMessage("Password must be at least 6 characters.");
      return;
    }

    btn.disabled = true;

    if (authMode === "signup" && !role) {
  showMessage("Please select a role.");
  return;
}


    try {
      /* ================= SIGN UP ================= */
      if (authMode === "signup") {
        const cred = await createUserWithEmailAndPassword(auth, email, password);

       await setDoc(doc(db, "users", cred.user.uid), {
  email,
  role,                  // 🔥 NEW
  createdAt: serverTimestamp()
});



        showMessage("Account created successfully 🎉 Please login.", "success");

        // 🔑 CRITICAL FIXES
        justSignedUp = true;
        authMode = "login";
        updateAuthUI();

        btn.disabled = false;
        return;
      }

      /* ================= LOGIN ================= */
 await signInWithEmailAndPassword(auth, email, password);
showMessage("Login successful. Redirecting…", "success");



    } catch (error) {
      if (error.code === "auth/email-already-in-use") {
        showMessage("Email already registered. Please login.");
      } else if (error.code === "auth/wrong-password") {
        showMessage("Incorrect password.");
      } else if (error.code === "auth/user-not-found") {
        showMessage("No account found. Please sign up.");
      } else if (error.code === "auth/invalid-email") {
        showMessage("Invalid email format.");
      } else {
        showMessage("Authentication failed. Please try again.");
      }
    } finally {
      btn.disabled = false;
    }
  };
});

window.auth = auth;
window.db = db;
// 🔓 Expose auth UI functions globally (for inline HTML handlers)
window.openAuth = openAuth;
window.closeAuth = closeAuth;
window.toggleAuth = toggleAuth;
