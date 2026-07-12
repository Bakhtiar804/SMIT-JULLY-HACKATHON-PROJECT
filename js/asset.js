import {
  db,
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  onSnapshot,
  serverTimestamp
} from "./firebaseConfig.js";
import { getPublicAssetUrl, ORG_NAME, showToast, escapeHtml, debounce, getQueryParam, ASSET_STATUSES } from "./utils.js";
import { addHistoryRecord } from "./history.js";
import { requireAuth } from "./auth.js";
import { initLayout, initTopbar } from "./layout.js";

export async function isAssetCodeTaken(code, excludeId = null) {
  const upper = code.toUpperCase();
  const q1 = query(collection(db, "assets"), where("assetCode", "==", upper));
  const q2 = query(collection(db, "assets"), where("code", "==", upper));
  const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);
  const docs = [...snap1.docs, ...snap2.docs];
  if (!docs.length) return false;
  if (excludeId) return docs.some((d) => d.id !== excludeId);
  return true;
}

export async function createAsset(data, user) {
  const assetCode = data.assetCode.toUpperCase().trim();
  if (await isAssetCodeTaken(assetCode)) {
    throw new Error("Asset code already exists. Please use a unique code.");
  }

  const payload = {
    name: data.name.trim(),
    assetCode,
    category: data.category,
    location: data.location.trim(),
    status: data.status || "Active",
    assignedTechnician: data.assignedTechnician || "",
    lastServiceDate: data.lastServiceDate || null,
    nextServiceDate: data.nextServiceDate || null,
    createdAt: serverTimestamp(),
    createdBy: user?.FullName || "Admin",
    createdById: user?.userId || ""
  };

  const ref = await addDoc(collection(db, "assets"), payload);

  await addHistoryRecord({
    assetId: ref.id,
    assetCode,
    action: "Asset Created",
    userId: user?.userId,
    userName: user?.FullName,
    notes: `${data.name} registered in ${data.location}`
  });

  return { id: ref.id, ...payload, publicUrl: getPublicAssetUrl(ref.id) };
}

export async function updateAsset(assetId, data, user) {
  const assetCode = data.assetCode?.toUpperCase().trim();
  if (assetCode && (await isAssetCodeTaken(assetCode, assetId))) {
    throw new Error("Asset code already exists.");
  }

  const payload = {
    name: data.name?.trim(),
    assetCode,
    category: data.category,
    location: data.location?.trim(),
    status: data.status,
    assignedTechnician: data.assignedTechnician || "",
    lastServiceDate: data.lastServiceDate || null,
    nextServiceDate: data.nextServiceDate || null,
    updatedAt: serverTimestamp()
  };

  Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k]);
  await updateDoc(doc(db, "assets", assetId), payload);

  await addHistoryRecord({
    assetId,
    assetCode: assetCode || data.assetCode,
    action: "Asset Updated",
    userId: user?.userId,
    userName: user?.FullName,
    notes: "Asset details modified"
  });
}

export async function deleteAsset(assetId, user) {
  const snap = await getDoc(doc(db, "assets", assetId));
  if (!snap.exists()) throw new Error("Asset not found");
  const asset = snap.data();

  await deleteDoc(doc(db, "assets", assetId));

  await addHistoryRecord({
    assetId,
    assetCode: asset.assetCode,
    action: "Asset Deleted",
    userId: user?.userId,
    userName: user?.FullName,
    notes: `${asset.name} removed from system`
  });
}

export async function getAsset(assetId) {
  const snap = await getDoc(doc(db, "assets", assetId));
  if (!snap.exists()) return null;
  const data = snap.data();
  return { id: snap.id, ...data, assetCode: data.assetCode || data.code || "" };
}

export function listenAssets(callback) {
  return onSnapshot(collection(db, "assets"), (snap) => {
    const assets = snap.docs.map((d) => {
      const data = d.data();
      return { id: d.id, ...data, assetCode: data.assetCode || data.code || "" };
    });
    callback(assets);
  });
}

export function computeAssetMetrics(assets) {
  return {
    total: assets.length,
    active: assets.filter((a) => a.status === "Active").length,
    underMaintenance: assets.filter((a) => a.status === "Under Maintenance").length,
    issueReported: assets.filter((a) => a.status === "Issue Reported").length,
    retired: assets.filter((a) => a.status === "Retired").length
  };
}

export function renderQR(container, assetId, size = 120) {
  container.innerHTML = "";
  const url = getPublicAssetUrl(assetId);
  new QRCode(container, {
    text: url,
    width: size,
    height: size,
    colorDark: "#0f172a",
    colorLight: "#ffffff",
    correctLevel: QRCode.CorrectLevel.H
  });
  return url;
}

