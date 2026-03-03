/* =========================================================
   FIREBASE IMPORTS
   Firestore operations used for candidate and job handling
========================================================= */
import {
  collection,
  getDocs,
  setDoc,
  deleteDoc,
  doc,
  query,
  where,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import { analytics } from "./auth.js";
import { logEvent } 
from "https://www.gstatic.com/firebasejs/10.7.1/firebase-analytics.js";

const db = window.db;
const auth = window.auth;

import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";


/* =========================================================
   ROLE INFERENCE
   Detects candidate role using resume keywords
========================================================= */
function inferRoleFromResume(text = "") {
  const t = text.toLowerCase();

  const ROLE_KEYWORDS = {
    "Backend Developer": ["backend", "node", "django", "flask", "api", "database", "express"],
    "Frontend Developer": ["frontend", "html", "css", "react", "ui"],
    "Full Stack Developer": ["full stack", "mern", "frontend", "backend"],
    "Software Engineer": ["software engineer", "java", "javascript"],
    "Data Scientist": ["machine learning", "deep learning", "statistics", "model"],
    "Data Analyst": ["data analyst", "power bi", "tableau", "excel", "analytics"],
    "DevOps Engineer": ["docker", "kubernetes", "aws", "ci/cd"],
    "AI Engineer": ["nlp", "computer vision", "llm"]
  };

  let bestRole = "General";
  let maxScore = 0;

  for (const role in ROLE_KEYWORDS) {
    let score = 0;
    ROLE_KEYWORDS[role].forEach(k => {
      if (t.includes(k)) score++;
    });

    if (score > maxScore) {
      maxScore = score;
      bestRole = role;
    }
  }

  return bestRole;
}


/* =========================================================
   UPLOAD CANDIDATE
   Sends candidate to backend and stores metadata in Firestore
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

  const backendCandidateId =
    res?.candidate_id ||
    (typeof res?.body === "string" && JSON.parse(res.body)?.candidate_id);

  if (!backendCandidateId) {
    throw new Error("Backend did not return candidate_id");
  }

  const inferredRole = inferRoleFromResume(resumeText);

  await setDoc(doc(db, "candidates", backendCandidateId), {
    candidate_id: backendCandidateId,
    name,
    email,
    user_id: auth.currentUser.uid,
    applied_role: inferredRole,
    createdAt: serverTimestamp()
  });

  logEvent(analytics, "candidate_created", {
    recruiter_id: auth.currentUser.uid,
    role_detected: inferredRole
  });

  return res;
}

window.uploadCandidate = uploadCandidate;


/* =========================================================
   LOAD USER CANDIDATES
   Loads only resumes uploaded by current user
========================================================= */
async function loadUserCandidatesOnly() {
  const select = document.getElementById("candidateSelect");
  if (!select) return;

  const user = auth.currentUser;
  if (!user) return;

  select.innerHTML = `<option value="">Select your resume</option>`;

  const snapshot = await getDocs(collection(db, "candidates"));

  snapshot.forEach(docSnap => {
    const data = docSnap.data();

    if (data.user_id && data.user_id !== user.uid) return;
    if (!data.user_id && data.email !== user.email) return;

    const option = document.createElement("option");
    option.value = docSnap.id;
    option.textContent = `${data.name} – ${data.applied_role || "General"}`;

    select.appendChild(option);
  });
}


/* =========================================================
   LOAD ALL CANDIDATES
   Populates candidate dropdown from Firestore
========================================================= */
async function loadCandidates() {
  const select = document.getElementById("candidateSelect");
  if (!select) return;

  select.innerHTML = `<option value="">Loading candidates...</option>`;

  const snapshot = await getDocs(collection(db, "candidates"));

  select.innerHTML = `<option value="">Select candidate</option>`;

  snapshot.forEach(docSnap => {
    const data = docSnap.data();

    if (docSnap.id !== data.candidate_id) return;

    const option = document.createElement("option");
    option.value = docSnap.id;
    option.textContent = data.name;
    select.appendChild(option);
  });
}


/* =========================================================
   LOAD JOB MATCHES
   Fetches and renders matched jobs for selected candidate
========================================================= */
async function loadCandidateJobMatches() {
  const select = document.getElementById("candidateSelect");
  const candidateId = select.value;
  const grid = document.getElementById("matchesGrid");

  if (!candidateId) {
    alert("Please select a candidate");
    return;
  }

  grid.innerHTML = "Loading matches...";

  const res = await apiFetch(
    `/matches?candidate_id=${candidateId}&top_n=5&offset=0`
  );

  let data = res;

  if (typeof res?.body === "string") {
    data = JSON.parse(res.body);
  }

  const matches = Array.isArray(data)
    ? data
    : data.matches || [];

  if (!matches.length) {
    grid.innerHTML = `
      <div class="no-matches">
        <h4>No matches found</h4>
        <p>We couldn’t find any suitable jobs for this candidate right now.</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = "";

const jobsRes = await apiFetch("/jobs");

let allJobs = [];

if (Array.isArray(jobsRes)) {
  allJobs = jobsRes;
} else if (jobsRes?.body) {
  try {
    allJobs = JSON.parse(jobsRes.body);
  } catch {
    allJobs = [];
  }
}

 const jobsMap = {};
allJobs.forEach(j => {
  jobsMap[j.job_id] = j;
});

matches.forEach(match => {

  // 🔥 find full job from jobs list
  const job =
  allJobs.find(j => j.job_id === match.job_id) ||
  match ||
  {};
  /* =========================
     LOCATION (FIXED)
  ========================= */
  const location =
    job.location_display ||
    job.location ||
    (job.city && job.country
      ? `${job.city}, ${job.country}`
      : job.city ||
        job.country ||
        "Not specified");

  /* =========================
     COMPANY (FIXED)
  ========================= */
  const company =
    job.company ||
    match.company ||
    "Company not available";

  /* =========================
     SALARY (FIXED)
  ========================= */
  let salary = "Not disclosed";

  if (job.salary_min && job.salary_max) {
    salary =
      `$${Math.round(job.salary_min).toLocaleString()} - ` +
      `$${Math.round(job.salary_max).toLocaleString()}`;
  } else if (job.salary_min) {
    salary =
      `From $${Math.round(job.salary_min).toLocaleString()}`;
  } else if (job.salary_max) {
    salary =
      `Up to $${Math.round(job.salary_max).toLocaleString()}`;
  }

  const percent =
    match.match_percent != null
      ? match.match_percent.toFixed(1)
      : "0.0";

  grid.innerHTML += `
    <div class="job-card"
     data-location="${location}"
     data-match="${percent}"
     data-salary="${job.salary_min || 0}">

      <h3>${match.title || job.title || "Job Title"}</h3>

      <p class="company">${company}</p>

      <p class="location">📍 ${location}</p>

      <p class="salary">💰 ${salary}</p>

      <span class="match-pill">
       <p class="company"> Match Percent: ${percent}%</p> 
      </span>

     <div class="job-actions">
  <button class="apply-btn"
  data-url="${job.apply_url || match.apply_url || ''}">
  Apply
</button>

       <button 
  class="save-btn"
  onclick='saveJobToFirebase(${JSON.stringify(job)}, "${candidateId}")'>
  Save Job
</button>
      </div>

    

    </div>
  `;
});

  setupMatchFilters();

  document.querySelectorAll(".apply-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    const url = btn.getAttribute("data-url");

    if (!url) {
      alert("Application link not available for this job.");
      return;
    }

    window.open(url, "_blank", "noopener,noreferrer");
  });
});
}





/* =========================================================
   MATCH FILTERS
   Handles filtering and sorting of matched jobs
========================================================= */
function setupMatchFilters() {

  const locationFilter = document.getElementById("locationFilter");
  const matchFilter = document.getElementById("matchFilter");
  const salarySort = document.getElementById("salarySort");

  if (!locationFilter) return;

  const cards = () => document.querySelectorAll(".job-card");

  const locations = new Set();
  cards().forEach(c => locations.add(c.dataset.location));

  locationFilter.innerHTML =
    `<option value="">All Locations</option>` +
    [...locations].map(l => `<option value="${l}">${l}</option>`).join("");

  function applyFilters() {

    const loc = locationFilter.value;
    const minMatch = matchFilter.value;

    cards().forEach(card => {

      let visible = true;

      if (loc && card.dataset.location !== loc) visible = false;
      if (minMatch && Number(card.dataset.match) < Number(minMatch)) visible = false;

      card.style.display = visible ? "block" : "none";
    });

    if (salarySort.value) {
      const sorted = [...cards()].sort((a, b) => {
        const aSalary = Number(a.dataset.salary);
        const bSalary = Number(b.dataset.salary);

        return salarySort.value === "high"
          ? bSalary - aSalary
          : aSalary - bSalary;
      });

      const grid = document.getElementById("matchesGrid");
      sorted.forEach(card => grid.appendChild(card));
    }
  }

  locationFilter.onchange = applyFilters;
  matchFilter.onchange = applyFilters;
  salarySort.onchange = applyFilters;
}

window.loadCandidateJobMatches = loadCandidateJobMatches;


/* =========================================================
   AUTH LISTENER
   Loads user candidates after login
========================================================= */
onAuthStateChanged(window.auth, (user) => {
  if (!user) return;

  const select = document.getElementById("candidateSelect");
  if (!select) return;

  loadUserCandidatesOnly();
});


/* =========================================================
   SAVE JOB
   Saves shortlisted job to Firestore
========================================================= */
async function saveJobToFirebase(job, candidateId) {

  const user = auth.currentUser;
  if (!user) return;

  /* ===== SAFE CHECK FIRST ===== */
  if (!job || !job.job_id) {
    console.error("Invalid job object:", job);
    alert("Job data missing");
    return;
  }

  const docId = `${user.uid}_${candidateId}_${job.job_id}`;

  await setDoc(doc(db, "saved_jobs", docId), {
    user_id: user.uid,
    candidate_id: candidateId,
    job_id: job.job_id,
    title: job.title || "Untitled Job",
    company: job.company || "Company not available",
    location:
      job.location_display ||
      job.location ||
      (job.city && job.country
        ? `${job.city}, ${job.country}`
        : "Location not specified"),
    salary_min: job.salary_min ?? null,
    salary_max: job.salary_max ?? null,
    description: job.description || "",
    apply_url: job.apply_url || "#",
    savedAt: serverTimestamp()
  });

  trackInteraction({
    job_id: job.job_id,
    candidate_id: candidateId,
    action: "shortlist"
  });

  alert("Job saved successfully");
}

/* =========================================================
   TRACK INTERACTION
   Sends interaction data to backend analytics endpoint
========================================================= */
async function trackInteraction({ job_id, candidate_id, action }) {
  try {
    await fetch(
      "https://2bcj60lax1.execute-api.eu-north-1.amazonaws.com/prod/trackInteraction",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          job_id,
          candidate_id,
          action
        })
      }
    );
  } catch (err) {
    console.warn("Interaction tracking failed:", err);
  }
}
function openApplyLink(url) {

  if (!url || url === "#" || url.trim() === "") {
    alert("Application link not available for this job.");
    return;
  }

  window.open(url, "_blank", "noopener,noreferrer");
}

/* =========================================================
   GLOBAL EXPORTS
========================================================= */
window.loadCandidateJobMatches = loadCandidateJobMatches;
window.saveJobToFirebase = saveJobToFirebase;
window.openApplyLink = openApplyLink;