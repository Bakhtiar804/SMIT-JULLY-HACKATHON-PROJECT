import { requireAuth } from "./auth.js";
import { initLayout, initTopbar } from "./layout.js";
import {
  listenIssues,
  updateIssueStatus,
  assignIssue,
  deleteIssue,
  reopenIssue,
  appendIssueNote,
  getTechnicians,
  uploadEvidence,
  renderIssuesTable
} from "./complaints.js";
import { escapeHtml, formatDateTime, showToast } from "./utils.js";

let currentProfile = null;
let technicians = [];
let allIssues = [];
let activeIssueId = null;

export async function initComplaintsPage() {
  const { user, profile } = await requireAuth(["admin", "technician"]);
  currentProfile = profile;

  initLayout({
    profile,
    activePage: "complaints.html",
    pageTitle: "Complaint Management",
    pageSubtitle: "All complaints from public — assign, track and resolve in real time"
  });
  initTopbar({ profile });

  if (profile.Role === "admin") technicians = await getTechnicians();
  updateComplaintStats();

  listenIssues((issues) => {
    allIssues = issues.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    updateComplaintStats();
    applyFilters();
  });

  document.getElementById("issue-search")?.addEventListener("input", applyFilters);
  document.getElementById("issue-status-filter")?.addEventListener("change", applyFilters);
  document.getElementById("modal-close")?.addEventListener("click", () => closeModal("issue-modal"));
  document.getElementById("issue-modal")?.addEventListener("click", (e) => {
    if (e.target.id === "issue-modal") closeModal("issue-modal");
  });

  bindActionModals();
}

function updateComplaintStats() {
  const open = allIssues.filter((i) => !["Resolved", "Closed"].includes(i.status)).length;
  const reported = allIssues.filter((i) => i.status === "Reported").length;
  const el1 = document.getElementById("stat-open");
  const el2 = document.getElementById("stat-reported");
  if (el1) el1.textContent = open;
  if (el2) el2.textContent = reported;
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
    userId: currentProfile.userId,
    userName: currentProfile.FullName,
    onView: handleAction
  });
}

async function handleAction(action, issueId) {
  const issue = allIssues.find((i) => i.id === issueId);
  if (!issue) return;
  activeIssueId = issueId;

  try {
    switch (action) {
      case "view":
        openViewModal(issue);
        break;
      case "assign":
        openAssignModal(issueId);
        break;
      case "inspect":
        await updateIssueStatus(issueId, "Inspection Started", {}, currentProfile);
        showToast("Inspection started");
        break;
      case "maintain":
        await updateIssueStatus(issueId, "Maintenance In Progress", {}, currentProfile);
        showToast("Maintenance in progress");
        break;
      case "parts":
        await updateIssueStatus(issueId, "Waiting for Parts", { notes: "Waiting for replacement parts" }, currentProfile);
        break;
      case "note":
        openNoteModal(issueId);
        break;
      case "resolve":
        openResolveModal(issue);
        break;
      case "close":
        await updateIssueStatus(issueId, "Closed", {}, currentProfile);
        break;
      case "reopen":
        await reopenIssue(issueId, currentProfile);
        break;
      case "delete":
        if (confirm("Delete this complaint permanently?")) await deleteIssue(issueId, currentProfile);
        break;
    }
  } catch (err) {
    showToast(err.message, "error");
  }
}

