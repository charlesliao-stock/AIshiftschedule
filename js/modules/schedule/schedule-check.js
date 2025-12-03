/**
 * 排班規則檢查模組
 * 檢查排班是否符合各項規則和勞基法規範
 */

import { ScheduleService } from '../../services/schedule.service.js';
import { SettingsService } from '../../services/settings.service.js';
import Notification from '../../components/notification.js';

class ScheduleCheck {
    constructor() {
        this.scheduleService = new ScheduleService();
        this.settingsService = new SettingsService();
        this.rules = null;
        this.laborLawSettings = null;
        this.shifts = null;
        this.groups = null;
        this.staff = null;
    }

    /**
     * 初始化檢查器
     */
    async init() {
        try {
            // 載入規則和設定
            this.rules = await this.settingsService.getRules();
            this.laborLawSettings = await this.settingsService.getLaborLawSettings();
            this.shifts = await this.settingsService.getShifts();
            this.groups = await this.settingsService.getGroups();
            this.staff = await this.settingsService.getStaff();

        } catch (error) {
            console.error('初始化規則檢查器失敗:', error);
            throw error;
        }
    }

    /**
     * 全面檢查排班表
     */
    async checkSchedule(month, scheduleData) {
        const violations = {
            errors: [],      // 嚴重錯誤（禁止公告）
            warnings: [],    // 警告（建議修正）
            info: []         // 資訊（僅提示）
        };

        try {
            // 1. 檢查人數需求
            const staffingViolations = await this.checkStaffingRequirements(month, scheduleData);
            violations.errors.push(...staffingViolations.errors);
            violations.warnings.push(...staffingViolations.warnings);

            // 2. 檢查組別配置
            const groupViolations = await this.checkGroupBalance(scheduleData);
            violations.warnings.push(...groupViolations);

            // 3. 檢查包班規則
            const packageViolations = await this.checkPackageRules(month, scheduleData);
            violations.warnings.push(...packageViolations);

            // 4. 檢查接班順序
            const orderViolations = await this.checkShiftOrder(scheduleData);
            violations.warnings.push(...orderViolations);

            // 5. 檢查勞基法規範
            if (this.laborLawSettings?.enableLaborLawCheck) {
                const laborViolations = await this.checkLaborLaw(month, scheduleData);
                violations.errors.push(...laborViolations.errors);
                violations.warnings.push(...laborViolations.warnings);
            }

            // 6. 檢查連續工作天數
            const consecutiveViolations = await this.checkConsecutiveDays(scheduleData);
            violations.warnings.push(...consecutiveViolations);

            // 7. 檢查預班符合度
            const preScheduleViolations = await this.checkPreScheduleCompliance(month, scheduleData);
            violations.info.push(...preScheduleViolations);

        } catch (error) {
            console.error('檢查排班表錯誤:', error);
            violations.errors.push({
                type: 'SYSTEM_ERROR',
                message: '系統錯誤：' + error.message
            });
        }

        return violations;
    }

    /**
     * 檢查人數需求
     */
    async checkStaffingRequirements(month, scheduleData) {
        const violations = { errors: [], warnings: [] };

        try {
            const requirements = await this.settingsService.getRequirements();
            const daysInMonth = this.scheduleService.getDaysInMonth(month);

            for (let day = 1; day <= daysInMonth; day++) {
                const dateStr = month + day.toString().padStart(2, '0');
                const dayOfWeek = this.scheduleService.getDayOfWeek(dateStr);
                
                // 取得該日各班別人數需求
                const dayRequirements = requirements[dayOfWeek] || {};

                // 統計實際排班人數
                const actualCounts = {};
                this.staff.forEach(staff => {
                    const shift = scheduleData[staff.staffId]?.[dateStr];
                    if (shift && shift !== 'FF') {
                        actualCounts[shift] = (actualCounts[shift] || 0) + 1;
                    }
                });

                // 檢查每個班別
                Object.keys(dayRequirements).forEach(shiftCode => {
                    const required = dayRequirements[shiftCode];
                    const actual = actualCounts[shiftCode] || 0;

                    if (actual < required) {
                        violations.errors.push({
                            type: 'STAFFING_SHORTAGE',
                            date: dateStr,
                            shift: shiftCode,
                            message: `${this.formatDate(dateStr)} ${shiftCode}班人數不足：需要${required}人，實際${actual}人`,
                            required: required,
                            actual: actual
                        });
                    } else if (actual > required + 2) {
                        violations.warnings.push({
                            type: 'STAFFING_EXCESS',
                            date: dateStr,
                            shift: shiftCode,
                            message: `${this.formatDate(dateStr)} ${shiftCode}班人數過多：需要${required}人，實際${actual}人`,
                            required: required,
                            actual: actual
                        });
                    }
                });
            }

        } catch (error) {
            console.error('檢查人數需求錯誤:', error);
        }

        return violations;
    }

