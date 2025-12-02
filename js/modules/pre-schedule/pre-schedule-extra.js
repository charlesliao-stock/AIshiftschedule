/**
 * js/modules/pre-schedule/pre-schedule-extra.js
 * 額外預班功能 (ES Module 版)
 */

import { PreScheduleService } from '../../services/pre-schedule.service.js';
import { Notification } from '../../components/notification.js';
import { Loading } from '../../components/loading.js';
import { Modal } from '../../components/modal.js';
import { Auth } from '../../core/auth.js';

export const PreScheduleExtra = {
    currentMonth: null,
    currentUnit: null,

    async init(month, unitId) {
        this.currentMonth = month;
        this.currentUnit = unitId;
    },

    async addExtra(staffId, date, shift, reason) {
        try {
            Loading.show('新增中...');
            await PreScheduleService.addExtraPreSchedule({
                unitId: this.currentUnit,
                month: this.currentMonth,
                staffId, 
                date, 
                shift, 
                reason,
                addedBy: Auth.getCurrentUser().displayName
            });
            Notification.success('新增成功');
            return true;
        } catch(e) {
            Notification.error('新增失敗: ' + e.message);
            return false;
        } finally {
            Loading.hide();
        }
    }
};
