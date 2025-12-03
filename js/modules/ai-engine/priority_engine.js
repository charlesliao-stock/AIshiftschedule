/**
 * js/modules/ai-engine/priority-engine.js
 * AI 排班優先順序權重計算引擎
 * Week 6 進階功能
 */

import { SettingsService } from '../../services/settings.service.js';
import { ScheduleService } from '../../services/schedule.service.js';

export class PriorityEngine {
    constructor() {
        // 預設優先順序配置
        this.priorities = {
            1: {
                key: 'pre_schedule',
                name: '預班內容',
                description: '必須遵守員工的預班需求',
                mandatory: true,
                weight: 1.0
            },
            2: {
                key: 'group_balance',
                name: '組別配置平衡',
                description: '確保每班都有適當的資深/資淺人員比例',
                weight: 0.9
            },
            3: {
                key: 'package_rule',
                name: '包班規則',
                description: '優先滿足包班人員的需求',
                weight: 0.85
            },
            4: {
                key: 'labor_standards',
                name: '勞基法規範',
                description: '符合勞基法的變形工時規定',
                weight: 0.8
            },
            5: {
                key: 'consecutive_limit',
                name: '連續上班限制',
                description: '避免員工連續工作天數過長',
                weight: 0.75
            },
            6: {
                key: 'shift_order',
                name: '接班順序',
                description: '遵守順向接班規則',
                weight: 0.7
            },
            7: {
                key: 'holiday_fairness',
                name: '假日公平性',
                description: '平均分配假日的工作機會',
                weight: 0.65
            },
            8: {
                key: 'work_balance',
                name: '工作天數平衡',
                description: '讓每人工作天數盡量接近',
                weight: 0.6
            }
        };

        // 排班策略預設
        this.strategies = {
            balanced: {
                name: '平衡優先',
                description: '工作天數盡量平均，假日輪流',
                weights: {
                    work_balance: 0.4,
                    holiday_fairness: 0.3,
                    group_balance: 0.3
                }
            },
            package_first: {
                name: '包班優先',
                description: '優先滿足包班需求',
                weights: {
                    package_rule: 0.5,
                    work_balance: 0.3,
                    group_balance: 0.2
                }
            },
            efficiency: {
                name: '效率優先',
                description: '快速排班，可能不夠平衡',
                weights: {
                    // 使用貪婪演算法，權重降低
                    work_balance: 0.2,
                    group_balance: 0.2
                }
            },
            custom: {
                name: '自訂',
                description: '排班者自行設定權重',
                weights: {} // 由使用者設定
            }
        };

        this.staff = [];
        this.shifts = [];
        this.groups = [];
        this.rules = null;
    }

    /**
     * 初始化引擎
     */
    async init() {
        this.staff = await SettingsService.getStaff();
        this.shifts = await SettingsService.getShifts();
        this.groups = await SettingsService.getGroups();
        this.rules = await SettingsService.getRules();
    }

    /**
     * 計算排班動作的優先分數
     * @param {Object} assignment - 排班動作 { staffId, date, shift }
     * @param {Object} currentSchedule - 目前排班狀態
     * @param {Object} context - 排班上下文
     * @returns {Number} 優先分數 (0-100)
     */
    calculatePriority(assignment, currentSchedule, context) {
        const { staffId, date, shift } = assignment;
        const { strategy = 'balanced', preSchedule } = context;

        let totalScore = 0;
        let totalWeight = 0;

        // 取得策略權重
        const strategyWeights = this.strategies[strategy]?.weights || {};

        // 計算各項優先順序分數
        Object.values(this.priorities).forEach(priority => {
            if (priority.mandatory && priority.key === 'pre_schedule') {
                // 預班是強制的，如果違反則分數為 0
                const preScheduleScore = this.checkPreSchedule(assignment, preSchedule);
                if (preScheduleScore === 0) {
                    totalScore = 0;
                    return;
                }
            }

            // 取得該項目的分數和權重
            const score = this.calculateItemScore(priority.key, assignment, currentSchedule, context);
            const weight = strategyWeights[priority.key] || priority.weight;

            totalScore += score * weight;
            totalWeight += weight;
        });

        // 正規化分數到 0-100
        return totalWeight > 0 ? (totalScore / totalWeight) * 100 : 0;
    }

