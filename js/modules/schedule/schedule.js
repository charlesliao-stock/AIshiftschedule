/**
 * js/modules/schedule/schedule.js
 * 排班管理主模組 (ES Module 版 - 完整實作)
 */

import { Auth } from '../../core/auth.js';
import { Notification } from '../../components/notification.js';
import { Loading } from '../../components/loading.js';
import { Modal } from '../../components/modal.js';
import { SheetsService } from '../../services/sheets.service.js';
import { API_CONFIG } from '../../config/api.config.js';
import { Schedule } from '../../models/schedule.model.js';
import { Staff } from '../../models/staff.model.js';
import { Shift } from '../../models/shift.model.js';
import { ScheduleView } from './schedule-view.js';
import { ManualSchedule } from './manual-schedule.js';
import { AISchedule } from './ai-schedule.js'; // Week 6 (簡易版 Week 4)

export const ScheduleManagement = {
    unitId: null,
    currentYear: new Date().getFullYear(),
    currentMonth: new Date().getMonth() + 1,
    schedule: null,
    staffList: [],
    shifts: [],
    holidays: [],
    viewMode: 'calendar', // calendar, list
    
    async init() {
        console.log('[ScheduleManagement] 初始化排班管理');
        
        const user = Auth.getCurrentUser();
        // 注意：這裡使用 user.unit_id 還是 user.unitId 取決於 Auth 的實作，建議統一
        this.unitId = user.unit_id || user.unitId;
        
        if (!this.unitId) {
            Notification.error('找不到所屬單位');
            return;
        }
        
        this.render();
        await this.loadDependencies();
        await this.loadSchedule();
    },
    
    render() {
        const mainContent = document.getElementById('main-content');
        if (!mainContent) return;

        const user = Auth.getCurrentUser();
        const canEdit = Auth.isAdmin() || Auth.isScheduler();
        
        mainContent.innerHTML = `
            <div class="schedule-page">
                <div class="page-header" style="margin-bottom: 24px;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <h1 style="font-size: 28px; font-weight: 700; margin: 0 0 8px 0;">排班管理</h1>
                            <p style="color: #666; margin: 0;">${user.unit_name || ''}</p>
                        </div>
                        <div style="display: flex; gap: 12px; align-items: center;">
                            <select id="year-select" class="form-select" style="width: 100px;">
                                <option value="${this.currentYear - 1}">${this.currentYear - 1}</option>
                                <option value="${this.currentYear}" selected>${this.currentYear}</option>
                                <option value="${this.currentYear + 1}">${this.currentYear + 1}</option>
                            </select>
                            <select id="month-select" class="form-select" style="width: 80px;">
                                ${Array.from({length: 12}, (_, i) => i + 1).map(m => 
                                    `<option value="${m}" ${m === this.currentMonth ? 'selected' : ''}>${m}月</option>`
                                ).join('')}
                            </select>
                            
                            ${canEdit ? `
                                <button class="btn btn-secondary" id="manual-schedule-btn">
                                    ✏️ 手動排班
                                </button>
                                <button class="btn btn-primary" id="ai-schedule-btn">
                                    🤖 AI 排班
                                </button>
                            ` : ''}
                        </div>
                    </div>
                </div>
                
                <div class="stats-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 24px;">
                    <div class="stat-card">
                        <div class="stat-card-header">
                            <span class="stat-card-title">排班狀態</span>
                            <div class="stat-card-icon" style="background: linear-gradient(135deg, #667eea, #764ba2);">📋</div>
                        </div>
                        <div class="stat-card-value" id="schedule-status">草稿</div>
                    </div>
                    
                    <div class="stat-card">
                        <div class="stat-card-header">
                            <span class="stat-card-title">完成度</span>
                            <div class="stat-card-icon" style="background: linear-gradient(135deg, #43e97b, #38f9d7);">✓</div>
                        </div>
                        <div class="stat-card-value" id="schedule-completeness">0%</div>
                    </div>
                    
                    <div class="stat-card">
                        <div class="stat-card-header">
                            <span class="stat-card-title">總人數</span>
                            <div class="stat-card-icon" style="background: linear-gradient(135deg, #f093fb, #f5576c);">👥</div>
                        </div>
                        <div class="stat-card-value" id="total-staff">0</div>
                    </div>
                </div>
                
                <div class="card">
                    <div class="card-header" style="display: flex; justify-content: space-between; align-items: center;">
                        <div style="display: flex; gap: 12px;">
                            <button class="btn btn-sm ${this.viewMode === 'calendar' ? 'btn-primary' : 'btn-secondary'}" id="view-calendar-btn">
                                📅 日曆視圖
                            </button>
                            <button class="btn btn-sm ${this.viewMode === 'list' ? 'btn-primary' : 'btn-secondary'}" id="view-list-btn">
                                📋 列表視圖
                            </button>
                        </div>
                        ${canEdit ? `
                            <div style="display: flex; gap: 12px;">
                                <button class="btn btn-secondary btn-sm" id="clear-schedule-btn">
                                    🗑️ 清空
                                </button>
                                <button class="btn btn-success btn-sm" id="publish-schedule-btn">
                                    📢 公告排班表
                                </button>
                            </div>
                        ` : ''}
                    </div>
                    <div class="card-body" style="padding: 0;">
                        <div id="schedule-content-container">
                            <div style="padding: 60px; text-align: center; color: #999;">
                                <div class="loader-spinner" style="margin: 0 auto 16px;"></div>
                                <p>載入中...</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        this.bindEvents();
    },
    
    bindEvents() {
        // 年月選擇
        document.getElementById('year-select')?.addEventListener('change', (e) => {
            this.currentYear = parseInt(e.target.value);
            this.loadSchedule();
        });
        
        document.getElementById('month-select')?.addEventListener('change', (e) => {
            this.currentMonth = parseInt(e.target.value);
            this.loadSchedule();
        });
        
        // 視圖切換
        document.getElementById('view-calendar-btn')?.addEventListener('click', () => {
            this.viewMode = 'calendar';
            this.renderScheduleContent();
            // 更新按鈕樣式
            document.getElementById('view-calendar-btn').className = 'btn btn-sm btn-primary';
            document.getElementById('view-list-btn').className = 'btn btn-sm btn-secondary';
        });
        
        document.getElementById('view-list-btn')?.addEventListener('click', () => {
            this.viewMode = 'list';
            this.renderScheduleContent();
            document.getElementById('view-calendar-btn').className = 'btn btn-sm btn-secondary';
            document.getElementById('view-list-btn').className = 'btn btn-sm btn-primary';
        });
        
        // 排班操作
        document.getElementById('manual-schedule-btn')?.addEventListener('click', () => {
            ManualSchedule.open(this.schedule, this.staffList, this.shifts);
        });
        
        document.getElementById('ai-schedule-btn')?.addEventListener('click', () => {
            AISchedule.open(this.schedule, this.staffList, this.shifts);
        });
        
        document.getElementById('clear-schedule-btn')?.addEventListener('click', () => {
            this.clearSchedule();
        });
        
        document.getElementById('publish-schedule-btn')?.addEventListener('click', () => {
            this.publishSchedule();
        });
    },
    
    async loadDependencies() {
        try {
            // 注意：這裡使用 API_CONFIG.ENDPOINTS.SETTINGS... 
            // 需確保 api.config.js 的結構正確，如果結構有變，請調整這裡
            const [staffResult, shiftsResult, holidaysResult] = await Promise.all([
                SheetsService.post(API_CONFIG.ENDPOINTS.SETTINGS.GET_STAFF, { unit_id: this.unitId }),
                SheetsService.post(API_CONFIG.ENDPOINTS.SETTINGS.GET_SHIFTS, { unit_id: this.unitId }),
                SheetsService.post(API_CONFIG.ENDPOINTS.SETTINGS.GET_HOLIDAYS, { unit_id: this.unitId })
            ]);
            
            this.staffList = staffResult.success && staffResult.data ? staffResult.data.map(s => Staff.fromObject(s)) : [];
            this.shifts = shiftsResult.success && shiftsResult.data ? shiftsResult.data.map(s => Shift.fromObject(s)) : Shift.getDefaults();
            this.holidays = holidaysResult.success && holidaysResult.data ? holidaysResult.data : [];
            
            // 更新統計
            const totalStaffEl = document.getElementById('total-staff');
            if (totalStaffEl) totalStaffEl.textContent = this.staffList.length;
            
        } catch (error) {
            console.error('[ScheduleManagement] 載入依賴資料失敗:', error);
            Notification.error('載入基礎資料失敗');
        }
    },
    
    async loadSchedule() {
        try {
            Loading.show('載入排班表...');
            
            const result = await SheetsService.post(
                API_CONFIG.ENDPOINTS.SCHEDULE.GET,
                {
                    unit_id: this.unitId,
                    year: this.currentYear,
                    month: this.currentMonth
                }
            );
            
            if (result.success && result.data) {
                this.schedule = Schedule.fromObject(result.data);
            } else {
                // 建立空排班表
                this.schedule = Schedule.createEmpty(this.currentYear, this.currentMonth, this.unitId);
            }
            
            this.renderScheduleContent();
            this.updateStatistics();
            
            Loading.hide();
            
        } catch (error) {
            Loading.hide();
            console.error('[ScheduleManagement] 載入排班表失敗:', error);
            Notification.error('載入排班表失敗: ' + error.message);
            this.schedule = Schedule.createEmpty(this.currentYear, this.currentMonth, this.unitId);
            this.renderScheduleContent();
        }
    },
    
    renderScheduleContent() {
        const container = document.getElementById('schedule-content-container');
        if (!container) return;
        
        if (this.viewMode === 'calendar') {
            ScheduleView.renderCalendar(
                container,
                this.schedule,
                this.staffList,
                this.shifts,
                this.holidays
            );
        } else {
            container.innerHTML = '<div class="card-body"><p>列表視圖開發中...</p></div>';
        }
    },
    
    updateStatistics() {
        // 排班狀態
        const statusEl = document.getElementById('schedule-status');
        if (statusEl) {
            statusEl.textContent = this.schedule.status === 'published' ? '已公告' : '草稿';
        }
        
        // 完成度
        const completenessEl = document.getElementById('schedule-completeness');
        if (completenessEl && this.staffList.length > 0) {
            const totalDays = this.schedule.getAllDates().length;
            const totalSlots = this.staffList.length * totalDays;
            let filledSlots = 0;
            
            this.staffList.forEach(staff => {
                const staffSchedule = this.schedule.getStaffSchedule(staff.id);
                filledSlots += Object.keys(staffSchedule).length;
            });
            
            const completeness = totalSlots > 0 ? Math.round((filledSlots / totalSlots) * 100) : 0;
            completenessEl.textContent = completeness + '%';
        }
    },
    
    async clearSchedule() {
        const confirmed = await Modal.confirm(
            '確定要清空當月排班嗎？\n\n⚠️ 此操作無法復原。',
            { danger: true }
        );
        
        if (confirmed) {
            this.schedule.clearAll();
            this.renderScheduleContent();
            this.updateStatistics();
            Notification.success('排班已清空');
        }
    },
    
    async publishSchedule() {
        const confirmed = await Modal.confirm(
            '確定要公告排班表嗎？\n\n公告後員工將可以查看和申請換班。',
            { confirmText: '公告' }
        );
        
        if (confirmed) {
            try {
                Loading.show('公告排班表...');
                
                this.schedule.status = 'published';
                this.schedule.publishedAt = new Date().toISOString();
                this.schedule.publishedBy = Auth.getCurrentUser().uid;
                
                await this.saveSchedule();
                
                Loading.hide();
                Notification.success('排班表已公告！');
                this.updateStatistics();
                
            } catch (error) {
                Loading.hide();
                Notification.error('公告失敗: ' + error.message);
            }
        }
    },
    
    async saveSchedule() {
        try {
            const result = await SheetsService.post(
                API_CONFIG.ENDPOINTS.SCHEDULE.SAVE,
                {
                    unit_id: this.unitId,
                    schedule: this.schedule.toObject()
                }
            );
            
            if (!result.success) {
                throw new Error(result.message || '儲存失敗');
            }
            
            SheetsService.clearCache('getSchedule'); // 清除快取
            
        } catch (error) {
            console.error('[ScheduleManagement] 儲存失敗:', error);
            throw error;
        }
    },
    
    async refresh() {
        await this.loadSchedule();
        Notification.success('已重新載入');
    }
};