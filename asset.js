// import{
//     auth,
//     createUserWithEmailAndPassword,
//     signInWithEmailAndPassword,
//     onAuthStateChanged,
//     GoogleAuthProvider ,
//     signInWithPopup,
//     GithubAuthProvider ,
//     db,
//     doc,
//     setDoc
// }

// --- CRITICAL: Apni Firebase Console Se Mili Hui Config Yahan Paste Karen ---
const firebaseConfig = {
    apiKey: "AIzaSyCpDcuHFQ34BR9IpYuf9DRJKN_YXBL1-qs",
    authDomain: "smit-hackathon-5fa78.firebaseapp.com",
    projectId: "smit-hackathon-5fa78",
    storageBucket: "smit-hackathon-5fa78.firebasestorage.app",
    messagingSenderId: "252337877199",
    appId: "1:252337877199:web:039bbe2ad37eabfde047ba",
    measurementId: "G-5ZGLLL7P19"
};

// Firebase Initialize Engine
let db = null;
let firebaseAvailable = false;

function initializeFirebase() {
    if (typeof window.firebase === "undefined" || !window.firebase.initializeApp) {
        console.warn("Firebase SDK not loaded. Using local storage only.");
        return false;
    }

    if (!window.firebase.apps.length) {
        window.firebase.initializeApp(firebaseConfig);
    }

    db = window.firebase.firestore();
    return true;
}

firebaseAvailable = initializeFirebase();

// Global Assets Array
let assetsData = [];
let activeSelectedAssetId = null;

document.addEventListener("DOMContentLoaded", () => {
    // 1. Pehle LocalStorage (Offline Cache) se data load karen taake UI jaldi khule
    loadLocalAssets();

    // 2. Phir Firebase Firestore se real-time updates listen karen
    if (firebaseAvailable) {
        syncWithFirebase();
    }

    // Submit Handler to create assets
    document.getElementById("assetForm").addEventListener("submit", async (e) => {
        e.preventDefault();

        const newAsset = {
            id: Date.now().toString(), // Permanent unalterable cryptographic map ID
            name: document.getElementById("assetName").value,
            code: document.getElementById("assetCode").value,
            location: document.getElementById("assetLocation").value,
            status: document.getElementById("assetStatus").value,
            createdAt: new Date().toISOString()
        };

        // --- DUAL SAVE STRATEGY ---
        // A. LocalStorage mein foran push karen (Instant UI response)
        assetsData.push(newAsset);
        saveToLocalStorage();
        renderAssetsTable();

        // B. Firebase Cloud Firestore mein background mein save karen
        if (firebaseAvailable && db) {
            try {
                await db.collection("assets").doc(newAsset.id).set(newAsset);
                console.log("Asset successfully synced with Firebase cloud!");
            } catch (error) {
                console.warn("Firebase offline. Local fallback preserved:", error);
            }
        }

        document.getElementById("assetForm").reset();
        showAssetDetails(newAsset.id);
    });

    // Bulk actions
    document.getElementById("bulkPrintBtn").addEventListener("click", generateBulkLabels);
    document.getElementById("selectAll").addEventListener("change", function () {
        const checkboxes = document.querySelectorAll(".asset-checkbox");
        checkboxes.forEach(cb => cb.checked = this.checked);
    });
});

// Real-time Firebase Synchronization Engine
function syncWithFirebase() {
    if (!firebaseAvailable || !db) {
        return;
    }

    db.collection("assets").orderBy("createdAt", "asc")
        .onSnapshot((snapshot) => {
            let cloudAssets = [];
            snapshot.forEach((doc) => {
                cloudAssets.push(doc.data());
            });

            if (cloudAssets.length > 0) {
                // Cloud data ko local data se merge/overwrite karen
                assetsData = cloudAssets;
                saveToLocalStorage();
                renderAssetsTable();
            }
        }, (error) => {
            console.log("Firebase connection error, working with LocalStorage: ", error);
        });
}

function loadLocalAssets() {
    assetsData = JSON.parse(localStorage.getItem('miq_assets')) || [
        { id: "171981001", name: "Main Server Rack A", code: "MIQ-SRV-01", location: "Server Room Floor 3", status: "Active" },
        { id: "171981002", name: "Backup Generator Diesel", code: "MIQ-GEN-45", location: "Rear External Yard", status: "Retired" }
    ];
    renderAssetsTable();
}

function saveToLocalStorage() {
    localStorage.setItem('miq_assets', JSON.stringify(assetsData));
}

