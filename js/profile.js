import { requireAuth, updateUserProfile } from "./auth.js";
import { initLayout } from "./layout.js";
import { showToast } from "./utils.js";

export async function initProfilePage() {
  const { user, profile } = await requireAuth();
  initLayout({
    profile,
    activePage: "profile.html",
    pageTitle: "Profile",
    pageSubtitle: "Manage your account settings"
  });
  fillProfileForm(profile);

  document.getElementById("profile-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = {
      FullName: document.getElementById("profile-name").value.trim(),
      Email: document.getElementById("profile-email").value.trim(),
      phone: document.getElementById("profile-phone").value.trim(),
      department: document.getElementById("profile-dept").value.trim()
    };

    try {
      await updateUserProfile(user.uid, data);
      showToast("Profile updated successfully!");
    } catch (err) {
      showToast(err.message, "error");
    }
  });
}

function fillProfileForm(profile) {
  document.getElementById("profile-name").value = profile.FullName || "";
  document.getElementById("profile-email").value = profile.Email || "";
  document.getElementById("profile-phone").value = profile.phone || "";
  document.getElementById("profile-dept").value = profile.department || "";
  document.getElementById("profile-role").textContent = profile.Role || "—";
  document.getElementById("profile-avatar").textContent = (profile.FullName || "U").charAt(0).toUpperCase();
}
