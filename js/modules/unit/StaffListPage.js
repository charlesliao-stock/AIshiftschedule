import { userService } from "../../services/firebase/UserService.js";
import { UnitService } from "../../services/firebase/UnitService.js";
import { authService } from "../../services/firebase/AuthService.js";
import { StaffListTemplate } from "./templates/StaffListTemplate.js";
// 引入 Firestore 方法以執行內建修復工具
import { collection, getDocs, writeBatch, doc, deleteField } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { firebaseService } from "../../services/firebase/FirebaseService.js";

export class StaffListPage {
    constructor() {
        this.staffList = [];
        this.displayList = [];
        this.currentUser = null;
        this.editModal = null;
        this.sortConfig = { key: 'staffCode', direction: 'asc' };
    }

    async render() {
        let retries = 0;
        while (!authService.getProfile() && retries < 10) { await new Promise(r => setTimeout(r, 200)); retries++; }
        this.currentUser = authService.getProfile();
        
        let unitOptionsHtml = '<option value="">載入中...</option>';
        let isSelectDisabled = false;

        try {
            let units = [];
            if (this.currentUser.isImpersonating) {
                if (this.currentUser.unitId) {
                    const u = await UnitService.getUnitById(this.currentUser.unitId);
                    if(u) units = [u];
                }
                isSelectDisabled = true;
            }
            else if (this.currentUser.role === 'system_admin') {
                units = await UnitService.getAllUnits();
            } 
            else {
                units = await UnitService.getUnitsByManager(this.currentUser.uid);
                if(units.length === 0 && this.currentUser.unitId) {
                    const u = await UnitService.getUnitById(this.currentUser.unitId);
                    if(u) units.push(u);
                }
            }

            if (units.length === 0) {
                unitOptionsHtml = '<option value="">無權限</option>';
            } else {
                unitOptionsHtml = units.map(u => 
                    `<option value="${u.unitId}">${u.unitName} (${u.unitCode || '-'})</option>`
                ).join('');
            }

            const isRealAdmin = (this.currentUser.role === 'system_admin' && !this.currentUser.isImpersonating);
            
            // 取得 HTML
            let html = StaffListTemplate.renderLayout(unitOptionsHtml, isRealAdmin, isSelectDisabled);
            
            // ✅ [工具] 插入「資料修復按鈕」，點此按鈕可解決 undefined 問題
            if (isRealAdmin) {
                const migrationBtn = `<button id="btn-migration" class="btn btn-warning text-dark fw-bold ms-2"><i class="fas fa-wrench"></i> 修復資料庫欄位</button>`;
                html = html.replace('新增人員\n                        </button>', '新增人員</button>' + migrationBtn);
            }
            
            return html;

        } catch (e) {
            console.error(e);
            return `<div class="alert alert-danger m-3">載入失敗: ${e.message}</div>`;
        }
    }

