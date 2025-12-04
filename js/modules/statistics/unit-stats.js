/**
 * js/modules/statistics/unit-stats.js
 * 單位人力統計模組
 * Week 7 功能
 */

import { ScheduleService } from '../../services/schedule.service.js';
import { SettingsService } from '../../services/settings.service.js';

export class UnitStats {
    constructor() {
        this.staff = [];
        this.shifts = [];
        this.groups = [];
        this.rules = null;
    }

    async init() {
        this.staff = await SettingsService.getStaff();
        this.shifts = await SettingsService.getShifts();
        this.groups = await SettingsService.getGroups();
        this.rules = await SettingsService.getRules();
    }

    /**
     * 計算單位統計
     */
    async calculate(month, schedule) {
        const stats = {
            month,
            overview: this.calculateOverview(schedule),
            staffStats: this.calculateStaffStats(schedule),
            shiftDistribution: this.calculateShiftDistribution(schedule),
            groupAnalysis: this.calculateGroupAnalysis(schedule),
            workloadAnalysis: this.calculateWorkloadAnalysis(schedule),
            holidayAnalysis: this.calculateHolidayAnalysis(schedule),
            complianceReport: this.calculateComplianceReport(schedule),
            comparison: this.calculateComparison(schedule)
        };

        return stats;
    }

    /**
     * 計算總覽
     */
    calculateOverview(schedule) {
        const totalStaff = Object.keys(schedule).length;
        const activeDays = ScheduleService.getDaysInMonth(
            Object.keys(schedule)[0]?.substring(0, 6) || ''
        );

        let totalScheduled = 0;
        let totalOff = 0;
        let totalEmpty = 0;

        Object.values(schedule).forEach(staffSchedule => {
            Object.values(staffSchedule).forEach(shift => {
                if (shift === 'FF') {
                    totalOff++;
                } else if (shift && shift !== '') {
                    totalScheduled++;
                } else {
                    totalEmpty++;
                }
            });
        });

        return {
            totalStaff,
            activeDays,
            totalCells: totalStaff * activeDays,
            totalScheduled,
            totalOff,
            totalEmpty,
            completionRate: ((totalScheduled + totalOff) / (totalStaff * activeDays) * 100).toFixed(1)
        };
    }

    /**
     * 計算員工統計
     */
    calculateStaffStats(schedule) {
        const staffStats = [];

        this.staff.forEach(staff => {
            const staffSchedule = schedule[staff.staffId] || {};
            
            let workDays = 0;
            let offDays = 0;
            let holidayWork = 0;
            let shiftCounts = {};
            let consecutive = this.calculateConsecutive(staffSchedule);

            Object.keys(staffSchedule).forEach(date => {
                const shift = staffSchedule[date];
                
                if (shift === 'FF') {
                    offDays++;
                } else if (shift && shift !== '') {
                    workDays++;
                    shiftCounts[shift] = (shiftCounts[shift] || 0) + 1;
                    
                    if (ScheduleService.isHoliday(date)) {
                        holidayWork++;
                    }
                }
            });

            const standardDays = this.rules?.基本規則?.標準工作天數 || 22;
            const overtimeDays = Math.max(0, workDays - standardDays);

            staffStats.push({
                staffId: staff.staffId,
                name: staff.name,
                group: staff.group,
                workDays,
                offDays,
                overtimeDays,
                holidayWork,
                maxConsecutive: consecutive.max,
                shiftCounts,
                issues: this.checkStaffIssues(staff, workDays, consecutive.max, holidayWork)
            });
        });

        return staffStats;
    }

    /**
     * 計算連續工作天數
     */
    calculateConsecutive(staffSchedule) {
        const dates = Object.keys(staffSchedule).sort();
        let max = 0;
        let current = 0;
        let periods = [];
        let start = null;

        dates.forEach((date, index) => {
            const shift = staffSchedule[date];
            
            if (shift && shift !== 'FF') {
                if (current === 0) start = date;
                current++;
                max = Math.max(max, current);
            } else {
                if (current > 0) {
                    periods.push({
                        start,
                        end: dates[index - 1],
                        days: current
                    });
                }
                current = 0;
            }
        });

        return { max, periods };
    }

    /**
     * 檢查員工問題
     */
    checkStaffIssues(staff, workDays, maxConsecutive, holidayWork) {
        const issues = [];

        // 檢查加班過多
        const standardDays = this.rules?.基本規則?.標準工作天數 || 22;
        if (workDays > standardDays + 3) {
            issues.push({
                type: 'overtime',
                severity: 'warning',
                message: `加班天數過多（${workDays - standardDays}天）`
            });
        }

        // 檢查連續工作
        const maxAllowed = staff.maxConsecutiveDays || 6;
        if (maxConsecutive > maxAllowed) {
            issues.push({
                type: 'consecutive',
                severity: 'error',
                message: `連續工作${maxConsecutive}天，超過限制${maxAllowed}天`
            });
        }

        // 檢查假日工作
        const avgHoliday = 2; // 可從規則取得
        if (holidayWork > avgHoliday * 1.5) {
            issues.push({
                type: 'holiday',
                severity: 'warning',
                message: `假日工作${holidayWork}天，高於平均`
            });
        }

        return issues;
    }

