/**
 * AI 排班引擎主檔
 * 協調各個排班演算法和規則檢查
 */

import { BasicAlgorithm } from './basic-algorithm.js';
import { ScheduleService } from '../../services/schedule.service.js';
import { SettingsService } from '../../services/settings.service.js';
import { PreScheduleService } from '../../services/pre-schedule.service.js';
import { ScheduleCheck } from '../schedule/schedule-check.js';
import { showNotification, showLoading, hideLoading } from '../../components/notification.js';

class AIEngine {
    constructor() {
        this.scheduleService = new ScheduleService();
        this.settingsService = new SettingsService();
        this.preScheduleService = new PreScheduleService();
        this.scheduleCheck = new ScheduleCheck();
        this.basicAlgorithm = new BasicAlgorithm();
        
        // AI 排班狀態
        this.isRunning = false;
        this.currentMonth = null;
        this.result = null;
    }

    /**
     * 初始化 AI 引擎
     */
    async init(month) {
        try {
            this.currentMonth = month;
            
            // 初始化檢查器
            await this.scheduleCheck.init();
            
            // 初始化基本演算法
            await this.basicAlgorithm.init(month);

        } catch (error) {
            console.error('初始化 AI 引擎失敗:', error);
            throw error;
        }
    }

    /**
     * 執行 AI 排班
     */
    async runScheduling(options = {}) {
        if (this.isRunning) {
            showNotification('AI 排班正在執行中，請稍候...', 'warning');
            return null;
        }

        try {
            this.isRunning = true;
            showLoading('AI 排班中，請稍候...');

            // 預設選項
            const defaultOptions = {
                strategy: 'balanced',      // 排班策略
                usePreSchedule: true,      // 是否使用預班
                checkRules: true,          // 是否檢查規則
                maxRetries: 3,             // 最大重試次數
                partialSchedule: null      // 部分已排班資料（手動+AI混合）
            };

            const config = { ...defaultOptions, ...options };

            // 1. 前置檢查
            const preCheck = await this.preCheckScheduling(config);
            if (!preCheck.success) {
                hideLoading();
                showNotification(preCheck.message, 'error');
                this.isRunning = false;
                return null;
            }

            // 2. 載入預班資料
            let preScheduleData = null;
            if (config.usePreSchedule) {
                preScheduleData = await this.loadPreScheduleData();
            }

            // 3. 執行排班演算法
            let scheduleResult = null;
            let retryCount = 0;

            while (retryCount < config.maxRetries) {
                try {
                    scheduleResult = await this.basicAlgorithm.schedule({
                        preSchedule: preScheduleData,
                        partialSchedule: config.partialSchedule,
                        strategy: config.strategy
                    });

                    if (scheduleResult.success) {
                        break;
                    }

                    retryCount++;
                    console.log(`排班失敗，重試第 ${retryCount} 次...`);

                } catch (error) {
                    console.error(`排班演算法錯誤 (第 ${retryCount + 1} 次):`, error);
                    retryCount++;
                }
            }

            if (!scheduleResult || !scheduleResult.success) {
                hideLoading();
                showNotification('AI 排班失敗，請手動調整或修改規則', 'error');
                this.isRunning = false;
                return null;
            }

            // 4. 規則檢查
            let violations = null;
            if (config.checkRules) {
                violations = await this.scheduleCheck.checkSchedule(
                    this.currentMonth,
                    scheduleResult.scheduleData
                );
            }

            // 5. 生成報告
            const report = this.generateReport(scheduleResult, violations);

            // 6. 儲存結果
            this.result = {
                scheduleData: scheduleResult.scheduleData,
                violations: violations,
                report: report,
                statistics: scheduleResult.statistics
            };

            hideLoading();

            // 顯示結果摘要
            this.displayResultSummary();

            this.isRunning = false;
            return this.result;

        } catch (error) {
            hideLoading();
            console.error('AI 排班錯誤:', error);
            showNotification('AI 排班發生錯誤：' + error.message, 'error');
            this.isRunning = false;
            return null;
        }
    }