    async afterRender() {
        // ✅ 1. 最優先綁定 Router，防止按鈕找不到 window.routerPage
        window.routerPage = this;

        // ✅ 2. 初始化 Modal
        const modalElement = document.getElementById('edit-staff-modal');
        if (modalElement) {
            this.editModal = new bootstrap.Modal(modalElement);
        }

        // ✅ 3. 處理下拉選單預設值
        const unitSelect = document.getElementById('unit-filter');
        let targetUnitId = null;

        if (this.currentUser.isImpersonating) {
            targetUnitId = this.currentUser.unitId;
        } else if (unitSelect && unitSelect.options.length > 0) {
             targetUnitId = unitSelect.value || unitSelect.options[0].value;
        }

        if (unitSelect && targetUnitId) {
            unitSelect.value = targetUnitId;
        }

        // ✅ 4. 綁定事件
        unitSelect?.addEventListener('change', (e) => this.loadData(e.target.value));
        
        document.getElementById('btn-add-staff')?.addEventListener('click', () => { window.location.hash = '/unit/staff/create'; });
        document.getElementById('keyword-search')?.addEventListener('input', (e) => { this.filterData(e.target.value); });
        document.getElementById('btn-save')?.addEventListener('click', () => this.saveEdit());
        
        // 綁定修復工具按鈕
        document.getElementById('btn-migration')?.addEventListener('click', () => this.runMigration());

        document.querySelectorAll('th[data-sort]').forEach(th => { th.addEventListener('click', () => this.handleSort(th.dataset.sort)); });

        // ✅ 5. [關鍵] 使用事件委派 (Event Delegation) 處理編輯/刪除按鈕
        // 這樣可以避免因為表格重新渲染導致按鈕事件遺失
        const tbody = document.getElementById('staff-tbody');
        tbody?.addEventListener('click', (e) => {
            // 往上尋找是否點擊了帶有特定 class 的按鈕
            const editBtn = e.target.closest('.btn-edit-staff');
            const deleteBtn = e.target.closest('.btn-delete-staff');
            
            if (editBtn) {
                const uid = editBtn.dataset.uid;
                this.openEditModal(uid);
            } else if (deleteBtn) {
                const uid = deleteBtn.dataset.uid;
                this.deleteStaff(uid);
            }
        });

        // 載入資料
        if (targetUnitId) await this.loadData(targetUnitId);
    }

    async loadData(unitId) {
        if(!unitId || unitId === 'undefined') return;
        const tbody = document.getElementById('staff-tbody');
        tbody.innerHTML = '<tr><td colspan="7" class="text-center py-4"><div class="spinner-border text-primary"></div></td></tr>';

        try {
            this.staffList = await userService.getUsersByUnit(unitId);
            this.applySort(); 
        } catch (e) { console.error(e); }
    }

    handleSort(key) {
        this.sortConfig.key = key; 
        this.sortConfig.direction = this.sortConfig.direction === 'asc' ? 'desc' : 'asc'; 
        this.applySort();
    }

    applySort() {
        if (!this.staffList) this.staffList = [];
        this.displayList = [...this.staffList].sort((a, b) => {
            let valA = a[this.sortConfig.key] || '';
            let valB = b[this.sortConfig.key] || '';
            return this.sortConfig.direction === 'asc' ? (valA > valB ? 1 : -1) : (valA < valB ? 1 : -1);
        });
        this.renderTable();
    }

    filterData(keyword) {
        if (!keyword) { this.applySort(); return; }
        const k = keyword.toLowerCase();
        this.displayList = this.staffList.filter(s => 
            (s.staffName && s.staffName.toLowerCase().includes(k)) || 
            (s.staffCode && String(s.staffCode).toLowerCase().includes(k))
        );
        this.renderTable();
    }

    renderTable() {
        const tbody = document.getElementById('staff-tbody');
        if(!tbody) return;
        const isRealAdmin = (this.currentUser.role === 'system_admin' && !this.currentUser.isImpersonating);
        // 使用 Template 渲染
        tbody.innerHTML = StaffListTemplate.renderRows(this.displayList, isRealAdmin);
    }
    
    // 開啟編輯視窗
    openEditModal(uid) {
        const user = this.staffList.find(u => u.uid === uid);
        if(!user) return;
        
        document.getElementById('edit-uid').value = uid;
        // ✅ 讀取資料
        document.getElementById('edit-staffName').value = user.staffName || '';
        document.getElementById('edit-staffCode').value = user.staffCode || '';
        
        document.getElementById('edit-email').value = user.email || '';
        document.getElementById('edit-title').value = user.title || 'N';
        document.getElementById('edit-level').value = user.level || 'N0';
        document.getElementById('edit-is-manager').checked = (user.role === 'unit_manager');
        document.getElementById('edit-is-scheduler').checked = (user.role === 'unit_scheduler');

        const c = user.constraints || {};
        document.getElementById('edit-isPregnant').checked = !!c.isPregnant;
        document.getElementById('edit-isPostpartum').checked = !!c.isPostpartum;
        document.getElementById('edit-canBatch').checked = !!c.canBatch;
        document.getElementById('edit-maxConsecutive').value = c.maxConsecutive || 6;
        document.getElementById('edit-maxConsecutiveNights').value = c.maxConsecutiveNights || 4;

        this.editModal.show();
    }

