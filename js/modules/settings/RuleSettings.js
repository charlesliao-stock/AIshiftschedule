import { UnitService } from "../../services/firebase/UnitService.js";
import { AI_SCORING_CONFIG } from "../../config/AI_SCORING_CONFIG.js";

export class RuleSettings {
    constructor(unitId) {
        this.unitId = unitId;
        this.unitSettings = null;
        this.loadingStarted = false;
        this.containerId = 'rule-settings-container'; // 定義固定的容器 ID
    }

    async init() {
        await this.loadSettings();
    }

    async loadSettings() {
        if (!this.unitId) {
            throw new Error("Unit ID is missing. Cannot load settings.");
        }
        
        // 讀取設定
        this.unitSettings = await UnitService.getUnitSettings(this.unitId);
        
        // 初始化預設值，防止 undefined 錯誤
        if (!this.unitSettings.rules) this.unitSettings.rules = {};
        
        // 確保策略權重存在，若無則使用預設 A 方案
        if (!this.unitSettings.strategyWeights) {
            this.unitSettings.strategyWeights = { ...AI_SCORING_CONFIG.STRATEGY_WEIGHTS.A };
        }
        
        if (!this.unitSettings.strategyPreset) {
            this.unitSettings.strategyPreset = 'A';
        }
    }

    render() {
        // 1. 如果資料尚未載入
        if (!this.unitSettings) {
            if (!this.loadingStarted) {
                this.loadingStarted = true;
                // 啟動非同步載入
                this.init().then(() => {
                    // 資料載入完成，尋找容器並更新內容
                    const container = document.getElementById(this.containerId);
                    if (container) {
                        container.innerHTML = this.renderContent();
                        this.attachEvents();
                        console.log('RuleSettings: UI updated successfully.');
                    } else {
                        console.error(`RuleSettings: Container #${this.containerId} not found.`);
                    }
                }).catch(error => {
                    console.error('RuleSettings: Error loading settings:', error);
                    const container = document.getElementById(this.containerId);
                    if (container) {
                        container.innerHTML = `<div class="alert alert-danger m-4">載入設定失敗: ${error.message}</div>`;
                    }
                });
            }

            // 回傳載入中的容器 (這是關鍵：Router 會先將此 HTML 放入 DOM)
            return `
                <div id="${this.containerId}" class="container-fluid p-4">
                    <div class="card shadow-sm">
                        <div class="card-body text-center py-5">
                            <div class="spinner-border text-primary" role="status"></div>
                            <div class="mt-3 text-muted">正在讀取排班規則...</div>
                        </div>
                    </div>
                </div>`;
        }

        // 2. 如果資料已存在 (例如切換頁面後快取還在)，直接渲染內容
        return `
            <div id="${this.containerId}" class="container-fluid p-4">
                ${this.renderContent()}
            </div>
        `;
    }

