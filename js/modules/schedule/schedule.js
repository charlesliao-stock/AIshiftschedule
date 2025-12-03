/**
 * js/modules/schedule/schedule.js
 * 排班管理主控 (Firebase Core 版)
 * 負責：載入資料、渲染班表、處理排班邏輯
 */

import { UnitService } from '../../services/unit.service.js';
import { ScheduleService } from '../../services/schedule.service.js';
import { Auth } from '../../core/auth.js';
import { Notification } from '../../components/notification.js';
import { Utils } from '../../core/utils.js';
// 如果您還沒有 ScheduleView，請暫時註解掉下面這行，或是使用簡單的渲染邏輯
import { ScheduleView } from './schedule-view.js'; 
import { ScheduleCheck } from './schedule-check.js';

export const ScheduleManagement = {
    // 狀態管理
    state: {
        currentUnit: null,
        currentMonth: null,
        units: [],
        schedule: null,
        staffList: []
    },

    /**
     * 初始化模組
     */
    async init() {
        console.log('[ScheduleMgmt] 初始化排班管理 (Firebase Mode)...');
        
        // 1. 初始化 DOM 元素綁定
        this.cacheDOM();
        
        // 2. 載入必要資料 (單位列表)
        // ⚠️ 這裡已改用 UnitService (Firebase)，不會再呼叫 SheetsService
        await this.loadDependencies();
        
        // 3. 綁定事件
        this.bindEvents();
        
        // 4. 預設載入第一個單位與當前月份
        if (this.state.units.length > 0) {
            // 優先讀取上次選擇的單位，否則選第一個
            const lastUnitId = localStorage.getItem('last_selected_unit');
            const targetUnit = this.state.units.find(u => u.id === lastUnitId) || this.state.units[0];
            
            this.state.currentUnit = targetUnit;
            this.state.currentMonth = Utils.formatDate(new Date(), 'YYYY-MM');
            
            // 更新 UI 下拉選單
            if(this.dom.unitSelect) this.dom.unitSelect.value = this.state.currentUnit.id;
            if(this.dom.monthPicker) this.dom.monthPicker.value = this.state.currentMonth;
            
            // 載入班表
            await this.loadSchedule();
        } else {
            console.warn('[ScheduleMgmt] 無可用單位');
            if(this.dom.container) this.dom.container.innerHTML = '<div class="alert alert-warning">無可用單位，請先建立單位資料。</div>';
        }
    },

    cacheDOM() {
        this.dom = {
            container: document.getElementById('schedule-container'),
            unitSelect: document.getElementById('select-unit'),
            monthPicker: document.getElementById('input-month'),
            btnSave: document.getElementById('btn-save-schedule'),
            btnAuto: document.getElementById('btn-auto-schedule'),
            btnBackup: document.getElementById('btn-backup-sheet'),
            btnCheck: document.getElementById('btn-check-rules')
        };
    },

    /**
     * 載入依賴資料 (單位)
     * ✅ 修正：改用 UnitService (Firebase)
     */
    async loadDependencies() {
        try {
            const user = Auth.getCurrentUser();
            let allUnits = await UnitService.getAllUnits();

            // 權限過濾: Admin 看全部，Manager 看自己
            if (Auth.isManager() && !Auth.isAdmin()) {
                allUnits = allUnits.filter(u => u.id === user.unitId || u.managerIds?.includes(user.uid));
            }

            this.state.units = allUnits;
            this.renderUnitSelector();

        } catch (error) {
            console.error('[ScheduleMgmt] 載入依賴失敗:', error);
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

    /**
     * 載入班表資料
     * ✅ 修正：改用 ScheduleService (Firebase)
     */
    async loadSchedule() {
        const unitId = this.state.currentUnit?.id;
        const month = this.state.currentMonth;
        
        if (!unitId || !month) return;

        // 顯示 Loading
        if(this.dom.container) this.dom.container.innerHTML = '<div class="loading-spinner">載入班表資料...</div>';

        try {
            // 同步載入：班表 + 該單位人員名單
            const [schedule, unitStaff] = await Promise.all([
                ScheduleService.getSchedule(unitId, month),
                UnitService.getUnitStaff(unitId)
            ]);

            this.state.schedule = schedule;
            this.state.staffList = unitStaff;

            console.log(`[ScheduleMgmt] 載入完成: ${month} (人員: ${unitStaff.length})`);

            // 渲染班表視圖
            this.renderView();

        } catch (error) {
            console.error('[ScheduleMgmt] 載入班表失敗:', error);
            Notification.error('載入班表失敗');
            if(this.dom.container) this.dom.container.innerHTML = '<div class="alert alert-danger">載入失敗，請檢查網路連線。</div>';
        }
    },

    renderView() {
        // 如果有 ScheduleView 模組則使用它
        if (typeof ScheduleView !== 'undefined' && ScheduleView.render) {
            ScheduleView.render(this.dom.container, this.state.schedule, this.state.staffList);
        } else {
            // 簡易除錯視圖 (如果還沒寫 View)
            this.dom.container.innerHTML = `
                <div class="card">
                    <div class="card-header bg-primary text-white">
                        ${this.state.currentUnit.name} - ${this.state.currentMonth} 班表 (Draft)
                    </div>
                    <div class="card-body">
                        <p>班表狀態: <strong>${this.state.schedule.status}</strong></p>
                        <p>人員數量: ${this.state.staffList.length}</p>
                        <hr>
                        <pre style="background:#f8f9fa; padding:10px;">${JSON.stringify(this.state.schedule.shifts, null, 2)}</pre>
                    </div>
                </div>
            `;
        }
    },

    /**
     * 儲存班表
     */
    async handleSave() {
        try {
            // 這裡假設 View 有提供 getData()，如果沒有則使用 state 中的資料
            // const currentShifts = ScheduleView.getData();
            // this.state.schedule.shifts = currentShifts;
            
            await ScheduleService.saveSchedule(this.state.schedule);
            Notification.success('班表儲存成功 (Firebase)');
            
        } catch (error) {
            console.error(error);
            Notification.error('儲存失敗');
        }
    },

    /**
     * 備份至 Google Sheets (這是唯一會呼叫 SheetsService 的地方)
     */
    async handleBackup() {
        if (!confirm('確定要將目前班表備份至 Google Sheets 嗎？')) return;
        
        try {
            Notification.info('正在備份中...');
            // 呼叫我們新寫的 ScheduleService.backupToSheets
            const result = await ScheduleService.backupToSheets(this.state.schedule);
            
            if (result.success) {
                Notification.success(result.message);
            } else {
                Notification.warning('備份部分失敗: ' + result.message);
            }
        } catch (error) {
            console.error(error);
            Notification.error('備份發生錯誤');
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
             // 規則檢查範例
             const result = ScheduleCheck.validateUserSchedule(this.state.schedule.shifts, this.state.currentUnit.rules);
             console.log('檢查結果:', result);
             Notification.info('規則檢查完成 (請查看 Console)');
        });
    }
};

// 匯出 init 供 Router 呼叫
export const init = () => ScheduleManagement.init();
