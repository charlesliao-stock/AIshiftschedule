/**
 * js/modules/ai-engine/conflict-resolver.js
 * AI 排班衝突解決策略引擎
 * Week 6 進階功能
 */

import { SettingsService } from '../../services/settings.service.js';
import { ScheduleService } from '../../services/schedule.service.js';
import { PriorityEngine } from './priority-engine.js';

export class ConflictResolver {
    constructor() {
        this.priorityEngine = new PriorityEngine();
        this.staff = [];
        this.shifts = [];
        this.rules = null;
        this.conflicts = [];
    }

    /**
     * 初始化衝突解決器
     */
    async init() {
        await this.priorityEngine.init();
        this.staff = await SettingsService.getStaff();
        this.shifts = await SettingsService.getShifts();
        this.rules = await SettingsService.getRules();
        this.conflicts = [];
    }

    /**
     * 偵測排班衝突
     * @param {Object} schedule - 排班資料
     * @param {Object} context - 排班上下文
     * @returns {Array} 衝突清單
     */
    detectConflicts(schedule, context) {
        this.conflicts = [];

        // 1. 預班衝突
        if (context.preSchedule) {
            this.detectPreScheduleConflicts(schedule, context.preSchedule);
        }

        // 2. 人力不足衝突
        this.detectStaffShortageConflicts(schedule);

        // 3. 規則違反衝突
        this.detectRuleViolations(schedule);

        // 4. 包班衝突
        this.detectPackageConflicts(schedule);

        // 5. 組別配置衝突
        this.detectGroupBalanceConflicts(schedule);

        return this.conflicts;
    }

    /**
     * 偵測預班衝突
     */
    detectPreScheduleConflicts(schedule, preSchedule) {
        Object.keys(preSchedule).forEach(staffId => {
            Object.keys(preSchedule[staffId]).forEach(date => {
                const requiredShift = preSchedule[staffId][date];
                const actualShift = schedule[staffId]?.[date];

                if (actualShift !== requiredShift) {
                    this.conflicts.push({
                        type: 'pre_schedule',
                        severity: 'critical', // 嚴重等級
                        staffId: staffId,
                        date: date,
                        expected: requiredShift,
                        actual: actualShift,
                        message: `預班衝突：${this.getStaffName(staffId)} 在 ${this.formatDate(date)} 預排${requiredShift}，實際為${actualShift}`
                    });
                }
            });
        });
    }

    /**
     * 偵測人力不足衝突
     */
    detectStaffShortageConflicts(schedule) {
        const daysInMonth = ScheduleService.getDaysInMonth(
            Object.keys(schedule)[0]?.substring(0, 6)
        );
        const requirements = this.rules?.週間人數需求 || {};

        for (let day = 1; day <= daysInMonth; day++) {
            const monthPrefix = Object.keys(schedule)[0]?.substring(0, 6);
            const dateStr = monthPrefix + day.toString().padStart(2, '0');
            const dayOfWeek = ScheduleService.getDayOfWeek(dateStr);
            
            const dayRequirements = requirements[dayOfWeek] || {};

            // 統計實際人數
            const actualCounts = this.countShiftStaff(schedule, dateStr);

            // 檢查每個班別
            Object.keys(dayRequirements).forEach(shiftCode => {
                const required = dayRequirements[shiftCode];
                const actual = actualCounts[shiftCode] || 0;

                if (actual < required) {
                    this.conflicts.push({
                        type: 'staff_shortage',
                        severity: 'error',
                        date: dateStr,
                        shift: shiftCode,
                        required: required,
                        actual: actual,
                        shortage: required - actual,
                        message: `人力不足：${this.formatDate(dateStr)} ${shiftCode}班需要${required}人，實際${actual}人`
                    });
                }
            });
        }
    }

    /**
     * 偵測規則違反
     */
    detectRuleViolations(schedule) {
        Object.keys(schedule).forEach(staffId => {
            const staff = this.staff.find(s => s.staffId === staffId);
            if (!staff) return;

            // 檢查連續工作天數
            this.checkConsecutiveDays(schedule, staffId, staff);

            // 檢查接班順序
            if (this.rules?.接班規則?.啟用接班順序規則) {
                this.checkShiftOrder(schedule, staffId, staff);
            }

            // 檢查勞基法規範
            if (this.rules?.勞基法規範?.啟用勞基法檢查) {
                this.checkLaborStandards(schedule, staffId, staff);
            }

            // 檢查包班規則
            if (staff.isPackage && this.rules?.包班規則?.啟用包班規則) {
                this.checkPackageRules(schedule, staffId, staff);
            }
        });
    }