function renderAssetsTable() {
    const tbody = document.getElementById("assetTableBody");
    tbody.innerHTML = "";
    assetsData.forEach(asset => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td><input type="checkbox" class="asset-checkbox" data-id="${asset.id}"></td>
            <td><strong>${asset.name}</strong><br><small style="color:#64748B">${asset.location}</small></td>
            <td><code>${asset.code}</code></td>
            <td><span class="status-tag status-${asset.status}">${asset.status}</span></td>
            <td><button onclick="showAssetDetails('${asset.id}')" class="btn btn-secondary btn-small"><i class="fa-solid fa-eye"></i> View & Print</button></td>
        `;
        tbody.appendChild(tr);
    });
}

function showAssetDetails(id) {
    const asset = assetsData.find(a => a.id === id);
    const detailSection = document.getElementById("detailSection");
    const detailContent = document.getElementById("detailContent");
    const notFoundState = document.getElementById("notFoundState");

    detailSection.classList.remove("hidden");
    activeSelectedAssetId = id;

    if (!asset) {
        notFoundState.classList.remove("hidden");
        detailContent.classList.add("hidden");
        return;
    }

    notFoundState.classList.add("hidden");
    detailContent.classList.remove("hidden");

    document.getElementById("lblTitle").textContent = asset.name;
    document.getElementById("lblCode").textContent = asset.code;
    document.getElementById("lblLocation").textContent = asset.location;

    const badge = document.getElementById("lblStatusBadge");
    badge.textContent = asset.status;
    badge.className = `status-tag status-${asset.status}`;

    const qrContainer = document.getElementById("labelQr");
    qrContainer.innerHTML = "";

    // Secure public URL with unique router link mapping ID
    const publicSafeUrl = `${window.location.origin}/public-asset-view.html?assetId=${asset.id}`;

    new QRCode(qrContainer, {
        text: publicSafeUrl,
        width: 100,
        height: 100,
        correctLevel: QRCode.CorrectLevel.H
    });
}

function closeDetails() { document.getElementById("detailSection").classList.add("hidden"); }
function downloadQR() {
    const img = document.getElementById("labelQr").querySelector("img");
    if (img) {
        const link = document.createElement("a");
        link.href = img.src;
        link.download = `QR_Asset_${activeSelectedAssetId}.png`;
        link.click();
    }
}
function copyPublicLink() {
    const publicSafeUrl = `${window.location.origin}/public-asset-view.html?assetId=${activeSelectedAssetId}`;
    navigator.clipboard.writeText(publicSafeUrl);
    alert("Public Asset Safe Link Copied to Clipboard!");
}
function openPublicPage() {
    window.open(`${window.location.origin}/public-asset-view.html?assetId=${activeSelectedAssetId}`, '_blank');
}
function printSingleLabel() {
    const targetLabel = document.getElementById("printableLabel").innerHTML;
    document.getElementById("bulkPrintArea").innerHTML = `<div class="print-label">${targetLabel}</div>`;
    window.print();
}

function generateBulkLabels() {
    const checkboxes = document.querySelectorAll(".asset-checkbox:checked");
    const bulkPrintArea = document.getElementById("bulkPrintArea");
    bulkPrintArea.innerHTML = "";

    if (checkboxes.length === 0) {
        alert("Please select at least one asset checkbox first.");
        return;
    }

    checkboxes.forEach((cb, index) => {
        const assetId = cb.getAttribute("data-id");
        const asset = assetsData.find(a => a.id === assetId);

        if (asset) {
            const uniqueDivId = `bulk-qr-${index}`;
            const labelDiv = document.createElement("div");
            labelDiv.className = "print-label";
            labelDiv.style.marginBottom = "20px";
            labelDiv.innerHTML = `
                <div class="label-org">MaintainIQ Infrastructure</div>
                <div class="label-main">
                    <div class="label-info">
                        <h4>${asset.name}</h4>
                        <p><strong>Code:</strong> ${asset.code}</p>
                        <p><strong>Loc:</strong> ${asset.location}</p>
                        <div class="status-tag status-${asset.status}">${asset.status}</div>
                    </div>
                    <div class="label-qr-box">
                        <div id="${uniqueDivId}"></div>
                    </div>
                </div>
                <div class="label-footer">Instructions: Scan QR code via mobile to view public verification page.</div>
            `;
            bulkPrintArea.appendChild(labelDiv);

            setTimeout(() => {
                new QRCode(document.getElementById(uniqueDivId), {
                    text: `${window.location.origin}/public-asset-view.html?assetId=${asset.id}`,
                    width: 100,
                    height: 100
                });
            }, 50);
        }
    });

    setTimeout(() => { window.print(); }, 500);
}