    /**
     * 檢查預班合規性
     */
    checkPreSchedule(assignment, preSchedule) {
        const { staffId, date, shift } = assignment;
        
        if (preSchedule && preSchedule[staffId] && preSchedule[staffId][date]) {
            const requiredShift = preSchedule[staffId][date];
            return shift === requiredShift ? 100 : 0;
        }
        
        return 100; // 沒有預班要求，視為滿足
    }

    /**
     * 計算單項優先順序分數
     */
    calculateItemScore(key, assignment, currentSchedule, context) {
        switch (key) {
            case 'pre_schedule':
                return this.checkPreSchedule(assignment, context.preSchedule);

            case 'group_balance':
                return this.scoreGroupBalance(assignment, currentSchedule);

            case 'package_rule':
                return this.scorePackageRule(assignment, currentSchedule);

            case 'labor_standards':
                return this.scoreLaborStandards(assignment, currentSchedule);

            case 'consecutive_limit':
                return this.scoreConsecutiveLimit(assignment, currentSchedule);

            case 'shift_order':
                return this.scoreShiftOrder(assignment, currentSchedule);

            case 'holiday_fairness':
                return this.scoreHolidayFairness(assignment, currentSchedule);

            case 'work_balance':
                return this.scoreWorkBalance(assignment, currentSchedule);

            default:
                return 50; // 預設中等分數
        }
    }

    /**
     * 組別配置平衡分數
     */
    scoreGroupBalance(assignment, currentSchedule) {
        const { date, shift } = assignment;
        const staff = this.staff.find(s => s.staffId === assignment.staffId);
        if (!staff) return 0;

        // 統計該日該班的組別分布
        const shiftStaff = this.getShiftStaff(date, shift, currentSchedule);
        const groupCounts = {};

        shiftStaff.forEach(s => {
            const staffInfo = this.staff.find(st => st.staffId === s);
            if (staffInfo && staffInfo.group) {
                groupCounts[staffInfo.group] = (groupCounts[staffInfo.group] || 0) + 1;
            }
        });

        // 加入新員工後的分布
        groupCounts[staff.group] = (groupCounts[staff.group] || 0) + 1;

        // 計算變異數（越小越好）
        const counts = Object.values(groupCounts);
        const mean = counts.reduce((a, b) => a + b, 0) / counts.length;
        const variance = counts.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / counts.length;

        // 轉換為分數 (變異數越小分數越高)
        return Math.max(0, 100 - variance * 10);
    }

    /**
     * 包班規則分數
     */
    scorePackageRule(assignment, currentSchedule) {
        const { staffId, shift } = assignment;
        const staff = this.staff.find(s => s.staffId === staffId);
        
        if (!staff || !staff.isPackage) return 100; // 非包班者不影響

        // 檢查是否為包班班別
        if (staff.packageType === shift) {
            return 100; // 符合包班需求
        } else if (shift === 'FF') {
            return 80; // 包班者休假，可接受
        } else {
            return 30; // 包班者上其他班，不理想
        }
    }

    /**
     * 勞基法規範分數
     */
    scoreLaborStandards(assignment, currentSchedule) {
        const { staffId, date } = assignment;
        
        // 檢查連續工作天數
        const consecutiveDays = this.getConsecutiveDays(staffId, date, currentSchedule);
        
        // 每7日至少休息1日
        if (consecutiveDays >= 6) {
            return 20; // 即將違反
        } else if (consecutiveDays >= 7) {
            return 0; // 已違反
        }

        // 檢查工時 (簡化版)
        const weeklyHours = this.calculateWeeklyHours(staffId, date, currentSchedule);
        const flexType = this.rules?.勞基法規範?.變形工時類型 || '四週';
        
        const limit = flexType === '四週' ? 48 : 40;
        
        if (weeklyHours > limit) {
            return 0; // 超過上限
        } else if (weeklyHours > limit * 0.9) {
            return 50; // 接近上限
        }

        return 100;
    }

