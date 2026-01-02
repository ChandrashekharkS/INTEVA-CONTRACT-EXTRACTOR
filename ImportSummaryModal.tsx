
import React from 'react';
import { CheckCircle, XCircle, Clock, X, FileText, AlertCircle } from 'lucide-react';

export interface ImportResult {
  fileName: string;
  status: 'success' | 'error';
  duration: number; // ms
  message?: string;
}

interface ImportSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  results: ImportResult[];
}

const ImportSummaryModal: React.FC<ImportSummaryModalProps> = ({ isOpen, onClose, results }) => {
  if (!isOpen) return null;

  const errorCount = results.filter(r => r.status === 'error').length;
  const totalDuration = results.reduce((acc, curr) => acc + curr.duration, 0);

  const formatTime = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl m-4 overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center p-4 border-b bg-gray-50">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Extraction Complete</h3>
            <p className="text-sm text-gray-500">Batch processing finished</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-white border border-gray-200 rounded-lg p-4 text-center shadow-sm">
              <div className="inline-flex p-2 rounded-full bg-blue-50 text-blue-600 mb-2">
                <FileText className="w-5 h-5" />
              </div>
              <div className="text-2xl font-bold text-gray-800">{results.length}</div>
              <div className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Files Processed</div>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-4 text-center shadow-sm">
              <div className="inline-flex p-2 rounded-full bg-purple-50 text-purple-600 mb-2">
                <Clock className="w-5 h-5" />
              </div>
              <div className="text-2xl font-bold text-gray-800">{formatTime(totalDuration)}</div>
              <div className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Total Duration</div>
            </div>
          </div>

          <div className="mb-2 font-medium text-gray-700 text-sm uppercase tracking-wide">Results Breakdown</div>

          <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
            {results.map((res, idx) => (
              <div key={idx} className="p-3 flex items-center justify-between hover:bg-gray-50">
                <div className="flex items-center space-x-3 overflow-hidden">
                  {res.status === 'success' ? (
                    <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{res.fileName}</p>
                    {res.message && <p className="text-xs text-red-600 truncate">{res.message}</p>}
                  </div>
                </div>
                <div className="text-xs text-gray-500 font-mono whitespace-nowrap ml-2">
                  {formatTime(res.duration)}
                </div>
              </div>
            ))}
          </div>

          {errorCount > 0 && (
             <div className="mt-4 p-3 bg-red-50 text-red-700 text-sm rounded border border-red-100 flex items-start">
                 <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0" />
                 <p>{errorCount} extraction(s) failed. Check file types or try again.</p>
             </div>
          )}
          
          {errorCount === 0 && results.length > 0 && (
              <div className="mt-4 p-3 bg-green-50 text-green-700 text-sm rounded border border-green-100 flex items-center">
                 <CheckCircle className="w-5 h-5 mr-2 flex-shrink-0" />
                 <p>All files processed successfully.</p>
              </div>
          )}
        </div>

        <div className="bg-gray-50 px-6 py-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors shadow-sm"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImportSummaryModal;
