// src/firebase.js
// Firebase 초기화 및 인증/DB 인스턴스 export

import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDpeVlnMbX4qqudyNRF-temY8rvfsMXuHg",
  authDomain: "lumi-nail-c-r-m-he3j2j.firebaseapp.com",
  projectId: "lumi-nail-c-r-m-he3j2j",
  storageBucket: "lumi-nail-c-r-m-he3j2j.firebasestorage.app",
  messagingSenderId: "1066964090227",
  appId: "1:1066964090227:web:fd952f315629e371b91906"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db   = getFirestore(app);
