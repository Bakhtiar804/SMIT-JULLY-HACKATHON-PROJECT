// Importing connection primitives directly from root configuration file
        import { db, collection, addDoc, onSnapshot, updateDoc, doc, getDocs, query, where, serverTimestamp } from "./firebaseConfig.js";

        // UI Panel View Map Elements
        const views = {
            Dash: document.getElementById('panelDash'),
            Reg: document.getElementById('panelReg'),
            Tickets: document.getElementById('panelTickets')
        };

        const techniciansPool = ["Agent Bilal (Electronics)", "Agent Hamza (HVAC)", "Agent Mustafa (Plumbing)"];

        // Execution Panel View Routing Module
        function shiftWorkspaceContext(targetContextId, displayLabel, auxiliaryText) {
            Object.keys(views).forEach(key => views[key].classList.add('hidden'));
            document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
            
            views[targetContextId].classList.remove('hidden');
            document.getElementById(`btn${targetContextId}`).classList.add('active');
            
            document.getElementById('titleDisplay').innerText = displayLabel;
            document.getElementById('subDisplay').innerText = auxiliaryText;
        }

        document.getElementById('btnDash').addEventListener('click', () => shiftWorkspaceContext('Dash', 'System Command Console', 'Live infrastructure logs and structural node health indices.'));
        document.getElementById('btnReg').addEventListener('click', () => shiftWorkspaceContext('Reg', 'Inventory Ingestion Module', 'Provision new hardware nodes into global network monitoring framework.'));
        document.getElementById('btnTickets').addEventListener('click', () => shiftWorkspaceContext('Tickets', 'Incident Management Terminal', 'Supervise real-time user fault streams and execute field engineer dispatch.'));

        // Function to render assets from snapshot
        function renderAssetsTable(snapshot) {
            const rowTarget = document.getElementById('assetRows');
            rowTarget.innerHTML = "";
            let metrics = { total: 0, ops: 0, inspect: 0, broken: 0 };

            snapshot.forEach(record => {
                const asset = record.data();
                metrics.total++;
                
                let configurationClass = "pill-operational";
                if(asset.status === "Operational") metrics.ops++;
                else if(asset.status === "Under Inspection") { metrics.inspect++; configurationClass = "pill-inspection"; }
                else if(asset.status === "Broken") { metrics.broken++; configurationClass = "pill-broken"; }

                rowTarget.innerHTML += `
                    <tr>
                        <td style="font-family: monospace; font-weight:700; color: var(--primary);">${asset.code}</td>
                        <td><strong>${asset.name}</strong></td>
                        <td><span style="color:var(--text-secondary); font-size:13px;">${asset.category}</span></td>
                        <td><span class="status-pill ${configurationClass}">● ${asset.status}</span></td>
                    </tr>`;
            });

            // Commit numbers directly onto Executive Summary View Cards
            document.getElementById('mTotal').innerText = metrics.total;
            document.getElementById('mOps').innerText = metrics.ops;
            document.getElementById('mInspect').innerText = metrics.inspect;
        }

        // Storage for all assets for client-side filtering
        let allAssetsCache = [];

        // Realtime Data Sync Stream Engine 1: Assets Grid - All Assets
        onSnapshot(collection(db, "assets"), (snapshot) => {
            allAssetsCache = [];
            snapshot.forEach(record => {
                allAssetsCache.push({
                    id: record.id,
                    ...record.data()
                });
            });
            renderAssetsTable(snapshot);
        });

        // Search functionality with smart filtering
        const searchInput = document.getElementById('assetSearch');
        let searchTimeout;
        
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            const searchValue = e.target.value.trim().toLowerCase();
            
            searchTimeout = setTimeout(() => {
                if(searchValue === "") {
                    // Render all cached assets
                    const mockSnapshot = {
                        forEach: (callback) => {
                            allAssetsCache.forEach(asset => {
                                callback({ data: () => asset });
                            });
                        }
                    };
                    renderAssetsTable(mockSnapshot);
                } else {
                    // Filter cached assets by code or name
                    const filteredAssets = allAssetsCache.filter(asset => 
                        asset.code.toLowerCase().includes(searchValue) || 
                        asset.name.toLowerCase().includes(searchValue)
                    );
                    
                    const mockSnapshot = {
                        forEach: (callback) => {
                            filteredAssets.forEach(asset => {
                                callback({ data: () => asset });
                            });
                        }
                    };
                    renderAssetsTable(mockSnapshot);
                }
            }, 300);
        });

        // Realtime Data Sync Stream Engine 2: Tickets Resolver Registry
        onSnapshot(collection(db, "issues"), (snapshot) => {
            const ticketTarget = document.getElementById('ticketRows');
            ticketTarget.innerHTML = "";
            let openIssueCounter = 0;

            snapshot.forEach(record => {
                const ticket = record.data();
                if(ticket.status !== "Resolved") openIssueCounter++;

                ticketTarget.innerHTML += `
                    <tr>
                        <td style="font-family: monospace; font-weight: 700;">${ticket.assetCode}</td>
                        <td><strong>${ticket.title}</strong><br><small style="color:var(--text-secondary); font-size:12px;">${ticket.description}</small></td>
                        <td><span style="color:${ticket.priority === 'High' ? 'var(--danger)' : 'var(--text-primary)'}; font-weight:600;">${ticket.priority}</span></td>
                        <td>${ticket.assignedTechnician ? `<i class="fa-solid fa-user-gear" style="color:var(--primary);"></i> ${ticket.assignedTechnician}` : '<span style="color:var(--text-secondary); font-style:italic;">Unassigned Pipeline</span>'}</td>
                        <td>
                            <select class="input-element pipeline-dispatcher" data-id="${record.id}" data-asset="${ticket.assetId}" style="padding: 6px 12px; font-size:13px;">
                                <option value="" disabled selected>Dispatch Specialist...</option>
                                ${techniciansPool.map(tech => `<option value="${tech}">${tech}</option>`).join('')}
                            </select>
                        </td>
                    </tr>`;
            });

            document.getElementById('mIssues').innerText = openIssueCounter;

            // Instantiating Event Hook Pipeline onto select options elements dynamically
            document.querySelectorAll('.pipeline-dispatcher').forEach(selectElement => {
                selectElement.addEventListener('change', async (event) => {
                    const ticketId = event.target.dataset.id;
                    const assetId = event.target.dataset.asset;
                    const selectedSpecialistName = event.target.value;

                    try {
                        await updateDoc(doc(db, "issues", ticketId), {
                            assignedTechnician: selectedSpecialistName,
                            status: "Assigned"
                        });
                        if(assetId && assetId !== "unknown") {
                            await updateDoc(doc(db, "assets", assetId), { status: "Under Inspection" });
                        }
                        alert(`Infrastructure deployment route successful. Assigned to ${selectedSpecialistName}`);
                    } catch(err) {
                        console.error(err);
                        alert("Transaction execution error during dispatch route.");
                    }
                });
            });
        });

        // Asset Pipeline Data Ingestion Request Form Submission
        document.getElementById('newAssetForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const code = document.getElementById('assetCodeInput').value.toUpperCase().trim();
            const name = document.getElementById('assetNameInput').value.trim();
            const category = document.getElementById('assetCatInput').value;

            // Secure validation query against node data replication leakage
            const duplicateValidationQuery = query(collection(db, "assets"), where("code", "==", code));
            const querySnapshotResult = await getDocs(duplicateValidationQuery);
            
            if(!querySnapshotResult.empty) {
                return alert("Security Conflict: This unique architecture code registration state is already tracked inside the node index matrix.");
            }

            try {
                const writtenDocumentReference = await addDoc(collection(db, "assets"), {
                    code, name, category, status: "Operational", createdAt: serverTimestamp()
                });

                // Clear previous dynamic target node box element and re-provision QR layout schema block
                const targetQrDiv = document.getElementById('qrcodeBox');
                targetQrDiv.innerHTML = "";

                // Configuring the automated deep link parameter route structure matching the Report directory target file
                const deepLinkPayloadUrl = `${window.location.origin}/Report/report.html?assetId=${writtenDocumentReference.id}&assetCode=${encodeURIComponent(code)}`;
                
                new QRCode(targetQrDiv, {
                    text: deepLinkPayloadUrl,
                    width: 150,
                    height: 150,
                    colorDark: "#090d16",
                    colorLight: "#ffffff"
                });

                document.getElementById('qrDeploymentBox').classList.remove('hidden');
                document.getElementById('newAssetForm').reset();
            } catch(error) {
                console.error(error);
                alert("Core pipeline rejection error during document write execution sequence.");
            }
        });





        