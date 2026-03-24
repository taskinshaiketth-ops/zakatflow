import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";

// ═══════════════════════════════════════════════════
// PASTE YOUR FIREBASE CONFIG HERE (from Firebase Console)
// ═══════════════════════════════════════════════════
const firebaseConfig = {
  apiKey: "AIzaSyDNqhiA0Ba_EOXSOOri0U-PGH1swjdD1BY",
  authDomain: "zakatflow-6e23e.firebaseapp.com",
  projectId: "zakatflow-6e23e",
  storageBucket: "zakatflow-6e23e.firebasestorage.app",
  messagingSenderId: "835839813289",
  appId: "1:835839813289:web:2adcf9bfbb5ce49e176bb8"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

export { auth, googleProvider, signInWithPopup, signOut, onAuthStateChanged };