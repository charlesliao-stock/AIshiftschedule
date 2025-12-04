/**
 * js/modules/statistics/export-report.js
 * 報表匯出功能（PDF/Excel/CSV）
 * Week 7 功能
 */

export class ExportReport {
    constructor() {
        this.jspdf = null;
        this.xlsx = null;
    }

    async init() {
        // 動態載入外部函式庫（如需要）
        // 這裡假設已經在 HTML 中引入了 jsPDF 和 SheetJS
    }

    /**
     * 匯出報表（主要入口）
     */
    async export(data, format, filename) {
        try {
            switch (format.toLowerCase()) {
                case 'pdf':
                    await this.exportPDF(data, filename);
                    break;
                case 'excel':
                case 'xlsx':
                    await this.exportExcel(data, filename);
                    break;
                case 'csv':
                    await this.exportCSV(data, filename);
                    break;
                default:
                    throw new Error('不支援的匯出格式：' + format);
            }
        } catch (error) {
            console.error('匯出失敗:', error);
            throw error;
        }
    }

    /**
     * 匯出 PDF
     */
    async exportPDF(data, filename) {
        // 檢查是否有 jsPDF
        if (typeof window.jsPDF === 'undefined') {
            throw new Error('jsPDF 未載入，請確認已引入函式庫');
        }

        const { jsPDF } = window.jsPDF;
        const doc = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4'
        });

        // 設定中文字型（如果有支援）
        // doc.addFont('path/to/font.ttf', 'CustomFont', 'normal');
        // doc.setFont('CustomFont');

        let yPos = 20;

        // 標題
        doc.setFontSize(18);
        doc.text(data.title || '統計報表', 105, yPos, { align: 'center' });
        yPos += 15;

        // 月份
        doc.setFontSize(12);
        doc.text(`統計期間：${this.formatMonth(data.month)}`, 20, yPos);
        yPos += 10;

        // 分隔線
        doc.line(20, yPos, 190, yPos);
        yPos += 10;

        // 根據資料類型渲染不同內容
        if (data.type === 'personal') {
            yPos = this.renderPersonalStatsPDF(doc, data, yPos);
        } else if (data.type === 'unit') {
            yPos = this.renderUnitStatsPDF(doc, data, yPos);
        }

        // 頁尾
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(10);
            doc.text(
                `第 ${i} 頁，共 ${pageCount} 頁`,
                105,
                287,
                { align: 'center' }
            );
            doc.text(
                `列印時間：${new Date().toLocaleString('zh-TW')}`,
                190,
                287,
                { align: 'right' }
            );
        }

        // 下載
        doc.save(`${filename}.pdf`);
    }

    /**
     * 渲染個人統計 PDF
     */
    renderPersonalStatsPDF(doc, data, yPos) {
        doc.setFontSize(14);
        doc.text('基本統計', 20, yPos);
        yPos += 8;

        doc.setFontSize(11);
        const basicStats = [
            ['總工作天數', `${data.basic.workDays} 天`],
            ['休假天數', `${data.basic.offDays} 天`],
            ['加班天數', `${data.basic.overtimeDays} 天`],
            ['假日上班', `${data.holidays.holidayWorkDays} 天`]
        ];

        basicStats.forEach(([label, value]) => {
            doc.text(label + '：', 25, yPos);
            doc.text(value, 80, yPos);
            yPos += 7;
        });

        yPos += 5;

        // 班別統計
        doc.setFontSize(14);
        doc.text('班別統計', 20, yPos);
        yPos += 8;

        doc.setFontSize(11);
        if (data.shifts) {
            Object.keys(data.shifts).forEach(shift => {
                doc.text(`${shift} 班：`, 25, yPos);
                doc.text(`${data.shifts[shift]} 天`, 80, yPos);
                yPos += 7;
            });
        }

        return yPos;
    }

    /**
     * 渲染單位統計 PDF
     */
    renderUnitStatsPDF(doc, data, yPos) {
        doc.setFontSize(14);
        doc.text('單位總覽', 20, yPos);
        yPos += 8;

        doc.setFontSize(11);
        const overview = [
            ['總員工數', `${data.overview.totalStaff} 人`],
            ['排班天數', `${data.overview.activeDays} 天`],
            ['完成率', `${data.overview.completionRate}%`],
            ['合規率', `${data.complianceReport.complianceRate}%`]
        ];

        overview.forEach(([label, value]) => {
            doc.text(label + '：', 25, yPos);
            doc.text(value, 80, yPos);
            yPos += 7;
        });

        yPos += 10;

        // 員工統計表格（簡化版）
        doc.setFontSize(14);
        doc.text('員工統計', 20, yPos);
        yPos += 8;

        doc.setFontSize(9);
        
        // 表頭
        const headers = ['姓名', '工作', '休假', '加班', '假日'];
        const colWidths = [40, 20, 20, 20, 20];
        let xPos = 20;

        headers.forEach((header, i) => {
            doc.text(header, xPos, yPos);
            xPos += colWidths[i];
        });

        yPos += 5;
        doc.line(20, yPos, 140, yPos);
        yPos += 5;

        // 表格資料（最多顯示前 20 筆）
        if (data.staffStats) {
            data.staffStats.slice(0, 20).forEach(staff => {
                xPos = 20;
                const row = [
                    staff.name,
                    staff.workDays,
                    staff.offDays,
                    staff.overtimeDays,
                    staff.holidayWork
                ];

                row.forEach((cell, i) => {
                    doc.text(String(cell), xPos, yPos);
                    xPos += colWidths[i];
                });

                yPos += 5;

                // 換頁檢查
                if (yPos > 270) {
                    doc.addPage();
                    yPos = 20;
                }
            });
        }

        return yPos;
    }

    /**
     * 匯出 Excel
     */
    async exportExcel(data, filename) {
        // 檢查是否有 SheetJS (xlsx)
        if (typeof window.XLSX === 'undefined') {
            throw new Error('SheetJS 未載入，請確認已引入函式庫');
        }

        const XLSX = window.XLSX;
        const workbook = XLSX.utils.book_new();

        // 根據資料類型建立工作表
        if (data.type === 'personal') {
            this.createPersonalStatsSheet(workbook, data);
        } else if (data.type === 'unit') {
            this.createUnitStatsSheets(workbook, data);
        }

        // 匯出
        XLSX.writeFile(workbook, `${filename}.xlsx`);
    }

    /**
     * 建立個人統計工作表
     */
    createPersonalStatsSheet(workbook, data) {
        const sheetData = [];

        // 標題
        sheetData.push(['個人統計報表']);
        sheetData.push([`統計期間：${this.formatMonth(data.month)}`]);
        sheetData.push([`員工姓名：${data.staffName}`]);
        sheetData.push([]);

        // 基本統計
        sheetData.push(['基本統計']);
        sheetData.push(['項目', '數值']);
        sheetData.push(['總工作天數', data.basic.workDays + ' 天']);
        sheetData.push(['休假天數', data.basic.offDays + ' 天']);
        sheetData.push(['加班天數', data.basic.overtimeDays + ' 天']);
        sheetData.push(['假日上班', data.holidays.holidayWorkDays + ' 天']);
        sheetData.push([]);

        // 班別統計
        sheetData.push(['班別統計']);
        sheetData.push(['班別', '天數']);
        if (data.shifts) {
            Object.keys(data.shifts).forEach(shift => {
                sheetData.push([shift, data.shifts[shift]]);
            });
        }
        sheetData.push([]);

        // 工作負荷
        sheetData.push(['工作負荷']);
        sheetData.push(['項目', '數值']);
        sheetData.push(['最長連續工作', data.workload.maxConsecutive + ' 天']);
        sheetData.push(['平均連續工作', data.workload.avgConsecutive + ' 天']);

        const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
        
        // 設定欄寬
        worksheet['!cols'] = [
            { wch: 20 },
            { wch: 15 }
        ];

        XLSX.utils.book_append_sheet(workbook, worksheet, '個人統計');
    }

    /**
     * 建立單位統計工作表
     */
    createUnitStatsSheets(workbook, data) {
        // 工作表 1: 總覽
        const overviewData = [
            ['單位統計報表'],
            [`統計期間：${this.formatMonth(data.month)}`],
            [],
            ['單位總覽'],
            ['項目', '數值'],
            ['總員工數', data.overview.totalStaff + ' 人'],
            ['排班天數', data.overview.activeDays + ' 天'],
            ['完成率', data.overview.completionRate + '%'],
            ['合規率', data.complianceReport.complianceRate + '%']
        ];

        const overviewSheet = XLSX.utils.aoa_to_sheet(overviewData);
        overviewSheet['!cols'] = [{ wch: 20 }, { wch: 15 }];
        XLSX.utils.book_append_sheet(workbook, overviewSheet, '總覽');

        // 工作表 2: 員工統計
        if (data.staffStats) {
            const staffData = [
                ['員工統計'],
                [],
                ['姓名', '組別', '工作天數', '休假', '加班', '假日', '最長連續', '問題數']
            ];

            data.staffStats.forEach(staff => {
                staffData.push([
                    staff.name,
                    staff.group,
                    staff.workDays,
                    staff.offDays,
                    staff.overtimeDays,
                    staff.holidayWork,
                    staff.maxConsecutive,
                    staff.issues.length
                ]);
            });

            const staffSheet = XLSX.utils.aoa_to_sheet(staffData);
            staffSheet['!cols'] = [
                { wch: 15 },
                { wch: 12 },
                { wch: 12 },
                { wch: 10 },
                { wch: 10 },
                { wch: 10 },
                { wch: 12 },
                { wch: 10 }
            ];
            XLSX.utils.book_append_sheet(workbook, staffSheet, '員工統計');
        }

        // 工作表 3: 班別分布
        if (data.shiftDistribution) {
            const shiftData = [
                ['班別分布'],
                [],
                ['班別', '名稱', '次數', '百分比']
            ];

            Object.keys(data.shiftDistribution).forEach(code => {
                const shift = data.shiftDistribution[code];
                shiftData.push([
                    code,
                    shift.name,
                    shift.count,
                    shift.percentage + '%'
                ]);
            });

            const shiftSheet = XLSX.utils.aoa_to_sheet(shiftData);
            shiftSheet['!cols'] = [
                { wch: 10 },
                { wch: 15 },
                { wch: 10 },
                { wch: 12 }
            ];
            XLSX.utils.book_append_sheet(workbook, shiftSheet, '班別分布');
        }

        // 工作表 4: 合規性問題
        if (data.complianceReport && data.complianceReport.issues.length > 0) {
            const issueData = [
                ['合規性問題'],
                [],
                ['嚴重度', '員工', '問題描述']
            ];

            data.complianceReport.issues.forEach(issue => {
                issueData.push([
                    issue.severity,
                    issue.staffName,
                    issue.message
                ]);
            });

            const issueSheet = XLSX.utils.aoa_to_sheet(issueData);
            issueSheet['!cols'] = [
                { wch: 12 },
                { wch: 15 },
                { wch: 50 }
            ];
            XLSX.utils.book_append_sheet(workbook, issueSheet, '合規性問題');
        }
    }

    /**
     * 匯出 CSV
     */
    async exportCSV(data, filename) {
        let csvContent = '';

        // BOM for UTF-8 (Excel 正確顯示中文)
        csvContent = '\uFEFF';

        // 標題
        csvContent += `"${data.title || '統計報表'}"\n`;
        csvContent += `"統計期間","${this.formatMonth(data.month)}"\n`;
        csvContent += '\n';

        // 根據資料類型生成 CSV
        if (data.type === 'personal') {
            csvContent += this.generatePersonalStatsCSV(data);
        } else if (data.type === 'unit') {
            csvContent += this.generateUnitStatsCSV(data);
        }

        // 下載
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        
        link.setAttribute('href', url);
        link.setAttribute('download', `${filename}.csv`);
        link.style.visibility = 'hidden';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    /**
     * 生成個人統計 CSV
     */
    generatePersonalStatsCSV(data) {
        let csv = '';

        // 基本統計
        csv += '"基本統計"\n';
        csv += '"項目","數值"\n';
        csv += `"總工作天數","${data.basic.workDays} 天"\n`;
        csv += `"休假天數","${data.basic.offDays} 天"\n`;
        csv += `"加班天數","${data.basic.overtimeDays} 天"\n`;
        csv += `"假日上班","${data.holidays.holidayWorkDays} 天"\n`;
        csv += '\n';

        // 班別統計
        csv += '"班別統計"\n';
        csv += '"班別","天數"\n';
        if (data.shifts) {
            Object.keys(data.shifts).forEach(shift => {
                csv += `"${shift}","${data.shifts[shift]}"\n`;
            });
        }
        csv += '\n';

        // 工作負荷
        csv += '"工作負荷"\n';
        csv += `"最長連續工作","${data.workload.maxConsecutive} 天"\n`;
        csv += `"平均連續工作","${data.workload.avgConsecutive} 天"\n`;

        return csv;
    }

    /**
     * 生成單位統計 CSV
     */
    generateUnitStatsCSV(data) {
        let csv = '';

        // 單位總覽
        csv += '"單位總覽"\n';
        csv += '"項目","數值"\n';
        csv += `"總員工數","${data.overview.totalStaff} 人"\n`;
        csv += `"排班天數","${data.overview.activeDays} 天"\n`;
        csv += `"完成率","${data.overview.completionRate}%"\n`;
        csv += `"合規率","${data.complianceReport.complianceRate}%"\n`;
        csv += '\n';

        // 員工統計
        csv += '"員工統計"\n';
        csv += '"姓名","組別","工作天數","休假","加班","假日","最長連續","問題數"\n';
        
        if (data.staffStats) {
            data.staffStats.forEach(staff => {
                csv += `"${staff.name}","${staff.group}","${staff.workDays}","${staff.offDays}","${staff.overtimeDays}","${staff.holidayWork}","${staff.maxConsecutive}","${staff.issues.length}"\n`;
            });
        }

        return csv;
    }

    /**
     * 格式化月份
     */
    formatMonth(month) {
        if (!month) return '';
        const year = month.substring(0, 4);
        const monthNum = month.substring(4, 6);
        return `${year}年${monthNum}月`;
    }

    /**
     * 輔助函數：CSV 轉義
     */
    escapeCSV(value) {
        if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
            return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
    }

    /**
     * 清理資源
     */
    destroy() {
        // 清理
    }
}
