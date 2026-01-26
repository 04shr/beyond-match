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

const db = window.db;
const auth = window.auth;


import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";


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

const inferredRole = inferRoleFromResume(resumeText);

await setDoc(doc(db, "candidates", backendCandidateId), {
  candidate_id: backendCandidateId,
  name,
  email,
  user_id: auth.currentUser.uid,
  applied_role: inferredRole,
  createdAt: serverTimestamp()
});
  return res;
}


window.uploadCandidate = uploadCandidate;




async function loadUserCandidatesOnly() {
  const select = document.getElementById("candidateSelect");
  if (!select) return;

  const user = auth.currentUser;
  if (!user) return;

  select.innerHTML = `<option value="">Select your resume</option>`;

  const snapshot = await getDocs(collection(db, "candidates"));

  snapshot.forEach(docSnap => {
    const data = docSnap.data();

    // 🔒 FILTER: only current user's resumes
// show only candidates uploaded by this user
if (data.user_id && data.user_id !== user.uid) return;

// allow legacy candidates without user_id (optional)
if (!data.user_id && data.email !== user.email) return;


    const option = document.createElement("option");
    option.value = docSnap.id;

    // 👇 Name – Role (hyphenated)
    option.textContent = `${data.name} – ${data.applied_role || "General"}`;

    select.appendChild(option);
  });
}


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

// ✅ REPLACE WITH (styled + clear message)
if (!data.matches || data.matches.length === 0) {
  grid.innerHTML = `
    <div class="no-matches">
      <h4>No matches found</h4>
      <p>We couldn’t find any suitable jobs for this candidate right now.</p>
    </div>
  `;
  return;
}

grid.innerHTML = "";
// 🔧 PLACE THIS JUST BEFORE data.matches.forEach(...)

const jobsRes = await apiFetch("/jobs");
const allJobs = Array.isArray(jobsRes)
  ? jobsRes
  : JSON.parse(jobsRes.body || "[]");

const salaryMap = {};
allJobs.forEach(j => {
  salaryMap[j.job_id] = {
    salary_min: j.salary_min ?? null,
    salary_max: j.salary_max ?? null
  };
});

// 🔧 REPLACE YOUR EXISTING LOOP WITH THIS

data.matches.forEach(job => {
  const applyUrl = job.apply_link || job.apply_url;

  // 🔑 inject salary from /jobs API
  const salaryInfo = salaryMap[job.job_id] || {};
  job.salary_min = salaryInfo.salary_min;
  job.salary_max = salaryInfo.salary_max;

  grid.innerHTML += `
    <div class="job-card">

      <h3>${job.job_title || job.title || "Job Role"}</h3>

      <p class="company">
        ${job.company || "Company not available"}
      </p>

      <p class="location">
        📍 ${job.location || job.location_display || "Location not specified"}
      </p>

      <div class="job-actions">
        ${
          applyUrl
            ? `<a class="btn-outline"
                 href="${applyUrl}"
                 target="_blank"
                 rel="noopener noreferrer">
                 Apply
               </a>`
            : `<button class="btn-outline disabled" disabled>
                 Apply
               </button>`
        }

        <button class="btn"
          onclick='saveJobToFirebase({
            job_id: "${job.job_id}",
            title: "${job.job_title || job.title}",
            company: "${job.company}",
            apply_url: "${applyUrl || ""}",
            location: "${job.location || job.location_display || ""}",
            score: 0
          }, "${candidateId}")'>
          Save Job
        </button>
      </div>

    </div>
  `;
});


}


window.loadCandidateJobMatches = loadCandidateJobMatches;

onAuthStateChanged(window.auth, (user) => {
  if (!user) return;

  const select = document.getElementById("candidateSelect");
  if (!select) return;

  loadUserCandidatesOnly();
});

async function saveJobToFirebase(job, candidateId) {
  const user = auth.currentUser;
  if (!user) return;

  const docId = `${user.uid}_${candidateId}_${job.job_id}`;

await setDoc(doc(db, "saved_jobs", docId), {
  user_id: user.uid,
  candidate_id: candidateId,

  job_id: job.job_id,
  title: job.title,
  company: job.company,

  location: job.location || job.location_display || "Location not specified",

 // ✅ REPLACE WITH
salary_min: job.salary_min ?? null,
salary_max: job.salary_max ?? null,


  description: job.description || "",

  apply_url: job.apply_url || "#",

  savedAt: serverTimestamp()
});


  // 🔥 LOG SHORTLIST ACTION
  trackInteraction({
    job_id: job.job_id,
    candidate_id: candidateId,
    action: "shortlist"
  });

  alert("Job saved successfully");
}


async function trackInteraction({ job_id, candidate_id, action }) {
  try {
    await fetch(
      "https://2bcj60lax1.execute-api.eu-north-1.amazonaws.com/prod/trackInteraction",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
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


window.loadCandidateJobMatches = loadCandidateJobMatches;
window.saveJobToFirebase = saveJobToFirebase;
