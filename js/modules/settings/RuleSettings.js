import { UnitService } from "../../services/firebase/UnitService.js";
import { authService } from "../../services/firebase/AuthService.js";
import { ScoringService } from "../../services/ScoringService.js"; 

export class RuleSettings {
    constructor() { 
        this.targetUnitId = null; 
        this.currentConfig = null; 
        this.activeModalSubKey = null; 
        this.tiersModal = null; // 儲存 Modal 實例
    }

    async render() {
        return `
            <div class="container-fluid mt-4">
                <div class="mb-3">
                    <h3 class="text-gray-800 fw-bold"><i class="fas fa-ruler-combined"></i> 規則與評分設定</h3>
                    <p class="text-muted small mb-0">設定每日人力需求、勞基法規範及排班品質評分權重。</p>
                </div>

                <div class="card shadow-sm mb-4 border-left-primary">
                    <div class="card-body py-2 d-flex align-items-center gap-2">
                        <label class="fw-bold mb-0 text-nowrap">選擇單位：</label>
                        <select id="rule-unit-select" class="form-select w-auto"><option value="">載入中...</option></select>
                        <div class="ms-auto">
                            <button id="btn-save-rules" class="btn btn-primary w-auto shadow-sm"><i class="fas fa-save"></i> 儲存設定</button>
                        </div>
                    </div>
                </div>

                <div class="row">
                    <div class="col-lg-6">
                        <div class="card shadow mb-4">
                            <div class="card-header py-3 bg-white border-bottom-danger">
                                <h6 class="m-0 font-weight-bold text-danger"><i class="fas fa-gavel"></i> 硬性規則 (違反視為不合法)</h6>
                            </div>
                            <div class="card-body">
                                <div class="mb-3 form-check form-switch">
                                    <input class="form-check-input" type="checkbox" id="rule-min-interval-11">
                                    <label class="form-check-label fw-bold">班距必須大於 11 小時</label>
                                    <div class="form-text small">防止接班過於緊湊 (如 N 接 D)。</div>
                                </div>
                                
                                <div class="mb-3">
                                    <label class="form-label fw-bold">每月最多幾種班別 (Shift Types)</label>
                                    <input type="number" id="rule-max-shift-types" class="form-control" value="2" min="1" max="5">
                                    <div class="form-text small">例如設為 2，則一個人當月只能排 D/E 或 E/N，不能 D/E/N 全包。</div>
                                </div>

                                <div class="mb-3 form-check form-switch">
                                    <input class="form-check-input" type="checkbox" id="rule-pre-night-off">
                                    <label class="form-check-label fw-bold">大夜班前一天必須 OFF</label>
                                </div>

                                <div class="row">
                                    <div class="col-md-6 mb-3">
                                        <label class="form-label fw-bold">最少連續上班天數</label>
                                        <input type="number" id="rule-min-consecutive" class="form-control" value="1" min="1">
                                    </div>
                                    <div class="col-md-6 mb-3">
                                        <label class="form-label fw-bold">最大連續上班天數</label>
                                        <input type="number" id="rule-max-work-days" class="form-control" value="6" min="1" max="12">
                                        <div class="form-text small">勞基法通常建議不超過 6 或 7 天。</div>
                                    </div>
                                </div>

                                <div class="mb-3">
                                    <label class="form-label fw-bold">連續夜班上限 (天)</label>
                                    <input type="number" id="rule-max-night-consecutive" class="form-control" value="4" min="1">
                                    <div class="form-text small">避免長期夜班影響健康。</div>
                                </div>
                            </div>
                        </div>

                        <div class="card shadow mb-4">
                            <div class="card-header py-3 bg-white">
                                <h6 class="m-0 font-weight-bold text-primary"><i class="fas fa-users"></i> 每日人力需求 (低於此數將扣分/警告)</h6>
                            </div>
                            <div class="card-body p-0">
                                <div class="table-responsive">
                                    <table class="table table-sm table-bordered text-center mb-0" style="font-size: 0.9rem;">
                                        <thead class="table-light">
                                            <tr>
                                                <th>班別</th>
                                                <th>日</th><th>一</th><th>二</th><th>三</th><th>四</th><th>五</th><th>六</th>
                                            </tr>
                                        </thead>
                                        <tbody id="staff-req-tbody">
                                            <tr><td colspan="8" class="text-muted p-3">請先選擇單位以載入班別設定</td></tr>
                                        </tbody>
                                    </table>
                                </div>
                                <div class="p-2 small text-muted text-end">
                                    數字為「該班別最少所需人數」。
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="col-lg-6">
                        <div class="card shadow mb-4">
                            <div class="card-header py-3 bg-white">
                                <div class="d-flex justify-content-between align-items-center">
                                    <h6 class="m-0 font-weight-bold text-success"><i class="fas fa-balance-scale"></i> AI 評分權重 (總分 100)</h6>
                                    <span id="total-weight-display" class="badge bg-secondary">總和: 0</span>
                                </div>
                            </div>
                            <div class="card-body" id="scoring-weights-container">
                                <div class="text-center p-3">載入中...</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="modal fade" id="tiers-modal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title fw-bold">設定階級評分參數</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body" id="tiers-modal-body">
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
        // 設定 Modal 實例
        this.tiersModal = new bootstrap.Modal(document.getElementById('tiers-modal'));
        // 綁定 window.routerPage 方便 Modal 呼叫
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
        
        // 綁定權重輸入變更事件，即時計算總分
        document.getElementById('scoring-weights-container').addEventListener('input', (e) => {
           if(e.target.classList.contains('weight-input')) {
               this.updateTotalWeightDisplay();
           } 
        });
    }

    async loadRules(unitId) {
        this.targetUnitId = unitId;
        const unit = await UnitService.getUnitById(unitId);
        if (!unit) return;

        // 1. 載入硬性規則
        const rules = unit.rules || {};
        document.getElementById('rule-min-interval-11').checked = !!rules.minInterval11;
        document.getElementById('rule-max-shift-types').value = rules.maxShiftTypes || 2;
        document.getElementById('rule-pre-night-off').checked = !!rules.preNightOff;
        document.getElementById('rule-min-consecutive').value = rules.minConsecutive || 1;
        document.getElementById('rule-max-work-days').value = rules.maxWorkDays || 6;
        document.getElementById('rule-max-night-consecutive').value = rules.maxNightConsecutive || 4;

        // 2. ✅ 修正：動態生成人力需求表格 (來自班別設定)
        const shifts = unit.settings?.shifts || [{code:'D', name:'白班'}, {code:'E', name:'小夜'}, {code:'N', name:'大夜'}];
        const reqs = unit.staffRequirements || {};
        
        let reqHtml = '';
        shifts.forEach(shift => {
            const code = shift.code;
            const name = shift.name;
            const rowReq = reqs[code] || {}; // {0:2, 1:3...}
            
            reqHtml += `<tr><td class="fw-bold">${name} (${code})</td>`;
            
            // 0=Sun ... 6=Sat
            for(let d=0; d<=6; d++) {
                const val = rowReq[d] || 0;
                reqHtml += `<td><input type="number" class="form-control form-control-sm text-center req-input p-0" 
                              style="height: 24px;" min="0" value="${val}" data-shift="${code}" data-day="${d}"></td>`;
            }
            reqHtml += `</tr>`;
        });
        document.getElementById('staff-req-tbody').innerHTML = reqHtml;


        // 3. 載入評分權重 (使用 ScoringService 的 config 結構)
        // 這裡我們將 UI 的顯示與 scoringConfig 結合
        // 如果單位有儲存自訂權重，則覆蓋預設值
        const defaultConfig = ScoringService.getDefaultConfig();
        const savedConfig = unit.scoringConfig || {};
        
        // 合併設定
        this.currentConfig = JSON.parse(JSON.stringify(defaultConfig));
        
        // 遞迴合併 savedConfig 到 currentConfig
        Object.keys(savedConfig).forEach(catKey => {
           if(this.currentConfig[catKey]) {
               if(savedConfig[catKey].weight !== undefined) this.currentConfig[catKey].weight = savedConfig[catKey].weight;
               // 合併 items
               if(savedConfig[catKey].items) {
                   savedConfig[catKey].items.forEach(savedItem => {
                       const targetItem = this.currentConfig[catKey].items.find(i => i.key === savedItem.key);
                       if(targetItem) {
                           targetItem.defaultWeight = savedItem.defaultWeight;
                           // 其他屬性如 tiers
                           if(savedItem.tiers) targetItem.tiers = savedItem.tiers;
                           if(savedItem.excludeBatch !== undefined) targetItem.excludeBatch = savedItem.excludeBatch;
                       }
                   });
               }
           } 
        });

        this.renderScoringUI();
        this.updateTotalWeightDisplay();
    }

    renderScoringUI() {
        const container = document.getElementById('scoring-weights-container');
        let html = '';

        Object.keys(this.currentConfig).forEach(catKey => {
            const cat = this.currentConfig[catKey];
            html += `
                <div class="mb-4 border-bottom pb-3">
                    <div class="d-flex justify-content-between align-items-center mb-2">
                        <label class="fw-bold text-dark">${cat.label} (類別權重)</label>
                        <input type="number" class="form-control form-control-sm w-25 weight-input category-weight" 
                               data-cat="${catKey}" value="${cat.weight}" min="0" max="100">
                    </div>
                    
                    <div class="ps-3 border-start border-3">
                        ${cat.items.map((item, idx) => `
                            <div class="mb-3">
                                <div class="d-flex justify-content-between align-items-center">
                                    <span class="small fw-bold">${item.label}</span>
                                    <div class="d-flex gap-2">
                                        ${item.key === 'seniority' ? 
                                            `<button class="btn btn-sm btn-outline-info py-0" style="font-size:0.7rem" 
                                              onclick="window.routerPage.openTiersModal('${catKey}', ${idx})">設定階級參數</button>` : ''}
                                        <input type="number" class="form-control form-control-sm w-25 item-weight" 
                                               data-cat="${catKey}" data-idx="${idx}" value="${item.defaultWeight}">
                                    </div>
                                </div>
                                <div class="form-text small mt-0" style="font-size: 0.75rem;">${item.desc}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;
    }

    updateTotalWeightDisplay() {
        let total = 0;
        document.querySelectorAll('.category-weight').forEach(input => {
            total += parseInt(input.value) || 0;
        });
        const badge = document.getElementById('total-weight-display');
        badge.textContent = `總和: ${total}`;
        badge.className = `badge ${total === 100 ? 'bg-success' : 'bg-warning text-dark'}`;
    }

    openTiersModal(catKey, itemIdx) {
        this.activeModalSubKey = { catKey, itemIdx };
        const item = this.currentConfig[catKey].items[itemIdx];
        const body = document.getElementById('tiers-modal-body');
        
        let tiersHtml = '';
        const tiers = item.tiers || { N0: 0, N1: 10, N2: 20, N3: 30, N4: 40 }; // 預設值
        
        Object.keys(tiers).forEach(tier => {
            tiersHtml += `
                <div class="input-group input-group-sm mb-2">
                    <span class="input-group-text">${tier}</span>
                    <input type="number" class="form-control tier-input" data-tier="${tier}" value="${tiers[tier]}">
                </div>
            `;
        });
        
        // 額外選項：是否排除包班者
        const excludeChecked = item.excludeBatch ? 'checked' : '';
        tiersHtml += `
            <div class="form-check mt-3 border-top pt-2">
                <input class="form-check-input" type="checkbox" id="tier-exclude-batch" ${excludeChecked}>
                <label class="form-check-label">包班者不計入此評分 (通常用於資深包班)</label>
            </div>
        `;

        body.innerHTML = tiersHtml;
        this.tiersModal.show();
    }

    saveTiers() {
        const { catKey, itemIdx } = this.activeModalSubKey;
        const item = this.currentConfig[catKey].items[itemIdx];
        
        const newTiers = {};
        document.querySelectorAll('.tier-input').forEach(input => {
            newTiers[input.dataset.tier] = parseInt(input.value) || 0;
        });
        item.tiers = newTiers;
        
        const isChecked = document.getElementById('tier-exclude-batch').checked;
        item.excludeBatch = isChecked;

        this.tiersModal.hide();
    }

    async saveRules() {
        const btn = document.getElementById('btn-save-rules');
        btn.disabled = true;
        try {
            // 1. 收集 UI 上的 Config 變更回 this.currentConfig
            document.querySelectorAll('.category-weight').forEach(input => {
                this.currentConfig[input.dataset.cat].weight = parseInt(input.value) || 0;
            });
            document.querySelectorAll('.item-weight').forEach(input => {
                const cat = input.dataset.cat;
                const idx = parseInt(input.dataset.idx);
                this.currentConfig[cat].items[idx].defaultWeight = parseInt(input.value) || 0;
            });

            this.updateTotalWeightDisplay();
            
            // 2. 收集硬性規則
            const rules = {
                minInterval11: document.getElementById('rule-min-interval-11').checked,
                maxShiftTypes: parseInt(document.getElementById('rule-max-shift-types').value),
                preNightOff: document.getElementById('rule-pre-night-off').checked,
                minConsecutive: parseInt(document.getElementById('rule-min-consecutive').value),
                maxNightConsecutive: parseInt(document.getElementById('rule-max-night-consecutive').value),
                maxWorkDays: parseInt(document.getElementById('rule-max-work-days').value)
            };

            // 3. 收集人力需求 (動態班別)
            const reqs = {}; // { D: {0:2, 1:3}, E: {...} }
            
            // 先確保所有班別都有 key
            document.querySelectorAll('.req-input').forEach(input => {
                const shift = input.dataset.shift;
                if(!reqs[shift]) reqs[shift] = {};
            });

            document.querySelectorAll('.req-input').forEach(input => {
                const shift = input.dataset.shift;
                const day = parseInt(input.dataset.day);
                reqs[shift][day] = parseInt(input.value) || 0;
            });

            // 4. 寫入資料庫
            await UnitService.updateUnit(this.targetUnitId, { 
                scoringConfig: this.currentConfig,
                rules: rules,
                staffRequirements: reqs
            });
            alert('✅ 設定已儲存');
        } catch(e) { console.error(e); alert('儲存失敗'); }
        finally { btn.disabled = false; }
    }
}
