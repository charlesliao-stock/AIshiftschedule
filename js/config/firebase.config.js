import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getFirestore, 
    collection, 
    doc, 
    getDoc, 
    getDocs, 
    setDoc, 
    addDoc, 
    updateDoc, 
    deleteDoc, 
    query, 
    where, 
    orderBy,
    arrayUnion,
    arrayRemove,
    Timestamp 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyA2B_rDKi7JyLaYpJd-lfFNXZ1BJUzpu-k",
    authDomain: "nursing-schedule-2f9c8.firebaseapp.com",
    projectId: "nursing-schedule-2f9c8",
    storageBucket: "nursing-schedule-2f9c8.firebasestorage.app",
    messagingSenderId: "561144664580",
    appId: "1:561144664580:web:3d4397a5cbd7f788b1db51",
    measurementId: "G-V0DBP9RZ7P"
};

// 1. 先宣告變數，確保 export 時變數存在
let app;
let db;
let auth;

// 2. 嘗試初始化
try {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
    console.log("✅ Firebase Config Initialized: Auth & DB ready");
} catch (error) {
    console.error("❌ Firebase Config Init Error:", error);
}

// 3. 統一匯出 (這就是其他檔案 import { auth } 的來源)
export { 
    app, 
    db, 
    auth,
    // Firestore helpers 導出供 Service 使用
    collection, 
    doc, 
    getDoc, 
    getDocs, 
    setDoc, 
    addDoc, 
    updateDoc, 
    deleteDoc, 
    query, 
    where, 
    orderBy,
    arrayUnion,
    arrayRemove,
    Timestamp 
};