    /**
     * 檢查連續工作天數
     */
    checkConsecutiveDays(schedule, staffId, staff) {
        const maxConsecutive = staff.maxConsecutiveDays || 6;
        const dates = Object.keys(schedule[staffId]).sort();
        
        let consecutive = 0;
        let startDate = null;

        dates.forEach(date => {
            const shift = schedule[staffId][date];
            
            if (shift && shift !== 'FF') {
                if (consecutive === 0) startDate = date;
                consecutive++;

                if (consecutive > maxConsecutive) {
                    this.conflicts.push({
                        type: 'consecutive_limit',
                        severity: 'warning',
                        staffId: staffId,
                        startDate: startDate,
                        endDate: date,
                        consecutive: consecutive,
                        limit: maxConsecutive,
                        message: `連續工作過長：${this.getStaffName(staffId)} 從 ${this.formatDate(startDate)} 連續工作${consecutive}天（上限${maxConsecutive}天）`
                    });
                }
            } else {
                consecutive = 0;
                startDate = null;
            }
        });

        // 檢查每7日至少休息1日
        if (consecutive >= 7) {
            this.conflicts.push({
                type: 'labor_standards',
                severity: 'error',
                staffId: staffId,
                message: `違反勞基法：${this.getStaffName(staffId)} 連續工作7天以上，違反每7日至少休息1日規定`
            });
        }
    }

    /**
     * 檢查接班順序
     */
    checkShiftOrder(schedule, staffId, staff) {
        if (staff.isPackage) return; // 包班者不受限

        const dates = Object.keys(schedule[staffId]).sort();
        
        for (let i = 1; i < dates.length; i++) {
            const prevDate = dates[i - 1];
            const currentDate = dates[i];
            
            const prevShift = schedule[staffId][prevDate];
            const currentShift = schedule[staffId][currentDate];

            if (!prevShift || !currentShift || 
                prevShift === 'FF' || currentShift === 'FF') continue;

            const prevOrder = this.getShiftOrder(prevShift);
            const currentOrder = this.getShiftOrder(currentShift);

            if (currentOrder < prevOrder) {
                this.conflicts.push({
                    type: 'shift_order',
                    severity: 'warning',
                    staffId: staffId,
                    date: currentDate,
                    prevShift: prevShift,
                    currentShift: currentShift,
                    message: `接班順序不當：${this.getStaffName(staffId)} 在 ${this.formatDate(currentDate)} 從${prevShift}接${currentShift}（逆向接班）`
                });
            }

            // 檢查 FF 後不接大夜
            if (this.rules?.特殊規則?.啟用FF後不接大夜 && 
                prevShift === 'FF' && currentShift === '大') {
                this.conflicts.push({
                    type: 'shift_order',
                    severity: 'warning',
                    staffId: staffId,
                    date: currentDate,
                    message: `接班規則：${this.getStaffName(staffId)} 在 ${this.formatDate(currentDate)} FF後接大夜`
                });
            }
        }
    }

    /**
     * 檢查勞基法規範
     */
    checkLaborStandards(schedule, staffId, staff) {
        const flexType = this.rules?.勞基法規範?.變形工時類型 || '四週';
        
        if (flexType === '四週') {
            this.checkFourWeekFlex(schedule, staffId);
        } else if (flexType === '兩週') {
            this.checkTwoWeekFlex(schedule, staffId);
        }
    }

    /**
     * 檢查四週變形工時
     */
    checkFourWeekFlex(schedule, staffId) {
        // 簡化版：檢查每週工時上限
        const dates = Object.keys(schedule[staffId]).sort();
        const weeks = this.groupByWeek(dates);

        weeks.forEach((weekDates, weekIndex) => {
            let weeklyHours = 0;

            weekDates.forEach(date => {
                const shift = schedule[staffId][date];
                if (shift && shift !== 'FF') {
                    const shiftInfo = this.shifts.find(s => s.code === shift);
                    if (shiftInfo) {
                        weeklyHours += this.calculateShiftHours(shiftInfo);
                    }
                }
            });

            if (weeklyHours > 48) {
                this.conflicts.push({
                    type: 'labor_standards',
                    severity: 'error',
                    staffId: staffId,
                    week: weekIndex + 1,
                    hours: weeklyHours,
                    limit: 48,
                    message: `違反勞基法：${this.getStaffName(staffId)} 第${weekIndex + 1}週工時${weeklyHours}小時（四週變形上限48小時）`
                });
            }
        });
    }

