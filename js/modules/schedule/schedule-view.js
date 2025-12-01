/**
 * js/modules/schedule/schedule-view.js
 * 排班視圖模組 (ES Module 版 - 完整實作)
 */

import { Auth } from '../../core/auth.js';
import { Notification } from '../../components/notification.js';
import { Modal } from '../../components/modal.js';
import { CONSTANTS } from '../../config/constants.js';
// 注意：這裡引用 ScheduleManagement 是為了呼叫 saveSchedule
// 為了避免循環引用，建議在 init 時傳入 saveCallback，或動態 import
// 這裡簡單起見，假設 ScheduleManagement 已載入並掛載，或使用動態引入
import { ScheduleManagement } from './schedule.js'; 

export const ScheduleView = {
    
    /**
     * 渲染日曆視圖
     */
    renderCalendar(container, schedule, staffList, shifts, holidays) {
        if (!schedule || !staffList || staffList.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📅</div>
                    <h3 class="empty-state-title">尚無人員資料</h3>
                    <p class="empty-state-message">請先在「設定管理」中新增人員</p>
                </div>
            `;
            return;
        }
        
        const dates = schedule.getAllDates();
        const prevDates = schedule.getPreviousMonthDates();
        const allDates = [...prevDates, ...dates];
        
        let html = `
            <div class="schedule-grid">
                <table class="schedule-table">
                    <thead>
                        <tr>
                            <th class="staff-name">姓名</th>
                            <th class="staff-name">組別</th>
        `;
        
        // 標題列 - 日期
        allDates.forEach((date, index) => {
            const d = new Date(date);
            const day = d.getDate();
            const weekday = CONSTANTS.WEEKDAYS_SHORT?.[d.getDay()] || '';
            const isHoliday = schedule.isHoliday(date, holidays);
            const isPrevMonth = index < prevDates.length;
            const cellClass = isHoliday ? 'holiday' : (d.getDay() === 0 || d.getDay() === 6) ? 'weekend' : '';
            
            html += `
                <th class="${cellClass}" style="${isPrevMonth ? 'opacity: 0.5;' : ''}">
                    <div style="font-size: 12px;">${day}</div>
                    <div style="font-size: 10px; color: #666;">${weekday}</div>
                </th>
            `;
        });
        
        // 統計欄位標題
        html += `
                            <th>OFF</th>
                            <th>假日</th>
                            <th>大</th>
                            <th>小</th>
                            <th>白</th>
                            <th>連續</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        // 員工排班資料
        staffList.forEach(staff => {
            html += `
                <tr>
                    <td class="staff-name">${staff.name}</td>
                    <td class="staff-name">${staff.group}</td>
            `;
            
            // 每日班別
            allDates.forEach((date, index) => {
                const shift = schedule.getShift(staff.id, date);
                const isPrevMonth = index < prevDates.length;
                const d = new Date(date);
                const isHoliday = schedule.isHoliday(date, holidays);
                const cellClass = isHoliday ? 'holiday' : (d.getDay() === 0 || d.getDay() === 6) ? 'weekend' : '';
                
                const shiftObj = shift ? shifts.find(s => s.code === shift) : null;
                const shiftColor = shiftObj ? shiftObj.color : '';
                
                html += `
                    <td class="schedule-cell ${cellClass} ${isPrevMonth ? 'readonly' : ''}" 
                        data-staff-id="${staff.id}" 
                        data-date="${date}"
                        style="${isPrevMonth ? 'opacity: 0.5;' : ''}">
                        ${shift ? `<span class="shift-code" style="background: ${shiftColor};">${shift}</span>` : '-'}
                    </td>
                `;
            });
            
            // 統計資料
            const stats = schedule.calculateStaffStats(staff.id, holidays);
            
            html += `
                    <td>${stats.offDays}</td>
                    <td>${stats.holidayWork}</td>
                    <td>${stats.shiftCounts['大'] || 0}</td>
                    <td>${stats.shiftCounts['小'] || 0}</td>
                    <td>${stats.shiftCounts['白'] || 0}</td>
                    <td>${stats.consecutiveMax}</td>
                </tr>
            `;
        });
        
        html += `
                    </tbody>
                </table>
            </div>
        `;
        
        container.innerHTML = html;
        
        // 綁定點擊事件 (如果可編輯)
        if (Auth.isAdmin() || Auth.isScheduler()) {
            this.bindCellClickEvents(container, schedule, shifts);
        }
    },
    
    /**
     * 綁定儲存格點擊事件
     */
    bindCellClickEvents(container, schedule, shifts) {
        // 使用事件委派優化效能
        container.addEventListener('click', async (e) => {
            const cell = e.target.closest('.schedule-cell');
            if (!cell || cell.classList.contains('readonly')) return;

            const staffId = cell.getAttribute('data-staff-id');
            const date = cell.getAttribute('data-date');
            
            await this.showShiftSelector(cell, schedule, staffId, date, shifts);
        });
    },
    
    /**
     * 顯示班別選擇器
     */
    async showShiftSelector(cell, schedule, staffId, date, shifts) {
        const currentShift = schedule.getShift(staffId, date);
        
        const shiftOptions = shifts.map(s => ({
            value: s.code,
            label: `${s.name} (${s.code})`
        }));
        
        // 加入清除選項
        shiftOptions.unshift({ value: '', label: '清除' });
        
        const result = await Modal.form('選擇班別', [
            {
                name: 'shift',
                label: '班別',
                type: 'select',
                options: shiftOptions,
                value: currentShift || '',
                required: false
            }
        ]);
        
        if (result !== null) {
            if (result.shift) {
                schedule.setShift(staffId, date, result.shift);
            } else {
                schedule.clearShift(staffId, date);
            }
            
            // 儲存變更
            try {
                // 直接使用導入的 ScheduleManagement
                await ScheduleManagement.saveSchedule();
                
                // 更新顯示
                const shiftObj = shifts.find(s => s.code === result.shift);
                if (result.shift && shiftObj) {
                    cell.innerHTML = `<span class="shift-code" style="background: ${shiftObj.color};">${result.shift}</span>`;
                } else {
                    cell.innerHTML = '-';
                }
                
                ScheduleManagement.updateStatistics();
                Notification.success('已更新');
                
            } catch (error) {
                Notification.error('儲存失敗: ' + error.message);
            }
        }
    }
};