    // 儲存編輯
    async saveEdit() {
        const uid = document.getElementById('edit-uid').value;
        const btn = document.getElementById('btn-save');
        
        const data = {
            // ✅ 寫入資料
            staffName: document.getElementById('edit-staffName').value,
            staffCode: document.getElementById('edit-staffCode').value,
            
            title: document.getElementById('edit-title').value,
            level: document.getElementById('edit-level').value,
            role: document.getElementById('edit-is-manager').checked ? 'unit_manager' : 
                  (document.getElementById('edit-is-scheduler').checked ? 'unit_scheduler' : 'user'),
            constraints: {
                isPregnant: document.getElementById('edit-isPregnant').checked,
                isPostpartum: document.getElementById('edit-isPostpartum').checked,
                canBatch: document.getElementById('edit-canBatch').checked,
                maxConsecutive: parseInt(document.getElementById('edit-maxConsecutive').value) || 6,
                maxConsecutiveNights: parseInt(document.getElementById('edit-maxConsecutiveNights').value) || 4
            }
        };

        btn.disabled = true;
        try {
            await userService.updateUser(uid, data);
            alert("✅ 修改成功");
            this.editModal.hide();
            const unitSelect = document.getElementById('unit-filter');
            if(unitSelect) this.loadData(unitSelect.value);
        } catch(e) {
            alert("錯誤: " + e.message);
        } finally {
            btn.disabled = false;
        }
    }
    
    async deleteStaff(uid) {
        if(confirm("確定刪除此人員？")) {
            try {
                await userService.deleteStaff(uid);
                alert("已刪除");
                const currentUnitId = document.getElementById('unit-filter').value;
                this.loadData(currentUnitId);
            } catch(e) { alert("刪除失敗"); }
        }
    }

    // ✅ 資料庫修復邏輯
    async runMigration() {
        if(!confirm("確定要執行資料庫欄位升級嗎？\n這將把 name/staffId 轉換為 staffName/staffCode，並刪除舊欄位。")) return;
        
        const btn = document.getElementById('btn-migration');
        btn.disabled = true;
        btn.innerHTML = "⏳ 處理中...";

        try {
            const db = firebaseService.getDb();
            const usersRef = collection(db, "users");
            const snapshot = await getDocs(usersRef);
            const batch = writeBatch(db);
            let count = 0;

            snapshot.forEach((docSnap) => {
                const data = docSnap.data();
                const ref = doc(db, "users", docSnap.id);
                const updates = {};
                let needsUpdate = false;

                // 遷移 name -> staffName
                if (data.name !== undefined) {
                    if (!data.staffName) updates.staffName = data.name;
                    updates.name = deleteField();
                    needsUpdate = true;
                }
                // 遷移 staffId -> staffCode
                if (data.staffId !== undefined) {
                    if (!data.staffCode) updates.staffCode = data.staffId;
                    updates.staffId = deleteField();
                    needsUpdate = true;
                }
                
                if (needsUpdate) {
                    batch.update(ref, updates);
                    count++;
                }
            });

            if (count > 0) {
                await batch.commit();
                alert(`🎉 成功修復 ${count} 筆資料！頁面將重新整理。`);
                window.location.reload();
            } else {
                alert("✨ 資料庫已經是最新狀態，無需修復。");
            }
        } catch (e) {
            console.error(e);
            alert("❌ 修復失敗: " + e.message);
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-wrench"></i> 修復資料庫欄位';
        }
    }
}
