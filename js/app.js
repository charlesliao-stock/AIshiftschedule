/**
 * js/app.js
 * 應用程式進入點 (ES Module 版)
 * 初始化所有模組並啟動系統
 */

// 1. 導入配置
import { CONSTANTS } from './config/constants.js';

// 2. 導入核心模組
import { Auth } from './core/auth.js';
import { Router } from './core/router.js';
import { Utils } from './core/utils.js';
import { Storage } from './core/storage.js';

// 3. 導入服務
import { FirebaseService } from './services/firebase.service.js';
import { ConfigService } from './services/config.service.js';
import { ScheduleService } from './services/schedule.service.js'; // 🔥 新增：導入排班服務以執行備份

// 4. 導入 UI 元件
import { Navbar } from './components/navbar.js';
import { Sidebar } from './components/sidebar.js';
import { Notification } from './components/notification.js';
import { Modal } from './components/modal.js';

// 顯示系統資訊
console.log('='.repeat(60));
const sysName = CONSTANTS?.SYSTEM?.NAME || '護理站排班系統';
const sysVer = CONSTANTS?.SYSTEM?.VERSION || '2.1.0'; 
const buildDate = CONSTANTS?.SYSTEM?.BUILD_DATE || new Date().toISOString().split('T')[0];
console.log(`🏥 ${sysName} v${sysVer}`);
console.log(`📅 建置日期: ${buildDate}`);
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
            this.showLoader('正在初始化系統...');
            
            // 1. 初始化 Firebase
            await this.initFirebase();

            // 2. 載入遠端系統設定
            await this.initConfig();
            
            // 3. 初始化認證系統
            await this.initAuth();
            
            // 4. 檢查登入狀態
            const user = Auth.getCurrentUser();
            
            if (!user) {
                console.log('[App] 使用者未登入，導向登入頁');
                this.hideLoader();
                if (!window.location.pathname.includes('login.html')) {
                    window.location.href = 'login.html';
                }
                return;
            }

            // 🔥 新增：如果是系統管理員，觸發自動備份檢查 (背景執行)
            if (user.role === CONSTANTS.ROLES.ADMIN) {
                // 不使用 await，避免阻擋 UI 載入
                ScheduleService.checkAndRunAutoBackup().catch(err => 
                    console.error('[App] Background Backup Error:', err)
                );
            }
            
            // 5. 初始化 UI 元件
            await this.initComponents();
            
            // 6. 初始化路由
            await this.initRouter();
            
            // 7. 註冊全域事件
            this.registerGlobalEvents();
            
            // 8. 完成初始化
            this.initialized = true;
            this.hideLoader();
            this.showApp();
            
            const loadTime = Date.now() - this.startTime;
            console.log(`[App] ✅ 應用程式初始化完成 (耗時: ${loadTime}ms)`);
            
            this.showWelcomeMessage();
            
        } catch (error) {
            console.error('[App] ❌ 初始化失敗:', error);
            this.hideLoader();
            this.showError('系統初始化失敗', error.message);
        }
    }
    
    async initFirebase() {
        console.log('[App] 初始化 Firebase...');
        await FirebaseService.init();
    }

    async initConfig() {
        try {
            if (ConfigService && typeof ConfigService.loadSystemConfig === 'function') {
                console.log('[App] 載入系統設定...');
                await ConfigService.loadSystemConfig();
            }
        } catch (error) {
            console.warn('[App] 載入遠端設定失敗，將使用預設參數:', error);
        }
    }
    
    async initAuth() {
        console.log('[App] 初始化認證系統...');
        await Auth.init();
        
        Auth.onAuthStateChanged((user) => {
            if (!user) {
                console.log('[App] 使用者登出');
                if (!window.location.pathname.includes('login.html')) {
                    window.location.href = 'login.html';
                }
            } else {
                console.log('[App] 使用者狀態變更:', user.email);
                if (this.initialized) {
                    Navbar.updateUser();
                    Sidebar.refresh();
                }
            }
        });
    }
    
    async initComponents() {
        console.log('[App] 初始化 UI 元件...');
        Notification.init();
        Navbar.init();
        Sidebar.init();
        console.log('[App] ✓ UI 元件初始化完成');
    }
    
    async initRouter() {
        console.log('[App] 初始化路由系統...');
        Router.init();
    }
    
    registerGlobalEvents() {
        console.log('[App] 註冊全域事件...');
        
        window.addEventListener('online', () => Notification.success('網路連線已恢復'));
        window.addEventListener('offline', () => Notification.warning('網路連線中斷，部分功能可能無法使用'));
        
        window.addEventListener('error', (e) => {
            console.error('[App] 全域錯誤:', e.error);
        });
        
        window.addEventListener('unhandledrejection', (e) => {
            console.error('[App] 未處理的 Promise 拒絕:', e.reason);
        });
        
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') Modal.close();
        });
    }
    
    showLoader(message = '載入中...') {
        const loader = document.getElementById('app-loader');
        if (loader) {
            const messageEl = loader.querySelector('p');
            if (messageEl) messageEl.textContent = message;
            loader.style.display = 'flex';
        }
    }
    
    hideLoader() {
        const loader = document.getElementById('app-loader');
        if (loader) loader.style.display = 'none';
    }
    
    showApp() {
        const app = document.getElementById('app');
        if (app) app.style.display = 'flex';
    }
    
    showError(title, message) {
        const app = document.getElementById('app');
        if (app) {
            app.innerHTML = `
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; padding: 20px; text-align: center;">
                    <div style="font-size: 64px; margin-bottom: 20px;">⚠️</div>
                    <h1 style="font-size: 24px; font-weight: 700; color: #1a1a1a; margin-bottom: 12px;">${title}</h1>
                    <p style="font-size: 16px; color: #666; margin-bottom: 24px;">${message}</p>
                    <button class="btn btn-primary" onclick="window.location.reload()">重新載入</button>
                </div>
            `;
            app.style.display = 'flex';
        }
    }
    
    showWelcomeMessage() {
        const user = Auth.getCurrentUser();
        if (!user) return;
        
        const lastWelcome = Storage.get('last_welcome_date');
        const today = Utils.formatDate(new Date(), 'YYYY-MM-DD');
        
        if (lastWelcome !== today) {
            const hour = new Date().getHours();
            let greeting = '早安';
            if (hour >= 12 && hour < 18) greeting = '午安';
            else if (hour >= 18) greeting = '晚安';
            
            setTimeout(() => {
                Notification.success(`${greeting}，${user.displayName || '使用者'}！`, 2000);
            }, 500);
            
            Storage.set('last_welcome_date', today);
        }
    }
}

// ==================== 啟動 ====================

const app = new Application();

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        app.init();
    });
} else {
    app.init();
}

export default app;
