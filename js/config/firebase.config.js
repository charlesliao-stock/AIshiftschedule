/**
 * Firebase 配置
 * 請替換為您的 Firebase 專案配置
 */

const FIREBASE_CONFIG = {
    // ==================== Firebase 專案配置 ====================
    // 請至 Firebase Console > Project Settings > General 取得
    config: {
  const firebaseConfig = {
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
        enabled: true,  // 是否啟用 Demo 模式 (開發測試用)
        
        // Demo 使用者
        users: [
            {
                email: 'admin@hospital.com',
                password: 'demo123',
                displayName: '系統管理員',
                role: 'admin',
                unit_id: null,
                unit_name: '系統管理',
                permissions: {
                    canEditSchedule: true,
                    canViewAllUnits: true,
                    canManageUsers: true
                }
            },
            {
                email: 'scheduler@hospital.com',
                password: 'demo123',
                displayName: '排班負責人',
                role: 'scheduler',
                unit_id: 'unit_9b',
                unit_name: '9B病房',
                permissions: {
                    canEditSchedule: true,
                    canViewAllUnits: false,
                    canManageUsers: false
                }
            },
            {
                email: 'user@hospital.com',
                password: 'demo123',
                displayName: '一般護理師',
                role: 'viewer',
                unit_id: 'unit_9b',
                unit_name: '9B病房',
                permissions: {
                    canEditSchedule: false,
                    canViewAllUnits: false,
                    canManageUsers: false
                }
            }
        ]
    }
};

// 讓配置可在全域使用
if (typeof window !== 'undefined') {
    window.FIREBASE_CONFIG = FIREBASE_CONFIG;
}