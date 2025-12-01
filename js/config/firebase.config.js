/**
 * js/config/firebase.config.js
 * Firebase 配置 (ES Module 版)
 */

export const FIREBASE_CONFIG = {
    // ==================== Firebase 專案配置 ====================
    // 請至 Firebase Console > Project Settings > General 取得
    config: {
        apiKey: "AIzaSyA2B_rDKi7JyLaYpJd-lfFNXZ1BJUzpu-k",
        authDomain: "nursing-schedule-2f9c8.firebaseapp.com",
        projectId: "nursing-schedule-2f9c8",
        storageBucket: "nursing-schedule-2f9c8.firebasestorage.app",
        messagingSenderId: "561144664580",
        appId: "1:561144664580:web:3d4397a5cbd7f788b1db51",
        measurementId: "G-V0DBP9RZ7P"
    },

    // ==================== Firestore 集合名稱 ====================
    collections: {
        USERS: 'users',
        UNITS: 'units',
        SYSTEM_CONFIG: 'system_config',
        NOTIFICATIONS: 'notifications',
        AUDIT_LOGS: 'audit_logs'
    },

    // ==================== Demo 模式設定 ====================
    demo: {
        // ⚠️ 建議設為 false，以便測試您剛剛在 Firebase 後台建立的真實帳號
        enabled: false,  
        
        // Demo 使用者資料 (僅供參考或 Demo 模式開啟時使用)
        users: [
            {
                email: 'admin@hospital.com',
                password: 'demo123',
                displayName: '系統管理員',
                role: 'admin',
                unit_id: null
            },
            {
                email: 'scheduler@hospital.com',
                password: 'demo123',
                displayName: '排班負責人',
                role: 'scheduler',
                unit_id: 'unit_9b'
            },
            {
                email: 'user@hospital.com',
                password: 'demo123',
                displayName: '一般護理師',
                role: 'viewer',
                unit_id: 'unit_9b'
            }
        ]
    }
};