/**
 * 預班設定功能 (排班者專用)
 * 管理預班開放時間、限額等設定
 */

import { PreScheduleService } from '../../services/pre-schedule.service.js';
import { showNotification, showLoading, hideLoading } from '../../components/notification.js';

class PreScheduleConfig {
    constructor() {
        this.preScheduleService = new PreScheduleService();
        this.currentMonth = null;
        this.currentUnit = null;
        this.config = null;
    }

    /**
     * 初始化預班設定
     */
    async init(month, unitId) {
        try {
            this.currentMonth = month;
            this.currentUnit = unitId;

            // 載入現有設定
            await this.loadConfig();

            // 初始化UI
            this.initializeUI();

            // 綁定事件
            this.bindEvents();

        } catch (error) {
            console.error('初始化預班設定失敗:', error);
            showNotification('初始化失敗，請重新整理頁面', 'error');
        }
    }

    /**
     * 載入設定
     */
    async loadConfig() {
        try {
            this.config = await this.preScheduleService.getPreScheduleConfig(this.currentMonth);
            
            // 如果沒有設定，使用預設值
            if (!this.config) {
                this.config = this.getDefaultConfig();
            }

        } catch (error) {
            console.error('載入預班設定失敗:', error);
            this.config = this.getDefaultConfig();
        }
    }

    /**
     * 取得預設設定
     */
    getDefaultConfig() {
        const year = parseInt(this.currentMonth.substring(0, 4));
        const month = parseInt(this.currentMonth.substring(4, 6));
        
        // 預設：前一個月的1號開放，15號截止
        const prevMonth = month === 1 ? 12 : month - 1;
        const prevYear = month === 1 ? year - 1 : year;
        
        return {
            month: this.currentMonth,
            status: 'draft', // draft, open, closed, locked
            openDate: `${prevYear}-${prevMonth.toString().padStart(2, '0')}-01`,
            closeDate: `${prevYear}-${prevMonth.toString().padStart(2, '0')}-15`,
            monthlyLimit: 4,
            allowedShifts: ['FF', '大', '小'],
            countFFToLimit: true,
            countOthersToLimit: false,
            allowOverDailyLimit: true,
            notifyOnOpen: true,
            notifyBeforeClose: true,
            notifyDaysBefore: 3
        };
    }

