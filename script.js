/* =========================================================
   FIREBASE SETUP (UNCHANGED)
========================================================= */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import {
  getFirestore,
  collection,
  addDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import { getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

async function fetchCandidateCount() {
  const snapshot = await getDocs(collection(db, "candidates"));
  return snapshot.size;
}

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

import { doc, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";


/* =========================================================
   BACKEND API CONFIG (ONLY CHANGE ADDED)
========================================================= */
const API_BASE = "https://2bcj60lax1.execute-api.eu-north-1.amazonaws.com/prod";

/* =========================================================
   GENERIC API FETCH (ONLY CHANGE ADDED)populateJobDropdown()
========================================================= */
async function apiFetch(path, options = {}) {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {})
      },
      ...options
    });

    const text = await res.text();

    if (!res.ok) {
      console.error("API error:", res.status, text);
      return { error: res.status, raw: text };
    }

    return text ? JSON.parse(text) : {};
  } catch (err) {
    console.error("Network error:", err);
    return { error: "network_error" };
  }
}


/* =========================================================
   FETCH JOBS (FOR DASHBOARD STATS)
========================================================= */
async function fetchJobs() {
  const res = await apiFetch("/jobs");

  let data = [];
  if (Array.isArray(res)) {
    data = res;
  } else if (typeof res?.body === "string") {
    data = JSON.parse(res.body);
  }

  return data;
}

window.fetchJobs = fetchJobs; // ✅ THIS LINE FIXES IT


/* =========================================================
   JOB LISTING (REPLACED LOGIC ONLY)
========================================================= */
async function renderJobs() {
  const grid = document.getElementById("jobsGrid");
  if (!grid) return;

  grid.innerHTML = "Loading jobs…";

  const res = await apiFetch("/jobs");

  const jobs = Array.isArray(res)
    ? res
    : typeof res?.body === "string"
      ? JSON.parse(res.body)
      : [];

  if (!jobs.length) {
    grid.innerHTML = "Failed to load jobs.";
    return;
  }

  grid.innerHTML = jobs.map(job => `
    <div class="job-card">
      <h3>${job.title}</h3>
      <p class="company">${job.company || ""}</p>
      <p class="location">${job.location}</p>
      <p class="summary">${job.description.slice(0, 120)}…</p>
      <small>Job ID: ${job.job_id}</small>
    </div>
  `).join("");
}



/* =========================================================
   UPLOAD CANDIDATE (REPLACED LOGIC ONLY)
========================================================= */
async function uploadCandidate(name, email, resumeText) {
  const res = await apiFetch("/candidates", {
    method: "POST",
    body: JSON.stringify({
      name,
      email,
      resume_text: resumeText || ""
    })
  });

  // extract backend candidate_id
  const backendCandidateId =
    res?.candidate_id ||
    (typeof res?.body === "string" && JSON.parse(res.body)?.candidate_id);

  if (!backendCandidateId) {
    throw new Error("Backend did not return candidate_id");
  }

  // ✅ store using SAME ID
  await setDoc(doc(db, "candidates", backendCandidateId), {
    candidate_id: backendCandidateId,
    name,
    email,
    createdAt: serverTimestamp()
  });

  return res;
}


window.uploadCandidate = uploadCandidate;

/* =========================================================
   LOAD JOBS INTO DROPDOWN (REPLACED LOGIC ONLY)
========================================================= */
async function populateJobDropdown() {
  const select = document.getElementById("jobSelect");
  if (!select) return;

  const res = await apiFetch("/jobs");

  const jobs = Array.isArray(res)
    ? res
    : typeof res?.body === "string"
      ? JSON.parse(res.body)
      : [];

  select.innerHTML = `<option value="">Select a job</option>`;

  jobs.forEach(job => {
    const opt = document.createElement("option");
    opt.value = job.job_id;
    opt.textContent = `${job.title} — ${job.company || ""}`;
    select.appendChild(opt);
  });
}