    /**
     * 檢查兩週變形工時
     */
    checkTwoWeekFlex(schedule, staffId) {
        // 類似四週變形，但上限不同
        const dates = Object.keys(schedule[staffId]).sort();
        const weeks = this.groupByWeek(dates);

        weeks.forEach((weekDates, weekIndex) => {
            let weeklyHours = 0;

            weekDates.forEach(date => {
                const shift = schedule[staffId][date];
                if (shift && shift !== 'FF') {
                    const shiftInfo = this.shifts.find(s => s.code === shift);
                    if (shiftInfo) {
                        weeklyHours += this.calculateShiftHours(shiftInfo);
                    }
                }
            });

            if (weeklyHours > 48) {
                this.conflicts.push({
                    type: 'labor_standards',
                    severity: 'error',
                    staffId: staffId,
                    week: weekIndex + 1,
                    hours: weeklyHours,
                    limit: 48,
                    message: `違反勞基法：${this.getStaffName(staffId)} 第${weekIndex + 1}週工時${weeklyHours}小時（兩週變形上限48小時）`
                });
            }
        });
    }

    /**
     * 檢查包班規則
     */
    checkPackageRules(schedule, staffId, staff) {
        const packageShift = staff.packageType;
        const minDays = this.rules?.包班規則?.包班最少天數 || 16;

        let packageDays = 0;

        Object.values(schedule[staffId]).forEach(shift => {
            if (shift === packageShift) {
                packageDays++;
            }
        });

        if (packageDays < minDays) {
            this.conflicts.push({
                type: 'package_rule',
                severity: 'warning',
                staffId: staffId,
                packageShift: packageShift,
                actual: packageDays,
                required: minDays,
                message: `包班不足：${this.getStaffName(staffId)} 包${packageShift}班僅${packageDays}天（最少${minDays}天）`
            });
        }
    }

    /**
     * 偵測包班衝突
     */
    detectPackageConflicts(schedule) {
        const packageStaff = this.staff.filter(s => s.isPackage);

        packageStaff.forEach(staff => {
            this.checkPackageRules(schedule, staff.staffId, staff);
        });
    }

    /**
     * 偵測組別配置衝突
     */
    detectGroupBalanceConflicts(schedule) {
        const daysInMonth = ScheduleService.getDaysInMonth(
            Object.keys(schedule)[0]?.substring(0, 6)
        );

        for (let day = 1; day <= daysInMonth; day++) {
            const monthPrefix = Object.keys(schedule)[0]?.substring(0, 6);
            const dateStr = monthPrefix + day.toString().padStart(2, '0');

            // 檢查每個班別的組別配置
            this.shifts.forEach(shift => {
                if (shift.code === 'FF') return;

                const shiftStaff = this.getShiftStaff(schedule, dateStr, shift.code);
                const groupCounts = this.countGroups(shiftStaff);

                // 檢查是否有組別缺席
                this.groups?.forEach(group => {
                    const min = group.minPerShift || 0;
                    const actual = groupCounts[group.name] || 0;

                    if (actual < min) {
                        this.conflicts.push({
                            type: 'group_balance',
                            severity: 'warning',
                            date: dateStr,
                            shift: shift.code,
                            group: group.name,
                            required: min,
                            actual: actual,
                            message: `組別配置不足：${this.formatDate(dateStr)} ${shift.code}班 ${group.name}需要${min}人，實際${actual}人`
                        });
                    }
                });
            });
        }
    }

