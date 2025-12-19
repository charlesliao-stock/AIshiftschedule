// js/services/ScoringService.js

export class ScoringService {
    
    /**
     * 1. 定義預設評分設定 (14 項指標)
     * 這裡定義了 UI 上會顯示的所有結構與預設值
     */
    static getDefaultConfig() {
        const standardLabels = ['優', '佳', '良', '可', '平'];

        return {
            fairness: {
                label: "1. 公平性指標",
                subs: {
                    hoursDiff: { 
                        label: "(1) 工時差異 (標準差)", desc: "所有員工工時與平均工時的標準差", weight: 10, enabled: true, 
                        tiers: [{limit: 2, score: 100, label: standardLabels[0]}, {limit: 4, score: 80, label: standardLabels[1]}, {limit: 6, score: 60, label: standardLabels[2]}, {limit: 8, score: 40, label: standardLabels[3]}, {limit: 999, score: 20, label: standardLabels[4]}]
                    },
                    nightDiff: { 
                        label: "(2) 夜班差異 (次數)", desc: "員工之間夜班天數的極差 (Max - Min)", weight: 10, enabled: true,
                        excludeBatch: true, // 預設排除包班
                        tiers: [{limit: 1, score: 100, label: standardLabels[0]}, {limit: 2, score: 80, label: standardLabels[1]}, {limit: 3, score: 60, label: standardLabels[2]}, {limit: 4, score: 40, label: standardLabels[3]}, {limit: 999, score: 20, label: standardLabels[4]}]
                    },
                    holidayDiff: { 
                        label: "(3) 假日差異 (天數)", desc: "員工之間假日上班天數的極差", weight: 10, enabled: true,
                        tiers: [{limit: 1, score: 100, label: standardLabels[0]}, {limit: 2, score: 80, label: standardLabels[1]}, {limit: 3, score: 60, label: standardLabels[2]}, {limit: 4, score: 40, label: standardLabels[3]}, {limit: 999, score: 20, label: standardLabels[4]}]
                    }
                }
            },
            satisfaction: {
                label: "2. 滿意度指標",
                subs: {
                    wishRate: { 
                        label: "(4) 預班達成率 (%)", desc: "員工提出的預班需求被滿足的比例", weight: 20, enabled: true,
                        tiers: [{limit: 100, score: 100, label: '完美'}, {limit: 95, score: 80, label: '優'}, {limit: 90, score: 60, label: '良'}, {limit: 80, score: 40, label: '可'}, {limit: 0, score: 0, label: '差'}]
                    },
                    prefRate: { 
                        label: "(5) 偏好滿足率 (%)", desc: "符合員工 P1/P2 偏好的比例", weight: 10, enabled: true,
                        tiers: [{limit: 90, score: 100, label: '優'}, {limit: 80, score: 80, label: '佳'}, {limit: 70, score: 60, label: '良'}, {limit: 60, score: 40, label: '可'}, {limit: 0, score: 20, label: '平'}]
                    }
                }
            },
            health: {
                label: "3. 健康與工時",
                subs: {
                    consecutive: { 
                        label: "(6) 連續上班 (次)", desc: "連續上班超過 5 天的次數", weight: 10, enabled: true,
                        tiers: [{limit: 0, score: 100, label: '完美'}, {limit: 1, score: 80, label: '尚可'}, {limit: 3, score: 60, label: '注意'}, {limit: 5, score: 40, label: '警告'}, {limit: 999, score: 0, label: '危險'}]
                    },
                    shiftInterval: { 
                        label: "(7) 花花班 (次)", desc: "班別轉換過於頻繁 (如 N-D-E)", weight: 10, enabled: true,
                        tiers: [{limit: 0, score: 100, label: '無'}, {limit: 2, score: 80, label: '少'}, {limit: 4, score: 60, label: '中'}, {limit: 6, score: 40, label: '多'}, {limit: 999, score: 20, label: '極多'}]
                    }
                }
            },
            efficiency: {
                label: "4. 運作效率",
                subs: {
                    shortage: { 
                        label: "(8) 人力缺口 (%)", desc: "未滿足每日最低人力需求的比例", weight: 15, enabled: true,
                        tiers: [{limit: 0, score: 100, label: '無缺口'}, {limit: 2, score: 80, label: '微缺'}, {limit: 5, score: 60, label: '缺人'}, {limit: 10, score: 40, label: '嚴重'}, {limit: 100, score: 0, label: '崩潰'}]
                    },
                    seniority: { 
                        label: "(9) 資深分佈 (%)", desc: "每日班表中資深人員不足的比例", weight: 5, enabled: true,
                        tiers: [{limit: 0, score: 100, label: '均衡'}, {limit: 10, score: 80, label: '佳'}, {limit: 20, score: 60, label: '良'}, {limit: 30, score: 40, label: '差'}, {limit: 100, score: 20, label: '極差'}]
                    }
                }
            }
        };
    }

    /**
     * 2. 計算評分 (供 SchedulePage 呼叫)
     * 這邊簡化邏輯，僅示意如何讀取 tiers 進行評分
     */
    static calculate(schedule, staffList, unitSettings, preSchedule) {
        // ... (保留原本的計算邏輯，或待後續 AI 排班整合時使用)
        // 這裡為了讓 RuleSettings 運作，只需要 getDefaultConfig
        return { totalScore: 0, details: {} }; 
    }
}
