# 排班不平均问题诊断报告

## 问题描述

从用户提供的排班结果截图可以看出，员工之间的班次分配存在明显的不平衡现象：

- 某些员工的 OFF（休假）天数明显较多（如：李易澄 22天，许佑佑 22天）
- 某些员工的 OFF 天数明显较少（如：郭力瑄 0天，曾都云 0天，曾嘉堂 0天）
- 小夜班次分配不均（范围从 1-22 天）
- 大夜班次分配不均（范围从 0-20 天）

## 代码分析

### 当前算法架构（AutoScheduler.js v2.2）

算法采用**逐日排班**策略，主要流程：

1. **Step 1: 准备阶段** - 计算总人力需求和平均休假目标
2. **Step 2A: 逐日排班** - 每天按以下顺序处理：
   - 检查预班（预先提交的班次需求）
   - 生成白名单（根据员工限制和偏好）
   - 过滤违规选项（连续工作天数、班次间隔）
   - 尝试延续前一天班次
   - 填补空白（分配剩余人员）
3. **Step 2B: 回溯标记 OFF** - 处理人力过剩情况
4. **Step 3: 月底收尾** - 填补未分配的日期
5. **Global Balance: 全月总平衡** - 尝试平衡极端值

### 已有的平衡机制

代码中已经实现了三个平衡机制：

#### 1. 基于负载的排序（第 139-146 行）
```javascript
const sortedStaff = [...staffList].sort((a, b) => {
    const offA = context.stats[a.uid].OFF;
    const offB = context.stats[b.uid].OFF;
    const rateA = offA / Math.max(1, day - 1);
    const rateB = offB / Math.max(1, day - 1);
    return rateB - rateA; // OFF 多的先处理
});
```
**问题**：这个排序让 OFF 多的人**先处理**，意图是让他们优先被分配工作。但实际效果可能不理想。

#### 2. blankList 排序（第 266-270 行）
```javascript
blankList.sort((a, b) => {
    const offA = context.stats[a.staff.uid].OFF;
    const offB = context.stats[b.staff.uid].OFF;
    return offB - offA; // OFF 多的排前面
});
```
**问题**：同样让 OFF 多的人优先选班，但如果人力需求已满，他们还是会被分配 OFF。

#### 3. 全月总平衡（第 366-395 行）
```javascript
static globalBalance(context) {
    const sorted = [...staffList].sort((a, b) => stats[a.uid].OFF - stats[b.uid].OFF);
    const overworked = sorted.slice(0, Math.floor(sorted.length / 3));
    const underworked = sorted.slice(-Math.floor(sorted.length / 3)).reverse();
    // 尝试交换班次
}
```
**问题**：
- 只处理前 1/3 和后 1/3 的极端值
- 每个过劳员工只交换一天就停止（第 388 行的 return）
- 交换逻辑过于保守

## 根本原因分析

### 1. **逐日排班的局限性**
逐日排班是一种**贪心算法**，每天做局部最优决策，但无法保证全月的全局最优。当某个员工在月初因为各种原因（预班、偏好、连续工作限制）多次被分配 OFF 后，后续很难追回平衡。

### 2. **排序逻辑的矛盾**
- 在 `step2A_ScheduleToday` 中，OFF 多的人**先处理**
- 但"先处理"意味着优先进入 `checkPreSchedule`、`tryContinuePreviousShift` 等流程
- 如果这些流程让他们继续休假或延续前一天的班次，反而加剧不平衡
- 真正能平衡的是 `fillBlanks` 阶段，但此时人力需求可能已经被填满

### 3. **globalBalance 效果有限**
- 只交换一天就停止，对于差距 20+ 天的情况杯水车薪
- 没有考虑班次类型的平衡（D、E、N 的分配）
- 只关注 OFF 数量，没有关注工作日的质量（如连续工作天数）

### 4. **偏好过滤过于严格**
在 `generateWhitelist` 中（第 206-211 行）：
```javascript
if (p1 || p2) {
    const preferred = ['OFF'];
    if (p1 && list.includes(p1)) preferred.push(p1);
    if (p2 && list.includes(p2)) preferred.push(p2);
    list = preferred;
}
```
如果员工有偏好设置，白名单会被严格限制为 `['OFF', p1, p2]`。这可能导致：
- 偏好 E 班的员工如果 E 班已满，只能被分配 OFF
- 长期累积导致严重不平衡

### 5. **缺乏全局约束**
算法没有设置硬性的平衡约束，例如：
- 每个员工的 OFF 天数不应超过平均值 ±X 天
- 每个员工的特定班次（D/E/N）不应超过平均值 ±Y 天

## 改进方向

### 短期改进（优化现有算法）
1. **反转排序逻辑**：让 OFF **少**的人优先处理，优先给他们分配 OFF
2. **增强 globalBalance**：
   - 增加迭代次数
   - 扩大处理范围（不只是前后 1/3）
   - 同时平衡 D、E、N 班次
3. **放宽偏好限制**：当平衡度超过阈值时，临时忽略偏好
4. **添加平衡检查点**：每周检查一次平衡度，及时调整

### 长期改进（算法重构）
1. **采用约束满足问题（CSP）求解器**
2. **使用遗传算法或模拟退火**进行全局优化
3. **引入多目标优化框架**，平衡公平性、满意度、规律性

## 建议实施方案

基于现有代码结构，建议采用**短期改进**方案，具体包括：

1. **修正排序逻辑**（最关键）
2. **增强 globalBalance 函数**
3. **添加平衡度监控和日志**
4. **可选：添加"平衡模式"开关**，在平衡模式下临时放宽偏好限制

这些改进可以在不破坏现有架构的前提下，显著提升排班的公平性。