    /**
     * 連續上班限制分數
     */
    scoreConsecutiveLimit(assignment, currentSchedule) {
        const { staffId, date, shift } = assignment;
        const staff = this.staff.find(s => s.staffId === staffId);
        
        if (!staff || shift === 'FF') return 100;

        const maxConsecutive = staff.maxConsecutiveDays || 6;
        const consecutive = this.getConsecutiveDays(staffId, date, currentSchedule);

        if (consecutive >= maxConsecutive) {
            return 0; // 超過限制
        } else if (consecutive >= maxConsecutive - 1) {
            return 30; // 接近限制
        } else if (consecutive >= maxConsecutive - 2) {
            return 60;
        }

        return 100;
    }

    /**
     * 接班順序分數
     */
    scoreShiftOrder(assignment, currentSchedule) {
        const { staffId, date, shift } = assignment;
        
        if (shift === 'FF') return 100;

        // 取得前一天的班別
        const prevDate = this.getPreviousDate(date);
        const prevShift = currentSchedule[staffId]?.[prevDate];

        if (!prevShift || prevShift === 'FF') return 100;

        // 取得班別順序
        const prevOrder = this.getShiftOrder(prevShift);
        const currentOrder = this.getShiftOrder(shift);

        // 檢查是否順向接班
        if (currentOrder >= prevOrder) {
            return 100; // 順向
        } else {
            // 逆向接班
            const staff = this.staff.find(s => s.staffId === staffId);
            if (staff?.isPackage) {
                return 100; // 包班者不受限
            }
            return 30; // 逆向接班扣分
        }
    }

    /**
     * 假日公平性分數
     */
    scoreHolidayFairness(assignment, currentSchedule) {
        const { staffId, date, shift } = assignment;
        
        if (shift === 'FF') return 100; // 休假不影響

        // 檢查是否為假日
        if (!ScheduleService.isHoliday(date)) return 100;

        // 計算該員工已排假日班的次數
        const holidayCount = this.getHolidayWorkCount(staffId, currentSchedule);
        
        // 計算平均假日班次數
        const avgHolidayCount = this.getAverageHolidayWorkCount(currentSchedule);

        // 低於平均 -> 高分，高於平均 -> 低分
        const diff = holidayCount - avgHolidayCount;
        
        if (diff < -1) return 100;
        if (diff < 0) return 80;
        if (diff === 0) return 60;
        if (diff <= 1) return 40;
        return 20;
    }

    /**
     * 工作天數平衡分數
     */
    scoreWorkBalance(assignment, currentSchedule) {
        const { staffId, shift } = assignment;
        
        if (shift === 'FF') return 100; // 休假不影響

        // 計算該員工目前工作天數
        const workDays = this.getWorkDays(staffId, currentSchedule);
        
        // 計算平均工作天數
        const avgWorkDays = this.getAverageWorkDays(currentSchedule);

        // 低於平均 -> 高分，高於平均 -> 低分
        const diff = workDays - avgWorkDays;
        
        if (diff < -2) return 100;
        if (diff < 0) return 80;
        if (diff === 0) return 60;
        if (diff <= 2) return 40;
        return 20;
    }

    // ============ 輔助方法 ============

    getShiftStaff(date, shift, schedule) {
        const staff = [];
        Object.keys(schedule).forEach(staffId => {
            if (schedule[staffId][date] === shift) {
                staff.push(staffId);
            }
        });
        return staff;
    }

    getConsecutiveDays(staffId, date, schedule) {
        let count = 0;
        let currentDate = date;

        while (true) {
            const shift = schedule[staffId]?.[currentDate];
            if (!shift || shift === 'FF') break;
            
            count++;
            currentDate = this.getPreviousDate(currentDate);
            
            // 避免無限迴圈
            if (count > 30) break;
        }

        return count;
    }

