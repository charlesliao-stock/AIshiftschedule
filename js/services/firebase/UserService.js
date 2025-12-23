import { db, auth } from "../../config/firebase.config.js";
import { 
    collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, 
    query, where, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

export const userService = {
    // 取得所有使用者
    async getAllUsers() {
        try {
            const q = query(collection(db, "users"));
            const snapshot = await getDocs(q);
            // ✅ 標準化回傳 uid
            return snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() }));
        } catch (error) { console.error("Get All Users Error:", error); throw error; }
    },

    async getUsersByUnit(unitId) {
        try {
            const q = query(collection(db, "users"), where("unitId", "==", unitId));
            const snapshot = await getDocs(q);
            return snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() }));
        } catch (error) { console.error("Get Users By Unit Error:", error); throw error; }
    },

    async getUserData(uid) {
        try {
            if (!db) throw new Error("Firestore DB 未初始化");
            const docRef = doc(db, "users", uid);
            const docSnap = await getDoc(docRef);
            return docSnap.exists() ? { uid: docSnap.id, ...docSnap.data() } : null;
        } catch (error) { console.error("Get User Data Error:", error); throw error; }
    },

    async updateLastLogin(uid) {
        try {
            if (!db || !uid) return;
            await updateDoc(doc(db, "users", uid), { lastLoginAt: serverTimestamp() });
        } catch (e) {}
    },
    
    // 建立新人員 (純淨版：只寫入標準欄位)
    async createStaff(data, password) {
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, data.email, password);
            const uid = userCredential.user.uid;
            
            // 寫入 Firestore
            await setDoc(doc(db, "users", uid), { 
                ...data, 
                // 確保 unitId 存在
                unitId: data.unitId || "", 
                createdAt: serverTimestamp(), 
                updatedAt: serverTimestamp() 
            });
            return { success: true, uid: uid };
        } catch (error) { return { success: false, error: error.message }; }
    },

    async updateUser(uid, data) {
        try {
            await updateDoc(doc(db, "users", uid), { ...data, updatedAt: serverTimestamp() });
            return { success: true };
        } catch (error) { console.error(error); throw error; }
    },

    async deleteStaff(uid) {
        try {
            await deleteDoc(doc(db, "users", uid));
            return { success: true };
        } catch (error) { console.error(error); throw error; }
    },
    
    async getUnitStaff(unitId) { return this.getUsersByUnit(unitId); },
    async getAllStaffCount() { const list = await this.getAllUsers(); return list.length; },
    
    // ✅ 搜尋功能 (純淨版：只搜 staffName 與 staffCode)
    async searchUsers(keyword) {
        const list = await this.getAllUsers();
        if (!keyword) return [];
        const k = keyword.toLowerCase();
        
        return list.filter(u => 
            (u.staffName && u.staffName.toLowerCase().includes(k)) || 
            (u.staffCode && String(u.staffCode).toLowerCase().includes(k))
        );
    }
};
