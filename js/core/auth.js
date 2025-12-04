/**
 * js/core/auth.js (最終修正版)
 */
import { 
    signInWithEmailAndPassword, signOut, onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { FirebaseService } from '../services/firebase.service.js';
import { Storage } from './storage.js';
import { CONSTANTS } from '../config/constants.js';

export const Auth = {
    authInstance: null,
    currentUser: null,
    listeners: [],

    async init() {
        this.authInstance = FirebaseService.auth;
        if (!this.authInstance) throw new Error('Auth Init Failed');

        onAuthStateChanged(this.authInstance, async (user) => {
            await this.handleAuthStateChange(user);
        });

        const savedUser = Storage.get(CONSTANTS.STORAGE_KEYS.USER);
        if (savedUser) this.currentUser = savedUser; 
    },

    async handleAuthStateChange(user) {
        if (user) {
            let profile = {
                uid: user.uid,
                email: user.email,
                displayName: user.displayName || user.email.split('@')[0],
                role: CONSTANTS.ROLES.USER
            };

            try {
                const userDoc = await FirebaseService.getDocument('users', user.uid);
                if (userDoc) profile = { ...profile, ...userDoc };
                else await FirebaseService.setDocument('users', user.uid, profile);
            } catch (e) { console.error(e); }

            if (user.email === 'admin@hospital.com') profile.role = CONSTANTS.ROLES.ADMIN;

            this.currentUser = profile;
            Storage.set(CONSTANTS.STORAGE_KEYS.USER, this.currentUser);
        } else {
            this.currentUser = null;
            Storage.remove(CONSTANTS.STORAGE_KEYS.USER);
        }
        this.notifyListeners(this.currentUser);
    },

    async login(email, password) {
        const cred = await signInWithEmailAndPassword(this.authInstance, email, password);
        return cred.user;
    },

    async logout() {
        await signOut(this.authInstance);
        Storage.clear();
        window.location.href = 'login.html';
    },

    getCurrentUser() { return this.currentUser; },
    
    /**
     * 取得使用者的單位資訊 (新增)
     */
    getUserUnit() {
        if (!this.currentUser) return null;
        // 優先讀取 unitId (新版), 兼容 unit_id (舊版)
        const id = this.currentUser.unitId || this.currentUser.unit_id;
        const name = this.currentUser.unitName || this.currentUser.unit_name || '未知單位';
        
        if (!id) return null;
        return { id, name };
    },

    isAuthenticated() { return !!this.currentUser; },
    getUserRole() { return this.currentUser?.role || CONSTANTS.ROLES.USER; },
    isAdmin() { return this.getUserRole() === CONSTANTS.ROLES.ADMIN; },
    isManager() { const r = this.getUserRole(); return r === CONSTANTS.ROLES.MANAGER || r === CONSTANTS.ROLES.ADMIN; },
    
    async getToken() { return this.authInstance?.currentUser?.getIdToken(); },

    onAuthStateChanged(cb) {
        this.listeners.push(cb);
        if (this.currentUser) cb(this.currentUser);
    },
    notifyListeners(u) { this.listeners.forEach(cb => cb(u)); }
};
