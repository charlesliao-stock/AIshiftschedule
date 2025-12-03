/**
 * js/modules/statistics/statistics.js
 * 統計報表主控模組
 * Week 7 功能
 */

import { ScheduleService } from '../../services/schedule.service.js';
import { SettingsService } from '../../services/settings.service.js';
import { PersonalStats } from './personal-stats.js';
import { UnitStats } from './unit-stats.js';
import { ExportReport } from './export-report.js';
import { Notification } from '../../components/notification.js';
import { Loading } from '../../components/loading.js';
import { Auth } from '../../core/auth.js';

export class Statistics {
    constructor() {
        this.personalStats = new PersonalStats();
        this.unitStats = new UnitStats();
        this.exportReport = new ExportReport();
        
        this.currentMonth = null;
        this.currentUser = null;
        this.userRole = null;
        
        this.customStatItems = [];
        this.defaultStatItems = [];
    }

    /**
     * 初始化統計模組
     */
    async init() {
        try {
            Loading.show('載入統計資料...');

            // 取得當前使用者資訊
            this.currentUser = Auth.getCurrentUser();
            this.userRole = this.currentUser?.role || 'viewer';

            // 載入自訂統計項目
            await this.loadCustomStatItems();
            
            // 載入預設統計項目
            this.loadDefaultStatItems();

            // 初始化子模組
            await this.personalStats.init();
            await this.unitStats.init();
            await this.exportReport.init();

            // 設定當前月份
            this.currentMonth = this.getCurrentMonth();

            // 渲染介面
            await this.render();

            Loading.hide();

        } catch (error) {
            Loading.hide();
            console.error('初始化統計模組失敗:', error);
            Notification.error('統計模組初始化失敗：' + error.message);
        }
    }

    /**
     * 載入自訂統計項目
     */
    async loadCustomStatItems() {
        try {
            const settings = await SettingsService.getSettings();
            this.customStatItems = settings?.customStatistics || [];
        } catch (error) {
            console.error('載入自訂統計項目失敗:', error);
            this.customStatItems = [];
        }
    }

    /**
     * 載入預設統計項目
     */
    loadDefaultStatItems() {
        this.defaultStatItems = [
            {
                id: 'work_days',
                name: '總工作天數',
                formula: 'COUNT(非FF班別)',
                enabled: true,
                category: 'basic'
            },
            {
                id: 'off_days',
                name: '休假天數',
                formula: 'COUNT(FF)',
                enabled: true,
                category: 'basic'
            },
            {
                id: 'overtime_days',
                name: '加班天數',
                formula: '總工作天數 - 標準工作天數',
                enabled: true,
                category: 'work'
            },
            {
                id: 'holiday_work',
                name: '假日上班天數',
                formula: 'COUNT(假日且非FF)',
                enabled: true,
                category: 'holiday'
            },
            {
                id: 'night_shift_major',
                name: '大夜班數',
                formula: 'COUNT(大)',
                enabled: true,
                category: 'shift'
            },
            {
                id: 'night_shift_minor',
                name: '小夜班數',
                formula: 'COUNT(小)',
                enabled: true,
                category: 'shift'
            },
            {
                id: 'day_shift',
                name: '白班數',
                formula: 'COUNT(白)',
                enabled: true,
                category: 'shift'
            },
            {
                id: 'dl_shift',
                name: 'DL班數',
                formula: 'COUNT(DL)',
                enabled: false,
                category: 'shift'
            },
            {
                id: 'consecutive_max',
                name: '最長連續工作',
                formula: 'MAX(連續工作天數)',
                enabled: true,
                category: 'work'
            },
            {
                id: 'swap_count',
                name: '換班次數',
                formula: 'COUNT(換班記錄)',
                enabled: true,
                category: 'other'
            }
        ];
    }

