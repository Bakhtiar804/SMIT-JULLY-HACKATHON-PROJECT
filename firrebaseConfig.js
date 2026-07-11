
// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-analytics.js";
import { getAuth, createUserWithEmailAndPassword , signInWithEmailAndPassword , onAuthStateChanged , GoogleAuthProvider  , signInWithPopup , GithubAuthProvider } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import { getFirestore, doc, setDoc } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
    apiKey: "AIzaSyCpDcuHFQ34BR9IpYuf9DRJKN_YXBL1-qs",
    authDomain: "smit-hackathon-5fa78.firebaseapp.com",
    projectId: "smit-hackathon-5fa78",
    storageBucket: "smit-hackathon-5fa78.firebasestorage.app",
    messagingSenderId: "252337877199",
    appId: "1:252337877199:web:039bbe2ad37eabfde047ba",
    measurementId: "G-5ZGLLL7P19"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);


export {
    auth,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    onAuthStateChanged,
    GoogleAuthProvider ,
    signInWithPopup,
    GithubAuthProvider ,
    db,
    doc,
    setDoc

}