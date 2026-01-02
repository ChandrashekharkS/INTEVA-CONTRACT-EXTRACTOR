
import React, { useMemo, useState, useEffect } from 'react';
import type { Document, User } from '../types';
import { Trash2, Calendar, Activity, Clock, Database, BarChart, ChevronUp, ChevronDown, ArrowUpDown, Filter } from 'lucide-react';

interface DashboardProps {
  documents: Document[];
  onDeleteDocument: (id: string) => void;
  selectedDocs: string[];
  onSelectionChange: (id: string, selected: boolean) => void;
  onSelectAll: (selected: boolean) => void;
  currentUser: User;
  title?: string;
  onViewDetails?: (id: string) => void;
  companies?: string[];
  selectedCompany?: string;
  onCompanyChange?: (company: string) => void;
  historicalDocuments?: Document[];
  onFilterClick?: (period: 'today' | 'week' | '3months' | 'older') => void;
  activeFilter?: 'today' | 'week' | '3months' | 'older' | null;
  onDeleteBulk?: (docs: Document[]) => void;
}

// Column Definition
type ColumnId = 
  | 'ISSUE_DATE' 
  | 'CONTRACT_NO' 
  | 'AM' 
  | 'LBE' 
  | 'ACCOUNT_MANAGER' 
  | 'PART_NUMBER' 
  | 'PROGRAM_NAME' 
  | 'SHIP_FROM_DUNS' 
  | 'LOCATION' 
  | 'ENTRY_DATE' 
  | 'USER';

interface ColumnDef {
  id: ColumnId;
  label: string;
  accessor: (doc: Document) => string;
}

const COLUMNS: ColumnDef[] = [
  { id: 'ISSUE_DATE', label: 'ISSUE_DATE', accessor: d => d.data?.issueDate || '' },
  { id: 'CONTRACT_NO', label: 'Contract Number', accessor: d => d.data?.contractNumber || '' },
  { id: 'AM', label: 'AM', accessor: d => d.data?.amendmentNumber || '' },
  { id: 'LBE', label: 'LBE', accessor: d => {
      if (d.data?.lbe && d.data.lbe !== 'N/A') return d.data.lbe;
      if (d.data?.buyerNameAndAddress && d.data.buyerNameAndAddress !== 'N/A') return d.data.buyerNameAndAddress.split('\n')[0];
      return d.data?.clientName || '';
  }},
  { id: 'ACCOUNT_MANAGER', label: 'ACCOUNT_MANAGER', accessor: d => d.data?.accountManager || '' },
  { id: 'PART_NUMBER', label: 'PART_NUMBER', accessor: d => d.data?.partNumber || '' },
  { id: 'PROGRAM_NAME', label: 'PROGRAM_NAME', accessor: d => d.data?.programName || '' },
  { id: 'SHIP_FROM_DUNS', label: 'SHIP_FROM_DUNS', accessor: d => d.data?.shipFromDuns || '' },
  { id: 'LOCATION', label: 'LOCATION', accessor: d => {
      if (d.data?.manufacturingLocation && d.data.manufacturingLocation !== 'N/A') return d.data.manufacturingLocation;
      if (d.data?.sellerNameAndAddress && d.data.sellerNameAndAddress !== 'N/A') {
          const lines = d.data.sellerNameAndAddress.split('\n');
          return lines[lines.length - 1];
      }
      return '';
  }},
  { id: 'ENTRY_DATE', label: 'ENTRY_DATE', accessor: d => d.processedDate ? d.processedDate.split('T')[0] : '' },
  { id: 'USER', label: 'USER', accessor: d => d.processedBy || '' },
];