    /**
     * 渲染統計介面
     */
    async render() {
        const container = document.getElementById('statistics-container');
        if (!container) return;

        container.innerHTML = `
            <div class="statistics-page">
                <!-- 頁籤切換 -->
                <div class="stats-tabs">
                    <button class="tab-btn active" data-tab="personal">
                        個人統計
                    </button>
                    ${this.userRole !== 'viewer' ? `
                        <button class="tab-btn" data-tab="unit">
                            單位統計
                        </button>
                    ` : ''}
                    <button class="tab-btn" data-tab="custom">
                        自訂統計
                    </button>
                </div>

                <!-- 工具列 -->
                <div class="stats-toolbar">
                    <div class="month-selector">
                        <button id="prevMonthBtn" class="btn-icon">
                            <i class="icon-arrow-left"></i>
                        </button>
                        <input type="month" id="monthInput" value="${this.currentMonth}">
                        <button id="nextMonthBtn" class="btn-icon">
                            <i class="icon-arrow-right"></i>
                        </button>
                    </div>

                    <div class="export-buttons">
                        <button id="exportPdfBtn" class="btn btn-secondary">
                            <i class="icon-file-pdf"></i> 匯出 PDF
                        </button>
                        <button id="exportExcelBtn" class="btn btn-secondary">
                            <i class="icon-file-excel"></i> 匯出 Excel
                        </button>
                        <button id="exportCsvBtn" class="btn btn-secondary">
                            <i class="icon-file-csv"></i> 匯出 CSV
                        </button>
                    </div>
                </div>

                <!-- 統計內容區 -->
                <div class="stats-content">
                    <div id="personalStatsPanel" class="stats-panel active">
                        <!-- 個人統計內容 -->
                    </div>

                    ${this.userRole !== 'viewer' ? `
                        <div id="unitStatsPanel" class="stats-panel">
                            <!-- 單位統計內容 -->
                        </div>
                    ` : ''}

                    <div id="customStatsPanel" class="stats-panel">
                        <!-- 自訂統計內容 -->
                    </div>
                </div>
            </div>
        `;

        // 綁定事件
        this.bindEvents();

        // 載入個人統計（預設顯示）
        await this.loadPersonalStats();
    }

