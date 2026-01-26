import { onAuthStateChanged } from
"https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import {
  collection,
  getDocs,
  deleteDoc,
  doc,
  query,
  where
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const db = window.db;
const auth = window.auth;

async function loadSavedJobs() {
  const user = auth.currentUser;
  if (!user) return;

  const grid = document.getElementById("savedJobsGrid");
  grid.innerHTML = "Loading saved jobs...";

  const q = query(
    collection(db, "saved_jobs"),
    where("user_id", "==", user.uid)
  );

  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    grid.innerHTML = "No saved jobs yet.";
    return;
  }

  grid.innerHTML = "";

  snapshot.forEach(docSnap => {
    const job = docSnap.data();

  const card = document.createElement("div");
card.className = "job-card";
const applyUrl = job.apply_link || job.apply_url;

card.innerHTML = `
  <h3>${job.title || "Job Role"}</h3>

  <p class="company">${job.company || "Company not available"}</p>

  <p class="location">
    📍 ${job.location || "Location not specified"}
  </p>


  <div class="job-actions">
${(job.apply_link || job.apply_url) && (job.apply_link || job.apply_url) !== "#"
  ? `
    <a href="${job.apply_link || job.apply_url}"
       target="_blank"
       rel="noopener noreferrer"
       class="btn-outline">
      Apply
    </a>
  `
  : `
    <button class="btn-outline disabled" disabled>
      Apply
    </button>
  `
}



    <button class="btn-danger"
      onclick="removeSavedJob('${docSnap.id}')">
      Remove
    </button>
  </div>
`;


    grid.appendChild(card);
  });
}

async function removeSavedJob(docId) {
  await deleteDoc(doc(db, "saved_jobs", docId));
  loadSavedJobs();
}

window.removeSavedJob = removeSavedJob;


onAuthStateChanged(auth, (user) => {
  if (!user) return;
  loadSavedJobs();
});

