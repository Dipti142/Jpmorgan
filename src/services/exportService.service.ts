import { createObjectCsvStringifier } from "csv-writer";
import Excel from "exceljs";

export async function exportData(response: any, type: string, data: any[], columns: string[], filePrefix: string, exportFileName: string = "") {
    try {
        const fileDownloadTime = Date.now();
        const fileName = exportFileName?.trim() || `${filePrefix}-${fileDownloadTime}.${type}`;
        switch (type) {
            case "xlsx":
                await exportToExcel(response, data, columns, filePrefix, fileName);
                break;
            case "csv":
                await exportToCsv(response, data, columns, fileName);
                break;
            default:
                response.errorResponse("Invalid format.");
        }
    } catch (error) {
        console.error("Error while exporting data:", error);
        throw error;
    }
}

async function exportToExcel(response: any, data: any[], columns: string[], filePrefix: string, fileName: string) {
    setExcelHeaders(response, fileName);
    const workbook = new Excel.stream.xlsx.WorkbookWriter({
        stream: response,
        useStyles: false,
        useSharedStrings: false,
    });
    const worksheet = workbook.addWorksheet(filePrefix, {
        pageSetup: {
            paperSize: 9,
            orientation: "landscape",
            fitToPage: true,
            fitToHeight: 1,
            fitToWidth: 1,
        },
    });
    const dataKeys = data.length > 0 ? Object.keys(data[0]) : [];
    worksheet.columns = columns.map((heading, index) => ({
        header: heading,
        key: dataKeys[index] || `col_${index}`,
        width: 20,
    }));
    styleExcelHeader(worksheet);
    const CHUNK_SIZE = 1000;
    let processedRows = 0;
    for (let i = 0; i < data.length; i += CHUNK_SIZE) {
        const chunk = data.slice(i, i + CHUNK_SIZE);
        processedRows = writeExcelChunk(worksheet, chunk, processedRows);
    }
    worksheet.commit();
    await workbook.commit();
}

async function exportToCsv(response: any, data: any[], columns: string[], fileName: string) {
    const dataKeys = data.length > 0 ? Object.keys(data[0]) : [];
    const csvStringifier = createObjectCsvStringifier({
        header: columns.map((heading, index) => ({
            id: dataKeys[index] || `col_${index}`,
            title: heading,
        })),
    });
    setCsvHeaders(response, fileName);
    response.write("\uFEFF");
    response.write(csvStringifier.getHeaderString());
    const CSV_CHUNK_SIZE = 2000;
    for (let i = 0; i < data.length; i += CSV_CHUNK_SIZE) {
        const chunk = data.slice(i, i + CSV_CHUNK_SIZE);
        response.write(csvStringifier.stringifyRecords(chunk));
        if (data.length > 10000 && i % 10000 === 0) {
            await new Promise((resolve) => setImmediate(resolve));
        }
    }
    response.end();
}

function setExcelHeaders(response: any, fileName: string) {
    response.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    response.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    response.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    response.setHeader("Pragma", "no-cache");
    response.setHeader("Expires", "0");
}

function setCsvHeaders(response: any, fileName: string) {
    response.setHeader("Content-Type", "text/csv; charset=utf-8");
    response.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    response.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
}

function styleExcelHeader(worksheet: any) {
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE0E0E0" },
    };
    headerRow.commit();
}

function writeExcelChunk(worksheet: any, chunk: any[], processedRows: number): number {
    for (const record of chunk) {
        const row = worksheet.addRow(record);
        if (processedRows % 2 === 0) {
            row.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: "FFF8F8F8" },
            };
        }
        row.commit();
        processedRows++;
    }
    return processedRows;
}
