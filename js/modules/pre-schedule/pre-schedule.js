/**
 * js/modules/pre-schedule/pre-schedule.js
 * 預班管理主模組 (ES Module 版 - 完整實作)
 * 整合預班相關功能：初始化、權限檢查、提交、狀態管理、衝突檢查等
 */

import { Auth } from '../../core/auth.js';
import { Router } from '../../core/router.js';
import { Utils } from '../../core/utils.js';
import { CONSTANTS } from '../../config/constants.js';
import { Notification } from '../../components/notification.js';
import { Loading } from '../../components/loading.js';
import { Modal } from '../../components/modal.js';
import { PreScheduleService } from '../../services/pre-schedule.service.js';
import { PreScheduleView } from './pre-schedule-view.js';

export const PreSchedule = {
    initialized: false,
    
    // ==================== 初始化 ====================
    
    /**
     * 初始化預班模組
     */
    async init() {
        if (this.initialized) {
            console.warn('[PreSchedule] 已初始化');
            return;
        }
        
        console.log('[PreSchedule] 初始化預班模組...');
        
        try {
            // 檢查權限
            if (!this.checkPermission()) {
                Notification.error('您沒有權限存取預班功能');
                Router.navigate('/dashboard');
                return;
            }
            
            // 初始化視圖
            await PreScheduleView.init();
            
            this.initialized = true;
            console.log('[PreSchedule] ✅ 預班模組初始化完成');
            
        } catch (error) {
            console.error('[PreSchedule] ❌ 初始化失敗:', error);
            Notification.error('初始化失敗: ' + error.message);
        }
    },
    
    /**
     * 檢查權限
     * @returns {boolean}
     */
    checkPermission() {
        // 所有已登入角色都可以存取預班頁面
        // (具體能做什麼操作會在各個功能內部再檢查)
        return Auth.isAuthenticated();
    },
    
    // ==================== 預班提交 (一般使用者) ====================
    
    /**
     * 提交預班
     * @param {Object} scheduleData - 預班資料 { month, data: { date: { shift, ... } } }
     */
    async submitPreSchedule(scheduleData) {
        try {
            Loading.show('提交中...');
            
            const user = Auth.getCurrentUser();
            const unit = Auth.getUserUnit();
            if (!unit) throw new Error('無法取得單位資訊');
            
            // 這裡可以加入前端驗證邏輯
            // 簡化：直接呼叫 Service
            
            await PreScheduleService.submitPreSchedule({
                unitId: unit.id,
                month: scheduleData.month,
                staffId: user.uid,
                data: scheduleData.data
            });
            
            Loading.hide();
            Notification.success('預班提交成功');
            
            // 重新載入視圖以顯示最新狀態
            await PreScheduleView.init({ month: scheduleData.month });
            
            return true;
            
        } catch (error) {
            Loading.hide();
            Notification.error('提交失敗: ' + error.message);
            return false;
        }
    },
    
    /**
     * 顯示警告訊息 (供 submitPreSchedule 內部呼叫)
     * @param {Array} warnings - 警告陣列
     * @returns {Promise<boolean>}
     */
    async showWarnings(warnings) {
        return new Promise((resolve) => {
            Modal.show({
                title: '預班警告',
                content: `
                    <div class="alert alert-warning">
                        <div class="alert-icon">⚠️</div>
                        <div class="alert-content">
                            <div class="alert-title">以下項目需要注意:</div>
                            <ul style="margin-top: 8px; padding-left: 20px;">
                                ${warnings.map(w => `<li>${w}</li>`).join('')}
                            </ul>
                            <p style="margin-top: 12px;">是否仍要繼續提交?</p>
                        </div>
                    </div>
                `,
                buttons: [
                    { text: '取消', onClick: () => resolve(false) },
                    { text: '繼續提交', className: 'btn-warning', onClick: () => resolve(true) }
                ]
            });
        });
    },
    
    // ==================== 額外預班 (排班者) ====================
    
    /**
     * 新增額外預班
     * @param {string} staffId - 員工 ID
     * @param {string} date - 日期
     * @param {string} shift - 班別
     */
    async addExtraPreSchedule(staffId, date, shift) {
        try {
            const userRole = Auth.getUserRole();
            if (userRole !== CONSTANTS.ROLES?.SCHEDULER && userRole !== CONSTANTS.ROLES?.ADMIN) {
                Notification.error('只有排班者可以新增額外預班');
                return false;
            }
            
            Loading.show('新增中...');
            
            const unit = Auth.getUserUnit();
            const month = Utils.getMonthString(new Date(date));
            
            // 呼叫 Service 新增
            await PreScheduleService.addExtraPreSchedule({
                unitId: unit.id,
                month: month,
                staffId: staffId,
                date: date,
                shift: shift,
                addedBy: Auth.getCurrentUser().displayName
            });
            
            Loading.hide();
            Notification.success('額外預班新增成功');
            
            // 重新載入視圖
            await PreScheduleView.init({ month });
            
            return true;
            
        } catch (error) {
            Loading.hide();
            Notification.error('新增失敗: ' + error.message);
            return false;
        }
    },
    
    /**
     * 移除額外預班
     * @param {string} staffId - 員工 ID
     * @param {string} date - 日期
     */
    async removeExtraPreSchedule(staffId, date) {
        try {
            Loading.show('移除中...');
            
            const unit = Auth.getUserUnit();
            const month = Utils.getMonthString(new Date(date));
            
            await PreScheduleService.removeExtraPreSchedule(unit.id, month, staffId, date);
            
            Loading.hide();
            Notification.success('額外預班已移除');
            
            // 重新載入視圖
            await PreScheduleView.init({ month });
            
            return true;
            
        } catch (error) {
            Loading.hide();
            Notification.error('移除失敗: ' + error.message);
            return false;
        }
    },
    
    // ==================== 預班狀態管理 (排班者) ====================
    
    /**
     * 開放預班
     * @param {string} closeDate - 截止日期 (YYYY-MM-DD)
     */
    async openPreSchedule(closeDate) {
        try {
            const userRole = Auth.getUserRole();
            if (userRole !== CONSTANTS.ROLES?.SCHEDULER && userRole !== CONSTANTS.ROLES?.ADMIN) {
                Notification.error('只有排班者可以管理預班狀態');
                return false;
            }
            
            Loading.show('設定中...');
            
            const unit = Auth.getUserUnit();
            const month = Utils.getMonthString(new Date()); // 預設當前月份，或需傳入參數
            
            await PreScheduleService.openPreSchedule(unit.id, month, closeDate);
            
            Loading.hide();
            Notification.success('預班已開放');
            
            await PreScheduleView.init({ month });
            
            return true;
            
        } catch (error) {
            Loading.hide();
            Notification.error('設定失敗: ' + error.message);
            return false;
        }
    },
    
    /**
     * 關閉預班
     */
    async closePreSchedule() {
        try {
            const confirmed = await this.confirmAction(
                '確定要關閉預班嗎?',
                '關閉後，一般使用者將無法編輯預班內容'
            );
            
            if (!confirmed) return false;
            
            Loading.show('關閉中...');
            
            const unit = Auth.getUserUnit();
            const month = Utils.getMonthString(new Date());
            
            await PreScheduleService.closePreSchedule(unit.id, month);
            
            Loading.hide();
            Notification.success('預班已關閉');
            
            await PreScheduleView.init({ month });
            
            return true;
            
        } catch (error) {
            Loading.hide();
            Notification.error('關閉失敗: ' + error.message);
            return false;
        }
    },
    
    /**
     * 鎖定預班
     */
    async lockPreSchedule() {
        try {
            const confirmed = await this.confirmAction(
                '確定要鎖定預班嗎?',
                '鎖定後將開始進行排班，除了排班者外其他人無法編輯'
            );
            
            if (!confirmed) return false;
            
            Loading.show('鎖定中...');
            
            const unit = Auth.getUserUnit();
            const month = Utils.getMonthString(new Date());
            
            await PreScheduleService.lockPreSchedule(unit.id, month);
            
            Loading.hide();
            Notification.success('預班已鎖定，可以開始排班了');
            
            await PreScheduleView.init({ month });
            
            return true;
            
        } catch (error) {
            Loading.hide();
            Notification.error('鎖定失敗: ' + error.message);
            return false;
        }
    },
    
    /**
     * 確認操作通用方法
     */
    async confirmAction(title, message) {
        return new Promise((resolve) => {
            Modal.show({
                title: title,
                content: `<p>${message}</p>`,
                buttons: [
                    { text: '取消', onClick: () => resolve(false) },
                    { text: '確定', className: 'btn-primary', onClick: () => resolve(true) }
                ]
            });
        });
    },
    
    // ==================== 預班衝突處理 ====================
    
    /**
     * 檢查預班衝突
     */
    async checkConflicts() {
        try {
            Loading.show('檢查中...');
            
            const unit = Auth.getUserUnit();
            const month = Utils.getMonthString(new Date());
            
            const conflicts = await PreScheduleService.checkPreScheduleConflicts(
                unit.id,
                month
            );
            
            Loading.hide();
            
            if (!conflicts || conflicts.length === 0) {
                Notification.success('沒有發現衝突');
                return [];
            }
            
            this.showConflicts(conflicts);
            return conflicts;
            
        } catch (error) {
            Loading.hide();
            Notification.error('檢查失敗: ' + error.message);
            return [];
        }
    },
    
    /**
     * 顯示衝突
     */
    showConflicts(conflicts) {
        const conflictHtml = conflicts.map(c => `
            <div class="conflict-item" style="margin-bottom: 8px; padding: 8px; background: #fee2e2; border-radius: 4px;">
                <strong>${c.date}</strong>: ${c.description}
            </div>
        `).join('');
        
        Modal.show({
            title: `發現 ${conflicts.length} 個衝突`,
            content: `
                <div class="alert alert-error">
                    <div class="alert-content">
                        <div class="alert-title" style="margin-bottom: 10px;">預班衝突列表</div>
                        <div class="conflicts-list">
                            ${conflictHtml}
                        </div>
                    </div>
                </div>
            `,
            buttons: [{ text: '知道了', className: 'btn-primary', onClick: () => Modal.close() }]
        });
    },
    
    // ==================== 預班統計 ====================
    
    /**
     * 顯示預班統計
     */
    async showStatistics() {
        try {
            Loading.show('計算中...');
            
            const unit = Auth.getUserUnit();
            const month = Utils.getMonthString(new Date());
            
            const stats = await PreScheduleService.getPreScheduleStatistics(month);
            
            Loading.hide();
            this.showStatsModal(stats);
            
        } catch (error) {
            Loading.hide();
            Notification.error('計算失敗: ' + error.message);
        }
    },
    
    /**
     * 顯示統計 Modal
     */
    showStatsModal(stats) {
        Modal.show({
            title: '預班統計',
            content: `
                <div class="stats-modal-content">
                    <div class="stat-row" style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                        <span class="stat-label">總員工數:</span>
                        <span class="stat-value">${stats.totalStaff || 0}</span>
                    </div>
                    <div class="stat-row" style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                        <span class="stat-label">已提交:</span>
                        <span class="stat-value">${stats.submittedStaff || 0}</span>
                    </div>
                    <div class="stat-row" style="display: flex; justify-content: space-between;">
                        <span class="stat-label">完成率:</span>
                        <span class="stat-value">${stats.completionRate || 0}%</span>
                    </div>
                </div>
            `,
            buttons: [{ text: '關閉', className: 'btn-secondary', onClick: () => Modal.close() }]
        });
    },
    
    // ==================== 匯出功能 ====================
    
    /**
     * 匯出預班表
     * @param {string} format - 格式 (csv/excel/pdf)
     */
    async export(format = 'csv') {
        try {
            Loading.show('匯出中...');
            
            const unit = Auth.getUserUnit();
            const month = Utils.getMonthString(new Date());
            
            const blob = await PreScheduleService.exportPreSchedule(
                unit.id,
                month,
                format
            );
            
            const filename = `預班表_${month}.${format}`;
            Utils.downloadFile(blob, filename, 'text/csv');
            
            Loading.hide();
            Notification.success('匯出成功');
            
        } catch (error) {
            Loading.hide();
            Notification.error('匯出失敗: ' + error.message);
        }
    }
};