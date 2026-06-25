import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions"; // ← add this

const firebaseConfig = {
    apiKey: "AIzaSyDVFLPtTmRW7ZF_K8beJT10orGjg4QX00M",
    authDomain: "unitcheck-350d9.firebaseapp.com",
    projectId: "unitcheck-350d9",
    storageBucket: "unitcheck-350d9.firebasestorage.app",
    messagingSenderId: "37238655509",
    appId: "1:37238655509:web:348df84d53f7a409a05c1c",
    measurementId: "G-6NSGB1ZEKX"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app); // ← add this