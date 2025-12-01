/**
 * 預班管理主模組
 * 整合預班相關功能
 */

const PreSchedule = {
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
            Notification.error('初始化失敗', error.message);
        }
    },
    
    /**
     * 檢查權限
     * @returns {boolean}
     */
    checkPermission() {
        // 所有角色都可以存取預班
        return Auth.isAuthenticated();
    },
    
    // ==================== 預班提交 (一般使用者) ====================
    
    /**
     * 提交預班
     * @param {Object} scheduleData - 預班資料
     */
    async submitPreSchedule(scheduleData) {
        try {
            Loading.show('提交中...');
            
            const user = Auth.getCurrentUser();
            const unitId = Auth.getUserUnit().id;
            const month = Utils.getMonthString(new Date());
            
            // 驗證預班資料
            const validation = PreScheduleService.validatePreSchedule(
                scheduleData,
                CONSTANTS.DEFAULT_RULES,
                {}
            );
            
            if (!validation.valid) {
                Loading.hide();
                Notification.error('預班驗證失敗', validation.errors.join('<br>'));
                return false;
            }
            
            // 顯示警告
            if (validation.warnings.length > 0) {
                const confirmed = await this.showWarnings(validation.warnings);
                if (!confirmed) {
                    Loading.hide();
                    return false;
                }
            }
            
            // 儲存預班
            await PreScheduleService.savePreSchedule(
                unitId,
                month,
                user.id,
                scheduleData,
                false // 不是額外預班
            );
            
            Loading.hide();
            Notification.success('預班提交成功');
            
            // 重新載入視圖
            await PreScheduleView.loadData();
            PreScheduleView.render();
            
            return true;
            
        } catch (error) {
            Loading.hide();
            Notification.error('提交失敗', error.message);
            return false;
        }
    },
    
    /**
     * 顯示警告訊息
     * @param {Array} warnings - 警告陣列
     * @returns {Promise<boolean>}
     */
    async showWarnings(warnings) {
        return new Promise((resolve) => {
            Modal.open({
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
                onConfirm: () => resolve(true),
                onCancel: () => resolve(false),
                confirmText: '繼續提交',
                cancelText: '取消'
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
            if (userRole !== CONSTANTS.ROLES.SCHEDULER && userRole !== CONSTANTS.ROLES.ADMIN) {
                Notification.error('只有排班者可以新增額外預班');
                return false;
            }
            
            Loading.show('新增中...');
            
            const unitId = Auth.getUserUnit().id;
            const month = Utils.getMonthString(new Date(date));
            
            // 取得當前員工的預班資料
            const currentSchedule = await PreScheduleService.getStaffPreSchedule(
                unitId,
                month,
                staffId
            );
            
            // 新增額外預班
            currentSchedule[date] = {
                shift: shift,
                is_extra: true
            };
            
            // 儲存
            await PreScheduleService.savePreSchedule(
                unitId,
                month,
                staffId,
                currentSchedule,
                true // 額外預班
            );
            
            Loading.hide();
            Notification.success('額外預班新增成功');
            
            // 重新載入視圖
            await PreScheduleView.loadData();
            PreScheduleView.render();
            
            return true;
            
        } catch (error) {
            Loading.hide();
            Notification.error('新增失敗', error.message);
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
            
            const unitId = Auth.getUserUnit().id;
            const month = Utils.getMonthString(new Date(date));
            
            // 取得當前員工的預班資料
            const currentSchedule = await PreScheduleService.getStaffPreSchedule(
                unitId,
                month,
                staffId
            );
            
            // 檢查是否為額外預班
            if (!currentSchedule[date]?.is_extra) {
                Loading.hide();
                Notification.warning('這不是額外預班');
                return false;
            }
            
            // 移除
            delete currentSchedule[date];
            
            // 儲存
            await PreScheduleService.savePreSchedule(
                unitId,
                month,
                staffId,
                currentSchedule
            );
            
            Loading.hide();
            Notification.success('額外預班已移除');
            
            // 重新載入視圖
            await PreScheduleView.loadData();
            PreScheduleView.render();
            
            return true;
            
        } catch (error) {
            Loading.hide();
            Notification.error('移除失敗', error.message);
            return false;
        }
    },
    
    // ==================== 預班狀態管理 (排班者) ====================
    
    /**
     * 開放預班
     * @param {Date} closeDate - 截止日期
     */
    async openPreSchedule(closeDate) {
        try {
            const userRole = Auth.getUserRole();
            if (userRole !== CONSTANTS.ROLES.SCHEDULER && userRole !== CONSTANTS.ROLES.ADMIN) {
                Notification.error('只有排班者可以管理預班狀態');
                return false;
            }
            
            Loading.show('設定中...');
            
            const unitId = Auth.getUserUnit().id;
            const month = Utils.getMonthString(new Date());
            
            await PreScheduleService.openPreSchedule(unitId, month, closeDate);
            
            Loading.hide();
            Notification.success('預班已開放');
            
            // 重新載入視圖
            await PreScheduleView.loadData();
            PreScheduleView.render();
            
            // TODO: 發送通知給所有員工
            
            return true;
            
        } catch (error) {
            Loading.hide();
            Notification.error('設定失敗', error.message);
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
            
            const unitId = Auth.getUserUnit().id;
            const month = Utils.getMonthString(new Date());
            
            await PreScheduleService.closePreSchedule(unitId, month);
            
            Loading.hide();
            Notification.success('預班已關閉');
            
            // 重新載入視圖
            await PreScheduleView.loadData();
            PreScheduleView.render();
            
            return true;
            
        } catch (error) {
            Loading.hide();
            Notification.error('關閉失敗', error.message);
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
            
            const unitId = Auth.getUserUnit().id;
            const month = Utils.getMonthString(new Date());
            
            await PreScheduleService.lockPreSchedule(unitId, month);
            
            Loading.hide();
            Notification.success('預班已鎖定，可以開始排班了');
            
            // 重新載入視圖
            await PreScheduleView.loadData();
            PreScheduleView.render();
            
            return true;
            
        } catch (error) {
            Loading.hide();
            Notification.error('鎖定失敗', error.message);
            return false;
        }
    },
    
    /**
     * 確認操作
     * @param {string} title - 標題
     * @param {string} message - 訊息
     * @returns {Promise<boolean>}
     */
    async confirmAction(title, message) {
        return new Promise((resolve) => {
            Modal.open({
                title: title,
                content: `<p>${message}</p>`,
                onConfirm: () => resolve(true),
                onCancel: () => resolve(false),
                confirmText: '確定',
                cancelText: '取消'
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
            
            const unitId = Auth.getUserUnit().id;
            const month = Utils.getMonthString(new Date());
            
            const conflicts = await PreScheduleService.checkPreScheduleConflicts(
                unitId,
                month
            );
            
            Loading.hide();
            
            if (conflicts.length === 0) {
                Notification.success('沒有發現衝突');
                return [];
            }
            
            // 顯示衝突
            this.showConflicts(conflicts);
            
            return conflicts;
            
        } catch (error) {
            Loading.hide();
            Notification.error('檢查失敗', error.message);
            return [];
        }
    },
    
    /**
     * 顯示衝突
     * @param {Array} conflicts - 衝突陣列
     */
    showConflicts(conflicts) {
        const conflictHtml = conflicts.map(c => `
            <div class="conflict-item">
                <strong>${c.date}</strong>: ${c.description}
            </div>
        `).join('');
        
        Modal.open({
            title: `發現 ${conflicts.length} 個衝突`,
            content: `
                <div class="alert alert-error">
                    <div class="alert-icon">⚠️</div>
                    <div class="alert-content">
                        <div class="alert-title">預班衝突</div>
                        <div class="conflicts-list">
                            ${conflictHtml}
                        </div>
                    </div>
                </div>
            `,
            showCancel: false,
            confirmText: '知道了'
        });
    },
    
    // ==================== 預班統計 ====================
    
    /**
     * 顯示預班統計
     */
    async showStatistics() {
        try {
            Loading.show('計算中...');
            
            const unitId = Auth.getUserUnit().id;
            const month = Utils.getMonthString(new Date());
            
            const stats = await PreScheduleService.getPreScheduleStats(unitId, month);
            
            Loading.hide();
            
            // 顯示統計資訊
            this.showStatsModal(stats);
            
        } catch (error) {
            Loading.hide();
            Notification.error('計算失敗', error.message);
        }
    },
    
    /**
     * 顯示統計 Modal
     * @param {Object} stats - 統計資料
     */
    showStatsModal(stats) {
        Modal.open({
            title: '預班統計',
            content: `
                <div class="stats-modal-content">
                    <div class="stat-row">
                        <span class="stat-label">總預班天數:</span>
                        <span class="stat-value">${stats.total_days}</span>
                    </div>
                    <div class="stat-row">
                        <span class="stat-label">休假天數:</span>
                        <span class="stat-value">${stats.off_count}</span>
                    </div>
                    <div class="stat-row">
                        <span class="stat-label">完成率:</span>
                        <span class="stat-value">${stats.completion_rate}%</span>
                    </div>
                </div>
            `,
            showCancel: false,
            confirmText: '關閉'
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
            
            const unitId = Auth.getUserUnit().id;
            const month = Utils.getMonthString(new Date());
            
            const blob = await PreScheduleService.exportPreSchedule(
                unitId,
                month,
                format
            );
            
            const filename = `預班表_${month}.${format}`;
            Utils.downloadFile(blob, filename);
            
            Loading.hide();
            Notification.success('匯出成功');
            
        } catch (error) {
            Loading.hide();
            Notification.error('匯出失敗', error.message);
        }
    }
};

// 讓預班模組可在全域使用
if (typeof window !== 'undefined') {
    window.PreSchedule = PreSchedule;
}