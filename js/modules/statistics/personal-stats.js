/**
 * js/modules/statistics/personal-stats.js
 * 個人工時統計計算模組
 * Week 7 功能
 */

import { ScheduleService } from '../../services/schedule.service.js';
import { SettingsService } from '../../services/settings.service.js';

export class PersonalStats {
    constructor() {
        this.shifts = [];
        this.rules = null;
        this.staffInfo = null;
    }

    async init() {
        this.shifts = await SettingsService.getShifts();
        this.rules = await SettingsService.getRules();
    }

    /**
     * 計算個人統計
     */
    async calculate(staffId, month, schedule) {
        this.staffInfo = await this.getStaffInfo(staffId);
        
        const stats = {
            staffId,
            month,
            staffName: this.staffInfo?.name || staffId,
            basic: this.calculateBasicStats(schedule),
            shifts: this.calculateShiftStats(schedule),
            workload: this.calculateWorkloadStats(schedule),
            holidays: this.calculateHolidayStats(schedule),
            trends: await this.calculateTrends(staffId, month),
            compliance: this.calculateCompliance(schedule)
        };

        return stats;
    }

    /**
     * 計算基本統計
     */
    calculateBasicStats(schedule) {
        let workDays = 0;
        let offDays = 0;
        let totalDays = Object.keys(schedule).length;

        Object.values(schedule).forEach(shift => {
            if (shift === 'FF' || shift === '') {
                offDays++;
            } else {
                workDays++;
            }
        });

        const standardWorkDays = this.rules?.基本規則?.標準工作天數 || 22;
        const overtimeDays = Math.max(0, workDays - standardWorkDays);

        return {
            totalDays,
            workDays,
            offDays,
            standardWorkDays,
            overtimeDays,
            workRate: ((workDays / totalDays) * 100).toFixed(1)
        };
    }

    /**
     * 計算班別統計
     */
    calculateShiftStats(schedule) {
        const shiftCounts = {};
        
        this.shifts.forEach(shift => {
            if (shift.includeInStats) {
                shiftCounts[shift.code] = 0;
            }
        });

        Object.values(schedule).forEach(shift => {
            if (shiftCounts.hasOwnProperty(shift)) {
                shiftCounts[shift]++;
            }
        });

        return shiftCounts;
    }

    /**
     * 計算工作負荷統計
     */
    calculateWorkloadStats(schedule) {
        const dates = Object.keys(schedule).sort();
        let maxConsecutive = 0;
        let currentConsecutive = 0;
        let consecutivePeriods = [];
        let startDate = null;

        dates.forEach(date => {
            const shift = schedule[date];
            
            if (shift && shift !== 'FF') {
                if (currentConsecutive === 0) startDate = date;
                currentConsecutive++;
                maxConsecutive = Math.max(maxConsecutive, currentConsecutive);
            } else {
                if (currentConsecutive > 0) {
                    consecutivePeriods.push({
                        start: startDate,
                        end: dates[dates.indexOf(date) - 1],
                        days: currentConsecutive
                    });
                }
                currentConsecutive = 0;
            }
        });

        return {
            maxConsecutive,
            consecutivePeriods: consecutivePeriods.filter(p => p.days >= 5),
            avgConsecutive: consecutivePeriods.length > 0 
                ? (consecutivePeriods.reduce((sum, p) => sum + p.days, 0) / consecutivePeriods.length).toFixed(1)
                : 0
        };
    }

    /**
     * 計算假日統計
     */
    calculateHolidayStats(schedule) {
        let holidayWorkDays = 0;
        let holidayOffDays = 0;

        Object.keys(schedule).forEach(date => {
            if (ScheduleService.isHoliday(date)) {
                const shift = schedule[date];
                if (shift && shift !== 'FF') {
                    holidayWorkDays++;
                } else {
                    holidayOffDays++;
                }
            }
        });

        return {
            holidayWorkDays,
            holidayOffDays,
            holidayWorkRate: holidayWorkDays + holidayOffDays > 0
                ? ((holidayWorkDays / (holidayWorkDays + holidayOffDays)) * 100).toFixed(1)
                : 0
        };
    }

    /**
     * 計算趨勢（近6個月）
     */
    async calculateTrends(staffId, currentMonth) {
        const trends = [];
        const date = new Date(currentMonth + '-01');

        for (let i = 5; i >= 0; i--) {
            const trendDate = new Date(date);
            trendDate.setMonth(date.getMonth() - i);
            
            const month = trendDate.getFullYear() + 
                         String(trendDate.getMonth() + 1).padStart(2, '0');

            try {
                const schedule = await ScheduleService.getStaffMonthSchedule(staffId, month);
                const basic = this.calculateBasicStats(schedule);

                trends.push({
                    month,
                    workDays: basic.workDays,
                    offDays: basic.offDays,
                    overtimeDays: basic.overtimeDays
                });
            } catch (error) {
                console.warn(`無法載入 ${month} 的統計資料`);
            }
        }

        return trends;
    }

