import React, { useState, useRef, DragEvent, useEffect } from 'react';
import { UploadCloud, X, FileText, AlertTriangle, RotateCcw, HelpCircle, FileType, Building2 } from 'lucide-react';
import { DEFAULT_OLLAMA_BASE_URL, DEFAULT_OLLAMA_MODEL, DEFAULT_OLLAMA_TIMEOUT_SECONDS, testOllamaConnection } from '../services/ollamaService';
import { DocType } from '../types';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (files: FileList, companyName: string, docType: DocType) => void;
}

type ConnectionStatus = 'untested' | 'testing' | 'success' | 'failed';

const DOC_TYPES: { value: DocType; label: string; extensions: string }[] = [
  { value: 'PDF', label: 'PDF Document', extensions: '.pdf' },
  { value: 'DOC', label: 'Word Document (.docx)', extensions: '.docx' },
  { value: 'XLS', label: 'Excel Spreadsheet (.xls, .xlsx)', extensions: '.xls,.xlsx' },
  { value: 'XML', label: 'XML Data File (.xml)', extensions: '.xml' },
  { value: 'JSON', label: 'JSON Data File (.json)', extensions: '.json' },
  { value: 'IMAGE', label: 'Image Files (PNG, JPG, TIFF)', extensions: '.png,.jpg,.jpeg,.tiff,.bmp,.webp' },
];

