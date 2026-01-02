
import React, { useMemo } from 'react';
import type { Document, ExtractedData } from '../types';
import { ArrowLeft, Database, FileSpreadsheet } from 'lucide-react';

interface ComparisonViewProps {
  documents: Document[];
  onBack: () => void;
  onSaveComparison: (documents: Document[], differentFields: { key: keyof ExtractedData; label: string }[]) => void;
  onExportComparison: (
      documents: Document[], 
      differentFields: { key: keyof ExtractedData; label: string }[],
      similarFields: { key: keyof ExtractedData; label: string }[]
  ) => void;
}

const ALL_FIELDS: { key: keyof ExtractedData; label: string }[] = [
    { key: 'contractNumber', label: 'Contract Number' },
    { key: 'amendmentNumber', label: 'Amendment #' },
    { key: 'partNumber', label: 'Part Number' },
    { key: 'partDescription', label: 'Part Description' },
    { key: 'programName', label: 'Program Name' },
    { key: 'drawingNumber', label: 'Drawing Number' },
    { key: 'issueDate', label: 'Issue Date' },
    { key: 'effectiveDate', label: 'Effective Date' },
    { key: 'buyerNameAndAddress', label: 'Buyer' },
    { key: 'sellerNameAndAddress', label: 'Seller' },
    { key: 'accountManager', label: 'Account Manager' },
    { key: 'dunsNumber', label: 'Seller DUNS' },
    { key: 'manufacturingLocation', label: 'Manufacturing Location' },
    { key: 'shippingTo', label: 'Shipping To' },
    { key: 'basePrice', label: 'Base Price' },
    { key: 'totalPrice', label: 'Total Price' },
    { key: 'currency', label: 'Currency' },
    { key: 'unitOfMeasure', label: 'Unit of Measure' },
    { key: 'paymentTerms', label: 'Payment Terms' },
    { key: 'deliveryTerms', label: 'Delivery Terms' },
    { key: 'freightTerms', label: 'Freight Terms' },
    { key: 'language', label: 'Language' },
    { key: 'lessFinishPartNumber', label: 'Less Finish Part Number' },
    { key: 'sampleRequiredBy', label: 'Sample Required By' },
    { key: 'manufacturingDunsNumber', label: 'Manufacturing DUNS' },
    { key: 'purchasingContact', label: 'Purchasing Contact' },
    { key: 'buyerCode', label: 'Buyer Code' },
    { key: 'mailingAddressInformation', label: 'Mailing Address' },
    { key: 'deliveryDuns', label: 'Delivery DUNS' },
    { key: 'shipFromDuns', label: 'Ship From DUNS' },
    { key: 'dailyCapacity', label: 'Daily Capacity' },
    { key: 'hoursPerDay', label: 'Hours Per Day' },
    { key: 'containerType', label: 'Container Type' },
    { key: 'receivingPlants', label: 'Receiving Plants' },
    { key: 'reasonForIssuing', label: 'Reason for Issuing' },
    { key: 'hazardousMaterialIndicator', label: 'Hazardous Material' },
];