    /**
     * 初始化UI
     */
    initializeUI() {
        const container = document.getElementById('preScheduleConfigPanel');
        if (!container) return;

        const statusText = this.getStatusText(this.config.status);
        const statusClass = this.getStatusClass(this.config.status);

        container.innerHTML = `
            <div class="config-panel">
                <div class="panel-header">
                    <h3>預班設定 - ${this.formatMonth(this.currentMonth)}</h3>
                    <span class="status-badge ${statusClass}">${statusText}</span>
                </div>

                <form id="preScheduleConfigForm" class="config-form">
                    
                    <!-- 預班狀態 -->
                    <div class="form-section">
                        <h4>預班狀態</h4>
                        <div class="form-group">
                            <label>目前狀態：</label>
                            <select id="statusSelect" class="form-control" ${this.config.status === 'locked' ? 'disabled' : ''}>
                                <option value="draft" ${this.config.status === 'draft' ? 'selected' : ''}>草稿（尚未開放）</option>
                                <option value="open" ${this.config.status === 'open' ? 'selected' : ''}>開放中</option>
                                <option value="closed" ${this.config.status === 'closed' ? 'selected' : ''}>已截止</option>
                                <option value="locked" ${this.config.status === 'locked' ? 'selected' : ''}>已鎖定（無法修改）</option>
                            </select>
                            <small class="form-text">
                                ${this.getStatusDescription(this.config.status)}
                            </small>
                        </div>
                    </div>

                    <!-- 日期設定 -->
                    <div class="form-section">
                        <h4>日期設定</h4>
                        <div class="form-row">
                            <div class="form-group">
                                <label>開放日期：</label>
                                <input type="date" 
                                       id="openDateInput" 
                                       class="form-control"
                                       value="${this.config.openDate}"
                                       ${this.config.status === 'locked' ? 'disabled' : ''}>
                                <small class="form-text">預班開放的日期</small>
                            </div>
                            <div class="form-group">
                                <label>截止日期：</label>
                                <input type="date" 
                                       id="closeDateInput" 
                                       class="form-control"
                                       value="${this.config.closeDate}"
                                       ${this.config.status === 'locked' ? 'disabled' : ''}>
                                <small class="form-text">預班截止的日期</small>
                            </div>
                        </div>
                    </div>

                    <!-- 限額設定 -->
                    <div class="form-section">
                        <h4>限額設定</h4>
                        <div class="form-group">
                            <label>每人每月預班上限：</label>
                            <input type="number" 
                                   id="monthlyLimitInput" 
                                   class="form-control"
                                   value="${this.config.monthlyLimit}"
                                   min="0"
                                   max="10"
                                   ${this.config.status === 'locked' ? 'disabled' : ''}>
                            <small class="form-text">
                                建議值：平均假日數 ÷ 2 = ${this.calculateSuggestedLimit()} 天
                            </small>
                        </div>

                        <div class="form-group">
                            <label>計入限額的班別：</label>
                            <div class="checkbox-group">
                                <label class="checkbox-label">
                                    <input type="checkbox" 
                                           id="countFFCheckbox"
                                           ${this.config.countFFToLimit ? 'checked' : ''}
                                           ${this.config.status === 'locked' ? 'disabled' : ''}>
                                    <span>OFF (休假) 計入限額</span>
                                </label>
                                <label class="checkbox-label">
                                    <input type="checkbox" 
                                           id="countOthersCheckbox"
                                           ${this.config.countOthersToLimit ? 'checked' : ''}
                                           ${this.config.status === 'locked' ? 'disabled' : ''}>
                                    <span>其他班別計入限額</span>
                                </label>
                            </div>
                            <small class="form-text">
                                建議：只有 OFF 計入限額，其他班別不計入
                            </small>
                        </div>
                    </div>

                    <!-- 班別限制 -->
                    <div class="form-section">
                        <h4>允許預班的班別</h4>
                        <div class="form-group">
                            <div id="allowedShiftsCheckboxes" class="checkbox-group">
                                <!-- 動態生成 -->
                            </div>
                            <small class="form-text">選擇使用者可以預班的班別</small>
                        </div>
                    </div>

                    <!-- 規則設定 -->
                    <div class="form-section">
                        <h4>規則設定</h4>
                        <div class="form-group">
                            <label class="checkbox-label">
                                <input type="checkbox" 
                                       id="allowOverDailyLimitCheckbox"
                                       ${this.config.allowOverDailyLimit ? 'checked' : ''}
                                       ${this.config.status === 'locked' ? 'disabled' : ''}>
                                <span>允許超過每日預班人數上限</span>
                            </label>
                            <small class="form-text">
                                勾選時：超過會顯示警告，但仍可送出<br>
                                不勾選時：超過則無法送出
                            </small>
                        </div>
                    </div>

                    <!-- 通知設定 -->
                    <div class="form-section">
                        <h4>通知設定</h4>
                        <div class="form-group">
                            <label class="checkbox-label">
                                <input type="checkbox" 
                                       id="notifyOnOpenCheckbox"
                                       ${this.config.notifyOnOpen ? 'checked' : ''}
                                       ${this.config.status === 'locked' ? 'disabled' : ''}>
                                <span>預班開放時發送通知</span>
                            </label>
                        </div>
                        <div class="form-group">
                            <label class="checkbox-label">
                                <input type="checkbox" 
                                       id="notifyBeforeCloseCheckbox"
                                       ${this.config.notifyBeforeClose ? 'checked' : ''}
                                       ${this.config.status === 'locked' ? 'disabled' : ''}>
                                <span>截止前發送提醒</span>
                            </label>
                            <div class="nested-control ${this.config.notifyBeforeClose ? '' : 'hidden'}" id="notifyDaysBeforeControl">
                                <label>提前天數：</label>
                                <input type="number" 
                                       id="notifyDaysBeforeInput" 
                                       class="form-control"
                                       value="${this.config.notifyDaysBefore || 3}"
                                       min="1"
                                       max="7"
                                       ${this.config.status === 'locked' ? 'disabled' : ''}>
                                <small class="form-text">在截止日前 N 天發送提醒</small>
                            </div>
                        </div>
                    </div>

                    <!-- 操作按鈕 -->
                    <div class="form-actions">
                        ${this.config.status !== 'locked' ? `
                            <button type="button" class="btn btn-secondary" id="resetConfigBtn">
                                重設為預設值
                            </button>
                            <button type="button" class="btn btn-primary" id="saveConfigBtn">
                                儲存設定
                            </button>
                            ${this.config.status === 'draft' ? `
                                <button type="button" class="btn btn-success" id="openPreScheduleBtn">
                                    🚀 開放預班
                                </button>
                            ` : ''}
                            ${this.config.status === 'open' ? `
                                <button type="button" class="btn btn-warning" id="closePreScheduleBtn">
                                    ⏸️ 提前截止
                                </button>
                            ` : ''}
                            ${this.config.status === 'closed' ? `
                                <button type="button" class="btn btn-info" id="reopenPreScheduleBtn">
                                    🔓 重新開放
                                </button>
                                <button type="button" class="btn btn-danger" id="lockPreScheduleBtn">
                                    🔒 鎖定預班
                                </button>
                            ` : ''}
                        ` : `
                            <div class="locked-message">
                                ⚠️ 預班已鎖定，無法修改設定。如需修改，請先解除鎖定。
                            </div>
                        `}
                    </div>

                </form>

                <!-- 預班統計 -->
                <div class="config-statistics">
                    <h4>預班統計</h4>
                    <div id="preScheduleStats" class="stats-grid">
                        <!-- 動態載入 -->
                    </div>
                </div>
            </div>
        `;

        // 載入班別選項
        this.loadShiftCheckboxes();

        // 載入統計資料
        this.loadStatistics();
    }

