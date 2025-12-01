/**
 * 勞基法規範設定模組
 * 管理變形工時、休息時間等勞基法相關設定
 */

import { SettingsService } from '../../services/settings.service.js';
import { showNotification, showLoading, hideLoading } from '../../components/notification.js';

class LaborLawSettings {
    constructor() {
        this.settingsService = new SettingsService();
        this.settings = null;
    }

    /**
     * 初始化勞基法設定
     */
    async init() {
        try {
            // 載入現有設定
            await this.loadSettings();

            // 初始化UI
            this.initializeUI();

            // 綁定事件
            this.bindEvents();

        } catch (error) {
            console.error('初始化勞基法設定失敗:', error);
            showNotification('初始化失敗，請重新整理頁面', 'error');
        }
    }

    /**
     * 載入設定
     */
    async loadSettings() {
        try {
            this.settings = await this.settingsService.getLaborLawSettings();
            
            // 如果沒有設定，使用預設值
            if (!this.settings || Object.keys(this.settings).length === 0) {
                this.settings = this.getDefaultSettings();
            }

        } catch (error) {
            console.error('載入勞基法設定失敗:', error);
            this.settings = this.getDefaultSettings();
        }
    }

    /**
     * 取得預設設定
     */
    getDefaultSettings() {
        return {
            // 變形工時類型
            flexTimeType: '四週', // '四週', '兩週', '無'
            
            // 啟用勞基法檢查
            enableLaborLawCheck: true,
            
            // 四週變形工時
            fourWeekFlex: {
                enabled: true,
                dailyHoursMax: 10,
                weeklyHoursMax: 48,
                fourWeekHoursMax: 160,
                restPerSevenDays: 1
            },
            
            // 兩週變形工時
            twoWeekFlex: {
                enabled: false,
                dailyHoursMax: 10,
                weeklyHoursMax: 48,
                twoWeekHoursMax: 80,
                restPerSevenDays: 1
            },
            
            // 一般規定
            generalStandard: {
                enabled: false,
                dailyHoursMax: 8,
                weeklyHoursMax: 40,
                restPerSevenDays: 1,
                restBetweenShifts: 11
            },
            
            // 連續工作限制
            consecutiveWorkDays: {
                enabled: true,
                maxDays: 6
            },
            
            // 違規處理
            violationHandling: {
                showWarning: true,
                blockPublish: true,
                autoCorrect: false
            }
        };
    }

