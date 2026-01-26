/* =========================================================
   BACKEND API CONFIG
========================================================= */
const API_BASE = "https://2bcj60lax1.execute-api.eu-north-1.amazonaws.com/prod";

export { apiFetch };

function normalizeApiResponse(res) {
  if (Array.isArray(res)) return res;
  if (res?.body && typeof res.body === "string") {
    try {
      return JSON.parse(res.body);
    } catch {
      return [];
    }
  }
  return [];
}



/* =========================================================
   GENERIC API FETCH
========================================================= */
async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options
  });
  const text = await res.text();
  return text ? JSON.parse(text) : {};
}

window.apiFetch = apiFetch;

async function fetchJobs() {
  const res = await apiFetch("/jobs");
  return normalizeApiResponse(res);
}


window.fetchJobs = fetchJobs;
async function renderJobs() {
  const grid = document.getElementById("jobsGrid");
  if (!grid) return;

  grid.innerHTML = "Loading jobs…";

 const res = await apiFetch("/jobs");
const jobs = normalizeApiResponse(res);


  if (!jobs.length) {
    grid.innerHTML = "No jobs available.";
    return;
  }

  grid.innerHTML = jobs.map(job => `
    <div class="job-card">
      <h3>${job.title || "Job Title"}</h3>
      <p class="company">${job.company || "Company not available"}</p>
      <p class="location">📍 ${job.location_display || "Location not specified"}</p>
      <p class="salary">
        💰 ${job.salary_min ? `₹${job.salary_min} - ₹${job.salary_max}` : "Salary not disclosed"}
      </p>
      <p class="summary">
        ${(job.description || "").slice(0, 140)}…
      </p>
      <small>Job ID: ${job.job_id}</small>
    </div>
  `).join("");
}
let selectedJobId = null;

async function populateJobDropdown() {
  const customSelect = document.getElementById("customJobSelect");
  const optionsContainer = document.getElementById("customJobOptions");
  if (!customSelect || !optionsContainer) return;

  const res = await apiFetch("/jobs");
const jobs = normalizeApiResponse(res);

  optionsContainer.innerHTML = "";

  jobs.forEach(job => {
    const option = document.createElement("div");
    option.className = "custom-option";
    option.dataset.value = job.job_id;
    option.textContent = `${job.title} — ${job.company || ""}`;
    option.onclick = () => selectJob(job.job_id, option.textContent);
    optionsContainer.appendChild(option);
  });
}

function selectJob(jobId, text) {
  selectedJobId = jobId;

  const customSelect = document.getElementById("customJobSelect");
  const triggerText = customSelect.querySelector(".custom-select-trigger span");

  // Update selected text
  triggerText.textContent = text;

  // Close dropdown
  customSelect.classList.remove("open");

  // 🔥 AUTO LOAD MATCHES
  loadMatches();
}

async function loadMatches() {
  if (!selectedJobId) {
    alert("Please select a job");
    return;
  }

  const res = await apiFetch(`/matches?job_id=${selectedJobId}&top_n=5&offset=0`);
  const data = typeof res === "string" ? JSON.parse(res) : (res.body ? JSON.parse(res.body) : res);

  const grid = document.getElementById("matchesGrid");
  grid.innerHTML = "";

  if (!data.matches || data.matches.length === 0) {
    grid.innerHTML = `
      <div class="no-matches">
        No candidates matched this job
      </div>
    `;
    return;
  }

  data.matches.forEach(match => {
    const name = match.name || "Candidate Name Not Available";
    const email = match.email || "Email not available";
    const percent = match.match_percent != null ? match.match_percent.toFixed(1) : "0.0";
    const confidence = match.confidence || "N/A";
    const reason = match.explanation?.top_reason || "No explanation provided";

    grid.innerHTML += `
      <div class="match-card">
        <h3>${name}</h3>

        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Match:</strong> ${percent}%</p>
        <p><strong>Confidence:</strong> ${confidence}</p>

        <p class="reason">${reason}</p>
      </div>
    `;
  });
}

async function loadDashboardKPIs() {
  const jobs = await fetchJobs();
  let totalMatches = 0;
  let totalScore = 0;
  let count = 0;

  for (const job of jobs) {
    const res = await apiFetch(`/matches?job_id=${job.job_id}&top_n=50&offset=0`);
    const data = res.body ? JSON.parse(res.body) : res;

    data.matches?.forEach(m => {
      totalMatches++;
      totalScore += m.score;
      count++;
    });
  }

  document.getElementById("kpi-jds").textContent = jobs.length;
  document.getElementById("kpi-matches").textContent = totalMatches;
  document.getElementById("kpi-accuracy").textContent =
    count ? `${Math.round((totalScore / count) * 100)}%` : "0%";
}
document.addEventListener("DOMContentLoaded", async () => {
  if (document.getElementById("jobsGrid")) {
    renderJobs();
  }

if (document.getElementById("customJobSelect")) {
  await populateJobDropdown();
  setupCustomDropdown();   // 🔥 MISSING LINE
  document
    .getElementById("loadMatchesBtn")
    ?.addEventListener("click", loadMatches);
}

});


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

function setupCustomDropdown() {
  const customSelect = document.getElementById("customJobSelect");
  const trigger = customSelect.querySelector(".custom-select-trigger");
  
  // Toggle dropdown
  trigger.addEventListener("click", (e) => {
    e.stopPropagation();
    customSelect.classList.toggle("open");
  });

  // Close dropdown when clicking outside
  document.addEventListener("click", (e) => {
    if (!customSelect.contains(e.target)) {
      customSelect.classList.remove("open");
    }
  });
}



