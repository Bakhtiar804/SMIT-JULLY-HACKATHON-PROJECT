import { db, collection, addDoc, query, where, orderBy, onSnapshot, updateDoc, doc, serverTimestamp, getDocs } from "./firebaseConfig.js";
import { formatDateTime, escapeHtml } from "./utils.js";

export async function createNotification({ userId, type, title, message, relatedIssueId = "", relatedAssetId = "" }) {
  await addDoc(collection(db, "notifications"), {
    userId,
    type,
    title,
    message,
    relatedIssueId,
    relatedAssetId,
    read: false,
    createdAt: serverTimestamp()
  });
}

export async function notifyAdmins(type, title, message, meta = {}) {
  const snap = await getDocs(query(collection(db, "users"), where("Role", "==", "admin")));
  const promises = snap.docs.map((u) =>
    createNotification({ userId: u.id, type, title, message, ...meta })
  );
  await Promise.all(promises);
}

export async function markNotificationRead(id) {
  await updateDoc(doc(db, "notifications", id), { read: true });
}

export function listenUserNotifications(userId, container, badgeEl) {
  if (!userId) return () => {};

  const q = query(collection(db, "notifications"), where("userId", "==", userId));

  return onSnapshot(q, (snap) => {
    const items = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    const unread = items.filter((n) => !n.read).length;

    if (badgeEl) {
      badgeEl.textContent = unread;
      badgeEl.style.display = unread ? "inline-flex" : "none";
    }

    if (!container) return;

    if (!items.length) {
      container.innerHTML = `<div class="empty-state"><span class="empty-icon">🔔</span><p>No notifications</p></div>`;
      return;
    }

    container.innerHTML = items
      .slice(0, 8)
      .map(
        (n) => `
      <div class="notification-card ${n.read ? "" : "unread"}" data-id="${n.id}">
        <div class="notification-icon">${getNotifIcon(n.type)}</div>
        <div>
          <strong>${escapeHtml(n.title)}</strong>
          <p>${escapeHtml(n.message)}</p>
          <small>${formatDateTime(n.createdAt)}</small>
        </div>
      </div>`
      )
      .join("");

    container.querySelectorAll(".notification-card.unread").forEach((card) => {
      card.addEventListener("click", async () => {
        await markNotificationRead(card.dataset.id);
      });
    });
  });
}

function getNotifIcon(type) {
  const icons = {
    new_complaint: "🆕",
    issue_assigned: "👷",
    issue_resolved: "✅",
    maintenance_completed: "🔧"
  };
  return icons[type] || "🔔";
}
