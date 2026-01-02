
import React, { useState, useRef, useEffect } from 'react';
import type { Document, ExtractedData, PageExtraction } from '../types';
import { X, Layers, FileText, Download, FileSpreadsheet, Save, Database, ChevronDown, ChevronRight, Copy, Check } from 'lucide-react';
import { exportDocumentPagesToExcel, exportDocumentPagesToCsv } from '../services/exportService';

interface DocumentDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  document: Document | null;
  onSave?: (doc: Document) => void;
}

// Order of fields for the Page Breakdown Matrix
const FIELD_ORDER: { key: keyof ExtractedData; label: string }[] = [
  { key: 'contractNumber', label: 'Contract Number' },
  { key: 'amendmentNumber', label: 'Amendment #' },
  { key: 'partNumber', label: 'Part Number' },
  { key: 'partDescription', label: 'Part Description' },
  { key: 'programName', label: 'Program Name' },
  { key: 'drawingNumber', label: 'Drawing Number' },
  { key: 'issueDate', label: 'Issue Date' },
  { key: 'effectiveDate', label: 'Effective Date' },
  { key: 'sellerNameAndAddress', label: 'Seller' },
  { key: 'buyerNameAndAddress', label: 'Buyer' },
  { key: 'clientName', label: 'Client Name' },
  { key: 'dunsNumber', label: 'DUNS' },
  { key: 'shipFromDuns', label: 'Ship From DUNS' },
  { key: 'manufacturingDunsNumber', label: 'Mfg DUNS' },
  { key: 'deliveryDuns', label: 'Delivery DUNS' },
  { key: 'mailingAddressInformation', label: 'Mailing Address' },
  { key: 'manufacturingLocation', label: 'Mfg Location' },
  { key: 'shippingTo', label: 'Shipping To' },
  { key: 'receivingPlants', label: 'Receiving Plants' },
  { key: 'purchasingContact', label: 'Purchasing Contact' },
  { key: 'accountManager', label: 'Account Manager' },
  { key: 'buyerCode', label: 'Buyer Code' },
  { key: 'lbe', label: 'LBE' },
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
  { key: 'reasonForIssuing', label: 'Reason for Issuing' },
  { key: 'hazardousMaterialIndicator', label: 'HazMat' },
  { key: 'lessFinishPartNumber', label: 'Less Finish P/N' },
  { key: 'rawMaterialCertAnalysis', label: 'Raw Material Cert' },
  { key: 'rawMaterialAnnualCert', label: 'Annual Cert' },
  { key: 'sampleRequiredBy', label: 'Sample Required By' },
];

const LabelVal: React.FC<{ label: string; value: any }> = ({ label, value }) => (
    <div className="mb-3 break-inside-avoid">
        <dt className="text-xs font-bold text-gray-500 uppercase tracking-wide">{label}</dt>
        <dd className="mt-0.5 text-sm text-gray-900 border-b border-gray-200 pb-1 min-h-[24px] whitespace-pre-wrap">
            {value && value !== 'N/A' ? String(value) : <span className="text-gray-300 italic">--</span>}
        </dd>
    </div>
);