    /**
     * 初始化UI
     */
    initializeUI() {
        const container = document.getElementById('laborLawSettingsPanel');
        if (!container) return;

        container.innerHTML = `
            <div class="labor-law-panel">
                <div class="panel-header">
                    <h3>勞基法規範設定</h3>
                    <div class="header-actions">
                        <label class="toggle-switch">
                            <input type="checkbox" 
                                   id="enableLaborLawCheck" 
                                   ${this.settings.enableLaborLawCheck ? 'checked' : ''}>
                            <span class="toggle-slider"></span>
                            <span class="toggle-label">啟用勞基法檢查</span>
                        </label>
                    </div>
                </div>

                <div class="settings-content ${!this.settings.enableLaborLawCheck ? 'disabled' : ''}">
                    
                    <!-- 變形工時類型選擇 -->
                    <div class="form-section">
                        <h4>變形工時類型</h4>
                        <div class="form-group">
                            <div class="radio-group">
                                <label class="radio-label">
                                    <input type="radio" 
                                           name="flexTimeType" 
                                           value="四週"
                                           ${this.settings.flexTimeType === '四週' ? 'checked' : ''}>
                                    <span>四週變形工時</span>
                                </label>
                                <label class="radio-label">
                                    <input type="radio" 
                                           name="flexTimeType" 
                                           value="兩週"
                                           ${this.settings.flexTimeType === '兩週' ? 'checked' : ''}>
                                    <span>兩週變形工時</span>
                                </label>
                                <label class="radio-label">
                                    <input type="radio" 
                                           name="flexTimeType" 
                                           value="無"
                                           ${this.settings.flexTimeType === '無' ? 'checked' : ''}>
                                    <span>一般規定（無變形）</span>
                                </label>
                            </div>
                        </div>
                    </div>

                    <!-- 四週變形工時設定 -->
                    <div class="form-section ${this.settings.flexTimeType !== '四週' ? 'hidden' : ''}" 
                         id="fourWeekFlexSection">
                        <h4>四週變形工時規範</h4>
                        
                        <div class="info-box">
                            <p>📖 根據勞動基準法第30條第1項第2款：</p>
                            <ul>
                                <li>每日正常工作時間不得超過10小時</li>
                                <li>每週工作總時數不得超過48小時</li>
                                <li>四週內正常工作時數不得超過160小時</li>
                                <li>每七日中至少應有一日之休息</li>
                            </ul>
                        </div>

                        <div class="form-row">
                            <div class="form-group">
                                <label>每日正常工時上限（小時）：</label>
                                <input type="number" 
                                       id="fourWeekDailyMax" 
                                       class="form-control"
                                       value="${this.settings.fourWeekFlex.dailyHoursMax}"
                                       min="8"
                                       max="12"
                                       step="0.5">
                                <small class="form-text">法定上限：10小時</small>
                            </div>
                            <div class="form-group">
                                <label>每週工時上限（小時）：</label>
                                <input type="number" 
                                       id="fourWeekWeeklyMax" 
                                       class="form-control"
                                       value="${this.settings.fourWeekFlex.weeklyHoursMax}"
                                       min="40"
                                       max="60"
                                       step="1">
                                <small class="form-text">法定上限：48小時</small>
                            </div>
                        </div>

                        <div class="form-row">
                            <div class="form-group">
                                <label>四週工時上限（小時）：</label>
                                <input type="number" 
                                       id="fourWeekTotalMax" 
                                       class="form-control"
                                       value="${this.settings.fourWeekFlex.fourWeekHoursMax}"
                                       min="160"
                                       max="200"
                                       step="1">
                                <small class="form-text">法定上限：160小時</small>
                            </div>
                            <div class="form-group">
                                <label>每七日至少休息（日）：</label>
                                <input type="number" 
                                       id="fourWeekRestDays" 
                                       class="form-control"
                                       value="${this.settings.fourWeekFlex.restPerSevenDays}"
                                       min="1"
                                       max="2"
                                       step="1">
                                <small class="form-text">法定最少：1日</small>
                            </div>
                        </div>
                    </div>

                    <!-- 兩週變形工時設定 -->
                    <div class="form-section ${this.settings.flexTimeType !== '兩週' ? 'hidden' : ''}" 
                         id="twoWeekFlexSection">
                        <h4>兩週變形工時規範</h4>
                        
                        <div class="info-box">
                            <p>📖 根據勞動基準法第30條第1項第1款：</p>
                            <ul>
                                <li>每日正常工作時間不得超過10小時</li>
                                <li>每週工作總時數不得超過48小時</li>
                                <li>兩週內正常工作時數不得超過80小時</li>
                                <li>每七日中至少應有一日之休息</li>
                            </ul>
                        </div>

                        <div class="form-row">
                            <div class="form-group">
                                <label>每日正常工時上限（小時）：</label>
                                <input type="number" 
                                       id="twoWeekDailyMax" 
                                       class="form-control"
                                       value="${this.settings.twoWeekFlex.dailyHoursMax}"
                                       min="8"
                                       max="12"
                                       step="0.5">
                                <small class="form-text">法定上限：10小時</small>
                            </div>
                            <div class="form-group">
                                <label>每週工時上限（小時）：</label>
                                <input type="number" 
                                       id="twoWeekWeeklyMax" 
                                       class="form-control"
                                       value="${this.settings.twoWeekFlex.weeklyHoursMax}"
                                       min="40"
                                       max="60"
                                       step="1">
                                <small class="form-text">法定上限：48小時</small>
                            </div>
                        </div>

                        <div class="form-row">
                            <div class="form-group">
                                <label>兩週工時上限（小時）：</label>
                                <input type="number" 
                                       id="twoWeekTotalMax" 
                                       class="form-control"
                                       value="${this.settings.twoWeekFlex.twoWeekHoursMax}"
                                       min="80"
                                       max="100"
                                       step="1">
                                <small class="form-text">法定上限：80小時</small>
                            </div>
                            <div class="form-group">
                                <label>每七日至少休息（日）：</label>
                                <input type="number" 
                                       id="twoWeekRestDays" 
                                       class="form-control"
                                       value="${this.settings.twoWeekFlex.restPerSevenDays}"
                                       min="1"
                                       max="2"
                                       step="1">
                                <small class="form-text">法定最少：1日</small>
                            </div>
                        </div>
                    </div>

                    <!-- 一般規定設定 -->
                    <div class="form-section ${this.settings.flexTimeType !== '無' ? 'hidden' : ''}" 
                         id="generalStandardSection">
                        <h4>一般工時規定</h4>
                        
                        <div class="info-box">
                            <p>📖 根據勞動基準法第30條：</p>
                            <ul>
                                <li>每日正常工作時間不得超過8小時</li>
                                <li>每週工作總時數不得超過40小時</li>
                                <li>每七日中至少應有一日之休息</li>
                                <li>繼續工作4小時，至少應有30分鐘之休息</li>
                            </ul>
                        </div>

                        <div class="form-row">
                            <div class="form-group">
                                <label>每日正常工時上限（小時）：</label>
                                <input type="number" 
                                       id="generalDailyMax" 
                                       class="form-control"
                                       value="${this.settings.generalStandard.dailyHoursMax}"
                                       min="8"
                                       max="10"
                                       step="0.5">
                                <small class="form-text">法定上限：8小時</small>
                            </div>
                            <div class="form-group">
                                <label>每週工時上限（小時）：</label>
                                <input type="number" 
                                       id="generalWeeklyMax" 
                                       class="form-control"
                                       value="${this.settings.generalStandard.weeklyHoursMax}"
                                       min="40"
                                       max="48"
                                       step="1">
                                <small class="form-text">法定上限：40小時</small>
                            </div>
                        </div>

                        <div class="form-row">
                            <div class="form-group">
                                <label>每七日至少休息（日）：</label>
                                <input type="number" 
                                       id="generalRestDays" 
                                       class="form-control"
                                       value="${this.settings.generalStandard.restPerSevenDays}"
                                       min="1"
                                       max="2"
                                       step="1">
                                <small class="form-text">法定最少：1日</small>
                            </div>
                            <div class="form-group">
                                <label>連續休息時間（小時）：</label>
                                <input type="number" 
                                       id="generalRestBetweenShifts" 
                                       class="form-control"
                                       value="${this.settings.generalStandard.restBetweenShifts}"
                                       min="11"
                                       max="12"
                                       step="1">
                                <small class="form-text">兩工作日間至少休息11小時</small>
                            </div>
                        </div>
                    </div>

                    <!-- 連續工作限制 -->
                    <div class="form-section">
                        <h4>連續工作限制</h4>
                        <div class="form-group">
                            <label class="checkbox-label">
                                <input type="checkbox" 
                                       id="enableConsecutiveLimit"
                                       ${this.settings.consecutiveWorkDays.enabled ? 'checked' : ''}>
                                <span>啟用連續工作天數限制</span>
                            </label>
                        </div>
                        <div class="form-group ${!this.settings.consecutiveWorkDays.enabled ? 'hidden' : ''}" 
                             id="consecutiveLimitControl">
                            <label>最多連續工作天數：</label>
                            <input type="number" 
                                   id="maxConsecutiveDays" 
                                   class="form-control"
                                   value="${this.settings.consecutiveWorkDays.maxDays}"
                                   min="5"
                                   max="10"
                                   step="1">
                            <small class="form-text">建議：6天（符合每七日休息一日）</small>
                        </div>
                    </div>

                    <!-- 違規處理 -->
                    <div class="form-section">
                        <h4>違規處理方式</h4>
                        <div class="form-group">
                            <label class="checkbox-label">
                                <input type="checkbox" 
                                       id="showWarning"
                                       ${this.settings.violationHandling.showWarning ? 'checked' : ''}>
                                <span>顯示違規警告提示</span>
                            </label>
                            <small class="form-text">在排班時即時顯示違規提示</small>
                        </div>
                        <div class="form-group">
                            <label class="checkbox-label">
                                <input type="checkbox" 
                                       id="blockPublish"
                                       ${this.settings.violationHandling.blockPublish ? 'checked' : ''}>
                                <span>禁止公告違規班表</span>
                            </label>
                            <small class="form-text">有嚴重違規時不允許公告班表</small>
                        </div>
                        <div class="form-group">
                            <label class="checkbox-label">
                                <input type="checkbox" 
                                       id="autoCorrect"
                                       ${this.settings.violationHandling.autoCorrect ? 'checked' : ''}>
                                <span>自動修正違規（實驗功能）</span>
                            </label>
                            <small class="form-text">AI排班時自動避開違規情況</small>
                        </div>
                    </div>

                    <!-- 操作按鈕 -->
                    <div class="form-actions">
                        <button type="button" class="btn btn-secondary" id="resetLaborLawBtn">
                            重設為預設值
                        </button>
                        <button type="button" class="btn btn-primary" id="saveLaborLawBtn">
                            儲存設定
                        </button>
                    </div>

                </div>
            </div>
        `;
    }