    /**
     * 解決衝突
     * @param {Array} conflicts - 衝突清單
     * @param {Object} schedule - 排班資料
     * @param {Object} context - 排班上下文
     * @returns {Object} 解決結果
     */
    async resolveConflicts(conflicts, schedule, context) {
        const resolvedConflicts = [];
        const unresolvedConflicts = [];
        const adjustments = [];

        // 按嚴重程度排序
        const sortedConflicts = this.sortConflictsBySeverity(conflicts);

        for (const conflict of sortedConflicts) {
            const resolution = await this.resolveConflict(conflict, schedule, context);

            if (resolution.success) {
                resolvedConflicts.push(conflict);
                adjustments.push(...resolution.adjustments);
                
                // 應用調整
                resolution.adjustments.forEach(adj => {
                    if (!schedule[adj.staffId]) schedule[adj.staffId] = {};
                    schedule[adj.staffId][adj.date] = adj.newShift;
                });
            } else {
                unresolvedConflicts.push({
                    ...conflict,
                    reason: resolution.reason
                });
            }
        }

        return {
            success: unresolvedConflicts.length === 0,
            resolvedCount: resolvedConflicts.length,
            unresolvedCount: unresolvedConflicts.length,
            resolvedConflicts,
            unresolvedConflicts,
            adjustments
        };
    }

    /**
     * 解決單一衝突
     */
    async resolveConflict(conflict, schedule, context) {
        switch (conflict.type) {
            case 'pre_schedule':
                return this.resolvePreScheduleConflict(conflict, schedule);

            case 'staff_shortage':
                return this.resolveStaffShortageConflict(conflict, schedule, context);

            case 'consecutive_limit':
                return this.resolveConsecutiveLimitConflict(conflict, schedule);

            case 'shift_order':
                return this.resolveShiftOrderConflict(conflict, schedule);

            case 'package_rule':
                return this.resolvePackageConflict(conflict, schedule);

            case 'group_balance':
                return this.resolveGroupBalanceConflict(conflict, schedule);

            default:
                return { success: false, reason: '未知的衝突類型' };
        }
    }

    /**
     * 解決預班衝突（強制修正）
     */
    resolvePreScheduleConflict(conflict, schedule) {
        return {
            success: true,
            adjustments: [{
                staffId: conflict.staffId,
                date: conflict.date,
                oldShift: conflict.actual,
                newShift: conflict.expected,
                reason: '修正為預班內容'
            }]
        };
    }

    /**
     * 解決人力不足衝突
     */
    resolveStaffShortageConflict(conflict, schedule, context) {
        const { date, shift, shortage } = conflict;
        const adjustments = [];

        // 尋找該日休假的員工
        const availableStaff = this.findAvailableStaff(schedule, date, shift);

        if (availableStaff.length >= shortage) {
            // 選擇優先分數最高的員工
            const selectedStaff = this.selectBestStaff(
                availableStaff,
                date,
                shift,
                schedule,
                context,
                shortage
            );

            selectedStaff.forEach(staffId => {
                adjustments.push({
                    staffId: staffId,
                    date: date,
                    oldShift: schedule[staffId][date],
                    newShift: shift,
                    reason: `補足${shift}班人力`
                });
            });

            return { success: true, adjustments };
        }

        return { 
            success: false, 
            reason: `無足夠人力（需要${shortage}人，可用${availableStaff.length}人）` 
        };
    }

    /**
     * 解決連續工作過長衝突
     */
    resolveConsecutiveLimitConflict(conflict, schedule) {
        const { staffId, endDate } = conflict;
        
        // 在連續工作期間插入休假
        return {
            success: true,
            adjustments: [{
                staffId: staffId,
                date: endDate,
                oldShift: schedule[staffId][endDate],
                newShift: 'FF',
                reason: '插入休假以避免連續工作過長'
            }]
        };
    }

    /**
     * 解決接班順序衝突
     */
    resolveShiftOrderConflict(conflict, schedule) {
        // 接班順序衝突通常不強制修正（除非嚴重）
        if (conflict.severity === 'critical') {
            return {
                success: true,
                adjustments: [{
                    staffId: conflict.staffId,
                    date: conflict.date,
                    oldShift: conflict.currentShift,
                    newShift: 'FF',
                    reason: '修正接班順序違規'
                }]
            };
        }

        return { success: false, reason: '接班順序衝突，建議手動調整' };
    }

    /**
     * 解決包班衝突
     */
    resolvePackageConflict(conflict, schedule) {
        const { staffId, packageShift } = conflict;
        const dates = Object.keys(schedule[staffId]);
        const adjustments = [];

        // 尋找可以改為包班班別的日期
        for (const date of dates) {
            const currentShift = schedule[staffId][date];
            
            if (currentShift !== packageShift && currentShift !== 'FF') {
                adjustments.push({
                    staffId: staffId,
                    date: date,
                    oldShift: currentShift,
                    newShift: packageShift,
                    reason: '調整為包班班別'
                });

                if (adjustments.length >= (conflict.required - conflict.actual)) {
                    break;
                }
            }
        }

        return { 
            success: adjustments.length > 0, 
            adjustments 
        };
    }