    /**
     * 綁定事件
     */
    bindEvents() {
        // 頁籤切換
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
        });

        // 月份切換
        document.getElementById('prevMonthBtn')?.addEventListener('click', () => {
            this.changeMonth(-1);
        });

        document.getElementById('nextMonthBtn')?.addEventListener('click', () => {
            this.changeMonth(1);
        });

        document.getElementById('monthInput')?.addEventListener('change', (e) => {
            this.currentMonth = e.target.value;
            this.reloadCurrentPanel();
        });

        // 匯出按鈕
        document.getElementById('exportPdfBtn')?.addEventListener('click', () => {
            this.exportCurrentStats('pdf');
        });

        document.getElementById('exportExcelBtn')?.addEventListener('click', () => {
            this.exportCurrentStats('excel');
        });

        document.getElementById('exportCsvBtn')?.addEventListener('click', () => {
            this.exportCurrentStats('csv');
        });
    }

    /**
     * 切換頁籤
     */
    async switchTab(tabName) {
        // 更新頁籤樣式
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });

        // 更新面板顯示
        document.querySelectorAll('.stats-panel').forEach(panel => {
            panel.classList.remove('active');
        });

        // 載入對應統計
        switch (tabName) {
            case 'personal':
                document.getElementById('personalStatsPanel').classList.add('active');
                await this.loadPersonalStats();
                break;

            case 'unit':
                document.getElementById('unitStatsPanel').classList.add('active');
                await this.loadUnitStats();
                break;

            case 'custom':
                document.getElementById('customStatsPanel').classList.add('active');
                await this.loadCustomStats();
                break;
        }
    }

    /**
     * 載入個人統計
     */
    async loadPersonalStats() {
        try {
            Loading.show('載入個人統計...');

            const container = document.getElementById('personalStatsPanel');
            if (!container) return;

            // 取得個人排班資料
            const schedule = await ScheduleService.getMonthSchedule(this.currentMonth);
            const staffSchedule = schedule[this.currentUser.staffId] || {};

            // 計算統計資料
            const stats = await this.personalStats.calculate(
                this.currentUser.staffId,
                this.currentMonth,
                staffSchedule
            );

            // 渲染統計
            await this.personalStats.render(container, stats);

            Loading.hide();

        } catch (error) {
            Loading.hide();
            console.error('載入個人統計失敗:', error);
            Notification.error('載入個人統計失敗：' + error.message);
        }
    }

    /**
     * 載入單位統計
     */
    async loadUnitStats() {
        try {
            Loading.show('載入單位統計...');

            const container = document.getElementById('unitStatsPanel');
            if (!container) return;

            // 取得單位排班資料
            const schedule = await ScheduleService.getMonthSchedule(this.currentMonth);

            // 計算統計資料
            const stats = await this.unitStats.calculate(
                this.currentMonth,
                schedule
            );

            // 渲染統計
            await this.unitStats.render(container, stats);

            Loading.hide();

        } catch (error) {
            Loading.hide();
            console.error('載入單位統計失敗:', error);
            Notification.error('載入單位統計失敗：' + error.message);
        }
    }

    /**
     * 載入自訂統計
     */
    async loadCustomStats() {
        const container = document.getElementById('customStatsPanel');
        if (!container) return;

        container.innerHTML = `
            <div class="custom-stats">
                <div class="section-header">
                    <h3>自訂統計項目</h3>
                    <button id="addCustomStatBtn" class="btn btn-primary">
                        <i class="icon-plus"></i> 新增統計項目
                    </button>
                </div>

                <div class="stat-items-list">
                    ${this.renderStatItemsList()}
                </div>
            </div>
        `;

        // 綁定事件
        document.getElementById('addCustomStatBtn')?.addEventListener('click', () => {
            this.showAddStatItemDialog();
        });

        // 綁定編輯/刪除事件
        this.bindStatItemsEvents();
    }

    /**
     * 渲染統計項目列表
     */
    renderStatItemsList() {
        const allItems = [...this.defaultStatItems, ...this.customStatItems];

        return allItems.map(item => `
            <div class="stat-item" data-id="${item.id}">
                <div class="stat-item-info">
                    <div class="stat-name">${item.name}</div>
                    <div class="stat-formula">${item.formula}</div>
                </div>
                <div class="stat-item-actions">
                    <label class="switch">
                        <input type="checkbox" 
                               data-id="${item.id}" 
                               ${item.enabled ? 'checked' : ''}>
                        <span class="slider"></span>
                    </label>
                    ${item.category === 'custom' ? `
                        <button class="btn-icon edit-stat" data-id="${item.id}">
                            <i class="icon-edit"></i>
                        </button>
                        <button class="btn-icon delete-stat" data-id="${item.id}">
                            <i class="icon-delete"></i>
                        </button>
                    ` : ''}
                </div>
            </div>
        `).join('');
    }

    /**
     * 綁定統計項目事件
     */
    bindStatItemsEvents() {
        // 啟用/停用切換
        document.querySelectorAll('.stat-item input[type="checkbox"]').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                this.toggleStatItem(e.target.dataset.id, e.target.checked);
            });
        });

        // 編輯
        document.querySelectorAll('.edit-stat').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.editStatItem(e.currentTarget.dataset.id);
            });
        });

        // 刪除
        document.querySelectorAll('.delete-stat').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.deleteStatItem(e.currentTarget.dataset.id);
            });
        });
    }

    /**
     * 顯示新增統計項目對話框
     */
    showAddStatItemDialog() {
        // 實作新增對話框
        Notification.info('新增統計項目功能開發中...');
    }

    /**
     * 切換統計項目啟用狀態
     */
    async toggleStatItem(id, enabled) {
        try {
            // 更新本地狀態
            const item = this.defaultStatItems.find(i => i.id === id) ||
                        this.customStatItems.find(i => i.id === id);
            
            if (item) {
                item.enabled = enabled;
            }

            // 儲存設定
            await this.saveStatSettings();

            Notification.success(`統計項目已${enabled ? '啟用' : '停用'}`);

        } catch (error) {
            console.error('切換統計項目失敗:', error);
            Notification.error('操作失敗');
        }
    }

    /**
     * 編輯統計項目
     */
    editStatItem(id) {
        Notification.info('編輯統計項目功能開發中...');
    }

    /**
     * 刪除統計項目
     */
    async deleteStatItem(id) {
        if (!confirm('確定要刪除此統計項目？')) return;

        try {
            this.customStatItems = this.customStatItems.filter(item => item.id !== id);
            await this.saveStatSettings();
            
            // 重新渲染
            await this.loadCustomStats();
            
            Notification.success('統計項目已刪除');

        } catch (error) {
            console.error('刪除統計項目失敗:', error);
            Notification.error('刪除失敗');
        }
    }

    /**
     * 儲存統計設定
     */
    async saveStatSettings() {
        try {
            const settings = {
                defaultStatistics: this.defaultStatItems,
                customStatistics: this.customStatItems
            };

            await SettingsService.updateSettings('statistics', settings);

        } catch (error) {
            console.error('儲存統計設定失敗:', error);
            throw error;
        }
    }

    /**
     * 改變月份
     */
    async changeMonth(offset) {
        const date = new Date(this.currentMonth + '-01');
        date.setMonth(date.getMonth() + offset);
        
        this.currentMonth = date.getFullYear() + '-' + 
                           String(date.getMonth() + 1).padStart(2, '0');
        
        document.getElementById('monthInput').value = this.currentMonth;
        
        await this.reloadCurrentPanel();
    }

    /**
     * 重新載入當前面板
     */
    async reloadCurrentPanel() {
        const activeTab = document.querySelector('.tab-btn.active');
        if (activeTab) {
            await this.switchTab(activeTab.dataset.tab);
        }
    }

    /**
     * 匯出當前統計
     */
    async exportCurrentStats(format) {
        try {
            Loading.show(`匯出 ${format.toUpperCase()} 中...`);

            const activeTab = document.querySelector('.tab-btn.active');
            const tabName = activeTab?.dataset.tab || 'personal';

            let data, filename;

            switch (tabName) {
                case 'personal':
                    data = await this.personalStats.getExportData();
                    filename = `個人統計_${this.currentMonth}`;
                    break;

                case 'unit':
                    data = await this.unitStats.getExportData();
                    filename = `單位統計_${this.currentMonth}`;
                    break;

                case 'custom':
                    data = await this.getCustomStatsExportData();
                    filename = `自訂統計_${this.currentMonth}`;
                    break;
            }

            await this.exportReport.export(data, format, filename);

            Loading.hide();
            Notification.success(`${format.toUpperCase()} 匯出成功`);

        } catch (error) {
            Loading.hide();
            console.error('匯出失敗:', error);
            Notification.error('匯出失敗：' + error.message);
        }
    }

    /**
     * 取得自訂統計匯出資料
     */
    async getCustomStatsExportData() {
        // 實作自訂統計匯出
        return {
            title: '自訂統計報表',
            month: this.currentMonth,
            items: this.customStatItems
        };
    }

    /**
     * 取得當前月份
     */
    getCurrentMonth() {
        const now = new Date();
        return now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
    }

    /**
     * 取得所有啟用的統計項目
     */
    getEnabledStatItems() {
        return [...this.defaultStatItems, ...this.customStatItems]
            .filter(item => item.enabled);
    }

    /**
     * 銷毀模組
     */
    destroy() {
        // 清理事件監聽
        this.personalStats.destroy();
        this.unitStats.destroy();
        this.exportReport.destroy();
    }
}