    calculateWeeklyHours(staffId, date, schedule) {
        // 簡化版：計算本週總工時
        const weekDates = this.getWeekDates(date);
        let totalHours = 0;

        weekDates.forEach(d => {
            const shift = schedule[staffId]?.[d];
            if (shift && shift !== 'FF') {
                const shiftInfo = this.shifts.find(s => s.code === shift);
                if (shiftInfo) {
                    totalHours += this.calculateShiftHours(shiftInfo);
                }
            }
        });

        return totalHours;
    }

    calculateShiftHours(shiftInfo) {
        // 簡化計算（實際應考慮跨日）
        if (!shiftInfo.startTime || !shiftInfo.endTime) return 8;
        
        const start = parseInt(shiftInfo.startTime.split(':')[0]);
        const end = parseInt(shiftInfo.endTime.split(':')[0]);
        
        return end > start ? end - start : 24 - start + end;
    }

    getShiftOrder(shiftCode) {
        const shift = this.shifts.find(s => s.code === shiftCode);
        return shift?.order || 99;
    }

    getPreviousDate(dateStr) {
        const date = new Date(dateStr.substring(0, 4) + '-' + 
                             dateStr.substring(4, 6) + '-' + 
                             dateStr.substring(6, 8));
        date.setDate(date.getDate() - 1);
        
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        
        return `${year}${month}${day}`;
    }

    getWeekDates(dateStr) {
        // 取得本週所有日期（週一到週日）
        const dates = [];
        const date = new Date(dateStr.substring(0, 4) + '-' + 
                             dateStr.substring(4, 6) + '-' + 
                             dateStr.substring(6, 8));
        
        const dayOfWeek = date.getDay();
        const monday = new Date(date);
        monday.setDate(date.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));

        for (let i = 0; i < 7; i++) {
            const d = new Date(monday);
            d.setDate(monday.getDate() + i);
            dates.push(this.formatDate(d));
        }

        return dates;
    }

    formatDate(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}${month}${day}`;
    }

    getHolidayWorkCount(staffId, schedule) {
        let count = 0;
        Object.keys(schedule[staffId] || {}).forEach(date => {
            const shift = schedule[staffId][date];
            if (shift && shift !== 'FF' && ScheduleService.isHoliday(date)) {
                count++;
            }
        });
        return count;
    }

    getAverageHolidayWorkCount(schedule) {
        const counts = [];
        Object.keys(schedule).forEach(staffId => {
            counts.push(this.getHolidayWorkCount(staffId, schedule));
        });
        return counts.length > 0 
            ? counts.reduce((a, b) => a + b, 0) / counts.length 
            : 0;
    }

    getWorkDays(staffId, schedule) {
        let count = 0;
        Object.keys(schedule[staffId] || {}).forEach(date => {
            const shift = schedule[staffId][date];
            if (shift && shift !== 'FF') {
                count++;
            }
        });
        return count;
    }

    getAverageWorkDays(schedule) {
        const counts = [];
        Object.keys(schedule).forEach(staffId => {
            counts.push(this.getWorkDays(staffId, schedule));
        });
        return counts.length > 0 
            ? counts.reduce((a, b) => a + b, 0) / counts.length 
            : 0;
    }

    /**
     * 取得優先順序配置
     */
    getPriorities() {
        return this.priorities;
    }

    /**
     * 更新優先順序權重
     */
    updatePriority(key, weight) {
        Object.values(this.priorities).forEach(priority => {
            if (priority.key === key && !priority.mandatory) {
                priority.weight = weight;
            }
        });
    }

    /**
     * 取得策略配置
     */
    getStrategies() {
        return this.strategies;
    }

    /**
     * 更新策略權重
     */
    updateStrategy(strategyName, weights) {
        if (this.strategies[strategyName]) {
            this.strategies[strategyName].weights = weights;
        }
    }
}