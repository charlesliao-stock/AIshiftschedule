/**
 * 額外預班功能 (排班者專用)
 * 允許排班者為員工新增額外預班，不計入限額
 */

import { PreScheduleService } from '../../services/pre-schedule.service.js';
import { showNotification, showLoading, hideLoading } from '../../components/notification.js';
import { showModal, closeModal } from '../../components/modal.js';

class PreScheduleExtra {
    constructor() {
        this.preScheduleService = new PreScheduleService();
        this.currentMonth = null;
        this.currentUnit = null;
        this.staffList = [];
        this.extraPreSchedules = new Map(); // staffId -> [{date, shift}]
    }

    /**
     * 初始化額外預班功能
     */
    async init(month, unitId) {
        try {
            this.currentMonth = month;
            this.currentUnit = unitId;

            // 載入員工列表
            await this.loadStaffList();

            // 載入現有額外預班
            await this.loadExtraPreSchedules();

            // 初始化UI
            this.initializeUI();

            // 綁定事件
            this.bindEvents();

        } catch (error) {
            console.error('初始化額外預班失敗:', error);
            showNotification('初始化失敗，請重新整理頁面', 'error');
        }
    }

    /**
     * 載入員工列表
     */
    async loadStaffList() {
        try {
            this.staffList = await this.preScheduleService.getStaffData();
            this.staffList = this.staffList.filter(s => s.status === '在職');
        } catch (error) {
            console.error('載入員工列表失敗:', error);
            throw error;
        }
    }

    /**
     * 載入現有額外預班
     */
    async loadExtraPreSchedules() {
        try {
            const extraData = await this.preScheduleService.getExtraPreSchedules(this.currentMonth);
            
            this.extraPreSchedules.clear();
            
            if (extraData && Array.isArray(extraData)) {
                extraData.forEach(item => {
                    if (!this.extraPreSchedules.has(item.staffId)) {
                        this.extraPreSchedules.set(item.staffId, []);
                    }
                    this.extraPreSchedules.get(item.staffId).push({
                        date: item.date,
                        shift: item.shift,
                        addedBy: item.addedBy,
                        addedAt: item.addedAt,
                        reason: item.reason || ''
                    });
                });
            }

        } catch (error) {
            console.error('載入額外預班失敗:', error);
        }
    }

    /**
     * 初始化UI
     */
    initializeUI() {
        // 渲染額外預班表格
        this.renderExtraPreScheduleTable();

        // 標記日曆上的額外預班
        this.markExtraPreSchedulesOnCalendar();
    }

