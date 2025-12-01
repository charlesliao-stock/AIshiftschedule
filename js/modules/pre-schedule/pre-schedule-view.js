/**
 * 預班表顯示模組
 * 負責渲染預班表格和處理互動
 */

const PreScheduleView = {
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
    
    /**
     * 初始化視圖
     * @param {Object} options - 選項
     */
    async init(options = {}) {
        const {
            month = Utils.getMonthString(new Date()),
            staffId = null
        } = options;
        
        this.currentYear = parseInt(month.substring(0, 4));
        this.currentMonth = parseInt(month.substring(4, 6));
        this.currentStaffId = staffId;
        this.userRole = Auth.getUserRole();
        
        await this.loadData();
        this.render();
        this.bindEvents();
    },
    
    /**
     * 載入資料
     */
    async loadData() {
        try {
            Loading.show('載入預班資料...');
            
            const unitId = Auth.getUserUnit().id;
            const monthStr = `${this.currentYear}${String(this.currentMonth).padStart(2, '0')}`;
            
            // 並行載入多個資料
            const [preSchedule, status, shifts, staff] = await Promise.all([
                PreScheduleService.getPreSchedule(unitId, monthStr),
                PreScheduleService.getPreScheduleStatus(unitId, monthStr),
                SettingsService.getShifts(unitId),
                SettingsService.getStaff(unitId)
            ]);
            
            this.preScheduleData = preSchedule;
            this.statusData = status;
            this.shiftsData = shifts;
            this.staffData = staff;
            
            // 判斷是否可編輯
            this.isEditable = this.checkEditable();
            
            Loading.hide();
        } catch (error) {
            Loading.hide();
            Notification.error('載入資料失敗', error.message);
            throw error;
        }
    },
    
    /**
     * 檢查是否可編輯
     * @returns {boolean}
     */
    checkEditable() {
        // 如果是 locked 狀態，只有排班者可編輯
        if (this.statusData.status === 'locked') {
            return this.userRole === CONSTANTS.ROLES.SCHEDULER || 
                   this.userRole === CONSTANTS.ROLES.ADMIN;
        }
        
        // 如果是 closed 狀態，不可編輯
        if (this.statusData.status === 'closed') {
            return false;
        }
        
        // 如果是 open 狀態，檢查截止日期
        if (this.statusData.close_date) {
            const closeDate = new Date(this.statusData.close_date);
            if (new Date() > closeDate) {
                return false;
            }
        }
        
        return true;
    },
    
    // ==================== 渲染 ====================
    
    /**
     * 渲染主視圖
     */
    render() {
        const container = document.getElementById('pre-schedule-container');
        if (!container) return;
        
        container.innerHTML = `
            ${this.renderHeader()}
            ${this.renderStatusBar()}
            ${this.renderCalendar()}
            ${this.renderStatistics()}
        `;
    },
    
    /**
     * 渲染標題列
     */
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
                    <button class="btn btn-secondary" onclick="PreScheduleView.prevMonth()">
                        ← 上個月
                    </button>
                    <button class="btn btn-secondary" onclick="PreScheduleView.nextMonth()">
                        下個月 →
                    </button>
                    ${this.renderHeaderActions()}
                </div>
            </div>
        `;
    },
    
    /**
     * 渲染標題操作按鈕
     */
    renderHeaderActions() {
        const isScheduler = this.userRole === CONSTANTS.ROLES.SCHEDULER || 
                          this.userRole === CONSTANTS.ROLES.ADMIN;
        
        if (!isScheduler) return '';
        
        return `
            <button class="btn btn-primary" onclick="PreScheduleView.openStatusModal()">
                設定狀態
            </button>
            <button class="btn btn-secondary" onclick="PreScheduleView.exportPreSchedule()">
                匯出
            </button>
        `;
    },
    
    /**
     * 渲染狀態列
     */
    renderStatusBar() {
        const statusConfig = {
            open: { text: '開放填寫', color: '#10b981', icon: '✅' },
            closed: { text: '已截止', color: '#ef4444', icon: '🔒' },
            locked: { text: '已鎖定', color: '#f59e0b', icon: '⚠️' }
        };
        
        const config = statusConfig[this.statusData.status] || statusConfig.open;
        
        let statusText = config.text;
        if (this.statusData.close_date && this.statusData.status === 'open') {
            const closeDate = new Date(this.statusData.close_date);
            statusText += ` (截止: ${Utils.formatDate(closeDate)})`;
        }
        
        return `
            <div class="alert alert-${this.statusData.status === 'open' ? 'info' : 'warning'}">
                <div class="alert-icon">${config.icon}</div>
                <div class="alert-content">
                    <div class="alert-title">預班狀態: ${statusText}</div>
                    ${this.isEditable ? 
                        '<div>您可以編輯預班內容</div>' : 
                        '<div>目前無法編輯預班</div>'
                    }
                </div>
            </div>
        `;
    },
    
    /**
     * 渲染日曆
     */
    renderCalendar() {
        const daysInMonth = Utils.getDaysInMonth(this.currentYear, this.currentMonth);
        const prevMonthDays = this.getPrevMonthDays();
        const nextMonthDays = 6; // 顯示下個月前6天
        
        // 根據角色決定顯示方式
        if (this.userRole === CONSTANTS.ROLES.VIEWER) {
            // 一般使用者:只顯示自己
            return this.renderPersonalCalendar(daysInMonth, prevMonthDays, nextMonthDays);
        } else {
            // 排班者/管理者:顯示所有人
            return this.renderAllStaffCalendar(daysInMonth, prevMonthDays, nextMonthDays);
        }
    },
    
    /**
     * 渲染個人日曆
     */
    renderPersonalCalendar(daysInMonth, prevMonthDays, nextMonthDays) {
        const currentUser = Auth.getCurrentUser();
        const staffSchedule = this.preScheduleData.staff_schedules?.[currentUser.id] || {};
        
        return `
            <div class="card">
                <div class="card-header">
                    <h3 class="card-title">我的預班</h3>
                </div>
                <div class="card-body">
                    <div class="calendar-container">
                        ${this.renderCalendarHeader()}
                        ${this.renderCalendarDays(staffSchedule, daysInMonth, prevMonthDays, nextMonthDays, currentUser.id)}
                    </div>
                </div>
            </div>
        `;
    },
    
    /**
     * 渲染全員日曆
     */
    renderAllStaffCalendar(daysInMonth, prevMonthDays, nextMonthDays) {
        return `
            <div class="card">
                <div class="card-header">
                    <h3 class="card-title">全員預班表</h3>
                </div>
                <div class="card-body">
                    <div class="staff-calendar-container">
                        ${this.renderStaffRows(daysInMonth, prevMonthDays, nextMonthDays)}
                    </div>
                </div>
            </div>
        `;
    },
    
    /**
     * 渲染日曆標題
     */
    renderCalendarHeader() {
        return `
            <div class="calendar-header">
                <div class="calendar-weekdays">
                    ${CONSTANTS.WEEKDAYS_SHORT.map(day => 
                        `<div class="calendar-weekday">${day}</div>`
                    ).join('')}
                </div>
            </div>
        `;
    },
    
    /**
     * 渲染日曆日期
     */
    renderCalendarDays(schedule, daysInMonth, prevMonthDays, nextMonthDays, staffId) {
        let html = '<div class="calendar-grid">';
        
        // 前月的日期 (灰色顯示)
        for (let i = prevMonthDays; i > 0; i--) {
            const prevMonth = this.currentMonth === 1 ? 12 : this.currentMonth - 1;
            const prevYear = this.currentMonth === 1 ? this.currentYear - 1 : this.currentYear;
            const prevDays = Utils.getDaysInMonth(prevYear, prevMonth);
            const day = prevDays - i + 1;
            
            html += this.renderDateCell(prevYear, prevMonth, day, schedule, staffId, true, 'prev');
        }
        
        // 當月的日期
        for (let day = 1; day <= daysInMonth; day++) {
            html += this.renderDateCell(this.currentYear, this.currentMonth, day, schedule, staffId, false, 'current');
        }
        
        // 下個月的日期 (灰色顯示)
        for (let day = 1; day <= nextMonthDays; day++) {
            const nextMonth = this.currentMonth === 12 ? 1 : this.currentMonth + 1;
            const nextYear = this.currentMonth === 12 ? this.currentYear + 1 : this.currentYear;
            
            html += this.renderDateCell(nextYear, nextMonth, day, schedule, staffId, true, 'next');
        }
        
        html += '</div>';
        return html;
    },
    
    /**
     * 渲染日期格子
     */
    renderDateCell(year, month, day, schedule, staffId, isGray, period) {
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const date = new Date(year, month - 1, day);
        const weekday = date.getDay();
        const isWeekend = weekday === 0 || weekday === 6;
        
        const scheduleData = schedule[dateStr] || null;
        const shift = scheduleData?.shift || '';
        const isExtra = scheduleData?.is_extra || false;
        
        const cellClass = [
            'calendar-cell',
            isGray ? 'gray-date' : '',
            isWeekend ? 'weekend' : '',
            shift ? 'has-schedule' : '',
            this.isEditable && !isGray ? 'editable' : ''
        ].filter(Boolean).join(' ');
        
        const shiftColor = shift ? (CONSTANTS.SHIFT_COLORS[shift] || '#f3f4f6') : '';
        const shiftStyle = shift ? `background-color: ${shiftColor};` : '';
        
        return `
            <div 
                class="${cellClass}" 
                data-date="${dateStr}"
                data-staff-id="${staffId}"
                data-period="${period}"
                style="${shiftStyle}"
                ${this.isEditable && !isGray ? `onclick="PreScheduleView.onCellClick('${dateStr}', '${staffId}')"` : ''}
            >
                <div class="cell-date">${day}</div>
                <div class="cell-weekday">${CONSTANTS.WEEKDAYS_SHORT[weekday]}</div>
                ${shift ? `
                    <div class="cell-shift">
                        ${shift}
                        ${isExtra ? '<span class="extra-badge">⭐</span>' : ''}
                    </div>
                ` : '<div class="cell-empty">-</div>'}
            </div>
        `;
    },
    
    /**
     * 渲染員工行
     */
    renderStaffRows(daysInMonth, prevMonthDays, nextMonthDays) {
        if (!this.staffData || this.staffData.length === 0) {
            return '<div class="empty-state"><p>目前沒有員工資料</p></div>';
        }
        
        let html = '<div class="staff-rows">';
        
        // 標題行 (日期)
        html += '<div class="staff-row header-row">';
        html += '<div class="staff-name-cell">姓名</div>';
        
        // 前月日期
        for (let i = prevMonthDays; i > 0; i--) {
            const prevMonth = this.currentMonth === 1 ? 12 : this.currentMonth - 1;
            const prevYear = this.currentMonth === 1 ? this.currentYear - 1 : this.currentYear;
            const prevDays = Utils.getDaysInMonth(prevYear, prevMonth);
            const day = prevDays - i + 1;
            html += `<div class="date-cell gray-date">${day}</div>`;
        }
        
        // 當月日期
        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(this.currentYear, this.currentMonth - 1, day);
            const weekday = date.getDay();
            const isWeekend = weekday === 0 || weekday === 6;
            html += `<div class="date-cell ${isWeekend ? 'weekend' : ''}">${day}</div>`;
        }
        
        // 下月日期
        for (let day = 1; day <= nextMonthDays; day++) {
            html += `<div class="date-cell gray-date">${day}</div>`;
        }
        
        html += '</div>';
        
        // 員工行
        this.staffData.forEach(staff => {
            const schedule = this.preScheduleData.staff_schedules?.[staff.id] || {};
            html += this.renderStaffRow(staff, schedule, daysInMonth, prevMonthDays, nextMonthDays);
        });
        
        html += '</div>';
        return html;
    },
    
    /**
     * 渲染員工行
     */
    renderStaffRow(staff, schedule, daysInMonth, prevMonthDays, nextMonthDays) {
        let html = '<div class="staff-row">';
        html += `<div class="staff-name-cell">${staff.name}</div>`;
        
        // 前月日期
        for (let i = prevMonthDays; i > 0; i--) {
            const prevMonth = this.currentMonth === 1 ? 12 : this.currentMonth - 1;
            const prevYear = this.currentMonth === 1 ? this.currentYear - 1 : this.currentYear;
            const prevDays = Utils.getDaysInMonth(prevYear, prevMonth);
            const day = prevDays - i + 1;
            const dateStr = `${prevYear}-${String(prevMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            
            html += this.renderStaffDateCell(dateStr, schedule, staff.id, true);
        }
        
        // 當月日期
        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${this.currentYear}-${String(this.currentMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            html += this.renderStaffDateCell(dateStr, schedule, staff.id, false);
        }
        
        // 下月日期
        for (let day = 1; day <= nextMonthDays; day++) {
            const nextMonth = this.currentMonth === 12 ? 1 : this.currentMonth + 1;
            const nextYear = this.currentMonth === 12 ? this.currentYear + 1 : this.currentYear;
            const dateStr = `${nextYear}-${String(nextMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            
            html += this.renderStaffDateCell(dateStr, schedule, staff.id, true);
        }
        
        html += '</div>';
        return html;
    },
    
    /**
     * 渲染員工日期格子
     */
    renderStaffDateCell(dateStr, schedule, staffId, isGray) {
        const scheduleData = schedule[dateStr] || null;
        const shift = scheduleData?.shift || '';
        const isExtra = scheduleData?.is_extra || false;
        
        const cellClass = [
            'shift-cell',
            isGray ? 'gray-date' : '',
            shift ? 'has-shift' : '',
            this.isEditable && !isGray ? 'editable' : ''
        ].filter(Boolean).join(' ');
        
        const shiftColor = shift ? (CONSTANTS.SHIFT_COLORS[shift] || '#f3f4f6') : '';
        const shiftStyle = shift ? `background-color: ${shiftColor};` : '';
        
        return `
            <div 
                class="${cellClass}"
                data-date="${dateStr}"
                data-staff-id="${staffId}"
                style="${shiftStyle}"
                ${this.isEditable && !isGray ? `onclick="PreScheduleView.onCellClick('${dateStr}', '${staffId}')"` : ''}
            >
                ${shift ? `
                    <span class="shift-text">${shift}</span>
                    ${isExtra ? '<span class="extra-badge">⭐</span>' : ''}
                ` : '-'}
            </div>
        `;
    },
    
    /**
     * 取得前月需要顯示的天數
     */
    getPrevMonthDays() {
        const firstDay = new Date(this.currentYear, this.currentMonth - 1, 1);
        return firstDay.getDay(); // 0=週日, 6=週六
    },
    
    /**
     * 渲染統計資訊
     */
    renderStatistics() {
        // 根據角色決定顯示內容
        if (this.userRole === CONSTANTS.ROLES.VIEWER) {
            return this.renderPersonalStats();
        } else {
            return this.renderAllStaffStats();
        }
    },
    
    /**
     * 渲染個人統計
     */
    renderPersonalStats() {
        const currentUser = Auth.getCurrentUser();
        const schedule = this.preScheduleData.staff_schedules?.[currentUser.id] || {};
        
        const stats = this.calculateStats(schedule);
        
        return `
            <div class="card mt-4">
                <div class="card-header">
                    <h3 class="card-title">預班統計</h3>
                </div>
                <div class="card-body">
                    <div class="stats-grid" style="grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));">
                        <div class="stat-item">
                            <div class="stat-label">已預班次數</div>
                            <div class="stat-value">${stats.total}</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-label">休假 (FF)</div>
                            <div class="stat-value">${stats.off}</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-label">剩餘額度</div>
                            <div class="stat-value ${stats.remaining < 0 ? 'text-error' : 'text-success'}">
                                ${stats.remaining}
                            </div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-label">完成度</div>
                            <div class="stat-value">${stats.completion}%</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },
    
    /**
     * 渲染全員統計
     */
    renderAllStaffStats() {
        return `
            <div class="card mt-4">
                <div class="card-header">
                    <h3 class="card-title">預班進度</h3>
                </div>
                <div class="card-body">
                    <p class="text-muted">全員預班統計功能開發中...</p>
                </div>
            </div>
        `;
    },
    
    /**
     * 計算統計資料
     */
    calculateStats(schedule) {
        const entries = Object.entries(schedule);
        const total = entries.length;
        const off = entries.filter(([_, data]) => 
            data.shift === 'FF' || data.shift === 'OFF'
        ).length;
        
        const limit = CONSTANTS.DEFAULT_RULES.MONTHLY_PRE_SCHEDULE_LIMIT;
        const remaining = limit === 'dynamic' ? '不限' : limit - off;
        
        const daysInMonth = Utils.getDaysInMonth(this.currentYear, this.currentMonth);
        const completion = Math.round((total / daysInMonth) * 100);
        
        return { total, off, remaining, completion };
    },
    
    // ==================== 事件處理 ====================
    
    /**
     * 綁定事件
     */
    bindEvents() {
        // 這裡可以添加全域事件監聽
    },
    
    /**
     * 格子點擊事件
     */
    onCellClick(dateStr, staffId) {
        if (!this.isEditable) {
            Notification.warning('目前無法編輯預班');
            return;
        }
        
        // 顯示班別選擇器
        this.showShiftSelector(dateStr, staffId);
    },
    
    /**
     * 顯示班別選擇器
     */
    showShiftSelector(dateStr, staffId) {
        const currentShift = this.preScheduleData.staff_schedules?.[staffId]?.[dateStr]?.shift || '';
        
        const shiftsHtml = this.shiftsData
            .map(shift => `
                <button 
                    class="shift-option ${shift.code === currentShift ? 'active' : ''}"
                    style="background-color: ${shift.color};"
                    onclick="PreScheduleView.selectShift('${dateStr}', '${staffId}', '${shift.code}')"
                >
                    ${shift.name} (${shift.code})
                </button>
            `).join('');
        
        Modal.open({
            title: `選擇班別 - ${dateStr}`,
            content: `
                <div class="shift-selector">
                    ${shiftsHtml}
                    <button 
                        class="shift-option clear-option"
                        onclick="PreScheduleView.selectShift('${dateStr}', '${staffId}', '')"
                    >
                        清除
                    </button>
                </div>
            `,
            showFooter: false
        });
    },
    
    /**
     * 選擇班別
     */
    async selectShift(dateStr, staffId, shiftCode) {
        try {
            Modal.close();
            Loading.show('儲存中...');
            
            const unitId = Auth.getUserUnit().id;
            const monthStr = `${this.currentYear}${String(this.currentMonth).padStart(2, '0')}`;
            
            // 取得當前員工的預班資料
            const currentSchedule = this.preScheduleData.staff_schedules?.[staffId] || {};
            
            // 更新資料
            if (shiftCode) {
                currentSchedule[dateStr] = {
                    shift: shiftCode,
                    is_extra: false
                };
            } else {
                delete currentSchedule[dateStr];
            }
            
            // 儲存
            await PreScheduleService.savePreSchedule(
                unitId,
                monthStr,
                staffId,
                currentSchedule
            );
            
            // 重新載入資料
            await this.loadData();
            this.render();
            
            Loading.hide();
            Notification.success('預班儲存成功');
            
        } catch (error) {
            Loading.hide();
            Notification.error('儲存失敗', error.message);
        }
    },
    
    /**
     * 上個月
     */
    prevMonth() {
        if (this.currentMonth === 1) {
            this.currentMonth = 12;
            this.currentYear--;
        } else {
            this.currentMonth--;
        }
        this.init();
    },
    
    /**
     * 下個月
     */
    nextMonth() {
        if (this.currentMonth === 12) {
            this.currentMonth = 1;
            this.currentYear++;
        } else {
            this.currentMonth++;
        }
        this.init();
    },
    
    /**
     * 開啟狀態設定 Modal
     */
    openStatusModal() {
        // 狀態設定功能
        Notification.info('狀態設定功能開發中');
    },
    
    /**
     * 匯出預班
     */
    async exportPreSchedule() {
        try {
            Loading.show('匯出中...');
            
            const unitId = Auth.getUserUnit().id;
            const monthStr = `${this.currentYear}${String(this.currentMonth).padStart(2, '0')}`;
            
            const blob = await PreScheduleService.exportPreSchedule(unitId, monthStr, 'csv');
            Utils.downloadFile(blob, `預班表_${monthStr}.csv`, 'text/csv');
            
            Loading.hide();
            Notification.success('匯出成功');
        } catch (error) {
            Loading.hide();
            Notification.error('匯出失敗', error.message);
        }
    }
};

// 讓視圖可在全域使用
if (typeof window !== 'undefined') {
    window.PreScheduleView = PreScheduleView;
}