function openViewModal(issue) {
  const modal = document.getElementById("issue-modal");
  document.getElementById("modal-title").textContent = issue.issueNumber;
  const evidence = (issue.evidenceUrls || [])
    .map((u) => `<a href="${u}" target="_blank" rel="noopener">View evidence</a>`)
    .join(" · ");
  document.getElementById("modal-body").innerHTML = `
    <div class="detail-grid">
      <div><label>Asset</label><p>${escapeHtml(issue.assetCode)} — ${escapeHtml(issue.assetName || "")}</p></div>
      <div><label>Reporter</label><p>${escapeHtml(issue.reporterName)}<br>${escapeHtml(issue.reporterEmail)}<br>${escapeHtml(issue.reporterPhone || "")}</p></div>
      <div><label>Priority</label><p><span class="priority-pill ${issue.priority?.toLowerCase()}">${escapeHtml(issue.priority)}</span></p></div>
      <div><label>Status</label><p><span class="status-pill ${issue.status?.replace(/\s/g, "-").toLowerCase()}">${escapeHtml(issue.status)}</span></p></div>
      <div class="full"><label>Title</label><p>${escapeHtml(issue.title)}</p></div>
      <div class="full"><label>Description</label><p>${escapeHtml(issue.description)}</p></div>
      ${issue.possibleCauses?.length ? `<div class="full"><label>AI Causes</label><p>${issue.possibleCauses.map(escapeHtml).join("; ")}</p></div>` : ""}
      <div><label>Technician</label><p>${escapeHtml(issue.assignedTechnician || "Unassigned")}</p></div>
      <div><label>Created</label><p>${formatDateTime(issue.createdAt)}</p></div>
      ${issue.notes ? `<div class="full"><label>Maintenance Notes</label><p style="white-space:pre-wrap">${escapeHtml(issue.notes)}</p></div>` : ""}
      ${issue.partsReplaced ? `<div class="full"><label>Parts</label><p>${escapeHtml(issue.partsReplaced)}</p></div>` : ""}
      ${issue.maintenanceCost ? `<div><label>Cost</label><p>PKR ${issue.maintenanceCost}</p></div>` : ""}
      ${evidence ? `<div class="full"><label>Evidence</label><p>${evidence}</p></div>` : ""}
      ${issue.maintenanceSummary ? `<div class="full ai-box"><label>AI Summary</label><p>${escapeHtml(issue.maintenanceSummary)}</p></div>` : ""}
    </div>
    <div class="modal-actions" style="margin-top:20px;display:flex;gap:10px;flex-wrap:wrap;">
      ${buildModalActions(issue)}
    </div>`;

  modal.querySelectorAll("[data-modal-act]").forEach((btn) => {
    btn.addEventListener("click", () => {
      closeModal("issue-modal");
      handleAction(btn.dataset.modalAct, btn.dataset.id);
    });
  });
  modal.classList.add("open");
}

function buildModalActions(issue) {
  const id = issue.id;
  const role = currentProfile.Role;
  const isAssigned =
    issue.assignedTechnicianId === currentProfile.userId ||
    issue.assignedTechnician === currentProfile.FullName;
  const canWork = role === "admin" || isAssigned;
  let html = "";
  if (role === "admin" && issue.status === "Reported")
    html += `<button class="btn-primary" data-modal-act="assign" data-id="${id}">Assign Technician</button>`;
  if (canWork && issue.status === "Assigned")
    html += `<button class="btn-primary" data-modal-act="inspect" data-id="${id}">Start Inspection</button>`;
  if (canWork && issue.status === "Inspection Started")
    html += `<button class="btn-primary" data-modal-act="maintain" data-id="${id}">Start Maintenance</button>`;
  if (canWork && issue.status === "Maintenance In Progress")
    html += `<button class="btn-primary success" data-modal-act="resolve" data-id="${id}">Resolve Issue</button>`;
  return html;
}

function bindActionModals() {
  document.getElementById("assign-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const techId = document.getElementById("tech-select").value;
    const tech = technicians.find((t) => t.userId === techId);
    if (!tech || !activeIssueId) return;
    try {
      await assignIssue(activeIssueId, tech, currentProfile);
      closeModal("assign-modal");
    } catch (err) {
      showToast(err.message, "error");
    }
  });

  document.getElementById("note-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = document.getElementById("note-text").value.trim();
    if (!text || !activeIssueId) return;
    try {
      await appendIssueNote(activeIssueId, text, currentProfile);
      closeModal("note-modal");
      document.getElementById("note-text").value = "";
    } catch (err) {
      showToast(err.message, "error");
    }
  });

  document.getElementById("resolve-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const notes = document.getElementById("resolve-notes").value.trim();
    const parts = document.getElementById("resolve-parts").value.trim();
    const cost = parseFloat(document.getElementById("resolve-cost").value || "0");
    if (!notes) return showToast("Maintenance note is required", "error");
    if (cost < 0) return showToast("Cost cannot be negative", "error");
    try {
      const result = await updateIssueStatus(
        activeIssueId,
        "Resolved",
        { notes, partsReplaced: parts, maintenanceCost: cost },
        currentProfile
      );
      closeModal("resolve-modal");
      if (result?.maintenanceSummary) {
        document.getElementById("summary-text").textContent = result.maintenanceSummary;
        openModal("summary-modal");
      }
    } catch (err) {
      showToast(err.message, "error");
    }
  });

  document.querySelectorAll("[data-close]").forEach((btn) => {
    btn.addEventListener("click", () => closeModal(btn.dataset.close));
  });
}

