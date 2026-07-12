/**
 * AI Issue Triage — Track B safe implementation
 * Uses intelligent rule-based analysis (no API keys in frontend).
 * Replace AI_TRIAGE_ENDPOINT with a Firebase Cloud Function URL for live GenAI.
 */
const AI_TRIAGE_ENDPOINT = null; // e.g. "https://us-central1-PROJECT.cloudfunctions.net/triageIssue"

const KEYWORD_RULES = [
  { keys: ["leak", "water", "drip", "flooding"], category: "Leakage / Performance", priority: "High", causes: ["Blocked drain pipe", "Damaged seal or gasket", "Condensation overflow"] },
  { keys: ["noise", "sound", "grinding", "rattling", "buzz"], category: "Mechanical / Performance", priority: "Medium", causes: ["Loose components", "Worn bearings or belts", "Obstructed moving parts"] },
  { keys: ["hdmi", "display", "screen", "flicker", "projector", "no signal"], category: "Display / Connectivity", priority: "High", causes: ["Damaged HDMI cable", "Loose port connection", "Overheating lamp or panel"] },
  { keys: ["cool", "cooling", "weak", "temperature", "hot", "overheat"], category: "Performance / HVAC", priority: "High", causes: ["Dirty air filter", "Refrigerant leak", "Blocked airflow or frozen coil"] },
  { keys: ["power", "electric", "spark", "short", "tripping", "breaker"], category: "Electrical / Safety", priority: "Critical", causes: ["Faulty wiring", "Overloaded circuit", "Damaged power supply"] },
  { keys: ["smoke", "burn", "fire", "gas", "smell"], category: "Safety", priority: "Critical", causes: ["Electrical fault", "Overheating component", "Gas or chemical leak"] },
  { keys: ["software", "login", "network", "wifi", "slow", "crash"], category: "Software / IT", priority: "Medium", causes: ["Outdated firmware", "Network configuration issue", "Insufficient resources"] }
];

const SAFETY_CHECKS = {
  Critical: "Turn off the unit if safe to do so. Do not touch exposed wiring. Contact a qualified technician immediately.",
  High: "Inspect visible connections. Avoid operating the asset if safety may be compromised. Document symptoms before use.",
  Medium: "Perform a visual inspection. Check filters, cables, and accessible panels. Note when the issue started.",
  Low: "Record the issue details. Schedule routine inspection at next available maintenance window."
};

export async function triageIssue({ complaint, asset = {}, history = [] }) {
  if (AI_TRIAGE_ENDPOINT) {
    try {
      const res = await fetchWithTimeout(AI_TRIAGE_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ complaint, asset, historyCount: history.length })
      }, 12000);
      if (res.ok) {
        const data = await res.json();
        return validateTriageOutput(data);
      }
    } catch {
      // fall through to local triage
    }
  }

  await delay(900 + Math.random() * 600);
  return ruleBasedTriage(complaint, asset, history);
}

function ruleBasedTriage(complaint, asset, history) {
  const text = (complaint || "").toLowerCase();
  let matched = KEYWORD_RULES.find((r) => r.keys.some((k) => text.includes(k)));

  const recurring = history.filter((h) => h.action?.includes("Issue")).length >= 2;
  const assetType = asset.category || "General Equipment";

  if (!matched) {
    matched = {
      category: guessCategory(assetType),
      priority: text.length > 120 ? "Medium" : "Low",
      causes: ["General wear and tear", "Pending physical inspection", "Environmental factors"]
    };
  }

  const priority = escalatePriority(matched.priority, text, recurring);
  const title = buildTitle(complaint, asset);
  const initialChecks = buildChecks(priority, matched, assetType, text);

  return {
    title,
    category: matched.category,
    priority,
    possibleCauses: matched.causes,
    initialChecks,
    recurringWarning: recurring ? "This asset has repeated issues in its history. Consider preventive maintenance or part replacement." : "",
    preventiveHint: buildPreventiveHint(asset, recurring),
    aiGenerated: true,
    aiSource: AI_TRIAGE_ENDPOINT ? "cloud" : "rules"
  };
}

