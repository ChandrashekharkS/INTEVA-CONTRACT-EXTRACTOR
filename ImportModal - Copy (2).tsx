
import React, { useState, useRef, DragEvent, useEffect } from 'react';
import { UploadCloud, X, FileText, AlertTriangle, RotateCcw } from 'lucide-react';
import { DEFAULT_OLLAMA_BASE_URL, DEFAULT_OLLAMA_MODEL, DEFAULT_OLLAMA_TIMEOUT_SECONDS, testOllamaConnection } from '../services/ollamaService';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (files: FileList, companyName: string) => void;
}

type ConnectionStatus = 'untested' | 'testing' | 'success' | 'failed';

const ImportModal: React.FC<ImportModalProps> = ({ isOpen, onClose, onImport }) => {
  const [companyName, setCompanyName] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [ollamaBaseUrl, setOllamaBaseUrl] = useState(DEFAULT_OLLAMA_BASE_URL);
  const [ollamaModel, setOllamaModel] = useState(DEFAULT_OLLAMA_MODEL);
  const [ollamaTimeout, setOllamaTimeout] = useState(DEFAULT_OLLAMA_TIMEOUT_SECONDS);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('untested');
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
        // When modal opens, load settings from localStorage or use defaults
        const savedUrl = localStorage.getItem('ollamaBaseUrl');
        setOllamaBaseUrl(savedUrl || DEFAULT_OLLAMA_BASE_URL);
        const savedModel = localStorage.getItem('ollamaModel');
        setOllamaModel(savedModel || DEFAULT_OLLAMA_MODEL);
        const savedTimeout = localStorage.getItem('ollamaTimeout');
        setOllamaTimeout(savedTimeout ? parseInt(savedTimeout, 10) : DEFAULT_OLLAMA_TIMEOUT_SECONDS);
        // Reset connection status on open
        setConnectionStatus('untested');
        setConnectionError(null);
    }
  }, [isOpen]);

  // Reset connection status if the user changes the URL
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
    setIsDragging(true);
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
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files);
    }
  };

  const handleTestConnection = async () => {
    setConnectionStatus('testing');
    setConnectionError(null);
    const result = await testOllamaConnection(ollamaBaseUrl);
    if (result.success) {
        setConnectionStatus('success');
    } else {
        setConnectionStatus('failed');
        setConnectionError(result.message);
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
  };

  const handleSubmit = () => {
    // Save the current settings to localStorage for persistence
    localStorage.setItem('ollamaBaseUrl', ollamaBaseUrl);
    localStorage.setItem('ollamaModel', ollamaModel);
    localStorage.setItem('ollamaTimeout', String(ollamaTimeout));
    if (selectedFiles && selectedFiles.length > 0) {
      onImport(selectedFiles, companyName);
      // Reset state for next time
      setCompanyName('');
      setSelectedFiles(null);
    }
  };

  const fileList = selectedFiles ? Array.from(selectedFiles) : [];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-40" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6 m-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-800">Import Documents</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <div className="space-y-4">
          <div>
            <label htmlFor="companyName" className="block text-sm font-medium text-gray-700 mb-1">
              Company Name (Optional)
            </label>
            <input
              type="text"
              id="companyName"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="e.g., Inteva Solutions"
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            />
            <p className="text-xs text-gray-500 mt-1">Providing a name improves data accuracy.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Files
            </label>
            <div
              onDragEnter={handleDragEnter}
              onDragOver={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`flex flex-col items-center justify-center w-full p-6 border-2 border-dashed rounded-md cursor-pointer transition-colors ${isDragging ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300 hover:border-gray-400'}`}
            >
              <UploadCloud className="w-10 h-10 text-gray-400 mb-2" />
              <p className="text-sm text-gray-600">
                <span className="font-semibold text-indigo-600">Click to upload</span> or drag and drop
              </p>
              <p className="text-xs text-gray-500">PDF, Word (DOCX), XML, Image (PNG/JPG), or ZIP</p>
              <input
                type="file"
                ref={fileInputRef}
                onChange={(e) => handleFileSelect(e.target.files)}
                className="hidden"
                accept=".pdf,.txt,.zip,.xml,.docx,.png,.jpg,.jpeg"
                multiple
              />
            </div>
          </div>
          
          {fileList.length > 0 && (
            <div className="max-h-32 overflow-y-auto space-y-2 pr-2">
              <h3 className="text-sm font-medium text-gray-700">{fileList.length} file(s) selected:</h3>
              {/* @non-local-fix: Explicitly type 'file' as 'File' to resolve TypeScript inference issue. */}
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
                 <legend className="px-2 text-sm font-medium text-gray-700 -ml-2">AI Configuration</legend>
                 <button onClick={handleResetDefaults} className="flex items-center text-xs text-gray-500 hover:text-indigo-600 font-medium p-1 rounded-md">
                    <RotateCcw className="w-3 h-3 mr-1" />
                    Reset to Defaults
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
                      placeholder="e.g., all-minilm:latest"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">The model to use for extraction (e.g., `all-minilm:latest`, `llama3`).</p>
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
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">Default is 10 minutes (600s). Increase for very large documents or slow hardware.</p>
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
                            placeholder="e.g., http://localhost:11434"
                            className="flex-grow w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                        />
                        <button
                            type="button"
                            onClick={handleTestConnection}
                            disabled={connectionStatus === 'testing'}
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-gray-100 disabled:cursor-wait"
                        >
                            {connectionStatus === 'testing' ? 'Testing...' : 'Test'}
                        </button>
                    </div>
                    <div className="text-xs mt-1 h-4 flex items-center">
                        {connectionStatus === 'untested' && (
                            <span className="text-gray-500">
                                Use <code>/api/ollama</code> (Server Proxy) if accessing from another device.
                            </span>
                        )}
                        {connectionStatus === 'success' && <span className="text-green-600 font-medium">✅ Connection successful!</span>}
                        {connectionStatus === 'failed' && (
                            <span className="text-red-600 font-medium flex items-center">
                                <AlertTriangle className="w-4 h-4 mr-1.5 flex-shrink-0" />
                                {connectionError}
                            </span>
                        )}
                    </div>
                  </div>
              </div>
            </fieldset>
          </div>

        </div>

        <div className="mt-6 flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!selectedFiles || selectedFiles.length === 0}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-300 disabled:cursor-not-allowed"
          >
            Start Import
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImportModal;
