/**
 * 預班提交功能 (一般使用者)
 * 處理使用者的預班提交、驗證和儲存
 */

import { PreScheduleService } from '../../services/pre-schedule.service.js';
import { showNotification, showLoading, hideLoading } from '../../components/notification.js';
import { showModal, closeModal } from '../../components/modal.js';

class PreScheduleSubmit {
    constructor() {
        this.preScheduleService = new PreScheduleService();
        this.currentMonth = null;
        this.currentUser = null;
        this.selectedDates = new Map(); // 儲存選擇的日期和班別
        this.monthlyLimit = 0;
        this.dailyLimits = new Map();
        this.preScheduleCount = 0;
    }

    /**
     * 初始化預班提交功能
     */
    async init(month, user) {
        try {
            this.currentMonth = month;
            this.currentUser = user;

            // 載入預班設定
            await this.loadPreScheduleConfig();

            // 載入現有預班
            await this.loadExistingPreSchedule();

            // 初始化UI
            this.initializeUI();

            // 綁定事件
            this.bindEvents();

        } catch (error) {
            console.error('初始化預班提交失敗:', error);
            showNotification('初始化失敗，請重新整理頁面', 'error');
        }
    }

    /**
     * 載入預班設定
     */
    async loadPreScheduleConfig() {
        try {
            const config = await this.preScheduleService.getPreScheduleConfig(this.currentMonth);
            
            // 檢查預班狀態
            if (config.status === 'closed') {
                showNotification('預班已截止，無法提交', 'warning');
                this.disableSubmit();
                return;
            }

            if (config.status === 'locked') {
                showNotification('預班已鎖定，請聯絡排班者', 'warning');
                this.disableSubmit();
                return;
            }

            // 設定限額
            this.monthlyLimit = config.monthlyLimit || 4;
            
            // 計算每日限額
            await this.calculateDailyLimits();

        } catch (error) {
            console.error('載入預班設定失敗:', error);
            throw error;
        }
    }

    /**
     * 計算每日預班人數限額
     */
    async calculateDailyLimits() {
        try {
            const rules = await this.preScheduleService.getRules();
            const staffData = await this.preScheduleService.getStaffData();
            const requirements = await this.preScheduleService.getRequirements(this.currentMonth);

            const totalStaff = staffData.filter(s => s.status === '在職').length;

            // 遍歷當月每一天
            const daysInMonth = new Date(
                parseInt(this.currentMonth.substring(0, 4)), 
                parseInt(this.currentMonth.substring(4, 6)), 
                0
            ).getDate();

            for (let day = 1; day <= daysInMonth; day++) {
                const dateStr = `${this.currentMonth}${day.toString().padStart(2, '0')}`;
                const dayOfWeek = new Date(
                    parseInt(this.currentMonth.substring(0, 4)),
                    parseInt(this.currentMonth.substring(4, 6)) - 1,
                    day
                ).getDay();

                const required = requirements[dayOfWeek] || 12;
                const limit = Math.max(totalStaff - required - 1, 0);
                
                this.dailyLimits.set(dateStr, limit);
            }

        } catch (error) {
            console.error('計算每日限額失敗:', error);
        }
    }

    /**
     * 載入現有預班
     */
    async loadExistingPreSchedule() {
        try {
            const preSchedule = await this.preScheduleService.getStaffPreSchedule(
                this.currentMonth,
                this.currentUser.staffId
            );

            this.selectedDates.clear();
            this.preScheduleCount = 0;

            if (preSchedule && preSchedule.dates) {
                preSchedule.dates.forEach(item => {
                    this.selectedDates.set(item.date, item.shift);
                    
                    // 計算預班次數（只計算FF）
                    if (this.shouldCountTowardsLimit(item.shift)) {
                        this.preScheduleCount++;
                    }
                });
            }

            this.updatePreScheduleCounter();

        } catch (error) {
            console.error('載入現有預班失敗:', error);
        }
    }