    /**
     * 計算班別分布
     */
    calculateShiftDistribution(schedule) {
        const distribution = {};

        this.shifts.forEach(shift => {
            if (shift.includeInStats) {
                distribution[shift.code] = {
                    name: shift.name,
                    count: 0,
                    percentage: 0,
                    color: shift.color
                };
            }
        });

        let totalWork = 0;

        Object.values(schedule).forEach(staffSchedule => {
            Object.values(staffSchedule).forEach(shift => {
                if (distribution[shift]) {
                    distribution[shift].count++;
                    totalWork++;
                }
            });
        });

        // 計算百分比
        Object.keys(distribution).forEach(code => {
            distribution[code].percentage = totalWork > 0
                ? ((distribution[code].count / totalWork) * 100).toFixed(1)
                : 0;
        });

        return distribution;
    }

    /**
     * 計算組別分析
     */
    calculateGroupAnalysis(schedule) {
        const groupStats = {};

        this.groups?.forEach(group => {
            groupStats[group.name] = {
                totalStaff: 0,
                avgWorkDays: 0,
                avgOffDays: 0,
                avgOvertime: 0,
                avgHolidayWork: 0
            };
        });

        // 統計各組別
        this.staff.forEach(staff => {
            const group = staff.group;
            if (!groupStats[group]) return;

            const staffSchedule = schedule[staff.staffId] || {};
            let workDays = 0;
            let offDays = 0;
            let holidayWork = 0;

            Object.keys(staffSchedule).forEach(date => {
                const shift = staffSchedule[date];
                if (shift === 'FF') {
                    offDays++;
                } else if (shift && shift !== '') {
                    workDays++;
                    if (ScheduleService.isHoliday(date)) {
                        holidayWork++;
                    }
                }
            });

            groupStats[group].totalStaff++;
            groupStats[group].avgWorkDays += workDays;
            groupStats[group].avgOffDays += offDays;
            groupStats[group].avgHolidayWork += holidayWork;
        });

        // 計算平均
        Object.keys(groupStats).forEach(group => {
            const count = groupStats[group].totalStaff;
            if (count > 0) {
                groupStats[group].avgWorkDays = (groupStats[group].avgWorkDays / count).toFixed(1);
                groupStats[group].avgOffDays = (groupStats[group].avgOffDays / count).toFixed(1);
                groupStats[group].avgHolidayWork = (groupStats[group].avgHolidayWork / count).toFixed(1);
            }
        });

        return groupStats;
    }

    /**
     * 計算工作負荷分析
     */
    calculateWorkloadAnalysis(schedule) {
        const workDaysList = [];

        this.staff.forEach(staff => {
            const staffSchedule = schedule[staff.staffId] || {};
            let workDays = 0;

            Object.values(staffSchedule).forEach(shift => {
                if (shift && shift !== 'FF') {
                    workDays++;
                }
            });

            workDaysList.push(workDays);
        });

        // 計算統計量
        const sorted = workDaysList.sort((a, b) => a - b);
        const sum = workDaysList.reduce((a, b) => a + b, 0);
        const avg = sum / workDaysList.length;
        const min = sorted[0];
        const max = sorted[sorted.length - 1];
        const median = sorted[Math.floor(sorted.length / 2)];
        
        // 計算標準差
        const variance = workDaysList.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / workDaysList.length;
        const stdDev = Math.sqrt(variance);

        return {
            min,
            max,
            avg: avg.toFixed(1),
            median,
            stdDev: stdDev.toFixed(2),
            range: max - min,
            distribution: this.createDistribution(workDaysList)
        };
    }

    /**
     * 建立分布圖資料
     */
    createDistribution(data) {
        const distribution = {};
        data.forEach(val => {
            distribution[val] = (distribution[val] || 0) + 1;
        });
        return distribution;
    }

