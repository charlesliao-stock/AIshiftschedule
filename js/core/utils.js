/**
 * 工具函式庫
 * 提供系統通用的工具函式
 */

const Utils = {
    // ==================== 日期處理 ====================
    
    /**
     * 格式化日期
     * @param {Date|string} date - 日期物件或字串
     * @param {string} format - 格式 (預設: YYYY/MM/DD)
     * @returns {string} 格式化後的日期字串
     */
    formatDate(date, format = 'YYYY/MM/DD') {
        if (!date) return '';
        
        const d = typeof date === 'string' ? new Date(date) : date;
        if (isNaN(d.getTime())) return '';
        
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        const seconds = String(d.getSeconds()).padStart(2, '0');
        
        return format
            .replace('YYYY', year)
            .replace('MM', month)
            .replace('DD', day)
            .replace('HH', hours)
            .replace('mm', minutes)
            .replace('ss', seconds);
    },
    
    /**
     * 取得月份字串
     * @param {Date|string} date - 日期
     * @returns {string} YYYYMM 格式
     */
    getMonthString(date) {
        return this.formatDate(date, 'YYYYMM');
    },
    
    /**
     * 取得當月天數
     * @param {number} year - 年份
     * @param {number} month - 月份 (1-12)
     * @returns {number} 天數
     */
    getDaysInMonth(year, month) {
        return new Date(year, month, 0).getDate();
    },
    
    /**
     * 取得星期幾
     * @param {Date|string} date - 日期
     * @returns {number} 0-6 (0=週日)
     */
    getWeekday(date) {
        const d = typeof date === 'string' ? new Date(date) : date;
        return d.getDay();
    },
    
    /**
     * 取得星期幾名稱
     * @param {Date|string} date - 日期
     * @returns {string} 週一~週日
     */
    getWeekdayName(date) {
        const weekday = this.getWeekday(date);
        return CONSTANTS.WEEKDAYS[weekday];
    },
    
    /**
     * 是否為假日
     * @param {Date|string} date - 日期
     * @param {Array} holidays - 假日列表
     * @returns {boolean}
     */
    isHoliday(date, holidays = []) {
        const weekday = this.getWeekday(date);
        // 週末
        if (weekday === 0 || weekday === 6) return true;
        
        // 檢查國定假日
        const dateStr = this.formatDate(date, 'YYYY-MM-DD');
        return holidays.some(h => h.date === dateStr && h.enabled);
    },
    
    /**
     * 取得日期範圍
     * @param {Date} startDate - 開始日期
     * @param {Date} endDate - 結束日期
     * @returns {Array<Date>} 日期陣列
     */
    getDateRange(startDate, endDate) {
        const dates = [];
        const current = new Date(startDate);
        
        while (current <= endDate) {
            dates.push(new Date(current));
            current.setDate(current.getDate() + 1);
        }
        
        return dates;
    },
    
    /**
     * 加減日期
     * @param {Date|string} date - 日期
     * @param {number} days - 天數 (正數=加，負數=減)
     * @returns {Date} 新日期
     */
    addDays(date, days) {
        const d = typeof date === 'string' ? new Date(date) : new Date(date);
        d.setDate(d.getDate() + days);
        return d;
    },

    // ==================== 字串處理 ====================
    
    /**
     * 截斷字串
     * @param {string} str - 字串
     * @param {number} length - 長度
     * @param {string} suffix - 後綴 (預設: ...)
     * @returns {string}
     */
    truncate(str, length, suffix = '...') {
        if (!str || str.length <= length) return str;
        return str.substring(0, length) + suffix;
    },
    
    /**
     * 首字母大寫
     * @param {string} str - 字串
     * @returns {string}
     */
    capitalize(str) {
        if (!str) return '';
        return str.charAt(0).toUpperCase() + str.slice(1);
    },
    
    /**
     * 移除HTML標籤
     * @param {string} html - HTML字串
     * @returns {string}
     */
    stripHtml(html) {
        const tmp = document.createElement('div');
        tmp.innerHTML = html;
        return tmp.textContent || tmp.innerText || '';
    },

    // ==================== 數字處理 ====================
    
    /**
     * 格式化數字 (千分位)
     * @param {number} num - 數字
     * @returns {string}
     */
    formatNumber(num) {
        if (typeof num !== 'number') return num;
        return num.toLocaleString('zh-TW');
    },
    
    /**
     * 限制數字範圍
     * @param {number} value - 數值
     * @param {number} min - 最小值
     * @param {number} max - 最大值
     * @returns {number}
     */
    clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    },
    
    /**
     * 計算百分比
     * @param {number} value - 數值
     * @param {number} total - 總數
     * @param {number} decimals - 小數位數
     * @returns {string}
     */
    percentage(value, total, decimals = 1) {
        if (total === 0) return '0%';
        return ((value / total) * 100).toFixed(decimals) + '%';
    },

    // ==================== 陣列處理 ====================
    
    /**
     * 打亂陣列
     * @param {Array} array - 陣列
     * @returns {Array} 新陣列
     */
    shuffle(array) {
        const arr = [...array];
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    },
    
    /**
     * 分組
     * @param {Array} array - 陣列
     * @param {Function|string} key - 分組鍵
     * @returns {Object} 分組後的物件
     */
    groupBy(array, key) {
        return array.reduce((result, item) => {
            const groupKey = typeof key === 'function' ? key(item) : item[key];
            if (!result[groupKey]) {
                result[groupKey] = [];
            }
            result[groupKey].push(item);
            return result;
        }, {});
    },
    
    /**
     * 去重
     * @param {Array} array - 陣列
     * @param {string} key - 比較的鍵 (選填)
     * @returns {Array} 新陣列
     */
    unique(array, key = null) {
        if (!key) {
            return [...new Set(array)];
        }
        
        const seen = new Set();
        return array.filter(item => {
            const val = item[key];
            if (seen.has(val)) return false;
            seen.add(val);
            return true;
        });
    },

    // ==================== 物件處理 ====================
    
    /**
     * 深拷貝
     * @param {*} obj - 物件
     * @returns {*} 新物件
     */
    deepClone(obj) {
        if (obj === null || typeof obj !== 'object') return obj;
        if (obj instanceof Date) return new Date(obj);
        if (obj instanceof Array) return obj.map(item => this.deepClone(item));
        
        const clonedObj = {};
        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                clonedObj[key] = this.deepClone(obj[key]);
            }
        }
        return clonedObj;
    },
    
    /**
     * 合併物件 (深度合併)
     * @param {Object} target - 目標物件
     * @param {Object} source - 來源物件
     * @returns {Object} 合併後的物件
     */
    deepMerge(target, source) {
        const output = { ...target };
        
        for (const key in source) {
            if (source.hasOwnProperty(key)) {
                if (source[key] instanceof Object && key in target) {
                    output[key] = this.deepMerge(target[key], source[key]);
                } else {
                    output[key] = source[key];
                }
            }
        }
        
        return output;
    },
    
    /**
     * 取得巢狀屬性值
     * @param {Object} obj - 物件
     * @param {string} path - 路徑 (例如: 'user.profile.name')
     * @param {*} defaultValue - 預設值
     * @returns {*}
     */
    get(obj, path, defaultValue = undefined) {
        const keys = path.split('.');
        let result = obj;
        
        for (const key of keys) {
            if (result == null) return defaultValue;
            result = result[key];
        }
        
        return result !== undefined ? result : defaultValue;
    },

    // ==================== 驗證 ====================
    
    /**
     * 驗證 Email
     * @param {string} email - Email
     * @returns {boolean}
     */
    isValidEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    },
    
    /**
     * 驗證手機號碼 (台灣)
     * @param {string} phone - 手機號碼
     * @returns {boolean}
     */
    isValidPhone(phone) {
        const re = /^09\d{8}$/;
        return re.test(phone);
    },
    
    /**
     * 是否為空值
     * @param {*} value - 值
     * @returns {boolean}
     */
    isEmpty(value) {
        if (value == null) return true;
        if (typeof value === 'string') return value.trim() === '';
        if (Array.isArray(value)) return value.length === 0;
        if (typeof value === 'object') return Object.keys(value).length === 0;
        return false;
    },

    // ==================== URL 處理 ====================
    
    /**
     * 取得 URL 參數
     * @param {string} name - 參數名稱
     * @returns {string|null}
     */
    getUrlParam(name) {
        const params = new URLSearchParams(window.location.search);
        return params.get(name);
    },
    
    /**
     * 建構 URL
     * @param {string} base - 基礎 URL
     * @param {Object} params - 參數物件
     * @returns {string}
     */
    buildUrl(base, params = {}) {
        const url = new URL(base, window.location.origin);
        Object.keys(params).forEach(key => {
            if (params[key] != null) {
                url.searchParams.append(key, params[key]);
            }
        });
        return url.toString();
    },

    // ==================== DOM 處理 ====================
    
    /**
     * 建立 DOM 元素
     * @param {string} tag - 標籤名稱
     * @param {Object} attrs - 屬性
     * @param {string|Array} children - 子元素
     * @returns {HTMLElement}
     */
    createElement(tag, attrs = {}, children = null) {
        const el = document.createElement(tag);
        
        Object.keys(attrs).forEach(key => {
            if (key === 'className') {
                el.className = attrs[key];
            } else if (key === 'style' && typeof attrs[key] === 'object') {
                Object.assign(el.style, attrs[key]);
            } else if (key.startsWith('on') && typeof attrs[key] === 'function') {
                const event = key.substring(2).toLowerCase();
                el.addEventListener(event, attrs[key]);
            } else {
                el.setAttribute(key, attrs[key]);
            }
        });
        
        if (children) {
            if (typeof children === 'string') {
                el.textContent = children;
            } else if (Array.isArray(children)) {
                children.forEach(child => {
                    if (typeof child === 'string') {
                        el.appendChild(document.createTextNode(child));
                    } else if (child instanceof HTMLElement) {
                        el.appendChild(child);
                    }
                });
            } else if (children instanceof HTMLElement) {
                el.appendChild(children);
            }
        }
        
        return el;
    },
    
    /**
     * 移除所有子元素
     * @param {HTMLElement} element - 元素
     */
    removeAllChildren(element) {
        while (element.firstChild) {
            element.removeChild(element.firstChild);
        }
    },

    // ==================== 其他工具 ====================
    
    /**
     * 防抖 (Debounce)
     * @param {Function} func - 函式
     * @param {number} wait - 等待時間 (毫秒)
     * @returns {Function}
     */
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },
    
    /**
     * 節流 (Throttle)
     * @param {Function} func - 函式
     * @param {number} limit - 限制時間 (毫秒)
     * @returns {Function}
     */
    throttle(func, limit) {
        let inThrottle;
        return function executedFunction(...args) {
            if (!inThrottle) {
                func(...args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    },
    
    /**
     * 延遲執行
     * @param {number} ms - 毫秒
     * @returns {Promise}
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    },
    
    /**
     * 產生唯一 ID
     * @returns {string}
     */
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substring(2);
    },
    
    /**
     * 下載檔案
     * @param {Blob|string} data - 資料
     * @param {string} filename - 檔案名稱
     * @param {string} type - MIME 類型
     */
    downloadFile(data, filename, type = 'text/plain') {
        const blob = data instanceof Blob ? data : new Blob([data], { type });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },
    
    /**
     * 複製到剪貼簿
     * @param {string} text - 文字
     * @returns {Promise<boolean>}
     */
    async copyToClipboard(text) {
        try {
            if (navigator.clipboard) {
                await navigator.clipboard.writeText(text);
                return true;
            } else {
                // Fallback
                const textarea = document.createElement('textarea');
                textarea.value = text;
                textarea.style.position = 'fixed';
                textarea.style.opacity = '0';
                document.body.appendChild(textarea);
                textarea.select();
                document.execCommand('copy');
                document.body.removeChild(textarea);
                return true;
            }
        } catch (error) {
            console.error('複製失敗:', error);
            return false;
        }
    }
};

// 讓工具函式可在全域使用
if (typeof window !== 'undefined') {
    window.Utils = Utils;
}