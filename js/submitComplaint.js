import { listenAssets } from "./asset.js";
import { submitIssue } from "./complaints.js";
import { triageIssue } from "./aiTriage.js";
import { showToast, ISSUE_CATEGORIES, getIssueStatusUrl, getQueryParam } from "./utils.js";
import { db, collection, query, where, getDocs } from "./firebaseConfig.js";

let assetData = null;
let allAssets = [];
let lastTriage = null;
let aiEdited = false;

export function initSubmitComplaintPage() {
  const assetSelect = document.getElementById("asset-select");
  const catSelect = document.getElementById("issue-category");
  ISSUE_CATEGORIES.forEach((c) => catSelect?.insertAdjacentHTML("beforeend", `<option>${c}</option>`));

  listenAssets((assets) => {
    allAssets = assets.filter((a) => a.status !== "Retired");
    if (!assetSelect) return;
    assetSelect.innerHTML = `<option value="">— Select an asset —</option>`;
    allAssets.forEach((a) => {
      assetSelect.insertAdjacentHTML(
        "beforeend",
        `<option value="${a.id}">${a.assetCode} — ${a.name} (${a.location})</option>`
      );
    });

    const preId = getQueryParam("assetId");
    if (preId) {
      assetSelect.value = preId;
      onAssetSelected(preId);
    }
  });

  assetSelect?.addEventListener("change", (e) => onAssetSelected(e.target.value));
  document.getElementById("asset-code-search")?.addEventListener("click", searchByCode);
  document.getElementById("ai-triage-btn")?.addEventListener("click", runTriage);
  document.getElementById("skip-ai-btn")?.addEventListener("click", showFormManual);
  document.getElementById("retry-ai")?.addEventListener("click", () => {
    document.getElementById("issue-form").style.display = "none";
    document.getElementById("step-complaint").style.display = "block";
  });
  ["issue-title", "issue-priority", "issue-category"].forEach((id) => {
    document.getElementById(id)?.addEventListener("change", () => {
      aiEdited = true;
    });
  });
  document.getElementById("issue-form")?.addEventListener("submit", handleSubmit);
}

function onAssetSelected(assetId) {
  assetData = allAssets.find((a) => a.id === assetId) || null;
  const info = document.getElementById("asset-info");
  if (!info) return;
  if (!assetData) {
    info.textContent = "Select an asset to report an issue";
    document.getElementById("step-complaint").style.display = "none";
    document.getElementById("issue-form").style.display = "none";
    return;
  }
  assetData = { ...assetData, assetId: assetData.id };
  info.textContent = `${assetData.name} (${assetData.assetCode}) — ${assetData.location} · Status: ${assetData.status}`;
  document.getElementById("step-complaint").style.display = "block";
  document.getElementById("issue-form").style.display = "none";
}

function searchByCode() {
  const code = document.getElementById("asset-code-input")?.value.trim().toUpperCase();
  if (!code) return showToast("Enter asset code", "warning");
  const found = allAssets.find((a) => a.assetCode === code);
  if (!found) return showToast("Asset code not found", "error");
  document.getElementById("asset-select").value = found.id;
  onAssetSelected(found.id);
  showToast("Asset found!");
}

async function runTriage() {
  if (!assetData) return showToast("Please select an asset first", "warning");
  const complaint = document.getElementById("raw-complaint")?.value.trim();
  if (!complaint) return showToast("Please describe the issue", "warning");

  document.getElementById("step-complaint").style.display = "none";
  document.getElementById("ai-loading").style.display = "block";

  let history = [];
  try {
    const hq = query(collection(db, "history"), where("assetId", "==", assetData.assetId));
    const hs = await getDocs(hq);
    history = hs.docs.map((d) => d.data());
  } catch {
    /* optional */
  }

  try {
    lastTriage = await triageIssue({ complaint, asset: assetData, history });
    fillFromTriage(complaint, lastTriage);
    document.getElementById("ai-loading").style.display = "none";
    document.getElementById("issue-form").style.display = "grid";
  } catch {
    document.getElementById("ai-loading").style.display = "none";
    showFormManual();
    showToast("AI unavailable — fill form manually", "warning");
  }
}

