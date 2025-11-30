/**
 * 應用程式進入點
 * 初始化所有模組並啟動系統
 */

(function() {
    'use strict';
    
    console.log('='.repeat(60));
    console.log(`🏥 ${CONSTANTS.SYSTEM.NAME} v${CONSTANTS.SYSTEM.VERSION}`);
    console.log(`📅 建置日期: ${CONSTANTS.SYSTEM.BUILD_DATE}`);
    console.log('='.repeat(60));
    
    // ==================== 應用程式類別 ====================
    
    class Application {
        constructor() {
            this.initialized = false;
            this.startTime = Date.now();
        }
        
        /**
         * 初始化應用程式
         */
        async init() {
            if (this.initialized) {
                console.warn('[App] 應用程式已初始化');
                return;
            }
            
            console.log('[App] 開始初始化應用程式...');
            
            try {
                // 顯示載入畫面
                this.showLoader('正在初始化系統...');
                
                // 1. 初始化 Firebase
                await this.initFirebase();
                
                // 2. 初始化認證系統
                await this.initAuth();
                
                // 3. 檢查登入狀態
                const isAuthenticated = Auth.isAuthenticated();
                
                if (!isAuthenticated) {
                    // 未登入，導向登入頁
                    console.log('[App] 使用者未登入，導向登入頁');
                    this.hideLoader();
                    window.location.href = 'login.html';
                    return;
                }
                
                // 4. 初始化 UI 元件
                await this.initComponents();
                
                // 5. 初始化路由
                await this.initRouter();
                
                // 6. 註冊全域事件
                this.registerGlobalEvents();
                
                // 7. 完成初始化
                this.initialized = true;
                this.hideLoader();
                this.showApp();
                
                const loadTime = Date.now() - this.startTime;
                console.log(`[App] ✅ 應用程式初始化完成 (耗時: ${loadTime}ms)`);
                
                // 歡迎訊息
                this.showWelcomeMessage();
                
            } catch (error) {
                console.error('[App] ❌ 初始化失敗:', error);
                this.hideLoader();
                this.showError('系統初始化失敗', error.message);
            }
        }
        
        /**
         * 初始化 Firebase
         */
        async initFirebase() {
            console.log('[App] 初始化 Firebase...');
            await FirebaseService.init();
        }
        
        /**
         * 初始化認證系統
         */
        async initAuth() {
            console.log('[App] 初始化認證系統...');
            await Auth.init();
            
            // 監聽認證狀態變化
            Auth.onAuthStateChanged((user) => {
                if (!user) {
                    console.log('[App] 使用者登出');
                    window.location.href = 'login.html';
                } else {
                    console.log('[App] 使用者狀態變更:', user.email);
                    // 更新 UI
                    if (this.initialized) {
                        Navbar.updateUser();
                        Sidebar.refresh();
                    }
                }
            });
        }
        
        /**
         * 初始化 UI 元件
         */
        async initComponents() {
            console.log('[App] 初始化 UI 元件...');
            
            // 初始化通知系統
            Notification.init();
            
            // 初始化導航列
            Navbar.init();
            
            // 初始化側邊欄
            Sidebar.init();
            
            console.log('[App] ✓ UI 元件初始化完成');
        }
        
        /**
         * 初始化路由
         */
        async initRouter() {
            console.log('[App] 初始化路由系統...');
            Router.init();
        }
        
        /**
         * 註冊全域事件
         */
        registerGlobalEvents() {
            console.log('[App] 註冊全域事件...');
            
            // 監聽線上/離線狀態
            window.addEventListener('online', () => {
                Notification.success('網路連線已恢復');
            });
            
            window.addEventListener('offline', () => {
                Notification.warning('網路連線中斷，部分功能可能無法使用');
            });
            
            // 監聽 beforeunload (防止意外關閉)
            window.addEventListener('beforeunload', (e) => {
                // 如果有未儲存的變更，提示使用者
                // 這裡可以根據實際情況決定是否需要
                // e.preventDefault();
                // e.returnValue = '';
            });
            
            // 全域錯誤處理
            window.addEventListener('error', (e) => {
                console.error('[App] 全域錯誤:', e.error);
                // 可以記錄到錯誤追蹤服務
            });
            
            window.addEventListener('unhandledrejection', (e) => {
                console.error('[App] 未處理的 Promise 拒絕:', e.reason);
                // 可以記錄到錯誤追蹤服務
            });
            
            // 鍵盤快捷鍵
            document.addEventListener('keydown', (e) => {
                // Ctrl/Cmd + K: 快速搜尋 (預留)
                if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                    e.preventDefault();
                    Notification.info('快速搜尋功能開發中');
                }
                
                // Esc: 關閉 Modal
                if (e.key === 'Escape') {
                    Modal.close();
                }
            });
        }
        
        /**
         * 顯示載入畫面
         */
        showLoader(message = '載入中...') {
            const loader = document.getElementById('app-loader');
            if (loader) {
                const messageEl = loader.querySelector('p');
                if (messageEl) {
                    messageEl.textContent = message;
                }
                loader.style.display = 'flex';
            }
        }
        
        /**
         * 隱藏載入畫面
         */
        hideLoader() {
            const loader = document.getElementById('app-loader');
            if (loader) {
                loader.style.display = 'none';
            }
        }
        
        /**
         * 顯示應用程式
         */
        showApp() {
            const app = document.getElementById('app');
            if (app) {
                app.style.display = 'flex';
            }
        }
        
        /**
         * 顯示錯誤訊息
         */
        showError(title, message) {
            const app = document.getElementById('app');
            if (app) {
                app.innerHTML = `
                    <div style="
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        justify-content: center;
                        min-height: 100vh;
                        padding: 20px;
                        text-align: center;
                    ">
                        <div style="
                            font-size: 64px;
                            margin-bottom: 20px;
                        ">⚠️</div>
                        <h1 style="
                            font-size: 24px;
                            font-weight: 700;
                            color: #1a1a1a;
                            margin-bottom: 12px;
                        ">${title}</h1>
                        <p style="
                            font-size: 16px;
                            color: #666;
                            margin-bottom: 24px;
                        ">${message}</p>
                        <button 
                            class="btn btn-primary"
                            onclick="window.location.reload()"
                        >
                            重新載入
                        </button>
                    </div>
                `;
                app.style.display = 'flex';
            }
        }
        
        /**
         * 顯示歡迎訊息
         */
        showWelcomeMessage() {
            const user = Auth.getCurrentUser();
            if (!user) return;
            
            // 檢查是否為今日第一次登入
            const lastWelcome = Storage.get('last_welcome_date');
            const today = Utils.formatDate(new Date(), 'YYYY-MM-DD');
            
            if (lastWelcome !== today) {
                const hour = new Date().getHours();
                let greeting = '早安';
                if (hour >= 12 && hour < 18) greeting = '午安';
                else if (hour >= 18) greeting = '晚安';
                
                setTimeout(() => {
                    Notification.success(`${greeting}，${user.displayName}！`, 2000);
                }, 500);
                
                Storage.set('last_welcome_date', today);
            }
        }
    }
    
    // ==================== 啟動應用程式 ====================
    
    const app = new Application();
    
    // 等待 DOM 載入完成
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            app.init();
        });
    } else {
        app.init();
    }
    
    // 讓應用程式實例可在全域使用 (方便除錯)
    if (typeof window !== 'undefined') {
        window.App = app;
    }
    
})();