    /**
     * 計算合規性
     */
    calculateCompliance(schedule) {
        const issues = [];

        // 檢查連續工作天數
        const workload = this.calculateWorkloadStats(schedule);
        const maxAllowed = this.staffInfo?.maxConsecutiveDays || 6;

        if (workload.maxConsecutive > maxAllowed) {
            issues.push({
                type: 'consecutive_limit',
                severity: 'warning',
                message: `最長連續工作${workload.maxConsecutive}天，超過限制${maxAllowed}天`
            });
        }

        // 檢查每7日至少休息1日
        if (workload.maxConsecutive >= 7) {
            issues.push({
                type: 'labor_law',
                severity: 'error',
                message: `連續工作超過7天，違反勞基法規定`
            });
        }

        return {
            isCompliant: issues.length === 0,
            issues
        };
    }

    /**
     * 渲染個人統計
     */
    async render(container, stats) {
        container.innerHTML = `
            <div class="personal-stats">
                <!-- 基本資訊卡 -->
                <div class="stat-card">
                    <h3>基本統計</h3>
                    <div class="stat-grid">
                        <div class="stat-item">
                            <div class="stat-label">總工作天數</div>
                            <div class="stat-value">${stats.basic.workDays} 天</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-label">休假天數</div>
                            <div class="stat-value">${stats.basic.offDays} 天</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-label">加班天數</div>
                            <div class="stat-value ${stats.basic.overtimeDays > 0 ? 'warning' : ''}">
                                ${stats.basic.overtimeDays} 天
                            </div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-label">假日上班</div>
                            <div class="stat-value">${stats.holidays.holidayWorkDays} 天</div>
                        </div>
                    </div>
                </div>

                <!-- 班別統計卡 -->
                <div class="stat-card">
                    <h3>班別統計</h3>
                    <div class="shift-stats">
                        ${this.renderShiftStats(stats.shifts)}
                    </div>
                    <canvas id="shiftChart" width="400" height="200"></canvas>
                </div>

                <!-- 工作負荷卡 -->
                <div class="stat-card">
                    <h3>工作負荷</h3>
                    <div class="stat-grid">
                        <div class="stat-item">
                            <div class="stat-label">最長連續工作</div>
                            <div class="stat-value ${stats.workload.maxConsecutive > 6 ? 'warning' : ''}">
                                ${stats.workload.maxConsecutive} 天
                            </div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-label">平均連續工作</div>
                            <div class="stat-value">${stats.workload.avgConsecutive} 天</div>
                        </div>
                    </div>
                </div>

                <!-- 趨勢圖卡 -->
                <div class="stat-card">
                    <h3>近6個月趨勢</h3>
                    <canvas id="trendChart" width="600" height="300"></canvas>
                </div>

                <!-- 合規性檢查 -->
                ${stats.compliance.issues.length > 0 ? `
                    <div class="stat-card compliance-card">
                        <h3>合規性提示</h3>
                        <div class="compliance-issues">
                            ${stats.compliance.issues.map(issue => `
                                <div class="issue ${issue.severity}">
                                    <i class="icon-${issue.severity}"></i>
                                    ${issue.message}
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
            </div>
        `;

        // 繪製圖表
        this.drawShiftChart(stats.shifts);
        this.drawTrendChart(stats.trends);
    }

    renderShiftStats(shifts) {
        return Object.keys(shifts).map(code => {
            const shift = this.shifts.find(s => s.code === code);
            return `
                <div class="shift-stat-item">
                    <span class="shift-badge" style="background-color: ${shift?.color || '#ccc'}">
                        ${code}
                    </span>
                    <span class="shift-count">${shifts[code]} 天</span>
                </div>
            `;
        }).join('');
    }

    drawShiftChart(shifts) {
        // 使用 Chart.js 繪製圓餅圖
        // 實作略
    }

    drawTrendChart(trends) {
        // 使用 Chart.js 繪製折線圖
        // 實作略
    }

    async getStaffInfo(staffId) {
        const allStaff = await SettingsService.getStaff();
        return allStaff.find(s => s.staffId === staffId);
    }

    async getExportData() {
        // 返回匯出用的資料
        return {
            // 實作略
        };
    }

    destroy() {
        // 清理
    }
}