function showFormManual() {
  if (!assetData) return showToast("Select an asset first", "warning");
  const complaint = document.getElementById("raw-complaint")?.value.trim() || "";
  document.getElementById("step-complaint").style.display = "none";
  document.getElementById("ai-loading").style.display = "none";
  document.getElementById("issue-form").style.display = "grid";
  document.getElementById("ai-suggestions").innerHTML =
    `<p class="hint-text">Fill in the details below and submit your complaint.</p>`;
  if (complaint) {
    document.getElementById("issue-desc").value = complaint;
    document.getElementById("issue-title").value = complaint.slice(0, 60);
  }
  lastTriage = null;
}

function fillFromTriage(complaint, triage) {
  document.getElementById("issue-title").value = triage.title;
  document.getElementById("issue-desc").value = complaint;
  document.getElementById("issue-priority").value = triage.priority;
  if ([...document.getElementById("issue-category").options].some((o) => o.value === triage.category)) {
    document.getElementById("issue-category").value = triage.category;
  }
  document.getElementById("ai-suggestions").innerHTML = `
    <h3>🤖 AI Issue Triage <small>(review & edit before submit)</small></h3>
    <p><strong>Title:</strong> ${triage.title}</p>
    <p><strong>Category:</strong> ${triage.category} · <strong>Priority:</strong> ${triage.priority}</p>
    <p><strong>Possible Causes:</strong> ${triage.possibleCauses.join("; ")}</p>
    <p><strong>Initial Checks:</strong> ${triage.initialChecks}</p>
    ${triage.recurringWarning ? `<p class="ai-warn">⚠️ ${triage.recurringWarning}</p>` : ""}`;
  aiEdited = false;
}

async function handleSubmit(e) {
  e.preventDefault();
  if (!assetData) return showToast("Select an asset", "error");

  const btn = document.getElementById("submit-btn");
  btn.disabled = true;
  btn.textContent = "Submitting...";

  try {
    const result = await submitIssue(
      {
        reporterName: document.getElementById("reporter-name").value,
        reporterEmail: document.getElementById("reporter-email").value,
        reporterPhone: document.getElementById("reporter-phone").value,
        title: document.getElementById("issue-title").value,
        description: document.getElementById("issue-desc").value,
        priority: document.getElementById("issue-priority").value,
        category: document.getElementById("issue-category").value,
        assetCode: assetData.assetCode,
        assetName: assetData.name,
        imageFile: document.getElementById("issue-image")?.files[0] || null,
        aiTriageUsed: !!lastTriage,
        aiSuggested: lastTriage || {},
        aiEditedByUser: aiEdited,
        possibleCauses: lastTriage?.possibleCauses || [],
        initialChecks: lastTriage?.initialChecks || ""
      },
      assetData.assetId
    );

    document.getElementById("issue-form").style.display = "none";
    document.getElementById("step-complaint").style.display = "none";
    document.getElementById("success-msg").style.display = "block";
    document.getElementById("issue-number-display").textContent = `Your issue number: ${result.issueNumber}`;
    document.getElementById("track-link").href = getIssueStatusUrl(result.issueNumber);
    showToast("Complaint submitted successfully!");
  } catch (err) {
    showToast(err.message, "error");
    btn.disabled = false;
    btn.textContent = "Submit Complaint";
  }
}

/** Used by report-issue.html when assetId is in URL */
export async function initReportIssuePage() {
  initSubmitComplaintPage();
  const { loadPublicAsset } = await import("./publicAsset.js");
  try {
    const { asset, assetId } = await loadPublicAsset();
    assetData = { ...asset, assetId };
    document.getElementById("asset-select-wrap").style.display = "none";
    document.getElementById("asset-info").textContent = `${asset.name} (${asset.assetCode}) — ${asset.location}`;
    document.getElementById("step-complaint").style.display = "block";
  } catch (err) {
    document.getElementById("asset-info").textContent = err.message;
    document.getElementById("ai-triage-btn").disabled = true;
  }
}
