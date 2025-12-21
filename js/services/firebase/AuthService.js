import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { firebaseService } from "./FirebaseService.js";

class AuthService {
    constructor() { 
        this.currentUser = null;        // Firebase Auth User
        
        // 從 localStorage 恢復真實身分
        const savedRealProfile = localStorage.getItem('realProfile');
        this.currentUserProfile = savedRealProfile ? JSON.parse(savedRealProfile) : null;
        
        // 從 localStorage 恢復模擬身分
        const savedImpersonation = localStorage.getItem('impersonatedProfile');
        this.impersonatedProfile = savedImpersonation ? JSON.parse(savedImpersonation) : null;
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
            this.impersonatedProfile = null; // 清除模擬狀態
            localStorage.removeItem('impersonatedProfile');
            return true;
        } catch (error) {
            console.error("登出失敗:", error);
            return false;
        }
    }

    monitorAuthState(callback) {
        const auth = firebaseService.getAuth();
        onAuthStateChanged(auth, (user) => {
            this.currentUser = user;
            if (!user) {
                this.currentUserProfile = null;
                this.impersonatedProfile = null;
            }
            callback(user);
        });
    }

    getCurrentUser() { return this.currentUser; }

    /**
     * 設定真實使用者的 Profile
     */
    setProfile(profile) {
        // 如果傳入的是 null (登出)，清除所有狀態
        if (!profile) {
            this.currentUserProfile = null;
            this.impersonatedProfile = null;
            localStorage.removeItem('impersonatedProfile');
            localStorage.removeItem('realProfile');
            return;
        }

        // 如果目前沒有真實 Profile，或者傳入的是系統管理員，則更新真實 Profile
        // 這是為了確保在重新整理頁面後，我們仍知道誰是「真實的」管理員
        if (!this.currentUserProfile || profile.role === 'system_admin') {
            this.currentUserProfile = profile;
            localStorage.setItem('realProfile', JSON.stringify(profile));
        }
    }

    /**
     * [關鍵] 取得當前身分 (支援模擬)
     * 若有模擬身分，回傳模擬物件，並標記 isImpersonating
     */
    getProfile() {
        if (this.impersonatedProfile) {
            return {
                ...this.impersonatedProfile,
                isImpersonating: true,
                originalRole: this.currentUserProfile?.role // 保留原始權限
            };
        }
        return this.currentUserProfile;
    }

    /**
     * [新功能] 開始模擬
     * @param {Object} targetProfile 目標使用者的 Profile
     */
    impersonate(targetProfile) {
        this.impersonatedProfile = targetProfile;
        localStorage.setItem('impersonatedProfile', JSON.stringify(targetProfile));
        // 強制重新整理頁面以套用新身分
        window.location.reload();
    }

    /**
     * [新功能] 停止模擬
     */
    stopImpersonation() {
        this.impersonatedProfile = null;
        localStorage.removeItem('impersonatedProfile');
        window.location.reload();
    }

    _formatError(code) {
        switch(code) {
            case 'auth/invalid-email': return 'Email 格式不正確';
            case 'auth/user-not-found': case 'auth/wrong-password': case 'auth/invalid-credential': return '帳號或密碼錯誤';
            case 'auth/too-many-requests': return '登入嘗試過多，請稍後再試';
            default: return '登入發生錯誤';
        }
    }
}

export const authService = new AuthService();
