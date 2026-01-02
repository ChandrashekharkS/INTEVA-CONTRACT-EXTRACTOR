import type { ExtractedData, PageExtraction } from "../types";
import { extractTextFromFile } from './ocrService';

export const DEFAULT_OLLAMA_BASE_URL = 'http://localhost:11434';
export const DEFAULT_OLLAMA_MODEL = 'llama3.2';
export const DEFAULT_OLLAMA_TIMEOUT_SECONDS = 1800;

const MONTH_MAP: Record<string, string> = {
    'jan': '01', 'feb': '02', 'mar': '03', 'apr': '04', 'may': '05', 'jun': '06',
    'jul': '07', 'aug': '08', 'sep': '09', 'oct': '10', 'nov': '11', 'dec': '12',
    'january': '01', 'february': '02', 'march': '03', 'april': '04', 'may_': '05', 'june': '06',
    'july': '07', 'august': '08', 'september': '09', 'october': '10', 'november': '11', 'december': '12',
    'januar': '01', 'februar': '02', 'märz': '03', 'maerz': '03', 'mai': '05', 'juni': '06',
    'juli': '07', 'august_': '08', 'september_': '09', 'oktober': '10', 'november_': '11', 'dezember': '12',
    'enero': '01', 'febrero': '02', 'marzo': '03', 'abril': '04', 'mayo': '05', 'junio': '06',
    'julio': '07', 'agosto': '08', 'septiembre': '09', 'octubre': '10', 'noviembre': '11', 'diciembre': '12'
};

const KEYWORD_MAP = {
    contract: ['Contract No', 'Contract Number', 'Order No', 'PO No', 'Purchase Order', 'Vertrag Nr', 'Vertragsnummer', 'Contrat N', 'Pedido N', 'Contract', 'Bestellnummer', 'Bestellung Nr', 'Agreement No', 'Agreement Number', 'Scheduling Agreement', 'Contract Identification', 'P.O. Number', 'P.O. No', 'Order Number', 'Document Number', 'Ponum', 'Order Id'],
    part: ['Part No', 'Part Number', 'Item Code', 'Material No', 'P/N', 'Sachnummer', 'Teilenummer', 'Ref', 'Reference', 'Item', 'Artikelnummer', 'Código de pieza', 'Part #', 'Material', 'Item Number', 'Material Number', 'Our Part No', 'Your Part No', 'Material Id', 'Part Id'],
    date: ['Issue Date', 'Date', 'Dated', 'Datum', 'Fecha', 'Date d\'émission', 'Erstelldatum', 'Effective Date', 'Agreement Date', 'Entered into', 'Made on', 'Executed on', 'Signed on', 'As of', 'Date of Issue', 'Order Date', 'Creation Date'],
    amendment: ['Amendment', 'Amendment No', 'Amendment Number', 'Amendment #', 'Amnd', 'Amdt', 'Rev', 'Revision', 'Änderung', 'Versión', 'Amdt. No.', 'Change Level', 'Revision Level', 'Version'],
    client: ['Client', 'Client Name', 'Customer', 'Customer Name', 'Auftraggeber', 'Kunde', 'Prepared For', 'Sold To', 'Bill To', 'Invoice To', 'Rechnungsempfänger', 'Facturer à', 'Buyer'],
    buyer: ['BUYER NAME AND ADDRESS', 'Buyer Name and Address', 'BUYER NAME', 'Buyer Name', 'Buyer', 'Purchaser', 'Käufer', 'Acheteur', 'Comprador', 'Bill To', 'Sold To', 'Customer', 'Invoice Address', 'Bill-To Address', 'Buyer Address', 'Issued To'],
    seller: ['SELLER NAME AND ADDRESS', 'Seller Name and Address', 'SELLER NAME', 'Seller Name', 'Seller', 'Vendor', 'Supplier', 'Contractor', 'Vendor Address', 'Supplier Address', 'Vendor Name', 'Supplier Name'],
    program: ['Program', 'Program Name', 'Vehicle', 'Platform', 'Model', 'Project', 'Application', 'Vehicle Line', 'Usage', 'Program Description'],
    duns: ['DUNS', 'D-U-N-S', 'Dun & Bradstreet', 'Duns No', 'Duns Number', 'DUNS Code', 'Vendor Code', 'Supplier Code', 'Supplier No', 'Vendor No'],
    manager: ['Account Manager','Purchasing Contact', 'Contract Owner', 'Owner', 'Sales Contact', 'Sales Rep', 'Representative', 'Key Account Manager', 'Salesperson', 'Account Mgr', 'Program Manager', 'Commercial Contact', 'Seller Contact', 'Supplier contact', 'Contact Person', 'Prepared By', 'Buyer Contact', 'Administrator', 'Creator', 'Author', 'Sales Engineer', 'Inside Sales', 'Customer Service', 'Account Administrator', 'Contact Name', 'Submitted By'],
    price: ['Base Price', 'Unit Price', 'Piece Price', 'P/U', 'Price', 'Cost', 'Rate', 'Amount', 'Net Price', 'Unit Cost'],
    totalPrice: ['Total Price', 'Total Amount', 'Total Order Value', 'Total Cost', 'Extended Price', 'Grand Total', 'Total Value', 'Net Value', 'Order Total', 'Total'],
    rawCert: ['Raw Material Cert. Analysis', 'Raw Material Certification', 'Material Cert', 'Cert. Analysis', 'Certification', 'Material Specification'],
    annualCert: ['Raw Material Annual Cert.', 'Annual Certification', 'Annual Cert', 'Recertification'],
    lessFinish: ['Less Finish Part Number', 'Less Finish P/N', 'Less Finish Part No', 'LFPN', 'Base Part Number', 'Raw Part Number'],
    lbe: ['LBE', 'Legal Business Entity', 'Legal Entity', 'Business Entity', 'Entity', 'L.B.E.', 'LBE Code', 'Company Code', 'Purchasing Org', 'Organization Code', 'Org Code'],
    location: ['Manufacturing Location', 'Mfg Location', 'Plant Location', 'Ship From Address', 'Ship From', 'Origin', 'Location', 'Plant', 'Ship-From', 'Supplier Address', 'Shipping Point', 'Vendor Location', 'Factory', 'Site', 'Place of Manufacture'],
    shipFromDuns: ['Ship From DUNS', 'Ship From Duns', 'Supplier DUNS', 'Mfg DUNS', 'Manufacturing DUNS', 'Vendor DUNS', 'Ship-From DUNS', 'Origin DUNS'],
    deliveryDuns: ['Delivery DUNS', 'Ship To DUNS', 'Receiving DUNS', 'Destination DUNS'],
    paymentTerms: ['Payment Terms', 'Pay Terms', 'Terms of Payment', 'Payment', 'Terms'],
    freightTerms: ['Freight Terms', 'Incoterms', 'Shipping Terms', 'Delivery Terms', 'Trade Terms', 'Incoterm'],
    currency: ['Currency', 'Curr', 'Währung', 'Currency Code'],
    mailingAddress: ['Mailing Address Information', 'Mailing Address', 'Mail To', 'Correspondence Address', 'Postal Address', 'Send Notices To', 'Notices To', 'Bill To Address', 'Invoicing Address'],
    purchasingContact: ['Purchasing Contact', 'Buyer Contact', 'Purchasing Agent', 'Buyer Name', 'Contact', 'Buyer', 'Authorized By', 'Confirmed By'],
    drawingNumber: ['Drawing Number', 'Drawing No', 'Drwg No', 'Drawing', 'Blueprint', 'dwg', 'Engineering Level'],
    reasonForIssuing: ['Reason for Issuing Contract/Amendment', 'Reason for Issuing Contract / Amendment', 'Reason for Issuing', 'Reason', 'Purpose', 'Comments', 'Remarks', 'Description of Change', 'Notes', 'Change Description'],
    receivingPlants: ['Receiving Plants', 'Destination Plant', 'Receiving Location', 'Ship To', 'Delivery Address', 'Ship-To', 'Final Destination', 'Plant Code', 'Dock Code'],
    hazardous: ['Hazardous Material', 'Hazardous Material Indicator', 'HazMat', 'Dangerous Goods']
};

