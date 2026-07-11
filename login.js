import { auth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, doc, db, setDoc, GoogleAuthProvider, signInWithPopup, GithubAuthProvider } from "./firrebaseConfig.js";

// --- DOM Elements ---
// SignUp Inputs
const fullName = document.querySelector('#signup-name');
const userRole = document.querySelector('#signup-role');
const signUpEmail = document.querySelector('#signup-email');
const signUpPass = document.querySelector('#signup-password');
const signUpBtn = document.querySelector('#signup-btn');

// SignIn Inputs
const signInEmail = document.querySelector('#signin-email');
const signInPass = document.querySelector('#signin-pass');
const signInBtn = document.querySelector('#signin-btn'); // Ensure your HTML login button has id="signin-btn"

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
  // 1. Input Validation (Checking for empty fields)
  if (!fullName.value.trim() || !userRole.value || !signUpEmail.value.trim() || !signUpPass.value.trim()) {
    showAlert("Validation Error", "All fields are required. Please fill out the form completely.", "warning");
    return;
  }

  // 2. Password Strength Validation
  if (signUpPass.value.length < 6) {
    showAlert("Weak Password", "Password must be at least 6 characters long.", "warning");
    return;
  }

  isSignUp = true; // Prevents the auth listener from conflicting during redirection

  const email = signUpEmail.value.trim();
  const password = signUpPass.value.trim();
  const userData = {
    FullName: fullName.value.trim(),
    Email: email,
    Role: userRole.value
  };

  // Show Loading Spinner
  Swal.fire({
    title: 'Creating Account...',
    text: 'Please wait while we set up your profile.',
    allowOutsideClick: false,
    didOpen: () => {
      Swal.showLoading();
    }
  });

  try {
    // Step 1: Create user in Firebase Authentication
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const userId = userCredential.user.uid;

    // Step 2: Store user data in Firestore
    await setDoc(doc(db, "users", userId), {
      ...userData,
      userId: userId
    });

    // Step 3: Success Notification
    Swal.fire({
      title: "Success!",
      text: "Your account has been created successfully.",
      icon: "success",
      timer: 2000,
      showConfirmButton: false
    });

    // Redirect after 2 seconds
    setTimeout(() => {
      window.location.href = 'dashboard.html';
    }, 2000);

  } catch (error) {
    isSignUp = false;
    console.error("SignUp Error:", error);

    // Handle Firebase specific error codes
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
  // 1. Input Validation
  if (!signInEmail.value.trim() || !signInPass.value.trim()) {
    showAlert("Validation Error", "Please enter both email and password.", "warning");
    return;
  }

  const email = signInEmail.value.trim();
  const password = signInPass.value.trim();

  // Show Loading Spinner
  Swal.fire({
    title: 'Authenticating...',
    text: 'Checking credentials, please wait.',
    allowOutsideClick: false,
    didOpen: () => {
      Swal.showLoading();
    }
  });

  try {
    // Sign user in
    await signInWithEmailAndPassword(auth, email, password);

    // Success Notification
    Swal.fire({
      title: "Welcome Back!",
      text: "Logged in successfully.",
      icon: "success",
      timer: 1500,
      showConfirmButton: false
    });

    // Redirect after 1.5 seconds
    setTimeout(() => {
      window.location.href = 'dashboard.html';
    }, 1500);

  } catch (error) {
    console.error("SignIn Error:", error);

    // Handle Firebase specific login errors
    if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
      showAlert("Login Failed", "Invalid email or password. Please try again.", "error");
    } else {
      showAlert("Error", error.message, "error");
    }
  }
};

if (signInBtn) signInBtn.addEventListener('click', signIn);





//  google sign up and sign in

let googleBtn_signIn = document.querySelector("#google-signin");
let googleBtn_signUp = document.querySelector("#google-signup");

const continueWithGoogle = () => {
  
  const provider = new GoogleAuthProvider();

  signInWithPopup(auth, provider)
    .then((result) => {
      // This gives you a Google Access Token. You can use it to access the Google API.
      const credential = GoogleAuthProvider.credentialFromResult(result);
      const token = credential.accessToken;
      // The signed-in user info.
      const user = result.user;
      // IdP data available using getAdditionalUserInfo(result)
      // ...
    }).catch((error) => {
      // Handle Errors here.
      const errorCode = error.code;
      const errorMessage = error.message;
      // The email of the user's account used.
      const email = error.customData.email;
      // The AuthCredential type that was used.
      const credential = GoogleAuthProvider.credentialFromError(error);
      console.log(error)
      // ...
    });


}


googleBtn_signIn.addEventListener('click', continueWithGoogle)
googleBtn_signUp.addEventListener('click', continueWithGoogle)



//   Github  Login and sign up




let githubBtn_signIn = document.querySelector("#github-signin");
let githubBtn_signUp = document.querySelector("#github-signup");

const provider = new GithubAuthProvider();

const continueWithGithub = () => {

  const provider = new GithubAuthProvider();

  signInWithPopup(auth, provider)
    .then((result) => {
      // This gives you a GitHub Access Token. You can use it to access the GitHub API.
      const credential = GithubAuthProvider.credentialFromResult(result);
      const token = credential.accessToken;

      // The signed-in user info.
      const user = result.user;
      // IdP data available using getAdditionalUserInfo(result)
      // ...
    }).catch((error) => {
      // Handle Errors here.
      const errorCode = error.code;
      const errorMessage = error.message;
      // The email of the user's account used.
      const email = error.customData.email;
      // The AuthCredential type that was used.
      const credential = GithubAuthProvider.credentialFromError(error);
      // ...
    });
}


githubBtn_signIn.addEventListener('click', continueWithGithub)
githubBtn_signUp.addEventListener('click', continueWithGithub)







// --- Auth State Observer ---
onAuthStateChanged(auth, (user) => {
  const path = window.location.pathname;
  const isAuthPage = path.endsWith("login.html") || path === "/" || path.endsWith("index.html");

  if (user && isAuthPage && !isSignUp) {
    window.location.replace("dashboard.html");
  }
});