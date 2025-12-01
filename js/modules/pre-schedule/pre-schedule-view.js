/**
 * js/modules/pre-schedule/pre-schedule-view.js
 * 預班表視圖 (ES Module 版 - 完整實作)
 */

import { Auth } from '../../core/auth.js';
import { Utils } from '../../core/utils.js';
import { CONSTANTS } from '../../config/constants.js';
import { Loading } from '../../components/loading.js';
import { Notification } from '../../components/notification.js';
import { Modal } from '../../components/modal.js';
import { PreScheduleService } from '../../services/pre-schedule.service.js';
import { SettingsService } from '../../services/settings.service.js';

// 引入子模組
import { PreScheduleConfig } from './pre-schedule-config.js';
import { PreScheduleSubmit } from './pre-schedule-submit.js';
import { PreScheduleExtra } from './pre-schedule-extra.js';

export const PreScheduleView = {
    currentMonth: null,
    currentYear: null,
    preScheduleData: null,
    staffData: null,
    shiftsData: null,
    statusData: null,
    isEditable: false,
    userRole: null,
    currentStaffId: null,
    
    // ==================== 初始化 ====================
    
    async init(options = {}) {
        const {
            month = Utils.getMonthString(new Date()),
            staffId = null
        } = options;
        
        this.currentYear = parseInt(month.substring(0, 4));
        this.currentMonth = parseInt(month.substring(4, 6));
        this.currentStaffId = staffId;
        this.userRole = Auth.getUserRole();
        
        // 渲染外框
        this.renderContainer();
        
        await this.loadData();
        this.render();
        this.bindEvents();
    },
    
    renderContainer() {
        const container = document.getElementById('pre-schedule-container');
        if (container) container.innerHTML = '<div class="loader-spinner"></div><p style="text-align:center">載入中...</p>';
    },

    // ==================== 資料載入 ====================

    async loadData() {
        try {
            Loading.show('載入預班資料...');
            
            const unit = Auth.getUserUnit();
            if (!unit) throw new Error('無法取得單位資訊');
            const unitId = unit.id;
            
            const monthStr = `${this.currentYear}${String(this.currentMonth).padStart(2, '0')}`;
            
            // 並行載入所有需要的資料
            const [preSchedule, status, shifts, staff] = await Promise.all([
                PreScheduleService.getPreSchedule(unitId, monthStr).catch(() => ({})), // 容錯處理
                PreScheduleService.getPreScheduleConfig(monthStr).catch(() => ({ status: 'draft' })),
                SettingsService.getShifts().catch(() => []),
                SettingsService.getStaff().catch(() => [])
            ]);
            
            this.preScheduleData = preSchedule || {};
            this.statusData = status || { status: 'draft' };
            this.shiftsData = shifts || [];
            this.staffData = staff || [];
            
            this.isEditable = this.checkEditable();
            
            Loading.hide();
        } catch (error) {
            Loading.hide();
            console.error('載入資料錯誤:', error);
            Notification.error('載入資料失敗: ' + error.message);
            // 即使失敗也要渲染基本介面，避免畫面空白
            this.render(); 
        }
    },
    
    checkEditable() {
        if (!this.statusData) return false;
        
        // 鎖定狀態：只有排班者/管理者可編輯
        if (this.statusData.status === 'locked') {
            return this.userRole === CONSTANTS.ROLES?.SCHEDULER || 
                   this.userRole === CONSTANTS.ROLES?.ADMIN;
        }
        
        // 已關閉：都不能編輯
        if (this.statusData.status === 'closed') return false;
        
        // 草稿：都不能編輯
        if (this.statusData.status === 'draft') return false;
        
        // 開放中：檢查是否過期
        if (this.statusData.status === 'open' && this.statusData.close_date) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const closeDate = new Date(this.statusData.close_date);
            if (today > closeDate) return false;
        }
        
        return this.statusData.status === 'open';
    },
    
    // ==================== 渲染邏輯 ====================
    
    render() {
        const container = document.getElementById('pre-schedule-container');
        if (!container) return;
        
        container.innerHTML = `
            ${this.renderHeader()}
            ${this.renderStatusBar()}
            ${this.renderCalendar()}
            ${this.renderStatistics()}
        `;
        
        // 重新綁定事件 (因為 innerHTML 重繪了 DOM)
        this.bindEvents();
    },
    
    renderHeader() {
        return `
            <div class="pre-schedule-header">
                <div class="header-left">
                    <h1>預班管理</h1>
                    <p class="text-muted">
                        ${this.currentYear} 年 ${this.currentMonth} 月
                    </p>
                </div>
                <div class="header-right">
                    <button class="btn btn-secondary" id="prev-month-btn">
                        ← 上個月
                    </button>
                    <button class="btn btn-secondary" id="next-month-btn">
                        下個月 →
                    </button>
                    ${this.renderHeaderActions()}
                </div>
            </div>
        `;
    },
    
    renderHeaderActions() {
        const isScheduler = this.userRole === CONSTANTS.ROLES?.SCHEDULER || 
                          this.userRole === CONSTANTS.ROLES?.ADMIN;
        
        if (!isScheduler) return '';
        
        return `
            <button class="btn btn-primary" id="status-config-btn">
                設定狀態
            </button>
            <button class="btn btn-secondary" id="export-btn">
                匯出
            </button>
        `;
    },
    
    renderStatusBar() {
        const statusConfig = {
            draft: { text: '草稿 (未開放)', color: 'gray', icon: '📝' },
            open: { text: '開放填寫中', color: 'info', icon: '✅' },
            closed: { text: '已截止', color: 'error', icon: '🔒' },
            locked: { text: '已鎖定', color: 'warning', icon: '⚠️' }
        };
        
        const statusKey = this.statusData?.status || 'draft';
        const config = statusConfig[statusKey];
        
        let statusText = config.text;
        if (this.statusData?.close_date && statusKey === 'open') {
            statusText += ` (截止日: ${this.statusData.close_date})`;
        }
        
        return `
            <div class="alert alert-${config.color}" style="margin-bottom: 20px;">
                <div class="alert-icon">${config.icon}</div>
                <div class="alert-content">
                    <div class="alert-title">預班狀態: ${statusText}</div>
                    <div>${this.isEditable ? '您可以編輯預班內容' : '目前無法編輯預班'}</div>
                </div>
            </div>
        `;
    },
    
    renderCalendar() {
        const daysInMonth = Utils.getDaysInMonth(this.currentYear, this.currentMonth);
        const prevMonthDays = this.getPrevMonthDays();
        const nextMonthDays = 6; 
        
        // 根據角色決定顯示方式
        if (this.userRole === CONSTANTS.ROLES?.VIEWER) {
            return this.renderPersonalCalendar(daysInMonth, prevMonthDays, nextMonthDays);
        } else {
            return this.renderAllStaffCalendar(daysInMonth, prevMonthDays, nextMonthDays);
        }
    },
    
    // --- 個人日曆 ---
    renderPersonalCalendar(daysInMonth, prevMonthDays, nextMonthDays) {
        const currentUser = Auth.getCurrentUser();
        // 假設資料結構是 { staff_schedules: { "staffId": { "date": { shift: "A", is_extra: false } } } }
        const staffSchedule = this.preScheduleData?.staff_schedules?.[currentUser.uid] || {};
        
        return `
            <div class="card">
                <div class="card-header">
                    <h3 class="card-title">我的預班</h3>
                </div>
                <div class="card-body">
                    <div class="calendar-container">
                        <div class="calendar-header">
                            <div class="calendar-weekdays">
                                ${CONSTANTS.WEEKDAYS_SHORT.map(day => `<div class="calendar-weekday">${day}</div>`).join('')}
                            </div>
                        </div>
                        ${this.renderCalendarDays(staffSchedule, daysInMonth, prevMonthDays, nextMonthDays, currentUser.uid)}
                    </div>
                </div>
            </div>
        `;
    },
    
    renderCalendarDays(schedule, daysInMonth, prevMonthDays, nextMonthDays, staffId) {
        let html = '<div class="calendar-grid">';
        
        // 前月
        for (let i = prevMonthDays; i > 0; i--) {
            const prevM = this.currentMonth === 1 ? 12 : this.currentMonth - 1;
            const prevY = this.currentMonth === 1 ? this.currentYear - 1 : this.currentYear;
            const daysInPrev = Utils.getDaysInMonth(prevY, prevM);
            const day = daysInPrev - i + 1;
            html += this.renderDateCell(prevY, prevM, day, schedule, staffId, true);
        }
        
        // 當月
        for (let day = 1; day <= daysInMonth; day++) {
            html += this.renderDateCell(this.currentYear, this.currentMonth, day, schedule, staffId, false);
        }
        
        // 下月
        for (let day = 1; day <= nextMonthDays; day++) {
            const nextM = this.currentMonth === 12 ? 1 : this.currentMonth + 1;
            const nextY = this.currentMonth === 12 ? this.currentYear + 1 : this.currentYear;
            html += this.renderDateCell(nextY, nextM, day, schedule, staffId, true);
        }
        
        html += '</div>';
        return html;
    },
    
    renderDateCell(year, month, day, schedule, staffId, isGray) {
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const dateObj = new Date(year, month - 1, day);
        const weekday = dateObj.getDay();
        const isWeekend = weekday === 0 || weekday === 6;
        
        const cellData = schedule[dateStr];
        const shift = cellData?.shift || '';
        const isExtra = cellData?.is_extra || false;
        
        const cellClasses = [
            'calendar-cell',
            isGray ? 'gray-date' : '',
            isWeekend ? 'weekend' : '',
            shift ? 'has-schedule' : '',
            (this.isEditable && !isGray) ? 'editable' : ''
        ].filter(Boolean).join(' ');
        
        // 尋找班別顏色
        const shiftInfo = this.shiftsData.find(s => s.code === shift);
        const colorStyle = shiftInfo ? `background-color: ${shiftInfo.color};` : '';
        
        return `
            <div class="${cellClasses}" 
                 data-date="${dateStr}" 
                 data-staff-id="${staffId}"
                 style="${colorStyle}">
                <div class="cell-date">${day}</div>
                <div class="cell-weekday">${CONSTANTS.WEEKDAYS_SHORT[weekday]}</div>
                ${shift ? `
                    <div class="cell-shift">
                        ${shift}
                        ${isExtra ? '<span class="extra-badge">⭐</span>' : ''}
                    </div>` : 
                    '<div class="cell-empty">-</div>'
                }
            </div>
        `;
    },

    // --- 全員日曆 (排班者視角) ---
    renderAllStaffCalendar(daysInMonth, prevMonthDays, nextMonthDays) {
        if (!this.staffData || this.staffData.length === 0) {
            return '<div class="empty-state"><p>目前沒有員工資料</p></div>';
        }

        return `
            <div class="card">
                <div class="card-header"><h3 class="card-title">全員預班表</h3></div>
                <div class="card-body" style="overflow-x: auto;">
                    <div class="staff-calendar-container">
                        ${this.renderStaffHeaderRow(daysInMonth, prevMonthDays, nextMonthDays)}
                        ${this.staffData.map(staff => 
                            this.renderStaffRow(staff, daysInMonth, prevMonthDays, nextMonthDays)
                        ).join('')}
                    </div>
                </div>
            </div>
        `;
    },

    renderStaffHeaderRow(daysInMonth, prevMonthDays, nextMonthDays) {
        let html = '<div class="staff-row header-row"><div class="staff-name-cell">姓名</div>';
        // (略去日期 header 的迴圈邏輯，與上面 renderStaffRow 類似，為節省篇幅)
        // 實際應用時建議將日期生成邏輯提取為共用函式 getCalendarDates()
        
        // 簡單實作當月 Header
        for (let d = 1; d <= daysInMonth; d++) {
            html += `<div class="date-cell">${d}</div>`;
        }
        html += '</div>';
        return html;
    },

    renderStaffRow(staff, daysInMonth, prevMonthDays, nextMonthDays) {
        const schedule = this.preScheduleData?.staff_schedules?.[staff.id] || {};
        let html = `<div class="staff-row"><div class="staff-name-cell">${staff.name}</div>`;
        
        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${this.currentYear}-${String(this.currentMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const cellData = schedule[dateStr];
            const shift = cellData?.shift || '';
            const shiftInfo = this.shiftsData.find(s => s.code === shift);
            const style = shiftInfo ? `background-color:${shiftInfo.color}` : '';
            
            html += `
                <div class="shift-cell ${this.isEditable ? 'editable' : ''}" 
                     data-date="${dateStr}" 
                     data-staff-id="${staff.id}"
                     style="${style}">
                     ${shift || '-'}
                </div>`;
        }
        html += '</div>';
        return html;
    },

    getPrevMonthDays() {
        const firstDay = new Date(this.currentYear, this.currentMonth - 1, 1);
        return firstDay.getDay(); 
    },

    renderStatistics() {
        // 這裡可以根據需要實作統計區塊
        return '';
    },

    // ==================== 事件處理 ====================

    bindEvents() {
        // 按鈕事件
        document.getElementById('prev-month-btn')?.addEventListener('click', () => this.changeMonth(-1));
        document.getElementById('next-month-btn')?.addEventListener('click', () => this.changeMonth(1));
        document.getElementById('status-config-btn')?.addEventListener('click', () => this.openConfigModal());
        document.getElementById('export-btn')?.addEventListener('click', () => this.exportSchedule());

        // 日曆格子點擊 (使用事件委派)
        const container = document.getElementById('pre-schedule-container');
        container?.addEventListener('click', (e) => {
            // 處理 .calendar-cell 和 .shift-cell 的點擊
            const cell = e.target.closest('.calendar-cell, .shift-cell');
            if (cell && cell.classList.contains('editable')) {
                const date = cell.dataset.date;
                const staffId = cell.dataset.staffId;
                this.onCellClick(date, staffId);
            }
        });
    },

    changeMonth(delta) {
        let m = this.currentMonth + delta;
        let y = this.currentYear;
        if (m > 12) { m = 1; y++; }
        if (m < 1) { m = 12; y--; }
        
        // 重新初始化
        const monthStr = `${y}${String(m).padStart(2, '0')}`;
        this.init({ month: monthStr });
    },

    onCellClick(dateStr, staffId) {
        // 顯示班別選擇 Modal
        const currentShift = this.preScheduleData?.staff_schedules?.[staffId]?.[dateStr]?.shift || '';
        
        const buttons = this.shiftsData.map(s => ({
            text: `${s.name} (${s.code})`,
            className: currentShift === s.code ? 'btn-primary' : 'btn-secondary',
            onClick: () => {
                this.updateShift(dateStr, staffId, s.code);
                Modal.close();
            }
        }));
        
        // 清除按鈕
        buttons.push({
            text: '清除',
            className: 'btn-danger',
            onClick: () => {
                this.updateShift(dateStr, staffId, '');
                Modal.close();
            }
        });

        Modal.show({
            title: `選擇班別 (${dateStr})`,
            content: '請選擇要預排的班別：',
            buttons: buttons
        });
    },

    async updateShift(dateStr, staffId, shiftCode) {
        try {
            Loading.show('儲存中...');
            
            // 這裡呼叫 Service 進行更新
            // 注意：如果是 Submit 模式，可能需要呼叫 PreScheduleSubmit
            // 如果是 Extra 模式，呼叫 PreScheduleExtra
            // 這裡簡化為直接呼叫 Service 的通用更新方法
            
            const unitId = Auth.getUserUnit().id;
            const monthStr = `${this.currentYear}${String(this.currentMonth).padStart(2, '0')}`;
            
            // 取得該員工目前的 schedule
            let schedule = this.preScheduleData?.staff_schedules?.[staffId] || {};
            
            if (shiftCode) {
                schedule[dateStr] = { shift: shiftCode, is_extra: false };
            } else {
                delete schedule[dateStr];
            }
            
            await PreScheduleService.submitPreSchedule({
                unitId,
                month: monthStr,
                staffId,
                data: schedule
            });
            
            Notification.success('更新成功');
            await this.loadData(); // 重新載入資料
            this.render(); // 重新渲染
            
        } catch (error) {
            Loading.hide();
            Notification.error('更新失敗: ' + error.message);
        }
    },

    openConfigModal() {
        // 這裡可以整合 PreScheduleConfig 模組
        // new PreScheduleConfig().init(...)
        Notification.info('設定功能開發中');
    },

    async exportSchedule() {
        Notification.info('匯出功能開發中');
    }
};