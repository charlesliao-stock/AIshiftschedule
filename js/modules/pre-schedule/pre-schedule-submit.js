/**
 * js/modules/pre-schedule/pre-schedule-submit.js
 * 預班提交功能 (ES Module 版)
 */

import { PreScheduleService } from '../../services/pre-schedule.service.js';
import { Notification } from '../../components/notification.js';
import { Loading } from '../../components/loading.js';
import { Modal } from '../../components/modal.js';

export const PreScheduleSubmit = {
    currentMonth: null,
    currentUser: null,
    selectedDates: new Map(),
    monthlyLimit: 4,
    preScheduleCount: 0,

    async init(month, user) {
        this.currentMonth = month;
        this.currentUser = user;
        await this.loadConfig();
        await this.loadExistingPreSchedule();
        // UI 初始化通常由 View 負責呼叫，這裡僅準備數據與邏輯
    },

    async loadConfig() {
        const config = await PreScheduleService.getPreScheduleConfig(this.currentMonth);
        this.monthlyLimit = config?.monthlyLimit || 4;
    },

    async loadExistingPreSchedule() {
        try {
            // 注意：這裡假設 getPreSchedule 回傳的是整個單位的資料，需篩選出個人的
            // 實際應依據 Service 實作調整
            const data = await PreScheduleService.getPreSchedule(this.currentUser.uid, this.currentMonth); // 假設 Service 有此方法
            // 若無此方法，暫時略過，或使用 unit data 篩選
        } catch(e) {
            console.warn('載入個人預班失敗', e);
        }
    },
    
    // 提供給 View 呼叫的方法
    checkLimit(currentCount) {
        return currentCount < this.monthlyLimit;
    },

    async submit(data) {
        try {
            Loading.show('提交中...');
            await PreScheduleService.submitPreSchedule({
                month: this.currentMonth,
                staffId: this.currentUser.uid,
                data: data
            });
            Notification.success('提交成功');
            return true;
        } catch (error) {
            Notification.error('提交失敗: ' + error.message);
            return false;
        } finally {
            Loading.hide();
        }
    }
};