    /**
     * 檢查組別配置平衡
     */
    async checkGroupBalance(scheduleData) {
        const violations = [];

        try {
            const daysInMonth = Object.keys(scheduleData[this.staff[0].staffId] || {}).length;

            Object.keys(scheduleData).forEach(staffId => {
                const staffSchedule = scheduleData[staffId];
                
                Object.keys(staffSchedule).forEach(date => {
                    const shift = staffSchedule[date];
                    if (shift && shift !== 'FF') {
                        // 統計該日該班別的組別分布
                        const groupCounts = {};
                        this.staff.forEach(s => {
                            if (scheduleData[s.staffId]?.[date] === shift) {
                                const group = s.group || '未分組';
                                groupCounts[group] = (groupCounts[group] || 0) + 1;
                            }
                        });

                        // 檢查組別配置
                        this.groups.forEach(group => {
                            const count = groupCounts[group.name] || 0;
                            if (count < group.minPerShift) {
                                violations.push({
                                    type: 'GROUP_SHORTAGE',
                                    date: date,
                                    shift: shift,
                                    group: group.name,
                                    message: `${this.formatDate(date)} ${shift}班 ${group.name} 人數不足：需至少${group.minPerShift}人，實際${count}人`
                                });
                            } else if (count > group.maxPerShift) {
                                violations.push({
                                    type: 'GROUP_EXCESS',
                                    date: date,
                                    shift: shift,
                                    group: group.name,
                                    message: `${this.formatDate(date)} ${shift}班 ${group.name} 人數過多：最多${group.maxPerShift}人，實際${count}人`
                                });
                            }
                        });
                    }
                });
            });

        } catch (error) {
            console.error('檢查組別配置錯誤:', error);
        }

        return violations;
    }

    /**
     * 檢查包班規則
     */
    async checkPackageRules(month, scheduleData) {
        const violations = [];

        try {
            if (!this.rules?.包班規則?.啟用包班規則) {
                return violations;
            }

            const minDays = this.rules.包班規則.包班最少天數 || 16;

            // 檢查包班人員
            const packageStaff = this.staff.filter(s => s.isPackage);

            packageStaff.forEach(staff => {
                const schedule = scheduleData[staff.staffId] || {};
                const packageShift = staff.packageType; // '大' 或 '小'
                
                // 統計該班別天數
                let packageDays = 0;
                Object.values(schedule).forEach(shift => {
                    if (shift === packageShift) {
                        packageDays++;
                    }
                });

                if (packageDays < minDays) {
                    violations.push({
                        type: 'PACKAGE_SHORTAGE',
                        staffId: staff.staffId,
                        staffName: staff.name,
                        shift: packageShift,
                        message: `${staff.name} 包${packageShift}班天數不足：需至少${minDays}天，實際${packageDays}天`,
                        required: minDays,
                        actual: packageDays
                    });
                }
            });

        } catch (error) {
            console.error('檢查包班規則錯誤:', error);
        }

        return violations;
    }

    /**
     * 檢查接班順序
     */
    async checkShiftOrder(scheduleData) {
        const violations = [];

        try {
            if (!this.rules?.接班規則?.啟用接班順序規則) {
                return violations;
            }

            const enableFFRule = this.rules.特殊規則?.啟用FF後不接大夜 || false;

            Object.keys(scheduleData).forEach(staffId => {
                const staff = this.staff.find(s => s.staffId === staffId);
                const schedule = scheduleData[staffId];
                const dates = Object.keys(schedule).sort();

                for (let i = 1; i < dates.length; i++) {
                    const prevShift = schedule[dates[i - 1]];
                    const currentShift = schedule[dates[i]];

                    if (!prevShift || !currentShift) continue;

                    // FF 後不接大夜規則（包班者除外）
                    if (enableFFRule && prevShift === 'FF' && currentShift === '大' && !staff?.isPackage) {
                        violations.push({
                            type: 'SHIFT_ORDER_FF_TO_NIGHT',
                            staffId: staffId,
                            staffName: staff?.name || staffId,
                            date: dates[i],
                            message: `${staff?.name || staffId} ${this.formatDate(dates[i])} 違反「FF後不接大夜」規則`
                        });
                    }

                    // 一般接班順序檢查
                    if (!this.scheduleService.isValidShiftOrder(prevShift, currentShift)) {
                        violations.push({
                            type: 'SHIFT_ORDER_VIOLATION',
                            staffId: staffId,
                            staffName: staff?.name || staffId,
                            date: dates[i],
                            prevShift: prevShift,
                            currentShift: currentShift,
                            message: `${staff?.name || staffId} ${this.formatDate(dates[i])} 接班順序不正確：${prevShift} → ${currentShift}`
                        });
                    }
                }
            });

        } catch (error) {
            console.error('檢查接班順序錯誤:', error);
        }

        return violations;
    }

