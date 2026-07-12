import { requireAuth } from "./auth.js";
import { initLayout, initTopbar } from "./layout.js";
import { listenAssets, computeAssetMetrics } from "./asset.js";
import { listenIssues } from "./complaints.js";
import { listenRecentHistory } from "./history.js";
import { escapeHtml, debounce, formatDateTime } from "./utils.js";

let allAssets = [];

export async function initDashboard() {
  const { profile } = await requireAuth(["admin", "employee"]);
  initLayout({
    profile,
    activePage: "dashboard.html",
    pageTitle: "Dashboard",
    pageSubtitle: "Real-time overview of your maintenance operations"
  });
  initTopbar({ profile });

  listenAssets((assets) => {
    allAssets = assets;
    updateMetrics(assets);
    renderLatestIssues();
    filterAssets(document.getElementById("asset-search")?.value || "");
  });

  listenIssues((issues) => {
    window.__dashboardIssues = issues;
    renderLatestIssues(issues);
  });

  listenRecentHistory(8, document.getElementById("recent-activity"));

  document.getElementById("asset-search")?.addEventListener(
    "input",
    debounce((e) => filterAssets(e.target.value), 250)
  );

  document.getElementById("status-filter")?.addEventListener("change", (e) => {
    filterAssets(document.getElementById("asset-search")?.value || "", e.target.value);
  });

  document.querySelectorAll("[data-quick]").forEach((btn) => {
    btn.addEventListener("click", () => {
      window.location.href = btn.dataset.quick;
    });
  });
}

function updateMetrics(assets) {
  const m = computeAssetMetrics(assets);
  const map = {
    "metric-total": m.total,
    "metric-active": m.active,
    "metric-maintenance": m.underMaintenance,
    "metric-reported": m.issueReported,
    "metric-retired": m.retired
  };
  Object.entries(map).forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  });
}

function renderLatestIssues(issues = window.__dashboardIssues || []) {
  const container = document.getElementById("latest-issues");
  if (!container) return;
  const open = issues.filter((i) => !["Resolved", "Closed"].includes(i.status)).slice(0, 5);

  if (!open.length) {
    container.innerHTML = `<div class="empty-state"><span class="empty-icon">✅</span><p>No open issues</p></div>`;
    return;
  }

  container.innerHTML = open
    .map(
      (i) => `
    <div class="issue-card glass-card">
      <div class="issue-top">
        <code>${escapeHtml(i.issueNumber)}</code>
        <span class="priority-pill ${i.priority?.toLowerCase()}">${escapeHtml(i.priority)}</span>
      </div>
      <h4>${escapeHtml(i.title)}</h4>
      <p>${escapeHtml(i.assetCode)} · ${escapeHtml(i.status)}</p>
      <small>${formatDateTime(i.createdAt)}</small>
    </div>`
    )
    .join("");
}

function filterAssets(search = "", status = "") {
  const tbody = document.getElementById("asset-search-results");
  if (!tbody) return;

  const statusVal = status || document.getElementById("status-filter")?.value || "";
  let filtered = [...allAssets];

  if (search.trim()) {
    const q = search.toLowerCase();
    filtered = filtered.filter(
      (a) => a.name?.toLowerCase().includes(q) || a.assetCode?.toLowerCase().includes(q) || a.location?.toLowerCase().includes(q)
    );
  }
  if (statusVal) filtered = filtered.filter((a) => a.status === statusVal);

  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state">No assets match your search</div></td></tr>`;
    return;
  }

  tbody.innerHTML = filtered
    .slice(0, 10)
    .map(
      (a) => `
    <tr>
      <td><strong>${escapeHtml(a.name)}</strong></td>
      <td><code>${escapeHtml(a.assetCode)}</code></td>
      <td>${escapeHtml(a.category || "—")}</td>
      <td><span class="status-pill ${a.status?.replace(/\s/g, "-").toLowerCase()}">${escapeHtml(a.status)}</span></td>
      <td><a href="asset-detail.html?id=${a.id}" class="btn-sm">View</a></td>
    </tr>`
    )
    .join("");
}