    /**
     * 初始化UI
     */
    initializeUI() {
        // 顯示預班限額
        const counterElement = document.getElementById('preScheduleCounter');
        if (counterElement) {
            counterElement.innerHTML = `
                <div class="pre-schedule-limit">
                    <span class="limit-label">本月預班額度：</span>
                    <span class="limit-value" id="currentCount">${this.preScheduleCount}</span>
                    <span class="limit-separator">/</span>
                    <span class="limit-total">${this.monthlyLimit}</span>
                </div>
            `;
        }

        // 標記已選擇的日期
        this.selectedDates.forEach((shift, date) => {
            this.markSelectedDate(date, shift);
        });

        // 顯示每日限額提示
        this.showDailyLimits();
    }

    /**
     * 綁定事件
     */
    bindEvents() {
        // 日期點擊事件
        document.querySelectorAll('.calendar-date-cell').forEach(cell => {
            // 排除前月日期（灰色背景）
            if (!cell.classList.contains('prev-month')) {
                cell.addEventListener('click', (e) => this.handleDateClick(e));
            }
        });

        // 提交按鈕
        const submitBtn = document.getElementById('submitPreScheduleBtn');
        if (submitBtn) {
            submitBtn.addEventListener('click', () => this.handleSubmit());
        }

        // 清空按鈕
        const clearBtn = document.getElementById('clearPreScheduleBtn');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => this.handleClear());
        }
    }

    /**
     * 處理日期點擊
     */
    async handleDateClick(event) {
        const cell = event.currentTarget;
        const date = cell.dataset.date;

        if (!date) return;

        // 顯示班別選擇彈窗
        await this.showShiftSelector(date, cell);
    }

    /**
     * 顯示班別選擇器
     */
    async showShiftSelector(date, cellElement) {
        try {
            const shifts = await this.preScheduleService.getAvailableShifts();
            const currentShift = this.selectedDates.get(date);
            
            // 獲取每日已預班人數
            const dailyCount = await this.getDailyPreScheduleCount(date);
            const dailyLimit = this.dailyLimits.get(date) || 0;
            const isOverLimit = dailyCount >= dailyLimit;

            const modalContent = `
                <div class="shift-selector">
                    <h3>選擇班別</h3>
                    <p class="date-display">${this.formatDate(date)}</p>
                    
                    ${isOverLimit ? `
                        <div class="warning-message">
                            ⚠️ 該日預班已滿 (${dailyCount}/${dailyLimit})，
                            您仍可送出但可能無法排入
                        </div>
                    ` : `
                        <div class="info-message">
                            該日預班人數：${dailyCount}/${dailyLimit}
                        </div>
                    `}

                    <div class="shift-buttons">
                        ${shifts.map(shift => `
                            <button 
                                class="shift-btn ${currentShift === shift.code ? 'selected' : ''}"
                                data-shift="${shift.code}"
                                style="background-color: ${shift.color}">
                                ${shift.name} (${shift.code})
                            </button>
                        `).join('')}
                        
                        ${currentShift ? `
                            <button class="shift-btn remove-btn" data-shift="remove">
                                移除預班
                            </button>
                        ` : ''}
                    </div>

                    <div class="modal-actions">
                        <button class="btn btn-secondary" onclick="closeModal()">取消</button>
                    </div>
                </div>
            `;

            showModal(modalContent);

            // 綁定班別選擇事件
            document.querySelectorAll('.shift-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const shiftCode = e.target.dataset.shift;
                    
                    if (shiftCode === 'remove') {
                        this.removePreSchedule(date, cellElement);
                    } else {
                        this.selectShift(date, shiftCode, cellElement);
                    }
                    
                    closeModal();
                });
            });

        } catch (error) {
            console.error('顯示班別選擇器失敗:', error);
            showNotification('無法載入班別資料', 'error');
        }
    }

    /**
     * 選擇班別
     */
    selectShift(date, shiftCode, cellElement) {
        // 檢查是否會超過每月限額
        const willExceedLimit = this.willExceedMonthlyLimit(date, shiftCode);
        
        if (willExceedLimit) {
            showNotification(
                `超過每月預班上限 (${this.monthlyLimit}次)，請移除其他預班後再試`,
                'error'
            );
            return;
        }

        // 記錄選擇
        const previousShift = this.selectedDates.get(date);
        this.selectedDates.set(date, shiftCode);

        // 更新計數
        if (previousShift && this.shouldCountTowardsLimit(previousShift)) {
            this.preScheduleCount--;
        }
        if (this.shouldCountTowardsLimit(shiftCode)) {
            this.preScheduleCount++;
        }

        // 更新UI
        this.markSelectedDate(date, shiftCode, cellElement);
        this.updatePreScheduleCounter();

        showNotification(`已選擇 ${this.formatDate(date)} - ${shiftCode}`, 'success');
    }

    /**
     * 移除預班
     */
    removePreSchedule(date, cellElement) {
        const previousShift = this.selectedDates.get(date);
        
        if (!previousShift) return;

        this.selectedDates.delete(date);

        // 更新計數
        if (this.shouldCountTowardsLimit(previousShift)) {
            this.preScheduleCount--;
        }

        // 更新UI
        this.clearSelectedDate(date, cellElement);
        this.updatePreScheduleCounter();

        showNotification(`已移除 ${this.formatDate(date)} 的預班`, 'info');
    }

    /**
     * 標記已選擇的日期
     */
    markSelectedDate(date, shift, cellElement = null) {
        const cell = cellElement || document.querySelector(`[data-date="${date}"]`);
        if (!cell) return;

        cell.classList.add('pre-scheduled');
        cell.setAttribute('data-shift', shift);
        
        // 顯示班別代碼
        const shiftDisplay = cell.querySelector('.shift-display') || document.createElement('div');
        shiftDisplay.className = 'shift-display';
        shiftDisplay.textContent = shift;
        
        if (!cell.querySelector('.shift-display')) {
            cell.appendChild(shiftDisplay);
        }
    }

    /**
     * 清除已選擇的日期標記
     */
    clearSelectedDate(date, cellElement = null) {
        const cell = cellElement || document.querySelector(`[data-date="${date}"]`);
        if (!cell) return;

        cell.classList.remove('pre-scheduled');
        cell.removeAttribute('data-shift');
        
        const shiftDisplay = cell.querySelector('.shift-display');
        if (shiftDisplay) {
            shiftDisplay.remove();
        }
    }

    /**
     * 更新預班計數器
     */
    updatePreScheduleCounter() {
        const countElement = document.getElementById('currentCount');
        if (countElement) {
            countElement.textContent = this.preScheduleCount;
            
            // 根據使用情況改變顏色
            if (this.preScheduleCount >= this.monthlyLimit) {
                countElement.classList.add('limit-reached');
            } else {
                countElement.classList.remove('limit-reached');
            }
        }
    }

    /**
     * 檢查是否會超過每月限額
     */
    willExceedMonthlyLimit(date, newShift) {
        const previousShift = this.selectedDates.get(date);
        let tempCount = this.preScheduleCount;

        // 如果之前的班別計入限額，先減去
        if (previousShift && this.shouldCountTowardsLimit(previousShift)) {
            tempCount--;
        }

        // 如果新班別計入限額，加上
        if (this.shouldCountTowardsLimit(newShift)) {
            tempCount++;
        }

        return tempCount > this.monthlyLimit;
    }

    /**
     * 判斷班別是否計入限額
     */
    shouldCountTowardsLimit(shiftCode) {
        // 根據規則判斷
        // FF 計入限額，其他班別不計入
        return shiftCode === 'FF';
    }

    /**
     * 取得每日已預班人數
     */
    async getDailyPreScheduleCount(date) {
        try {
            const count = await this.preScheduleService.getDailyPreScheduleCount(
                this.currentMonth,
                date
            );
            return count || 0;
        } catch (error) {
            console.error('取得每日預班人數失敗:', error);
            return 0;
        }
    }

    /**
     * 顯示每日限額
     */
    showDailyLimits() {
        // 在日曆上顯示每日限額提示
        this.dailyLimits.forEach((limit, date) => {
            const cell = document.querySelector(`[data-date="${date}"]`);
            if (cell && !cell.classList.contains('prev-month')) {
                const limitBadge = document.createElement('span');
                limitBadge.className = 'daily-limit-badge';
                limitBadge.textContent = `限${limit}`;
                limitBadge.title = `該日可預班人數上限：${limit}人`;
                cell.appendChild(limitBadge);
            }
        });
    }

    /**
     * 處理提交
     */
    async handleSubmit() {
        try {
            if (this.selectedDates.size === 0) {
                showNotification('請至少選擇一天預班', 'warning');
                return;
            }

            // 確認對話框
            const confirmed = await this.showConfirmDialog();
            if (!confirmed) return;

            showLoading('提交預班中...');

            // 準備提交資料
            const preScheduleData = {
                month: this.currentMonth,
                staffId: this.currentUser.staffId,
                staffName: this.currentUser.staffName,
                dates: Array.from(this.selectedDates.entries()).map(([date, shift]) => ({
                    date,
                    shift,
                    countsToLimit: this.shouldCountTowardsLimit(shift)
                })),
                totalCount: this.preScheduleCount,
                submittedAt: new Date().toISOString(),
                status: 'submitted'
            };

            // 提交到後端
            await this.preScheduleService.submitPreSchedule(preScheduleData);

            hideLoading();
            showNotification('預班提交成功！', 'success');

            // 重新載入預班資料
            await this.loadExistingPreSchedule();

        } catch (error) {
            hideLoading();
            console.error('提交預班失敗:', error);
            showNotification('提交失敗，請稍後再試', 'error');
        }
    }

    /**
     * 顯示確認對話框
     */
    showConfirmDialog() {
        return new Promise((resolve) => {
            const dateList = Array.from(this.selectedDates.entries())
                .map(([date, shift]) => `${this.formatDate(date)} - ${shift}`)
                .join('<br>');

            const modalContent = `
                <div class="confirm-dialog">
                    <h3>確認提交預班</h3>
                    <p>您選擇了以下 ${this.selectedDates.size} 天：</p>
                    <div class="date-list">
                        ${dateList}
                    </div>
                    <p class="confirm-note">
                        ※ 預班次數：${this.preScheduleCount}/${this.monthlyLimit}
                    </p>
                    <p class="confirm-note">
                        ※ 提交後仍可修改，直到預班截止日
                    </p>
                    <div class="modal-actions">
                        <button class="btn btn-secondary" id="cancelConfirm">取消</button>
                        <button class="btn btn-primary" id="confirmSubmit">確認提交</button>
                    </div>
                </div>
            `;

            showModal(modalContent);

            document.getElementById('confirmSubmit').addEventListener('click', () => {
                closeModal();
                resolve(true);
            });

            document.getElementById('cancelConfirm').addEventListener('click', () => {
                closeModal();
                resolve(false);
            });
        });
    }

    /**
     * 處理清空
     */
    async handleClear() {
        if (this.selectedDates.size === 0) {
            showNotification('目前沒有預班資料', 'info');
            return;
        }

        const confirmed = confirm('確定要清空所有預班嗎？此操作無法復原。');
        if (!confirmed) return;

        // 清空所有選擇
        this.selectedDates.forEach((shift, date) => {
            this.clearSelectedDate(date);
        });

        this.selectedDates.clear();
        this.preScheduleCount = 0;
        this.updatePreScheduleCounter();

        showNotification('已清空所有預班', 'info');
    }

    /**
     * 停用提交功能
     */
    disableSubmit() {
        const submitBtn = document.getElementById('submitPreScheduleBtn');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = '預班已截止';
        }

        // 停用日期點擊
        document.querySelectorAll('.calendar-date-cell').forEach(cell => {
            cell.style.pointerEvents = 'none';
            cell.style.opacity = '0.6';
        });
    }

    /**
     * 格式化日期顯示
     */
    formatDate(dateStr) {
        if (dateStr.length !== 8) return dateStr;
        
        const year = dateStr.substring(0, 4);
        const month = dateStr.substring(4, 6);
        const day = dateStr.substring(6, 8);
        
        return `${year}/${month}/${day}`;
    }
}

// 匯出
export { PreScheduleSubmit };