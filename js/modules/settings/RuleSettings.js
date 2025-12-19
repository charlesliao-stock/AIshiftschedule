import { UnitService } from "../../services/firebase/UnitService.js";
import { authService } from "../../services/firebase/AuthService.js";
import { ScoringService } from "../../services/ScoringService.js"; 

export class RuleSettings {
    constructor() { 
        this.targetUnitId = null; 
        this.currentConfig = null; // 這是 ScoringService 的 config 結構
        this.activeModalTarget = null; // 用於儲存當前正在編輯 Tiers 的目標 (catKey, subKey)
        this.tiersModal = null; 
    }

    async render() {
        return `
            <div class="container-fluid mt-4">
                <div class="d-flex justify-content-between align-items-center mb-3">
                    <div>
                        <h3 class="text-gray-800 fw-bold"><i class="fas fa-ruler-combined"></i> 規則與評分設定</h3>
                        <p class="text-muted small mb-0">設定排班的硬性邊界、人力需求目標以及 AI 的評分標準。</p>
                    </div>
                    <div class="d-flex align-items-center gap-2">
                        <select id="rule-unit-select" class="form-select w-auto fw-bold text-primary shadow-sm"><option value="">載入中...</option></select>
                        <button id="btn-save-rules" class="btn btn-primary shadow-sm"><i class="fas fa-save"></i> 儲存所有設定</button>
                    </div>
                </div>

                <ul class="nav nav-tabs mb-4" id="ruleSettingsTabs" role="tablist">
                    <li class="nav-item" role="presentation">
                        <button class="nav-link active fw-bold" id="tab-hard-rules-btn" data-bs-toggle="tab" data-bs-target="#tab-hard-rules" type="button" role="tab">
                            <i class="fas fa-gavel text-danger me-2"></i>硬性規定 (Rules)
                        </button>
                    </li>
                    <li class="nav-item" role="presentation">
                        <button class="nav-link fw-bold" id="tab-staff-req-btn" data-bs-toggle="tab" data-bs-target="#tab-staff-req" type="button" role="tab">
                            <i class="fas fa-users text-primary me-2"></i>人力需求 (Requirements)
                        </button>
                    </li>
                    <li class="nav-item" role="presentation">
                        <button class="nav-link fw-bold" id="tab-ai-weights-btn" data-bs-toggle="tab" data-bs-target="#tab-ai-weights" type="button" role="tab">
                            <i class="fas fa-balance-scale text-success me-2"></i>AI 評分權重 (Weights)
                        </button>
                    </li>
                </ul>

                <div class="tab-content" id="ruleSettingsTabContent">
                    
                    <div class="tab-pane fade show active" id="tab-hard-rules" role="tabpanel">
                        <div class="card shadow mb-4 border-left-danger">
                            <div class="card-header py-3 bg-white">
                                <h6 class="m-0 font-weight-bold text-danger">⚠️ 硬性邊界 (違反即視為不合法)</h6>
                                <small class="text-muted">以下鎖定項目為系統強制執行，無法取消。</small>
                            </div>
                            <div class="card-body">
                                <div class="row">
                                    <div class="col-md-6">
                                        <div class="mb-4 p-3 bg-light rounded border">
                                            <div class="form-check form-switch mb-3">
                                                <input class="form-check-input" type="checkbox" id="rule-min-interval-11" checked disabled>
                                                <label class="form-check-label fw-bold">班距必須大於 11 小時</label>
                                                <div class="form-text small text-danger">強制執行 (勞基法與護理規範)</div>
                                            </div>
                                            <div class="form-check form-switch mb-3">
                                                <input class="form-check-input" type="checkbox" id="rule-maternity-protect" checked disabled>
                                                <label class="form-check-label fw-bold">孕產保護規則</label>
                                                <div class="form-text small text-danger">懷孕/哺乳期間，強制不排 22:00 後班別 (N班禁止，E班需注意結束時間)</div>
                                            </div>
                                            <div class="mb-3">
                                                <label class="form-label fw-bold">一週班別種類上限</label>
                                                <input type="number" id="rule-max-shift-types-weekly" class="form-control" value="2" readonly disabled>
                                                <div class="form-text small text-danger">每週最多 2 種班別 (例如 D/E，不可 D/E/N 混排)</div>
                                            </div>
                                        </div>
                                    </div>

                                    <div class="col-md-6">
                                        <div class="mb-4 p-3 border rounded">
                                            <h6 class="fw-bold text-dark mb-3">🔧 單位自訂參數</h6>
                                            
                                            <div class="row mb-3">
                                                <div class="col-6">
                                                    <label class="form-label fw-bold">最少連續上班</label>
                                                    <input type="number" id="rule-min-consecutive" class="form-control" value="1" min="1">
                                                </div>
                                                <div class="col-6">
                                                    <label class="form-label fw-bold">最多連續上班</label>
                                                    <input type="number" id="rule-max-work-days" class="form-control" value="6" min="4" max="12">
                                                    <div class="form-text small">通常建議 6 或 7 天</div>
                                                </div>
                                            </div>

                                            <div class="mb-3">
                                                <label class="form-label fw-bold">連續夜班(N)上限</label>
                                                <input type="number" id="rule-max-night-consecutive" class="form-control" value="4" min="1">
                                                <div class="form-text small">避免長期夜班過勞</div>
                                            </div>
                                            
                                            <div class="form-check form-switch">
                                                <input class="form-check-input" type="checkbox" id="rule-pre-night-off">
                                                <label class="form-check-label fw-bold">大夜班(N)前一天必須為 OFF 或 N</label>
                                                <div class="form-text small">避免 D 接 N 或 E 接 N (追加入調整選項)</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="tab-pane fade" id="tab-staff-req" role="tabpanel">
                        <div class="card shadow mb-4 border-left-primary">
                            <div class="card-header py-3 bg-white">
                                <h6 class="m-0 font-weight-bold text-primary"><i class="fas fa-user-nurse"></i> 每日人力下限設定</h6>
                                <small class="text-muted">AI 會盡力滿足此人數，若低於此數將會嚴重扣分或視為缺班。</small>
                            </div>
                            <div class="card-body p-0">
                                <div class="table-responsive">
                                    <table class="table table-bordered text-center mb-0 align-middle">
                                        <thead class="bg-light">
                                            <tr>
                                                <th style="width: 15%">班別</th>
                                                <th>週日 (Sun)</th><th>週一 (Mon)</th><th>週二 (Tue)</th><th>週三 (Wed)</th>
                                                <th>週四 (Thu)</th><th>週五 (Fri)</th><th>週六 (Sat)</th>
                                            </tr>
                                        </thead>
                                        <tbody id="staff-req-tbody">
                                            <tr><td colspan="8" class="text-muted p-4">載入中...</td></tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="tab-pane fade" id="tab-ai-weights" role="tabpanel">
                        <div class="card shadow mb-4 border-left-success">
                            <div class="card-header py-3 bg-white d-flex justify-content-between align-items-center">
                                <h6 class="m-0 font-weight-bold text-success"><i class="fas fa-chart-line"></i> AI 評分指標權重</h6>
                                <span class="badge bg-secondary" id="total-weight-badge">檢查中...</span>
                            </div>
                            <div class="card-body" id="ai-weights-container">
                                <div class="text-center p-5 text-muted">載入中...</div>
                            </div>
                        </div>
                    </div>

                </div>
            </div>

            <div class="modal fade" id="tiers-modal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header bg-light">
                            <h5 class="modal-title fw-bold">設定評分等級 (Tiers)</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <p class="small text-muted mb-3" id="tiers-modal-desc">設定不同數值範圍對應的分數 (100分為滿分)。</p>
                            <div id="tiers-modal-body"></div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">取消</button>
                            <button type="button" class="btn btn-primary" onclick="window.routerPage.saveTiers()">確定</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    async afterRender() {
        this.tiersModal = new bootstrap.Modal(document.getElementById('tiers-modal'));
        window.routerPage = this;

        const user = authService.getProfile();
        const isAdmin = user.role === 'system_admin' || user.originalRole === 'system_admin';
        const unitSelect = document.getElementById('rule-unit-select');
        
        // 1. 載入單位列表
        let units = [];
        if (isAdmin) {
            units = await UnitService.getAllUnits();
        } else {
            units = await UnitService.getUnitsByManager(user.uid);
            if(units.length === 0 && user.unitId) {
                const u = await UnitService.getUnitById(user.unitId);
                if(u) units.push(u);
            }
        }

        if (units.length === 0) {
            unitSelect.innerHTML = '<option value="">無權限</option>';
            unitSelect.disabled = true;
        } else {
            unitSelect.innerHTML = `<option value="" disabled selected>請選擇單位</option>` + 
                units.map(u => `<option value="${u.unitId}">${u.unitName}</option>`).join('');
            
            unitSelect.addEventListener('change', (e) => this.loadRules(e.target.value));
            
            // 自動選擇第一個
            if(units.length > 0) {
                unitSelect.value = units[0].unitId;
                this.loadRules(units[0].unitId);
            }
        }

        document.getElementById('btn-save-rules').addEventListener('click', () => this.saveRules());
    }

    async loadRules(unitId) {
        this.targetUnitId = unitId;
        const unit = await UnitService.getUnitById(unitId);
        if (!unit) return;

        // --- Tab 1: 硬性規定 (Hard Rules) ---
        const rules = unit.rules || {};
        // 這些是強制鎖定的，但我們還是要把 DB 的值讀回來(如果有的話)，雖然 UI 是 disabled checked
        // 實際上 UI 已經寫死 checked disabled，這裡主要是讀取那些"可調整"的參數
        document.getElementById('rule-min-consecutive').value = rules.minConsecutive || 1;
        document.getElementById('rule-max-work-days').value = rules.maxWorkDays || 6;
        document.getElementById('rule-max-night-consecutive').value = rules.maxNightConsecutive || 4;
        document.getElementById('rule-pre-night-off').checked = !!rules.preNightOff;


        // --- Tab 2: 人力需求 (Staff Req) ---
        const shifts = unit.settings?.shifts || [{code:'D', name:'白班'}, {code:'E', name:'小夜'}, {code:'N', name:'大夜'}];
        const reqs = unit.staffRequirements || {};
        
        let reqHtml = '';
        shifts.forEach(shift => {
            const code = shift.code;
            const name = shift.name;
            const rowReq = reqs[code] || {}; // {0:2, 1:3...}
            
            reqHtml += `<tr><td class="fw-bold bg-light">${name} (${code})</td>`;
            for(let d=0; d<=6; d++) {
                const val = rowReq[d] || 0;
                reqHtml += `<td><input type="number" class="form-control form-control-sm text-center req-input mx-auto" 
                              style="max-width: 60px;" min="0" value="${val}" data-shift="${code}" data-day="${d}"></td>`;
            }
            reqHtml += `</tr>`;
        });
        document.getElementById('staff-req-tbody').innerHTML = reqHtml;


        // --- Tab 3: AI 評分權重 (Scoring Config) ---
        // 1. 取得預設結構 (來自 ScoringService)
        const defaultConfig = ScoringService.getDefaultConfig();
        // 2. 取得單位儲存的設定 (若有)
        const savedConfig = unit.scoringConfig || {};
        
        // 3. 合併設定 (Deep Merge 概念)
        // 我們以 Default Config 為結構基礎，將 Saved Config 的數值填入
        this.currentConfig = JSON.parse(JSON.stringify(defaultConfig));
        
        Object.keys(this.currentConfig).forEach(catKey => {
            const cat = this.currentConfig[catKey];
            const savedCat = savedConfig[catKey];

            if (savedCat && savedCat.subs) {
                Object.keys(cat.subs).forEach(subKey => {
                    if (savedCat.subs[subKey]) {
                        const savedSub = savedCat.subs[subKey];
                        const targetSub = cat.subs[subKey];
                        // 覆蓋可變更的欄位
                        if (savedSub.weight !== undefined) targetSub.weight = savedSub.weight;
                        if (savedSub.enabled !== undefined) targetSub.enabled = savedSub.enabled;
                        if (savedSub.tiers) targetSub.tiers = savedSub.tiers;
                        if (savedSub.excludeBatch !== undefined) targetSub.excludeBatch = savedSub.excludeBatch;
                    }
                });
            }
        });

        this.renderAIWeights();
    }

    renderAIWeights() {
        const container = document.getElementById('ai-weights-container');
        let html = '';

        Object.keys(this.currentConfig).forEach(catKey => {
            const cat = this.currentConfig[catKey];
            
            html += `
                <div class="mb-4">
                    <h6 class="fw-bold text-dark border-bottom pb-2 mb-3 bg-light p-2 rounded">${cat.label}</h6>
                    <div class="ps-2">
            `;

            Object.keys(cat.subs).forEach(subKey => {
                const sub = cat.subs[subKey];
                const isChecked = sub.enabled !== false ? 'checked' : ''; // 預設 true
                const weightVal = sub.weight || 0;

                html += `
                    <div class="row align-items-center mb-3 pb-3 border-bottom border-light">
                        <div class="col-md-5">
                            <div class="form-check form-switch">
                                <input class="form-check-input sub-enable" type="checkbox" id="enable-${catKey}-${subKey}" 
                                       data-cat="${catKey}" data-sub="${subKey}" ${isChecked}>
                                <label class="form-check-label fw-bold" for="enable-${catKey}-${subKey}">${sub.label}</label>
                            </div>
                            <div class="text-muted small ms-4" style="font-size: 0.8rem;">${sub.desc}</div>
                        </div>
                        <div class="col-md-3">
                            <label class="small text-muted mb-1">權重 (分數)</label>
                            <input type="number" class="form-control form-control-sm sub-weight" 
                                   data-cat="${catKey}" data-sub="${subKey}" value="${weightVal}" min="0" max="100">
                        </div>
                        <div class="col-md-4 text-end">
                            ${sub.tiers ? `
                                <button class="btn btn-sm btn-outline-info" onclick="window.routerPage.openTiersModal('${catKey}', '${subKey}')">
                                    <i class="fas fa-sliders-h"></i> 設定等級
                                </button>
                            ` : '<span class="text-muted small">無細項設定</span>'}
                        </div>
                    </div>
                `;
            });

            html += `</div></div>`;
        });

        container.innerHTML = html;
        this.bindAIWeightEvents();
    }

    bindAIWeightEvents() {
        // 綁定權重輸入與開關事件，即時更新 currentConfig (暫存)
        document.querySelectorAll('.sub-weight').forEach(input => {
            input.addEventListener('change', (e) => {
                const { cat, sub } = e.target.dataset;
                this.currentConfig[cat].subs[sub].weight = parseInt(e.target.value) || 0;
            });
        });

        document.querySelectorAll('.sub-enable').forEach(input => {
            input.addEventListener('change', (e) => {
                const { cat, sub } = e.target.dataset;
                this.currentConfig[cat].subs[sub].enabled = e.target.checked;
            });
        });
    }

    openTiersModal(catKey, subKey) {
        this.activeModalTarget = { catKey, subKey };
        const subItem = this.currentConfig[catKey].subs[subKey];
        const tiers = subItem.tiers; // Array of objects { limit, score, label }

        const modalBody = document.getElementById('tiers-modal-body');
        document.getElementById('tiers-modal-desc').textContent = `${subItem.label} - 設定分數對照表`;

        let html = '<div class="table-responsive"><table class="table table-sm text-center"><thead><tr><th>門檻值 (<=)</th><th>得分</th><th>標籤</th></tr></thead><tbody>';
        
        tiers.forEach((tier, index) => {
            // 最後一階通常是 999 (Infinity)，顯示為 "其他"
            const isLast = tier.limit >= 999;
            const limitDisplay = isLast ? '其他 ( > 前一階)' : tier.limit;
            const limitInput = isLast ? 
                `<input type="hidden" class="tier-limit" value="999"> <span class="text-muted">Max</span>` : 
                `<input type="number" class="form-control form-control-sm tier-limit" value="${tier.limit}" step="0.1">`;

            html += `
                <tr data-index="${index}">
                    <td>${limitInput}</td>
                    <td><input type="number" class="form-control form-control-sm tier-score" value="${tier.score}"></td>
                    <td><input type="text" class="form-control form-control-sm tier-label" value="${tier.label}"></td>
                </tr>
            `;
        });
        html += '</tbody></table></div>';
        
        // 額外選項：排除包班
        if (subItem.excludeBatch !== undefined) {
            const checked = subItem.excludeBatch ? 'checked' : '';
            html += `
                <div class="form-check mt-3 pt-2 border-top">
                    <input class="form-check-input" type="checkbox" id="tier-exclude-batch" ${checked}>
                    <label class="form-check-label">包班人員不計入此指標 (避免差異過大)</label>
                </div>
            `;
        }

        modalBody.innerHTML = html;
        this.tiersModal.show();
    }

    saveTiers() {
        if (!this.activeModalTarget) return;
        const { catKey, subKey } = this.activeModalTarget;
        const subItem = this.currentConfig[catKey].subs[subKey];
        
        const newTiers = [];
        const rows = document.querySelectorAll('#tiers-modal-body tr[data-index]');
        
        rows.forEach(row => {
            const limit = parseFloat(row.querySelector('.tier-limit').value);
            const score = parseInt(row.querySelector('.tier-score').value) || 0;
            const label = row.querySelector('.tier-label').value;
            newTiers.push({ limit, score, label });
        });
        
        // 排序 tiers 確保 limit 由小到大 (除了 999)
        newTiers.sort((a, b) => a.limit - b.limit);

        subItem.tiers = newTiers;

        // 儲存額外選項
        const excludeCheck = document.getElementById('tier-exclude-batch');
        if (excludeCheck) {
            subItem.excludeBatch = excludeCheck.checked;
        }

        this.tiersModal.hide();
    }


    async saveRules() {
        const btn = document.getElementById('btn-save-rules');
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> 儲存中...';

        try {
            // 1. 收集硬性規則 (包含鎖定與未鎖定的)
            const rules = {
                // 鎖定項目 (直接寫死 true/fixed value)
                minInterval11: true,
                maternityProtect: true,
                maxShiftTypesWeekly: 2, 
                // 可調整項目
                minConsecutive: parseInt(document.getElementById('rule-min-consecutive').value),
                maxWorkDays: parseInt(document.getElementById('rule-max-work-days').value),
                maxNightConsecutive: parseInt(document.getElementById('rule-max-night-consecutive').value),
                preNightOff: document.getElementById('rule-pre-night-off').checked
            };

            // 2. 收集人力需求
            const reqs = {}; 
            // 初始化結構
            document.querySelectorAll('.req-input').forEach(input => {
                const shift = input.dataset.shift;
                if(!reqs[shift]) reqs[shift] = {};
            });
            // 填入數值
            document.querySelectorAll('.req-input').forEach(input => {
                const shift = input.dataset.shift;
                const day = input.dataset.day;
                reqs[shift][day] = parseInt(input.value) || 0;
            });

            // 3. 收集 AI 權重 (this.currentConfig 已經在 input change 時同步更新了，直接用)
            // 這裡直接使用 this.currentConfig

            // 4. 寫入資料庫
            await UnitService.updateUnit(this.targetUnitId, { 
                rules: rules,
                staffRequirements: reqs,
                scoringConfig: this.currentConfig
            });
            alert('✅ 設定已成功儲存！');
        } catch(e) { 
            console.error(e); 
            alert('儲存失敗: ' + e.message); 
        } finally { 
            btn.disabled = false; 
            btn.innerHTML = '<i class="fas fa-save"></i> 儲存所有設定';
        }
    }
}
