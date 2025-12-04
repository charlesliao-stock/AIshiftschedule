/**
 * js/modules/dashboard/dashboard.js
 * 系統儀表板 (Dashboard)
 */

import { Auth } from '../../core/auth.js';
import { Router } from '../../core/router.js';
import { UnitService } from '../../services/unit.service.js';
import { CONSTANTS } from '../../config/constants.js';
import { Loading } from '../../components/loading.js';

export const Dashboard = {
    async init() {
        console.log('[Dashboard] 初始化...');
        const container = document.getElementById('main-content');
        if (container) {
            container.innerHTML = '<div class="loader-spinner"></div>';
            await this.render(container);
        }
    },

    async render(container) {
        const user = Auth.getCurrentUser();
        const roleName = CONSTANTS.ROLE_NAMES[user.role] || user.role;
        
        // 根據角色決定顯示內容
        const isAdmin = user.role === CONSTANTS.ROLES.ADMIN;
        
        // 載入簡易統計 (非必要，若失敗不影響顯示)
        let stats = { units: 0, staff: 0 };
        if (isAdmin) {
            try {
                const units = await UnitService.getAllUnits();
                stats.units = units.length;
                // 這裡可以加載更多統計
            } catch (e) {
                console.warn('Dashboard stats load failed', e);
            }
        }

        container.innerHTML = `
            <div class="dashboard-container fade-in">
                <div class="welcome-section mb-4 p-4 bg-white rounded shadow-sm border-start border-4 border-primary">
                    <h2 class="mb-1">早安，${user.displayName || user.email} 👋</h2>
                    <p class="text-muted mb-0">
                        身分：<span class="badge bg-primary bg-opacity-10 text-primary">${roleName}</span> 
                        ${user.unit_name ? `| 單位：${user.unit_name}` : ''}
                    </p>
                </div>

                ${isAdmin ? `
                <div class="row g-3 mb-4">
                    <div class="col-md-3">
                        <div class="card border-0 shadow-sm h-100">
                            <div class="card-body d-flex align-items-center">
                                <div class="icon-box bg-primary bg-opacity-10 text-primary rounded-circle p-3 me-3">
                                    🏥
                                </div>
                                <div>
                                    <div class="text-muted small">護理單位</div>
                                    <div class="fs-4 fw-bold">${stats.units}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="card border-0 shadow-sm h-100">
                            <div class="card-body d-flex align-items-center">
                                <div class="icon-box bg-success bg-opacity-10 text-success rounded-circle p-3 me-3">
                                    ✅
                                </div>
                                <div>
                                    <div class="text-muted small">系統狀態</div>
                                    <div class="fs-4 fw-bold">正常運作</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                ` : ''}

                <h5 class="mb-3 text-secondary">快速功能</h5>
                <div class="row g-3">
                    <div class="col-md-4 col-sm-6">
                        <a href="/schedule-management" class="card text-decoration-none h-100 border-0 shadow-sm hover-card">
                            <div class="card-body text-center p-4">
                                <div class="fs-1 mb-3">🗓️</div>
                                <h5 class="card-title text-dark">排班管理</h5>
                                <p class="card-text text-muted small">檢視與編輯單位班表，執行 AI 自動排班。</p>
                            </div>
                        </a>
                    </div>

                    <div class="col-md-4 col-sm-6">
                        <a href="/pre-schedule" class="card text-decoration-none h-100 border-0 shadow-sm hover-card">
                            <div class="card-body text-center p-4">
                                <div class="fs-1 mb-3">📝</div>
                                <h5 class="card-title text-dark">預班需求</h5>
                                <p class="card-text text-muted small">填寫下個月的預班與休假需求。</p>
                            </div>
                        </a>
                    </div>

                    <div class="col-md-4 col-sm-6">
                        <a href="/statistics" class="card text-decoration-none h-100 border-0 shadow-sm hover-card">
                            <div class="card-body text-center p-4">
                                <div class="fs-1 mb-3">📊</div>
                                <h5 class="card-title text-dark">統計報表</h5>
                                <p class="card-text text-muted small">查看工時統計、積借休與班別分佈。</p>
                            </div>
                        </a>
                    </div>

                    ${isAdmin ? `
                    <div class="col-md-4 col-sm-6">
                        <a href="/settings" class="card text-decoration-none h-100 border-0 shadow-sm hover-card">
                            <div class="card-body text-center p-4">
                                <div class="fs-1 mb-3">⚙️</div>
                                <h5 class="card-title text-dark">系統設定</h5>
                                <p class="card-text text-muted small">管理班別、人員資料與勞基法規則。</p>
                            </div>
                        </a>
                    </div>
                    
                    <div class="col-md-4 col-sm-6">
                        <a href="/unit-maintenance" class="card text-decoration-none h-100 border-0 shadow-sm hover-card">
                            <div class="card-body text-center p-4">
                                <div class="fs-1 mb-3">🏥</div>
                                <h5 class="card-title text-dark">單位維護</h5>
                                <p class="card-text text-muted small">新增或編輯護理站單位與權限。</p>
                            </div>
                        </a>
                    </div>
                    ` : ''}
                </div>
            </div>

            <style>
                .hover-card { transition: transform 0.2s, box-shadow 0.2s; }
                .hover-card:hover { transform: translateY(-5px); box-shadow: 0 10px 20px rgba(0,0,0,0.1) !important; }
            </style>
        `;
        
        // 綁定連結事件 (透過 Router 全域監聽，這裡不需要額外綁定，只要 href 正確即可)
    }
};