const ComparisonView: React.FC<ComparisonViewProps> = ({ documents, onBack, onSaveComparison, onExportComparison }) => {
  
  // Logic to detect if we are comparing versions of the same part
  const { differentFields, similarFields, isSamePartComparison } = useMemo(() => {
    const diff: typeof ALL_FIELDS = [];
    const sim: typeof ALL_FIELDS = [];
    
    // Check if all part numbers match
    const firstPart = documents[0]?.data?.partNumber;
    const isSamePart = documents.length > 1 && documents.every(d => d.data?.partNumber === firstPart && firstPart !== 'N/A' && firstPart !== undefined);

    if (documents.length > 1) {
        ALL_FIELDS.forEach(field => {
            const values = documents.map(doc => doc.data?.[field.key]);
            const uniqueValues = new Set(values.map(v => v || 'N/A'));
            if (uniqueValues.size > 1) {
                diff.push(field);
            } else {
                sim.push(field);
            }
        });
    } else {
        // If only one doc, all fields are "similar"
        sim.push(...ALL_FIELDS);
    }

    return { differentFields: diff, similarFields: sim, isSamePartComparison: isSamePart };
  }, [documents]);
  
  if (documents.length === 0) {
    return (
      <div className="text-center p-8">
        <p className="text-gray-600">No documents selected for comparison.</p>
        <button onClick={onBack} className="mt-4 flex items-center mx-auto bg-indigo-600 text-white px-4 py-2 rounded-md font-semibold hover:bg-indigo-700 transition-colors">
          <ArrowLeft className="w-5 h-5 mr-2" />
          Go Back
        </button>
      </div>
    );
  }

  const renderTableRows = (fields: typeof ALL_FIELDS, isDifference: boolean) => {
    return fields.map(field => (
      <tr key={field.key} className={`${isDifference ? 'bg-red-50' : 'bg-white'} border-b hover:bg-gray-50`}>
        <td className={`px-6 py-4 font-medium text-gray-900 sticky left-0 border-r z-10 ${isDifference ? 'bg-red-50' : 'bg-white'}`}>{field.label}</td>
        {documents.map(doc => (
          <td key={doc.id} className="px-6 py-4 border-l">
            {String(doc.data?.[field.key] || 'N/A')}
          </td>
        ))}
      </tr>
    ));
  };


  return (
    <div className="space-y-6">
       <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
            <button onClick={onBack} className="flex items-center bg-white text-gray-700 px-4 py-2 rounded-md font-semibold border border-gray-300 hover:bg-gray-50 transition-colors">
                <ArrowLeft className="w-5 h-5 mr-2" />
                Back
            </button>
             <h2 className="text-2xl font-semibold text-gray-800">
                 {isSamePartComparison 
                    ? `Comparing Amendments for Part: ${documents[0]?.data?.partNumber}` 
                    : 'Document Comparison'}
             </h2>
        </div>
        <div className="flex items-center space-x-2">
            <button 
                onClick={() => onSaveComparison(documents, differentFields)}
                disabled={documents.length < 2}
                className="flex items-center bg-white text-gray-700 px-4 py-2 rounded-md font-semibold border border-gray-300 hover:bg-gray-50 transition-colors disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed">
                <Database className="w-5 h-5 mr-2" />
                Save to Database
            </button>
             <button 
                onClick={() => onExportComparison(documents, differentFields, similarFields)}
                disabled={documents.length < 2}
                className="flex items-center bg-green-600 text-white px-4 py-2 rounded-md font-semibold hover:bg-green-700 transition-colors disabled:bg-green-300 disabled:cursor-not-allowed">
                <FileSpreadsheet className="w-5 h-5 mr-2" />
                Export to Excel
            </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm text-left text-gray-500">
          <thead className="text-xs text-gray-700 uppercase bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 w-1/5 sticky left-0 bg-gray-50 z-10 border-r">Field</th>
              {documents.map(doc => {
                  // Custom Header Logic:
                  // If comparing same part, emphasize Amendment Number and Date
                  // Otherwise, show Filename
                  let headerTitle = doc.name;
                  if (isSamePartComparison) {
                      const amd = doc.data?.amendmentNumber || 'Initial';
                      const date = doc.data?.issueDate || '';
                      headerTitle = `Amendment: ${amd} ${date ? `(${date})` : ''}`;
                  }
                  
                  return (
                    <th key={doc.id} scope="col" className="px-6 py-3 min-w-[200px] border-l">
                        {headerTitle}
                        {isSamePartComparison && <p className="text-xs font-normal text-gray-500 mt-1 truncate">{doc.name}</p>}
                    </th>
                  );
              })}
            </tr>
          </thead>
          
          {differentFields.length > 0 && (
            <tbody>
                <tr>
                    <td colSpan={documents.length + 1} className="px-6 py-2 bg-slate-100 text-sm font-semibold text-slate-700 border-b">
                        Key Differences
                    </td>
                </tr>
                {renderTableRows(differentFields, true)}
            </tbody>
          )}
          
          {similarFields.length > 0 && (
            <tbody>
                <tr>
                    <td colSpan={documents.length + 1} className="px-6 py-2 bg-slate-100 text-sm font-semibold text-slate-700 border-t border-b">
                        Similar Information
                    </td>
                </tr>
                {renderTableRows(similarFields, false)}
            </tbody>
          )}

        </table>
      </div>
    </div>
  );
};

export default ComparisonView;
