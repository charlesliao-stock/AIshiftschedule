/**
 * js/config/api.config.js
 * Google Apps Script API 端點配置 (ES Module 版)
 */

export const API_CONFIG = {
    // ==================== 核心配置 ====================
    
    // 您的 Google Apps Script 部署網址 (Backend URL)
    BASE_URL: 'https://script.google.com/macros/s/AKfycbwFgjSHAwzPgJh0UMhKw_HGZG-09Q6BOZ55LdlvmrDv9VIPpVkzkaFZbLD67aUQvjE/exec',
    
    // 預設請求超時 (毫秒)
    TIMEOUT: 30000,
    
    // 開發測試用的 Sheet ID (當 Firebase 尚未建立單位資料時使用)
    TEST_SHEET_ID: "1wq-GLwB4kwogmpXWk52tuAKT17ta710GKx5s4j6B3zk",

    // ==================== API 動作定義 (Endpoints) ====================
    // 這些字串會對應到 GAS 後端 doGet/doPost 中的 action 參數
    
    ENDPOINTS: {
        // 系統測試
        TEST_CONNECTION: 'testConnection',

        // 單位管理 (Unit)
        UNIT: {
            LIST: 'getUnitList',
            CREATE: 'createUnit',
            UPDATE: 'updateUnit',
            DELETE: 'deleteUnit',
            INIT_SHEETS: 'initializeUnitSheets'
        },

        // 設定相關 (Settings)
        SETTINGS: {
            GET_SHIFTS: 'getShifts',
            SAVE_SHIFTS: 'saveShifts',
            GET_GROUPS: 'getGroups',
            SAVE_GROUPS: 'saveGroups',
            GET_STAFF: 'getStaff',
            SAVE_STAFF: 'saveStaff',
            GET_RULES: 'getRules',
            SAVE_RULES: 'saveRules',
            GET_HOLIDAYS: 'getHolidays',
            SAVE_HOLIDAYS: 'saveHolidays',
            GET_LABOR_STANDARDS: 'getLaborStandards',
            SAVE_LABOR_STANDARDS: 'saveLaborStandards'
        },
        
        // 預班相關 (Pre-Schedule) - Week 5 重點
        PRE_SCHEDULE: {
            GET: 'getPreSchedule',
            SAVE: 'savePreSchedule',
            GET_CONFIG: 'getPreScheduleConfig',
            SUBMIT: 'submitPreSchedule',
            CHECK_CONFLICTS: 'checkPreScheduleConflicts'
        },
        
        // 排班相關 (Schedule)
        SCHEDULE: {
            GET: 'getSchedule',
            SAVE: 'saveSchedule',
            PUBLISH: 'publishSchedule',
            GET_HISTORY: 'getScheduleHistory'
        },
        
        // 統計相關
        STATISTICS: {
            PERSONAL: 'getPersonalStats',
            UNIT: 'getUnitStats'
        }
    },
    
    // ==================== 請求行為配置 ====================
    REQUEST: {
        TIMEOUT: 30000,
        RETRY_TIMES: 3,
        RETRY_DELAY: 1000,
        HEADERS: {
            'Content-Type': 'text/plain;charset=utf-8' // 避免 GAS CORS 預檢問題
        }
    },
    
    // ==================== Demo 模式 ====================
    DEMO: {
        // ⚠️ 設定為 false 以連接真實的 Google Sheets
        // 若設為 true，Service 層會攔截請求並回傳假資料
        ENABLED: false, 
        MOCK_DELAY: 500
    }
};