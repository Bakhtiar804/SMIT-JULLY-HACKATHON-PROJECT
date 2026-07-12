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
import {
  generateIssueNumber,
  showToast,
  canTransition,
  normalizeIssueStatus,
  normalizeAssetStatus
} from "./utils.js";
import { addHistoryRecord } from "./history.js";
import { createNotification, notifyAdmins } from "./notification.js";
import { generateMaintenanceSummary, generatePreventiveRecommendation } from "./aiTriage.js";
import { getAsset } from "./asset.js";

const ASSET_STATUS_ON_ISSUE = {
  "Inspection Started": "Under Inspection",
  "Maintenance In Progress": "Under Maintenance",
  "Waiting for Parts": "Under Maintenance",
  Resolved: "Operational",
  Closed: "Operational"
};

export function listenIssues(callback) {
  return onSnapshot(collection(db, "issues"), (snap) => {
    callback(
      snap.docs.map((d) => {
        const data = d.data();
        return { id: d.id, ...data, status: normalizeIssueStatus(data.status) };
      })
    );
  });
}

export async function getIssueByNumber(issueNumber) {
  const q = query(collection(db, "issues"), where("issueNumber", "==", issueNumber));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data(), status: normalizeIssueStatus(d.data().status) };
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
    aiTriageUsed: formData.aiTriageUsed || false,
    aiSuggested: formData.aiSuggested || {},
    aiEditedByUser: formData.aiEditedByUser || false,
    possibleCauses: formData.possibleCauses || [],
    initialChecks: formData.initialChecks || "",
    maintenanceSummary: "",
    preventiveRecommendation: "",
    createdAt: serverTimestamp()
  };

  const refDoc = await addDoc(collection(db, "issues"), payload);

  const assetUpdate = { status: "Issue Reported" };
  if (formData.priority === "Critical") assetUpdate.status = "Out of Service";
  await updateDoc(doc(db, "assets", assetId), assetUpdate);

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
  const issue = await getIssue(issueId);
  assertCanModify(issue, user);
  assertTransition(issue.status, "Assigned");

  await updateDoc(doc(db, "issues", issueId), {
    assignedTechnician: technician.FullName,
    assignedTechnicianId: technician.userId,
    status: "Assigned",
    updatedAt: serverTimestamp()
  });

  await addHistoryRecord({
    assetId: issue.assetId,
    assetCode: issue.assetCode,
    action: "Issue Assigned",
    userId: user?.userId,
    userName: user?.FullName,
    issueNumber: issue.issueNumber,
    notes: `Assigned to ${technician.FullName}`
  });

  await createNotification({
    userId: technician.userId,
    type: "issue_assigned",
    title: "New Assignment",
    message: `Issue ${issue.issueNumber} assigned to you`,
    relatedIssueId: issueId,
    relatedAssetId: issue.assetId
  });

  showToast("Technician assigned successfully");
}

export async function updateIssueStatus(issueId, newStatus, extra = {}, user) {
  const issue = await getIssue(issueId);
  if (!issue) throw new Error("Issue not found");

  newStatus = normalizeIssueStatus(newStatus);
  assertCanModify(issue, user);
  assertTransition(issue.status, newStatus);

  if (newStatus === "Resolved") {
    if (!extra.notes?.trim()) throw new Error("Maintenance note is required before resolving.");
    const cost = parseFloat(extra.maintenanceCost);
    if (cost < 0) throw new Error("Maintenance cost cannot be negative.");
  }

  const asset = await getAsset(issue.assetId);
  let maintenanceSummary = extra.maintenanceSummary || "";
  let preventiveRecommendation = extra.preventiveRecommendation || "";

  if (newStatus === "Resolved" || newStatus === "Closed") {
    maintenanceSummary = maintenanceSummary || generateMaintenanceSummary({ ...issue, ...extra, status: newStatus }, asset);
    preventiveRecommendation = preventiveRecommendation || generatePreventiveRecommendation(asset || {}, []);
  }

  await updateDoc(doc(db, "issues", issueId), {
    status: newStatus,
    notes: extra.notes ?? issue.notes,
    partsReplaced: extra.partsReplaced ?? issue.partsReplaced,
    maintenanceCost: extra.maintenanceCost ?? issue.maintenanceCost,
    maintenanceSummary,
    preventiveRecommendation,
    updatedAt: serverTimestamp(),
    ...(newStatus === "Resolved" || newStatus === "Closed" ? { resolvedAt: serverTimestamp() } : {})
  });

  if (issue.assetId && ASSET_STATUS_ON_ISSUE[newStatus]) {
    const patch = { status: ASSET_STATUS_ON_ISSUE[newStatus] };
    if (newStatus === "Resolved") patch.lastServiceDate = new Date().toISOString().slice(0, 10);
    await updateDoc(doc(db, "assets", issue.assetId), patch);
  } else if (newStatus === "Assigned" && issue.assetId) {
    await updateDoc(doc(db, "assets", issue.assetId), { status: "Issue Reported" });
  }

  await addHistoryRecord({
    assetId: issue.assetId,
    assetCode: issue.assetCode,
    action: `Issue ${newStatus}`,
    userId: user?.userId,
    userName: user?.FullName,
    issueNumber: issue.issueNumber,
    notes: extra.notes || ""
  });

  if (newStatus === "Resolved" || newStatus === "Closed") {
    await notifyAdmins("issue_resolved", "Issue Resolved", `${issue.issueNumber} has been ${newStatus.toLowerCase()}`, {
      relatedIssueId: issueId,
      relatedAssetId: issue.assetId
    });
  }

  showToast(`Status updated to ${newStatus}`);
  return { maintenanceSummary, preventiveRecommendation };
}