function openAssignModal(issueId) {
  activeIssueId = issueId;
  const select = document.getElementById("tech-select");
  select.innerHTML = technicians.map((t) => `<option value="${t.userId}">${t.FullName}</option>`).join("");
  openModal("assign-modal");
}

function openNoteModal(issueId) {
  activeIssueId = issueId;
  openModal("note-modal");
}

function openResolveModal(issue) {
  activeIssueId = issue.id;
  document.getElementById("resolve-issue-title").textContent = issue.title;
  document.getElementById("resolve-notes").value = issue.notes || "";
  openModal("resolve-modal");
}

function openModal(id) {
  document.getElementById(id)?.classList.add("open");
}

function closeModal(id) {
  document.getElementById(id)?.classList.remove("open");
}

export async function initTechnicianDashboard() {
  const { profile } = await requireAuth(["technician", "admin"]);
  currentProfile = profile;

  initLayout({
    profile,
    activePage: "technician-dashboard.html",
    pageTitle: "Technician Workspace",
    pageSubtitle: "Assigned complaints — inspect, maintain and resolve"
  });
  initTopbar({ profile });
  bindActionModals();

  listenIssues((issues) => {
    const mine = issues.filter(
      (i) => i.assignedTechnicianId === profile.userId || i.assignedTechnician === profile.FullName
    );
    renderTechnicianTasks(mine);
    document.getElementById("task-count").textContent = mine.filter(
      (i) => !["Resolved", "Closed"].includes(i.status)
    ).length;
  });
}

function renderTechnicianTasks(issues) {
  const container = document.getElementById("tech-tasks");
  if (!container) return;

  const active = issues.filter((i) => !["Resolved", "Closed"].includes(i.status));
  if (!active.length) {
    container.innerHTML = `<div class="empty-state"><span class="empty-icon">🔧</span><p>No active tasks. Wait for admin to assign complaints.</p></div>`;
    return;
  }

  container.innerHTML = active
    .map((i) => {
      let btns = "";
      if (i.status === "Assigned" || i.status === "Reopened")
        btns += `<button class="btn-primary" data-act="inspect" data-id="${i.id}">Start Inspection</button>`;
      if (i.status === "Inspection Started") {
        btns += `<button class="btn-primary" data-act="maintain" data-id="${i.id}">Start Maintenance</button>`;
        btns += `<button class="btn-secondary" data-act="parts" data-id="${i.id}">Waiting for Parts</button>`;
        btns += `<button class="btn-secondary" data-act="note" data-id="${i.id}">Add Note</button>`;
      }
      if (i.status === "Waiting for Parts")
        btns += `<button class="btn-primary" data-act="maintain" data-id="${i.id}">Resume Maintenance</button>`;
      if (i.status === "Maintenance In Progress") {
        btns += `<button class="btn-primary success" data-act="resolve" data-id="${i.id}">Resolve Issue</button>`;
        btns += `<button class="btn-secondary" data-act="note" data-id="${i.id}">Add Note</button>`;
      }
      return `
    <div class="task-card glass-card ${i.priority === "Critical" ? "critical-card" : ""}">
      <div class="task-header"><code>${escapeHtml(i.issueNumber)}</code><span class="status-pill">${escapeHtml(i.status)}</span></div>
      <h3>${escapeHtml(i.title)}</h3>
      <p>${escapeHtml(i.assetCode)} · ${escapeHtml(i.assetName || "")}</p>
      <p class="task-desc">${escapeHtml(i.description)}</p>
      ${i.notes ? `<p class="task-notes"><strong>Notes:</strong> ${escapeHtml(i.notes.slice(0, 120))}${i.notes.length > 120 ? "…" : ""}</p>` : ""}
      <div class="task-actions">${btns}
        <label class="btn-secondary upload-btn">📷 Upload Evidence<input type="file" accept="image/*" hidden data-upload="${i.id}"></label>
      </div>
    </div>`;
    })
    .join("");

  container.querySelectorAll("[data-act]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const issue = active.find((x) => x.id === btn.dataset.id);
      if (btn.dataset.act === "resolve" && issue) openResolveModal(issue);
      else if (btn.dataset.act === "note") openNoteModal(btn.dataset.id);
      else handleAction(btn.dataset.act, btn.dataset.id);
    });
  });

  container.querySelectorAll("[data-upload]").forEach((input) => {
    input.addEventListener("change", async () => {
      const file = input.files[0];
      if (!file) return;
      try {
        await uploadEvidence(input.dataset.upload, file, currentProfile);
        showToast("Evidence uploaded!");
      } catch (err) {
        showToast(err.message, "error");
      }
    });
  });
}