/* =========================================================
   FETCH MATCHES (REPLACED LOGIC ONLY)
========================================================= */
async function loadMatches() {
  const jobId = document.getElementById("jobSelect").value;
 const output = document.getElementById("matchesList") || { textContent: "" };

  if (!jobId) {
    alert("Please select a job");
    return;
  }

  console.log("JOB ID SENT:", jobId);

 const res = await apiFetch(
  `/matches?job_id=${jobId}&top_n=5&offset=0`
);


  let data = res;

  if (typeof res?.body === "string") {
    data = JSON.parse(res.body);
  }

  if (!data.matches || data.matches.length === 0) {
    output.textContent = "No candidates matched for this job.";
    return;
  }

  // keep JSON for safety (hidden)
output.textContent = JSON.stringify(data.matches, null, 2);

// NEW: card rendering (display only)
const grid = document.getElementById("matchesGrid");
grid.innerHTML = "";

data.matches.forEach(candidate => {
  const card = document.createElement("div");
  card.className = "match-card";

  const breakdown = candidate.score_breakdown || {};
  const explanations = candidate.explanations || [];

  card.innerHTML = `
    <div class="match-header">
      <div>
        <div class="match-name">
          ${candidate.name !== "N/A" ? candidate.name : "Candidate"}
        </div>
        <div class="match-email">${candidate.email}</div>
      </div>

      <div class="match-score">
        ${(candidate.score * 100).toFixed(1)}%
      </div>
    </div>

    <div class="match-section">
      <strong>Score Breakdown</strong>
      <div class="score-grid">
        <span>BM25</span><span>${breakdown.bm25 ?? "-"}</span>
        <span>Skills</span><span>${breakdown.skills ?? "-"}</span>
        <span>Title</span><span>${breakdown.title ?? "-"}</span>
        <span>Seniority</span><span>${breakdown.seniority ?? "-"}</span>
        <span>Semantic</span><span>${breakdown.semantic_bonus ?? "-"}</span>
        <span>Final</span><span>${breakdown.final ?? "-"}</span>
      </div>
    </div>

    ${
      explanations.length
        ? `
        <div class="match-section">
          <strong>Why this candidate?</strong>
          <ul class="explanation-list">
            ${explanations.map(e => `<li>${e}</li>`).join("")}
          </ul>
        </div>
        `
        : ""
    }
  `;

  grid.appendChild(card);
});


}

/* =========================================================
   AUTO INIT (BACKEND UI ONLY)
========================================================= */
document.addEventListener("DOMContentLoaded", async () => {
  if (document.getElementById("jobsGrid")) {
    renderJobs();
  }

  if (document.getElementById("jobSelect")) {
    await populateJobDropdown();
    document
      .getElementById("loadMatchesBtn")
      .addEventListener("click", loadMatches);
  }

  onAuthStateChanged(auth, async (user) => {
  if (user && document.getElementById("kpi-jds")) {
    await loadDashboardKPIs();
  }
});

});

async function loadDashboardKPIs() {
  // 1️⃣ Fetch Jobs
  const candidateCount = await fetchCandidateCount();
  const jobsRes = await apiFetch("/jobs");
  const jobs = Array.isArray(jobsRes)
    ? jobsRes
    : JSON.parse(jobsRes.body || "[]");

  // 3️⃣ Fetch Matches for ALL jobs
  let totalMatches = 0;
  let totalScore = 0;
  let scoreCount = 0;
  const roleMap = {};

  for (const job of jobs) {
    const matchRes = await apiFetch(
      `/matches?job_id=${job.job_id}&top_n=50&offset=0`
    );

    const matchData = typeof matchRes?.body === "string"
      ? JSON.parse(matchRes.body)
      : matchRes;

    if (!matchData?.matches) continue;

    totalMatches += matchData.matches.length;

    matchData.matches.forEach(m => {
      if (typeof m.score === "number") {
        totalScore += m.score;
        scoreCount++;
      }

      // Track roles
      roleMap[job.title] = (roleMap[job.title] || 0) + 1;
    });
  }

  const avgAccuracy = scoreCount
    ? Math.round((totalScore / scoreCount) * 100)
    : 0;

  // 4️⃣ Update UI
  document.getElementById("kpi-jds").textContent = jobs.length;
document.getElementById("kpi-candidates").textContent = candidateCount;
  document.getElementById("kpi-matches").textContent = totalMatches;
  document.getElementById("kpi-accuracy").textContent = `${avgAccuracy}%`;

  renderTopRoles(roleMap);
}
function renderTopRoles(roleMap) {
  const list = document.getElementById("topRolesList");
  if (!list) return;

  const sorted = Object.entries(roleMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);

  list.innerHTML = sorted
    .map(([role, count]) => `
      <li>${role} <span>${count} matches</span></li>
    `)
    .join("");
}

window.onload = loadCandidates;

