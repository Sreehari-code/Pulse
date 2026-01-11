import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyDk0PvmBpQ-i6WTqIpXqw8T_aF1dosdf6I",
  authDomain: "social-media-app-5b68c.firebaseapp.com",
  projectId: "social-media-app-5b68c",
  storageBucket: "social-media-app-5b68c.firebasestorage.app",
  messagingSenderId: "659999884216",
  appId: "1:659999884216:web:108c9754b9e197b4c5c54d"
};

const app = getApps().length === 0
  ? initializeApp(firebaseConfig)
  : getApp();


// const db = getFirestore(app);


  
// Enable offline persistence
// enablePersistence(db)
//   .then(() => {
//     // Offline persistence enabled successfully
//     console.log("Offline persistence enabled.");
//   })
//   .catch((err) => {
//     if (err.code == 'failed-precondition') {
//       // Multiple tabs open, persistence can only be enabled in one tab at a time.
//       console.log("Failed to enable persistence: multiple tabs open.");
//     } else if (err.code == 'unimplemented') {
//       // The current browser does not support all of the features required to enable persistence.
//       console.log("Failed to enable persistence: browser not supported.");
//     } else {
//       console.error("Error enabling persistence:", err);
//     }
//   });

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);













// Your Firestore data operations can now proceed
