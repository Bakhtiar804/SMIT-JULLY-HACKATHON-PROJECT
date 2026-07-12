# MaintainIQ — SMIT Final Hackathon

**AI-Powered QR Maintenance & Asset History Platform**

Scan. Report. Diagnose. Maintain.

## Track

**Track B — Firebase / HTML / CSS / JavaScript**

## Live Demo Scenario (Evaluator Flow)

1. **Admin** registers "Classroom Projector 01" → unique code + QR generated
2. Scan QR or open public link → **Report Issue**
3. Enter: *"The projector display is flickering and sometimes does not detect HDMI"*
4. Click **AI Issue Triage** → review suggested title, category, priority, causes, checks
5. Edit if needed → Submit → asset status becomes **Issue Reported**
6. **Admin** assigns technician on **Complaints** page
7. **Technician** starts inspection → maintenance → resolves with notes + parts + cost
8. Asset returns to **Operational** → history updated → AI maintenance summary generated
9. Reporter tracks status at `issue-status.html`

## Demo Credentials

Create accounts via `login.html`:

| Role | Suggested Use |
|------|---------------|
| Admin | Asset management, assign technicians, complaints |
| Technician | Assigned tasks, inspection, resolve |
| Employee | View dashboard and assets |

## Tech Stack

- HTML5, CSS3, Vanilla JavaScript (ES6 Modules)
- Firebase Authentication
- Cloud Firestore (realtime listeners)
- Firebase Storage (evidence upload)
- QRCode.js
- Rule-based AI Issue Triage (no API keys in frontend)

## Run Locally

```bash
npx serve .
# or
firebase serve
```

Open `http://localhost:3000` (or port shown). **Do not open HTML files directly** (`file://`) — ES modules require a web server.

## Deploy

```bash
firebase init hosting
firebase deploy --only hosting,firestore:rules
```

## Project Structure

```
├── index.html / login.html     # Landing + Auth (preserved)
├── dashboard.html              # Admin/employee dashboard
├── assets.html                 # Asset management
├── asset-form.html / asset-detail.html
├── public-asset-view.html      # Public QR destination (no login)
├── report-issue.html           # Issue reporting + AI triage
├── issue-status.html           # Public issue tracking
├── complaints.html             # Complaint management
├── technician-dashboard.html   # Technician workflow
├── profile.html
├── css/app.css                 # Dashboard UI (glassmorphism)
└── js/
    ├── firebaseConfig.js
    ├── auth.js
    ├── asset.js
    ├── complaints.js
    ├── aiTriage.js              # AI Issue Triage + summaries
    ├── history.js
    ├── notification.js
    ├── dashboard.js
    ├── admin.js
    ├── publicAsset.js
    └── profile.js
```

## Firebase Collections

| Collection | Purpose |
|------------|---------|
| `users` | Profiles with Role |
| `assets` | Asset records + unique `assetCode` |
| `issues` | Complaints with workflow status |
| `history` | Immutable audit timeline |
| `notifications` | Realtime alerts |

## Business Rules Implemented

- **Asset statuses:** Operational, Issue Reported, Under Inspection, Under Maintenance, Out of Service, Retired
- **Issue statuses:** Reported → Assigned → Inspection Started → Maintenance In Progress → Waiting for Parts → Resolved → Closed → Reopened
- Duplicate asset codes rejected
- Maintenance note required before resolve
- Maintenance cost cannot be negative
- Closed issues cannot be edited until reopened
- Technicians can only update assigned issues
- Critical issues mark asset Out of Service
- All major actions write to history (read-only)

## AI Integration

- **AI Issue Triage** (`js/aiTriage.js`): Analyzes natural-language complaints with asset context
- Returns: title, category, priority, possible causes, initial checks, recurring warnings
- User reviews and edits before submit
- Stores `aiTriageUsed`, `aiSuggested`, `aiEditedByUser` on issue
- **AI Maintenance Summary** generated on resolve
- **Preventive Recommendation** on resolution
- No API keys in frontend — uses secure rule-based engine
- Optional: set `AI_TRIAGE_ENDPOINT` in `aiTriage.js` to a Firebase Cloud Function for live GenAI

## AI Assistance Declaration

AI tools were used for architecture planning and code generation. All implementation is owned and demonstrable by the team during live evaluation.

## Submission Checklist

- [ ] GitHub repository link
- [ ] Deployed application link
- [ ] Demo credentials documented
- [ ] Firebase Storage enabled
- [ ] Firestore rules deployed
- [ ] Live demo rehearsed (projector scenario above)

## Team

SMIT Final Hackathon — MaintainIQ
