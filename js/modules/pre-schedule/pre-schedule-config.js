/**
 * js/modules/pre-schedule/pre-schedule-config.js
 * 預班設定功能 (ES Module 版 - 完整實作)
 */

import { PreScheduleService } from '../../services/pre-schedule.service.js';
import { Notification } from '../../components/notification.js';
import { Loading } from '../../components/loading.js';

export const PreScheduleConfig = {
    currentMonth: null,
    currentUnit: null,
    config: null,

    async init(month, unitId) {
        try {
            this.currentMonth = month;
            this.currentUnit = unitId;
            await this.loadConfig();
            this.initializeUI();
            this.bindEvents();
        } catch (error) {
            console.error('初始化預班設定失敗:', error);
            Notification.error('初始化失敗');
        }
    },

    async loadConfig() {
        try {
            this.config = await PreScheduleService.getPreScheduleConfig(this.currentMonth);
            if (!this.config) {
                this.config = this.getDefaultConfig();
            }
        } catch (error) {
            this.config = this.getDefaultConfig();
        }
    },

    getDefaultConfig() {
        const year = parseInt(this.currentMonth.substring(0, 4));
        const month = parseInt(this.currentMonth.substring(4, 6));
        const prevMonth = month === 1 ? 12 : month - 1;
        const prevYear = month === 1 ? year - 1 : year;
        
        return {
            month: this.currentMonth,
            status: 'draft',
            openDate: `${prevYear}-${prevMonth.toString().padStart(2, '0')}-01`,
            closeDate: `${prevYear}-${prevMonth.toString().padStart(2, '0')}-15`,
            monthlyLimit: 4,
            allowedShifts: ['FF', '大', '小'],
            countFFToLimit: true,
            notifyOnOpen: true
        };
    },

    initializeUI() {
        const container = document.getElementById('preScheduleConfigPanel');
        if (!container) return;

        container.innerHTML = `
            <div class="config-panel p-3 border rounded mb-3">
                <h4 class="mb-3">預班設定 - ${this.currentMonth}</h4>
                <form id="preScheduleConfigForm">
                    <div class="mb-3">
                        <label class="form-label">狀態</label>
                        <select id="statusSelect" class="form-select" ${this.config.status === 'locked' ? 'disabled' : ''}>
                            <option value="draft" ${this.config.status === 'draft' ? 'selected' : ''}>草稿</option>
                            <option value="open" ${this.config.status === 'open' ? 'selected' : ''}>開放中</option>
                            <option value="closed" ${this.config.status === 'closed' ? 'selected' : ''}>已截止</option>
                            <option value="locked" ${this.config.status === 'locked' ? 'selected' : ''}>已鎖定</option>
                        </select>
                    </div>
                    <div class="row mb-3">
                        <div class="col">
                            <label class="form-label">開放日期</label>
                            <input type="date" id="openDateInput" class="form-control" value="${this.config.openDate}">
                        </div>
                        <div class="col">
                            <label class="form-label">截止日期</label>
                            <input type="date" id="closeDateInput" class="form-control" value="${this.config.closeDate}">
                        </div>
                    </div>
                    <div class="mb-3">
                        <label class="form-label">每月預班上限</label>
                        <input type="number" id="monthlyLimitInput" class="form-control" value="${this.config.monthlyLimit}">
                    </div>
                    <div class="d-flex justify-content-end gap-2">
                        <button type="button" class="btn btn-secondary" id="resetConfigBtn">重設</button>
                        <button type="button" class="btn btn-primary" id="saveConfigBtn">儲存設定</button>
                    </div>
                </form>
            </div>
        `;
    },

    bindEvents() {
        document.getElementById('saveConfigBtn')?.addEventListener('click', () => this.handleSave());
        document.getElementById('resetConfigBtn')?.addEventListener('click', () => this.handleReset());
    },

    async handleSave() {
        try {
            Loading.show('儲存中...');
            const formData = {
                month: this.currentMonth,
                status: document.getElementById('statusSelect').value,
                openDate: document.getElementById('openDateInput').value,
                closeDate: document.getElementById('closeDateInput').value,
                monthlyLimit: parseInt(document.getElementById('monthlyLimitInput').value)
            };

            await PreScheduleService.savePreScheduleConfig(formData);
            this.config = formData;
            Notification.success('設定已儲存');
        } catch (error) {
            Notification.error('儲存失敗');
        } finally {
            Loading.hide();
        }
    },

    handleReset() {
        if (confirm('確定要重設為預設值嗎？')) {
            this.config = this.getDefaultConfig();
            this.initializeUI();
            this.bindEvents();
        }
    }
};
