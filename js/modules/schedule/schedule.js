/**
 * js/modules/schedule/schedule.js
 * 排班管理主控 (Firebase Core + DOM 防呆版)
 */

import { UnitService } from '../../services/unit.service.js';
import { ScheduleService } from '../../services/schedule.service.js';
import { Auth } from '../../core/auth.js';
import { Notification } from '../../components/notification.js';
import { Utils } from '../../core/utils.js';
// import { ScheduleView } from './schedule-view.js'; // 暫時註解，避免 View 尚未實作的錯誤
import { ScheduleCheck } from './schedule-check.js';

export const ScheduleManagement = {
    state: {
        currentUnit: null,
        currentMonth: null,
        units: [],
        schedule: null,
        staffList: []
    },

    dom: {}, // 儲存 DOM 元素

    async init() {
        console.log('[ScheduleMgmt] 初始化排班管理...');
        
        // 1. 綁定 DOM (如果找不到會嘗試重試或報錯)
        if (!this.cacheDOM()) {
            console.error('[ScheduleMgmt] ❌ 嚴重錯誤：找不到必要的 HTML 元素 (schedule-container)');
            return;
        }
        
        // 2. 載入單位列表
        await this.loadDependencies();
        
        // 3. 綁定按鈕事件
        this.bindEvents();
        
        // 4. 預設載入邏輯
        if (this.state.units.length > 0) {
            // 嘗試讀取上次選的單位，或預設第一個
            const lastUnitId = localStorage.getItem('last_selected_unit');
            const targetUnit = this.state.units.find(u => u.id === lastUnitId) || this.state.units[0];
            
            this.state.currentUnit = targetUnit;
            this.state.currentMonth = Utils.formatDate(new Date(), 'YYYY-MM');
            
            // 更新 UI
            if (this.dom.unitSelect) this.dom.unitSelect.value = targetUnit.id;
            if (this.dom.monthPicker) this.dom.monthPicker.value = this.state.currentMonth;
            
            await this.loadSchedule();
        } else {
            this.renderNoUnits();
        }
    },

    /**
     * 綁定 HTML 元素
     * @returns {boolean} 是否成功找到核心容器
     */
    cacheDOM() {
        this.dom = {
            container: document.getElementById('schedule-container'), // 👈 這裡最重要
            unitSelect: document.getElementById('select-unit'),
            monthPicker: document.getElementById('input-month'),
            btnSave: document.getElementById('btn-save-schedule'),
            btnAuto: document.getElementById('btn-auto-schedule'),
            btnBackup: document.getElementById('btn-backup-sheet'),
            btnCheck: document.getElementById('btn-check-rules')
        };
        return !!this.dom.container;
    },

    async loadDependencies() {
        try {
            const user = Auth.getCurrentUser();
            let allUnits = await UnitService.getAllUnits();

            // 權限過濾
            if (Auth.isManager() && !Auth.isAdmin()) {
                allUnits = allUnits.filter(u => u.id === user.unitId || u.managerIds?.includes(user.uid));
            }

            this.state.units = allUnits;
            this.renderUnitSelector();

        } catch (error) {
            console.error('[ScheduleMgmt] 載入單位失敗:', error);
            Notification.error('無法載入單位資料');
        }
    },

    renderUnitSelector() {
        if (!this.dom.unitSelect) return;
        
        if (this.state.units.length === 0) {
            this.dom.unitSelect.innerHTML = '<option value="">無可用單位</option>';
            return;
        }

        this.dom.unitSelect.innerHTML = this.state.units
            .map(unit => `<option value="${unit.id}">${unit.name}</option>`)
            .join('');
    },
    
    renderNoUnits() {
        if (this.dom.container) {
            this.dom.container.innerHTML = `
                <div class="alert alert-warning text-center m-5">
                    <h4>尚無單位資料</h4>
                    <p>請先前往「單位維護」建立護理站資料。</p>
                </div>`;
        }
    },

    async loadSchedule() {
        const unitId = this.state.currentUnit?.id;
        const month = this.state.currentMonth;
        if (!unitId || !month) return;

        // 安全檢查：確保容器存在
        if (!this.dom.container) return;

        this.dom.container.innerHTML = '<div class="text-center p-5"><div class="spinner-border text-primary"></div><p>載入班表與人員資料中...</p></div>';

        try {
            const [schedule, unitStaff] = await Promise.all([
                ScheduleService.getSchedule(unitId, month),
                UnitService.getUnitStaff(unitId)
            ]);

            this.state.schedule = schedule;
            this.state.staffList = unitStaff;

            console.log(`[ScheduleMgmt] 載入完成: ${month} (人員: ${unitStaff.length})`);
            this.renderView();

        } catch (error) {
            console.error('[ScheduleMgmt] 載入失敗:', error);
            this.dom.container.innerHTML = `<div class="alert alert-danger">載入失敗: ${error.message}</div>`;
        }
    },

    renderView() {
        // 安全檢查
        if (!this.dom.container) return;

        // 簡易渲染 (若 ScheduleView 尚未實作)
        // 這裡會顯示一個簡單的表格框架
        const staffCount = this.state.staffList.length;
        const shiftData = this.state.schedule.shifts || {};
        
        let html = `
            <div class="card shadow-sm">
                <div class="card-header bg-light d-flex justify-content-between align-items-center">
                    <h5 class="mb-0">${this.state.currentUnit.name} - ${this.state.currentMonth}</h5>
                    <span class="badge badge-info">人員數: ${staffCount}</span>
                </div>
                <div class="card-body p-0 table-responsive">
                    <table class="table table-bordered table-hover mb-0 text-center">
                        <thead class="thead-light">
                            <tr>
                                <th style="width:120px;">姓名</th>
                                ${Array.from({length: 31}, (_, i) => `<th style="min-width:40px;">${i+1}</th>`).join('')}
                            </tr>
                        </thead>
                        <tbody>
        `;

        if (staffCount === 0) {
            html += `<tr><td colspan="32" class="text-muted p-4">⚠️ 該單位尚無人員資料，請至「人員管理」新增護理人員。</td></tr>`;
        } else {
            this.state.staffList.forEach(staff => {
                const userShifts = shiftData[staff.id] || {};
                html += `<tr>
                    <td class="font-weight-bold text-left px-3">${staff.displayName || staff.name || staff.email}</td>
                    ${Array.from({length: 31}, (_, i) => {
                        const dayKey = String(i+1).padStart(2, '0');
                        const shift = userShifts[dayKey] || '';
                        return `<td>${shift}</td>`;
                    }).join('')}
                </tr>`;
            });
        }

        html += `</tbody></table></div></div>`;
        
        this.dom.container.innerHTML = html;
    },

    async handleSave() {
        try {
            await ScheduleService.saveSchedule(this.state.schedule);
            Notification.success('班表儲存成功');
        } catch (error) {
            Notification.error('儲存失敗');
        }
    },

    async handleBackup() {
        if (!confirm('確定要備份至 Google Sheets？')) return;
        try {
            Notification.info('備份中...');
            const res = await ScheduleService.backupToSheets(this.state.schedule);
            res.success ? Notification.success(res.message) : Notification.warning(res.message);
        } catch (e) {
            Notification.error('備份錯誤');
        }
    },

    bindEvents() {
        this.dom.unitSelect?.addEventListener('change', (e) => {
            this.state.currentUnit = this.state.units.find(u => u.id === e.target.value);
            localStorage.setItem('last_selected_unit', this.state.currentUnit.id);
            this.loadSchedule();
        });

        this.dom.monthPicker?.addEventListener('change', (e) => {
            this.state.currentMonth = e.target.value;
            this.loadSchedule();
        });

        this.dom.btnSave?.addEventListener('click', () => this.handleSave());
        this.dom.btnBackup?.addEventListener('click', () => this.handleBackup());
        
        this.dom.btnCheck?.addEventListener('click', () => {
             const result = ScheduleCheck.validateUserSchedule(this.state.schedule.shifts, this.state.currentUnit.rules);
             console.log(result);
             Notification.info('規則檢查完成');
        });
    }
};

export const init = () => ScheduleManagement.init();
