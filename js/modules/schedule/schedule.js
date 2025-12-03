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
import { ScheduleView } from './schedule-view.js'; // 假設您有這個視圖檔
import { ScheduleCheck } from './schedule-check.js'; // 規則檢查器

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
        console.log('[ScheduleMgmt] 初始化排班管理...');
        
        // 1. 初始化 DOM 元素綁定
        this.cacheDOM();
        
        // 2. 載入必要資料 (單位列表)
        await this.loadDependencies();
        
        // 3. 綁定事件
        this.bindEvents();
        
        // 4. 預設載入第一個單位與當前月份
        if (this.state.units.length > 0) {
            this.state.currentUnit = this.state.units[0];
            this.state.currentMonth = Utils.formatDate(new Date(), 'YYYY-MM');
            
            // 更新 UI 下拉選單
            if(this.dom.unitSelect) this.dom.unitSelect.value = this.state.currentUnit.id;
            if(this.dom.monthPicker) this.dom.monthPicker.value = this.state.currentMonth;
            
            // 載入班表
            await this.loadSchedule();
        }
    },

    cacheDOM() {
        this.dom = {
            container: document.getElementById('schedule-container'),
            unitSelect: document.getElementById('select-unit'),
            monthPicker: document.getElementById('input-month'),
            btnSave: document.getElementById('btn-save-schedule'),
            btnAuto: document.getElementById('btn-auto-schedule'),
            btnBackup: document.getElementById('btn-backup-sheet'), // 備份按鈕
            btnCheck: document.getElementById('btn-check-rules')
        };
    },

    /**
     * 載入依賴資料 (單位、人員)
     * ✅ 修正：改用 UnitService (Firebase)
     */
    async loadDependencies() {
        try {
            // 取得使用者權限，如果是 Manager 只能看自己的單位
            const user = Auth.getCurrentUser();
            let allUnits = await UnitService.getAllUnits();

            // 簡單的權限過濾 (如果是 Admin 看全部，Manager 看自己)
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
        
        this.dom.unitSelect.innerHTML = this.state.units
            .map(unit => `<option value="${unit.id}">${unit.name}</option>`)
            .join('');
            
        // 如果沒單位，顯示空
        if (this.state.units.length === 0) {
            this.dom.unitSelect.innerHTML = '<option value="">無可用單位</option>';
        }
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
        if(this.dom.container) this.dom.container.innerHTML = '<div class="loading">載入班表資料...</div>';

        try {
            // 1. 同步載入：班表 + 該單位人員名單
            const [schedule, unitStaff] = await Promise.all([
                ScheduleService.getSchedule(unitId, month),
                UnitService.getUnitStaff(unitId) // 取得該單位所有 User
            ]);

            this.state.schedule = schedule;
            this.state.staffList = unitStaff;

            console.log(`[ScheduleMgmt] 載入完成: ${month} (人員: ${unitStaff.length})`);

            // 2. 渲染班表視圖
            this.renderView();

        } catch (error) {
            console.error('[ScheduleMgmt] 載入班表失敗:', error);
            Notification.error('載入班表失敗，請稍後再試');
            if(this.dom.container) this.dom.container.innerHTML = '<div class="error">載入失敗</div>';
        }
    },

    renderView() {
        // 呼叫 View 模組進行渲染 (假設您有 ScheduleView)
        // 這裡簡單示範，若您原本有 ScheduleView.render(container, data, staff) 請保留
        if (typeof ScheduleView !== 'undefined' && ScheduleView.render) {
            ScheduleView.render(this.dom.container, this.state.schedule, this.state.staffList);
        } else {
            this.dom.container.innerHTML = `
                <div class="alert alert-info">
                    班表資料已載入 (Status: ${this.state.schedule.status})<br>
                    請確認 ScheduleView 是否已實作。
                </div>
            `;
        }
    },

    /**
     * 儲存班表
     */
    async handleSave() {
        try {
            // 收集 View 中的最新資料 (假設 View 有提供 getData 方法)
            // const currentShifts = ScheduleView.getData(); 
            // 這裡暫時用 state 中的資料示範
            const scheduleData = this.state.schedule; 
            
            await ScheduleService.saveSchedule(scheduleData);
            Notification.success('班表儲存成功 (Firebase)');
            
        } catch (error) {
            console.error(error);
            Notification.error('儲存失敗');
        }
    },

    /**
     * 備份至 Google Sheets
     */
    async handleBackup() {
        if (!confirm('確定要將目前班表備份至 Google Sheets 嗎？')) return;
        
        try {
            Notification.info('正在備份中...');
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
        // 單位切換
        this.dom.unitSelect?.addEventListener('change', (e) => {
            this.state.currentUnit = this.state.units.find(u => u.id === e.target.value);
            this.loadSchedule();
        });

        // 月份切換
        this.dom.monthPicker?.addEventListener('change', (e) => {
            this.state.currentMonth = e.target.value;
            this.loadSchedule();
        });

        // 按鈕事件
        this.dom.btnSave?.addEventListener('click', () => this.handleSave());
        this.dom.btnBackup?.addEventListener('click', () => this.handleBackup());
        
        // 自動排班與檢查 (預留)
        this.dom.btnCheck?.addEventListener('click', () => {
             const result = ScheduleCheck.validateUserSchedule(this.state.schedule.shifts, this.state.currentUnit.rules);
             console.log('檢查結果:', result);
             Notification.info('規則檢查完成 (請看 Console)');
        });
    }
};

// 為了讓 Router 可以呼叫，匯出 init
export const init = () => ScheduleManagement.init();
