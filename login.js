import { auth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, doc, db, setDoc, getDoc, GoogleAuthProvider, signInWithPopup, GithubAuthProvider } from "./js/firebaseConfig.js";
import { redirectByRole, ensureSocialUserProfile, getUserProfile } from "./js/auth.js";

// --- DOM Elements ---
// SignUp Inputs
const fullName = document.querySelector('#signup-name');
const userRole = document.querySelector('#signup-role');
const signUpEmail = document.querySelector('#signup-email');
const signUpPass = document.querySelector('#signup-password');
const signUpBtn = document.querySelector('#signup-submit');

// SignIn Inputs
const signInEmail = document.querySelector('#signin-email');
const signInPass = document.querySelector('#signin-pass');
const signInBtn = document.querySelector('#signin-btn'); 
const signInRole = document.querySelector('#signin-role');

// Social Auth Buttons
const googleBtn_signIn = document.querySelector("#google-signin");
const googleBtn_signUp = document.querySelector("#google-signup");
const githubBtn_signIn = document.querySelector("#github-signin");
const githubBtn_signUp = document.querySelector("#github-signup");

let isSignUp = false;

// --- Helper Function for Custom Alerts ---
const showAlert = (title, text, icon) => {
  Swal.fire({
    title: title,
    text: text,
    icon: icon, // options: 'success', 'error', 'warning', 'info'
    confirmButtonColor: '#3085d6'
  });
};

// --- SignUp Logic ---
const signUp = async () => {
  if (!fullName.value.trim() || !userRole.value || !signUpEmail.value.trim() || !signUpPass.value.trim()) {
    showAlert("Validation Error", "All fields are required. Please fill out the form completely.", "warning");
    return;
  }

  if (signUpPass.value.length < 6) {
    showAlert("Weak Password", "Password must be at least 6 characters long.", "warning");
    return;
  }

  isSignUp = true; 

  const email = signUpEmail.value.trim();
  const password = signUpPass.value.trim();
  const userData = {
    FullName: fullName.value.trim(),
    Email: email,
    Role: userRole.value
  };

  Swal.fire({
    title: 'Creating Account...',
    text: 'Please wait while we set up your profile.',
    allowOutsideClick: false,
    didOpen: () => {
      Swal.showLoading();
    }
  });

  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const userId = userCredential.user.uid;

    await setDoc(doc(db, "users", userId), {
      ...userData,
      userId: userId
    });

    Swal.fire({
      title: "Success!",
      text: "Your account has been created successfully.",
      icon: "success",
      timer: 2000,
      showConfirmButton: false
    });

    setTimeout(async () => {
      const profile = await getUserProfile(userId);
      redirectByRole(profile?.Role || userRole.value);
    }, 2000);

  } catch (error) {
    isSignUp = false;
    console.error("SignUp Error:", error);

    if (error.code === 'auth/email-already-in-use') {
      showAlert("Registration Failed", "This email address is already in use.", "error");
    } else if (error.code === 'auth/invalid-email') {
      showAlert("Registration Failed", "The email address format is invalid.", "error");
    } else {
      showAlert("Error", error.message, "error");
    }
  }
};

if (signUpBtn) signUpBtn.addEventListener('click', signUp);


// --- SignIn Logic ---
const signIn = async () => {
  if (!signInEmail.value.trim() || !signInPass.value.trim()) {
    showAlert("Validation Error", "Please enter both email and password.", "warning");
    return;
  }

  const email = signInEmail.value.trim();
  const password = signInPass.value.trim();

  Swal.fire({
    title: 'Authenticating...',
    text: 'Checking credentials, please wait.',
    allowOutsideClick: false,
    didOpen: () => {
      Swal.showLoading();
    }
  });

  try {
    await signInWithEmailAndPassword(auth, email, password);

    Swal.fire({
      title: "Welcome Back!",
      text: "Logged in successfully.",
      icon: "success",
      timer: 1500,
      showConfirmButton: false
    });

    setTimeout(async () => {
      const profile = await getUserProfile(auth.currentUser.uid);
      redirectByRole(profile?.Role || signInRole.value);
    }, 1500);

  } catch (error) {
    console.error("SignIn Error:", error);

    if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
      showAlert("Login Failed", "Invalid email or password. Please try again.", "error");
    } else {
      showAlert("Error", error.message, "error");
    }
  }
};

if (signInBtn) signInBtn.addEventListener('click', signIn);


// --- Google Auth Logic ---
const continueWithGoogle = async () => {
  const provider = new GoogleAuthProvider();

  Swal.fire({
    title: 'Connecting Google...',
    text: 'Please authenticate via the popup window.',
    allowOutsideClick: false,
    didOpen: () => {
      Swal.showLoading();
    }
  });

  try {
    const result = await signInWithPopup(auth, provider);
    
    const profile = await ensureSocialUserProfile(result.user);

    Swal.fire({
      title: "Success!",
      text: `Welcome, ${result.user.displayName || 'User'}!`,
      icon: "success",
      timer: 1500,
      showConfirmButton: false
    });

    setTimeout(() => redirectByRole(profile.Role), 1500);

  } catch (error) {
    console.error("Google Auth Error:", error);

    if (error.code === 'auth/popup-closed-by-user') {
      showAlert("Cancelled", "Sign-in window closed before completion.", "info");
    } else if (error.code === 'auth/account-exists-with-different-credential') {
      showAlert("Account Conflict", "An account already exists with the same email address but different sign-in credentials.", "warning");
    } else {
      showAlert("Authentication Error", error.message, "error");
    }
  }
};

if (googleBtn_signIn) googleBtn_signIn.addEventListener('click', continueWithGoogle);
if (googleBtn_signUp) googleBtn_signUp.addEventListener('click', continueWithGoogle);


// --- GitHub Auth Logic ---
const continueWithGithub = async () => {
  const provider = new GithubAuthProvider();

  Swal.fire({
    title: 'Connecting GitHub...',
    text: 'Please authenticate via the popup window.',
    allowOutsideClick: false,
    didOpen: () => {
      Swal.showLoading();
    }
  });

  try {
    const result = await signInWithPopup(auth, provider);

    const profile = await ensureSocialUserProfile(result.user);

    Swal.fire({
      title: "Success!",
      text: `Welcome, ${result.user.displayName || 'User'}!`,
      icon: "success",
      timer: 1500,
      showConfirmButton: false
    });

    setTimeout(() => redirectByRole(profile.Role), 1500);

  } catch (error) {
    console.error("GitHub Auth Error:", error);

    if (error.code === 'auth/popup-closed-by-user') {
      showAlert("Cancelled", "Sign-in window closed before completion.", "info");
    } else if (error.code === 'auth/account-exists-with-different-credential') {
      showAlert("Account Conflict", "An account already exists with the same email address but different sign-in credentials.", "warning");
    } else {
      showAlert("Authentication Error", error.message, "error");
    }
  }
};

if (githubBtn_signIn) githubBtn_signIn.addEventListener('click', continueWithGithub);
if (githubBtn_signUp) githubBtn_signUp.addEventListener('click', continueWithGithub);


// --- Auth State Observer ---
onAuthStateChanged(auth, async (user) => {
  const path = window.location.pathname;
  const isAuthPage = path.endsWith("login.html") || path === "/" || path.endsWith("index.html");

  if (user && isAuthPage && !isSignUp) {
    const profile = await getUserProfile(user.uid);
    redirectByRole(profile?.Role || "employee");
  }
});