    /**
     * 載入班別選項
     */
    async loadShiftCheckboxes() {
        try {
            const shifts = await this.preScheduleService.getAvailableShifts();
            const container = document.getElementById('allowedShiftsCheckboxes');
            
            if (!container) return;

            container.innerHTML = shifts.map(shift => `
                <label class="checkbox-label">
                    <input type="checkbox" 
                           class="shift-checkbox"
                           value="${shift.code}"
                           ${this.config.allowedShifts.includes(shift.code) ? 'checked' : ''}
                           ${this.config.status === 'locked' ? 'disabled' : ''}>
                    <span style="color: ${shift.color}">${shift.name} (${shift.code})</span>
                </label>
            `).join('');

        } catch (error) {
            console.error('載入班別選項失敗:', error);
        }
    }

    /**
     * 載入統計資料
     */
    async loadStatistics() {
        try {
            const stats = await this.preScheduleService.getPreScheduleStatistics(this.currentMonth);
            const container = document.getElementById('preScheduleStats');
            
            if (!container) return;

            container.innerHTML = `
                <div class="stat-card">
                    <div class="stat-label">總員工數</div>
                    <div class="stat-value">${stats.totalStaff || 0}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">已提交預班</div>
                    <div class="stat-value">${stats.submittedStaff || 0}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">完成率</div>
                    <div class="stat-value">${stats.completionRate || 0}%</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">總預班天數</div>
                    <div class="stat-value">${stats.totalDays || 0}</div>
                </div>
            `;

        } catch (error) {
            console.error('載入統計資料失敗:', error);
        }
    }

