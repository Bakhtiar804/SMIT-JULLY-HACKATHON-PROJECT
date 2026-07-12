import {
  db,
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  query,
  where,
  onSnapshot,
  serverTimestamp,
  storage,
  ref,
  uploadBytes,
  getDownloadURL
} from "./firebaseConfig.js";
import { generateIssueNumber, showToast } from "./utils.js";
import { addHistoryRecord } from "./history.js";
import { createNotification, notifyAdmins } from "./notification.js";

export function listenIssues(callback) {
  return onSnapshot(collection(db, "issues"), (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

export async function submitIssue(formData, assetId) {
  const issueNumber = generateIssueNumber();
  let evidenceUrl = "";

  if (formData.imageFile) {
    const storageRef = ref(storage, `evidence/${assetId}/${Date.now()}_${formData.imageFile.name}`);
    await uploadBytes(storageRef, formData.imageFile);
    evidenceUrl = await getDownloadURL(storageRef);
  }

  const payload = {
    issueNumber,
    assetId,
    assetCode: formData.assetCode,
    assetName: formData.assetName,
    reporterName: formData.reporterName.trim(),
    reporterEmail: formData.reporterEmail.trim(),
    reporterPhone: formData.reporterPhone.trim(),
    title: formData.title.trim(),
    description: formData.description.trim(),
    priority: formData.priority,
    category: formData.category,
    status: "Reported",
    assignedTechnician: "",
    assignedTechnicianId: "",
    notes: "",
    partsReplaced: "",
    maintenanceCost: 0,
    evidenceUrls: evidenceUrl ? [evidenceUrl] : [],
    createdAt: serverTimestamp()
  };

  const refDoc = await addDoc(collection(db, "issues"), payload);

  await updateDoc(doc(db, "assets", assetId), { status: "Issue Reported" });

  await addHistoryRecord({
    assetId,
    assetCode: formData.assetCode,
    action: "Issue Reported",
    userName: formData.reporterName,
    issueNumber,
    notes: formData.title
  });

  await notifyAdmins("new_complaint", "New Complaint", `${issueNumber}: ${formData.title}`, {
    relatedIssueId: refDoc.id,
    relatedAssetId: assetId
  });

  return { id: refDoc.id, issueNumber };
}

export async function assignIssue(issueId, technician, user) {
  await updateDoc(doc(db, "issues", issueId), {
    assignedTechnician: technician.FullName,
    assignedTechnicianId: technician.userId,
    status: "Assigned",
    updatedAt: serverTimestamp()
  });

  const issueSnap = await getIssue(issueId);
  if (issueSnap?.assetId) {
    await updateDoc(doc(db, "assets", issueSnap.assetId), { status: "Under Maintenance" });
  }

  await addHistoryRecord({
    assetId: issueSnap?.assetId,
    assetCode: issueSnap?.assetCode,
    action: "Issue Assigned",
    userId: user?.userId,
    userName: user?.FullName,
    issueNumber: issueSnap?.issueNumber,
    notes: `Assigned to ${technician.FullName}`
  });

  await createNotification({
    userId: technician.userId,
    type: "issue_assigned",
    title: "New Assignment",
    message: `Issue ${issueSnap?.issueNumber} assigned to you`,
    relatedIssueId: issueId,
    relatedAssetId: issueSnap?.assetId
  });

  showToast("Technician assigned successfully");
}

export async function updateIssueStatus(issueId, status, extra = {}, user) {
  const issue = await getIssue(issueId);
  if (!issue) throw new Error("Issue not found");

  await updateDoc(doc(db, "issues", issueId), {
    status,
    ...extra,
    updatedAt: serverTimestamp(),
    ...(status === "Resolved" || status === "Closed" ? { resolvedAt: serverTimestamp() } : {})
  });

  const assetStatusMap = {
    "Inspection Started": "Under Maintenance",
    "Under Maintenance": "Under Maintenance",
    Resolved: "Active",
    Closed: "Active"
  };

  if (issue.assetId && assetStatusMap[status]) {
    await updateDoc(doc(db, "assets", issue.assetId), { status: assetStatusMap[status] });
  }

  await addHistoryRecord({
    assetId: issue.assetId,
    assetCode: issue.assetCode,
    action: `Issue ${status}`,
    userId: user?.userId,
    userName: user?.FullName,
    issueNumber: issue.issueNumber,
    notes: extra.notes || ""
  });

  if (status === "Resolved" || status === "Closed") {
    await notifyAdmins("issue_resolved", "Issue Resolved", `${issue.issueNumber} has been ${status.toLowerCase()}`, {
      relatedIssueId: issueId,
      relatedAssetId: issue.assetId
    });
  }

  showToast(`Status updated to ${status}`);
}

export async function deleteIssue(issueId, user) {
  const issue = await getIssue(issueId);
  await deleteDoc(doc(db, "issues", issueId));
  await addHistoryRecord({
    assetId: issue?.assetId,
    assetCode: issue?.assetCode,
    action: "Issue Deleted",
    userId: user?.userId,
    userName: user?.FullName,
    issueNumber: issue?.issueNumber
  });
  showToast("Complaint deleted", "warning");
}

export async function getIssue(issueId) {
  const { getDoc } = await import("./firebaseConfig.js");
  const snap = await getDoc(doc(db, "issues", issueId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function getTechnicians() {
  const q = query(collection(db, "users"), where("Role", "==", "technician"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ userId: d.id, ...d.data() }));
}

export async function uploadEvidence(issueId, file, user) {
  const issue = await getIssue(issueId);
  const storageRef = ref(storage, `evidence/${issue.assetId}/${Date.now()}_${file.name}`);
  await uploadBytes(storageRef, file);
  const url = await getDownloadURL(storageRef);
  const urls = [...(issue.evidenceUrls || []), url];
  await updateDoc(doc(db, "issues", issueId), { evidenceUrls: urls, updatedAt: serverTimestamp() });
  await addHistoryRecord({
    assetId: issue.assetId,
    assetCode: issue.assetCode,
    action: "Evidence Uploaded",
    userId: user?.userId,
    userName: user?.FullName,
    issueNumber: issue.issueNumber
  });
  return url;
}

export function renderIssuesTable(container, issues, { onView, role }) {
  if (!issues.length) {
    container.innerHTML = `<tr><td colspan="8"><div class="empty-state">No complaints found</div></td></tr>`;
    return;
  }

  container.innerHTML = issues
    .map((issue) => {
      const actions = buildActions(issue, role);
      return `
      <tr>
        <td><code>${issue.issueNumber}</code></td>
        <td><strong>${issue.assetCode}</strong><br><small>${issue.assetName || ""}</small></td>
        <td>${issue.reporterName}<br><small>${issue.reporterEmail}</small></td>
        <td><span class="priority-pill ${issue.priority?.toLowerCase()}">${issue.priority}</span></td>
        <td><span class="status-pill ${issue.status?.replace(/\s/g, "-").toLowerCase()}">${issue.status}</span></td>
        <td>${issue.assignedTechnician || "—"}</td>
        <td>${issue.createdAt?.toDate ? issue.createdAt.toDate().toLocaleDateString() : "—"}</td>
        <td class="actions-cell">${actions}</td>
      </tr>`;
    })
    .join("");

  container.querySelectorAll("[data-action]").forEach((btn) => {
    btn.addEventListener("click", () => onView(btn.dataset.action, btn.dataset.id));
  });
}

function buildActions(issue, role) {
  const id = issue.id;
  let html = `<button class="btn-sm" data-action="view" data-id="${id}">View</button>`;

  if (role === "admin") {
    html += `<button class="btn-sm" data-action="assign" data-id="${id}">Assign</button>`;
    html += `<button class="btn-sm danger" data-action="delete" data-id="${id}">Delete</button>`;
  }

  if (role === "technician" || role === "admin") {
    if (issue.status === "Assigned" || issue.status === "Reopened") {
      html += `<button class="btn-sm" data-action="inspect" data-id="${id}">Inspect</button>`;
    }
    if (issue.status === "Inspection Started") {
      html += `<button class="btn-sm" data-action="maintain" data-id="${id}">Maintain</button>`;
    }
    if (issue.status === "Under Maintenance") {
      html += `<button class="btn-sm success" data-action="resolve" data-id="${id}">Resolve</button>`;
    }
  }

  return html;
}