const formatDate = (dateStr: string): string => {
    if (!dateStr || dateStr === 'N/A') return 'N/A';
    try {
        let clean = dateStr.trim().replace(/[,]/g, '').toLowerCase();
        for (const [monthName, monthNum] of Object.entries(MONTH_MAP)) {
            if (clean.includes(monthName.replace('_', ''))) {
                clean = clean.replace(monthName.replace('_', ''), monthNum);
                break; 
            }
        }
        const euroMatch = clean.match(/(\d{1,2})[.\-\/](\d{1,2})[.\-\/](\d{2,4})/);
        if (euroMatch) {
            let d = euroMatch[1].padStart(2, '0');
            let m = euroMatch[2].padStart(2, '0');
            let y = euroMatch[3];
            if (y.length === 2) y = '20' + y;
            if (dateStr.includes('/') && !dateStr.includes('.')) {
                 if (parseInt(d) > 12) return `${y}-${m}-${d}`;
            }
            return `${y}-${m}-${d}`;
        }
        const d = new Date(dateStr);
        if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
        return dateStr;
    } catch { return dateStr; }
};

const extractCountryFromText = (text: string): string => {
    if (!text || text === 'N/A') return 'N/A';
    const cleanAddr = text.replace(/\r/g, '').trim();
    const upper = cleanAddr.toUpperCase();
    
    // Common Country List mapping to standardized names
    const countryMap: Record<string, string> = {
        'UNITED STATES': 'United States',
        'USA': 'United States',
        'U.S.A.': 'United States',
        'AMERICA': 'United States',
        'MEXICO': 'Mexico',
        'CHINA': 'China',
        'GERMANY': 'Germany',
        'DEUTSCHLAND': 'Germany',
        'FRANCE': 'France',
        'CANADA': 'Canada',
        'SPAIN': 'Spain',
        'ITALY': 'Italy',
        'JAPAN': 'Japan',
        'KOREA': 'Korea',
        'INDIA': 'India',
        'BRAZIL': 'Brazil',
        'UNITED KINGDOM': 'United Kingdom',
        'UK': 'United Kingdom',
        'ENGLAND': 'United Kingdom',
        'CZECH': 'Czech Republic',
        'POLAND': 'Poland',
        'HUNGARY': 'Hungary',
        'ROMANIA': 'Romania',
        'SOUTH AFRICA': 'South Africa',
        'SLOVAKIA': 'Slovakia',
        'PORTUGAL': 'Portugal',
        'TURKEY': 'Turkey',
        'MÜNCHEN': 'Germany',
        'MUNICH': 'Germany',
        'SALONTA': 'Romania',
        'DETROIT': 'United States',
        'TROY': 'United States',
        'JUAREZ': 'Mexico',
        'MATAMOROS': 'Mexico',
        'PUEBLA': 'Mexico',
        'SHANGHAI': 'China',
        'RYTON': 'United Kingdom',
        'BIRMINGHAM': 'United Kingdom',
        'VIGO': 'Spain',
        'RENNES': 'France'
    };

    const lines = cleanAddr.split('\n');
    const lastLine = lines[lines.length - 1].trim().toUpperCase();
    
    for (const [key, val] of Object.entries(countryMap)) {
        if (lastLine.includes(key)) return val;
    }

    for (const [key, val] of Object.entries(countryMap)) {
        if (upper.includes(key)) return val;
    }
    
    // Fallback: If last line looks like "City, Country" or just "Country", return it
    if (!/\d/.test(lastLine) && lastLine.length > 2) return lines[lines.length - 1].trim();
    
    return 'N/A';
};