const Dashboard: React.FC<DashboardProps> = ({ 
  documents, 
  onDeleteDocument, 
  selectedDocs, 
  onSelectionChange, 
  onSelectAll, 
  currentUser, 
  title, 
  onViewDetails,
  historicalDocuments,
  onFilterClick,
  activeFilter,
  onDeleteBulk
}) => {
  const [activeClientTab, setActiveClientTab] = useState<string>('ALL');
  const [chartMode, setChartMode] = useState<'monthly' | 'quarterly'>('monthly');
  const [hoverData, setHoverData] = useState<{x:number, y:number, value:number, label: string, company: string} | null>(null);
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const [sortConfig, setSortConfig] = useState<{ key: ColumnId; direction: 'asc' | 'desc' } | null>(null);

  const canPerformActions = currentUser.role !== 'Viewer';
  const canDelete = currentUser.role === 'Admin';

  // --- Dynamic Tab Logic ---
  const clientTabs = useMemo(() => {
    const allDocs = [...documents, ...(historicalDocuments || [])];
    const clients = new Set<string>();
    
    allDocs.forEach(doc => {
      const name = doc.data?.clientName;
      if (name && name !== 'N/A' && name.trim() !== '') {
        clients.add(name.trim().toUpperCase());
      }
    });

    return ['ALL', ...Array.from(clients).sort((a, b) => a.localeCompare(b))];
  }, [documents, historicalDocuments]);

  // Reset tab if it disappears
  useEffect(() => {
    if (!clientTabs.includes(activeClientTab)) {
      setActiveClientTab('ALL');
    }
  }, [clientTabs, activeClientTab]);

  // --- Filtering Logic ---
  const filteredByTabDocs = useMemo(() => {
    if (activeClientTab === 'ALL') return documents;
    return documents.filter(doc => doc.data?.clientName?.toUpperCase() === activeClientTab);
  }, [documents, activeClientTab]);

  const filteredAndSortedDocs = useMemo(() => {
    let result = filteredByTabDocs.filter(doc => {
       return COLUMNS.every(col => {
         const filterVal = columnFilters[col.id];
         if (!filterVal) return true;
         return col.accessor(doc) === filterVal;
       });
    });

    if (sortConfig) {
      result.sort((a, b) => {
        const valA = COLUMNS.find(c => c.id === sortConfig.key)?.accessor(a) || '';
        const valB = COLUMNS.find(c => c.id === sortConfig.key)?.accessor(b) || '';
        
        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [filteredByTabDocs, columnFilters, sortConfig]);

  const docsToDelete = useMemo(() => {
      return filteredAndSortedDocs.filter(d => selectedDocs.includes(d.id));
  }, [filteredAndSortedDocs, selectedDocs]);

  const isAllSelected = filteredAndSortedDocs.length > 0 && selectedDocs.length === filteredAndSortedDocs.length;

  const handleSort = (columnId: ColumnId) => {
      setSortConfig(current => {
          if (current?.key === columnId) {
              if (current.direction === 'asc') return { key: columnId, direction: 'desc' };
              return null; 
          }
          return { key: columnId, direction: 'asc' };
      });
  };

  const handleFilterChange = (columnId: ColumnId, value: string) => {
      setColumnFilters(prev => ({ ...prev, [columnId]: value }));
  };

  const handleOpenFile = (doc: Document) => {
    if (doc.fileUrl) { window.open(doc.fileUrl, '_blank'); } 
    else { alert('Original file content is not available for this archived document.'); }
  };

  const uniqueColumnValues = useMemo(() => {
    const values: Record<string, string[]> = {};
    COLUMNS.forEach(col => {
      const colValues = new Set<string>();
      filteredByTabDocs.forEach(doc => {
        const val = col.accessor(doc);
        if (val && val !== 'N/A' && val.trim() !== '') { colValues.add(val); }
      });
      values[col.id] = Array.from(colValues).sort();
    });
    return values;
  }, [filteredByTabDocs]);

  // Statistics Calculation
  const stats = useMemo(() => {
      if (!historicalDocuments) return null;
      const docsToProcess = historicalDocuments;
      const now = new Date();
      const todayStr = now.toISOString().split('T')[0];
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());

      let todayCount = 0; let weekCount = 0; let threeMonthCount = 0; let olderCount = 0;
      const companyTrend: Record<string, Record<string, number>> = {}; 
      const timeKeys: string[] = [];
      const timeTotals: Record<string, number> = {}; 
      
      if (chartMode === 'monthly') {
          for (let i = 11; i >= 0; i--) {
              const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
              const key = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }); 
              timeKeys.push(key); timeTotals[key] = 0;
          }
      } else {
          let currentQ = Math.floor(now.getMonth() / 3) + 1;
          let currentY = now.getFullYear();
          for (let i = 3; i >= 0; i--) {
              let q = currentQ - i; let y = currentY;
              while (q <= 0) { q += 4; y -= 1; }
              const key = `Q${q} ${y}`;
              timeKeys.push(key); timeTotals[key] = 0;
          }
      }

      docsToProcess.forEach(doc => {
          const docDate = new Date(doc.processedDate);
          const docDateStr = doc.processedDate.split('T')[0];
          if (docDateStr === todayStr) todayCount++;
          if (docDate >= oneWeekAgo) weekCount++;
          if (docDate >= threeMonthsAgo) threeMonthCount++;
          else olderCount++;

          let bucketKey = (chartMode === 'monthly') 
            ? docDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
            : `Q${Math.floor(docDate.getMonth() / 3) + 1} ${docDate.getFullYear()}`;

          const clientName = (doc.data?.clientName && doc.data.clientName !== 'N/A') ? doc.data.clientName.toUpperCase() : 'UNCATEGORIZED';
          if (timeKeys.includes(bucketKey)) {
             if (!companyTrend[clientName]) companyTrend[clientName] = {};
             companyTrend[clientName][bucketKey] = (companyTrend[clientName][bucketKey] || 0) + 1;
             timeTotals[bucketKey] = (timeTotals[bucketKey] || 0) + 1;
          }
      });

      return { todayCount, weekCount, threeMonthCount, olderCount, companyTrend, timeKeys, timeTotals };
  }, [historicalDocuments, chartMode]);

  const renderTrendChart = () => {
      if (!stats || Object.keys(stats.companyTrend).length === 0) return null;
      const { companyTrend, timeKeys, timeTotals } = stats;
      const topCompanies = Object.keys(companyTrend)
          .sort((a, b) => {
              const totalA = (Object.values(companyTrend[a]) as number[]).reduce((sum, v) => sum + v, 0);
              const totalB = (Object.values(companyTrend[b]) as number[]).reduce((sum, v) => sum + v, 0);
              return totalB - totalA;
          }).slice(0, 5);

      const colors = ['#4f46e5', '#ec4899', '#10b981', '#f59e0b', '#6366f1'];
      const height = 250; const width = 800; const padding = 50;
      const maxVal = Math.max(...Object.values(timeTotals), 5);
      const chartHeight = height - 2 * padding;
      const chartWidth = width - 2 * padding;
      const numBuckets = timeKeys.length;
      const slotWidth = chartWidth / numBuckets;
      const barWidth = slotWidth * 0.6; 
      const barOffset = (slotWidth - barWidth) / 2;
      const getX = (index: number) => padding + index * slotWidth + barOffset;

      return (
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 mt-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6">
                 <h4 className="text-sm font-semibold text-gray-700 flex items-center">
                    <BarChart className="w-5 h-5 mr-2 text-indigo-500"/> 
                    Contract Volume (Stacked Bar)
                 </h4>
                 <div className="flex bg-gray-100 p-1 rounded-lg">
                    <button onClick={() => setChartMode('monthly')} className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${chartMode === 'monthly' ? 'bg-white shadow text-indigo-600' : 'text-gray-500 hover:text-gray-900'}`}>Monthly</button>
                    <button onClick={() => setChartMode('quarterly')} className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${chartMode === 'quarterly' ? 'bg-white shadow text-indigo-600' : 'text-gray-500 hover:text-gray-900'}`}>Quarterly</button>
                 </div>
              </div>
              <div className="relative w-full overflow-x-auto min-w-[700px]">
                <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
                    {[0, 0.25, 0.5, 0.75, 1].map(ratio => {
                        const y = height - padding - (ratio * chartHeight);
                        return (
                            <g key={ratio}>
                                <line x1={padding} y1={y} x2={width - padding} y2={y} stroke="#e5e7eb" strokeWidth="1" />
                                <text x={padding - 10} y={y + 3} textAnchor="end" fontSize="10" fill="#9ca3af">{Math.round(ratio * maxVal)}</text>
                            </g>
                        );
                    })}
                    {timeKeys.map((m, i) => (
                        <text key={m} x={padding + i * slotWidth + slotWidth / 2} y={height - 15} textAnchor="middle" fontSize="10" fill="#6b7280">{m}</text>
                    ))}
                    {timeKeys.map((timeKey, timeIndex) => {
                        let currentStackHeight = 0;
                        const x = getX(timeIndex);
                        return (
                            <g key={timeKey}>
                                {topCompanies.map((comp, compIndex) => {
                                    const count = companyTrend[comp][timeKey] || 0;
                                    if (count === 0) return null;
                                    const barSegmentHeight = (count / maxVal) * chartHeight;
                                    const y = height - padding - currentStackHeight - barSegmentHeight;
                                    currentStackHeight += barSegmentHeight;
                                    return (
                                        <rect
                                            key={`${timeKey}-${comp}`}
                                            x={x} y={y} width={barWidth} height={barSegmentHeight} fill={colors[compIndex]}
                                            className="hover:opacity-80 transition-opacity cursor-pointer"
                                            onMouseEnter={() => setHoverData({ x: x + barWidth / 2, y: y, value: count, label: timeKey, company: comp })}
                                            onMouseLeave={() => setHoverData(null)}
                                        />
                                    );
                                })}
                            </g>
                        );
                    })}
                    {hoverData && (
                        <g transform={`translate(${hoverData.x}, ${hoverData.y - 45})`}>
                            <rect x="-60" y="0" width="120" height="40" rx="4" fill="#1f2937" opacity="0.9" />
                            <text x="0" y="15" textAnchor="middle" fill="white" fontSize="11" fontWeight="bold">{hoverData.company}</text>
                            <text x="0" y="30" textAnchor="middle" fill="#d1d5db" fontSize="10">{hoverData.label}: {hoverData.value} files</text>
                        </g>
                    )}
                </svg>
              </div>
          </div>
      );
  };

  return (
    <div className="space-y-6">
      
      {/* Dynamic Brand/Company Tab Bar */}
      <div className="flex justify-center mb-4">
        <div className="bg-[#f0f4f8] p-2 rounded-[18px] flex items-center shadow-sm max-w-full overflow-x-auto scrollbar-hide">
          <div className="flex space-x-6 px-4">
            {clientTabs.map(client => (
              <button
                key={client}
                onClick={() => setActiveClientTab(client)}
                className={`text-[13px] font-bold tracking-wider px-6 py-2 transition-all duration-200 ${
                  activeClientTab === client
                    ? 'bg-white border-2 border-black rounded-[14px] text-[#554ce8]'
                    : 'text-[#6b7c93] hover:text-[#554ce8]'
                }`}
              >
                {client}
              </button>
            ))}
          </div>
        </div>
      </div>

      {historicalDocuments && stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                  { id: 'today', label: 'Processed Today', count: stats.todayCount, color: 'blue', icon: Calendar },
                  { id: 'week', label: 'Past 7 Days', count: stats.weekCount, color: 'green', icon: Activity },
                  { id: '3months', label: 'Last 3 Months', count: stats.threeMonthCount, color: 'indigo', icon: Clock },
                  { id: 'older', label: 'Older Archives', count: stats.olderCount, color: 'gray', icon: Database },
              ].map(card => (
                  <div 
                    key={card.id} 
                    onClick={() => onFilterClick?.(card.id as any)}
                    className={`bg-white p-4 rounded-lg shadow-sm border cursor-pointer transition-all hover:scale-[1.02] ${activeFilter === card.id ? 'border-indigo-500 ring-2 ring-indigo-500 ring-offset-2' : 'border-gray-200'}`}
                  >
                    <div className="flex items-center">
                        <div className={`p-3 bg-${card.color}-100 rounded-full mr-4`}><card.icon className={`w-6 h-6 text-${card.color}-600`} /></div>
                        <div><p className="text-sm text-gray-500 font-medium">{card.label}</p><h3 className="text-2xl font-bold text-gray-800">{card.count}</h3></div>
                    </div>
                  </div>
              ))}
          </div>
      )}

      {historicalDocuments && renderTrendChart()}

      {/* Main Document Table Card */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-4 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h3 className="text-lg font-semibold text-gray-800 flex items-center">
             <Filter className="w-4 h-4 mr-2 text-indigo-500" />
             {activeClientTab === 'ALL' ? (title || 'Contracts Dashboard') : `${activeClientTab} Documents`}
          </h3>
          
          <div className="flex items-center space-x-2">
            {canDelete && onDeleteBulk && (
                <button 
                  onClick={() => onDeleteBulk && onDeleteBulk(docsToDelete)}
                  disabled={docsToDelete.length === 0}
                  className={`flex items-center text-white font-medium rounded-md text-sm px-3 py-2 transition-colors ml-2 ${docsToDelete.length === 0 ? 'bg-red-300 cursor-not-allowed opacity-70' : 'bg-red-600 hover:bg-red-700'}`}
                >
                    <Trash2 className="w-4 h-4 mr-1" />
                    <span>Delete {docsToDelete.length > 0 ? `(${docsToDelete.length})` : ''}</span>
                </button>
            )}
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left text-gray-500">
            <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b">
              <tr>
                {canPerformActions && (
                  <th scope="col" className="p-4 w-4">
                    <input type="checkbox" className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" checked={isAllSelected} onChange={(e) => onSelectAll(e.target.checked)} />
                  </th>
                )}
                {COLUMNS.map(col => (
                    <th key={col.id} scope="col" className="px-2 py-3 cursor-pointer hover:bg-gray-100" onClick={() => handleSort(col.id)}>
                        <div className={`flex items-center space-x-1 ${col.id === 'AM' ? 'justify-center' : ''}`}>
                            <span>{col.label}</span>
                            <div className="flex flex-col">
                                {sortConfig?.key === col.id && sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3 text-indigo-600"/> : null}
                                {sortConfig?.key === col.id && sortConfig.direction === 'desc' ? <ChevronDown className="w-3 h-3 text-indigo-600"/> : null}
                                {sortConfig?.key !== col.id && <ArrowUpDown className="w-3 h-3 text-gray-400"/>}
                            </div>
                        </div>
                    </th>
                ))}
                {canDelete && <th scope="col" className="px-2 py-3 w-8"></th>}
              </tr>
              <tr className="bg-white border-b">
                 {canPerformActions && <th className="p-4"></th>}
                 {COLUMNS.map(col => (
                     <th key={col.id} className="px-2 py-2">
                         <select
                            className="w-full border border-gray-300 rounded text-xs py-1 px-1"
                            value={columnFilters[col.id] || ''}
                            onChange={(e) => handleFilterChange(col.id, e.target.value)}
                         >
                             <option value=""></option>
                             {uniqueColumnValues[col.id].map(val => (
                                 <option key={val} value={val}>{val}</option>
                             ))}
                         </select>
                     </th>
                 ))}
                 {canDelete && <th></th>}
              </tr>
            </thead>
            <tbody>
              {filteredAndSortedDocs.map(doc => (
                <tr key={doc.id} className={`border-b hover:bg-gray-50 ${selectedDocs.includes(doc.id) ? 'bg-indigo-50' : 'bg-white'}`}>
                  {canPerformActions && (
                    <td className="w-4 p-4">
                      <input type="checkbox" className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" checked={selectedDocs.includes(doc.id)} onChange={(e) => onSelectionChange(doc.id, e.target.checked)} />
                    </td>
                  )}
                  {COLUMNS.map(col => {
                      const val = col.accessor(doc);
                      return (
                          <td key={col.id} className={`px-2 py-2 whitespace-nowrap ${col.id === 'AM' ? 'text-center' : ''}`}>
                              {col.id === 'CONTRACT_NO' ? (
                                  <button className="text-indigo-600 font-semibold hover:underline" onClick={() => onViewDetails?.(doc.id)}>{val || 'N/A'}</button>
                              ) : col.id === 'AM' ? (
                                  <button className="text-indigo-600 hover:underline font-semibold" onClick={() => handleOpenFile(doc)}>{val || '000'}</button>
                              ) : (
                                  <span className="truncate block max-w-[200px]" title={val}>{val}</span>
                              )}
                          </td>
                      );
                  })}
                  {canDelete && (
                    <td className="px-2 py-2 text-right">
                      <button onClick={() => onDeleteDocument(doc.id)} className="text-gray-400 hover:text-red-600 p-1 rounded-md transition-colors"><Trash2 className="w-4 h-4" /></button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {filteredAndSortedDocs.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <p>No documents to display for the selected company.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
