import { UnitService } from "../../services/firebase/UnitService.js";
import { authService } from "../../services/firebase/AuthService.js";
import { ScoringService } from "../../services/ScoringService.js"; 

export class RuleSettings {
    constructor() { 
        this.targetUnitId = null; 
        this.currentConfig = null; 
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
                    <li class="nav-item" role="presentation"><button class="nav-link active" id="basic-tab" data-bs-toggle="tab" data-bs-target="#basic" type="button">基本限制</button></li>
                    <li class="nav-item" role="presentation"><button class="nav-link" id="manpower-tab" data-bs-toggle="tab" data-bs-target="#manpower" type="button">人力需求</button></li>
                    <li class="nav-item" role="presentation"><button class="nav-link" id="ai-tab" data-bs-toggle="tab" data-bs-target="#ai" type="button">AI 評分權重</button></li>
                </ul>

                <div class="tab-content" id="ruleSettingsTabsContent">
                    <div class="tab-pane fade show active" id="basic">
                        <div class="card shadow-sm mb-4">
                            <div class="card-body">
                                <div class="mb-4 p-3 border rounded bg-light-subtle">
                                    <div class="form-check form-switch mb-2">
                                        <input class="form-check-input" type="checkbox" id="rule-flexible-mode">
                                        <label class="form-check-label fw-bold" for="rule-flexible-mode">開啟「變形工時模式」</label>
                                    </div>
                                    <div id="flexible-settings-area" style="display:none;" class="ms-4">
                                        <label class="form-label fw-bold">最大連續上班天數上限</label>
                                        <div class="d-flex align-items-center gap-2 mb-2">
                                            <input type="number" id="rule-max-flex" class="form-control" style="max-width: 100px;" value="9">
                                            <span class="text-muted">天</span>
                                            <div class="input-group input-group-sm w-auto ms-3">
                                                <span class="input-group-text bg-white">本月紅字約</span>
                                                <input type="number" id="temp-holiday-count" class="form-control text-center" style="max-width: 60px;" value="8">
                                                <span class="input-group-text bg-white">天</span>
                                                <button class="btn btn-outline-success" type="button" id="btn-suggest-days">試算</button>
                                            </div>
                                        </div>
                                        <div class="form-text text-muted" id="suggestion-msg"></div>
                                    </div>
                                </div>
                                <hr>
                                <div class="row g-3">
                                    <div class="col-md-6"><label class="form-label fw-bold">一般連續上班上限</label><input type="number" id="rule-max-work-days" class="form-control" value="6" readonly disabled></div>
                                    <div class="col-md-6"><label class="form-label fw-bold">連續夜班上限</label><input type="number" id="rule-max-night-consecutive" class="form-control" value="4"></div>
                                    <div class="col-md-6"><label class="form-label fw-bold">班別最小間隔 (分鐘)</label><input type="number" id="rule-min-interval" class="form-control" value="660"></div>
                                    <div class="col-md-6"><div class="form-check mt-4"><input class="form-check-input" type="checkbox" id="rule-pre-night-off"><label class="form-check-label fw-bold" for="rule-pre-night-off">大夜班 (N) 前一天必須是 OFF 或 N</label></div></div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="tab-pane fade" id="manpower">
                         <div class="card shadow-sm"><div class="card-body"><div class="table-responsive"><table class="table table-bordered text-center"><thead class="table-light"><tr><th>班別</th><th class="text-danger">週日</th><th>週一</th><th>週二</th><th>週三</th><th>週四</th><th>週五</th><th class="text-danger">週六</th></tr></thead><tbody id="manpower-tbody"></tbody></table></div></div></div>
                    </div>
                    <div class="tab-pane fade" id="ai">
                         <div id="ai-scoring-container">載入中...</div>
                    </div>
                </div>
            </div>`;
    }

    async afterRender() {
        const user = authService.getProfile();
        const unitSelect = document.getElementById('rule-unit-select');
        
        let availableUnits = [];
        
        // --- 關鍵修改：模擬狀態鎖定 ---
        if (user.isImpersonating) {
            if (user.unitId) {
                const u = await UnitService.getUnitById(user.unitId);
                if(u) availableUnits = [u];
            }
            unitSelect.disabled = true;
        }
        else if (user.role === 'system_admin') {
            availableUnits = await UnitService.getAllUnits();
            unitSelect.disabled = false;
        } 
        else {
            availableUnits = await UnitService.getUnitsByManager(user.uid);
            if(availableUnits.length === 0 && user.unitId) {
                const u = await UnitService.getUnitById(user.unitId);
                if(u) availableUnits.push(u);
            }
            unitSelect.disabled = availableUnits.length <= 1;
        }

        if (availableUnits.length === 0) {
            unitSelect.innerHTML = '<option value="">無權限</option>';
            unitSelect.disabled = true;
            return;
        }

        unitSelect.innerHTML = availableUnits.map(u => `<option value="${u.unitId}">${u.unitName}</option>`).join('');
        
        if(this.targetUnitId) unitSelect.value = this.targetUnitId;
        else this.targetUnitId = unitSelect.value;

        unitSelect.addEventListener('change', (e) => this.loadRules(e.target.value));
        await this.loadRules(this.targetUnitId);

        document.getElementById('btn-save-rules').addEventListener('click', () => this.saveRules());
        
        const flexToggle = document.getElementById('rule-flexible-mode');
        const flexArea = document.getElementById('flexible-settings-area');
        flexToggle.addEventListener('change', (e) => {
            flexArea.style.display = e.target.checked ? 'block' : 'none';
        });

        document.getElementById('btn-suggest-days').addEventListener('click', () => {
             const holidays = parseInt(document.getElementById('temp-holiday-count').value) || 8;
             let suggestion = holidays >= 10 ? 9 : (holidays >= 8 ? 8 : 7);
             document.getElementById('rule-max-flex').value = suggestion;
             document.getElementById('suggestion-msg').innerHTML = `<span class="text-success fw-bold">建議上限: ${suggestion} 天</span>`;
        });
    }

    async loadRules(unitId) {
        this.targetUnitId = unitId;
        const unit = await UnitService.getUnitById(unitId);
        if(!unit) return;
        const rules = unit.settings?.rules || {};
        
        const isFlex = !!rules.flexibleWorkMode;
        document.getElementById('rule-flexible-mode').checked = isFlex;
        document.getElementById('flexible-settings-area').style.display = isFlex ? 'block' : 'none';
        document.getElementById('rule-max-flex').value = rules.maxConsecutiveWork_Flexible || 9;

        document.getElementById('rule-max-work-days').value = rules.maxConsecutiveWork || 6;
        document.getElementById('rule-max-night-consecutive').value = rules.maxConsecutiveNight || 4;
        document.getElementById('rule-min-interval').value = (rules.minInterval11 === false) ? 0 : 660; 
        document.getElementById('rule-pre-night-off').checked = !!rules.preNightOff;

        const shifts = unit.settings?.shifts || [];
        const manpowerBody = document.getElementById('manpower-tbody');
        manpowerBody.innerHTML = shifts.map(s => {
            const reqs = unit.settings?.staffRequirements?.[s.code] || {};
            const defVal = s.requiredManpower || 0;
            const renderInput = (d) => `<td><input type="number" class="form-control form-control-sm text-center req-input" data-shift="${s.code}" data-day="${d}" value="${reqs[d]!==undefined?reqs[d]:defVal}" min="0" style="width:60px;margin:auto;"></td>`;
            return `<tr><td><span class="badge" style="background-color:${s.color}">${s.code}</span></td>${[0,1,2,3,4,5,6].map(d=>renderInput(d)).join('')}</tr>`;
        }).join('');
        
        // 簡易顯示 AI 設定
        document.getElementById('ai-scoring-container').innerHTML = `<div class="alert alert-success">AI 權重設定已載入 (可於 ScoringService 調整)</div>`;
        this.currentConfig = unit.settings?.scoringConfig || ScoringService.getDefaultConfig();
    }

    async saveRules() {
        if(!this.targetUnitId) return;
        const btn = document.getElementById('btn-save-rules');
        btn.disabled = true;
        btn.innerHTML = '儲存中...';

        try {
            const rules = {
                flexibleWorkMode: document.getElementById('rule-flexible-mode').checked,
                maxConsecutiveWork_Flexible: parseInt(document.getElementById('rule-max-flex').value),
                maxConsecutiveWork: parseInt(document.getElementById('rule-max-work-days').value),
                maxConsecutiveNight: parseInt(document.getElementById('rule-max-night-consecutive').value),
                minInterval11: parseInt(document.getElementById('rule-min-interval').value) >= 600, 
                preNightOff: document.getElementById('rule-pre-night-off').checked
            };

            const reqs = {}; 
            document.querySelectorAll('.req-input').forEach(input => {
                const shift = input.dataset.shift;
                const day = input.dataset.day;
                if(!reqs[shift]) reqs[shift] = {};
                reqs[shift][day] = parseInt(input.value) || 0;
            });

            await UnitService.updateUnit(this.targetUnitId, { 
                "settings.rules": rules,
                "settings.staffRequirements": reqs,
                "settings.scoringConfig": this.currentConfig
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