export function renderAssetLabel(container, asset, assetId) {
  container.innerHTML = `
    <div class="print-label" id="printableLabel">
      <div class="label-org">${ORG_NAME}</div>
      <div class="label-main">
        <div class="label-info">
          <h4>${asset.name}</h4>
          <p><strong>Code:</strong> ${asset.assetCode}</p>
          <p><strong>Location:</strong> ${asset.location}</p>
          <span class="status-pill ${asset.status?.replace(/\s/g, "-").toLowerCase()}">${asset.status}</span>
        </div>
        <div class="label-qr-box"><div id="labelQrTarget"></div></div>
      </div>
      <div class="label-footer">Scan QR to view asset info or report an issue.</div>
    </div>`;
  renderQR(document.getElementById("labelQrTarget"), assetId, 100);
}

export function downloadQRFromContainer(containerId, filename) {
  const img = document.querySelector(`#${containerId} img`);
  if (!img) return showToast("QR not ready yet", "error");
  const link = document.createElement("a");
  link.href = img.src;
  link.download = filename;
  link.click();
}

export async function copyAssetLink(assetId) {
  await navigator.clipboard.writeText(getPublicAssetUrl(assetId));
  showToast("Public link copied!");
}

export function printLabel(labelSelector = "#printableLabel") {
  const area = document.getElementById("bulkPrintArea");
  const label = document.querySelector(labelSelector);
  if (!area || !label) return;
  area.innerHTML = label.outerHTML;
  window.print();
}

export async function bulkPrintLabels(assets) {
  const area = document.getElementById("bulkPrintArea");
  if (!area || !assets.length) return showToast("Select assets to print", "warning");
  area.innerHTML = "";

  assets.forEach((asset, i) => {
    const div = document.createElement("div");
    div.className = "print-label";
    div.innerHTML = `
      <div class="label-org">${ORG_NAME}</div>
      <div class="label-main">
        <div class="label-info">
          <h4>${asset.name}</h4>
          <p><strong>Code:</strong> ${asset.assetCode}</p>
          <p><strong>Location:</strong> ${asset.location}</p>
          <span class="status-pill">${asset.status}</span>
        </div>
        <div class="label-qr-box"><div id="bulk-qr-${i}"></div></div>
      </div>`;
    area.appendChild(div);
    setTimeout(() => renderQR(document.getElementById(`bulk-qr-${i}`), asset.id, 90), 50 * i);
  });

  setTimeout(() => window.print(), 300 + assets.length * 50);
}

let assetsCache = [];
let currentUser = null;

export async function initAssetsPage() {
  const { profile } = await requireAuth(["admin", "employee"]);
  currentUser = profile;

  initLayout({
    profile,
    activePage: "assets.html",
    pageTitle: "Asset Management",
    pageSubtitle: "Create, edit and manage all registered assets"
  });
  initTopbar({ profile });

  document.getElementById("add-asset-btn")?.addEventListener("click", () => {
    window.location.href = "asset-form.html";
  });

  document.getElementById("asset-search")?.addEventListener("input", debounce(applyAssetFilters, 250));
  document.getElementById("category-filter")?.addEventListener("change", applyAssetFilters);
  document.getElementById("status-filter")?.addEventListener("change", applyAssetFilters);
  document.getElementById("select-all")?.addEventListener("change", (e) => {
    document.querySelectorAll(".asset-check").forEach((cb) => (cb.checked = e.target.checked));
  });
  document.getElementById("bulk-print-btn")?.addEventListener("click", () => {
    const selected = [...document.querySelectorAll(".asset-check:checked")].map((cb) => cb.dataset.id);
    const assets = assetsCache.filter((a) => selected.includes(a.id));
    bulkPrintLabels(assets);
  });

  listenAssets((assets) => {
    assetsCache = assets;
    applyAssetFilters();
  });
}

function applyAssetFilters() {
  const search = document.getElementById("asset-search")?.value.toLowerCase() || "";
  const category = document.getElementById("category-filter")?.value || "";
  const status = document.getElementById("status-filter")?.value || "";
  let filtered = [...assetsCache];

  if (search) {
    filtered = filtered.filter(
      (a) =>
        a.name?.toLowerCase().includes(search) ||
        a.assetCode?.toLowerCase().includes(search) ||
        a.location?.toLowerCase().includes(search)
    );
  }
  if (category) filtered = filtered.filter((a) => a.category === category);
  if (status) filtered = filtered.filter((a) => a.status === status);

  renderAssetsList(filtered);
}

function renderAssetsList(assets) {
  const tbody = document.getElementById("assets-body");
  if (!tbody) return;

  if (!assets.length) {
    tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state">No assets found</div></td></tr>`;
    return;
  }

  tbody.innerHTML = assets
    .map(
      (a) => `
    <tr>
      <td><input type="checkbox" class="asset-check" data-id="${a.id}"></td>
      <td><strong>${escapeHtml(a.name)}</strong></td>
      <td><code>${escapeHtml(a.assetCode)}</code></td>
      <td>${escapeHtml(a.category || "—")}</td>
      <td>${escapeHtml(a.location)}</td>
      <td><span class="status-pill ${a.status?.replace(/\s/g, "-").toLowerCase()}">${escapeHtml(a.status)}</span></td>
      <td>${escapeHtml(a.assignedTechnician || "—")}</td>
      <td class="actions-cell">
        <a href="asset-detail.html?id=${a.id}" class="btn-sm">View</a>
        <a href="asset-form.html?id=${a.id}" class="btn-sm">Edit</a>
        ${currentUser?.Role === "admin" ? `<button class="btn-sm danger" data-del="${a.id}">Delete</button>` : ""}
      </td>
    </tr>`
    )
    .join("");

  tbody.querySelectorAll("[data-del]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (confirm("Delete this asset permanently?")) {
        await deleteAsset(btn.dataset.del, currentUser);
        showToast("Asset deleted", "warning");
      }
    });
  });
}