    /**
     * 計算假日分析
     */
    calculateHolidayAnalysis(schedule) {
        const daysInMonth = ScheduleService.getDaysInMonth(
            Object.keys(schedule)[0]?.substring(0, 6) || ''
        );

        let totalHolidays = 0;
        const holidayWork = [];

        for (let day = 1; day <= daysInMonth; day++) {
            const monthPrefix = Object.keys(schedule)[0]?.substring(0, 6);
            const dateStr = monthPrefix + day.toString().padStart(2, '0');
            
            if (ScheduleService.isHoliday(dateStr)) {
                totalHolidays++;
                
                let workCount = 0;
                Object.values(schedule).forEach(staffSchedule => {
                    const shift = staffSchedule[dateStr];
                    if (shift && shift !== 'FF') {
                        workCount++;
                    }
                });

                holidayWork.push({
                    date: dateStr,
                    workCount
                });
            }
        }

        const totalStaff = Object.keys(schedule).length;
        const avgHolidayWork = holidayWork.length > 0
            ? (holidayWork.reduce((sum, h) => sum + h.workCount, 0) / totalStaff).toFixed(1)
            : 0;

        return {
            totalHolidays,
            holidayWork,
            avgHolidayWork,
            holidayCoverage: totalHolidays > 0
                ? ((holidayWork.reduce((sum, h) => sum + h.workCount, 0) / (totalHolidays * totalStaff)) * 100).toFixed(1)
                : 0
        };
    }

    /**
     * 計算合規性報告
     */
    calculateComplianceReport(schedule) {
        const issues = [];
        let totalChecks = 0;
        let passedChecks = 0;

        this.staff.forEach(staff => {
            const staffSchedule = schedule[staff.staffId] || {};
            const consecutive = this.calculateConsecutive(staffSchedule);

            // 檢查連續工作天數
            totalChecks++;
            const maxAllowed = staff.maxConsecutiveDays || 6;
            if (consecutive.max <= maxAllowed) {
                passedChecks++;
            } else {
                issues.push({
                    type: 'consecutive',
                    severity: 'error',
                    staffId: staff.staffId,
                    staffName: staff.name,
                    message: `連續工作${consecutive.max}天（限制${maxAllowed}天）`
                });
            }

            // 檢查每7日至少休息1日
            totalChecks++;
            if (consecutive.max < 7) {
                passedChecks++;
            } else {
                issues.push({
                    type: 'labor_law',
                    severity: 'critical',
                    staffId: staff.staffId,
                    staffName: staff.name,
                    message: `連續工作7天以上，違反勞基法`
                });
            }
        });

        return {
            totalChecks,
            passedChecks,
            complianceRate: ((passedChecks / totalChecks) * 100).toFixed(1),
            issues: issues.sort((a, b) => {
                const severityOrder = { critical: 0, error: 1, warning: 2 };
                return severityOrder[a.severity] - severityOrder[b.severity];
            })
        };
    }

    /**
     * 計算比較分析
     */
    calculateComparison(schedule) {
        const staffStats = this.calculateStaffStats(schedule);
        
        // 工作天數排名
        const workDaysRanking = [...staffStats]
            .sort((a, b) => b.workDays - a.workDays)
            .slice(0, 5);

        // 假日工作排名
        const holidayWorkRanking = [...staffStats]
            .sort((a, b) => b.holidayWork - a.holidayWork)
            .slice(0, 5);

        // 加班天數排名
        const overtimeRanking = [...staffStats]
            .filter(s => s.overtimeDays > 0)
            .sort((a, b) => b.overtimeDays - a.overtimeDays)
            .slice(0, 5);

        return {
            workDaysRanking,
            holidayWorkRanking,
            overtimeRanking
        };
    }

    /**
     * 渲染單位統計
     */
    async render(container, stats) {
        container.innerHTML = `
            <div class="unit-stats">
                <!-- 總覽卡片 -->
                <div class="stat-card overview-card">
                    <h3>單位總覽</h3>
                    <div class="stat-grid">
                        <div class="stat-item">
                            <div class="stat-label">總員工數</div>
                            <div class="stat-value">${stats.overview.totalStaff} 人</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-label">排班天數</div>
                            <div class="stat-value">${stats.overview.activeDays} 天</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-label">完成率</div>
                            <div class="stat-value">${stats.overview.completionRate}%</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-label">合規率</div>
                            <div class="stat-value ${stats.complianceReport.complianceRate < 100 ? 'warning' : ''}">
                                ${stats.complianceReport.complianceRate}%
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 員工統計表格 -->
                <div class="stat-card">
                    <h3>員工統計</h3>
                    <div class="table-responsive">
                        ${this.renderStaffTable(stats.staffStats)}
                    </div>
                </div>

                <!-- 班別分布 -->
                <div class="stat-card">
                    <h3>班別分布</h3>
                    <canvas id="shiftDistChart" width="400" height="300"></canvas>
                    ${this.renderShiftDistribution(stats.shiftDistribution)}
                </div>

                <!-- 組別分析 -->
                <div class="stat-card">
                    <h3>組別分析</h3>
                    ${this.renderGroupAnalysis(stats.groupAnalysis)}
                </div>

                <!-- 工作負荷分析 -->
                <div class="stat-card">
                    <h3>工作負荷分析</h3>
                    ${this.renderWorkloadAnalysis(stats.workloadAnalysis)}
                    <canvas id="workloadChart" width="600" height="300"></canvas>
                </div>

                <!-- 合規性報告 -->
                ${stats.complianceReport.issues.length > 0 ? `
                    <div class="stat-card compliance-card">
                        <h3>合規性問題</h3>
                        ${this.renderComplianceIssues(stats.complianceReport.issues)}
                    </div>
                ` : ''}
            </div>
        `;

        // 繪製圖表
        this.drawShiftDistChart(stats.shiftDistribution);
        this.drawWorkloadChart(stats.workloadAnalysis);
    }

