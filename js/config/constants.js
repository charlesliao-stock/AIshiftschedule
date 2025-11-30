/**
 * 護理站 AI 排班系統 - 系統常數
 * 定義所有系統使用的常數
 */

const CONSTANTS = {
    // ==================== 系統資訊 ====================
    SYSTEM: {
        NAME: '護理站 AI 排班系統',
        VERSION: '1.0.0',
        BUILD_DATE: '2025-01-01',
        AUTHOR: 'AI Development Team'
    },

    // ==================== 使用者角色 ====================
    ROLES: {
        ADMIN: 'admin',           // 管理者
        SCHEDULER: 'scheduler',   // 排班者
        VIEWER: 'viewer'          // 一般使用者
    },

    ROLE_NAMES: {
        admin: '管理者',
        scheduler: '排班者',
        viewer: '一般使用者'
    },

    // ==================== 權限定義 ====================
    PERMISSIONS: {
        // 檢視權限
        VIEW_ALL_UNITS: 'view_all_units',
        VIEW_OWN_UNIT: 'view_own_unit',
        VIEW_SCHEDULE: 'view_schedule',
        VIEW_PRE_SCHEDULE: 'view_pre_schedule',
        VIEW_STATISTICS: 'view_statistics',
        
        // 編輯權限
        EDIT_SCHEDULE: 'edit_schedule',
        EDIT_PRE_SCHEDULE: 'edit_pre_schedule',
        EDIT_SETTINGS: 'edit_settings',
        EDIT_STAFF: 'edit_staff',
        
        // 管理權限
        MANAGE_UNITS: 'manage_units',
        MANAGE_USERS: 'manage_users',
        MANAGE_SYSTEM: 'manage_system',
        
        // 功能權限
        USE_AI_SCHEDULE: 'use_ai_schedule',
        APPROVE_SWAP: 'approve_swap',
        PUBLISH_SCHEDULE: 'publish_schedule',
        EXPORT_REPORT: 'export_report'
    },

    // ==================== 班別相關 ====================
    DEFAULT_SHIFTS: [
        { id: 1, name: '大夜', code: '大', startTime: '22:00', endTime: '08:00', color: '#E9D5FF', countToStats: true, order: 2 },
        { id: 2, name: '小夜', code: '小', startTime: '14:00', endTime: '22:00', color: '#C7D2FE', countToStats: true, order: 4 },
        { id: 3, name: '白班', code: '白', startTime: '08:00', endTime: '16:00', color: '#FEF3C7', countToStats: true, order: 3 },
        { id: 4, name: 'DL', code: 'DL', startTime: '14:00', endTime: '22:00', color: '#FED7AA', countToStats: true, order: 4 },
        { id: 5, name: '休假', code: 'FF', startTime: '', endTime: '', color: '#BBF7D0', countToStats: false, order: 1 }
    ],

    SHIFT_COLORS: {
        '大': '#E9D5FF',
        '小': '#C7D2FE',
        '白': '#FEF3C7',
        'DL': '#FED7AA',
        'FF': '#BBF7D0',
        'OFF': '#BBF7D0'
    },

    // ==================== 組別相關 ====================
    DEFAULT_GROUPS: [
        { id: 1, name: '資深組', totalStaff: 5, minPerShift: 1, maxPerShift: 3, description: '' },
        { id: 2, name: '中階組', totalStaff: 4, minPerShift: 1, maxPerShift: 2, description: '' },
        { id: 3, name: '資淺組', totalStaff: 4, minPerShift: 0, maxPerShift: 2, description: '' }
    ],

    // ==================== 排班規則 ====================
    DEFAULT_RULES: {
        // 基本規則
        MONTHLY_OFF_DAYS: 8,                    // 本月應放天數
        DAILY_PRE_SCHEDULE_LIMIT: 'dynamic',   // 每日可預人數 (動態計算)
        HOLIDAY_PRE_SCHEDULE_LIMIT: 2,         // 假日可預天數
        MONTHLY_PRE_SCHEDULE_LIMIT: 'dynamic', // 全月可預天數 (動態計算)
        AVERAGE_OFF_DAYS: 8.4,                 // 平均假日 (統計用)
        
        // 包班規則
        PACKAGE_MIN_DAYS: 16,                  // 包班最少天數
        ENABLE_PACKAGE_RULE: true,             // 啟用包班規則
        
        // 接班規則
        ENABLE_SHIFT_ORDER: true,              // 啟用接班順序規則
        SHIFT_ORDER: ['FF', '大', '白', '小', 'DL'], // 班別順序
        
        // 特殊規則
        ENABLE_FF_NO_NIGHT: true,              // 啟用 FF 後不接大夜 (包班者不受限)
        
        // 假日規則
        HOLIDAY_LIMIT_FORMULA: 'Math.floor(假日數/2)', // 假日上限計算
        
        // 預班規則
        OFF_COUNT_TO_LIMIT: true,              // OFF 列入預班限額
        OTHER_SHIFT_COUNT_TO_LIMIT: false,     // 其他班列入預班限額
        
        // 換班規則
        SWAP_OPEN_DAYS: 7,                     // 換班開放天數 (公告後N天)
        SWAP_COUNT_TO_STATS: true              // 列入換班統計
    },

    // ==================== 勞基法規範 ====================
    LABOR_STANDARDS: {
        // 四週變形工時
        FOUR_WEEK_FLEX: {
            name: '四週變形工時',
            dailyHours: 10,        // 每日正常工時上限
            weeklyHours: 48,       // 每週工時上限
            fourWeekHours: 160,    // 四週工時上限
            restPerSevenDays: 1    // 每七日至少休息一日
        },
        
        // 兩週變形工時
        TWO_WEEK_FLEX: {
            name: '兩週變形工時',
            dailyHours: 10,
            weeklyHours: 48,
            twoWeekHours: 80,
            restPerSevenDays: 1
        },
        
        // 一般規定 (無變形)
        GENERAL: {
            name: '一般規定',
            dailyHours: 8,
            weeklyHours: 40,
            restBetweenShifts: 11, // 連續休息時間 (小時)
            restPerSevenDays: 1
        }
    },

    // ==================== 通知類型 ====================
    NOTIFICATION_TYPES: {
        PRE_SCHEDULE_OPEN: 'pre_schedule_open',           // 預班開放
        PRE_SCHEDULE_DEADLINE: 'pre_schedule_deadline',   // 預班即將截止
        PRE_SCHEDULE_CONFLICT: 'pre_schedule_conflict',   // 預班衝突
        SCHEDULE_PUBLISHED: 'schedule_published',         // 排班已公告
        SWAP_REQUEST: 'swap_request',                     // 換班申請
        SWAP_APPROVED: 'swap_approved',                   // 換班審核結果
        SCHEDULE_CHANGED: 'schedule_changed'              // 班表異動
    },

    NOTIFICATION_CHANNELS: {
        EMAIL: 'email',
        LINE: 'line',
        TEAMS: 'teams'
    },

    // ==================== AI 排班優先順序 ====================
    AI_PRIORITIES: {
        1: {
            key: 'pre_schedule',
            name: '預班內容',
            description: '必須遵守員工的預班需求',
            mandatory: true
        },
        2: {
            key: 'group_balance',
            name: '組別配置平衡',
            description: '確保每班都有適當的資深/資淺人員比例'
        },
        3: {
            key: 'package_rule',
            name: '包班規則',
            description: '優先滿足包班人員的需求'
        },
        4: {
            key: 'labor_standards',
            name: '勞基法規範',
            description: '符合勞基法的變形工時規定'
        },
        5: {
            key: 'consecutive_limit',
            name: '連續上班限制',
            description: '避免員工連續工作天數過長'
        },
        6: {
            key: 'shift_order',
            name: '接班順序',
            description: '遵守順向接班規則'
        },
        7: {
            key: 'holiday_fairness',
            name: '假日公平性',
            description: '平均分配假日的工作機會'
        },
        8: {
            key: 'work_balance',
            name: '工作天數平衡',
            description: '讓每人工作天數盡量接近'
        }
    },

    // ==================== AI 排班策略 ====================
    AI_STRATEGIES: {
        BALANCED: {
            name: '平衡優先',
            description: '工作天數盡量平均，假日輪流',
            weights: {
                work_balance: 0.4,
                holiday_fairness: 0.3,
                group_balance: 0.3
            }
        },
        PACKAGE_FIRST: {
            name: '包班優先',
            description: '優先滿足包班需求',
            weights: {
                package_rule: 0.5,
                work_balance: 0.3,
                group_balance: 0.2
            }
        },
        EFFICIENCY: {
            name: '效率優先',
            description: '快速排班，可能不夠平衡',
            weights: {}
        },
        CUSTOM: {
            name: '自訂',
            description: '排班者自行設定權重',
            weights: {}
        }
    },

    // ==================== 統計項目 ====================
    STATISTICS_ITEMS: {
        WORK_DAYS: {
            id: 'work_days',
            name: '總工作天數',
            formula: 'COUNT(非FF班別)',
            enabled: true
        },
        OFF_DAYS: {
            id: 'off_days',
            name: '休假天數',
            formula: 'COUNT(FF)',
            enabled: true
        },
        OVERTIME_DAYS: {
            id: 'overtime_days',
            name: '加班天數',
            formula: '總工作天數 - 標準工作天數',
            enabled: true
        },
        HOLIDAY_WORK: {
            id: 'holiday_work',
            name: '假日上班天數',
            formula: 'COUNT(假日且非FF)',
            enabled: true
        },
        NIGHT_SHIFT_MAJOR: {
            id: 'night_shift_major',
            name: '大夜班數',
            formula: 'COUNT(大)',
            enabled: true
        },
        NIGHT_SHIFT_MINOR: {
            id: 'night_shift_minor',
            name: '小夜班數',
            formula: 'COUNT(小)',
            enabled: true
        },
        DAY_SHIFT: {
            id: 'day_shift',
            name: '白班數',
            formula: 'COUNT(白)',
            enabled: true
        },
        DL_SHIFT: {
            id: 'dl_shift',
            name: 'DL班數',
            formula: 'COUNT(DL)',
            enabled: false
        },
        CONSECUTIVE_MAX: {
            id: 'consecutive_max',
            name: '最長連續工作',
            formula: 'MAX(連續工作天數)',
            enabled: true
        },
        SWAP_COUNT: {
            id: 'swap_count',
            name: '換班次數',
            formula: 'COUNT(換班記錄)',
            enabled: true
        }
    },

    // ==================== 日期格式 ====================
    DATE_FORMATS: {
        DISPLAY: 'YYYY/MM/DD',           // 顯示格式
        DISPLAY_WITH_TIME: 'YYYY/MM/DD HH:mm',
        DISPLAY_MONTH: 'YYYY年MM月',
        API: 'YYYY-MM-DD',               // API 格式
        SHEET_MONTH: 'YYYYMM',           // Sheets 月份格式
        TIME: 'HH:mm'
    },

    // ==================== 週間人數需求 (預設) ====================
    DEFAULT_WEEKLY_REQUIREMENTS: {
        1: { day: '週一', 大: 3, 小: 2, 白: 2, DL: 1 }, // 週一
        2: { day: '週二', 大: 3, 小: 2, 白: 2, DL: 1 },
        3: { day: '週三', 大: 3, 小: 2, 白: 2, DL: 1 },
        4: { day: '週四', 大: 3, 小: 2, 白: 2, DL: 1 },
        5: { day: '週五', 大: 3, 小: 2, 白: 2, DL: 1 },
        6: { day: '週六', 大: 4, 小: 3, 白: 2, DL: 1 }, // 週六
        0: { day: '週日', 大: 4, 小: 3, 白: 2, DL: 1 }  // 週日
    },

    // ==================== 資料保存期限 ====================
    DATA_RETENTION: {
        ACTIVE_YEARS: 5,          // 活動資料保存年限
        ARCHIVE_FOREVER: true,    // 歸檔資料永久保存
        BACKUP_DAYS: 30           // 備份保留天數
    },

    // ==================== API 相關 ====================
    API: {
        TIMEOUT: 30000,           // 請求逾時時間 (毫秒)
        RETRY_TIMES: 3,           // 重試次數
        RETRY_DELAY: 1000         // 重試延遲 (毫秒)
    },

    // ==================== 分頁設定 ====================
    PAGINATION: {
        DEFAULT_PAGE_SIZE: 20,
        PAGE_SIZE_OPTIONS: [10, 20, 50, 100]
    },

    // ==================== 檔案上傳限制 ====================
    UPLOAD: {
        MAX_FILE_SIZE: 5 * 1024 * 1024,  // 5MB
        ALLOWED_TYPES: {
            CSV: ['text/csv', 'application/vnd.ms-excel'],
            EXCEL: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel'],
            IMAGE: ['image/jpeg', 'image/png', 'image/gif']
        }
    },

    // ==================== 本地儲存鍵值 ====================
    STORAGE_KEYS: {
        USER: 'nursing_schedule_user',
        TOKEN: 'nursing_schedule_token',
        SETTINGS: 'nursing_schedule_settings',
        THEME: 'nursing_schedule_theme',
        SIDEBAR_COLLAPSED: 'nursing_schedule_sidebar_collapsed'
    },

    // ==================== 錯誤訊息 ====================
    ERROR_MESSAGES: {
        NETWORK_ERROR: '網路連線錯誤，請檢查網路狀態',
        UNAUTHORIZED: '您沒有權限執行此操作',
        SESSION_EXPIRED: '登入已過期，請重新登入',
        DATA_NOT_FOUND: '找不到資料',
        INVALID_INPUT: '輸入資料格式錯誤',
        UNKNOWN_ERROR: '發生未知錯誤，請稍後再試'
    },

    // ==================== 週間對應 ====================
    WEEKDAYS: {
        0: '週日',
        1: '週一',
        2: '週二',
        3: '週三',
        4: '週四',
        5: '週五',
        6: '週六'
    },

    WEEKDAYS_SHORT: ['日', '一', '二', '三', '四', '五', '六']
};

// 讓常數可在全域使用
if (typeof window !== 'undefined') {
    window.CONSTANTS = CONSTANTS;
}