async function loadCandidates() {
  const select = document.getElementById("candidateSelect");
  if (!select) return;

  select.innerHTML = `<option value="">Loading candidates...</option>`;

  const snapshot = await getDocs(collection(db, "candidates"));

  select.innerHTML = `<option value="">Select candidate</option>`;

snapshot.forEach(docSnap => {
  const data = docSnap.data();

  // 🛑 ignore old / broken candidates
  if (docSnap.id !== data.candidate_id) return;

  const option = document.createElement("option");
  option.value = docSnap.id; // backend ID
  option.textContent = data.name;
  select.appendChild(option);
});

}


async function loadCandidateJobMatches() {
  const select = document.getElementById("candidateSelect");
  const candidateId = select.value;

  const output =
    document.getElementById("matchesList") || { textContent: "" };
  const grid = document.getElementById("matchesGrid");

  if (!candidateId) {
    alert("Please select a candidate");
    return;
  }

  console.log("CANDIDATE ID SENT:", candidateId);

  const res = await apiFetch(
    `/matches?candidate_id=${candidateId}&top_n=5&offset=0`
  );

  let data = res;
  if (typeof res?.body === "string") {
    data = JSON.parse(res.body);
  }

  if (!data.matches || data.matches.length === 0) {
    output.textContent = "No jobs matched for this candidate.";
    grid.innerHTML = "";
    return;
  }

  // keep raw JSON (debug-safe)
  output.textContent = JSON.stringify(data.matches, null, 2);

  // render job cards
  grid.innerHTML = "";

  data.matches.forEach(job => {
    const card = document.createElement("div");
    card.className = "match-card";

    const breakdown = job.score_breakdown || {};
    const explanations = job.explanations || [];

    card.innerHTML = `
      <div class="match-header">
        <div>
          <div class="match-name">
            ${job.job_title || job.title || job.job_role || job.role || "Job Role"}
          </div>
          <div class="match-email">
            ${job.company || "Company"}
          </div>
        </div>

        <div class="match-score">
          ${(job.score * 100).toFixed(1)}%
        </div>
      </div>

      <div class="match-section">
        <strong>Score Breakdown</strong>
        <div class="score-grid">
          <span>BM25</span><span>${breakdown.bm25 ?? "-"}</span>
          <span>Skills</span><span>${breakdown.skills ?? "-"}</span>
          <span>Title</span><span>${breakdown.title ?? "-"}</span>
          <span>Seniority</span><span>${breakdown.seniority ?? "-"}</span>
          <span>Semantic</span><span>${breakdown.semantic_bonus ?? "-"}</span>
          <span>Final</span><span>${breakdown.final ?? "-"}</span>
        </div>
      </div>

      ${
        explanations.length
          ? `
          <div class="match-section">
            <strong>Why this job?</strong>
            <ul class="explanation-list">
              ${explanations.map(e => `<li>${e}</li>`).join("")}
            </ul>
          </div>
          `
          : ""
      }
    `;

    grid.appendChild(card);
  });
}

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

  if (authMode === "login") {
    title.innerText = "Login";
    text.innerText = "Don’t have an account?";
    link.innerText = "Sign Up";
    btn.innerText = "Login";
  } else {
    title.innerText = "Sign Up";
    text.innerText = "Already have an account?";
    link.innerText = "Login";
    btn.innerText = "Create Account";
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

    if (!email || !password) {
      showMessage("Please enter email and password.");
      return;
    }

    if (password.length < 6) {
      showMessage("Password must be at least 6 characters.");
      return;
    }

    btn.disabled = true;

    try {
      /* ================= SIGN UP ================= */
      if (authMode === "signup") {
        const cred = await createUserWithEmailAndPassword(auth, email, password);

       await setDoc(doc(db, "users", cred.user.uid), {
  email,
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

      setTimeout(() => {
        window.location.href = "dashboard.html";
      }, 800);

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
   AUTH STATE REDIRECT
========================================================= */
onAuthStateChanged(auth, (user) => {
  const path = window.location.pathname;

  if (user && path.endsWith("index.html")) {
    if (justSignedUp) return; // ⛔ stop auto redirect after signup
    window.location.href = "dashboard.html";
  }

  if (!user && path.endsWith("dashboard.html")) {
    window.location.href = "index.html";
  }
});

/* =========================================================
   EXPOSE
========================================================= */
window.openAuth = openAuth;
window.closeAuth = closeAuth;
window.toggleAuth = toggleAuth;
