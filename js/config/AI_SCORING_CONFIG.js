export const AI_SCORING_CONFIG = {
    // 策略預設權重
    STRATEGY_WEIGHTS: {
        A: {
            label: "方案 A: 數值平衡 (公平優先)",
            weights: {
                overwork: -200, // 工時標準差 (懲罰)
                shiftBalance: -150, // 休假標準差 (懲罰)
                pref: 100, // 偏好滿足 (獎勵)
                cons: -100, // 連續工作懲罰 (懲罰)
                nToD: -150, // 夜班接白班懲罰 (懲罰)
                coverage: 50, // 人力覆蓋 (獎勵)
            }
        },
        B: {
            label: "方案 B: 願望優先 (滿意度高)",
            weights: {
                overwork: -100,
                shiftBalance: -50,
                pref: 300, // 偏好權重最高
                cons: -50,
                nToD: -50,
                coverage: 100,
            }
        },
        C: {
            label: "方案 C: 規律作息 (減少換班)",
            weights: {
                overwork: -150,
                shiftBalance: -100,
                pref: 150,
                cons: -300, // 連續工作懲罰最高
                nToD: -300, // 夜班接白班懲罰最高
                coverage: 50,
            }
        }
    },

    // 評分項目結構 (用於 RuleSettings 介面和 ScoringService 評分計算)
    SCORING_CATEGORIES: {
        fairness: {
            label: "公平性指標",
            max: 30,
            items: [
                { key: 'overwork', label: '工時標準差', desc: '衡量員工總工時的公平性，標準差越小越好。', defaultWeight: -200, min: -500, max: -10, step: 10, weight: 15 },
                { key: 'shiftBalance', label: '休假標準差', desc: '衡量員工休假天數的公平性，標準差越小越好。', defaultWeight: -150, min: -500, max: -10, step: 10, weight: 15 },
            ]
        },
        satisfaction: {
            label: "滿意度指標",
            max: 35,
            items: [
                { key: 'pref', label: '偏好滿足度', desc: '衡量排班結果對員工偏好班別的滿足程度。', defaultWeight: 100, min: 10, max: 500, step: 10, weight: 35 },
            ]
        },
        regularity: {
            label: "規律作息指標",
            max: 25,
            items: [
                { key: 'cons', label: '連續工作懲罰', desc: '衡量連續工作天數超過上限的次數。', defaultWeight: -100, min: -500, max: -10, step: 10, weight: 15 },
                { key: 'nToD', label: '夜班接白班懲罰', desc: '衡量夜班後立即接白班的次數。', defaultWeight: -150, min: -500, max: -10, step: 10, weight: 10 },
            ]
        },
        efficiency: {
            label: "排班效率指標",
            max: 10,
            items: [
                { key: 'coverage', label: '人力覆蓋率', desc: '確保每日人力需求被滿足。', defaultWeight: 50, min: 10, max: 500, step: 10, weight: 10 },
            ]
        },
    }
};
