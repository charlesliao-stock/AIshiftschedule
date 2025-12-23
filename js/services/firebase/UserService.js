import { db, auth } from "../../config/firebase.config.js";
import { 
    collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, 
    query, where, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

export const userService = {
    // 取得所有使用者 (全院)
    async getAllUsers() {
        try {
            const q = query(collection(db, "users"));
            const snapshot = await getDocs(q);
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
    
    // 建立新人員 (核心修改)
    async createStaff(data, password) {
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, data.email, password);
            const uid = userCredential.user.uid;
            
            // ✅ 使用新標準欄位: staffName, staffCode
            // 這裡 data 應該已經包含新欄位，但為了保險我們做個映射或檢查
            const payload = {
                ...data,
                // 確保寫入 unitId (若無則空字串)
                unitId: data.unitId || "", 
                createdAt: serverTimestamp(), 
                updatedAt: serverTimestamp() 
            };

            await setDoc(doc(db, "users", uid), payload);
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
    
    // ✅ 關鍵修復：搜尋功能 (配合新欄位)
    async searchUsers(keyword) {
        const list = await this.getAllUsers();
        if (!keyword) return [];
        const k = keyword.toLowerCase();
        
        return list.filter(u => 
            // 優先搜尋新欄位，但也相容舊資料 (u.name) 以防萬一
            ((u.staffName && u.staffName.toLowerCase().includes(k)) || (u.name && u.name.toLowerCase().includes(k))) || 
            ((u.staffCode && String(u.staffCode).toLowerCase().includes(k)) || (u.staffId && String(u.staffId).toLowerCase().includes(k)))
        );
    }
};
