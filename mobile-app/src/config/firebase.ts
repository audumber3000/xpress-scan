import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyC2PYO215vYai_m8Ug1V_OE482pe9NBm9g",
  authDomain: "betterclinic-f1179.firebaseapp.com",
  projectId: "betterclinic-f1179",
  storageBucket: "betterclinic-f1179.firebasestorage.app",
  messagingSenderId: "101419773058",
  appId: "1:101419773058:web:e90bb2a0de4630740f189b",
  measurementId: "G-SENE7C54YR"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