const PageBreakdownItem: React.FC<{ page: PageExtraction }> = ({ page }) => {
    const [isTextVisible, setIsTextVisible] = useState(false);
    const [copied, setCopied] = useState(false);

    const validFields = FIELD_ORDER.filter(f => {
        const val = page.fields?.[f.key];
        return val && val !== 'N/A' && val !== '0' && val !== '';
    });

    const handleCopy = () => {
        if (page.text) {
            navigator.clipboard.writeText(page.text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    return (
        <div className="border-b border-gray-200 last:border-0 hover:bg-slate-50 transition-colors">
            <div className="bg-white px-8 py-5 flex justify-between items-center sticky top-0 z-10 border-b border-slate-100">
                <div className="flex items-center space-x-4">
                    <div className="bg-indigo-600 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold shadow-sm">
                        {page.pageNumber}
                    </div>
                    <h3 className="font-bold text-lg text-slate-800">Page Information</h3>
                </div>
                <div className="flex items-center space-x-3">
                    <button 
                        onClick={() => setIsTextVisible(!isTextVisible)}
                        className={`flex items-center text-xs font-semibold px-3 py-1.5 rounded-full transition-all ${
                            isTextVisible ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                    >
                        {isTextVisible ? <X className="w-3 h-3 mr-1" /> : <Layers className="w-3 h-3 mr-1" />}
                        {isTextVisible ? 'Close Source Text' : 'View Source Text'}
                    </button>
                    {isTextVisible && (
                        <button 
                            onClick={handleCopy}
                            className="p-1.5 bg-indigo-50 text-indigo-600 rounded hover:bg-indigo-100 transition-colors"
                            title="Copy text to clipboard"
                        >
                            {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                        </button>
                    )}
                </div>
            </div>
            
            <div className="flex flex-col lg:flex-row">
                {/* Extracted Fields */}
                <div className={`p-8 ${isTextVisible ? 'lg:w-1/2 border-r border-slate-200' : 'w-full'}`}>
                    <div className="mb-4">
                        <h4 className="text-sm font-bold text-indigo-700 uppercase tracking-widest mb-4">Data Extracted From This Page</h4>
                        {validFields.length > 0 ? (
                            <dl className={`grid grid-cols-1 gap-x-6 gap-y-4 ${isTextVisible ? 'sm:grid-cols-1' : 'sm:grid-cols-2 lg:grid-cols-3'}`}>
                                {validFields.map(field => {
                                    // @ts-ignore
                                    const val = page.fields[field.key];
                                    return (
                                        <div key={field.key} className="bg-white p-3 rounded border border-slate-100 shadow-sm">
                                            <dt className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{field.label}</dt>
                                            <dd className="mt-1 text-sm text-gray-800 font-medium whitespace-pre-wrap">{String(val)}</dd>
                                        </div>
                                    );
                                })}
                            </dl>
                        ) : (
                            <div className="text-left py-8 text-gray-400 italic bg-slate-50 rounded border border-dashed border-slate-200 px-4">
                                No specific contract variables found on this page using high-confidence extraction.
                            </div>
                        )}
                    </div>
                </div>

                {/* Raw Text View (Collapsible) */}
                {isTextVisible && (
                    <div className="lg:w-1/2 p-8 bg-slate-900 overflow-y-auto max-h-[600px] lg:max-h-none">
                         <div className="flex justify-between items-center mb-4">
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center">
                                <FileText className="w-3 h-3 mr-2 text-indigo-400" />
                                OCR RAW SOURCE TEXT (Web View)
                            </h4>
                         </div>
                         <div className="font-mono text-xs text-indigo-100 leading-relaxed whitespace-pre-wrap bg-slate-800/50 p-6 rounded-lg border border-slate-700">
                             {page.text || 'No source text available for this page.'}
                         </div>
                    </div>
                )}
            </div>
        </div>
    );
};

const DocumentDetailModal: React.FC<DocumentDetailModalProps> = ({ isOpen, onClose, document, onSave }) => {
  const [activeTab, setActiveTab] = useState<'summary' | 'pages'>('summary');
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
            setIsExportMenuOpen(false);
        }
    };
    window.document.addEventListener('mousedown', handleClickOutside);
    return () => window.document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  if (!isOpen || !document) return null;
  
  const data = document.data;
  const pages = data?.pages || [];

  const handleExportExcel = async () => {
      try {
          await exportDocumentPagesToExcel(document);
          setIsExportMenuOpen(false);
      } catch (e) {
          console.error("Export failed", e);
          alert("Failed to export pages. Please ensure ExcelJS is loaded.");
      }
  };

  const handleExportCsv = () => {
      try {
          exportDocumentPagesToCsv(document);
          setIsExportMenuOpen(false);
      } catch (e) {
          console.error("Export failed", e);
          alert("Failed to export pages to CSV.");
      }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-7xl max-h-[90vh] flex flex-col m-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>
        
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b bg-gray-50 flex-shrink-0">
          <div>
            <h2 className="text-xl font-bold text-gray-800">Scanned Document Data</h2>
            <p className="text-sm text-gray-500 font-medium">{document.name} <span className="mx-2">|</span> Processed: {document.processedDate}</p>
          </div>
          <button onClick={onClose} className="p-2 bg-white rounded-full hover:bg-gray-200 transition-colors text-gray-600 shadow-sm border">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs / Toolbar */}
        <div className="flex justify-between border-b border-gray-200 px-6 items-center bg-white sticky top-0 z-20 flex-shrink-0">
            <div className="flex">
                <button
                    onClick={() => setActiveTab('summary')}
                    className={`py-4 px-6 text-sm font-bold border-b-2 flex items-center transition-colors ${activeTab === 'summary' ? 'border-indigo-600 text-indigo-600 bg-indigo-50/30' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
                >
                    <FileText className="w-4 h-4 mr-2" />
                    Consolidated Summary
                </button>
                <button
                    onClick={() => setActiveTab('pages')}
                    className={`py-4 px-6 text-sm font-bold border-b-2 flex items-center transition-colors ${activeTab === 'pages' ? 'border-indigo-600 text-indigo-600 bg-indigo-50/30' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
                >
                    <Layers className="w-4 h-4 mr-2" />
                    Page Breakdown ({pages.length})
                </button>
            </div>
            
            <div className="flex space-x-3 py-2 items-center">
                 {/* Export Options Dropdown */}
                 {pages.length > 0 && (
                    <div className="relative" ref={dropdownRef}>
                        <button 
                            onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
                            className="flex items-center text-xs bg-green-50 text-green-700 px-4 py-2 rounded-md border border-green-200 hover:bg-green-100 transition-colors font-bold uppercase tracking-wider"
                        >
                            <Download className="w-4 h-4 mr-2" />
                            Reports
                            <ChevronDown className={`w-3 h-3 ml-2 transition-transform ${isExportMenuOpen ? 'rotate-180' : ''}`} />
                        </button>
                        {isExportMenuOpen && (
                            <div className="absolute right-0 mt-2 w-56 bg-white rounded-md shadow-2xl py-2 z-30 border border-gray-200 animate-in fade-in zoom-in duration-75">
                                <p className="px-4 py-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Page Matrices</p>
                                <button onClick={handleExportExcel} className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-indigo-50 flex items-center group">
                                    <FileSpreadsheet className="w-4 h-4 mr-3 text-green-600 group-hover:scale-110 transition-transform" />
                                    Export Pages to Excel
                                </button>
                                <button onClick={handleExportCsv} className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-indigo-50 flex items-center group">
                                    <FileText className="w-4 h-4 mr-3 text-blue-600 group-hover:scale-110 transition-transform" />
                                    Export Pages to CSV
                                </button>
                            </div>
                        )}
                    </div>
                 )}
                 
                 {/* Save to Database Button */}
                 {onSave && (
                     <button 
                        onClick={() => onSave(document)}
                        className="flex items-center text-xs bg-indigo-600 text-white px-5 py-2 rounded-md hover:bg-indigo-700 transition-all shadow-md font-bold uppercase tracking-wider active:scale-95"
                     >
                        <Database className="w-4 h-4 mr-2" />
                        Save to Archives
                     </button>
                 )}
            </div>
        </div>
        
        {/* Content Area */}
        <div className="flex-1 overflow-y-auto bg-slate-50">
            {activeTab === 'summary' ? (
                <div className="p-8 bg-white min-h-full max-w-7xl mx-auto shadow-sm">
                {data ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-12 gap-y-6">
                        {/* Column 1: Header / Parties */}
                        <div className="space-y-1">
                            <h4 className="text-xs font-bold text-indigo-600 mb-4 border-b pb-1">Contract Header</h4>
                            <LabelVal label="Page Type" value="PURCHASE CONTRACT" />
                            <LabelVal label="Issue Date" value={data.issueDate} />
                            <LabelVal label="Contract Number" value={data.contractNumber} />
                            <LabelVal label="Amendment Number" value={data.amendmentNumber} />
                            <LabelVal label="Part Number" value={data.partNumber} />
                            
                            <h4 className="text-xs font-bold text-indigo-600 mb-4 border-b pb-1 mt-6">Parties</h4>
                            <LabelVal label="SELLER NAME AND ADDRESS" value={data.sellerNameAndAddress} />
                            <LabelVal label="DUNS Number" value={data.dunsNumber} />
                            <LabelVal label="Mailing Address Information" value={data.mailingAddressInformation} />
                        </div>

                        {/* Column 2: Buyer / Description / Reasons */}
                        <div className="space-y-1">
                            <h4 className="text-xs font-bold text-indigo-600 mb-4 border-b pb-1">Buyer Details</h4>
                            <LabelVal label="BUYER NAME AND ADDRESS" value={data.buyerNameAndAddress} />
                            <LabelVal label="Purchasing Contact" value={data.purchasingContact} />
                            <LabelVal label="Buyer Code" value={data.buyerCode} />
                            <LabelVal label="Effective Date" value={data.effectiveDate} />
                            
                            <h4 className="text-xs font-bold text-indigo-600 mb-4 border-b pb-1 mt-6">Product Details</h4>
                            <LabelVal label="Part Description" value={data.partDescription} />
                            <LabelVal label="Reason for Issuing" value={data.reasonForIssuing} />
                            <LabelVal label="Sample Required by" value={data.sampleRequiredBy} />
                            <LabelVal label="Drawing Number" value={data.drawingNumber} />
                        </div>

                        {/* Column 3: Logistics / Compliance */}
                        <div className="space-y-1">
                            <h4 className="text-xs font-bold text-indigo-600 mb-4 border-b pb-1">Operations</h4>
                            <LabelVal label="Manufacturing DUNS Number" value={data.manufacturingDunsNumber} />
                            <LabelVal label="Less Finish Part Number" value={data.lessFinishPartNumber} />
                            
                            <h4 className="text-xs font-bold text-indigo-600 mb-4 border-b pb-1 mt-6">Compliance</h4>
                            <LabelVal label="Hazardous Material Indicator" value={data.hazardousMaterialIndicator} />
                            <LabelVal label="Raw Material Cert. Analysis" value={data.rawMaterialCertAnalysis} />
                            <LabelVal label="Raw Material Annual Cert." value={data.rawMaterialAnnualCert} />
                            
                            <h4 className="text-xs font-bold text-indigo-600 mb-4 border-b pb-1 mt-6">Trade Terms</h4>
                            <LabelVal label="Freight Terms" value={data.freightTerms} />
                            <LabelVal label="Payment Terms" value={data.paymentTerms} />
                            <LabelVal label="Delivery Terms" value={data.deliveryTerms} />
                        </div>

                        {/* Column 4: Delivery / Pricing */}
                        <div className="space-y-1">
                            <h4 className="text-xs font-bold text-indigo-600 mb-4 border-b pb-1">Logistics</h4>
                            <LabelVal label="Delivery DUNS" value={data.deliveryDuns} />
                            <LabelVal label="Ship From DUNS" value={data.shipFromDuns} />
                            <LabelVal label="Daily Capacity" value={data.dailyCapacity} />
                            <LabelVal label="Hours Per Day" value={data.hoursPerDay} />
                            <LabelVal label="Container Type" value={data.containerType} />
                            <LabelVal label="Receiving Plants" value={data.receivingPlants} />
                            
                            <h4 className="text-xs font-bold text-indigo-600 mb-4 border-b pb-1 mt-6">Pricing (Consolidated)</h4>
                            <LabelVal label="Currency" value={data.currency} />
                            <LabelVal label="Base Price" value={data.basePrice} />
                            <LabelVal label="Total Price" value={data.totalPrice} />
                            <LabelVal label="UOM" value={data.unitOfMeasure} />
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-gray-500">
                        <p className="text-lg">No extracted data available.</p>
                    </div>
                )}
                </div>
            ) : (
                // Page Breakdown Tab - Dynamic Page Information Matrix
                <div className="p-8 max-w-7xl mx-auto space-y-8 pb-20">
                    <div className="bg-white shadow-xl border border-gray-200 rounded-lg overflow-hidden">
                        <div className="p-8 border-b border-gray-200 bg-slate-50">
                            <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Full Page Analysis Report</h2>
                            <p className="text-slate-500 mt-1 font-medium italic">Detailed extraction and original text per page for verification.</p>
                        </div>
                        
                        {pages.length > 0 ? (
                            <div className="divide-y divide-slate-200">
                                {pages.map((p) => (
                                    <PageBreakdownItem key={p.pageNumber} page={p} />
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-24 text-gray-400 bg-white">
                                <Layers className="w-16 h-16 mx-auto mb-4 text-gray-200 animate-pulse" />
                                <p className="text-lg font-bold">No page breakdown available.</p>
                                <p className="text-sm">Processed document metadata did not include page-level indices.</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t flex justify-end flex-shrink-0">
             <button
                onClick={onClose}
                className="px-8 py-2.5 bg-slate-800 text-white text-xs font-bold rounded shadow-lg hover:bg-slate-900 transition-all uppercase tracking-widest active:scale-95"
              >
                Close Report
              </button>
        </div>
      </div>
    </div>
  );
};

export default DocumentDetailModal;
