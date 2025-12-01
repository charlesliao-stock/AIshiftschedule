/**
 * Google Apps Script API 端點配置
 * 部署 Apps Script 後，請將 URL 更新到此處
 */

const API_CONFIG = {
    // ==================== Apps Script Web App URL ====================
    // 部署 Apps Script 為 Web App 後，會獲得一個 URL
    // 格式: https://script.google.com/macros/s/{SCRIPT_ID}/exec

    
    baseUrl: 'https://script.google.com/macros/s/AKfycbwFgjSHAwzPgJh0UMhKw_HGZG-09Q6BOZ55LdlvmrDv9VIPpVkzkaFZbLD67aUQvjE/exec',
timeout: 30000,
settings: 'https://script.google.com/macros/s/AKfycbwFgjSHAwzPgJh0UMhKw_HGZG-09Q6BOZ55LdlvmrDv9VIPpVkzkaFZbLD67aUQvjE/exec',

    // ==================== API 端點 ====================
    endpoints: {
        // 設定檔 API
        settings: {
            getShifts: '/api/settings/shifts',
            saveShifts: '/api/settings/shifts',
            getGroups: '/api/settings/groups',
            saveGroups: '/api/settings/groups',
            getStaff: '/api/settings/staff',
            saveStaff: '/api/settings/staff',
            getRules: '/api/settings/rules',
            saveRules: '/api/settings/rules',
            getHolidays: '/api/settings/holidays',
            saveHolidays: '/api/settings/holidays',
            getNotifications: '/api/settings/notifications',
            saveNotifications: '/api/settings/notifications',
            getLaborStandards: '/api/settings/labor-standards',
            saveLaborStandards: '/api/settings/labor-standards'
        },
        
        // 預班表 API
        preSchedule: {
            get: '/api/pre-schedule/get',
            save: '/api/pre-schedule/save',
            getConfig: '/api/pre-schedule/config',
            saveConfig: '/api/pre-schedule/config',
            check: '/api/pre-schedule/check',
            submit: '/api/pre-schedule/submit'
        },
        
        // 排班表 API
        schedule: {
            get: '/api/schedule/get',
            save: '/api/schedule/save',
            publish: '/api/schedule/publish',
            getHistory: '/api/schedule/history',
            saveHistory: '/api/schedule/history'
        },
        
        // 換班 API
        swap: {
            request: '/api/swap/request',
            approve: '/api/swap/approve',
            reject: '/api/swap/reject',
            getHistory: '/api/swap/history'
        },
        
        // 統計 API
        statistics: {
            personal: '/api/statistics/personal',
            unit: '/api/statistics/unit',
            export: '/api/statistics/export'
        },
        
        // 單位管理 API
        unit: {
            create: '/api/unit/create',
            update: '/api/unit/update',
            delete: '/api/unit/delete',
            list: '/api/unit/list'
        },
        
        // 通知 API
        notification: {
            send: '/api/notification/send',
            sendBatch: '/api/notification/send-batch'
        },
        
        // 備份 API
        backup: {
            create: '/api/backup/create',
            restore: '/api/backup/restore',
            list: '/api/backup/list'
        }
    },
    
    // ==================== 請求配置 ====================
    request: {
        timeout: 30000,         // 30 秒
        retryTimes: 3,          // 重試 3 次
        retryDelay: 1000,       // 重試延遲 1 秒
        headers: {
            'Content-Type': 'application/json'
        }
    },
    
    // ==================== Demo 模式 ====================
    demo: {
        enabled: true,  // 是否啟用 Demo 模式
        // Demo 模式下，API 請求會被攔截並返回模擬資料
        mockDelay: 500  // 模擬網路延遲 (毫秒)
    }
};

// 讓配置可在全域使用
if (typeof window !== 'undefined') {
    window.API_CONFIG = API_CONFIG;
}