const formatTagName = (tagName: string): string => {
    return tagName
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/_/g, ' ')
        .trim();
};

const flattenXmlToText = (xmlString: string): string => {
    try {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlString, "text/xml");
        const parserError = xmlDoc.getElementsByTagName("parsererror");
        if (parserError.length > 0) return xmlString;
        const lines: string[] = [];
        const walk = (node: Node) => {
            if (node.nodeType === 1) {
                const el = node as Element;
                const tagName = formatTagName(el.tagName);
                if (el.hasAttributes()) {
                     for (let i = 0; i < el.attributes.length; i++) {
                         const attr = el.attributes[i];
                         const attrName = formatTagName(attr.name);
                         lines.push(`${tagName} ${attrName}: ${attr.value}`);
                     }
                }
                let hasDirectText = false;
                for (let i = 0; i < el.childNodes.length; i++) {
                    const child = el.childNodes[i];
                    if (child.nodeType === 3 && child.textContent?.trim()) {
                        lines.push(`${tagName}: ${child.textContent.trim()}`);
                        hasDirectText = true;
                    } else if (child.nodeType === 1) {
                        walk(child);
                    }
                }
            }
        };
        if (xmlDoc.documentElement) walk(xmlDoc.documentElement);
        return lines.join('\n');
    } catch (e) {
        return xmlString;
    }
}

