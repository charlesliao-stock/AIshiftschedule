// 檔案位置: js/MigrateData.js

// 請根據您的檔案結構調整這裡的路徑
// 如果此檔案在 js/ 下，而 config 在 js/config/ 下，則為 ./config/firebase.config.js
import { db } from "./config/firebase.config.js"; 
import { collection, getDocs, writeBatch, doc, deleteField } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

async function migrateUserData() {
    console.log("🚀 [Migration] 開始執行資料庫欄位遷移...");

    try {
        const usersRef = collection(db, "users");
        const snapshot = await getDocs(usersRef);

        if (snapshot.empty) {
            console.log("⚠️ 沒有找到使用者資料。");
            return;
        }

        const batch = writeBatch(db);
        let count = 0;

        snapshot.forEach((document) => {
            const data = document.data();
            const ref = doc(db, "users", document.id);
            const updates = {};
            let needsUpdate = false;

            // 1. 遷移 Name -> staffName
            if (data.name && !data.staffName) {
                updates.staffName = data.name;
                updates.name = deleteField();
                needsUpdate = true;
            }

            // 2. 遷移 staffId -> staffCode
            if (data.staffId && !data.staffCode) {
                updates.staffCode = data.staffId;
                updates.staffId = deleteField();
                needsUpdate = true;
            }

            // 3. 補上 unitId
            if (data.unitId === undefined) {
                updates.unitId = "";
                needsUpdate = true;
            }

            if (needsUpdate) {
                batch.update(ref, updates);
                count++;
                console.log(`- 準備更新: ${data.name || data.staffName}`);
            }
        });

        if (count > 0) {
            await batch.commit();
            console.log(`✅ 遷移完成！共更新 ${count} 筆資料。`);
        } else {
            console.log("✨ 資料庫已是最新狀態，無需更新。");
        }

    } catch (error) {
        console.error("❌ 遷移失敗:", error);
    }
}

// 自動執行
migrateUserData();