    /**
     * 綁定事件
     */
    bindEvents() {
        // 儲存設定
        const saveBtn = document.getElementById('saveConfigBtn');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.handleSave());
        }

        // 重設設定
        const resetBtn = document.getElementById('resetConfigBtn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => this.handleReset());
        }

        // 開放預班
        const openBtn = document.getElementById('openPreScheduleBtn');
        if (openBtn) {
            openBtn.addEventListener('click', () => this.handleOpen());
        }

        // 截止預班
        const closeBtn = document.getElementById('closePreScheduleBtn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.handleClose());
        }

        // 重新開放
        const reopenBtn = document.getElementById('reopenPreScheduleBtn');
        if (reopenBtn) {
            reopenBtn.addEventListener('click', () => this.handleReopen());
        }

        // 鎖定預班
        const lockBtn = document.getElementById('lockPreScheduleBtn');
        if (lockBtn) {
            lockBtn.addEventListener('click', () => this.handleLock());
        }

        // 截止前通知開關
        const notifyBeforeCloseCheckbox = document.getElementById('notifyBeforeCloseCheckbox');
        if (notifyBeforeCloseCheckbox) {
            notifyBeforeCloseCheckbox.addEventListener('change', (e) => {
                const control = document.getElementById('notifyDaysBeforeControl');
                if (control) {
                    control.classList.toggle('hidden', !e.target.checked);
                }
            });
        }
    }

    /**
     * 處理儲存
     */
    async handleSave() {
        try {
            showLoading('儲存設定中...');

            // 收集表單資料
            const formData = this.collectFormData();

            // 驗證資料
            const validation = this.validateFormData(formData);
            if (!validation.valid) {
                hideLoading();
                showNotification(validation.message, 'error');
                return;
            }

            // 儲存到後端
            await this.preScheduleService.savePreScheduleConfig(formData);

            // 更新本地設定
            this.config = formData;

            hideLoading();
            showNotification('設定已儲存', 'success');

        } catch (error) {
            hideLoading();
            console.error('儲存設定失敗:', error);
            showNotification('儲存失敗，請稍後再試', 'error');
        }
    }

    /**
     * 收集表單資料
     */
    collectFormData() {
        const allowedShifts = Array.from(
            document.querySelectorAll('.shift-checkbox:checked')
        ).map(cb => cb.value);

        return {
            month: this.currentMonth,
            status: document.getElementById('statusSelect').value,
            openDate: document.getElementById('openDateInput').value,
            closeDate: document.getElementById('closeDateInput').value,
            monthlyLimit: parseInt(document.getElementById('monthlyLimitInput').value),
            allowedShifts: allowedShifts,
            countFFToLimit: document.getElementById('countFFCheckbox').checked,
            countOthersToLimit: document.getElementById('countOthersCheckbox').checked,
            allowOverDailyLimit: document.getElementById('allowOverDailyLimitCheckbox').checked,
            notifyOnOpen: document.getElementById('notifyOnOpenCheckbox').checked,
            notifyBeforeClose: document.getElementById('notifyBeforeCloseCheckbox').checked,
            notifyDaysBefore: parseInt(document.getElementById('notifyDaysBeforeInput').value)
        };
    }

    /**
     * 驗證表單資料
     */
    validateFormData(data) {
        if (new Date(data.openDate) >= new Date(data.closeDate)) {
            return { valid: false, message: '開放日期必須早於截止日期' };
        }

        if (data.monthlyLimit < 0 || data.monthlyLimit > 10) {
            return { valid: false, message: '每月預班上限必須在 0-10 之間' };
        }

        if (data.allowedShifts.length === 0) {
            return { valid: false, message: '請至少選擇一個允許的班別' };
        }

        return { valid: true };
    }

    /**
     * 處理重設
     */
    handleReset() {
        const confirmed = confirm('確定要重設為預設值嗎？此操作無法復原。');
        if (!confirmed) return;

        this.config = this.getDefaultConfig();
        this.initializeUI();
        this.bindEvents();
        
        showNotification('已重設為預設值', 'info');
    }

    /**
     * 處理開放預班
     */
    async handleOpen() {
        try {
            const confirmed = confirm(
                '確定要開放預班嗎？\n' +
                '開放後將自動發送通知給所有員工。'
            );
            if (!confirmed) return;

            showLoading('開放預班中...');

            await this.preScheduleService.openPreSchedule(this.currentMonth);

            this.config.status = 'open';
            
            hideLoading();
            showNotification('預班已開放，通知已發送', 'success');

            // 重新載入UI
            this.initializeUI();
            this.bindEvents();

        } catch (error) {
            hideLoading();
            console.error('開放預班失敗:', error);
            showNotification('開放失敗，請稍後再試', 'error');
        }
    }

    /**
     * 處理截止預班
     */
    async handleClose() {
        try {
            const confirmed = confirm('確定要提前截止預班嗎？');
            if (!confirmed) return;

            showLoading('截止預班中...');

            await this.preScheduleService.closePreSchedule(this.currentMonth);

            this.config.status = 'closed';
            
            hideLoading();
            showNotification('預班已截止', 'success');

            this.initializeUI();
            this.bindEvents();

        } catch (error) {
            hideLoading();
            console.error('截止預班失敗:', error);
            showNotification('截止失敗，請稍後再試', 'error');
        }
    }

    /**
     * 處理重新開放
     */
    async handleReopen() {
        try {
            const confirmed = confirm('確定要重新開放預班嗎？');
            if (!confirmed) return;

            showLoading('重新開放中...');

            await this.preScheduleService.reopenPreSchedule(this.currentMonth);

            this.config.status = 'open';
            
            hideLoading();
            showNotification('預班已重新開放', 'success');

            this.initializeUI();
            this.bindEvents();

        } catch (error) {
            hideLoading();
            console.error('重新開放失敗:', error);
            showNotification('重新開放失敗，請稍後再試', 'error');
        }
    }

    /**
     * 處理鎖定預班
     */
    async handleLock() {
        try {
            const confirmed = confirm(
                '⚠️ 警告：鎖定後將無法修改預班設定和內容！\n' +
                '建議在確定開始排班前再鎖定。\n\n' +
                '確定要鎖定預班嗎？'
            );
            if (!confirmed) return;

            showLoading('鎖定預班中...');

            await this.preScheduleService.lockPreSchedule(this.currentMonth);

            this.config.status = 'locked';
            
            hideLoading();
            showNotification('預班已鎖定', 'success');

            this.initializeUI();
            this.bindEvents();

        } catch (error) {
            hideLoading();
            console.error('鎖定預班失敗:', error);
            showNotification('鎖定失敗，請稍後再試', 'error');
        }
    }

    /**
     * 計算建議限額
     */
    calculateSuggestedLimit() {
        // 根據當月假日數計算
        // 這裡簡化為固定值，實際應從規則中讀取
        const averageOffDays = 8.4;
        return Math.floor(averageOffDays / 2);
    }

    /**
     * 取得狀態文字
     */
    getStatusText(status) {
        const statusMap = {
            draft: '草稿',
            open: '開放中',
            closed: '已截止',
            locked: '已鎖定'
        };
        return statusMap[status] || status;
    }

    /**
     * 取得狀態樣式
     */
    getStatusClass(status) {
        const classMap = {
            draft: 'status-draft',
            open: 'status-open',
            closed: 'status-closed',
            locked: 'status-locked'
        };
        return classMap[status] || '';
    }

    /**
     * 取得狀態說明
     */
    getStatusDescription(status) {
        const descMap = {
            draft: '預班尚未開放，員工無法提交預班',
            open: '預班開放中，員工可以提交預班',
            closed: '預班已截止，員工無法修改預班',
            locked: '預班已鎖定，排班者也無法修改'
        };
        return descMap[status] || '';
    }

    /**
     * 格式化月份
     */
    formatMonth(monthStr) {
        if (monthStr.length !== 6) return monthStr;
        const year = monthStr.substring(0, 4);
        const month = monthStr.substring(4, 6);
        return `${year}年${month}月`;
    }
}

// 匯出
export { PreScheduleConfig };