/**
 * js/core/utils.js
 * 工具函式庫 (ES Module 版)
 */

import { CONSTANTS } from '../config/constants.js';

export const Utils = {
    // ==================== 日期處理 ====================
    
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
    
    getMonthString(date) {
        return this.formatDate(date, 'YYYYMM');
    },
    
    getDaysInMonth(year, month) {
        return new Date(year, month, 0).getDate();
    },
    
    getWeekday(date) {
        const d = typeof date === 'string' ? new Date(date) : date;
        return d.getDay();
    },
    
    getWeekdayName(date) {
        const weekday = this.getWeekday(date);
        // 使用 import 進來的 CONSTANTS
        return CONSTANTS.WEEKDAYS?.[weekday] || '';
    },
    
    isHoliday(date, holidays = []) {
        const weekday = this.getWeekday(date);
        // 週末
        if (weekday === 0 || weekday === 6) return true;
        
        // 檢查國定假日
        const dateStr = this.formatDate(date, 'YYYY-MM-DD');
        return holidays.some(h => h.date === dateStr && h.enabled);
    },
    
    getDateRange(startDate, endDate) {
        const dates = [];
        const current = new Date(startDate);
        
        while (current <= endDate) {
            dates.push(new Date(current));
            current.setDate(current.getDate() + 1);
        }
        
        return dates;
    },
    
    addDays(date, days) {
        const d = typeof date === 'string' ? new Date(date) : new Date(date);
        d.setDate(d.getDate() + days);
        return d;
    },

    // ==================== 字串處理 ====================
    
    truncate(str, length, suffix = '...') {
        if (!str || str.length <= length) return str;
        return str.substring(0, length) + suffix;
    },
    
    capitalize(str) {
        if (!str) return '';
        return str.charAt(0).toUpperCase() + str.slice(1);
    },
    
    stripHtml(html) {
        const tmp = document.createElement('div');
        tmp.innerHTML = html;
        return tmp.textContent || tmp.innerText || '';
    },

    // ==================== 數字處理 ====================
    
    formatNumber(num) {
        if (typeof num !== 'number') return num;
        return num.toLocaleString('zh-TW');
    },
    
    clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    },
    
    percentage(value, total, decimals = 1) {
        if (total === 0) return '0%';
        return ((value / total) * 100).toFixed(decimals) + '%';
    },

    // ==================== 陣列處理 ====================
    
    shuffle(array) {
        const arr = [...array];
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    },
    
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
    
    isValidEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    },
    
    isValidPhone(phone) {
        const re = /^09\d{8}$/;
        return re.test(phone);
    },
    
    isEmpty(value) {
        if (value == null) return true;
        if (typeof value === 'string') return value.trim() === '';
        if (Array.isArray(value)) return value.length === 0;
        if (typeof value === 'object') return Object.keys(value).length === 0;
        return false;
    },

    // ==================== URL 處理 ====================
    
    getUrlParam(name) {
        const params = new URLSearchParams(window.location.search);
        return params.get(name);
    },
    
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
    
    removeAllChildren(element) {
        while (element.firstChild) {
            element.removeChild(element.firstChild);
        }
    },

    // ==================== 其他工具 ====================
    
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
    
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    },
    
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substring(2);
    },
    
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