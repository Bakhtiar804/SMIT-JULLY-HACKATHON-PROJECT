import { getAsset } from "./asset.js";
import { getQueryParam, formatDate, formatDateTime, escapeHtml, getReportIssueUrl } from "./utils.js";
import { db, collection, query, where, orderBy, limit, onSnapshot } from "./firebaseConfig.js";

export async function loadPublicAsset() {
  const assetId = getQueryParam("assetId");
  if (!assetId) throw new Error("Invalid asset link");

  const asset = await getAsset(assetId);
  if (!asset) throw new Error("Asset not found");

  return { asset, assetId };
}

export function renderPublicAsset(asset, assetId) {
  document.getElementById("asset-name").textContent = asset.name;
  document.getElementById("asset-code").textContent = asset.assetCode;
  document.getElementById("asset-category").textContent = asset.category || "—";
  document.getElementById("asset-location").textContent = asset.location;
  document.getElementById("asset-status").textContent = asset.status;
  document.getElementById("asset-status").className = `status-pill ${asset.status?.replace(/\s/g, "-").toLowerCase()}`;
  document.getElementById("last-service").textContent = formatDate(asset.lastServiceDate);
  document.getElementById("next-service").textContent = formatDate(asset.nextServiceDate);

  const reportBtn = document.getElementById("report-issue-btn");
  if (reportBtn) reportBtn.href = getReportIssueUrl(assetId);

  listenSafeActivity(assetId);
}

function listenSafeActivity(assetId) {
  const container = document.getElementById("activity-list");
  if (!container) return;

  const q = query(collection(db, "history"), where("assetId", "==", assetId));

  onSnapshot(q, (snap) => {
    const safeActions = ["Issue Reported", "Issue Resolved", "Issue Closed", "Maintenance Completed", "Asset Created"];
    const items = snap.docs
      .map((d) => d.data())
      .filter((h) => safeActions.some((a) => h.action?.includes(a.split(" ")[0]) || h.action === a))
      .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
      .slice(0, 5);

    if (!items.length) {
      container.innerHTML = `<div class="empty-state"><p>No recent activity</p></div>`;
      return;
    }

    container.innerHTML = items
      .map(
        (h) => `
      <div class="activity-item public">
        <div class="activity-dot"></div>
        <div>
          <strong>${escapeHtml(h.action)}</strong>
          <small>${formatDateTime(h.createdAt)}</small>
        </div>
      </div>`
      )
      .join("");
  });
}
