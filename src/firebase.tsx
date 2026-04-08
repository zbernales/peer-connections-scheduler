// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from 'firebase/firestore';
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDIu9PM1tX1hOHriZJ89D11XHl4jl5CLRc",
  authDomain: "peer-connections-scheduler.firebaseapp.com",
  projectId: "peer-connections-scheduler",
  storageBucket: "peer-connections-scheduler.firebasestorage.app",
  messagingSenderId: "753554740314",
  appId: "1:753554740314:web:fad328c11c190f3b4c7463",
  measurementId: "G-FE90NH3D30"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
export const db = getFirestore(app);