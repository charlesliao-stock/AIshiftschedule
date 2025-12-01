/**
 * js/models/staff.model.js
 * 人員資料模型 (ES Module 版)
 */

import { Utils } from '../core/utils.js';

export class Staff {
    constructor(data = {}) {
        this.id = data.id || null;
        this.employeeId = data.employeeId || data.employee_id || '';
        this.name = data.name || '';
        this.level = data.level || '';
        this.shifts = data.shifts || [];
        this.group = data.group || '';
        this.maxConsecutiveDays = data.maxConsecutiveDays || data.max_consecutive_days || 6;
        this.isPackage = data.isPackage || data.is_package || false;
        this.packageType = data.packageType || data.package_type || '';
        this.email = data.email || '';
        this.lineId = data.lineId || data.line_id || '';
        this.status = data.status || '在職';
    }
    
    validate() {
        const errors = [];
        if (!this.employeeId?.trim()) errors.push('請輸入員工編號');
        if (!this.name?.trim()) errors.push('請輸入姓名');
        if (!this.group?.trim()) errors.push('請選擇組別');
        if (!this.shifts?.length) errors.push('請至少選擇一個可上班別');
        if (this.maxConsecutiveDays < 1 || this.maxConsecutiveDays > 31) errors.push('最長連續天數必須在 1-31 之間');
        if (this.isPackage && !this.packageType) errors.push('包班者請選擇包班類型');
        if (this.email && !Utils.isValidEmail(this.email)) errors.push('Email 格式錯誤');
        
        return { valid: errors.length === 0, errors };
    }
    
    canWorkShift(shiftCode) {
        return this.shifts.includes(shiftCode);
    }
    
    toObject() {
        return {
            id: this.id,
            employee_id: this.employeeId,
            name: this.name,
            level: this.level,
            shifts: this.shifts,
            group: this.group,
            max_consecutive_days: this.maxConsecutiveDays,
            is_package: this.isPackage,
            package_type: this.packageType,
            email: this.email,
            line_id: this.lineId,
            status: this.status
        };
    }
    
    static fromObject(obj) {
        return new Staff(obj);
    }
    
    static fromCSVRow(row, headers) {
        const data = {};
        headers.forEach((header, index) => {
            const value = row[index];
            switch (header) {
                case '員工編號': data.employeeId = value; break;
                case '姓名': data.name = value; break;
                case '層級': data.level = value; break;
                case '可上班別': data.shifts = value ? value.split(',').map(s => s.trim()) : []; break;
                case '組別': data.group = value; break;
                case '最長連續天數': data.maxConsecutiveDays = parseInt(value) || 6; break;
                case '是否包班': data.isPackage = value === '是' || value === 'TRUE'; break;
                case '包班類型': data.packageType = value; break;
                case 'Email': data.email = value; break;
                case 'Line ID': data.lineId = value; break;
                case '狀態': data.status = value || '在職'; break;
            }
        });
        return new Staff(data);
    }
    
    static getCSVHeaders() {
        return ['員工編號', '姓名', '層級', '可上班別', '組別', '最長連續天數', '是否包班', '包班類型', 'Email', 'Line ID', '狀態'];
    }
    
    toCSVRow() {
        return [
            this.employeeId, this.name, this.level, this.shifts.join(','), this.group,
            this.maxConsecutiveDays, this.isPackage ? '是' : '否', this.packageType,
            this.email, this.lineId, this.status
        ];
    }
}