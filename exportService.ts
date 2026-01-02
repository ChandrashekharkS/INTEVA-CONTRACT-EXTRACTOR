
import type { Document, ExtractedData } from '../types';

declare const ExcelJS: any;

const API_BASE_URL = '/api';

const escapeCsvCell = (cell: string | undefined | null): string => {
    if (cell === undefined || cell === null) {
        return '';
    }
    const str = String(cell);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
}

export const exportToCsv = (documents: Document[]): void => {
    const headers = [
        'Document Name', 'Language', 'Processed By', 'Processed Date',
        'Contract Number', 'Amendment Number', 'Part Number', 'Part Description', 'Program Name',
        'Drawing Number', 'Less Finish Part Number', 'Issue Date', 'Effective Date', 'Sample Required By',
        'LBE', 'Seller Name and Address', 'DUNS Number', 'Manufacturing DUNS Number', 'Buyer Name and Address',
        'Client Name', 'Purchasing Contact', 'Buyer Code', 'Account Manager', 'Mailing Address Information',
        'Manufacturing Location', 'Shipping To', 'Freight Terms', 'Delivery Terms', 'Delivery DUNS',
        'Ship From DUNS', 'Daily Capacity', 'Hours Per Day', 'Container Type', 'Receiving Plants',
        'Currency', 'Base Price', 'Total Price', 'Unit of Measure', 'Payment Terms', 'Reason for Issuing',
        'Hazardous Material Indicator', 'Raw Material Cert Analysis', 'Raw Material Annual Cert'
    ];

    const rows = documents.map(doc => [
        doc.name, doc.language, doc.processedBy, doc.processedDate,
        doc.data?.contractNumber, doc.data?.amendmentNumber, doc.data?.partNumber, doc.data?.partDescription, doc.data?.programName,
        doc.data?.drawingNumber, doc.data?.lessFinishPartNumber, doc.data?.issueDate, doc.data?.effectiveDate, doc.data?.sampleRequiredBy,
        doc.data?.lbe, doc.data?.sellerNameAndAddress, doc.data?.dunsNumber, doc.data?.manufacturingDunsNumber, doc.data?.buyerNameAndAddress,
        doc.data?.clientName, doc.data?.purchasingContact, doc.data?.buyerCode, doc.data?.accountManager, doc.data?.mailingAddressInformation,
        doc.data?.manufacturingLocation, doc.data?.shippingTo, doc.data?.freightTerms, doc.data?.deliveryTerms, doc.data?.deliveryDuns,
        doc.data?.shipFromDuns, doc.data?.dailyCapacity, doc.data?.hoursPerDay, doc.data?.containerType, doc.data?.receivingPlants,
        doc.data?.currency, doc.data?.basePrice, doc.data?.totalPrice, doc.data?.unitOfMeasure, doc.data?.paymentTerms, doc.data?.reasonForIssuing,
        doc.data?.hazardousMaterialIndicator, doc.data?.rawMaterialCertAnalysis, doc.data?.rawMaterialAnnualCert
    ].map(escapeCsvCell));

    const csvContent = [
        headers.join(','),
        ...rows.map(row => row.join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'contract_data_export.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

export const exportToSql = async (documents: Document[]): Promise<string> => {
    const response = await fetch(`${API_BASE_URL}/contracts/batch`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(documents),
    });

    if (!response.ok) {
        const errorText = await response.text() || `Server responded with status ${response.status}`;
        throw new Error(`Failed to save documents to database. ${errorText}`);
    }
    
    const result = await response.json();
    return result.message || 'Documents saved successfully.';
};


// Updated function to export comparison results to Excel with styling
export const exportComparisonToExcel = async (
    documents: Document[], 
    differentFields: { key: keyof ExtractedData; label: string }[],
    similarFields: { key: keyof ExtractedData; label: string }[]
): Promise<void> => {
    if (typeof ExcelJS === 'undefined') {
        throw new Error('ExcelJS library not loaded. Please refresh the page.');
    }

    if (documents.length < 2) {
        throw new Error("Not enough data to generate a comparison report.");
    }

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Comparison');

    // 1. Headers
    const headers = ['Field', ...documents.map(doc => doc.name)];
    const headerRow = sheet.addRow(headers);
    headerRow.font = { bold: true };
    headerRow.eachCell((cell: any) => {
        cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFEEEEEE' } // Light Gray
        };
        cell.border = {
            bottom: { style: 'thin' }
        };
    });

    // Helper to add section rows
    const addRows = (fields: { key: keyof ExtractedData; label: string }[], isDifference: boolean) => {
        fields.forEach(field => {
            const rowData = [
                field.label,
                ...documents.map(doc => doc.data?.[field.key] || 'N/A')
            ];
            const row = sheet.addRow(rowData);
            
            if (isDifference) {
                // Style data cells (starting from 2nd column) with Red background
                for (let i = 2; i <= rowData.length; i++) {
                    const cell = row.getCell(i);
                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: 'FFFFC7CE' } // Light Red
                    };
                }
            }
        });
    };

    // 2. Add Differences
    if (differentFields.length > 0) {
        const sep = sheet.addRow(['Differences']);
        sep.font = { italic: true, bold: true, color: { argb: 'FFFF0000' } };
        addRows(differentFields, true);
        sheet.addRow([]); // Empty row
    }

    // 3. Add Similarities
    if (similarFields.length > 0) {
        const sep = sheet.addRow(['Similarities']);
        sep.font = { italic: true, bold: true, color: { argb: 'FF008000' } };
        addRows(similarFields, false);
    }

    // 4. Formatting Columns
    sheet.columns.forEach((column: any) => {
        column.width = 30; // Set explicit width
        column.alignment = { wrapText: true };
    });

    // 5. Generate and Download
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'contract_comparison.xlsx');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

