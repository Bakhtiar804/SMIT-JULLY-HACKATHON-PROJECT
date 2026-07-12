import {
  auth,
  db,
  doc,
  getDoc,
  setDoc,
  onAuthStateChanged,
  signOut,
  serverTimestamp
} from "./firebaseConfig.js";

const ROLE_ROUTES = {
  admin: "dashboard.html",
  technician: "technician-dashboard.html",
  employee: "dashboard.html"
};

export async function getUserProfile(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? snap.data() : null;
}

export async function ensureSocialUserProfile(user) {
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) return snap.data();

  const profile = {
    FullName: user.displayName || "User",
    Email: user.email || "",
    Role: "employee",
    userId: user.uid,
    createdAt: serverTimestamp()
  };
  await setDoc(ref, profile);
  return profile;
}

export function redirectByRole(role) {
  window.location.href = ROLE_ROUTES[role] || "dashboard.html";
}

export function requireAuth(allowedRoles = []) {
  return new Promise((resolve, reject) => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      unsub();
      if (!user) {
        window.location.href = "login.html";
        reject(new Error("Not authenticated"));
        return;
      }
      const profile = await getUserProfile(user.uid);
      if (!profile) {
        window.location.href = "login.html";
        reject(new Error("No profile"));
        return;
      }
      if (allowedRoles.length && !allowedRoles.includes(profile.Role)) {
        redirectByRole(profile.Role);
        reject(new Error("Unauthorized"));
        return;
      }
      resolve({ user, profile: { ...profile, userId: profile.userId || user.uid } });
    });
  });
}

export async function logoutUser() {
  await signOut(auth);
  window.location.href = "login.html";
}

export function watchAuth(callback) {
  return onAuthStateChanged(auth, async (user) => {
    if (!user) {
      callback(null, null);
      return;
    }
    const profile = await getUserProfile(user.uid);
    callback(user, profile);
  });
}

export async function updateUserProfile(uid, data) {
  await setDoc(doc(db, "users", uid), { ...data, updatedAt: serverTimestamp() }, { merge: true });
}

export { ROLE_ROUTES };
