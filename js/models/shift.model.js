/**
 * js/models/shift.model.js
 * 班別資料模型 (ES Module 版)
 */

import { CONSTANTS } from '../config/constants.js';

export class Shift {
    constructor(data = {}) {
        this.id = data.id || null;
        this.name = data.name || '';
        this.code = data.code || '';
        this.startTime = data.startTime || '';
        this.endTime = data.endTime || '';
        this.color = data.color || '#E5E7EB';
        this.countToStats = data.countToStats !== false;
        this.order = data.order || 1;
    }
    
    validate() {
        const errors = [];
        
        if (!this.name || !this.name.trim()) errors.push('請輸入班別名稱');
        if (!this.code || !this.code.trim()) errors.push('請輸入班別代碼');
        else if (this.code.length > 5) errors.push('班別代碼不可超過 5 個字元');
        
        if (this.code !== 'FF' && this.code !== 'OFF') {
            if (!this.startTime) errors.push('請輸入起始時間');
            if (!this.endTime) errors.push('請輸入結束時間');
            if (this.startTime && !this.isValidTime(this.startTime)) errors.push('起始時間格式錯誤 (應為 HH:mm)');
            if (this.endTime && !this.isValidTime(this.endTime)) errors.push('結束時間格式錯誤 (應為 HH:mm)');
        }
        
        if (!this.color || !this.isValidColor(this.color)) errors.push('請選擇有效的顏色');
        
        return { valid: errors.length === 0, errors };
    }
    
    isValidTime(time) {
        const regex = /^([01]\d|2[0-3]):([0-5]\d)$/;
        return regex.test(time);
    }
    
    isValidColor(color) {
        const regex = /^#[0-9A-Fa-f]{6}$/;
        return regex.test(color);
    }
    
    calculateHours() {
        if (!this.startTime || !this.endTime) return 0;
        const start = this.timeToMinutes(this.startTime);
        let end = this.timeToMinutes(this.endTime);
        if (end <= start) end += 24 * 60;
        return (end - start) / 60;
    }
    
    timeToMinutes(time) {
        const [hours, minutes] = time.split(':').map(Number);
        return hours * 60 + minutes;
    }
    
    toObject() {
        return {
            id: this.id,
            name: this.name,
            code: this.code,
            startTime: this.startTime,
            endTime: this.endTime,
            color: this.color,
            countToStats: this.countToStats,
            order: this.order
        };
    }
    
    static fromObject(obj) {
        return new Shift(obj);
    }
    
    static getDefaults() {
        return CONSTANTS.DEFAULT_SHIFTS.map(s => new Shift(s));
    }
}