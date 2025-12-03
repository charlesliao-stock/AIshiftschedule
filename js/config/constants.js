/**
 * js/config/constants.js
 * 系統常數定義 (權限、選單、儲存鍵值)
 */

export const CONSTANTS = {
    // ==================== 系統資訊 ====================
    SYSTEM: {
        NAME: '護理站 AI 排班系統',
        VERSION: '2.0.0',
        BUILD_DATE: '2025-12-03'
    },

    // ==================== 儲存鍵值 (關鍵修正) ====================
    // Auth 與 Storage 模組依賴此設定
    STORAGE_KEYS: {
        USER: 'app_user',                 // 使用者資訊
        TOKEN: 'app_token',               // Auth Token
        SETTINGS: 'app_settings',         // 個人設定
        THEME: 'app_theme',               // 佈景主題
        SIDEBAR_COLLAPSED: 'sidebar_collapsed', // 側邊欄狀態
        CUSTOM_API_URL: 'app_custom_api_url',   // 開發用：自訂 API 網址
        CUSTOM_SHEET_ID: 'app_custom_sheet_id'  // 開發用：自訂 Sheet ID
    },

    // ==================== 角色定義 ====================
    ROLES: {
        ADMIN: 'admin',       // 系統管理者
        MANAGER: 'manager',   // 單位管理者 (含排班功能)
        USER: 'user'          // 一般使用者
    },

    ROLE_NAMES: {
        admin: '系統管理者',
        manager: '單位管理者',
        user: '一般使用者'
    },

    // ==================== 選單結構配置 ====================
    MENU_STRUCTURE: [
        // --- 一般使用者區塊 ---
        {
            header: '個人專區',
            items: [
                { label: '主控台', icon: '📊', path: '/dashboard', roles: ['admin', 'manager', 'user'] },
                { label: '查看班表', icon: '📅', path: '/my-schedule', roles: ['admin', 'manager', 'user'] },
                { label: '預班需求', icon: '📝', path: '/pre-schedule', roles: ['admin', 'manager', 'user'] },
                { label: '換班申請', icon: '🔁', path: '/swap-request', roles: ['admin', 'manager', 'user'] },
                { label: '統計報表', icon: '📈', path: '/statistics', roles: ['admin', 'manager', 'user'] },
                { label: '個人設定', icon: '👤', path: '/profile', roles: ['admin', 'manager', 'user'] }
            ]
        },

        // --- 單位管理者區塊 ---
        {
            header: '單位管理',
            roles: ['admin', 'manager'],
            items: [
                { label: '排班管理', icon: '🗓️', path: '/schedule-management', roles: ['admin', 'manager'] },
                { label: '預班管理', icon: '📋', path: '/pre-schedule-management', roles: ['admin', 'manager'] },
                { label: '換班審核', icon: '✅', path: '/swap-approval', roles: ['admin', 'manager'] },
                { label: '人員管理', icon: '👥', path: '/staff-management', roles: ['admin', 'manager'] },
                { label: '班別設定', icon: '🕒', path: '/shift-settings', roles: ['admin', 'manager'] }
            ]
        },

        // --- 系統管理者區塊 ---
        {
            header: '系統管理',
            roles: ['admin'],
            items: [
                { label: '單位維護', icon: '🏢', path: '/unit-maintenance', roles: ['admin'] },
                { label: '全域人員', icon: '🌍', path: '/global-staff', roles: ['admin'] },
                { label: '勞基法規', icon: '⚖️', path: '/labor-law', roles: ['admin'] },
                { label: '假日設定', icon: '🏖️', path: '/holiday-settings', roles: ['admin'] }
            ]
        }
    ],

    // ==================== 班別與顯示設定 ====================
    SHIFT_COLORS: { 
        'D': '#E9D5FF',   // 白班
        'E': '#C7D2FE',   // 小夜
        'N': '#FEF3C7',   // 大夜
        'OFF': '#BBF7D0', // 休假
        'DL': '#FED7AA'   // 積休
    },

    WEEKDAYS: { 0: '週日', 1: '週一', 2: '週二', 3: '週三', 4: '週四', 5: '週五', 6: '週六' },
    WEEKDAYS_SHORT: ['日', '一', '二', '三', '四', '五', '六']
};