function buildTitle(complaint, asset) {
  const short = complaint.trim().slice(0, 80);
  if (short.length <= 60) return capitalize(short);
  const words = short.split(/\s+/).slice(0, 8).join(" ");
  return capitalize(words);
}

function buildChecks(priority, matched, assetType, text) {
  const base = SAFETY_CHECKS[priority] || SAFETY_CHECKS.Medium;
  const specific = [];

  if (text.includes("hdmi") || text.includes("display")) {
    specific.push("Check HDMI cable and port for damage; try an alternate cable if available.");
  }
  if (text.includes("leak") || text.includes("water")) {
    specific.push("Keep water away from electrical components; inspect drainage paths.");
  }
  if (text.includes("filter") || text.includes("cool")) {
    specific.push("Inspect and clean filters; verify airflow is unobstructed.");
  }
  if (!specific.length) {
    specific.push(`Visually inspect ${assetType} for obvious damage, loose connections, or abnormal operation.`);
  }

  return `${base} ${specific.join(" ")}`;
}

function escalatePriority(base, text, recurring) {
  if (/smoke|fire|spark|gas|electrocut|danger|unsafe/.test(text)) return "Critical";
  if (/not working|completely|dead|failed|emergency/.test(text)) return "High";
  if (recurring && base === "Low") return "Medium";
  if (recurring && base === "Medium") return "High";
  return base;
}

function guessCategory(assetType) {
  const map = {
    HVAC: "Performance / HVAC",
    Electrical: "Electrical",
    Plumbing: "Leakage / Plumbing",
    "IT Equipment": "Software / IT",
    Machinery: "Mechanical"
  };
  return map[assetType] || "General Maintenance";
}

function buildPreventiveHint(asset, recurring) {
  if (recurring) return "Schedule a full inspection — recurring failures detected in asset history.";
  if (asset.nextServiceDate) return `Next scheduled service: ${asset.nextServiceDate}. Consider advancing if symptoms persist.`;
  return "After resolution, update last service date and schedule next preventive maintenance.";
}

export function generateMaintenanceSummary(issue, asset) {
  const parts = issue.partsReplaced ? `Parts replaced: ${issue.partsReplaced}.` : "";
  const cost = issue.maintenanceCost > 0 ? `Maintenance cost: PKR ${issue.maintenanceCost}.` : "";
  return `Service completed for ${asset?.name || issue.assetName} (${issue.assetCode}). Issue "${issue.title}" was ${issue.status?.toLowerCase() || "resolved"}. ${issue.notes || "Maintenance performed as documented."} ${parts} ${cost} Asset returned to Operational status. Recommended: verify operation for 24 hours and log next service date.`.replace(/\s+/g, " ").trim();
}

export function generatePreventiveRecommendation(asset, issueHistory = []) {
  const issueCount = issueHistory.filter((h) => h.action?.includes("Issue")).length;
  if (issueCount >= 3) return `Asset ${asset.assetCode} shows a recurring failure pattern (${issueCount} issues). Recommend component replacement review and accelerated inspection cycle.`;
  if (asset.nextServiceDate) return `Continue standard preventive schedule. Next service due: ${asset.nextServiceDate}.`;
  return "Schedule preventive maintenance within 30 days to reduce unexpected downtime.";
}

function capitalize(str) {
  if (!str) return "Maintenance issue reported";
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function validateTriageOutput(data) {
  return {
    title: data.title || "Reported maintenance issue",
    category: data.category || "General Maintenance",
    priority: ["Low", "Medium", "High", "Critical"].includes(data.priority) ? data.priority : "Medium",
    possibleCauses: Array.isArray(data.possibleCauses) ? data.possibleCauses : ["Pending inspection"],
    initialChecks: data.initialChecks || SAFETY_CHECKS.Medium,
    recurringWarning: data.recurringWarning || "",
    preventiveHint: data.preventiveHint || "",
    aiGenerated: true,
    aiSource: "cloud"
  };
}

async function fetchWithTimeout(url, options, ms) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...options, signal: ctrl.signal });
  } finally {
    clearTimeout(id);
  }
}

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