    /**
     * 前置檢查
     */
    async preCheckScheduling(config) {
        try {
            // 檢查 1: 預班是否已確定
            if (config.usePreSchedule) {
                const preScheduleConfig = await this.preScheduleService.getPreScheduleConfig(this.currentMonth);
                
                if (!preScheduleConfig || preScheduleConfig.status === 'draft') {
                    return {
                        success: false,
                        message: '預班尚未開放，無法使用預班資料'
                    };
                }

                if (preScheduleConfig.status === 'open') {
                    const confirmed = confirm(
                        '預班尚未截止，建議等待預班截止後再進行 AI 排班。\n' +
                        '是否仍要繼續？'
                    );
                    if (!confirmed) {
                        return { success: false, message: '使用者取消' };
                    }
                }
            }

            // 檢查 2: 人員資料是否完整
            const staff = await this.settingsService.getStaff();
            if (!staff || staff.length === 0) {
                return {
                    success: false,
                    message: '尚未建立員工資料，請先到設定頁面新增員工'
                };
            }

            // 檢查 3: 班別定義是否完整
            const shifts = await this.settingsService.getShifts();
            if (!shifts || shifts.length === 0) {
                return {
                    success: false,
                    message: '尚未定義班別，請先到設定頁面新增班別'
                };
            }

            // 檢查 4: 規則設定是否完整
            const rules = await this.settingsService.getRules();
            if (!rules) {
                return {
                    success: false,
                    message: '尚未設定排班規則，請先到設定頁面完成設定'
                };
            }

            return { success: true };

        } catch (error) {
            console.error('前置檢查錯誤:', error);
            return {
                success: false,
                message: '前置檢查發生錯誤：' + error.message
            };
        }
    }

    /**
     * 載入預班資料
     */
    async loadPreScheduleData() {
        try {
            const staff = await this.settingsService.getStaff();
            const preScheduleData = {};

            for (const s of staff) {
                const staffPreSchedule = await this.preScheduleService.getStaffPreSchedule(
                    this.currentMonth,
                    s.staffId
                );

                if (staffPreSchedule && staffPreSchedule.dates) {
                    preScheduleData[s.staffId] = {};
                    staffPreSchedule.dates.forEach(item => {
                        preScheduleData[s.staffId][item.date] = item.shift;
                    });
                }
            }

            // 載入額外預班
            const extraPreSchedules = await this.preScheduleService.getExtraPreSchedules(this.currentMonth);
            if (extraPreSchedules && extraPreSchedules.length > 0) {
                extraPreSchedules.forEach(item => {
                    if (!preScheduleData[item.staffId]) {
                        preScheduleData[item.staffId] = {};
                    }
                    preScheduleData[item.staffId][item.date] = item.shift;
                });
            }

            return preScheduleData;

        } catch (error) {
            console.error('載入預班資料錯誤:', error);
            return {};
        }
    }

    /**
     * 生成報告
     */
    generateReport(scheduleResult, violations) {
        const report = {
            timestamp: new Date().toISOString(),
            month: this.currentMonth,
            summary: {
                totalStaff: scheduleResult.statistics?.totalStaff || 0,
                totalDays: scheduleResult.statistics?.totalDays || 0,
                scheduledCells: scheduleResult.statistics?.scheduledCells || 0,
                emptyCell: scheduleResult.statistics?.emptyCells || 0
            },
            violations: {
                errors: violations?.errors?.length || 0,
                warnings: violations?.warnings?.length || 0,
                info: violations?.info?.length || 0
            },
            compliance: {
                preScheduleMatch: scheduleResult.statistics?.preScheduleMatch || 0,
                ruleCompliance: violations?.errors?.length === 0 ? 100 : 0
            }
        };

        return report;
    }

    /**
     * 顯示結果摘要
     */
    displayResultSummary() {
        if (!this.result) return;

        const { report, violations } = this.result;
        const errorCount = violations?.errors?.length || 0;
        const warningCount = violations?.warnings?.length || 0;

        let message = `✅ AI 排班完成！\n\n`;
        message += `📊 排班統計：\n`;
        message += `  - 員工數：${report.summary.totalStaff}\n`;
        message += `  - 已排班：${report.summary.scheduledCells} 個\n`;
        message += `  - 未排班：${report.summary.emptyCell} 個\n\n`;

        if (errorCount > 0) {
            message += `❌ 嚴重錯誤：${errorCount} 項\n`;
        }
        if (warningCount > 0) {
            message += `⚠️ 警告：${warningCount} 項\n`;
        }
        
        if (errorCount === 0 && warningCount === 0) {
            message += `\n🎉 無違規項目，可以公告班表！`;
        } else {
            message += `\n請檢視詳細違規清單並進行調整。`;
        }

        showNotification(message, errorCount > 0 ? 'warning' : 'success');
    }

    /**
     * 取得排班結果
     */
    getResult() {
        return this.result;
    }

    /**
     * 清除結果
     */
    clearResult() {
        this.result = null;
    }

    /**
     * 停止排班
     */
    stop() {
        if (this.isRunning) {
            this.isRunning = false;
            hideLoading();
            showNotification('AI 排班已停止', 'info');
        }
    }
}

// 匯出
export { AIEngine };