    /**
     * 綁定事件
     */
    bindEvents() {
        // 啟用勞基法檢查開關
        const enableCheckbox = document.getElementById('enableLaborLawCheck');
        if (enableCheckbox) {
            enableCheckbox.addEventListener('change', (e) => {
                const content = document.querySelector('.settings-content');
                if (content) {
                    content.classList.toggle('disabled', !e.target.checked);
                }
            });
        }

        // 變形工時類型切換
        document.querySelectorAll('input[name="flexTimeType"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.handleFlexTypeChange(e.target.value);
            });
        });

        // 連續工作限制開關
        const consecutiveCheckbox = document.getElementById('enableConsecutiveLimit');
        if (consecutiveCheckbox) {
            consecutiveCheckbox.addEventListener('change', (e) => {
                const control = document.getElementById('consecutiveLimitControl');
                if (control) {
                    control.classList.toggle('hidden', !e.target.checked);
                }
            });
        }

        // 儲存按鈕
        const saveBtn = document.getElementById('saveLaborLawBtn');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.handleSave());
        }

        // 重設按鈕
        const resetBtn = document.getElementById('resetLaborLawBtn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => this.handleReset());
        }
    }

    /**
     * 處理變形工時類型切換
     */
    handleFlexTypeChange(type) {
        // 隱藏所有區塊
        document.getElementById('fourWeekFlexSection')?.classList.add('hidden');
        document.getElementById('twoWeekFlexSection')?.classList.add('hidden');
        document.getElementById('generalStandardSection')?.classList.add('hidden');

        // 顯示對應區塊
        switch(type) {
            case '四週':
                document.getElementById('fourWeekFlexSection')?.classList.remove('hidden');
                break;
            case '兩週':
                document.getElementById('twoWeekFlexSection')?.classList.remove('hidden');
                break;
            case '無':
                document.getElementById('generalStandardSection')?.classList.remove('hidden');
                break;
        }
    }

    /**
     * 處理儲存
     */
    async handleSave() {
        try {
            showLoading('儲存設定中...');

            // 收集表單資料
            const formData = this.collectFormData();

            // 驗證資料
            const validation = this.validateFormData(formData);
            if (!validation.valid) {
                hideLoading();
                showNotification(validation.message, 'error');
                return;
            }

            // 儲存到後端
            await this.settingsService.saveLaborLawSettings(formData);

            // 更新本地設定
            this.settings = formData;

            hideLoading();
            showNotification('勞基法規範設定已儲存', 'success');

        } catch (error) {
            hideLoading();
            console.error('儲存勞基法設定失敗:', error);
            showNotification('儲存失敗，請稍後再試', 'error');
        }
    }

    /**
     * 收集表單資料
     */
    collectFormData() {
        const flexTimeType = document.querySelector('input[name="flexTimeType"]:checked')?.value || '四週';

        return {
            flexTimeType: flexTimeType,
            enableLaborLawCheck: document.getElementById('enableLaborLawCheck')?.checked || false,
            
            fourWeekFlex: {
                enabled: flexTimeType === '四週',
                dailyHoursMax: parseFloat(document.getElementById('fourWeekDailyMax')?.value) || 10,
                weeklyHoursMax: parseFloat(document.getElementById('fourWeekWeeklyMax')?.value) || 48,
                fourWeekHoursMax: parseFloat(document.getElementById('fourWeekTotalMax')?.value) || 160,
                restPerSevenDays: parseInt(document.getElementById('fourWeekRestDays')?.value) || 1
            },
            
            twoWeekFlex: {
                enabled: flexTimeType === '兩週',
                dailyHoursMax: parseFloat(document.getElementById('twoWeekDailyMax')?.value) || 10,
                weeklyHoursMax: parseFloat(document.getElementById('twoWeekWeeklyMax')?.value) || 48,
                twoWeekHoursMax: parseFloat(document.getElementById('twoWeekTotalMax')?.value) || 80,
                restPerSevenDays: parseInt(document.getElementById('twoWeekRestDays')?.value) || 1
            },
            
            generalStandard: {
                enabled: flexTimeType === '無',
                dailyHoursMax: parseFloat(document.getElementById('generalDailyMax')?.value) || 8,
                weeklyHoursMax: parseFloat(document.getElementById('generalWeeklyMax')?.value) || 40,
                restPerSevenDays: parseInt(document.getElementById('generalRestDays')?.value) || 1,
                restBetweenShifts: parseInt(document.getElementById('generalRestBetweenShifts')?.value) || 11
            },
            
            consecutiveWorkDays: {
                enabled: document.getElementById('enableConsecutiveLimit')?.checked || false,
                maxDays: parseInt(document.getElementById('maxConsecutiveDays')?.value) || 6
            },
            
            violationHandling: {
                showWarning: document.getElementById('showWarning')?.checked || true,
                blockPublish: document.getElementById('blockPublish')?.checked || true,
                autoCorrect: document.getElementById('autoCorrect')?.checked || false
            }
        };
    }

    /**
     * 驗證表單資料
     */
    validateFormData(data) {
        // 驗證四週變形工時
        if (data.flexTimeType === '四週') {
            if (data.fourWeekFlex.dailyHoursMax > 10) {
                return { valid: false, message: '四週變形工時每日上限不得超過10小時' };
            }
            if (data.fourWeekFlex.weeklyHoursMax > 48) {
                return { valid: false, message: '四週變形工時每週上限不得超過48小時' };
            }
            if (data.fourWeekFlex.fourWeekHoursMax > 160) {
                return { valid: false, message: '四週變形工時總時數不得超過160小時' };
            }
        }

        // 驗證兩週變形工時
        if (data.flexTimeType === '兩週') {
            if (data.twoWeekFlex.dailyHoursMax > 10) {
                return { valid: false, message: '兩週變形工時每日上限不得超過10小時' };
            }
            if (data.twoWeekFlex.weeklyHoursMax > 48) {
                return { valid: false, message: '兩週變形工時每週上限不得超過48小時' };
            }
            if (data.twoWeekFlex.twoWeekHoursMax > 80) {
                return { valid: false, message: '兩週變形工時總時數不得超過80小時' };
            }
        }

        // 驗證一般規定
        if (data.flexTimeType === '無') {
            if (data.generalStandard.dailyHoursMax > 8) {
                return { valid: false, message: '一般規定每日工時上限不得超過8小時' };
            }
            if (data.generalStandard.weeklyHoursMax > 40) {
                return { valid: false, message: '一般規定每週工時上限不得超過40小時' };
            }
        }

        return { valid: true };
    }

    /**
     * 處理重設
     */
    handleReset() {
        const confirmed = confirm('確定要重設為預設值嗎？此操作無法復原。');
        if (!confirmed) return;

        this.settings = this.getDefaultSettings();
        this.initializeUI();
        this.bindEvents();
        
        showNotification('已重設為預設值', 'info');
    }
}

// 匯出
export { LaborLawSettings };