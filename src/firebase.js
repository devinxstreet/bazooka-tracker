import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDJjxqcCNd7bontsZIORvU_3KxDd8cpHjU",
  authDomain: "bazooka-tracker.firebaseapp.com",
  projectId: "bazooka-tracker",
  storageBucket: "bazooka-tracker.firebasestorage.app",
  messagingSenderId: "987531453458",
  appId: "1:987531453458:web:04cbe23b4572a0e918e4cb",
  measurementId: "G-1FE0HCW27Q"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