export async function initAssetFormPage() {
  const { profile } = await requireAuth(["admin"]);
  currentUser = profile;
  const assetId = getQueryParam("id");
  const isEdit = Boolean(assetId);

  initLayout({
    profile,
    activePage: "assets.html",
    pageTitle: isEdit ? "Edit Asset" : "Create Asset",
    pageSubtitle: isEdit ? "Update asset information" : "Register a new asset with auto-generated QR"
  });

  const statusSelect = document.getElementById("asset-status");
  ASSET_STATUSES.forEach((s) => {
    statusSelect?.insertAdjacentHTML("beforeend", `<option value="${s}">${s}</option>`);
  });

  if (isEdit) {
    const asset = await getAsset(assetId);
    if (!asset) return showToast("Asset not found", "error");
    document.getElementById("asset-name").value = asset.name;
    document.getElementById("asset-code").value = asset.assetCode;
    document.getElementById("asset-category").value = asset.category || "";
    document.getElementById("asset-location").value = asset.location;
    document.getElementById("asset-status").value = asset.status;
    document.getElementById("asset-technician").value = asset.assignedTechnician || "";
    document.getElementById("last-service").value = asset.lastServiceDate || "";
    document.getElementById("next-service").value = asset.nextServiceDate || "";
  }

  document.getElementById("asset-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = {
      name: document.getElementById("asset-name").value,
      assetCode: document.getElementById("asset-code").value,
      category: document.getElementById("asset-category").value,
      location: document.getElementById("asset-location").value,
      status: document.getElementById("asset-status").value,
      assignedTechnician: document.getElementById("asset-technician").value,
      lastServiceDate: document.getElementById("last-service").value || null,
      nextServiceDate: document.getElementById("next-service").value || null
    };

    try {
      if (isEdit) {
        await updateAsset(assetId, data, currentUser);
        showToast("Asset updated!");
        window.location.href = `asset-detail.html?id=${assetId}`;
      } else {
        const created = await createAsset(data, currentUser);
        showToast("Asset created with QR!");
        window.location.href = `asset-detail.html?id=${created.id}`;
      }
    } catch (err) {
      showToast(err.message, "error");
    }
  });
}

export async function initAssetDetailPage() {
  const { profile } = await requireAuth(["admin", "employee", "technician"]);
  currentUser = profile;
  const assetId = getQueryParam("id");
  if (!assetId) return (window.location.href = "assets.html");

  initLayout({
    profile,
    activePage: "assets.html",
    pageTitle: "Asset Details",
    pageSubtitle: "View asset info, QR label and maintenance history"
  });
  initTopbar({ profile });

  const asset = await getAsset(assetId);
  if (!asset) return showToast("Asset not found", "error");

  document.getElementById("detail-name").textContent = asset.name;
  document.getElementById("detail-code").textContent = asset.assetCode;
  document.getElementById("detail-category").textContent = asset.category || "—";
  document.getElementById("detail-location").textContent = asset.location;
  document.getElementById("detail-status").textContent = asset.status;
  document.getElementById("detail-status").className = `status-pill ${asset.status?.replace(/\s/g, "-").toLowerCase()}`;
  document.getElementById("detail-technician").textContent = asset.assignedTechnician || "—";
  document.getElementById("detail-created").textContent = asset.createdAt?.toDate?.().toLocaleDateString() || "—";
  document.getElementById("detail-last-service").textContent = asset.lastServiceDate || "—";
  document.getElementById("detail-next-service").textContent = asset.nextServiceDate || "—";

  renderAssetLabel(document.getElementById("label-container"), asset, assetId);

  document.getElementById("download-qr")?.addEventListener("click", () => downloadQRFromContainer("labelQrTarget", `QR_${asset.assetCode}.png`));
  document.getElementById("copy-link")?.addEventListener("click", () => copyAssetLink(assetId));
  document.getElementById("print-label")?.addEventListener("click", () => printLabel());
  document.getElementById("open-public")?.addEventListener("click", () => window.open(getPublicAssetUrl(assetId), "_blank"));
  document.getElementById("edit-asset")?.addEventListener("click", () => (window.location.href = `asset-form.html?id=${assetId}`));

  const { listenAssetHistory } = await import("./history.js");
  listenAssetHistory(assetId, document.getElementById("history-list"));
}
