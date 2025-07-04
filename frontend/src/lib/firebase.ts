// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDn8cytBf4yziTmLqXeNJzw2WdIlZrgCIk",
  authDomain: "vestika-92a0a.firebaseapp.com",
  projectId: "vestika-92a0a",
  storageBucket: "vestika-92a0a.firebasestorage.app",
  messagingSenderId: "962053007917",
  appId: "1:962053007917:web:7b262da81e832a3b6c66a4",
  measurementId: "G-W3B5H0X6YZ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

export { app, analytics }; 