    /**
     * 渲染額外預班表格
     */
    renderExtraPreScheduleTable() {
        const container = document.getElementById('extraPreScheduleTable');
        if (!container) return;

        let html = `
            <div class="extra-pre-schedule-panel">
                <div class="panel-header">
                    <h3>額外預班管理</h3>
                    <button class="btn btn-primary" id="addExtraPreScheduleBtn">
                        ➕ 新增額外預班
                    </button>
                </div>
                
                <div class="info-box">
                    <p>💡 額外預班不計入員工的預班限額，適用於特殊需求。</p>
                    <p>※ 額外預班會以 ⭐ 標記顯示。</p>
                </div>

                <table class="extra-schedule-table">
                    <thead>
                        <tr>
                            <th>員工編號</th>
                            <th>姓名</th>
                            <th>組別</th>
                            <th>額外預班數</th>
                            <th>操作</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        this.staffList.forEach(staff => {
            const extraCount = this.extraPreSchedules.get(staff.staffId)?.length || 0;
            
            html += `
                <tr data-staff-id="${staff.staffId}">
                    <td>${staff.staffId}</td>
                    <td>${staff.name}</td>
                    <td>${staff.group}</td>
                    <td>
                        <span class="extra-count ${extraCount > 0 ? 'has-extra' : ''}">
                            ${extraCount} 天
                        </span>
                    </td>
                    <td>
                        <button class="btn btn-sm btn-info view-extra-btn" 
                                data-staff-id="${staff.staffId}">
                            查看
                        </button>
                        <button class="btn btn-sm btn-primary add-extra-btn" 
                                data-staff-id="${staff.staffId}"
                                data-staff-name="${staff.name}">
                            新增
                        </button>
                    </td>
                </tr>
            `;
        });

        html += `
                    </tbody>
                </table>
            </div>
        `;

        container.innerHTML = html;
    }

    /**
     * 綁定事件
     */
    bindEvents() {
        // 新增額外預班按鈕（全局）
        const addBtn = document.getElementById('addExtraPreScheduleBtn');
        if (addBtn) {
            addBtn.addEventListener('click', () => this.showStaffSelector());
        }

        // 查看按鈕
        document.querySelectorAll('.view-extra-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const staffId = e.target.dataset.staffId;
                this.viewStaffExtraPreSchedule(staffId);
            });
        });

        // 新增按鈕（個別員工）
        document.querySelectorAll('.add-extra-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const staffId = e.target.dataset.staffId;
                const staffName = e.target.dataset.staffName;
                this.showDateShiftSelector(staffId, staffName);
            });
        });

        // 日曆點擊（如果在額外預班模式）
        if (document.getElementById('extraPreScheduleMode')?.checked) {
            this.enableCalendarExtraMode();
        }
    }

    /**
     * 顯示員工選擇器
     */
    showStaffSelector() {
        const modalContent = `
            <div class="staff-selector-modal">
                <h3>選擇員工</h3>
                <p class="modal-description">選擇要新增額外預班的員工</p>
                
                <div class="staff-search">
                    <input type="text" 
                           id="staffSearchInput" 
                           placeholder="搜尋員工姓名或編號..."
                           class="search-input">
                </div>

                <div class="staff-list">
                    ${this.staffList.map(staff => `
                        <div class="staff-item" 
                             data-staff-id="${staff.staffId}"
                             data-staff-name="${staff.name}">
                            <div class="staff-info">
                                <span class="staff-id">${staff.staffId}</span>
                                <span class="staff-name">${staff.name}</span>
                                <span class="staff-group">${staff.group}</span>
                            </div>
                            <div class="staff-extra-info">
                                ${this.extraPreSchedules.get(staff.staffId)?.length || 0} 個額外預班
                            </div>
                        </div>
                    `).join('')}
                </div>

                <div class="modal-actions">
                    <button class="btn btn-secondary" onclick="closeModal()">取消</button>
                </div>
            </div>
        `;

        showModal(modalContent);

        // 搜尋功能
        const searchInput = document.getElementById('staffSearchInput');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.filterStaffList(e.target.value);
            });
        }

        // 員工項目點擊
        document.querySelectorAll('.staff-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const staffId = e.currentTarget.dataset.staffId;
                const staffName = e.currentTarget.dataset.staffName;
                closeModal();
                this.showDateShiftSelector(staffId, staffName);
            });
        });
    }

    /**
     * 過濾員工列表
     */
    filterStaffList(keyword) {
        const items = document.querySelectorAll('.staff-item');
        const lowerKeyword = keyword.toLowerCase();

        items.forEach(item => {
            const staffId = item.dataset.staffId.toLowerCase();
            const staffName = item.dataset.staffName.toLowerCase();
            const match = staffId.includes(lowerKeyword) || staffName.includes(lowerKeyword);
            
            item.style.display = match ? 'flex' : 'none';
        });
    }

    /**
     * 顯示日期和班別選擇器
     */
    async showDateShiftSelector(staffId, staffName) {
        try {
            const shifts = await this.preScheduleService.getAvailableShifts();
            const existingExtra = this.extraPreSchedules.get(staffId) || [];

            const modalContent = `
                <div class="date-shift-selector">
                    <h3>新增額外預班</h3>
                    <p class="staff-info">員工：${staffName} (${staffId})</p>

                    ${existingExtra.length > 0 ? `
                        <div class="existing-extra">
                            <h4>現有額外預班：</h4>
                            <ul>
                                ${existingExtra.map(item => `
                                    <li>
                                        ${this.formatDate(item.date)} - ${item.shift}
                                        <button class="btn-icon remove-extra-btn" 
                                                data-staff-id="${staffId}"
                                                data-date="${item.date}">
                                            ❌
                                        </button>
                                    </li>
                                `).join('')}
                            </ul>
                        </div>
                    ` : ''}

                    <div class="form-group">
                        <label>選擇日期：</label>
                        <input type="date" 
                               id="extraDateInput" 
                               class="form-control"
                               min="${this.getMonthStart()}"
                               max="${this.getMonthEnd()}">
                    </div>

                    <div class="form-group">
                        <label>選擇班別：</label>
                        <div class="shift-buttons">
                            ${shifts.map(shift => `
                                <button class="shift-btn" 
                                        data-shift="${shift.code}"
                                        style="background-color: ${shift.color}">
                                    ${shift.name} (${shift.code})
                                </button>
                            `).join('')}
                        </div>
                    </div>

                    <div class="form-group">
                        <label>備註原因（選填）：</label>
                        <textarea id="extraReasonInput" 
                                  class="form-control" 
                                  rows="2"
                                  placeholder="例如：特殊醫療需求、家庭因素等"></textarea>
                    </div>

                    <div class="modal-actions">
                        <button class="btn btn-secondary" onclick="closeModal()">取消</button>
                        <button class="btn btn-primary" id="confirmExtraBtn">確認新增</button>
                    </div>
                </div>
            `;

            showModal(modalContent);

            let selectedDate = '';
            let selectedShift = '';

            // 日期選擇
            document.getElementById('extraDateInput').addEventListener('change', (e) => {
                selectedDate = e.target.value.replace(/-/g, '');
            });

            // 班別選擇
            document.querySelectorAll('.shift-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    document.querySelectorAll('.shift-btn').forEach(b => 
                        b.classList.remove('selected')
                    );
                    e.target.classList.add('selected');
                    selectedShift = e.target.dataset.shift;
                });
            });

            // 移除額外預班
            document.querySelectorAll('.remove-extra-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const removeStaffId = e.target.dataset.staffId;
                    const removeDate = e.target.dataset.date;
                    this.removeExtraPreSchedule(removeStaffId, removeDate);
                    closeModal();
                });
            });

            // 確認新增
            document.getElementById('confirmExtraBtn').addEventListener('click', async () => {
                if (!selectedDate || !selectedShift) {
                    showNotification('請選擇日期和班別', 'warning');
                    return;
                }

                const reason = document.getElementById('extraReasonInput').value.trim();

                await this.addExtraPreSchedule(staffId, staffName, selectedDate, selectedShift, reason);
                closeModal();
            });

        } catch (error) {
            console.error('顯示日期班別選擇器失敗:', error);
            showNotification('無法載入班別資料', 'error');
        }
    }

    /**
     * 新增額外預班
     */
    async addExtraPreSchedule(staffId, staffName, date, shift, reason = '') {
        try {
            showLoading('新增額外預班中...');

            // 檢查是否已存在
            const existing = this.extraPreSchedules.get(staffId) || [];
            if (existing.some(item => item.date === date)) {
                hideLoading();
                showNotification('該日期已有額外預班', 'warning');
                return;
            }

            const extraData = {
                month: this.currentMonth,
                staffId,
                staffName,
                date,
                shift,
                addedBy: getCurrentUser().displayName,
                addedAt: new Date().toISOString(),
                reason,
                isExtra: true
            };

            // 提交到後端
            await this.preScheduleService.addExtraPreSchedule(extraData);

            // 更新本地資料
            if (!this.extraPreSchedules.has(staffId)) {
                this.extraPreSchedules.set(staffId, []);
            }
            this.extraPreSchedules.get(staffId).push({
                date,
                shift,
                addedBy: extraData.addedBy,
                addedAt: extraData.addedAt,
                reason
            });

            hideLoading();
            showNotification('額外預班新增成功！', 'success');

            // 重新渲染
            this.renderExtraPreScheduleTable();
            this.markExtraPreSchedulesOnCalendar();
            this.bindEvents();

        } catch (error) {
            hideLoading();
            console.error('新增額外預班失敗:', error);
            showNotification('新增失敗，請稍後再試', 'error');
        }
    }

    /**
     * 移除額外預班
     */
    async removeExtraPreSchedule(staffId, date) {
        try {
            const confirmed = confirm('確定要移除這個額外預班嗎？');
            if (!confirmed) return;

            showLoading('移除額外預班中...');

            // 提交到後端
            await this.preScheduleService.removeExtraPreSchedule(this.currentMonth, staffId, date);

            // 更新本地資料
            const extras = this.extraPreSchedules.get(staffId);
            if (extras) {
                const index = extras.findIndex(item => item.date === date);
                if (index !== -1) {
                    extras.splice(index, 1);
                }
                if (extras.length === 0) {
                    this.extraPreSchedules.delete(staffId);
                }
            }

            hideLoading();
            showNotification('額外預班已移除', 'success');

            // 重新渲染
            this.renderExtraPreScheduleTable();
            this.markExtraPreSchedulesOnCalendar();
            this.bindEvents();

        } catch (error) {
            hideLoading();
            console.error('移除額外預班失敗:', error);
            showNotification('移除失敗，請稍後再試', 'error');
        }
    }

    /**
     * 查看員工的額外預班
     */
    viewStaffExtraPreSchedule(staffId) {
        const staff = this.staffList.find(s => s.staffId === staffId);
        const extras = this.extraPreSchedules.get(staffId) || [];

        if (extras.length === 0) {
            showNotification('該員工目前沒有額外預班', 'info');
            return;
        }

        const modalContent = `
            <div class="view-extra-modal">
                <h3>額外預班詳情</h3>
                <p class="staff-info">員工：${staff.name} (${staffId})</p>

                <table class="extra-details-table">
                    <thead>
                        <tr>
                            <th>日期</th>
                            <th>班別</th>
                            <th>新增人</th>
                            <th>新增時間</th>
                            <th>備註</th>
                            <th>操作</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${extras.map(item => `
                            <tr>
                                <td>${this.formatDate(item.date)}</td>
                                <td><span class="shift-badge">${item.shift}</span></td>
                                <td>${item.addedBy || '-'}</td>
                                <td>${this.formatDateTime(item.addedAt)}</td>
                                <td>${item.reason || '-'}</td>
                                <td>
                                    <button class="btn btn-sm btn-danger remove-btn"
                                            data-staff-id="${staffId}"
                                            data-date="${item.date}">
                                        移除
                                    </button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>

                <div class="modal-actions">
                    <button class="btn btn-secondary" onclick="closeModal()">關閉</button>
                </div>
            </div>
        `;

        showModal(modalContent);

        // 綁定移除按鈕
        document.querySelectorAll('.remove-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const removeStaffId = e.target.dataset.staffId;
                const removeDate = e.target.dataset.date;
                await this.removeExtraPreSchedule(removeStaffId, removeDate);
                closeModal();
            });
        });
    }

    /**
     * 在日曆上標記額外預班
     */
    markExtraPreSchedulesOnCalendar() {
        // 清除舊標記
        document.querySelectorAll('.extra-marker').forEach(el => el.remove());

        // 新增標記
        this.extraPreSchedules.forEach((extras, staffId) => {
            extras.forEach(item => {
                const cell = document.querySelector(
                    `[data-date="${item.date}"][data-staff-id="${staffId}"]`
                );
                
                if (cell) {
                    const marker = document.createElement('span');
                    marker.className = 'extra-marker';
                    marker.textContent = '⭐';
                    marker.title = `額外預班: ${item.shift}`;
                    cell.appendChild(marker);
                }
            });
        });
    }

    /**
     * 啟用日曆額外預班模式
     */
    enableCalendarExtraMode() {
        document.querySelectorAll('.calendar-staff-cell').forEach(cell => {
            cell.addEventListener('click', (e) => {
                const staffId = cell.dataset.staffId;
                const date = cell.dataset.date;
                
                if (staffId && date) {
                    const staff = this.staffList.find(s => s.staffId === staffId);
                    if (staff) {
                        this.showDateShiftSelector(staffId, staff.name);
                    }
                }
            });
        });
    }

    /**
     * 取得月份開始日期
     */
    getMonthStart() {
        const year = this.currentMonth.substring(0, 4);
        const month = this.currentMonth.substring(4, 6);
        return `${year}-${month}-01`;
    }

    /**
     * 取得月份結束日期
     */
    getMonthEnd() {
        const year = parseInt(this.currentMonth.substring(0, 4));
        const month = parseInt(this.currentMonth.substring(4, 6));
        const lastDay = new Date(year, month, 0).getDate();
        return `${year}-${month.toString().padStart(2, '0')}-${lastDay}`;
    }

    /**
     * 格式化日期
     */
    formatDate(dateStr) {
        if (dateStr.length !== 8) return dateStr;
        const year = dateStr.substring(0, 4);
        const month = dateStr.substring(4, 6);
        const day = dateStr.substring(6, 8);
        return `${year}/${month}/${day}`;
    }

    /**
     * 格式化日期時間
     */
    formatDateTime(isoString) {
        if (!isoString) return '-';
        const date = new Date(isoString);
        return date.toLocaleString('zh-TW', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    }
}

// 取得當前使用者（需要從 auth.js 匯入）
function getCurrentUser() {
    return {
        displayName: localStorage.getItem('displayName') || '系統管理員'
    };
}

// 匯出
export { PreScheduleExtra };