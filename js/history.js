import { db, collection, addDoc, query, where, orderBy, onSnapshot, serverTimestamp } from "./firebaseConfig.js";
import { formatDateTime, escapeHtml } from "./utils.js";

export async function addHistoryRecord({
  assetId,
  assetCode = "",
  action,
  userId = "system",
  userName = "System",
  issueNumber = "",
  notes = ""
}) {
  if (!assetId || !action) return;
  await addDoc(collection(db, "history"), {
    assetId,
    assetCode,
    action,
    userId,
    userName,
    issueNumber,
    notes,
    createdAt: serverTimestamp()
  });
}

export function listenAssetHistory(assetId, container, onData) {
  const q = query(collection(db, "history"), where("assetId", "==", assetId));

  return onSnapshot(q, (snap) => {
    const items = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    if (onData) onData(items);
    if (!container) return;

    if (!items.length) {
      container.innerHTML = `<div class="empty-state"><span class="empty-icon">📋</span><p>No history records yet</p></div>`;
      return;
    }

    container.innerHTML = items
      .map(
        (h) => `
      <div class="history-item">
        <div class="history-dot"></div>
        <div class="history-body">
          <div class="history-top">
            <strong>${escapeHtml(h.action)}</strong>
            <span>${formatDateTime(h.createdAt)}</span>
          </div>
          <p class="history-meta">${escapeHtml(h.userName)}${h.issueNumber ? ` · ${escapeHtml(h.issueNumber)}` : ""}</p>
          ${h.notes ? `<p class="history-notes">${escapeHtml(h.notes)}</p>` : ""}
        </div>
      </div>`
      )
      .join("");
  });
}

export function listenRecentHistory(limitCount, container) {
  const q = query(collection(db, "history"), orderBy("createdAt", "desc"), limit(limitCount));

  return onSnapshot(q, (snap) => {
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    if (!container) return;

    if (!items.length) {
      container.innerHTML = `<div class="empty-state"><span class="empty-icon">📋</span><p>No recent activity</p></div>`;
      return;
    }

    container.innerHTML = items
      .map(
        (h) => `
      <div class="activity-item">
        <div class="activity-icon">📝</div>
        <div>
          <p><strong>${escapeHtml(h.action)}</strong> — ${escapeHtml(h.assetCode || "Asset")}</p>
          <small>${formatDateTime(h.createdAt)} · ${escapeHtml(h.userName)}</small>
        </div>
      </div>`
      )
      .join("");
  });
}
