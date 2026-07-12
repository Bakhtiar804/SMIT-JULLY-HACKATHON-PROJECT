import { requireAuth } from "./auth.js";
import { initLayout, initTopbar } from "./layout.js";
import {
  listenIssues,
  updateIssueStatus,
  assignIssue,
  deleteIssue,
  getTechnicians,
  getIssue,
  uploadEvidence,
  renderIssuesTable
} from "./complaints.js";
import { escapeHtml, formatDateTime } from "./utils.js";

let currentProfile = null;
let technicians = [];
let allIssues = [];

export async function initComplaintsPage() {
  const { profile } = await requireAuth(["admin", "technician"]);
  currentProfile = profile;

  initLayout({
    profile,
    activePage: "complaints.html",
    pageTitle: "Complaint Management",
    pageSubtitle: "Track, assign and resolve maintenance issues in real time"
  });
  initTopbar({ profile });

  if (profile.Role === "admin") {
    technicians = await getTechnicians();
  }

  listenIssues((issues) => {
    allIssues = issues.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    applyFilters();
  });

  document.getElementById("issue-search")?.addEventListener("input", applyFilters);
  document.getElementById("issue-status-filter")?.addEventListener("change", applyFilters);
  document.getElementById("modal-close")?.addEventListener("click", closeModal);
  document.getElementById("issue-modal")?.addEventListener("click", (e) => {
    if (e.target.id === "issue-modal") closeModal();
  });
}

function applyFilters() {
  const search = document.getElementById("issue-search")?.value.toLowerCase() || "";
  const status = document.getElementById("issue-status-filter")?.value || "";

  let filtered = [...allIssues];
  if (search) {
    filtered = filtered.filter(
      (i) =>
        i.issueNumber?.toLowerCase().includes(search) ||
        i.title?.toLowerCase().includes(search) ||
        i.assetCode?.toLowerCase().includes(search) ||
        i.reporterName?.toLowerCase().includes(search)
    );
  }
  if (status) filtered = filtered.filter((i) => i.status === status);

  renderIssuesTable(document.getElementById("issues-body"), filtered, {
    role: currentProfile.Role,
    onView: handleAction
  });
}

async function handleAction(action, issueId) {
  const issue = allIssues.find((i) => i.id === issueId);
  if (!issue) return;

  switch (action) {
    case "view":
      openModal(issue);
      break;
    case "assign":
      await showAssignModal(issueId);
      break;
    case "inspect":
      await updateIssueStatus(issueId, "Inspection Started", {}, currentProfile);
      break;
    case "maintain":
      await updateIssueStatus(issueId, "Under Maintenance", {}, currentProfile);
      break;
    case "resolve":
      openResolveModal(issueId);
      break;
    case "delete":
      if (confirm("Delete this complaint permanently?")) {
        await deleteIssue(issueId, currentProfile);
      }
      break;
  }
}

function openModal(issue) {
  const modal = document.getElementById("issue-modal");
  document.getElementById("modal-title").textContent = issue.issueNumber;
  document.getElementById("modal-body").innerHTML = `
    <div class="detail-grid">
      <div><label>Asset</label><p>${escapeHtml(issue.assetCode)} — ${escapeHtml(issue.assetName || "")}</p></div>
      <div><label>Reporter</label><p>${escapeHtml(issue.reporterName)}<br>${escapeHtml(issue.reporterEmail)}<br>${escapeHtml(issue.reporterPhone)}</p></div>
      <div><label>Priority</label><p><span class="priority-pill ${issue.priority?.toLowerCase()}">${escapeHtml(issue.priority)}</span></p></div>
      <div><label>Status</label><p><span class="status-pill ${issue.status?.replace(/\s/g, "-").toLowerCase()}">${escapeHtml(issue.status)}</span></p></div>
      <div class="full"><label>Title</label><p>${escapeHtml(issue.title)}</p></div>
      <div class="full"><label>Description</label><p>${escapeHtml(issue.description)}</p></div>
      <div><label>Technician</label><p>${escapeHtml(issue.assignedTechnician || "Unassigned")}</p></div>
      <div><label>Created</label><p>${formatDateTime(issue.createdAt)}</p></div>
      ${issue.notes ? `<div class="full"><label>Notes</label><p>${escapeHtml(issue.notes)}</p></div>` : ""}
      ${issue.partsReplaced ? `<div class="full"><label>Parts Replaced</label><p>${escapeHtml(issue.partsReplaced)}</p></div>` : ""}
      ${issue.maintenanceCost ? `<div><label>Cost</label><p>PKR ${issue.maintenanceCost}</p></div>` : ""}
    </div>`;
  modal.classList.add("open");
}

