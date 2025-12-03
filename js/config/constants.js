/**
 * js/config/constants.js
 * 系統常數定義 (權限與選單版)
 */

export const CONSTANTS = {
    // ==================== 系統資訊 ====================
    SYSTEM: {
        NAME: '護理站 AI 排班系統',
        VERSION: '2.0.0',
        BUILD_DATE: '2025-01-01'
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
    // roles: 定義哪些角色可以看到此選單
    // permissions: (選填) 定義需要哪些細部權限
    MENU_STRUCTURE: [
        // --- 一般使用者區塊 (所有人都有) ---
        {
            header: '個人專區',
            items: [
                { label: '主控台', icon: '📊', path: '/dashboard', roles: ['admin', 'manager', 'user'] },
                { label: '查看班表', icon: '📅', path: '/my-schedule', roles: ['admin', 'manager', 'user'] },
                { label: '預班需求', icon: '📝', path: '/pre-schedule', roles: ['admin', 'manager', 'user'] },
                { label: '換班申請', icon: 'mn', path: '/swap-request', roles: ['admin', 'manager', 'user'] }, // 使用 mn icon 代表交換
                { label: '統計報表', icon: '📈', path: '/statistics', roles: ['admin', 'manager', 'user'] },
                { label: '個人設定', icon: '👤', path: '/profile', roles: ['admin', 'manager', 'user'] }
            ]
        },

        // --- 單位管理者區塊 (單位管理者 + 系統管理者) ---
        {
            header: '單位管理',
            roles: ['admin', 'manager'], // 整個區塊的權限
            items: [
                { label: '排班管理', icon: '🗓️', path: '/schedule-management', roles: ['admin', 'manager'] }, // 含手動/AI/規則
                { label: '預班管理', icon: '📋', path: '/pre-schedule-management', roles: ['admin', 'manager'] },
                { label: '換班審核', icon: '✅', path: '/swap-approval', roles: ['admin', 'manager'] },
                { label: '人員管理', icon: '👥', path: '/staff-management', roles: ['admin', 'manager'] }, // 管理單位人員/排班者/組別
                { label: '班別設定', icon: '🕒', path: '/shift-settings', roles: ['admin', 'manager'] } // 單位班別
            ]
        },

        // --- 系統管理者區塊 (僅系統管理者) ---
        {
            header: '系統管理',
            roles: ['admin'],
            items: [
                { label: '單位維護', icon: '🏢', path: '/unit-maintenance', roles: ['admin'] },
                { label: '全域人員', icon: '🌍', path: '/global-staff', roles: ['admin'] }, // 設定單位管理者
                { label: '勞基法規', icon: '⚖️', path: '/labor-law', roles: ['admin'] }, // 2週/4週變形工時
                { label: '假日設定', icon: '🏖️', path: '/holiday-settings', roles: ['admin'] }
            ]
        }
    ],

    // ... (保留原本的 DEFAULT_SHIFTS, LABOR_STANDARDS 等其他常數) ...
    // 請保留原檔案下方的其他設定
    SHIFT_COLORS: { '大': '#E9D5FF', '小': '#C7D2FE', '白': '#FEF3C7', 'DL': '#FED7AA', 'FF': '#BBF7D0', 'OFF': '#BBF7D0' },
    WEEKDAYS: { 0: '週日', 1: '週一', 2: '週二', 3: '週三', 4: '週四', 5: '週五', 6: '週六' },
    WEEKDAYS_SHORT: ['日', '一', '二', '三', '四', '五', '六']
};
