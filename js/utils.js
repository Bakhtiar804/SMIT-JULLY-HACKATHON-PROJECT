export const ORG_NAME = "MaintainIQ";

export const ASSET_STATUSES = ["Active", "Under Maintenance", "Issue Reported", "Retired"];
export const ISSUE_STATUSES = [
  "Reported",
  "Assigned",
  "Inspection Started",
  "Under Maintenance",
  "Resolved",
  "Closed",
  "Reopened"
];
export const PRIORITIES = ["Low", "Medium", "High", "Critical"];

export function formatDate(value) {
  if (!value) return "—";
  const date = value?.toDate ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export function formatDateTime(value) {
  if (!value) return "—";
  const date = value?.toDate ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function generateIssueNumber() {
  const now = new Date();
  const y = now.getFullYear().toString().slice(-2);
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `MIQ-${y}${m}${d}-${rand}`;
}

export function getPublicAssetUrl(assetId) {
  const base = window.location.origin + window.location.pathname.replace(/[^/]+$/, "");
  return `${base}public-asset-view.html?assetId=${assetId}`;
}

export function getReportIssueUrl(assetId) {
  const base = window.location.origin + window.location.pathname.replace(/[^/]+$/, "");
  return `${base}report-issue.html?assetId=${assetId}`;
}

export function getQueryParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

export function statusClass(status) {
  const map = {
    Active: "status-active",
    "Under Maintenance": "status-maintenance",
    "Issue Reported": "status-reported",
    Retired: "status-retired",
    Reported: "status-reported",
    Assigned: "status-assigned",
    "Inspection Started": "status-inspection",
    Resolved: "status-resolved",
    Closed: "status-closed",
    Reopened: "status-reopened",
    Low: "priority-low",
    Medium: "priority-medium",
    High: "priority-high",
    Critical: "priority-critical"
  };
  return map[status] || "status-default";
}

export function showToast(message, type = "success") {
  let container = document.getElementById("toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    container.className = "toast-container";
    document.body.appendChild(container);
  }
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("show"));
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 300);
  }, 3200);
}

export function showLoading(container, message = "Loading...") {
  container.innerHTML = `<div class="loading-state"><div class="spinner"></div><p>${message}</p></div>`;
}

export function showEmpty(container, message = "No data found", icon = "📭") {
  container.innerHTML = `<div class="empty-state"><span class="empty-icon">${icon}</span><p>${message}</p></div>`;
}

export function showError(container, message = "Something went wrong") {
  container.innerHTML = `<div class="error-state"><span class="empty-icon">⚠️</span><p>${message}</p></div>`;
}

export function debounce(fn, delay = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

export function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}