    /**
     * 生成主要內容 HTML (Form 表單)
     */
    renderContent() {
        const rules = this.unitSettings.rules;
        const weights = this.unitSettings.strategyWeights;
        const preset = this.unitSettings.strategyPreset;

        return `
            <div class="card shadow-sm">
                <div class="card-header bg-white py-3 d-flex justify-content-between align-items-center">
                    <h5 class="mb-0 fw-bold text-primary"><i class="fas fa-cogs me-2"></i>排班規則設定</h5>
                </div>
                <div class="card-body">
                    <ul class="nav nav-tabs mb-4" id="settingTabs" role="tablist">
                        <li class="nav-item" role="presentation">
                            <button class="nav-link active" id="rules-tab" data-bs-toggle="tab" data-bs-target="#tab-rules" type="button" role="tab">一般規則</button>
                        </li>
                        <li class="nav-item" role="presentation">
                            <button class="nav-link" id="strategies-tab" data-bs-toggle="tab" data-bs-target="#tab-strategies" type="button" role="tab">AI 策略權重</button>
                        </li>
                    </ul>
                    
                    <form id="settings-form">
                        <div class="tab-content">
                            <div class="tab-pane fade show active" id="tab-rules" role="tabpanel">
                                ${this.generateRulesHtml(rules)}
                            </div>
                            
                            <div class="tab-pane fade" id="tab-strategies" role="tabpanel">
                                ${this.generateStrategyHtml(weights, preset)}
                            </div>
                        </div>
                    </form>
                </div>
                <div class="card-footer bg-light text-end py-3">
                    <button type="button" class="btn btn-primary px-4" id="btn-save-settings">
                        <i class="fas fa-save me-1"></i> 儲存設定
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * 生成一般規則 HTML
     */
    generateRulesHtml(rules) {
        return `
            <div class="row g-4">
                <div class="col-lg-6">
                    <div class="card h-100 border-start border-4 border-danger">
                        <div class="card-header bg-light fw-bold text-danger">1. 硬性規範 (Hard Constraints)</div>
                        <div class="card-body bg-light">
                            <div class="mb-3">
                                <div class="form-check form-switch">
                                    <input class="form-check-input" type="checkbox" checked disabled>
                                    <label class="form-check-label fw-bold">班與班間隔至少 11 小時</label>
                                    <div class="form-text small">依據勞基法強制執行，系統強制檢查。</div>
                                </div>
                            </div>
                            <div class="mb-3">
                                <label class="form-label fw-bold">一週內班別種類上限</label>
                                <select class="form-select bg-white" disabled>
                                    <option selected>最多 2 種</option>
                                </select>
                                <div class="form-text small">避免花班，固定限制為 2 種。</div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="col-lg-6">
                    <div class="card h-100 border-start border-4 border-primary">
                        <div class="card-header bg-light fw-bold text-primary">2. 單位排班原則 (Unit Rules)</div>
                        <div class="card-body">
                            <div class="row g-3">
                                <div class="col-md-6">
                                    <label class="form-label fw-bold">月班別種類上限</label>
                                    <select class="form-select" id="set-monthly-limit">
                                        <option value="2" ${rules.monthlyShiftLimit == 2 ? 'selected' : ''}>最多 2 種 (標準)</option>
                                        <option value="3" ${rules.monthlyShiftLimit == 3 ? 'selected' : ''}>最多 3 種 (彈性)</option>
                                    </select>
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label fw-bold">連續上班上限 (日)</label>
                                    <input type="number" class="form-control" id="set-max-consecutive" value="${rules.maxConsecutiveWork || 6}" min="1" max="12">
                                </div>
                                <div class="col-md-6">
                                    <div class="form-check pt-4">
                                        <input class="form-check-input" type="checkbox" id="set-month-continuity" ${rules.monthContinuity ? 'checked' : ''}>
                                        <label class="form-check-label"><strong>月初接班：</strong>檢查上月最後一天</label>
                                    </div>
                                </div>
                                <div class="col-md-6">
                                    <div class="form-check pt-4">
                                        <input class="form-check-input" type="checkbox" id="set-allow-long-leave" ${rules.allowLongLeaveException ? 'checked' : ''}>
                                        <label class="form-check-label"><strong>長假例外：</strong>允許連 7 (積假)</label>
                                    </div>
                                </div>
                                <div class="col-12 border-top pt-3 mt-2">
                                    <label class="form-label fw-bold text-secondary">AI 重平衡次數 (Rebalance Loop)</label>
                                    <div class="input-group">
                                        <span class="input-group-text">Max Loop</span>
                                        <input type="number" class="form-control" id="set-rebalance-loop" value="${rules.rebalanceLoop || 3}" min="1" max="10">
                                    </div>
                                    <div class="form-text small">數值越高 AI 運算越久，但結果可能更平均。</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * 生成 AI 策略 HTML
     */
    generateStrategyHtml(weights, preset) {
        let html = `
            <div class="alert alert-info py-2 small mb-4">
                <i class="fas fa-info-circle me-1"></i> 調整 AI 評分策略的權重，數值越高代表 AI 越重視該項目 (正分獎勵 / 負分懲罰)。
            </div>
            
            <div class="card mb-4">
                <div class="card-body bg-light">
                    <div class="row align-items-center">
                        <div class="col-md-3">
                            <label class="form-label fw-bold mb-0">快速選擇策略方案：</label>
                        </div>
                        <div class="col-md-6">
                            <select class="form-select" id="set-strategy-preset">
                                <option value="A" ${preset === 'A' ? 'selected' : ''}>方案 A: 數值平衡 (公平優先)</option>
                                <option value="B" ${preset === 'B' ? 'selected' : ''}>方案 B: 願望優先 (滿意度高)</option>
                                <option value="C" ${preset === 'C' ? 'selected' : ''}>方案 C: 規律作息 (減少換班)</option>
                                <option value="Custom" ${preset === 'Custom' ? 'selected' : ''}>自訂權重 (進階)</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            <div id="custom-weights-area" class="border rounded p-3">
                <h6 class="fw-bold text-primary mb-3 border-bottom pb-2">權重細項調整</h6>
        `;

        // 根據 CONFIG 動態生成滑桿
        const weightKeys = Object.keys(AI_SCORING_CONFIG.STRATEGY_WEIGHTS.A);
        const scoringCategories = AI_SCORING_CONFIG.SCORING_CATEGORIES;

        weightKeys.forEach(key => {
            const defaultValue = AI_SCORING_CONFIG.STRATEGY_WEIGHTS.A[key];
            const currentValue = weights[key] !== undefined ? weights[key] : defaultValue;
            
            // 尋找對應的標籤和描述
            let label = key;
            let desc = '';
            
            // 判斷是否為負分項目 (懲罰項通常範圍是負的)
            let isNegative = defaultValue < 0;
            let min = isNegative ? -500 : 0;
            let max = isNegative ? 0 : 500;
            let step = 10;

            // 遍歷 SCORING_CATEGORIES 尋找詳細資訊
            Object.values(scoringCategories).forEach(cat => {
                cat.items.forEach(item => {
                    if (item.key === key) {
                        label = item.label;
                        desc = item.desc;
                    }
                });
            });

            html += `
                <div class="row align-items-center mb-3 py-2 border-bottom border-light">
                    <div class="col-md-4">
                        <label class="fw-bold text-dark">${label}</label>
                        <div class="text-muted small" style="font-size: 0.85rem;">${desc}</div>
                    </div>
                    <div class="col-md-6">
                        <input type="range" class="form-range weight-slider" id="w-${key}" 
                               min="${min}" max="${max}" step="${step}" value="${currentValue}">
                    </div>
                    <div class="col-md-2 text-end">
                        <span class="badge ${currentValue > 0 ? 'bg-success' : (currentValue < 0 ? 'bg-danger' : 'bg-secondary')}" 
                              style="width: 60px;" id="w-value-${key}">
                            ${currentValue}
                        </span>
                    </div>
                </div>
            `;
        });

        html += `</div>`;
        return html;
    }

    attachEvents() {
        // 處理 Tabs (如果 Bootstrap JS 沒有自動綁定的話，通常 data-bs-toggle 已經足夠，但為了保險)
        // 這裡不需要手動綁定 tab click，Bootstrap 5 會處理 data-bs-target

        const customArea = document.getElementById('custom-weights-area');
        const presetSelect = document.getElementById('set-strategy-preset');
        
        // 顯示/隱藏自訂區域
        const updateCustomAreaVisibility = () => {
            if (presetSelect.value === 'Custom') {
                customArea.style.opacity = '1';
                customArea.style.pointerEvents = 'auto';
            } else {
                customArea.style.opacity = '0.5';
                customArea.style.pointerEvents = 'none'; // 鎖定操作
            }
        };

        // 初始化狀態
        updateCustomAreaVisibility();

        // 監聽策略切換
        presetSelect.addEventListener('change', () => {
            const val = presetSelect.value;
            if (val !== 'Custom') {
                // 如果切換回預設方案，自動更新滑桿數值為該方案預設值
                const newWeights = AI_SCORING_CONFIG.STRATEGY_WEIGHTS[val];
                if (newWeights) {
                    Object.keys(newWeights).forEach(key => {
                        const slider = document.getElementById(`w-${key}`);
                        const badge = document.getElementById(`w-value-${key}`);
                        if (slider && badge) {
                            slider.value = newWeights[key];
                            badge.textContent = newWeights[key];
                            // 更新顏色
                            badge.className = `badge ${newWeights[key] > 0 ? 'bg-success' : (newWeights[key] < 0 ? 'bg-danger' : 'bg-secondary')}`;
                            badge.style.width = '60px';
                        }
                    });
                }
            }
            updateCustomAreaVisibility();
        });

        // 監聽滑桿變動
        document.querySelectorAll('.weight-slider').forEach(slider => {
            const key = slider.id.replace('w-', '');
            const valueDisplay = document.getElementById(`w-value-${key}`);
            
            slider.addEventListener('input', (e) => {
                const val = parseInt(e.target.value);
                valueDisplay.textContent = val;
                valueDisplay.className = `badge ${val > 0 ? 'bg-success' : (val < 0 ? 'bg-danger' : 'bg-secondary')}`;
                valueDisplay.style.width = '60px';

                // 只要動了滑桿，自動切換到 Custom 模式
                if (presetSelect.value !== 'Custom') {
                    presetSelect.value = 'Custom';
                    updateCustomAreaVisibility();
                }
            });
        });

        // 儲存按鈕
        const btnSave = document.getElementById('btn-save-settings');
        if (btnSave) {
            btnSave.addEventListener('click', async () => {
                const originalHtml = btnSave.innerHTML;
                btnSave.disabled = true;
                btnSave.innerHTML = '<span class="spinner-border spinner-border-sm"></span> 儲存中...';

                try {
                    // 收集資料
                    const rules = {
                        monthlyShiftLimit: parseInt(document.getElementById('set-monthly-limit').value),
                        monthContinuity: document.getElementById('set-month-continuity').checked,
                        maxConsecutiveWork: parseInt(document.getElementById('set-max-consecutive').value),
                        allowLongLeaveException: document.getElementById('set-allow-long-leave').checked,
                        rebalanceLoop: parseInt(document.getElementById('set-rebalance-loop').value),
                    };

                    let strategyPreset = presetSelect.value;
                    let strategyWeights = {};

                    // 收集滑桿數值
                    document.querySelectorAll('.weight-slider').forEach(slider => {
                        const key = slider.id.replace('w-', '');
                        strategyWeights[key] = parseInt(slider.value);
                    });

                    // 呼叫 Service 更新
                    await UnitService.updateUnitSettings(this.unitId, { 
                        rules, 
                        strategyWeights, 
                        strategyPreset 
                    });

                    alert('設定已成功儲存！');
                    
                    // 重新載入設定以確保同步 (可選)
                    await this.loadSettings();

                } catch (e) {
                    console.error(e);
                    alert('儲存失敗: ' + e.message);
                } finally {
                    btnSave.disabled = false;
                    btnSave.innerHTML = originalHtml;
                }
            });
        }
    }
}
