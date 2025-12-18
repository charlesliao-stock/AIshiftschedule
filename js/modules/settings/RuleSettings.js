import { UnitService } from "../../services/firebase/UnitService.js";
import { AI_SCORING_CONFIG } from "../../config/AI_SCORING_CONFIG.js";

export class RuleSettings {
    constructor(unitId) {
        this.unitId = unitId;
        this.unitSettings = null;
    }

    async init() {
        await this.loadSettings();
    }

    async loadSettings() {
        this.unitSettings = await UnitService.getUnitSettings(this.unitId);
        if (!this.unitSettings.rules) this.unitSettings.rules = {};
        // 確保 strategyWeights 存在，如果沒有則使用預設 A 方案
        if (!this.unitSettings.strategyWeights) this.unitSettings.strategyWeights = AI_SCORING_CONFIG.STRATEGY_WEIGHTS.A; 
        if (!this.unitSettings.strategyPreset) this.unitSettings.strategyPreset = 'A';
    }

    render() {
        // 修正：增加防禦性檢查，避免在 unitSettings 尚未載入時讀取其屬性
        if (!this.unitSettings) {
            return `<div class="modal-body text-center py-5">載入中...</div>`;
        }
        const rules = this.unitSettings.rules;
        const weights = this.unitSettings.strategyWeights;
        const scoringCategories = AI_SCORING_CONFIG.SCORING_CATEGORIES;

        const ruleHtml = `
            <div class="card mb-3 border-left-danger">
                <div class="card-header bg-light fw-bold text-danger">1. 硬性規範 (Hard Constraints)</div>
                <div class="card-body bg-light">
                    <div class="row g-3">
                        <div class="col-md-6">
                            <div class="form-check form-switch">
                                <input class="form-check-input" type="checkbox" id="set-interval-11h" checked disabled>
                                <label class="form-check-label fw-bold">班與班間隔至少 11 小時</label>
                                <div class="form-text small">依據法規強制執行，不可關閉。</div>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <label class="form-label fw-bold">一週內班別種類上限</label>
                            <select class="form-select bg-white" id="set-weekly-limit" disabled>
                                <option value="2" selected>最多 2 種</option>
                            </select>
                            <div class="form-text small">依據法規強制執行，固定為 2 種。</div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="card mb-3 border-left-primary">
                <div class="card-header bg-light fw-bold text-primary">2. 單位排班原則 (Unit Rules)</div>
                <div class="card-body">
                    <div class="row g-3">
                        <div class="col-md-6">
                            <label class="form-label fw-bold">一個月內班別種類上限</label>
                            <select class="form-select" id="set-monthly-limit">
                                <option value="2" ${rules.monthlyShiftLimit == 2 ? 'selected' : ''}>最多 2 種 (標準)</option>
                                <option value="3" ${rules.monthlyShiftLimit == 3 ? 'selected' : ''}>最多 3 種 (彈性)</option>
                            </select>
                        </div>
                        <div class="col-md-6 d-flex align-items-center">
                            <div class="form-check ms-2">
                                <input class="form-check-input" type="checkbox" id="set-month-continuity" ${rules.monthContinuity ? 'checked' : ''}>
                                <label class="form-check-label"><strong>月初接班：</strong>可順接上月</label>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <label class="form-label fw-bold">連續上班上限 (日)</label>
                            <div class="input-group">
                                <input type="number" class="form-control" id="set-max-consecutive" value="${rules.maxConsecutiveWork || 6}" min="1" max="14">
                                <span class="input-group-text">天</span>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="form-check mt-4">
                                <input class="form-check-input" type="checkbox" id="set-allow-long-leave" ${rules.allowLongLeaveException ? 'checked' : ''}>
                                <label class="form-check-label fw-bold">長假例外 (可連7)</label>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <label class="form-label fw-bold text-danger">重平衡嘗試次數</label>
                            <input type="number" class="form-control" id="set-rebalance-loop" value="${rules.rebalanceLoop || 3}" min="1" max="10">
                        </div>
                    </div>
                </div>
            </div>
        `;

        // AI 策略權重 HTML
        let strategyHtml = `
            <div class="alert alert-info py-2 small">調整 AI 評分策略的權重，數值越高代表 AI 越重視該項目。</div>
            <div class="row mb-3">
                <div class="col-md-6">
                    <label class="form-label fw-bold">選擇預設策略</label>
                    <select class="form-select" id="set-strategy-preset">
                        <option value="A" ${this.unitSettings.strategyPreset === 'A' ? 'selected' : ''}>方案 A: 數值平衡 (公平優先)</option>
                        <option value="B" ${this.unitSettings.strategyPreset === 'B' ? 'selected' : ''}>方案 B: 願望優先 (滿意度高)</option>
                        <option value="C" ${this.unitSettings.strategyPreset === 'C' ? 'selected' : ''}>方案 C: 規律作息 (減少換班)</option>
                        <option value="Custom" ${this.unitSettings.strategyPreset === 'Custom' ? 'selected' : ''}>自訂權重</option>
                    </select>
                </div>
            </div>
            <div id="custom-weights-area" class="card card-body bg-light">
                <h6 class="fw-bold text-primary mb-3">自訂權重調整</h6>
        `;

        // 根據 AI_SCORING_CONFIG 產生權重調整介面
        const weightKeys = Object.keys(AI_SCORING_CONFIG.STRATEGY_WEIGHTS.A);
        weightKeys.forEach(key => {
            const defaultValue = AI_SCORING_CONFIG.STRATEGY_WEIGHTS.A[key];
            const currentValue = weights[key] !== undefined ? weights[key] : defaultValue;
            
            // 尋找對應的標籤和描述
            let label = key;
            let desc = '';
            let isNegative = defaultValue < 0;
            let min = isNegative ? -500 : 10;
            let max = isNegative ? -10 : 500;
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

            strategyHtml += `
                <div class="row align-items-center mb-3">
                    <div class="col-md-4">
                        <label class="small fw-bold">${label}</label>
                        <div class="form-text small">${desc}</div>
                    </div>
                    <div class="col-md-8">
                        <input type="range" class="form-range weight-slider" id="w-${key}" 
                               min="${min}" max="${max}" step="${step}" value="${currentValue}">
                        <div class="text-end small fw-bold" id="w-value-${key}">${currentValue}</div>
                    </div>
                </div>
            `;
        });

        strategyHtml += `</div>`; // custom-weights-area 結束

        return `
            <div class="modal-body">
                <ul class="nav nav-tabs mb-3" id="settingTabs" role="tablist">
                    <li class="nav-item"><button class="nav-link active" data-bs-toggle="tab" data-bs-target="#tab-rules">一般規則</button></li>
                    <li class="nav-item"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#tab-strategies">AI 策略權重</button></li>
                </ul>
                
                <form id="settings-form">
                    <div class="tab-content">
                        <div class="tab-pane fade show active" id="tab-rules">
                            ${ruleHtml}
                        </div>
                        <div class="tab-pane fade" id="tab-strategies">
                            ${strategyHtml}
                        </div>
                    </div>
                </form>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">取消</button>
                <button type="button" class="btn btn-primary" id="btn-save-settings">儲存設定</button>
            </div>
        `;
    }