function closeModal() {
  document.getElementById("issue-modal")?.classList.remove("open");
}

async function showAssignModal(issueId) {
  if (!technicians.length) {
    alert("No technicians registered yet.");
    return;
  }
  const names = technicians.map((t, i) => `${i + 1}. ${t.FullName}`).join("\n");
  const choice = prompt(`Select technician number:\n${names}`);
  const idx = parseInt(choice, 10) - 1;
  if (idx >= 0 && idx < technicians.length) {
    await assignIssue(issueId, technicians[idx], currentProfile);
  }
}

function openResolveModal(issueId) {
  const notes = prompt("Resolution notes:");
  if (notes === null) return;
  const parts = prompt("Parts replaced (optional):") || "";
  const cost = parseFloat(prompt("Maintenance cost (PKR):", "0") || "0");
  updateIssueStatus(
    issueId,
    "Resolved",
    { notes, partsReplaced: parts, maintenanceCost: cost || 0 },
    currentProfile
  );
}

export async function initTechnicianDashboard() {
  const { profile } = await requireAuth(["technician", "admin"]);
  currentProfile = profile;

  initLayout({
    profile,
    activePage: "technician-dashboard.html",
    pageTitle: "Technician Workspace",
    pageSubtitle: "Manage assigned complaints and maintenance tasks"
  });
  initTopbar({ profile });

  listenIssues((issues) => {
    const mine = issues.filter(
      (i) => i.assignedTechnicianId === profile.userId || i.assignedTechnician === profile.FullName
    );
    renderTechnicianTasks(mine);
  });
}

function renderTechnicianTasks(issues) {
  const container = document.getElementById("tech-tasks");
  if (!container) return;

  const active = issues.filter((i) => !["Resolved", "Closed"].includes(i.status));

  if (!active.length) {
    container.innerHTML = `<div class="empty-state"><span class="empty-icon">🔧</span><p>No active tasks assigned</p></div>`;
    return;
  }

  container.innerHTML = active
    .map(
      (i) => `
    <div class="task-card glass-card">
      <div class="task-header">
        <code>${escapeHtml(i.issueNumber)}</code>
        <span class="status-pill ${i.status?.replace(/\s/g, "-").toLowerCase()}">${escapeHtml(i.status)}</span>
      </div>
      <h3>${escapeHtml(i.title)}</h3>
      <p>${escapeHtml(i.assetCode)} · ${escapeHtml(i.priority)} priority</p>
      <p class="task-desc">${escapeHtml(i.description)}</p>
      <div class="task-actions">
        ${i.status === "Assigned" || i.status === "Reopened" ? `<button class="btn-primary" data-act="inspect" data-id="${i.id}">Start Inspection</button>` : ""}
        ${i.status === "Inspection Started" ? `<button class="btn-primary" data-act="maintain" data-id="${i.id}">Start Maintenance</button>` : ""}
        ${i.status === "Under Maintenance" ? `<button class="btn-primary success" data-act="resolve" data-id="${i.id}">Resolve</button>` : ""}
        <label class="btn-secondary upload-btn">Upload Evidence<input type="file" hidden data-upload="${i.id}"></label>
      </div>
    </div>`
    )
    .join("");

  container.querySelectorAll("[data-act]").forEach((btn) => {
    btn.addEventListener("click", () => handleAction(btn.dataset.act, btn.dataset.id));
  });

  container.querySelectorAll("[data-upload]").forEach((input) => {
    input.addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      await uploadEvidence(input.dataset.upload, file, currentProfile);
    });
  });
}

// Re-export for technician page
export { handleAction, openResolveModal };
