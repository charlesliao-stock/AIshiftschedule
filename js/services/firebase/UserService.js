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
            return snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() }));
        } catch (error) { console.error(error); throw error; }
    },

    // 取得特定單位人員
    async getUsersByUnit(unitId) {
        try {
            const q = query(collection(db, "users"), where("unitId", "==", unitId));
            const snapshot = await getDocs(q);
            return snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() }));
        } catch (error) { console.error(error); throw error; }
    },

    async getUserData(uid) {
        try {
            if (!db) throw new Error("Firestore DB 未初始化");
            const docRef = doc(db, "users", uid);
            const docSnap = await getDoc(docRef);
            return docSnap.exists() ? { uid: docSnap.id, ...docSnap.data() } : null;
        } catch (error) { console.error(error); throw error; }
    },

    async createStaff(data, password) {
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, data.email, password);
            const uid = userCredential.user.uid;
            
            // 預設 constraints 結構
            const constraints = {
                maxConsecutive: 6,
                isPregnant: false,
                allowFixedShift: false, // 預設不開放包班
                rotatingLane: 'DN'      // 預設跑 白+大 組別
            };

            await setDoc(doc(db, "users", uid), {
                ...data,
                constraints: { ...constraints, ...data.constraints },
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });
            return { success: true, uid: uid };
        } catch (error) { return { success: false, error: error.message }; }
    },

    async updateUser(uid, data) {
        try {
            await updateDoc(doc(db, "users", uid), {
                ...data,
                updatedAt: serverTimestamp()
            });
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
    
    // 用於更新最後登入時間等
    async updateLastLogin(uid) {
        try {
            const userRef = doc(db, "users", uid);
            await updateDoc(userRef, { lastLogin: serverTimestamp() });
        } catch (e) {}
    }
};