    /**
     * 解決組別配置衝突
     */
    resolveGroupBalanceConflict(conflict, schedule) {
        const { date, shift, group } = conflict;
        
        // 尋找該組別的員工
        const groupStaff = this.staff.filter(s => s.group === group);
        const availableStaff = groupStaff.filter(staffId => 
            schedule[staffId.staffId]?.[date] === 'FF'
        );

        if (availableStaff.length > 0) {
            return {
                success: true,
                adjustments: [{
                    staffId: availableStaff[0].staffId,
                    date: date,
                    oldShift: 'FF',
                    newShift: shift,
                    reason: `補足${group}人員`
                }]
            };
        }

        return { success: false, reason: `無可用的${group}人員` };
    }

    // ============ 輔助方法 ============

    findAvailableStaff(schedule, date, shift) {
        return this.staff
            .filter(s => s.status === '在職')
            .filter(s => {
                const currentShift = schedule[s.staffId]?.[date];
                return currentShift === 'FF' || !currentShift;
            })
            .filter(s => {
                // 檢查員工是否可上該班別
                const availableShifts = s.availableShifts?.split(',') || [];
                return availableShifts.includes(shift);
            })
            .map(s => s.staffId);
    }

    selectBestStaff(staffIds, date, shift, schedule, context, count) {
        const scores = staffIds.map(staffId => ({
            staffId,
            score: this.priorityEngine.calculatePriority(
                { staffId, date, shift },
                schedule,
                context
            )
        }));

        // 按分數降序排序
        scores.sort((a, b) => b.score - a.score);

        return scores.slice(0, count).map(s => s.staffId);
    }

    sortConflictsBySeverity(conflicts) {
        const severityOrder = {
            critical: 0,
            error: 1,
            warning: 2,
            info: 3
        };

        return conflicts.sort((a, b) => 
            severityOrder[a.severity] - severityOrder[b.severity]
        );
    }

    getShiftStaff(schedule, date, shift) {
        const staffIds = [];
        Object.keys(schedule).forEach(staffId => {
            if (schedule[staffId][date] === shift) {
                staffIds.push(staffId);
            }
        });
        return staffIds;
    }

    countShiftStaff(schedule, date) {
        const counts = {};
        Object.keys(schedule).forEach(staffId => {
            const shift = schedule[staffId][date];
            if (shift && shift !== 'FF') {
                counts[shift] = (counts[shift] || 0) + 1;
            }
        });
        return counts;
    }

    countGroups(staffIds) {
        const counts = {};
        staffIds.forEach(staffId => {
            const staff = this.staff.find(s => s.staffId === staffId);
            if (staff && staff.group) {
                counts[staff.group] = (counts[staff.group] || 0) + 1;
            }
        });
        return counts;
    }

    getShiftOrder(shiftCode) {
        const shift = this.shifts.find(s => s.code === shiftCode);
        return shift?.order || 99;
    }

    calculateShiftHours(shiftInfo) {
        if (!shiftInfo.startTime || !shiftInfo.endTime) return 8;
        
        const start = parseInt(shiftInfo.startTime.split(':')[0]);
        const end = parseInt(shiftInfo.endTime.split(':')[0]);
        
        return end > start ? end - start : 24 - start + end;
    }

    groupByWeek(dates) {
        const weeks = [];
        let currentWeek = [];

        dates.forEach((date, index) => {
            currentWeek.push(date);
            
            const dayOfWeek = ScheduleService.getDayOfWeek(date);
            
            if (dayOfWeek === 0 || index === dates.length - 1) {
                weeks.push(currentWeek);
                currentWeek = [];
            }
        });

        return weeks;
    }

    getStaffName(staffId) {
        const staff = this.staff.find(s => s.staffId === staffId);
        return staff?.name || staffId;
    }

    formatDate(dateStr) {
        return ScheduleService.formatDate(dateStr);
    }

    /**
     * 取得衝突清單
     */
    getConflicts() {
        return this.conflicts;
    }

    /**
     * 清空衝突記錄
     */
    clearConflicts() {
        this.conflicts = [];
    }
}