// FIELDS Definition for Page Export
const PAGE_EXPORT_FIELDS: { key: keyof ExtractedData; label: string }[] = [
    { key: 'contractNumber', label: 'Contract Number' },
    { key: 'amendmentNumber', label: 'Amendment #' },
    { key: 'partNumber', label: 'Part Number' },
    { key: 'issueDate', label: 'Issue Date' },
    { key: 'effectiveDate', label: 'Effective Date' },
    { key: 'sellerNameAndAddress', label: 'Seller' },
    { key: 'buyerNameAndAddress', label: 'Buyer' },
    { key: 'dunsNumber', label: 'DUNS' },
    { key: 'mailingAddressInformation', label: 'Mailing Address' },
    { key: 'manufacturingLocation', label: 'Mfg Location' },
    { key: 'purchasingContact', label: 'Purchasing Contact' },
    { key: 'accountManager', label: 'Account Manager' },
    { key: 'buyerCode', label: 'Buyer Code' },
    { key: 'lbe', label: 'LBE' },
    { key: 'partDescription', label: 'Part Description' },
    { key: 'programName', label: 'Program Name' },
    { key: 'drawingNumber', label: 'Drawing Number' },
    { key: 'reasonForIssuing', label: 'Reason for Issuing' },
    { key: 'currency', label: 'Currency' },
    { key: 'basePrice', label: 'Base Price' },
    { key: 'totalPrice', label: 'Total Price' },
    { key: 'unitOfMeasure', label: 'UOM' },
    { key: 'paymentTerms', label: 'Payment Terms' },
    { key: 'freightTerms', label: 'Freight Terms' },
    { key: 'deliveryTerms', label: 'Delivery Terms' },
    { key: 'dailyCapacity', label: 'Daily Capacity' },
    { key: 'hoursPerDay', label: 'Hours Per Day' },
    { key: 'containerType', label: 'Container Type' },
    { key: 'shippingTo', label: 'Shipping To' },
    { key: 'receivingPlants', label: 'Receiving Plants' },
    { key: 'shipFromDuns', label: 'Ship From DUNS' },
    { key: 'deliveryDuns', label: 'Delivery DUNS' },
    { key: 'hazardousMaterialIndicator', label: 'HazMat' },
    { key: 'lessFinishPartNumber', label: 'Less Finish P/N' },
    { key: 'rawMaterialCertAnalysis', label: 'Raw Material Cert' },
    { key: 'rawMaterialAnnualCert', label: 'Annual Cert' },
    { key: 'sampleRequiredBy', label: 'Sample Required By' },
];

// NEW: Export Page Breakdown Matrix to EXCEL
export const exportDocumentPagesToExcel = async (doc: Document): Promise<void> => {
    if (typeof ExcelJS === 'undefined') {
        throw new Error('ExcelJS library not loaded. Please refresh the page.');
    }

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Page Breakdown');
    
    // Define Columns: Field + Page N...
    const pages = doc.data?.pages || [];
    
    const columns = [
        { header: 'Field', key: 'field', width: 30 },
        ...pages.map(p => ({ header: `Page ${p.pageNumber}`, key: `page_${p.pageNumber}`, width: 40 }))
    ];
    
    sheet.columns = columns;
    
    // Header Style
    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEEEEE' } };

    // Add Data Rows
    PAGE_EXPORT_FIELDS.forEach(f => {
        const rowData: any = { field: f.label };
        pages.forEach(p => {
            // @ts-ignore
            rowData[`page_${p.pageNumber}`] = p.fields?.[f.key] || '';
        });
        sheet.addRow(rowData);
    });
    
    // Style Rows: Alternating text wrapping
    sheet.eachRow((row: { alignment: { wrapText: boolean; vertical: string; }; }, rowNumber: number) => {
        if (rowNumber > 1) {
            row.alignment = { wrapText: true, vertical: 'top' };
        }
    });

    // Write file
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${doc.name.replace(/\.[^/.]+$/, "")}_pages.xlsx`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

// NEW: Export Page Breakdown Matrix to CSV
export const exportDocumentPagesToCsv = (doc: Document): void => {
    const pages = doc.data?.pages || [];
    
    // 1. Create Headers: Field, Page 1, Page 2...
    const headers = ['Field', ...pages.map(p => `Page ${p.pageNumber}`)];

    // 2. Create Data Rows
    const rows = PAGE_EXPORT_FIELDS.map(f => {
        const rowData = [f.label];
        pages.forEach(p => {
             // @ts-ignore
             rowData.push(p.fields?.[f.key] || '');
        });
        return rowData.map(escapeCsvCell);
    });

    // 3. Construct CSV
    const csvContent = [
        headers.join(','),
        ...rows.map(row => row.join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${doc.name.replace(/\.[^/.]+$/, "")}_pages.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

// Updated function to save comparison results to the REAL database via API
export const saveComparisonToDb = async (documents: Document[], differentFields: { key: keyof ExtractedData; label: string }[]): Promise<string> => {
    const comparisonData = {
        comparisonId: `comp-${Date.now()}`,
        comparisonDate: new Date().toISOString(),
        comparedDocumentIds: documents.map(d => d.id),
        differences: differentFields.map(field => ({
            field: field.label,
            values: documents.map(doc => ({ documentName: doc.name, value: doc.data?.[field.key] || 'N/A' }))
        }))
    };
    
    const response = await fetch(`${API_BASE_URL}/comparisons`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(comparisonData),
    });

    if (!response.ok) {
        throw new Error('Failed to save comparison to database.');
    }
    
    const result = await response.json();
    return result.message;
};
