/**
 * js/modules/ai-engine/basic-algorithm.js
 * 基本排班演算法 (ES Module 版)
 * Week 4 的簡易版本：讀取預班 + 隨機分配 + 基本人數檢查
 */

import { ScheduleService } from '../../services/schedule.service.js';
import { SettingsService } from '../../services/settings.service.js';

export class BasicAlgorithm {
    constructor() {
        this.currentMonth = null;
        this.staff = [];
        this.shifts = [];
        this.groups = [];
        this.rules = null;
        this.requirements = null;
    }

    /**
     * 初始化演算法
     */
    async init(month) {
        try {
            this.currentMonth = month;
            
            // 載入必要資料
            this.staff = await SettingsService.getStaff();
            this.staff = this.staff.filter(s => s.status === '在職');
            
            this.shifts = await SettingsService.getShifts();
            this.groups = await SettingsService.getGroups();
            this.rules = await SettingsService.getRules();
            this.requirements = await SettingsService.getRequirements();

        } catch (error) {
            console.error('初始化演算法失敗:', error);
            throw error;
        }
    }

    /**
     * 執行排班
     */
    async schedule(options) {
        try {
            const { preSchedule, partialSchedule, strategy } = options;

            // 初始化排班表
            const scheduleData = this.initializeSchedule(partialSchedule);

            // 1. 先填入預班資料（強制遵守）
            if (preSchedule) {
                this.applyPreSchedule(scheduleData, preSchedule);
            }

            // 2. 計算每日需要排班的人數
            const dailyNeeds = this.calculateDailyNeeds(scheduleData);

            // 3. 為每個未排班的人員分配班別
            this.assignShifts(scheduleData, dailyNeeds);

            // 4. 檢查人數是否滿足需求
            const checkResult = this.checkStaffing(scheduleData);

            // 5. 計算統計資料
            const statistics = this.calculateStatistics(scheduleData);

            return {
                success: checkResult.success,
                scheduleData: scheduleData,
                statistics: statistics,
                issues: checkResult.issues
            };

        } catch (error) {
            console.error('排班演算法錯誤:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * 初始化排班表結構
     */
    initializeSchedule(partialSchedule) {
        const scheduleData = {};
        const daysInMonth = ScheduleService.getDaysInMonth(this.currentMonth);

        this.staff.forEach(staff => {
            scheduleData[staff.staffId] = {};
            
            // 如果有部分已排班資料，先填入
            if (partialSchedule && partialSchedule[staff.staffId]) {
                scheduleData[staff.staffId] = { ...partialSchedule[staff.staffId] };
            } else {
                // 初始化為空
                for (let day = 1; day <= daysInMonth; day++) {
                    const dateStr = this.currentMonth + day.toString().padStart(2, '0');
                    scheduleData[staff.staffId][dateStr] = '';
                }
            }
        });

        return scheduleData;
    }

    /**
     * 應用預班資料
     */
    applyPreSchedule(scheduleData, preSchedule) {
        Object.keys(preSchedule).forEach(staffId => {
            if (scheduleData[staffId]) {
                Object.keys(preSchedule[staffId]).forEach(date => {
                    // 預班必須遵守（強制覆蓋）
                    scheduleData[staffId][date] = preSchedule[staffId][date];
                });
            }
        });
    }

    /**
     * 計算每日排班需求
     */
    calculateDailyNeeds(scheduleData) {
        const dailyNeeds = {};
        const daysInMonth = ScheduleService.getDaysInMonth(this.currentMonth);

        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = this.currentMonth + day.toString().padStart(2, '0');
            const dayOfWeek = ScheduleService.getDayOfWeek(dateStr);
            
            // 取得該日的班別需求
            const dayRequirements = this.requirements[dayOfWeek] || {};
            
            // 統計已排班人數
            const currentCounts = {};
            this.staff.forEach(staff => {
                const shift = scheduleData[staff.staffId][dateStr];
                if (shift && shift !== 'FF' && shift !== '') {
                    currentCounts[shift] = (currentCounts[shift] || 0) + 1;
                }
            });

            // 計算還需要多少人
            dailyNeeds[dateStr] = {};
            Object.keys(dayRequirements).forEach(shiftCode => {
                const required = dayRequirements[shiftCode];
                const current = currentCounts[shiftCode] || 0;
                const needed = Math.max(required - current, 0);
                
                if (needed > 0) {
                    dailyNeeds[dateStr][shiftCode] = needed;
                }
            });
        }

        return dailyNeeds;
    }

    /**
     * 分配班別
     */
    assignShifts(scheduleData, dailyNeeds) {
        const daysInMonth = ScheduleService.getDaysInMonth(this.currentMonth);
        const monthlyOffDays = this.rules?.基本規則?.本月應放天數 || 8;

        // 為每個員工分配班別
        this.staff.forEach(staff => {
            let offCount = 0;

            // 先計算已有多少 OFF
            for (let day = 1; day <= daysInMonth; day++) {
                const dateStr = this.currentMonth + day.toString().padStart(2, '0');
                if (scheduleData[staff.staffId][dateStr] === 'FF') {
                    offCount++;
                }
            }

            // 隨機分配剩餘日期
            for (let day = 1; day <= daysInMonth; day++) {
                const dateStr = this.currentMonth + day.toString().padStart(2, '0');
                
                // 如果已經有排班，跳過
                if (scheduleData[staff.staffId][dateStr] && 
                    scheduleData[staff.staffId][dateStr] !== '') {
                    continue;
                }

                // 決定是否排休假
                const totalDays = daysInMonth;
                const remainingDays = totalDays - day + 1;
                const neededOffDays = monthlyOffDays - offCount;

                // 如果還需要休假，有機率排 FF
                if (neededOffDays > 0 && Math.random() < (neededOffDays / remainingDays)) {
                    scheduleData[staff.staffId][dateStr] = 'FF';
                    offCount++;
                    continue;
                }

                // 否則，從需要人力的班別中隨機選擇
                const needs = dailyNeeds[dateStr] || {};
                const availableShifts = Object.keys(needs).filter(shift => needs[shift] > 0);

                if (availableShifts.length > 0) {
                    // 隨機選擇一個班別
                    const selectedShift = availableShifts[Math.floor(Math.random() * availableShifts.length)];
                    scheduleData[staff.staffId][dateStr] = selectedShift;
                    
                    // 更新需求
                    dailyNeeds[dateStr][selectedShift]--;
                    if (dailyNeeds[dateStr][selectedShift] <= 0) {
                        delete dailyNeeds[dateStr][selectedShift];
                    }
                } else {
                    // 沒有特別需求，隨機分配一個班別（排除 FF）
                    const workShifts = this.shifts.filter(s => s.code !== 'FF' && s.includeInStats);
                    if (workShifts.length > 0) {
                        const randomShift = workShifts[Math.floor(Math.random() * workShifts.length)];
                        scheduleData[staff.staffId][dateStr] = randomShift.code;
                    }
                }
            }
        });
    }

    /**
     * 檢查人數配置
     */
    checkStaffing(scheduleData) {
        const issues = [];
        const daysInMonth = ScheduleService.getDaysInMonth(this.currentMonth);

        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = this.currentMonth + day.toString().padStart(2, '0');
            const dayOfWeek = ScheduleService.getDayOfWeek(dateStr);
            
            // 取得需求
            const dayRequirements = this.requirements[dayOfWeek] || {};

            // 統計實際人數
            const actualCounts = {};
            this.staff.forEach(staff => {
                const shift = scheduleData[staff.staffId][dateStr];
                if (shift && shift !== 'FF') {
                    actualCounts[shift] = (actualCounts[shift] || 0) + 1;
                }
            });

            // 檢查每個班別
            Object.keys(dayRequirements).forEach(shiftCode => {
                const required = dayRequirements[shiftCode];
                const actual = actualCounts[shiftCode] || 0;

                if (actual < required) {
                    issues.push({
                        date: dateStr,
                        shift: shiftCode,
                        required: required,
                        actual: actual,
                        message: `${this.formatDate(dateStr)} ${shiftCode}班人數不足：需要${required}人，實際${actual}人`
                    });
                }
            });
        }

        return {
            success: issues.length === 0,
            issues: issues
        };
    }

    /**
     * 計算統計資料
     */
    calculateStatistics(scheduleData) {
        const stats = {
            totalStaff: this.staff.length,
            totalDays: ScheduleService.getDaysInMonth(this.currentMonth),
            scheduledCells: 0,
            emptyCells: 0,
            shiftCounts: {},
            preScheduleMatch: 0
        };

        Object.keys(scheduleData).forEach(staffId => {
            Object.keys(scheduleData[staffId]).forEach(date => {
                const shift = scheduleData[staffId][date];
                
                if (shift && shift !== '') {
                    stats.scheduledCells++;
                    stats.shiftCounts[shift] = (stats.shiftCounts[shift] || 0) + 1;
                } else {
                    stats.emptyCells++;
                }
            });
        });

        return stats;
    }

    /**
     * 格式化日期
     */
    formatDate(dateStr) {
        return ScheduleService.formatDate(dateStr);
    }
}