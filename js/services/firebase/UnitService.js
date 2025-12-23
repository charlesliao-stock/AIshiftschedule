import { 
    collection, doc, setDoc, getDoc, updateDoc, deleteDoc, 
    getDocs, query, where, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { firebaseService } from "./FirebaseService.js";

export class UnitService {
    
    static COLLECTION_NAME = 'units';

    // 取得所有單位 (強制回傳 unitId)
    static async getAllUnits() {
        try {
            const db = firebaseService.getDb();
            const q = query(collection(db, UnitService.COLLECTION_NAME));
            const querySnapshot = await getDocs(q);
            const units = [];
            querySnapshot.forEach((doc) => {
                // ✅ 標準化: 直接賦予 unitId
                units.push({ unitId: doc.id, ...doc.data() });
            });
            return units;
        } catch (error) {
            console.error("Get all units failed:", error);
            return [];
        }
    }

    // 根據管理者 ID 取得單位
    static async getUnitsByManager(managerId) {
        try {
            const db = firebaseService.getDb();
            const q = query(
                collection(db, UnitService.COLLECTION_NAME), 
                where("managers", "array-contains", managerId)
            );
            const querySnapshot = await getDocs(q);
            const units = [];
            querySnapshot.forEach((doc) => {
                // ✅ 標準化
                units.push({ unitId: doc.id, ...doc.data() });
            });
            return units;
        } catch (error) {
            console.error("Get units by manager failed:", error);
            return [];
        }
    }

    // 根據 ID 取得單一單位
    static async getUnitById(unitId) { // 參數名也統一
        if (!unitId) return null;
        try {
            const db = firebaseService.getDb();
            const docRef = doc(db, UnitService.COLLECTION_NAME, unitId);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                // ✅ 標準化
                return { unitId: docSnap.id, ...docSnap.data() };
            } else {
                return null;
            }
        } catch (error) {
            console.error("Get unit by ID failed:", error);
            return null;
        }
    }

    // 建立單位 (回傳 unitId)
    static async createUnit(data) {
        try {
            const db = firebaseService.getDb();
            const newDocRef = doc(collection(db, UnitService.COLLECTION_NAME));
            await setDoc(newDocRef, {
                ...data,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });
            return { success: true, unitId: newDocRef.id };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    static async updateUnit(unitId, data) {
        try {
            const db = firebaseService.getDb();
            const docRef = doc(db, UnitService.COLLECTION_NAME, unitId);
            await updateDoc(docRef, {
                ...data,
                updatedAt: serverTimestamp()
            });
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
}