    attachEvents() {
        const customArea = document.getElementById('custom-weights-area');
        const presetSelect = document.getElementById('set-strategy-preset');
        
        const updateCustomAreaVisibility = () => {
            customArea.style.display = presetSelect.value === 'Custom' ? 'block' : 'none';
        };

        updateCustomAreaVisibility();
        presetSelect.addEventListener('change', updateCustomAreaVisibility);

        // 權重滑桿事件
        document.querySelectorAll('.weight-slider').forEach(slider => {
            const key = slider.id.replace('w-', '');
            const valueDisplay = document.getElementById(`w-value-${key}`);
            slider.addEventListener('input', (e) => {
                valueDisplay.textContent = e.target.value;
                presetSelect.value = 'Custom'; // 只要調整滑桿，就切換到自訂
                updateCustomAreaVisibility();
            });
        });

        document.getElementById('btn-save-settings').addEventListener('click', async () => {
            const rules = {
                monthlyShiftLimit: parseInt(document.getElementById('set-monthly-limit').value),
                monthContinuity: document.getElementById('set-month-continuity').checked,
                maxConsecutiveWork: parseInt(document.getElementById('set-max-consecutive').value),
                allowLongLeaveException: document.getElementById('set-allow-long-leave').checked,
                rebalanceLoop: parseInt(document.getElementById('set-rebalance-loop').value),
            };

            let strategyPreset = presetSelect.value;
            let strategyWeights = {};

            if (strategyPreset === 'Custom') {
                document.querySelectorAll('.weight-slider').forEach(slider => {
                    const key = slider.id.replace('w-', '');
                    strategyWeights[key] = parseInt(slider.value);
                });
            } else {
                strategyWeights = AI_SCORING_CONFIG.STRATEGY_WEIGHTS[strategyPreset];
            }

            try {
                await UnitService.updateUnitSettings(this.unitId, { rules, strategyWeights, strategyPreset });
                alert('設定已儲存！');
                // 重新載入設定
                await this.loadSettings();
                // 重新渲染 Modal 內容
                document.querySelector('#settings-modal .modal-content').innerHTML = this.render();
                this.attachEvents();
            } catch (e) {
                alert('儲存失敗: ' + e.message);
            }
        });
    }
}
