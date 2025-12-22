export const MainLayoutTemplate = {
    render(user, isRealAdmin, menuHtml, displayRoleName) {
        const displayName = user.name || user.displayName || '使用者';
        const isImpersonating = !!user.isImpersonating;
        
        // 🟥 上帝模式控制台 (僅真管理員可見)
        let adminControlHtml = '';
        if (isRealAdmin) {
            const searchPlaceholder = isImpersonating ? "🔍 切換其他角色..." : "🔍 搜尋並模擬...";
            const statusText = isImpersonating ? "模擬中" : "管理員";
            const unitText = isImpersonating ? `於 ${user.unitId || '全院'}` : '';

            adminControlHtml = `
                <div class="d-flex align-items-center bg-white border rounded-pill px-3 py-1 shadow-sm me-3" style="border: 2px solid #dc3545 !important;">
                    <div class="d-flex align-items-center me-2 text-nowrap">
                        <i class="fas fa-user-secret text-danger me-2"></i>
                        <div style="line-height: 1.1;">
                            <div class="small fw-bold text-danger">${statusText}</div>
                            <div style="font-size: 0.7rem;" class="text-muted">${unitText}</div>
                        </div>
                    </div>
                    
                    <div class="position-relative">
                        <input type="text" id="global-impersonate-search" 
                               class="form-control form-control-sm border-0 bg-light" 
                               placeholder="${searchPlaceholder}" 
                               style="width: 180px;">
                        <div id="global-impersonate-results" class="dropdown-menu shadow" 
                             style="display:none; position:absolute; top:100%; left:0; width:260px; max-height:300px; overflow-y:auto;">
                        </div>
                    </div>

                    ${isImpersonating ? `
                        <div class="vr mx-2"></div>
                        <button id="btn-global-exit" class="btn btn-sm btn-outline-danger py-0 fw-bold" style="font-size: 0.8rem;">
                            退出
                        </button>
                    ` : ''}
                </div>
            `;
        }

        // 模擬狀態下的側邊欄警告
        const sidebarAlert = isImpersonating ? 
            `<div class="bg-danger text-white text-center py-2 small fw-bold">
                <i class="fas fa-eye"></i> 正在檢視：${user.name}<br>
                <span class="badge bg-white text-danger mt-1">${user.unitId || '無單位'}</span>
             </div>` : '';

        return `
            <div class="app-layout">
                <aside class="layout-sidebar" id="layout-sidebar">
                    ${sidebarAlert}
                    <div class="sidebar-toggle-tab" id="sidebar-toggle-btn" title="切換選單">
                        <i class="fas fa-chevron-left" id="sidebar-toggle-icon"></i>
                    </div>
                    
                    <div class="sidebar-header" style="cursor:pointer;" onclick="window.location.hash='/dashboard'">
                        <i class="fas fa-hospital-alt" style="margin-right:10px;"></i> 護理排班系統
                    </div>
                    
                    <nav class="sidebar-menu" id="sidebar-menu-container">
                        ${menuHtml}
                    </nav>
                </aside>

                <div class="main-content-wrapper d-flex flex-column" style="flex:1; height:100vh; overflow:hidden;">
                    <header class="layout-header border-bottom bg-white d-flex align-items-center justify-content-between px-4" id="layout-header" style="height: 60px;">
                        <div class="brand-logo" id="header-logo">
                            <span id="page-title">儀表板</span>
                        </div>
                        
                        <div class="user-info d-flex align-items-center">
                            ${adminControlHtml}

                            <div class="d-flex align-items-center gap-2 border-start ps-3 ms-2">
                                <span id="user-role-badge" class="badge bg-primary me-2">${displayRoleName}</span>
                                <span style="margin-right:10px; color:#666;">
                                    <i class="fas fa-user-circle"></i> <span id="header-username">${displayName}</span>
                                </span>
                            </div>
                        </div>
                    </header>

                    <main class="layout-content p-0" id="main-view" style="flex:1; overflow-y:auto;">
                        </main>
                </div>
            </div>
        `;
    },

    renderMenuHtml(menus) {
        if(!menus) return '';
        return menus.map(item => {
            if (item.isHeader) {
                return `<div class="menu-header text-uppercase text-xs font-weight-bold text-gray-500 mt-3 mb-1 px-3">${item.label}</div>`;
            }
            return `
                <a href="#${item.path}" class="menu-item" data-path="${item.path}">
                    <i class="${item.icon}"></i>
                    <span>${item.label}</span>
                </a>
            `;
        }).join('');
    }
};
