// FILE: locatehire.js — FULLY UPDATED & WORKING (DROP-IN REPLACEMENT)
const apiFetch = window.apiFetch;

let map;
let markersLayer;

// INIT
document.addEventListener("DOMContentLoaded", () => {
  initMap();
  loadJobsAndMarkers();
});

// MAP SETUP
function initMap() {
  map = L.map("map").setView([20, 0], 2);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap"
  }).addTo(map);

  markersLayer = L.layerGroup().addTo(map);
}

// LOAD JOBS + CREATE MARKERS
async function loadJobsAndMarkers() {
  const res = await apiFetch("/jobs");
  const jobs = Array.isArray(res) ? res : JSON.parse(res.body || "[]");

  markersLayer.clearLayers();

  // GROUP JOBS BY LAT+LNG
  const locationMap = {};

  jobs.forEach(job => {
    if (!job.lat || !job.lng) return;

    const key = `${job.lat},${job.lng}`;
    if (!locationMap[key]) {
      locationMap[key] = {
        lat: job.lat,
        lng: job.lng,
        title: job.city || job.location_display || "Jobs",
        jobs: []
      };
    }
    locationMap[key].jobs.push(job);
  });

  // CREATE ONE MARKER PER LOCATION
  Object.values(locationMap).forEach(loc => {
    const marker = L.marker([loc.lat, loc.lng]).addTo(markersLayer);

    marker.on("click", () => {
      showJobsForLocation(loc.title, loc.jobs);
    });
  });
}

// RIGHT PANEL RENDER
function showJobsForLocation(title, jobs) {
  const panel = document.getElementById("cityPanel");
  const grid = document.getElementById("panelGrid");
  const heading = document.getElementById("panelTitle");

  panel.classList.remove("hidden");
  heading.textContent = title;
 grid.classList.remove("placeholder");
grid.innerHTML = "";

  if (!jobs.length) {
    grid.innerHTML = `
      <p class="panel-empty">No jobs available for this location</p>
    `;
    return;
  }

  jobs.forEach(job => {
    grid.innerHTML += `
      <div class="job-card">
        <div class="job-title">${job.title || "Job Role"}</div>
        <div class="job-company">${job.company || "Company not available"}</div>
        <div class="job-location">
          ${job.location_display || job.city || "Location not specified"}
        </div>

        <div class="job-footer">
          <span class="job-source">${job.source || ""}</span>
          ${
            job.apply_url
              ? `<a class="view-job-btn"
                   href="${job.apply_url}"
                   target="_blank"
                   rel="noopener noreferrer">
                   Apply
                 </a>`
              : ""
          }
        </div>
      </div>
    `;
  });
}

// CLOSE PANEL
window.closeCityPanel = function () {
  const panel = document.getElementById("cityPanel");
  const grid = document.getElementById("panelGrid");

  panel.classList.add("hidden");
  grid.classList.add("placeholder");
};
