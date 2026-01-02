
import React, { useState, useMemo, useEffect } from 'react';
import type { Document, User } from '../types';
import { ChevronDown, ChevronUp, FileText, Filter, ExternalLink, Trash2 } from 'lucide-react';

interface GroupedViewProps {
  documents: Document[];
  selectedDocs: string[];
  onSelectionChange: (id: string, selected: boolean) => void;
  currentUser: User;
  
  // New props for optional header controls within grouped view
  title?: string;
  companies?: string[];
  selectedCompany?: string;
  onCompanyChange?: (company: string) => void;
  defaultGroupBy?: 'company' | 'partNumber';
  onViewDetails?: (id: string) => void;
  onDeleteDocument?: (id: string) => void;
  // Added missing properties to fix type errors in App.tsx
  onDeleteBulk?: (docs: Document[]) => void;
  onViewOriginal?: (doc: Document) => void;
}

type GroupBy = 'company' | 'partNumber';

const GroupedView: React.FC<GroupedViewProps> = ({ 
  documents, 
  selectedDocs, 
  onSelectionChange, 
  currentUser,
  title,
  companies,
  selectedCompany,
  onCompanyChange,
  defaultGroupBy,
  onViewDetails,
  onDeleteDocument,
  // Added missing properties to fix type errors in App.tsx
  onDeleteBulk,
  onViewOriginal
}) => {
  const [groupBy, setGroupBy] = useState<GroupBy>('company');
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  
  const canPerformActions = currentUser.role !== 'Viewer';
  const canDelete = currentUser.role === 'Admin';

  // Memoized list of documents selected for deletion
  const docsToDelete = useMemo(() => {
    return documents.filter(d => selectedDocs.includes(d.id));
  }, [documents, selectedDocs]);

  // Effect to update grouping if defaultGroupBy prop changes (e.g., parent switches filter)
  useEffect(() => {
    if (defaultGroupBy) {
      setGroupBy(defaultGroupBy);
      setExpandedGroups({}); // collapse all when switching mode programmatically
    }
  }, [defaultGroupBy]);

  const groupedData = useMemo(() => {
    return documents.reduce((acc, doc) => {
      let key: string | undefined;
      // Safety: Use optional chaining AND explicitly cast to String if value is a number/object
      if (groupBy === 'company') {
        key = doc.data?.clientName ? String(doc.data.clientName) : undefined;
      } else {
        key = doc.data?.partNumber ? String(doc.data.partNumber) : undefined;
      }
      const groupKey = key || 'Uncategorized';
      
      if (!acc[groupKey]) {
        acc[groupKey] = [];
      }
      acc[groupKey].push(doc);
      return acc;
    }, {} as Record<string, Document[]>);
  }, [documents, groupBy]);

  const toggleGroup = (key: string) => {
    setExpandedGroups(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleOpenFile = (doc: Document) => {
    // Prefer the passed onViewOriginal handler for consistent notifications
    if (onViewOriginal) {
      onViewOriginal(doc);
      return;
    }
    
    if (doc.fileUrl) {
      window.open(doc.fileUrl, '_blank');
    } else {
      alert('Original file content is not available for this archived document.');
    }
  };

  const TabButton: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode }> = ({ active, onClick, children }) => (
     <button
        onClick={onClick}
        className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
          active
            ? 'bg-indigo-600 text-white'
            : 'text-gray-600 hover:bg-gray-100'
        }`}
      >
        {children}
      </button>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 bg-white rounded-lg shadow-sm border border-gray-200 gap-4">
        <h3 className="text-lg font-semibold text-gray-800">{title || 'Grouped Document View'}</h3>
        
        <div className="flex items-center space-x-4">
             {/* Added Bulk Delete button to Grouped View */}
             {canDelete && onDeleteBulk && (
                <button 
                  onClick={() => onDeleteBulk(docsToDelete)}
                  disabled={docsToDelete.length === 0}
                  className={`flex items-center text-white font-medium rounded-md text-sm px-3 py-2 transition-colors ${docsToDelete.length === 0 ? 'bg-red-300 cursor-not-allowed opacity-70' : 'bg-red-600 hover:bg-red-700'}`}
                >
                    <Trash2 className="w-4 h-4 mr-1" />
                    <span>Delete {docsToDelete.length > 0 ? `(${docsToDelete.length})` : ''}</span>
                </button>
             )}

             {/* Optional Company Filter inside Grouped View */}
             {companies && onCompanyChange && (
              <div className="flex items-center space-x-2">
                <Filter className="w-4 h-4 text-gray-500" />
                <select
                  value={selectedCompany || ''}
                  onChange={(e) => onCompanyChange(e.target.value)}
                  className="block w-48 pl-3 pr-10 py-2 text-sm border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 rounded-md border"
                >
                  <option value="">All Companies</option>
                  {companies.map((company, index) => (
                    <option key={index} value={company}>
                      {company}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex items-center space-x-2 p-1 bg-gray-100 rounded-lg">
              <TabButton active={groupBy === 'company'} onClick={() => { setGroupBy('company'); setExpandedGroups({}); }}>
                By Company
              </TabButton>
              <TabButton active={groupBy === 'partNumber'} onClick={() => { setGroupBy('partNumber'); setExpandedGroups({}); }}>
                By Part #
              </TabButton>
            </div>
        </div>
      </div>

      <div className="space-y-4">
        {Object.keys(groupedData).sort().map(groupKey => (
          <div key={groupKey} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <button
              onClick={() => toggleGroup(groupKey)}
              className="w-full flex justify-between items-center p-4 text-left hover:bg-gray-50 focus:outline-none"
              aria-expanded={!!expandedGroups[groupKey]}
              aria-controls={`group-content-${groupKey}`}
            >
              <div className="flex items-center">
                <span className="font-semibold text-gray-800">{groupKey}</span>
                <span className="ml-3 px-2.5 py-0.5 bg-gray-200 text-gray-700 text-xs font-medium rounded-full">
                  {groupedData[groupKey].length} document{groupedData[groupKey].length > 1 ? 's' : ''}
                </span>
                {groupBy === 'partNumber' && groupedData[groupKey][0]?.data?.partDescription && (
                    <span className="ml-3 text-sm text-gray-500 italic hidden sm:inline-block">
                        - {String(groupedData[groupKey][0].data?.partDescription).substring(0, 50)}...
                    </span>
                )}
              </div>
              {expandedGroups[groupKey] ? <ChevronUp className="w-5 h-5 text-gray-500" /> : <ChevronDown className="w-5 h-5 text-gray-500" />}
            </button>
            {expandedGroups[groupKey] && (
              <div id={`group-content-${groupKey}`} className="border-t border-gray-200 overflow-x-auto">
                 <table className="w-full text-sm text-left text-gray-500">
                    <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                        <tr>
                             <th scope="col" className="p-4 w-4">Select</th>
                             <th scope="col" className="px-4 py-3">ISSUE_DATE</th>
                             <th scope="col" className="px-4 py-3 min-w-[140px]">Contract Number</th>
                             <th scope="col" className="px-4 py-3 text-center">AM</th>
                             <th scope="col" className="px-4 py-3">LBE</th>
                             <th scope="col" className="px-4 py-3">ACCOUNT_MANAGER</th>
                             <th scope="col" className="px-4 py-3">PART_NUMBER</th>
                             <th scope="col" className="px-4 py-3">PROGRAM_NAME</th>
                             <th scope="col" className="px-4 py-3">SHIP_FROM_DUNS</th>
                             <th scope="col" className="px-4 py-3">LOCATION</th>
                             <th scope="col" className="px-4 py-3">ENTRY_DATE</th>
                             <th scope="col" className="px-4 py-3">IMPORTED USER</th>
                             {canDelete && <th scope="col" className="px-4 py-3">Action</th>}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {groupedData[groupKey].map(doc => {
                             const am = doc.data?.amendmentNumber && doc.data?.amendmentNumber !== 'N/A' ? doc.data.amendmentNumber : '000';
                             
                             // FALLBACK LOGIC SAME AS DASHBOARD
                             const lbe = doc.data?.lbe || 'US'; 
                             
                             const accountManager = doc.data?.accountManager && doc.data?.accountManager !== 'N/A' ? doc.data.accountManager : (doc.data?.purchasingContact || '-Blank');
                             const location = doc.data?.receivingPlants || doc.data?.manufacturingLocation || 'N/A';
                             const shipFromDuns = doc.data?.shipFromDuns || doc.data?.dunsNumber || 'N/A';

                             return (
                                <tr key={doc.id} className="hover:bg-gray-50">
                                    <td className="w-4 p-4">
                                        {canPerformActions ? (
                                        <input 
                                            type="checkbox" 
                                            className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" 
                                            checked={selectedDocs.includes(doc.id)} 
                                            onChange={(e) => onSelectionChange(doc.id, e.target.checked)}
                                        />
                                        ) : (
                                        <FileText className="w-4 h-4 text-gray-400" />
                                        )}
                                    </td>
                                    <td className="px-4 py-2 whitespace-nowrap">{doc.data?.issueDate || 'N/A'}</td>
                                    
                                    {/* CONTRACT_NO */}
                                    <td className="px-4 py-2 font-medium text-gray-900 whitespace-nowrap">
                                        <p 
                                        className="text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer font-bold" 
                                        onClick={() => onViewDetails?.(doc.id)}
                                        >
                                        {doc.contractNo}
                                        </p>
                                    </td>

                                    {/* AM - Link to File */}
                                    <td className="px-4 py-2 text-center">
                                        <button 
                                            className="text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer flex justify-center items-center font-bold w-full"
                                            onClick={() => handleOpenFile(doc)}
                                            title="Open Original File"
                                        >
                                            {am}
                                        </button>
                                    </td>
                                    
                                    <td className="px-4 py-2">{lbe}</td>
                                    <td className="px-4 py-2 truncate max-w-[150px]" title={accountManager}>{accountManager}</td>
                                    <td className="px-4 py-2 font-mono">{doc.data?.partNumber || 'N/A'}</td>
                                    <td className="px-4 py-2 truncate max-w-[150px]" title={doc.data?.programName}>{doc.data?.programName || '-Blank'}</td>
                                    <td className="px-4 py-2 font-mono">{shipFromDuns}</td>
                                    <td className="px-4 py-2 truncate max-w-[100px]" title={location}>{location}</td>
                                    <td className="px-4 py-2 text-xs">{doc.processedDate.split('T')[0]}</td>
                                    <td className="px-4 py-2 text-xs truncate max-w-[120px]" title={doc.processedBy}>{doc.processedBy}</td>
                                    
                                    {canDelete && (
                                        <td className="px-4 py-2 text-center">
                                            <button 
                                                onClick={() => onDeleteDocument?.(doc.id)}
                                                className="text-gray-400 hover:text-red-600 p-1.5 rounded-md transition-colors"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </td>
                                    )}
                                </tr>
                            );
                        })}
                    </tbody>
                 </table>
              </div>
            )}
          </div>
        ))}
        {Object.keys(groupedData).length === 0 && (
            <div className="text-center py-12 text-gray-500 bg-white rounded-lg shadow-sm border border-gray-200">
              <p>No documents found matching your criteria.</p>
            </div>
        )}
      </div>
    </div>
  );
};

export default GroupedView;
