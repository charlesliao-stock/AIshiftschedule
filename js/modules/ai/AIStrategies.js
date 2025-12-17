// js/ai/AIStrategies.js

// 基礎權重
const BASE_WEIGHTS = {
    NEED_HIGH: 50,
    NEED_LOW: 10,
    PREFERENCE: 20,
    CONTINUITY: 10,
    FATIGUE: -80
};

// 策略 A：數值平衡 (Statistical Balance)
export class BalanceStrategy {
    static calculateScore(uid, shift, day, context, currentCounts, w) {
        let score = 100;
        const shiftReq = context.staffReq[shift]?.[w] || 0;
        const current = currentCounts[shift] || 0;

        // 1. 人力需求 (最高優先級)
        if (shift !== 'OFF') {
            if (current < shiftReq) score += BASE_WEIGHTS.NEED_HIGH; // 缺人趕快補
            else score -= 50; // 滿了就扣分
        }

        // 2. 平均分配 (削峰填谷)
        // 檢查該員目前累計的該班別數，若已超過平均值則扣分
        if (shift === 'N' || shift === 'E') {
            const myCount = context.stats[uid]?.[shift] || 0;
            // 假設平均值是 5，若已排 6 個，大幅扣分
            const avg = 5; // 實務上應由 context 動態計算 Lane Average
            if (myCount > avg) score -= (myCount - avg) * 20;
        }

        return score;
    }
}

// 策略 B：願望優先 (Wish Granter)
export class PreferenceStrategy {
    static calculateScore(uid, shift, day, context, currentCounts, w) {
        let score = 100;
        const prefs = context.preferences[uid];
        const shiftReq = context.staffReq[shift]?.[w] || 0;
        const current = currentCounts[shift] || 0;

        // 1. 滿足願望 (權重極高)
        if (prefs.p1 === shift) score += 500;
        else if (prefs.p2 === shift) score += 300;

        // 2. 人力需求 (次要，允許微幅溢出)
        if (shift !== 'OFF') {
            if (current < shiftReq) score += BASE_WEIGHTS.NEED_HIGH;
            // 這裡不強烈扣分滿員，允許為了滿足願望而稍微多排人
        }

        return score;
    }
}

// 策略 C：規律作息 (Rhythm Keeper)
export class PatternStrategy {
    static calculateScore(uid, shift, day, context, currentCounts, w) {
        let score = 100;
        const prev = context.assignments[uid][day-1] || 'OFF';
        const shiftReq = context.staffReq[shift]?.[w] || 0;
        const current = currentCounts[shift] || 0;

        // 1. 連續性 (最高優先級)
        if (shift === prev && shift !== 'OFF') {
            score += 200; // 強烈鼓勵連班 (DD, EE, NN)
        }

        // 2. 避免花花班
        if (shift !== prev && prev !== 'OFF' && shift !== 'OFF') {
            score -= 50; // 懲罰換班 (如 D->E)
        }

        // 3. 人力需求
        if (shift !== 'OFF' && current < shiftReq) score += BASE_WEIGHTS.NEED_HIGH;

        return score;
    }
}
