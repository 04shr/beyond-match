/* =========================================================
   FIREBASE IMPORTS
   Initializes Firebase services used in the app
========================================================= */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getAnalytics, logEvent } 
from "https://www.gstatic.com/firebasejs/10.7.1/firebase-analytics.js";
import {
  getFirestore,
  serverTimestamp,
  doc,
  setDoc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";


/* =========================================================
   FIREBASE CONFIGURATION
   Project credentials for Firebase initialization
========================================================= */
const firebaseConfig = {
  apiKey: "AIzaSyCbrwCaaQYEFCF1FJto_O3OYi68qTOqGQc",
  authDomain: "beyondmatch-a714f.firebaseapp.com",
  projectId: "beyondmatch-a714f",
  storageBucket: "beyondmatch-a714f.firebasestorage.app",
  messagingSenderId: "16758090560",
  appId: "1:16758090560:web:89f207139970c97592a8a5",
  measurementId: "G-VZN3JKW8DX"
};

/* Initialize Firebase services */
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const analytics = getAnalytics(app);


/* =========================================================
   GLOBAL AUTH STATE LISTENER
   Handles login redirects and role-based access control
========================================================= */
onAuthStateChanged(auth, async (user) => {

  const path = window.location.pathname;

  // If not logged in → only protect non-index pages
  if (!user) {
    if (!path.endsWith("index.html") && path !== "/") {
      window.location.href = "/index.html";
    }
    return;
  }

  // If logged in AND on index → redirect to dashboard
  if (path.endsWith("index.html") || path === "/") {

    const snap = await getDoc(doc(db, "users", user.uid));
    const role = snap.exists() ? snap.data().role : "candidate";

    if (role === "recruiter") {
      window.location.href = "/rec-dash.html";
    } else if (role === "admin") {
      window.location.href = "/admin.html";
    } else {
      window.location.href = "/candidate-dashboard.html";
    }
  }

});

/* =========================================================
   LOGOUT FUNCTION
   Signs user out and redirects to landing page
========================================================= */
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
   AUTH STATE VARIABLES
   Tracks login/signup mode
========================================================= */
let authMode = "login";
let justSignedUp = false;


/* =========================================================
   AUTH MODAL UI CONTROL
   Open, close and toggle authentication modal
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


/* =========================================================
   UPDATE AUTH UI
   Updates text, buttons and fields based on auth mode
========================================================= */
function updateAuthUI() {
  const title = document.getElementById("authTitle");
  const text = document.getElementById("authText");
  const link = document.getElementById("authToggleLink");
  const btn = document.querySelector(".auth-btn");
  const roleSelect = document.getElementById("roleSelect");
  const orgInput = document.getElementById("orgNameInput");

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

    if (orgInput) {
      orgInput.style.display = "none";
      orgInput.value = "";
    }
  }
}


/* =========================================================
   AUTH MESSAGE HELPERS
   Show and clear auth status messages
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
   AUTH FORM SUBMIT HANDLER
   Handles signup and login logic
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

    const orgName = document.getElementById("orgNameInput")?.value.trim();

    if (authMode === "signup" && role === "recruiter" && !orgName) {
      showMessage("Please enter organisation name.");
      btn.disabled = false;
      return;
    }

    try {

      /* Signup flow */
      if (authMode === "signup") {
        const cred = await createUserWithEmailAndPassword(auth, email, password);

        await setDoc(doc(db, "users", cred.user.uid), {
          email,
          role,
          organisation_name: role === "recruiter" ? orgName : null,
          createdAt: serverTimestamp()
        });

        showMessage("Account created successfully 🎉 Please login.", "success");

        justSignedUp = true;
        authMode = "login";
        updateAuthUI();

        btn.disabled = false;
        return;
      }

      /* Login flow */
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


/* =========================================================
   ROLE SELECT HANDLER
   Shows organisation field for recruiter signup
========================================================= */
document.getElementById("roleSelect")?.addEventListener("change", (e) => {
  const orgInput = document.getElementById("orgNameInput");

  if (e.target.value === "recruiter") {
    orgInput.style.display = "block";
  } else {
    orgInput.style.display = "none";
    orgInput.value = "";
  }
});


/* =========================================================
   GLOBAL EXPORTS
   Exposes Firebase and auth UI functions globally
========================================================= */
window.auth = auth;
window.db = db;

window.openAuth = openAuth;
window.closeAuth = closeAuth;
window.toggleAuth = toggleAuth;

export { analytics, auth, db };