const ImportModal: React.FC<ImportModalProps> = ({ isOpen, onClose, onImport }) => {
  const [companyName, setCompanyName] = useState('');
  const [docType, setDocType] = useState<DocType | ''>('');
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [ollamaBaseUrl, setOllamaBaseUrl] = useState(DEFAULT_OLLAMA_BASE_URL);
  const [ollamaModel, setOllamaModel] = useState(DEFAULT_OLLAMA_MODEL);
  const [ollamaTimeout, setOllamaTimeout] = useState(DEFAULT_OLLAMA_TIMEOUT_SECONDS);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('untested');
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [showTroubleshoot, setShowTroubleshoot] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
        const savedUrl = localStorage.getItem('ollamaBaseUrl');
        setOllamaBaseUrl(savedUrl || DEFAULT_OLLAMA_BASE_URL);
        const savedModel = localStorage.getItem('ollamaModel');
        setOllamaModel(savedModel || DEFAULT_OLLAMA_MODEL);
        const savedTimeout = localStorage.getItem('ollamaTimeout');
        setOllamaTimeout(savedTimeout ? parseInt(savedTimeout, 10) : DEFAULT_OLLAMA_TIMEOUT_SECONDS);
        setConnectionStatus('untested');
        setConnectionError(null);
        setShowTroubleshoot(false);
        setDocType('');
        setCompanyName('');
        setSelectedFiles(null);
    }
  }, [isOpen]);

  useEffect(() => {
    setConnectionStatus('untested');
    setConnectionError(null);
  }, [ollamaBaseUrl]);

  if (!isOpen) return null;

  const handleFileSelect = (files: FileList | null) => {
    if (files && files.length > 0) {
      setSelectedFiles(files);
    }
  };
  
  const handleDragEnter = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (docType && companyName.trim()) setIsDragging(true);
  };
  
  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };
  
  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (docType && companyName.trim() && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files);
    }
  };

  const handleTestConnection = async () => {
    setConnectionStatus('testing');
    setConnectionError(null);
    setShowTroubleshoot(false);

    const result = await testOllamaConnection(ollamaBaseUrl);
    
    if (result.success) {
        setConnectionStatus('success');
    } else {
        setConnectionStatus('failed');
        setConnectionError(result.message);
        setShowTroubleshoot(true);
    }
  };

  const handleResetDefaults = () => {
    localStorage.removeItem('ollamaBaseUrl');
    localStorage.removeItem('ollamaModel');
    localStorage.removeItem('ollamaTimeout');
    setOllamaBaseUrl(DEFAULT_OLLAMA_BASE_URL);
    setOllamaModel(DEFAULT_OLLAMA_MODEL);
    setOllamaTimeout(DEFAULT_OLLAMA_TIMEOUT_SECONDS);
    setConnectionStatus('untested');
    setConnectionError(null);
    setShowTroubleshoot(false);
  };

  const handleSubmit = () => {
    localStorage.setItem('ollamaBaseUrl', ollamaBaseUrl);
    localStorage.setItem('ollamaModel', ollamaModel);
    localStorage.setItem('ollamaTimeout', String(ollamaTimeout));
    if (selectedFiles && selectedFiles.length > 0 && docType && companyName.trim()) {
      onImport(selectedFiles, companyName.trim(), docType);
      setCompanyName('');
      setSelectedFiles(null);
    }
  };

  const fileList = selectedFiles ? Array.from(selectedFiles) : [];
  const currentAccept = DOC_TYPES.find(t => t.value === docType)?.extensions || '*';
  const isSelectionDisabled = !docType || !companyName.trim();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-40" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6 m-4 overflow-y-auto max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-800">Import Documents</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="companyName" className="block text-sm font-medium text-gray-700 mb-1">
                Company Name (Mandatory)
              </label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  id="companyName"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Enter Company Name"
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                />
              </div>
            </div>
            <div>
              <label htmlFor="docType" className="block text-sm font-medium text-gray-700 mb-1">
                Document Type (Mandatory)
              </label>
              <div className="relative">
                <FileType className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <select
                    id="docType"
                    value={docType}
                    onChange={(e) => setDocType(e.target.value as DocType)}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-sm appearance-none bg-white"
                >
                    <option value="">Select Type</option>
                    {DOC_TYPES.map(type => (
                        <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                </select>
              </div>
            </div>
          </div>

          <div>
            <label className={`block text-sm font-medium mb-1 ${isSelectionDisabled ? 'text-gray-400' : 'text-gray-700'}`}>
              Select Files
            </label>
            <div
              onDragEnter={handleDragEnter}
              onDragOver={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => !isSelectionDisabled && fileInputRef.current?.click()}
              className={`flex flex-col items-center justify-center w-full p-6 border-2 border-dashed rounded-md transition-colors ${
                isSelectionDisabled 
                  ? 'border-gray-200 bg-gray-50 cursor-not-allowed opacity-60' 
                  : isDragging ? 'border-indigo-500 bg-indigo-50 cursor-pointer' : 'border-gray-300 hover:border-gray-400 cursor-pointer'
              }`}
            >
              <UploadCloud className={`w-10 h-10 mb-2 ${isSelectionDisabled ? 'text-gray-300' : 'text-gray-400'}`} />
              <p className="text-sm text-gray-600">
                {isSelectionDisabled ? (
                  <span className="text-gray-400 italic">Enter Company and Type first</span>
                ) : (
                  <>
                    <span className="font-semibold text-indigo-600">Click to upload</span> or drag and drop
                  </>
                )}
              </p>
              <p className="text-xs text-gray-500">
                {docType ? `Only ${docType} files` : 'Files will be restricted by type'}
              </p>
              <input
                type="file"
                ref={fileInputRef}
                onChange={(e) => handleFileSelect(e.target.files)}
                className="hidden"
                accept={currentAccept}
                multiple
                disabled={isSelectionDisabled}
              />
            </div>
          </div>
          
          {fileList.length > 0 && (
            <div className="max-h-32 overflow-y-auto space-y-2 pr-2">
              <h3 className="text-sm font-medium text-gray-700">{fileList.length} file(s) selected:</h3>
              {fileList.map((file: File, index) => (
                <div key={index} className="flex items-center text-sm bg-gray-50 p-2 rounded">
                  <FileText className="w-4 h-4 mr-2 text-gray-500 flex-shrink-0" />
                  <span className="text-gray-800 truncate">{file.name}</span>
                </div>
              ))}
            </div>
          )}

          <div className="border-t pt-4">
            <fieldset className="border p-4 rounded-md">
              <div className="flex justify-between items-center mb-2">
                 <legend className="px-2 text-sm font-medium text-gray-700 -ml-2">AI Configuration (Stage 2)</legend>
                 <button onClick={handleResetDefaults} className="flex items-center text-xs text-gray-500 hover:text-indigo-600 font-medium p-1 rounded-md">
                    <RotateCcw className="w-3 h-3 mr-1" />
                    Reset
                 </button>
              </div>
             
              <div className="space-y-4">
                  <div>
                    <label htmlFor="ollamaModel" className="block text-sm font-medium text-gray-700 mb-1">
                      Ollama Model Name
                    </label>
                    <input
                      type="text"
                      id="ollamaModel"
                      value={ollamaModel}
                      onChange={(e) => setOllamaModel(e.target.value)}
                      placeholder="e.g., llama3.2"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                    />
                  </div>
                   <div>
                    <label htmlFor="ollamaTimeout" className="block text-sm font-medium text-gray-700 mb-1">
                      Request Timeout (seconds)
                    </label>
                    <input
                      type="number"
                      id="ollamaTimeout"
                      value={ollamaTimeout}
                      onChange={(e) => setOllamaTimeout(Number(e.target.value))}
                      min="30"
                      step="30"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                    />
                  </div>
                  <div>
                    <label htmlFor="ollamaUrl" className="block text-sm font-medium text-gray-700 mb-1">
                      Ollama Server Base URL
                    </label>
                    <div className="flex items-center space-x-2">
                        <input
                            type="text"
                            id="ollamaUrl"
                            value={ollamaBaseUrl}
                            onChange={(e) => setOllamaBaseUrl(e.target.value)}
                            className="flex-grow w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                        />
                        <button
                            type="button"
                            onClick={handleTestConnection}
                            disabled={connectionStatus === 'testing'}
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50"
                        >
                            {connectionStatus === 'testing' ? 'Testing...' : 'Test'}
                        </button>
                    </div>
                  </div>
                  {connectionStatus === 'success' && <p className="text-xs text-green-600">Connection successful!</p>}
                  {connectionStatus === 'failed' && (
                      <div className="mt-2 text-xs text-red-600">
                          <p className="font-semibold mb-1">Connection Failed:</p>
                          <p>{connectionError}</p>
                          {showTroubleshoot && (
                              <div className="mt-2 p-2 bg-red-50 border border-red-100 rounded text-gray-700">
                                  <div className="flex items-center mb-1 font-semibold text-red-700">
                                      <HelpCircle className="w-3 h-3 mr-1" /> Troubleshooting
                                  </div>
                                  <ul className="list-disc pl-4 space-y-1">
                                      {ollamaBaseUrl.startsWith('/') ? (
                                         <>
                                            <li>Ensure the <strong>Backend Server</strong> is running (port 3001).</li>
                                            <li>Check if <strong>npm start</strong> was run in the server directory.</li>
                                         </>
                                      ) : (
                                          <>
                                            <li>Ensure <strong>Ollama</strong> is running locally.</li>
                                            <li>You must allow browser access by running Ollama with: <br/><code className="bg-gray-200 px-1 rounded">OLLAMA_ORIGINS="*" ollama serve</code></li>
                                          </>
                                      )}
                                  </ul>
                              </div>
                          )}
                      </div>
                  )}
                  
                   {/* Recommendation for remote access */}
                   {window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1' && (
                       <div className="flex items-start mt-2 p-2 bg-blue-50 rounded text-xs text-blue-800">
                           <AlertTriangle className="w-4 h-4 mr-1 flex-shrink-0" />
                           <span>You are accessing remotely. Ensure "Ollama Server Base URL" is set to <strong>/api/ollama</strong> (Server Proxy).</span>
                       </div>
                   )}
              </div>
            </fieldset>
          </div>

        </div>

        <div className="mt-6 flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!selectedFiles || selectedFiles.length === 0 || !docType || !companyName.trim()}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md shadow-sm hover:bg-indigo-700 disabled:bg-indigo-300"
          >
            Start Import
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImportModal;