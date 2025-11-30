/**
 * 手動排班模組
 * 批次操作排班
 */

const ManualSchedule = {
    schedule: null,
    staffList: [],
    shifts: [],
    
    /**
     * 開啟手動排班面板
     */
    async open(schedule, staffList, shifts) {
        this.schedule = schedule;
        this.staffList = staffList;
        this.shifts = shifts;
        
        const content = `
            <div style="display: flex; flex-direction: column; gap: 20px; padding: 20px 0;">
                <!-- 快速操作 -->
                <div class="card">
                    <div class="card-header">
                        <h4 style="margin: 0;">快速操作</h4>
                    </div>
                    <div class="card-body" style="display: flex; flex-direction: column; gap: 16px;">
                        <div>
                            <h5 style="margin: 0 0 12px 0; font-size: 14px; color: #666;">批次設定班別</h5>
                            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr auto; gap: 12px; align-items: end;">
                                <div class="form-group" style="margin: 0;">
                                    <label class="form-label">開始日期</label>
                                    <input type="date" id="batch-start-date" class="form-input">
                                </div>
                                <div class="form-group" style="margin: 0;">
                                    <label class="form-label">結束日期</label>
                                    <input type="date" id="batch-end-date" class="form-input">
                                </div>
                                <div class="form-group" style="margin: 0;">
                                    <label class="form-label">班別</label>
                                    <select id="batch-shift" class="form-select">
                                        ${this.shifts.map(s => `<option value="${s.code}">${s.name} (${s.code})</option>`).join('')}
                                    </select>
                                </div>
                                <button class="btn btn-primary" id="batch-set-btn">批次設定</button>
                            </div>
                        </div>
                        
                        <div>
                            <h5 style="margin: 0 0 12px 0; font-size: 14px; color: #666;">複製排班</h5>
                            <div style="display: grid; grid-template-columns: 1fr 1fr auto; gap: 12px; align-items: end;">
                                <div class="form-group" style="margin: 0;">
                                    <label class="form-label">來源日期</label>
                                    <input type="date" id="copy-source-date" class="form-input">
                                </div>
                                <div class="form-group" style="margin: 0;">
                                    <label class="form-label">目標日期</label>
                                    <input type="date" id="copy-target-date" class="form-input">
                                </div>
                                <button class="btn btn-primary" id="copy-schedule-btn">複製排班</button>
                            </div>
                        </div>
                        
                        <div>
                            <h5 style="margin: 0 0 12px 0; font-size: 14px; color: #666;">員工操作</h5>
                            <div style="display: grid; grid-template-columns: 1fr 1fr auto; gap: 12px; align-items: end;">
                                <div class="form-group" style="margin: 0;">
                                    <label class="form-label">員工</label>
                                    <select id="staff-select" class="form-select">
                                        ${this.staffList.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
                                    </select>
                                </div>
                                <div class="form-group" style="margin: 0;">
                                    <label class="form-label">操作</label>
                                    <select id="staff-operation" class="form-select">
                                        <option value="clear">清空該員工所有排班</option>
                                        <option value="fill-off">填滿 OFF</option>
                                    </select>
                                </div>
                                <button class="btn btn-secondary" id="staff-operation-btn">執行</button>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- 範本排班 -->
                <div class="card">
                    <div class="card-header">
                        <h4 style="margin: 0;">範本排班</h4>
                    </div>
                    <div class="card-body" style="display: flex; flex-direction: column; gap: 12px;">
                        <p style="margin: 0; color: #666; font-size: 14px;">快速套用常用的排班模式</p>
                        <div style="display: flex; gap: 12px; flex-wrap: wrap;">
                            <button class="btn btn-outline" id="template-week-rotation-btn">
                                週輪班 (大→小→白)
                            </button>
                            <button class="btn btn-outline" id="template-night-rotation-btn">
                                夜班輪班 (大→小→OFF)
                            </button>
                            <button class="btn btn-outline" id="template-fixed-day-btn">
                                固定白班
                            </button>
                        </div>
                    </div>
                </div>
                
                <!-- 注意事項 -->
                <div class="alert alert-info">
                    <div class="alert-icon">ℹ️</div>
                    <div class="alert-content">
                        <div class="alert-title">提示</div>
                        手動排班的變更會立即儲存。建議先規劃好排班策略，再進行批次操作。
                    </div>
                </div>
            </div>
        `;
        
        Modal.show({
            title: '手動排班工具',
            content,
            size: 'large',
            buttons: [
                {
                    text: '關閉',
                    className: 'btn-secondary'
                }
            ]
        });
        
        this.bindModalEvents();
    },
    
    /**
     * 綁定面板事件
     */
    bindModalEvents() {
        // 批次設定
        document.getElementById('batch-set-btn')?.addEventListener('click', () => {
            this.batchSetShift();
        });
        
        // 複製排班
        document.getElementById('copy-schedule-btn')?.addEventListener('click', () => {
            this.copySchedule();
        });
        
        // 員工操作
        document.getElementById('staff-operation-btn')?.addEventListener('click', () => {
            this.executeStaffOperation();
        });
        
        // 範本排班
        document.getElementById('template-week-rotation-btn')?.addEventListener('click', () => {
            this.applyWeekRotation();
        });
        
        document.getElementById('template-night-rotation-btn')?.addEventListener('click', () => {
            this.applyNightRotation();
        });
        
        document.getElementById('template-fixed-day-btn')?.addEventListener('click', () => {
            this.applyFixedDay();
        });
    },
    
    /**
     * 批次設定班別
     */
    async batchSetShift() {
        const startDate = document.getElementById('batch-start-date').value;
        const endDate = document.getElementById('batch-end-date').value;
        const shift = document.getElementById('batch-shift').value;
        
        if (!startDate || !endDate) {
            Notification.error('請選擇日期範圍');
            return;
        }
        
        if (new Date(startDate) > new Date(endDate)) {
            Notification.error('開始日期不可晚於結束日期');
            return;
        }
        
        const confirmed = await Modal.confirm(
            `確定要將 ${startDate} 到 ${endDate} 期間，所有人員設定為「${shift}」嗎？`
        );
        
        if (!confirmed) return;
        
        try {
            Loading.show('批次設定中...');
            
            const dates = Utils.getDateRange(new Date(startDate), new Date(endDate));
            
            dates.forEach(date => {
                const dateStr = Utils.formatDate(date, 'YYYY-MM-DD');
                this.staffList.forEach(staff => {
                    this.schedule.setShift(staff.id, dateStr, shift);
                });
            });
            
            await ScheduleManagement.saveSchedule();
            await ScheduleManagement.refresh();
            
            Loading.hide();
            Notification.success(`已批次設定 ${dates.length} 天 × ${this.staffList.length} 人`);
            
        } catch (error) {
            Loading.hide();
            Notification.error('批次設定失敗: ' + error.message);
        }
    },
    
    /**
     * 複製排班
     */
    async copySchedule() {
        const sourceDate = document.getElementById('copy-source-date').value;
        const targetDate = document.getElementById('copy-target-date').value;
        
        if (!sourceDate || !targetDate) {
            Notification.error('請選擇來源和目標日期');
            return;
        }
        
        const confirmed = await Modal.confirm(
            `確定要將 ${sourceDate} 的排班複製到 ${targetDate} 嗎？`
        );
        
        if (!confirmed) return;
        
        try {
            this.staffList.forEach(staff => {
                const shift = this.schedule.getShift(staff.id, sourceDate);
                if (shift) {
                    this.schedule.setShift(staff.id, targetDate, shift);
                }
            });
            
            await ScheduleManagement.saveSchedule();
            await ScheduleManagement.refresh();
            
            Notification.success('排班已複製');
            
        } catch (error) {
            Notification.error('複製失敗: ' + error.message);
        }
    },
    
    /**
     * 執行員工操作
     */
    async executeStaffOperation() {
        const staffId = document.getElementById('staff-select').value;
        const operation = document.getElementById('staff-operation').value;
        
        const staff = this.staffList.find(s => s.id == staffId);
        if (!staff) return;
        
        const confirmed = await Modal.confirm(
            `確定要對「${staff.name}」執行此操作嗎？`
        );
        
        if (!confirmed) return;
        
        try {
            Loading.show('處理中...');
            
            const dates = this.schedule.getAllDates();
            
            if (operation === 'clear') {
                dates.forEach(date => {
                    this.schedule.clearShift(staffId, date);
                });
                Notification.success('已清空該員工的排班');
            } else if (operation === 'fill-off') {
                dates.forEach(date => {
                    if (!this.schedule.getShift(staffId, date)) {
                        this.schedule.setShift(staffId, date, 'FF');
                    }
                });
                Notification.success('已填滿 OFF');
            }
            
            await ScheduleManagement.saveSchedule();
            await ScheduleManagement.refresh();
            
            Loading.hide();
            
        } catch (error) {
            Loading.hide();
            Notification.error('操作失敗: ' + error.message);
        }
    },
    
    /**
     * 套用週輪班
     */
    async applyWeekRotation() {
        Notification.info('週輪班範本：將按照 大→小→白 的順序，為每位員工安排 7 天循環班表');
        
        const confirmed = await Modal.confirm(
            '確定要套用週輪班範本嗎？\n\n這會覆蓋現有的排班。',
            { danger: true }
        );
        
        if (!confirmed) return;
        
        try {
            Loading.show('套用範本中...');
            
            const dates = this.schedule.getAllDates();
            const pattern = ['大', '大', '小', '小', '白', '白', 'FF'];
            
            this.staffList.forEach((staff, staffIndex) => {
                dates.forEach((date, dateIndex) => {
                    const patternIndex = (dateIndex + staffIndex * 2) % pattern.length;
                    this.schedule.setShift(staff.id, date, pattern[patternIndex]);
                });
            });
            
            await ScheduleManagement.saveSchedule();
            await ScheduleManagement.refresh();
            
            Loading.hide();
            Notification.success('已套用週輪班範本');
            
        } catch (error) {
            Loading.hide();
            Notification.error('套用失敗: ' + error.message);
        }
    },
    
    /**
     * 套用夜班輪班
     */
    async applyNightRotation() {
        Notification.info('功能開發中');
    },
    
    /**
     * 套用固定白班
     */
    async applyFixedDay() {
        const confirmed = await Modal.confirm(
            '確定要將所有人員設定為固定白班嗎？',
            { danger: true }
        );
        
        if (!confirmed) return;
        
        try {
            Loading.show('套用範本中...');
            
            const dates = this.schedule.getAllDates();
            
            this.staffList.forEach(staff => {
                dates.forEach((date, index) => {
                    // 每 6 天工作休息 1 天
                    const shift = (index + 1) % 7 === 0 ? 'FF' : '白';
                    this.schedule.setShift(staff.id, date, shift);
                });
            });
            
            await ScheduleManagement.saveSchedule();
            await ScheduleManagement.refresh();
            
            Loading.hide();
            Notification.success('已套用固定白班範本');
            
        } catch (error) {
            Loading.hide();
            Notification.error('套用失敗: ' + error.message);
        }
    }
};

if (typeof window !== 'undefined') {
    window.ManualSchedule = ManualSchedule;
}