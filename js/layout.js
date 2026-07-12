import { logoutUser } from "./auth.js";

const NAV_ITEMS = {
  admin: [
    { href: "dashboard.html", icon: "📊", label: "Dashboard" },
    { href: "assets.html", icon: "📦", label: "Assets" },
    { href: "complaints.html", icon: "🎫", label: "Complaints" },
    { href: "profile.html", icon: "👤", label: "Profile" }
  ],
  technician: [
    { href: "technician-dashboard.html", icon: "🔧", label: "My Tasks" },
    { href: "complaints.html", icon: "🎫", label: "Complaints" },
    { href: "profile.html", icon: "👤", label: "Profile" }
  ],
  employee: [
    { href: "dashboard.html", icon: "📊", label: "Dashboard" },
    { href: "assets.html", icon: "📦", label: "Assets" },
    { href: "profile.html", icon: "👤", label: "Profile" }
  ]
};

export function initLayout({ profile, activePage, pageTitle, pageSubtitle }) {
  const role = profile?.Role || "employee";
  const items = NAV_ITEMS[role] || NAV_ITEMS.employee;
  const initials = (profile?.FullName || "U").charAt(0).toUpperCase();

  const sidebar = document.getElementById("sidebar");
  if (sidebar) {
    sidebar.innerHTML = `
      <div class="brand">
        <span class="brand-icon">⚙️</span>
        <span class="brand-text">MaintainIQ</span>
      </div>
      <div class="user-card glass-card">
        <div class="avatar">${initials}</div>
        <div>
          <strong>${profile?.FullName || "User"}</strong>
          <span class="role-badge">${role}</span>
        </div>
      </div>
      <nav class="nav-menu">
        ${items
          .map(
            (item) => `
          <a href="${item.href}" class="nav-item ${activePage === item.href ? "active" : ""}">
            <span>${item.icon}</span> ${item.label}
          </a>`
          )
          .join("")}
      </nav>
      <div class="sidebar-footer">
        <button id="theme-toggle" class="btn-ghost" type="button">🌓 Theme</button>
        <button id="logout-btn" class="btn-ghost danger" type="button">Logout</button>
      </div>`;
  }

  const titleEl = document.getElementById("page-title");
  const subtitleEl = document.getElementById("page-subtitle");
  if (titleEl) titleEl.textContent = pageTitle || "Dashboard";
  if (subtitleEl) subtitleEl.textContent = pageSubtitle || "";

  document.getElementById("logout-btn")?.addEventListener("click", logoutUser);
  initThemeToggle();
  initMobileNav();
}

function initThemeToggle() {
  const saved = localStorage.getItem("miq-theme") || "light";
  document.documentElement.setAttribute("data-theme", saved);

  document.getElementById("theme-toggle")?.addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-theme");
    const next = current === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("miq-theme", next);
  });
}

function initMobileNav() {
  const toggle = document.getElementById("menu-toggle");
  const sidebar = document.getElementById("sidebar");
  toggle?.addEventListener("click", () => sidebar?.classList.toggle("open"));
}

export function initTopbar({ profile }) {
  const notifBadge = document.getElementById("notif-badge");
  const notifList = document.getElementById("notif-list");
  if (profile?.userId && notifList) {
    import("./notification.js").then(({ listenUserNotifications }) => {
      listenUserNotifications(profile.userId, notifList, notifBadge);
    });
  }
}