    /**
     * 檢查勞基法規範
     */
    async checkLaborLaw(month, scheduleData) {
        const violations = { errors: [], warnings: [] };

        try {
            const flexType = this.laborLawSettings.flexTimeType;

            Object.keys(scheduleData).forEach(staffId => {
                const staff = this.staff.find(s => s.staffId === staffId);
                const schedule = scheduleData[staffId];
                const dates = Object.keys(schedule).sort();

                // 根據變形工時類型檢查
                if (flexType === '四週') {
                    const fourWeekViolations = this.checkFourWeekFlex(staffId, staff?.name, schedule, dates);
                    violations.errors.push(...fourWeekViolations.errors);
                    violations.warnings.push(...fourWeekViolations.warnings);
                } else if (flexType === '兩週') {
                    const twoWeekViolations = this.checkTwoWeekFlex(staffId, staff?.name, schedule, dates);
                    violations.errors.push(...twoWeekViolations.errors);
                    violations.warnings.push(...twoWeekViolations.warnings);
                } else if (flexType === '無') {
                    const generalViolations = this.checkGeneralStandard(staffId, staff?.name, schedule, dates);
                    violations.errors.push(...generalViolations.errors);
                    violations.warnings.push(...generalViolations.warnings);
                }
            });

        } catch (error) {
            console.error('檢查勞基法錯誤:', error);
        }

        return violations;
    }

    /**
     * 檢查四週變形工時
     */
    checkFourWeekFlex(staffId, staffName, schedule, dates) {
        const violations = { errors: [], warnings: [] };
        const settings = this.laborLawSettings.fourWeekFlex;

        // 檢查每日工時
        dates.forEach(date => {
            const shift = schedule[date];
            const hours = this.scheduleService.calculateShiftHours(shift);
            
            if (hours > settings.dailyHoursMax) {
                violations.errors.push({
                    type: 'LABOR_LAW_DAILY_HOURS',
                    staffId: staffId,
                    staffName: staffName,
                    date: date,
                    message: `${staffName} ${this.formatDate(date)} 每日工時超過上限：${hours}小時 > ${settings.dailyHoursMax}小時`
                });
            }
        });

        // 檢查每週工時
        for (let i = 0; i < dates.length; i += 7) {
            const weekDates = dates.slice(i, Math.min(i + 7, dates.length));
            let weekHours = 0;
            
            weekDates.forEach(date => {
                weekHours += this.scheduleService.calculateShiftHours(schedule[date]);
            });

            if (weekHours > settings.weeklyHoursMax) {
                violations.errors.push({
                    type: 'LABOR_LAW_WEEKLY_HOURS',
                    staffId: staffId,
                    staffName: staffName,
                    startDate: weekDates[0],
                    endDate: weekDates[weekDates.length - 1],
                    message: `${staffName} ${this.formatDate(weekDates[0])}~${this.formatDate(weekDates[weekDates.length - 1])} 週工時超過上限：${weekHours}小時 > ${settings.weeklyHoursMax}小時`
                });
            }
        }

        // 檢查四週工時
        if (dates.length >= 28) {
            for (let i = 0; i <= dates.length - 28; i += 28) {
                const fourWeekDates = dates.slice(i, i + 28);
                let fourWeekHours = 0;
                
                fourWeekDates.forEach(date => {
                    fourWeekHours += this.scheduleService.calculateShiftHours(schedule[date]);
                });

                if (fourWeekHours > settings.fourWeekHoursMax) {
                    violations.errors.push({
                        type: 'LABOR_LAW_FOUR_WEEK_HOURS',
                        staffId: staffId,
                        staffName: staffName,
                        startDate: fourWeekDates[0],
                        endDate: fourWeekDates[27],
                        message: `${staffName} ${this.formatDate(fourWeekDates[0])}~${this.formatDate(fourWeekDates[27])} 四週工時超過上限：${fourWeekHours}小時 > ${settings.fourWeekHoursMax}小時`
                    });
                }
            }
        }

        // 檢查每七日休息
        for (let i = 0; i < dates.length; i += 7) {
            const sevenDays = dates.slice(i, Math.min(i + 7, dates.length));
            const restDays = sevenDays.filter(date => schedule[date] === 'FF').length;
            
            if (restDays < settings.restPerSevenDays) {
                violations.errors.push({
                    type: 'LABOR_LAW_REST_DAYS',
                    staffId: staffId,
                    staffName: staffName,
                    startDate: sevenDays[0],
                    message: `${staffName} ${this.formatDate(sevenDays[0])}起七日內休息天數不足：${restDays}天 < ${settings.restPerSevenDays}天`
                });
            }
        }

        return violations;
    }