    renderStaffTable(staffStats) {
        return `
            <table class="stats-table">
                <thead>
                    <tr>
                        <th>姓名</th>
                        <th>組別</th>
                        <th>工作天數</th>
                        <th>休假</th>
                        <th>加班</th>
                        <th>假日</th>
                        <th>最長連續</th>
                        <th>狀態</th>
                    </tr>
                </thead>
                <tbody>
                    ${staffStats.map(staff => `
                        <tr>
                            <td>${staff.name}</td>
                            <td>${staff.group}</td>
                            <td>${staff.workDays}</td>
                            <td>${staff.offDays}</td>
                            <td class="${staff.overtimeDays > 0 ? 'warning' : ''}">${staff.overtimeDays}</td>
                            <td>${staff.holidayWork}</td>
                            <td class="${staff.maxConsecutive > 6 ? 'warning' : ''}">${staff.maxConsecutive}</td>
                            <td>
                                ${staff.issues.length === 0 
                                    ? '<span class="badge success">✓</span>' 
                                    : `<span class="badge ${staff.issues[0].severity}">${staff.issues.length}</span>`
                                }
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }

    renderShiftDistribution(distribution) {
        return `
            <div class="shift-dist-list">
                ${Object.keys(distribution).map(code => {
                    const shift = distribution[code];
                    return `
                        <div class="shift-dist-item">
                            <div class="shift-info">
                                <span class="shift-badge" style="background-color: ${shift.color}">
                                    ${code}
                                </span>
                                <span class="shift-name">${shift.name}</span>
                            </div>
                            <div class="shift-count">${shift.count} 次 (${shift.percentage}%)</div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }

    renderGroupAnalysis(groupStats) {
        return `
            <table class="stats-table">
                <thead>
                    <tr>
                        <th>組別</th>
                        <th>人數</th>
                        <th>平均工作天數</th>
                        <th>平均休假</th>
                        <th>平均假日工作</th>
                    </tr>
                </thead>
                <tbody>
                    ${Object.keys(groupStats).map(group => {
                        const stats = groupStats[group];
                        return `
                            <tr>
                                <td>${group}</td>
                                <td>${stats.totalStaff}</td>
                                <td>${stats.avgWorkDays}</td>
                                <td>${stats.avgOffDays}</td>
                                <td>${stats.avgHolidayWork}</td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        `;
    }

    renderWorkloadAnalysis(analysis) {
        return `
            <div class="workload-stats">
                <div class="stat-item">
                    <div class="stat-label">最少</div>
                    <div class="stat-value">${analysis.min} 天</div>
                </div>
                <div class="stat-item">
                    <div class="stat-label">最多</div>
                    <div class="stat-value">${analysis.max} 天</div>
                </div>
                <div class="stat-item">
                    <div class="stat-label">平均</div>
                    <div class="stat-value">${analysis.avg} 天</div>
                </div>
                <div class="stat-item">
                    <div class="stat-label">中位數</div>
                    <div class="stat-value">${analysis.median} 天</div>
                </div>
                <div class="stat-item">
                    <div class="stat-label">標準差</div>
                    <div class="stat-value">${analysis.stdDev}</div>
                </div>
                <div class="stat-item">
                    <div class="stat-label">差距</div>
                    <div class="stat-value">${analysis.range} 天</div>
                </div>
            </div>
        `;
    }

    renderComplianceIssues(issues) {
        return `
            <div class="compliance-issues">
                ${issues.map(issue => `
                    <div class="issue ${issue.severity}">
                        <div class="issue-icon">
                            ${issue.severity === 'critical' ? '🚫' : 
                              issue.severity === 'error' ? '❌' : '⚠️'}
                        </div>
                        <div class="issue-content">
                            <div class="issue-staff">${issue.staffName}</div>
                            <div class="issue-message">${issue.message}</div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    drawShiftDistChart(distribution) {
        // 使用 Chart.js 繪製圓餅圖
        // 實作略
    }

    drawWorkloadChart(analysis) {
        // 使用 Chart.js 繪製分布圖
        // 實作略
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
