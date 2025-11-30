/**
 * 排班規則管理模組
 */

const RuleManagement = {
    unitId: null,
    rules: null,
    
    async init(unitId) {
        console.log('[RuleManagement] 初始化規則管理');
        this.unitId = unitId;
        this.render();
        await this.loadRules();
    },
    
    render() {
        const content = document.getElementById('settings-content');
        
        content.innerHTML = `
            <div class="card-header">
                <h3 class="card-title">排班規則設定</h3>
            </div>
            <div class="card-body">
                <div id="rules-form-container">
                    <div style="padding: 60px; text-align: center; color: #999;">
                        <div class="loader-spinner" style="margin: 0 auto 16px;"></div>
                        <p>載入中...</p>
                    </div>
                </div>
            </div>
            <div class="card-footer">
                <button class="btn btn-secondary" id="reset-rules-btn">重設為預設</button>
                <button class="btn btn-primary" id="save-rules-btn">💾 儲存變更</button>
            </div>
        `;
        
        this.bindEvents();
    },
    
    renderRulesForm() {
        const container = document.getElementById('rules-form-container');
        
        container.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 24px; max-width: 800px;">
                <!-- 基本規則 -->
                <div class="card">
                    <div class="card-header">
                        <h4 style="margin: 0;">基本規則</h4>
                    </div>
                    <div class="card-body" style="display: flex; flex-direction: column; gap: 16px;">
                        <div class="form-group">
                            <label class="form-label">本月應放天數</label>
                            <input type="number" id="rule-monthlyOffDays" class="form-input" value="${this.rules.monthlyOffDays}" min="0" max="31">
                        </div>
                        <div class="form-group">
                            <label class="form-label">假日可預天數</label>
                            <input type="number" id="rule-holidayPreScheduleLimit" class="form-input" value="${this.rules.holidayPreScheduleLimit}" min="0">
                        </div>
                        <div class="form-group">
                            <label class="form-label">平均假日</label>
                            <input type="number" id="rule-averageOffDays" class="form-input" value="${this.rules.averageOffDays}" step="0.1">
                            <small class="text-muted">用於計算全月可預天數</small>
                        </div>
                    </div>
                </div>
                
                <!-- 包班規則 -->
                <div class="card">
                    <div class="card-header">
                        <h4 style="margin: 0;">包班規則</h4>
                    </div>
                    <div class="card-body" style="display: flex; flex-direction: column; gap: 16px;">
                        <div class="form-group">
                            <label style="display: flex; align-items: center; gap: 8px;">
                                <input type="checkbox" id="rule-enablePackageRule" ${this.rules.enablePackageRule ? 'checked' : ''}>
                                <span>啟用包班規則</span>
                            </label>
                        </div>
                        <div class="form-group">
                            <label class="form-label">包班最少天數</label>
                            <input type="number" id="rule-packageMinDays" class="form-input" value="${this.rules.packageMinDays}" min="0" max="31">
                        </div>
                    </div>
                </div>
                
                <!-- 接班規則 -->
                <div class="card">
                    <div class="card-header">
                        <h4 style="margin: 0;">接班規則</h4>
                    </div>
                    <div class="card-body" style="display: flex; flex-direction: column; gap: 16px;">
                        <div class="form-group">
                            <label style="display: flex; align-items: center; gap: 8px;">
                                <input type="checkbox" id="rule-enableShiftOrder" ${this.rules.enableShiftOrder ? 'checked' : ''}>
                                <span>啟用接班順序規則</span>
                            </label>
                        </div>
                        <div class="form-group">
                            <label class="form-label">班別順序 (逗號分隔)</label>
                            <input type="text" id="rule-shiftOrder" class="form-input" value="${this.rules.shiftOrder.join(',')}">
                            <small class="text-muted">例如: FF,大,白,小,DL (數字越後代表順序越後)</small>
                        </div>
                        <div class="form-group">
                            <label style="display: flex; align-items: center; gap: 8px;">
                                <input type="checkbox" id="rule-enableFFNoNight" ${this.rules.enableFFNoNight ? 'checked' : ''}>
                                <span>啟用 FF 後不接大夜 (包班者不受限)</span>
                            </label>
                        </div>
                    </div>
                </div>
                
                <!-- 預班規則 -->
                <div class="card">
                    <div class="card-header">
                        <h4 style="margin: 0;">預班規則</h4>
                    </div>
                    <div class="card-body" style="display: flex; flex-direction: column; gap: 16px;">
                        <div class="form-group">
                            <label style="display: flex; align-items: center; gap: 8px;">
                                <input type="checkbox" id="rule-offCountToLimit" ${this.rules.offCountToLimit ? 'checked' : ''}>
                                <span>OFF 列入預班限額</span>
                            </label>
                        </div>
                        <div class="form-group">
                            <label style="display: flex; align-items: center; gap: 8px;">
                                <input type="checkbox" id="rule-otherShiftCountToLimit" ${this.rules.otherShiftCountToLimit ? 'checked' : ''}>
                                <span>其他班列入預班限額</span>
                            </label>
                        </div>
                    </div>
                </div>
                
                <!-- 換班規則 -->
                <div class="card">
                    <div class="card-header">
                        <h4 style="margin: 0;">換班規則</h4>
                    </div>
                    <div class="card-body" style="display: flex; flex-direction: column; gap: 16px;">
                        <div class="form-group">
                            <label class="form-label">換班開放天數 (公告後 N 天)</label>
                            <input type="number" id="rule-swapOpenDays" class="form-input" value="${this.rules.swapOpenDays}" min="0" max="30">
                        </div>
                        <div class="form-group">
                            <label style="display: flex; align-items: center; gap: 8px;">
                                <input type="checkbox" id="rule-swapCountToStats" ${this.rules.swapCountToStats ? 'checked' : ''}>
                                <span>列入換班統計</span>
                            </label>
                        </div>
                    </div>
                </div>
                
                <!-- 勞基法規範 -->
                <div class="card">
                    <div class="card-header">
                        <h4 style="margin: 0;">勞基法規範</h4>
                    </div>
                    <div class="card-body" style="display: flex; flex-direction: column; gap: 16px;">
                        <div class="form-group">
                            <label style="display: flex; align-items: center; gap: 8px;">
                                <input type="checkbox" id="rule-enableLaborCheck" ${this.rules.enableLaborCheck ? 'checked' : ''}>
                                <span>啟用勞基法檢查</span>
                            </label>
                        </div>
                        <div class="form-group">
                            <label class="form-label">變形工時類型</label>
                            <select id="rule-laborStandardType" class="form-select">
                                <option value="four_week" ${this.rules.laborStandardType === 'four_week' ? 'selected' : ''}>四週變形工時</option>
                                <option value="two_week" ${this.rules.laborStandardType === 'two_week' ? 'selected' : ''}>兩週變形工時</option>
                                <option value="general" ${this.rules.laborStandardType === 'general' ? 'selected' : ''}>一般規定 (無變形)</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },
    
    bindEvents() {
        document.getElementById('save-rules-btn')?.addEventListener('click', () => this.saveRules());
        document.getElementById('reset-rules-btn')?.addEventListener('click', () => this.resetToDefaults());
    },
    
    async loadRules() {
        try {
            Loading.show('載入規則設定...');
            const result = await SheetsService.post(API_CONFIG.endpoints.settings.getRules, { unit_id: this.unitId });
            this.rules = result.success && result.data ? Rule.fromObject(result.data) : Rule.getDefaults();
            this.renderRulesForm();
            Loading.hide();
        } catch (error) {
            Loading.hide();
            Notification.error('載入規則設定失敗: ' + error.message);
            this.rules = Rule.getDefaults();
            this.renderRulesForm();
        }
    },
    
    async saveRules() {
        try {
            // 從表單讀取數值
            this.rules.monthlyOffDays = parseInt(document.getElementById('rule-monthlyOffDays').value);
            this.rules.holidayPreScheduleLimit = parseInt(document.getElementById('rule-holidayPreScheduleLimit').value);
            this.rules.averageOffDays = parseFloat(document.getElementById('rule-averageOffDays').value);
            this.rules.enablePackageRule = document.getElementById('rule-enablePackageRule').checked;
            this.rules.packageMinDays = parseInt(document.getElementById('rule-packageMinDays').value);
            this.rules.enableShiftOrder = document.getElementById('rule-enableShiftOrder').checked;
            this.rules.shiftOrder = document.getElementById('rule-shiftOrder').value.split(',').map(s => s.trim());
            this.rules.enableFFNoNight = document.getElementById('rule-enableFFNoNight').checked;
            this.rules.offCountToLimit = document.getElementById('rule-offCountToLimit').checked;
            this.rules.otherShiftCountToLimit = document.getElementById('rule-otherShiftCountToLimit').checked;
            this.rules.swapOpenDays = parseInt(document.getElementById('rule-swapOpenDays').value);
            this.rules.swapCountToStats = document.getElementById('rule-swapCountToStats').checked;
            this.rules.enableLaborCheck = document.getElementById('rule-enableLaborCheck').checked;
            this.rules.laborStandardType = document.getElementById('rule-laborStandardType').value;
            
            // 驗證
            const validation = this.rules.validate();
            if (!validation.valid) {
                Notification.error('驗證失敗: ' + validation.errors.join('、'));
                return;
            }
            
            Loading.show('儲存規則設定...');
            const result = await SheetsService.post(API_CONFIG.endpoints.settings.saveRules, {
                unit_id: this.unitId,
                rules: this.rules.toObject()
            });
            
            if (!result.success) throw new Error(result.message || '儲存失敗');
            
            Loading.hide();
            Notification.success('規則設定已儲存');
            SheetsService.clearCache('/settings/rules');
        } catch (error) {
            Loading.hide();
            Notification.error('儲存規則設定失敗: ' + error.message);
        }
    },
    
    async resetToDefaults() {
        const confirmed = await Modal.confirm('確定要重設為預設規則嗎？\n\n⚠️ 這會清除所有自訂的規則設定。', { danger: true });
        if (confirmed) {
            this.rules = Rule.getDefaults();
            this.renderRulesForm();
            Notification.success('已重設為預設規則，請記得儲存變更');
        }
    }
};

if (typeof window !== 'undefined') {
    window.RuleManagement = RuleManagement;
}