    /**
     * 檢查兩週變形工時
     */
    checkTwoWeekFlex(staffId, staffName, schedule, dates) {
        const violations = { errors: [], warnings: [] };
        const settings = this.laborLawSettings.twoWeekFlex;

        // 類似四週變形，但檢查兩週工時
        // 實作邏輯類似，這裡簡化

        return violations;
    }

    /**
     * 檢查一般規定
     */
    checkGeneralStandard(staffId, staffName, schedule, dates) {
        const violations = { errors: [], warnings: [] };
        const settings = this.laborLawSettings.generalStandard;

        // 檢查每日8小時、每週40小時等
        // 實作邏輯類似四週變形

        return violations;
    }

    /**
     * 檢查連續工作天數
     */
    async checkConsecutiveDays(scheduleData) {
        const violations = [];

        try {
            if (!this.laborLawSettings?.consecutiveWorkDays?.enabled) {
                return violations;
            }

            const maxDays = this.laborLawSettings.consecutiveWorkDays.maxDays || 6;

            Object.keys(scheduleData).forEach(staffId => {
                const staff = this.staff.find(s => s.staffId === staffId);
                const schedule = scheduleData[staffId];
                const dates = Object.keys(schedule).sort();

                let consecutiveDays = 0;
                let startDate = null;

                dates.forEach(date => {
                    const shift = schedule[date];
                    
                    if (shift && shift !== 'FF') {
                        if (consecutiveDays === 0) {
                            startDate = date;
                        }
                        consecutiveDays++;

                        if (consecutiveDays > maxDays) {
                            violations.push({
                                type: 'CONSECUTIVE_DAYS_VIOLATION',
                                staffId: staffId,
                                staffName: staff?.name || staffId,
                                startDate: startDate,
                                days: consecutiveDays,
                                message: `${staff?.name || staffId} 從 ${this.formatDate(startDate)} 起連續工作 ${consecutiveDays} 天，超過上限 ${maxDays} 天`
                            });
                        }
                    } else {
                        consecutiveDays = 0;
                        startDate = null;
                    }
                });
            });

        } catch (error) {
            console.error('檢查連續工作天數錯誤:', error);
        }

        return violations;
    }

    /**
     * 檢查預班符合度
     */
    async checkPreScheduleCompliance(month, scheduleData) {
        const violations = [];

        try {
            // 這裡需要從預班表取得資料進行比對
            // 簡化實作，實際需要呼叫 PreScheduleService

        } catch (error) {
            console.error('檢查預班符合度錯誤:', error);
        }

        return violations;
    }

    /**
     * 格式化日期
     */
    formatDate(dateStr) {
        return this.scheduleService.formatDate(dateStr);
    }

    /**
     * 顯示檢查結果
     */
    displayCheckResults(violations) {
        const errorCount = violations.errors.length;
        const warningCount = violations.warnings.length;
        const infoCount = violations.info.length;

        if (errorCount === 0 && warningCount === 0) {
            showNotification('✅ 排班檢查通過，無違規項目', 'success');
            return true;
        }

        let message = `檢查完成：\n`;
        if (errorCount > 0) {
            message += `❌ 嚴重錯誤：${errorCount} 項\n`;
        }
        if (warningCount > 0) {
            message += `⚠️ 警告：${warningCount} 項\n`;
        }
        if (infoCount > 0) {
            message += `ℹ️ 資訊：${infoCount} 項`;
        }

        showNotification(message, errorCount > 0 ? 'error' : 'warning');

        return errorCount === 0;
    }
}

// 匯出
export { ScheduleCheck };