export async function reopenIssue(issueId, user) {
  return updateIssueStatus(issueId, "Reopened", { notes: "Issue reopened for further review" }, user);
}

export async function deleteIssue(issueId, user) {
  if (user?.Role !== "admin") throw new Error("Only administrators can delete issues.");
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
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data(), status: normalizeIssueStatus(snap.data().status) };
}

export async function getTechnicians() {
  const q = query(collection(db, "users"), where("Role", "==", "technician"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ userId: d.id, ...d.data() }));
}

export async function uploadEvidence(issueId, file, user) {
  const issue = await getIssue(issueId);
  assertCanModify(issue, user);
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

function assertCanModify(issue, user) {
  if (issue.status === "Closed") throw new Error("Closed issues cannot be edited. Reopen first.");
  if (user?.Role === "admin") return;
  if (user?.Role === "technician") {
    const isAssigned =
      issue.assignedTechnicianId === user.userId || issue.assignedTechnician === user.FullName;
    if (!isAssigned) {
      throw new Error("Technicians can only update issues assigned to them.");
    }
  }
}

export async function appendIssueNote(issueId, noteText, user) {
  const issue = await getIssue(issueId);
  if (!issue) throw new Error("Issue not found");
  assertCanModify(issue, user);
  const combined = [issue.notes, noteText.trim()].filter(Boolean).join("\n---\n");
  await updateDoc(doc(db, "issues", issueId), { notes: combined, updatedAt: serverTimestamp() });
  await addHistoryRecord({
    assetId: issue.assetId,
    assetCode: issue.assetCode,
    action: "Note Added",
    userId: user?.userId,
    userName: user?.FullName,
    issueNumber: issue.issueNumber,
    notes: noteText.trim()
  });
  showToast("Note saved");
}

function assertTransition(from, to) {
  if (!canTransition(from, to)) {
    throw new Error(`Invalid status transition: ${from} → ${to}`);
  }
}

export function renderIssuesTable(container, issues, { onView, role, userId, userName }) {
  if (!issues.length) {
    container.innerHTML = `<tr><td colspan="8"><div class="empty-state">No complaints found</div></td></tr>`;
    return;
  }

  container.innerHTML = issues
    .map((issue) => {
      const actions = buildActions(issue, role, userId, userName);
      const crit = issue.priority === "Critical" ? "row-critical" : "";
      return `
      <tr class="${crit}">
        <td><code>${issue.issueNumber}</code></td>
        <td><strong>${issue.assetCode}</strong><br><small>${issue.assetName || ""}</small></td>
        <td>${issue.reporterName}<br><small>${issue.reporterEmail}</small></td>
        <td><span class="priority-pill ${issue.priority?.toLowerCase()}">${issue.priority}</span></td>
        <td><span class="status-pill ${statusClass(issue.status)}">${issue.status}</span></td>
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

function statusClass(status) {
  return (status || "").replace(/\s/g, "-").toLowerCase();
}

function buildActions(issue, role, userId, userName) {
  const id = issue.id;
  let html = `<button class="btn-sm" data-action="view" data-id="${id}">View</button>`;
  const isAssigned = issue.assignedTechnicianId === userId || issue.assignedTechnician === userName;
  const canWork = role === "admin" || isAssigned;

  if (role === "admin" && issue.status === "Reported") {
    html += `<button class="btn-sm" data-action="assign" data-id="${id}">Assign</button>`;
  }
  if (role === "admin") {
    html += `<button class="btn-sm danger" data-action="delete" data-id="${id}">Delete</button>`;
    if (issue.status === "Resolved") html += `<button class="btn-sm" data-action="close" data-id="${id}">Close</button>`;
    if (["Resolved", "Closed"].includes(issue.status)) {
      html += `<button class="btn-sm" data-action="reopen" data-id="${id}">Reopen</button>`;
    }
  }

  if (canWork && issue.status === "Assigned") {
    html += `<button class="btn-sm" data-action="inspect" data-id="${id}">Inspect</button>`;
  }
  if (canWork && issue.status === "Inspection Started") {
    html += `<button class="btn-sm" data-action="note" data-id="${id}">Add Note</button>`;
    html += `<button class="btn-sm" data-action="maintain" data-id="${id}">Maintain</button>`;
    html += `<button class="btn-sm" data-action="parts" data-id="${id}">Wait Parts</button>`;
  }
  if (canWork && issue.status === "Waiting for Parts") {
    html += `<button class="btn-sm" data-action="maintain" data-id="${id}">Resume</button>`;
  }
  if (canWork && issue.status === "Maintenance In Progress") {
    html += `<button class="btn-sm" data-action="note" data-id="${id}">Add Note</button>`;
    html += `<button class="btn-sm success" data-action="resolve" data-id="${id}">Resolve</button>`;
  }
  if (canWork && issue.status === "Reopened") {
    html += `<button class="btn-sm" data-action="inspect" data-id="${id}">Inspect</button>`;
  }

  return html;
}
