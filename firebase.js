// MultipleFiles/firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut, signInWithEmailAndPassword, createUserWithEmailAndPassword }
  from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { getFirestore, collection, doc, getDoc, getDocs, addDoc, setDoc, deleteDoc,
         query, where, orderBy, serverTimestamp, onSnapshot, writeBatch, FieldValue }
  from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

// === YOUR FIREBASE CONFIG ===
const firebaseConfig = {
  apiKey: "AIzaSyBU7SRrijoXJzNJdOhQLmSh_9mdoklxLPA",
  authDomain: "travel-planner-bbd7b.firebaseapp.com",
  projectId: "travel-planner-bbd7b",
  storageBucket: "travel-planner-bbd7b.firebasestorage.app",
  messagingSenderId: "901740451346",
  appId: "1:901740451346:web:b0cb6372d6a7432e932acb"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db   = getFirestore(app);
export const provider = new GoogleAuthProvider();

// Re-export all necessary Firebase functions for modular use
export {
  collection, doc, getDoc, getDocs, addDoc, setDoc, deleteDoc,
  query, where, orderBy, serverTimestamp, writeBatch, FieldValue,
  onAuthStateChanged, signInWithPopup, signOut, onSnapshot, signInWithEmailAndPassword, createUserWithEmailAndPassword
};

