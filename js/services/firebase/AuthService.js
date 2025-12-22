import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { firebaseService } from "./FirebaseService.js";

class AuthService {
    constructor() { 
        this.currentUser = null;        // Firebase Auth User
        this.currentUserProfile = null; // 真實身分 (Admin)
        this.impersonatedProfile = null; // 替身 (Target)
    }

    async login(email, password) {
        try {
            const auth = firebaseService.getAuth();
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            this.currentUser = userCredential.user;
            return { success: true, user: this.currentUser };
        } catch (error) {
            return { success: false, error: this._formatError(error.code) };
        }
    }

    async logout() {
        try {
            const auth = firebaseService.getAuth();
            await signOut(auth);
            this.currentUser = null;
            this.currentUserProfile = null;
            this.impersonatedProfile = null;
            localStorage.removeItem('impersonation_session'); // 清除模擬狀態
            return true;
        } catch (error) {
            console.error("登出失敗:", error);
            return false;
        }
    }

    /**
     * 監聽登入狀態 (含模擬狀態恢復)
     */
    monitorAuthState(callback) {
        const auth = firebaseService.getAuth();
        onAuthStateChanged(auth, (user) => {
            this.currentUser = user;
            if (user) {
                // 嘗試恢復模擬狀態
                const savedImp = localStorage.getItem('impersonation_session');
                if (savedImp) {
                    try {
                        this.impersonatedProfile = JSON.parse(savedImp);
                        console.log("🕵️‍♂️ 恢復模擬狀態:", this.impersonatedProfile.name, "| 單位:", this.impersonatedProfile.unitId);
                    } catch (e) {
                        localStorage.removeItem('impersonation_session');
                    }
                }
            } else {
                this.currentUserProfile = null;
                this.impersonatedProfile = null;
                localStorage.removeItem('impersonation_session');
            }
            callback(user);
        });
    }

    getCurrentUser() { return this.currentUser; }

    setProfile(profile) {
        this.currentUserProfile = profile;
    }

    /**
     * [關鍵] 取得當前身分
     * 若有模擬，回傳的物件會包含 targetUser 的 unitId，
     * 這樣所有頁面就會自動讀取該單位的資料。
     */
    getProfile() {
        if (this.impersonatedProfile) {
            return {
                ...this.impersonatedProfile,
                isImpersonating: true,
                originalRole: this.currentUserProfile?.role,
                originalName: this.currentUserProfile?.name,
                originalUid: this.currentUserProfile?.uid
            };
        }
        return this.currentUserProfile;
    }

    /**
     * [改寫] 開始模擬 (帶入單位上下文)
     */
    impersonate(targetUser) {
        if (!targetUser) return;

        console.log(`🕵️‍♂️ 切換身分至: ${targetUser.name} (${targetUser.role}) | 單位: ${targetUser.unitId || '無'}`);

        // 1. 設定替身
        this.impersonatedProfile = targetUser;
        
        // 2. 持久化 (存入 LocalStorage)，確保 F5 重整後還在
        localStorage.setItem('impersonation_session', JSON.stringify(targetUser));

        // 3. 導向邏輯：強制回到儀表板並重整，確保讀取到新單位的資料
        window.location.hash = '/dashboard';
        window.location.reload(); 
    }

    /**
     * [改寫] 停止模擬
     */
    stopImpersonation() {
        console.log("👋 結束模擬，回到真身");
        this.impersonatedProfile = null;
        localStorage.removeItem('impersonation_session');
        window.location.hash = '/dashboard';
        window.location.reload();
    }

    _formatError(code) {
        switch (code) {
            case 'auth/user-not-found': return '找不到此帳號';
            case 'auth/wrong-password': return '密碼錯誤';
            case 'auth/invalid-email': return 'Email 格式不正確';
            case 'auth/too-many-requests': return '嘗試次數過多，請稍後再試';
            default: return '登入失敗，請檢查帳號密碼';
        }
    }
}

export const authService = new AuthService();