const cleanValue = (val: string): string => {
    let clean = val.replace(/^[:.\-#\s]+/, '');
    clean = clean.replace(/^(and address|information|details|contact)[:.\-\s]*/i, '');
    
    // Aggressive cleanup for "Reason for Issuing" variations
    // This strips variations that are often part of the OCR captured label
    clean = clean.replace(/^(reason\s+for\s+issuing\s+contract\s*[\/\\]\s*amendment|reason\s+for\s+issuing\s+contract|reason\s+for\s+issuing|for\s+issuing)[:.\-\s]*/i, '');
    clean = clean.replace(/^(contract\s*[\/\\]\s*amendment|contract\/amendment)[:.\-\s]*/i, '');

    // Aggressive cleanup for common foreign labels mis-captured as values
    clean = clean.replace(/^(Ancien Prix H\.T|d'application du prix|Designacion|Precio unitario|Divisa|Fecha|Vigencia)[:.\-\s]*/i, '');
    
    // Re-clean any leading separators that might have been exposed
    clean = clean.replace(/^[:.\-#\s]+/, '');

    // Heuristic: If there is still a colon in the first 40 chars, and the prefix looks like a label, split it.
    const colonMatch = clean.match(/^([^:]{1,40})[:](.*)/s);
    if (colonMatch) {
         const prefix = colonMatch[1].toLowerCase();
         if (prefix.includes('issuing') || prefix.includes('reason') || prefix.includes('contract') || prefix.includes('amendment') || prefix.includes('prix') || prefix.includes('date') || prefix.includes('precio')) {
             clean = colonMatch[2].trim();
         }
    }

    return clean.replace(/[;,.]$/, '').trim();
};

const isLegalText = (val: string): boolean => {
    const lower = val.toLowerCase();
    const legalTerms = ['agreement', 'contract', 'whereas', 'hereto', 'hereby', 'indemnify', 'liability', 'warrant', 'provision', 'statute', 'govern', 'law', 'accordance', 'behalf', 'execution', 'force', 'majeure', 'perform', 'obligations', 'terms and conditions'];
    if (lower.startsWith('is to correct')) return true;
    if (lower.startsWith('to obtain or retain')) return true;
    if (lower.startsWith('of the other for any')) return true;
    if (lower.startsWith('may, in writing')) return true;
    if (lower.startsWith('that is an ingredient')) return true;
    if (lower.startsWith('specified in this contract')) return true;
    if (lower.startsWith('is firm and not subject')) return true; 
    if (lower.startsWith('this contract is effective')) return true; 
    if (lower.includes('electronic data interchange')) return true;
    if (lower.includes('noncompliance')) return true;
    if (lower.includes('periodically')) return true;
    if (lower.includes('warranty')) return true;
    if (lower.includes('infringement')) return true;
    let count = 0;
    legalTerms.forEach(term => { if (lower.includes(term)) count++; });
    if (count >= 2) return true;
    if (val.split(' ').length > 60) return true; 
    return false;
};

const isLikelyName = (val: string): boolean => {
    if (!val || val.length < 2) return false;
    if (/[^a-zA-Z0-9\s,.-]/.test(val)) return false; 
    if (/^(The|This|Please|See|Refer|Attached|Subject|Regarding|Note)/i.test(val)) return false;
    if (/\d{5}/.test(val)) return false;
    return true;
};

const isValidValue = (val: string): boolean => {
    if (!val || val.length < 1) return false;
    const lower = val.toLowerCase();
    if (lower === 'and address' || lower === 'and address:' || lower === 'name and address') return false;
    if (lower === 'information' || lower === 'information:') return false;
    if (isLegalText(val)) return false;
    const invalidSubstrings = [
        'forecasted', 'quantity', 'comply', 'reference', 'incorporated', 'amended', 'utilizing', 
        'expressly', 'agreed', 'between', 'pursuant', 'supplier capacity', 'capacity to', 
        'change the', 'refer to', 'authorized by', 'electronically',
        'name and address', 'name & address', 'buyer name', 'seller name', 'shipping address',
        'buyer name and address', 'seller name and address', 'purchasing contact',
        'periodically', 'noncompliance', 'warranty', 'breach', 'indemnification', 'obligations',
    ];
    if (invalidSubstrings.some(s => lower.includes(s))) return false;
    if (val.indexOf(':') > -1 && val.indexOf(':') < 10) return false;
    if (/^[-_.]+$/.test(val)) return false;
    return true;
};

const scanLineForValue = (text: string, keys: string[]): string => {
    const lines = text.split('\n');
    for (const key of keys) {
        const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`(?:^|\\s)${escapedKey}[:.\\-\\s]+(.*)`, 'i');
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            const match = line.match(regex);
            if (match) {
                const val = cleanValue(match[1]);
                if (val && isValidValue(val)) return val;
            }
            const cleanLine = line.replace(/[:.\\-]/g, '').trim();
            if (cleanLine.toLowerCase().startsWith(key.toLowerCase()) && cleanLine.length < key.length + 20) {
                for (let k = 1; k <= 2; k++) {
                    if (i + k < lines.length) {
                        const nextLine = lines[i + k].trim();
                        if (nextLine.includes(':') && nextLine.indexOf(':') < 15) continue;
                        if (nextLine && isValidValue(nextLine) && !nextLine.toLowerCase().includes(key.toLowerCase())) {
                            return cleanValue(nextLine);
                        }
                    }
                }
            }
        }
    }
    return '';
};

const scanBlockForValue = (text: string, keys: string[], maxLines = 10): string => {
    const lines = text.split('\n');
    for (const key of keys) {
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const lowerLine = line.toLowerCase();
            const lowerKey = key.toLowerCase();
            const keyIndex = lowerLine.indexOf(lowerKey);

            if (keyIndex !== -1) {
                const prefix = line.substring(0, keyIndex);
                const prefixClean = prefix.trim();
                const suffix = line.substring(keyIndex + key.length).trim();
                
                const isRightColumn = (prefixClean.length > 4) || (prefix.length > 30); 
                let rest = suffix;

                if (/^(and address|information|contact|details|code|number|:)+$/i.test(rest.replace(/[:.]/g, ''))) {
                    rest = '';
                }

                let block: string[] = [];

                const processSegment = (segment: string): 'OK' | 'SKIP' | 'STOP' => {
                    if (!segment || !segment.trim()) return 'OK';
                    let clean = cleanValue(segment);
                    
                    if (/^[-_]{2,}$/.test(clean)) return 'SKIP';

                    let lower = clean.toLowerCase();
                    
                    if (lower.includes('duns') || lower.match(/\b\d{9,15}\b/)) {
                        clean = clean.replace(/duns(?:\s*(?:number|no|code|#))?[:.\s]*\d{9,15}/gi, '').trim();
                        clean = clean.replace(/duns[:.\s]*$/gi, '').trim(); 
                        if (!clean) return 'SKIP'; 
                        lower = clean.toLowerCase(); 
                    }

                    if (isLegalText(clean)) return 'STOP';
                    if (lower.startsWith('phone') || lower.startsWith('fax') || lower.startsWith('email')) return 'STOP';
                    if (lower.includes('mailing address') && !key.toLowerCase().includes('mailing')) return 'STOP';
                    if (lower.includes('purchasing contact') && !key.toLowerCase().includes('purchasing contact')) return 'STOP';
                    if (lower.startsWith('buyer code')) return 'STOP';
                    if (lower.includes('affected p/n') || lower.includes('affected part')) return 'STOP';
                    if (lower.startsWith('remit to')) return 'STOP';
                    if (lower.startsWith('tax id')) return 'STOP';
                    if (lower.startsWith('ship via')) return 'STOP';
                    if (lower.startsWith('f.o.b')) return 'STOP';
                    if (lower.startsWith('this contract is effective')) return 'STOP';
                    if (lower.startsWith('part description')) return 'STOP';
                    if (lower.startsWith('drawing number')) return 'STOP';
                    if (lower.startsWith('reason for issuing')) return 'STOP';
                    if (lower.startsWith('sample required')) return 'STOP';
                    if (lower.startsWith('hazardous material')) return 'STOP';
                    if (lower.startsWith('engineer change')) return 'STOP';
                    if (lower.startsWith('payment terms')) return 'STOP';
                    if (lower.startsWith('freight terms')) return 'STOP';
                    if (lower.startsWith('delivery terms')) return 'STOP';
                    if (lower.startsWith('daily capacity')) return 'STOP';
                    if (lower.startsWith('hours per day')) return 'STOP';
                    if (lower.startsWith('container type')) return 'STOP';
                    if (lower.startsWith('all prices')) return 'STOP';
                    if (lower.startsWith('base price')) return 'STOP';
                    if (lower.startsWith('total price')) return 'STOP';

                    if (isValidValue(clean)) {
                        block.push(clean);
                    }
                    return 'OK';
                };

                if (rest) {
                    if (!isRightColumn) {
                         const split = rest.split(/\s{3,}/); 
                         if (processSegment(split[0]) === 'STOP') break; 
                    } else {
                         if (processSegment(rest) === 'STOP') break;
                    }
                }

                for (let j = i + 1; j < Math.min(i + 1 + maxLines, lines.length); j++) {
                    const line = lines[j];
                    if (!line.trim()) continue;

                    let segment = '';
                    const indent = line.search(/\S|$/);
                    const parts = line.trim().split(/\s{3,}/);
                    
                    if (isRightColumn) {
                        if (indent > 30) {
                            segment = line.trim();
                        } else if (parts.length > 1) {
                            segment = parts[parts.length - 1]; 
                        } else {
                            if (prefixClean.length > 4) continue; 
                            if (prefix.length > 30 && indent < 10) break; 
                            segment = line.trim();
                        }
                    } else {
                        if (indent > 30) continue; 
                        segment = parts[0];
                    }

                    const status = processSegment(segment);
                    if (status === 'STOP') break;
                }
                
                if (block.length > 0) return block.join('\n'); 
            }
        }
    }
    return '';
};

const extractContractNumber = (text: string, filename: string): string => {
    const m = text.match(/\b(PO|CTR|CW|SC)[- ]?(\d{4,10})\b/i);
    if (m) return m[0].toUpperCase();
    let val = scanLineForValue(text, KEYWORD_MAP.contract);
    if (val && val.length > 3 && val.length < 25 && !val.includes(' ')) return val;
    const looseMatch = text.match(/(?:Contract|Order)\s*(?:No|Number|#)[\s.:]+([A-Z0-9-]{4,20})/i);
    if (looseMatch) return looseMatch[1];
    if (filename) {
        const fileM = filename.match(/(PO\d+|CTR\d+|CW\d+)/i);
        if (fileM) return fileM[0].toUpperCase();
        const fileBase = filename.split('.')[0];
        if (/^[A-Z0-9]{6,12}$/i.test(fileBase) && /\d/.test(fileBase)) return fileBase.toUpperCase();
    }
    return 'N/A';
};

const extractAmendmentNumber = (text: string): string => {
    let val = scanLineForValue(text, KEYWORD_MAP.amendment);
    if (val && /^\d{1,4}$/.test(val)) return val; 
    const looseMatch = text.match(/\b(?:Amendment|Amnd|Amdt|Rev|Revision)(?:[:.\s]+(?:No|Num|#|Number))?[:.\-#\s]+(\d{1,4})\b/i);
    if (looseMatch) return looseMatch[1];
    if (text.match(/AMENDMENT NUMBER/i)) {
         const lines = text.split('\n');
         const idx = lines.findIndex(l => /AMENDMENT NUMBER/i.test(l));
         if (idx !== -1 && idx + 1 < lines.length) {
             const next = lines[idx+1].trim();
             if (/^\d{1,4}$/.test(next)) return next;
         }
    }
    return '0'; 
};

const extractPriceStrict = (text: string, keys: string[]): string => {
    const lines = text.split('\n');
    for (const key of keys) {
        const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`(?:^|\\s)${escapedKey}[:.\\-\\s]+(.*)`, 'i');
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            const match = line.match(regex);
            if (match) {
                const val = cleanValue(match[1]);
                if (val && /\d/.test(val) && isValidValue(val)) return val;
            }
            const cleanLine = line.replace(/[:.\\-]/g, '').trim();
            if (cleanLine.toLowerCase().startsWith(key.toLowerCase()) && cleanLine.length < key.length + 15) {
                for (let k = 1; k <= 2; k++) {
                    if (i + k < lines.length) {
                        const nextLine = lines[i + k].trim();
                        if (nextLine.includes(':') && nextLine.indexOf(':') < 15) continue;
                        if (nextLine && isValidValue(nextLine) && !nextLine.toLowerCase().includes(key.toLowerCase())) {
                            return cleanValue(nextLine);
                        }
                    }
                }
            }
        }
    }
    return 'N/A';
};

const extractDunsStrict = (text: string, keys: string[]): string => {
    let val = scanLineForValue(text, keys);
    if (val && /\d{9}/.test(val)) return val.match(/\d{9}/)![0];
    const joinedKeys = keys.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    const regex = new RegExp(`(${joinedKeys}).{0,50}?(\\d{9})`, 'is');
    const m = text.match(regex);
    if (m) return m[2];
    return 'N/A';
};

const extractLocationStrict = (text: string): string => {
    let val = scanBlockForValue(text, KEYWORD_MAP.location, 6);
    if (val && val.length > 5 && !isLegalText(val)) return val;
    return 'N/A';
};

const extractCurrencyStrict = (text: string): string => {
    const val = scanLineForValue(text, KEYWORD_MAP.currency);
    const codeMatch = val.match(/\b(USD|EUR|GBP|CNY|JPY|CAD|MXN|AUD)\b/i);
    if (codeMatch) return codeMatch[0].toUpperCase();
    const globalMatch = text.match(/\b(USD|EUR|GBP|CNY|JPY|CAD|MXN)\b/);
    if (globalMatch) return globalMatch[0];
    if (text.includes('$')) return 'USD';
    if (text.includes('€')) return 'EUR';
    return 'USD';
};

const extractHazardousStrict = (text: string): string => {
    const val = scanLineForValue(text, KEYWORD_MAP.hazardous);
    if (/yes|y\b/i.test(val)) return 'Yes';
    if (/no|n\b/i.test(val)) return 'No';
    return 'No';
};

const extractAccountManagerStrict = (text: string): string => {
    let val = scanLineForValue(text, KEYWORD_MAP.manager);
    if (val) {
        val = val.replace(/(Ph|Tel|Fax|Cell|Mobile)[\s.:-]*[\d-() ]+/i, '').trim();
        val = val.replace(/[-/|]+$/, '').trim();
    }
    if (val && isLikelyName(val) && isValidValue(val)) return val;
    return 'N/A';
};

const getClientName = (buyerAddr: string): string => {
    if (!buyerAddr || buyerAddr === 'N/A' || isLegalText(buyerAddr)) return 'N/A';
    const lines = buyerAddr.split('\n');
    for (const line of lines) {
        const clean = line.split(',')[0].trim();
        if (!/^[\d\-\s.]+$/.test(clean) && clean.length > 2) {
            return clean;
        }
    }
    return lines[0].split(',')[0].trim();
};

const parseXmlContent = (xmlText: string): ExtractedData | null => {
    try {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, "text/xml");
        const root = xmlDoc.getElementsByTagName("CONTRACT")[0];
        if (!root) return null;

        const getText = (tag: string) => {
            const els = xmlDoc.getElementsByTagName(tag);
            return els.length > 0 ? els[0].textContent?.trim() || 'N/A' : 'N/A';
        };
        
        const contractNumber = getText("CONTRACT_NO");
        const issueDateRaw = getText("ORDER_DATE");
        const issueDate = formatDate(issueDateRaw);
        
        // --- IMPROVED XML MAPPINGS ---
        const supplierName = getText("SUPPLIER_NAME");
        const supplierDuns = getText("SUPPLIER"); 
        
        // Map LBE to DEMAND_LOCATION_DESC (e.g. BMW AG)
        const lbe = getText("DEMAND_LOCATION_DESC");

        // Map Account Manager to PURCHASER_NAME (e.g. Andreas Martini)
        const accountManager = getText("PURCHASER_NAME");
        const purchaserEmail = getText("EMAIL");
        const purchasingContact = accountManager !== 'N/A' ? `${accountManager} ${purchaserEmail !== 'N/A' ? purchaserEmail : ''}`.trim() : 'N/A';

        const amendmentNumber = getText("VER_NO");
        
        // Map Program Name to BMW_CBB_NAEL or Context from ACTIVITY_TEXT
        const programCode = getText("BMW_CBB_NAEL");
        const activityText = getText("ACTIVITY_TEXT");
        let programName = programCode !== 'N/A' ? programCode : 'N/A';
        if (programName === 'N/A' && activityText !== 'N/A' && activityText.length < 50) {
             programName = activityText;
        }

        const partNumber = getText("PRODUCT");
        const partDescription = getText("DESCRIPTION");
        const basePrice = getText("NET_PRICE");
        // Use CURRENCY_HEAD as fallback for global currency if ITEM_CURRENCY is missing
        let currency = getText("ITEM_CURRENCY");
        if (currency === 'N/A') currency = getText("CURRENCY_HEAD");

        const uom = getText("PRICE_UOM");
        
        const clientName = getText("DEMAND_LOCATION_DESC"); 
        const mfgLocation = getText("PRODUCT_LOCATION_DESC"); 
        const paymentTerms = getText("PAYMENT_TERMS");
        const incoterm = getText("INCOTERM");
        const deliveryTerms = getText("DELIVERY_TERMS");
        const shipToCode = getText("DEMAND_LOCATION");
        const shipTo = shipToCode !== 'N/A' && clientName !== 'N/A' ? `${clientName} (${shipToCode})` : clientName;

        return {
             contractNumber: contractNumber !== 'N/A' ? contractNumber : '',
             partNumber: partNumber !== 'N/A' ? partNumber : '',
             issueDate: issueDate,
             effectiveDate: issueDate,
             amendmentNumber: amendmentNumber !== 'N/A' ? amendmentNumber : '0',
             buyerNameAndAddress: clientName,
             clientName: clientName,
             sellerNameAndAddress: supplierName,
             lbe: mfgLocation !== 'N/A' ? extractCountryFromText(mfgLocation) : 'N/A', // Mapped LBE to mfgLocation Country
             accountManager: accountManager !== 'N/A' ? accountManager : 'N/A', // Mapped AM
             dunsNumber: supplierDuns !== 'N/A' ? supplierDuns : 'N/A',
             shipFromDuns: supplierDuns !== 'N/A' ? supplierDuns : 'N/A', // Mapped Ship From
             deliveryDuns: 'N/A',
             manufacturingDunsNumber: supplierDuns !== 'N/A' ? supplierDuns : 'N/A',
             manufacturingLocation: mfgLocation,
             shippingTo: shipTo,
             mailingAddressInformation: 'N/A',
             programName: programName, // Mapped Program
             partDescription: partDescription,
             drawingNumber: 'N/A',
             lessFinishPartNumber: 'N/A',
             basePrice: basePrice !== 'N/A' ? basePrice : 'N/A',
             totalPrice: 'N/A',
             currency: currency !== 'N/A' ? currency : 'N/A',
             unitOfMeasure: uom !== 'N/A' ? uom : 'N/A',
             paymentTerms: paymentTerms !== 'N/A' ? paymentTerms : 'N/A',
             freightTerms: incoterm !== 'N/A' ? incoterm : 'N/A',
             deliveryTerms: deliveryTerms !== 'N/A' ? deliveryTerms : 'N/A',
             dailyCapacity: 'N/A',
             hoursPerDay: 'N/A',
             containerType: 'N/A',
             receivingPlants: 'N/A',
             reasonForIssuing: activityText,
             hazardousMaterialIndicator: 'N/A',
             rawMaterialCertAnalysis: 'N/A',
             rawMaterialAnnualCert: 'N/A',
             language: 'English',
             sampleRequiredBy: 'N/A',
             purchasingContact,
             buyerCode: 'N/A',
             pages: []
        };
    } catch (e) {
        return null;
    }
}

// --- NEW OLLAMA INTEGRATION ---

const queryOllama = async (prompt: string): Promise<string> => {
    const baseUrl = localStorage.getItem('ollamaBaseUrl') || DEFAULT_OLLAMA_BASE_URL;
    const model = localStorage.getItem('ollamaModel') || DEFAULT_OLLAMA_MODEL;
    const timeout = parseInt(localStorage.getItem('ollamaTimeout') || String(DEFAULT_OLLAMA_TIMEOUT_SECONDS), 10) * 1000;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
        const response = await fetch(`${baseUrl.replace(/\/$/, '')}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: model,
                prompt: prompt,
                stream: false,
                format: "json", // Request JSON mode
                options: {
                    temperature: 0.1, 
                    num_ctx: 4096 
                }
            }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            console.warn(`Ollama Error: ${response.status}`);
            return "";
        }
        const data = await response.json();
        return data.response;
    } catch (error) {
        console.error("Ollama Call Failed", error);
        return "";
    }
}

const extractWithOllama = async (text: string): Promise<Partial<ExtractedData>> => {
    // Increase context window if possible, but keep it safe for performance
    const contextText = text.substring(0, 4000);
    
    const prompt = `
    You are a contract data extraction expert and translator.
    Analyze the following text. It might be in a foreign language (e.g. German, Spanish, French, Chinese, Japanese).
    
    TASK:
    1. Detect the language of the document.
    2. Extract the key fields listed below.
    3. CRITICAL MANDATORY REQUIREMENT: If the extracted value is not in English, you MUST TRANSLATE it into English before adding it to the JSON. 
       Do NOT leave any text-based values in their original foreign language.
       Example: If "Zahlungsbedingungen" is "30 Tage netto", extracted "paymentTerms" must be "30 days net".
       Example: If "Teilebeschreibung" is "Roter Schalter", extracted "partDescription" must be "Red Switch".
       Example: If "Designacion" is "Puntera", extracted "partDescription" must be "Toe".
    
    Return a strict JSON object. If a field is not found, use "N/A".
    
    Fields to extract (ALWAYS RETURN IN ENGLISH):
    - contractNumber
    - amendmentNumber
    - buyerNameAndAddress (Translate content to English)
    - sellerNameAndAddress (Translate content to English)
    - clientName (Translate content to English)
    - partNumber
    - partDescription (Translate content to English)
    - issueDate (Format YYYY-MM-DD)
    - currency (ISO code, e.g. USD, EUR, CNY)
    - totalPrice
    - paymentTerms (Translate content to English)
    - manufacturingLocation (Translate content to English)
    - shippingTo (Translate content to English)
    - freightTerms (Translate content to English)
    - accountManager (Translate content to English if descriptive)
    - programName (Translate content to English)
    - lbe (Translate content to English)
    - language (The detected language name in English, e.g., "German", "Chinese", "French")

    Text:
    """
    ${contextText}
    """
    
    JSON:
    `;

    const jsonStr = await queryOllama(prompt);
    try {
        const cleanJson = jsonStr.replace(/```json/g, '').replace(/```/g, '').trim();
        const start = cleanJson.indexOf('{');
        const end = cleanJson.lastIndexOf('}');
        if (start !== -1 && end !== -1) {
             const parsed = JSON.parse(cleanJson.substring(start, end + 1));
             return parsed;
        }
        return {};
    } catch (e) {
        return {};
    }
}

export const extractSmartFields = (text: string, filename: string, companyHint?: string, isPageMode = false): ExtractedData => {
    // 1. Check for XML Content first
    if (text.trim().startsWith('<?xml') || text.includes('<CONTRACT>')) {
        const xmlData = parseXmlContent(text);
        if (xmlData) return xmlData;
    }

    const headerContext = text.length > 5000 ? text.substring(0, 5000) : text;
    const contractNumber = extractContractNumber(text, isPageMode ? '' : filename);
    const partNumber = scanLineForValue(text, KEYWORD_MAP.part) || 'N/A';
    let issueDateRaw = scanLineForValue(text, KEYWORD_MAP.date);
    if (!issueDateRaw) {
        const headerText = text.substring(0, 1000);
        const m = headerText.match(/\b\d{4}[-./]\d{2}[-./]\d{2}\b/);
        if (m) issueDateRaw = m[0];
    }
    const issueDate = formatDate(issueDateRaw);
    const shipFromDuns = extractDunsStrict(text, KEYWORD_MAP.shipFromDuns);
    const deliveryDuns = extractDunsStrict(text, KEYWORD_MAP.deliveryDuns);
    let generalDuns = extractDunsStrict(text, KEYWORD_MAP.duns);
    if (generalDuns === 'N/A' && shipFromDuns !== 'N/A') generalDuns = shipFromDuns;
    const buyerNameAndAddress = scanBlockForValue(headerContext, KEYWORD_MAP.buyer, 12) || scanLineForValue(headerContext, KEYWORD_MAP.buyer) || 'N/A';
    let sellerNameAndAddress = scanBlockForValue(headerContext, KEYWORD_MAP.seller, 12) || 'N/A';
    const clientName = getClientName(buyerNameAndAddress);
    let manufacturingLocation = sellerNameAndAddress;
    if (manufacturingLocation === 'N/A' || isLegalText(manufacturingLocation)) {
         manufacturingLocation = extractLocationStrict(text);
    }
    let receivingPlants = scanBlockForValue(text, KEYWORD_MAP.receivingPlants, 10) || 'N/A';
    if (/all buyer'?s plants/i.test(receivingPlants)) {
         receivingPlants = "All Buyer's Plants - As Scheduled";
    }

    // BASELINE DATA from Regex
    let extractedData: ExtractedData = {
        contractNumber,
        partNumber,
        issueDate,
        effectiveDate: issueDate,
        amendmentNumber: extractAmendmentNumber(text),
        buyerNameAndAddress: !isLegalText(buyerNameAndAddress) ? buyerNameAndAddress : 'N/A',
        clientName,
        sellerNameAndAddress: !isLegalText(sellerNameAndAddress) ? sellerNameAndAddress : 'N/A',
        lbe: extractCountryFromText(manufacturingLocation), // LBE is set to match Country of Manufacturing Location
        accountManager: extractAccountManagerStrict(text),
        dunsNumber: generalDuns,
        shipFromDuns,
        deliveryDuns,
        manufacturingDunsNumber: shipFromDuns, 
        manufacturingLocation,
        shippingTo: scanBlockForValue(text, ['Shipping To', 'Ship To'], 8) || 'N/A',
        mailingAddressInformation: scanBlockForValue(text, KEYWORD_MAP.mailingAddress, 10) || 'N/A',
        programName: scanLineForValue(text, KEYWORD_MAP.program) || 'N/A',
        partDescription: scanLineForValue(text, ['Part Description', 'Description']) || 'N/A',
        drawingNumber: scanLineForValue(text, KEYWORD_MAP.drawingNumber) || 'N/A',
        lessFinishPartNumber: scanLineForValue(text, KEYWORD_MAP.lessFinish) || 'N/A',
        basePrice: extractPriceStrict(text, KEYWORD_MAP.price),
        totalPrice: extractPriceStrict(text, KEYWORD_MAP.totalPrice),
        currency: extractCurrencyStrict(text),
        unitOfMeasure: scanLineForValue(text, ['UOM', 'Unit of Measure']) || 'N/A',
        paymentTerms: scanLineForValue(text, KEYWORD_MAP.paymentTerms) || 'N/A',
        freightTerms: scanLineForValue(text, KEYWORD_MAP.freightTerms) || 'N/A',
        deliveryTerms: scanLineForValue(text, ['Delivery Terms']) || 'N/A',
        dailyCapacity: scanLineForValue(text, ['Daily Capacity']) || 'N/A',
        hoursPerDay: scanLineForValue(text, ['Hours Per Day']) || 'N/A',
        containerType: scanLineForValue(text, ['Container Type']) || 'N/A',
        receivingPlants: receivingPlants,
        reasonForIssuing: scanBlockForValue(text, KEYWORD_MAP.reasonForIssuing, 5) || 'N/A',
        hazardousMaterialIndicator: extractHazardousStrict(text),
        rawMaterialCertAnalysis: scanLineForValue(text, KEYWORD_MAP.rawCert) || 'N/A',
        rawMaterialAnnualCert: scanLineForValue(text, KEYWORD_MAP.annualCert) || 'N/A',
        language: 'English',
        sampleRequiredBy: scanLineForValue(text, ['Sample Required By']) || 'N/A',
        purchasingContact: scanLineForValue(text, KEYWORD_MAP.purchasingContact) || 'N/A',
        buyerCode: scanLineForValue(text, ['Buyer Code']) || 'N/A',
        pages: []
    };

    return extractedData;
};

export const testOllamaConnection = async (baseUrl: string): Promise<{ success: boolean; message?: string }> => {
    try {
        const url = baseUrl.replace(/\/$/, '');
        const response = await fetch(`${url}/api/tags`);
        if (response.ok) {
            return { success: true };
        } else {
            return { success: false, message: `Server responded with status ${response.status}` };
        }
    } catch (error) {
        return { success: false, message: error instanceof Error ? error.message : 'Connection failed' };
    }
};

export const extractContractData = async (
    file: File, 
    onProgress: (status: { status: string }) => void, 
    companyHint?: string
): Promise<ExtractedData> => {
    
    // 1. OCR / Text Extraction
    onProgress({ status: 'Extracting text...' });
    const { fullText, pages: pageTexts } = await extractTextFromFile(file, onProgress);

    // 2. Regex / Heuristic Extraction
    onProgress({ status: 'Analyzing document structure...' });
    const regexData = extractSmartFields(fullText, file.name, companyHint);

    // 3. Foreign Language & Missing Data Detection
    const lowerText = fullText.slice(0, 2500).toLowerCase();
    const foreignMarkers = [
        'vertrag', 'bestellung', 'contrat', 'commande', 'pedido', 'orden', 'auftrag', // EU
        'prix', 'fecha', 'designacion', 'vigencia', 'application', 'ancien', 'netto', // Keywords
        '合同', '协议', '采购', '订单', // CN
        '契約', '注文', // JP
        'соглашение', 'договор' // RU
    ];
    
    const isForeign = foreignMarkers.some(m => lowerText.includes(m));
    
    // Check for high density of non-ASCII characters (e.g. CJK)
    const nonAsciiCount = (fullText.slice(0, 500).match(/[^\x00-\x7F]/g) || []).length;
    const isLikelyNonLatin = nonAsciiCount > 50; 

    let finalData = { ...regexData };

    // TRIGGER AI IF: XML is not used AND (Foreign detected OR Missing Critical Data)
    if (!fullText.trim().startsWith('<?xml') && (isForeign || isLikelyNonLatin || regexData.contractNumber === 'N/A' || regexData.partNumber === 'N/A')) {
         onProgress({ status: 'Translating & extracting with AI...' });
         try {
             const aiData = await extractWithOllama(fullText);
             
             const textFields: (keyof ExtractedData)[] = [
                 'partDescription', 'paymentTerms', 'freightTerms', 'deliveryTerms', 
                 'manufacturingLocation', 'shippingTo', 'programName', 'lbe', 
                 'clientName', 'buyerNameAndAddress', 'sellerNameAndAddress', 'reasonForIssuing'
             ];

             const merged = { ...regexData } as ExtractedData;

             Object.keys(aiData).forEach(key => {
                 if (key === 'pages') return;
                 const k = key as keyof ExtractedData;
                 const aiVal = aiData[k];
                 
                 if (aiVal && aiVal !== 'N/A') {
                     // @ts-ignore
                     merged[k] = aiVal;
                 } else if (isForeign && textFields.includes(k)) {
                     const regVal = String(merged[k]);
                     if (regVal && regVal !== 'N/A' && regVal.length > 3) {
                         const isRegForeign = foreignMarkers.some(m => regVal.toLowerCase().includes(m));
                         if (isRegForeign) {
                            // @ts-ignore
                            merged[k] = 'N/A'; 
                         }
                     }
                 }
             });

             if (aiData.language) merged.language = aiData.language;
             if (isForeign && (!merged.language || merged.language === 'English')) {
                 merged.language = 'English (Translated)';
             }
             
             finalData = merged;

         } catch (e) {
             console.warn("AI Extraction failed, using Regex only", e);
         }
    }

    // Merge page breakdown including original text
    // REQUIREMENT: Sync Buyer, Seller, LBE and Manufacturing Location from the global finalData to ALL pages
    return {
        ...finalData,
        pages: pageTexts.map((pText, i) => {
            const pageFields = extractSmartFields(pText, file.name, companyHint, true);
            
            // Explicitly override key fields for consistency across all pages
            pageFields.buyerNameAndAddress = finalData.buyerNameAndAddress;
            pageFields.sellerNameAndAddress = finalData.sellerNameAndAddress;
            pageFields.lbe = finalData.lbe;
            pageFields.manufacturingLocation = finalData.manufacturingLocation;
            
            return {
                pageNumber: i + 1,
                text: pText, 
                fields: pageFields
            };
        })
    } as ExtractedData;
};