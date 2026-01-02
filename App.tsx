
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import UserManagement from './components/UserManagement';
import { initialUsers } from './services/mockData';
import type { View, Document, User, UserRole, ExtractedData } from './types';
import { extractContractData } from './services/ollamaService';
import { exportToCsv, exportToSql, saveComparisonToDb, exportComparisonToExcel } from './services/exportService';
import { fetchContracts, deleteContract, fetchCompanies } from './services/contractService';
import GroupedView from './components/GroupedView';
import ComparisonView from './components/ComparisonView';
import ImportModal from './components/ImportModal';
import DocumentDetailModal from './components/DocumentDetailModal';
import ImportSummaryModal, { ImportResult } from './components/ImportSummaryModal';
import { Loader2 } from 'lucide-react';

declare const JSZip: any;
declare const pdfjsLib: any;
declare const Tesseract: any;

const runPreImportChecks = (): { success: boolean; message?: string } => {
    if (typeof pdfjsLib === 'undefined') {
        return { success: false, message: 'PDF library failed to load. Please check your internet connection and refresh.' };
    }
    if (typeof Tesseract === 'undefined') {
        return { success: false, message: 'OCR library failed to load. Please check your internet connection and refresh.' };
    }
    if (typeof JSZip === 'undefined') {
        return { success: false, message: 'ZIP library failed to load. Please check your internet connection and refresh.' };
    }
    return { success: true };
};

const App: React.FC = () => {
  // Persist View State
  const [view, setView] = useState<View>(() => {
      return (localStorage.getItem('appView') as View) || 'dashboard';
  });
  
  const [previousView, setPreviousView] = useState<View>('dashboard');
  const [documents, setDocuments] = useState<Document[]>([]); // Session documents (Imported now)
  const [savedDocuments, setSavedDocuments] = useState<Document[]>([]); // Database documents (filtered/loaded from DB)
  const [historicalStatsData, setHistoricalStatsData] = useState<Document[]>([]); // Data for dashboard graphs (6 months or all)
  const [users, setUsers] = useState<User[]>(initialUsers);
  
  // Authentication State - Default to Admin (No Login Page)
  const [currentUser, setCurrentUser] = useState<User>(initialUsers[0]);
  
  const [selectedDocs, setSelectedDocs] = useState<string[]>([]);

  // Filtering State
  const [dbCompanies, setDbCompanies] = useState<string[]>([]);
  const [selectedCompanyFilter, setSelectedCompanyFilter] = useState<string>('');
  
  // Dashboard Card Filter State
  const [dashboardFilter, setDashboardFilter] = useState<'today' | 'week' | '3months' | 'older' | null>(null);

  // Title State for Database View to reflect filter (e.g. Last 3 Months vs All)
  const [databaseViewTitle, setDatabaseViewTitle] = useState('Stored Contracts (Last 3 Months)');
  
  // Search State
  const [searchTerm, setSearchTerm] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error'} | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [detailModalDoc, setDetailModalDoc] = useState<Document | null>(null);
  
  // Summary Modal State
  const [importResults, setImportResults] = useState<ImportResult[]>([]);
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);

  // Processing State
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);
  const [processedCount, setProcessedCount] = useState(0);
  const [totalBatchCount, setTotalBatchCount] = useState(0);

  // Save View on Change
  useEffect(() => {
    localStorage.setItem('appView', view);
  }, [view]);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 8000); 
      return () => clearTimeout(timer);
    }
  }, [notification]);
  
  const loadCompanies = useCallback(async () => {
      try {
          const companies = await fetchCompanies();
          setDbCompanies(companies || []);
      } catch (e) {
          console.error("Failed to fetch companies list", e);
          setDbCompanies([]);
      }
  }, []);

  // Compute the final list of companies available for filtering
  const availableCompanies = useMemo(() => {
    let contextCompanies: string[] = [];

    if (view === 'dashboard') {
        const sourceDocs = documents.length > 0 ? documents : historicalStatsData;
        
        contextCompanies = sourceDocs
            .map(doc => doc.data?.clientName)
            .filter((name): name is string => !!name && name !== 'N/A' && name.trim() !== '');
    } else if (view === 'today' || view === 'month') {
         const historyCompanies = historicalStatsData
             .map(doc => doc.data?.clientName)
             .filter((name): name is string => !!name && name !== 'N/A' && name.trim() !== '');
         const sessionCompanies = documents
            .map(doc => doc.data?.clientName)
            .filter((name): name is string => !!name && name !== 'N/A' && name.trim() !== '');
         contextCompanies = [...historyCompanies, ...sessionCompanies];
    } else {
        const visibleCompanies = savedDocuments
            .map(doc => doc.data?.clientName)
            .filter((name): name is string => !!name && name !== 'N/A' && name.trim() !== '');
            
        contextCompanies = [...dbCompanies, ...visibleCompanies];
    }
    
    const uniqueCompanies = new Set(contextCompanies);
    return Array.from(uniqueCompanies).sort();
  }, [dbCompanies, documents, historicalStatsData, savedDocuments, view]);

  const loadSavedContracts = useCallback(async (companyFilter?: string, months: number | null = 3) => {
    setIsLoading(true);
    
    const timeLabel = months ? `(Last ${months} Months)` : '(All Time)';
    setLoadingMessage(companyFilter 
        ? `Fetching contracts for ${companyFilter} ${timeLabel}...` 
        : `Fetching contracts from database ${timeLabel}...`);
    
    // Update Title based on fetch
    setDatabaseViewTitle(months ? `Stored Contracts (Last ${months} Months)` : 'Stored Contracts (All Archives)');

    try {
        const docs = await fetchContracts(companyFilter, months || undefined);
        setSavedDocuments(docs || []);
    } catch (e) {
        console.warn('DB fetch failed, using empty list.');
        showNotification('Database unavailable. Showing session files only.', 'error');
        setSavedDocuments([]);
    } finally {
        setIsLoading(false);
        setLoadingMessage('');
    }
  }, []);

  const loadGroupedContracts = useCallback(async () => {
    setIsLoading(true);
    setLoadingMessage('Fetching grouped contracts (Last 7 Days)...');
    try {
        const docs = await fetchContracts(undefined, undefined, 7); // Fetch last 7 days
        setSavedDocuments(docs || []);
    } catch (e) {
        showNotification('Failed to load grouped contracts.', 'error');
        setSavedDocuments([]);
    } finally {
        setIsLoading(false);
        setLoadingMessage('');
    }
  }, []);

  // Initial Load (Background Fetch)
  useEffect(() => {
      const initDashboard = async () => {
          try {
              const statsDocs = await fetchContracts(undefined, 6);
              setHistoricalStatsData(statsDocs || []);
              
              await loadCompanies();

              if (view === 'database') {
                  await loadSavedContracts(); 
              } else if (view === 'grouped') {
                  await loadGroupedContracts();
              }
          } catch (e) {
              console.error("Failed to load initial data", e);
              setHistoricalStatsData([]);
          }
      };
      // Always init since we are always "logged in"
      initDashboard();
  }, [loadCompanies, loadSavedContracts, loadGroupedContracts, view]); 

  const showNotification = (message: string, type: 'success' | 'error') => {
    setNotification({ message, type });
  };

  const handleNavigate = (newView: View) => {
    // Reset dashboard filter when leaving dashboard
    if (view === 'dashboard' && newView !== 'dashboard') {
        setDashboardFilter(null);
    }

    if (newView === 'database') {
        loadCompanies();
        loadSavedContracts(selectedCompanyFilter, 3); // Default to 3 months when navigating via sidebar
        setSelectedDocs([]); 
    } else if (newView === 'dashboard') {
        setSelectedDocs([]);
        // Re-fetch stats data (6 months default) just in case
        fetchContracts(undefined, 6).then(docs => setHistoricalStatsData(docs || [])).catch(() => {});
        setDashboardFilter(null);
    } else if (newView === 'grouped') {
        loadGroupedContracts();
        setSelectedDocs([]);
    } else if (newView === 'today') {
        fetchContracts(undefined, 6).then(docs => setHistoricalStatsData(docs || [])).catch(() => {});
    }

    if (newView !== 'comparison') {
      setPreviousView(view);
    }
    setView(newView);
  };

  // Handler for Dashboard Card Clicks -> Filters the dashboard table in-place
  const handleDashboardFilterClick = async (period: 'today' | 'week' | '3months' | 'older') => {
      if (dashboardFilter === period) {
          setDashboardFilter(null); // Toggle off
          return;
      }
      
      setDashboardFilter(period);

      // If user selects 'older', ensure we have ALL data, not just the default 6 months
      if (period === 'older') {
          setIsLoading(true);
          setLoadingMessage('Fetching full archive history...');
          try {
              const allDocs = await fetchContracts(undefined, null); // Fetch all time
              setHistoricalStatsData(allDocs || []);
          } catch (e) {
              showNotification('Failed to load archives.', 'error');
          } finally {
              setIsLoading(false);
              setLoadingMessage('');
          }
      }
  };

  const handleCompanyFilterChange = (company: string) => {
      setSelectedCompanyFilter(company);
      if (view === 'database') {
          loadSavedContracts(company, 3);
      }
  };

  const handleImportClick = () => {
    if (currentUser?.role === 'Viewer') {
      showNotification('Viewers do not have permission to import documents.', 'error');
      return;
    }
    
    const checks = runPreImportChecks();
    if (!checks.success) {
        showNotification(checks.message!, 'error');
        return;
    }

    setIsImportModalOpen(true);
  };

  const handleStartImport = async (selectedFiles: FileList, companyName: string) => {
    if (!selectedFiles || selectedFiles.length === 0 || !currentUser) return;

    // 1. Unzip & Prepare File Objects (Fast)
    setLoadingMessage('Preparing files...');
    setIsLoading(true);
    setImportResults([]); // Clear previous results
    
    const filesToProcess: File[] = [];

    const processZipEntry = async (zip: any, filename: string): Promise<File | null> => {
        const zipEntry = zip.files[filename];
        if (zipEntry.dir) return null;
        const fileExtension = filename.split('.').pop()?.toLowerCase();
        let mimeType = '';
        if (fileExtension === 'pdf') mimeType = 'application/pdf';
        else if (fileExtension === 'txt') mimeType = 'text/plain';
        else if (fileExtension === 'xml') mimeType = 'text/xml';
        else if (fileExtension === 'docx') mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        else if (fileExtension === 'png') mimeType = 'image/png';
        else if (fileExtension === 'jpg' || fileExtension === 'jpeg') mimeType = 'image/jpeg';
        else return null;

        try {
            const blob = await zipEntry.async('blob');
            const cleanName = filename.split('/').pop() || filename; 
            return new File([blob], cleanName, { type: mimeType });
        } catch (err) {
            console.error(`Error processing zip entry ${filename}`, err);
            return null;
        }
    };

    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles.item(i);
      if (!file) continue;

      if (file.name.toLowerCase().endsWith('.zip') || file.type === 'application/zip') {
        try {
          const zip = await JSZip.loadAsync(file);
          const entries = Object.keys(zip.files);
          const extractedFiles = await Promise.all(entries.map(name => processZipEntry(zip, name)));
          filesToProcess.push(...extractedFiles.filter((f): f is File => f !== null));
        } catch (err) {
            console.error('Error unzipping file:', err);
        }
      } else {
        filesToProcess.push(file);
      }
    }

    const finalFiles = filesToProcess;
    
    // 2. Create Placeholder Documents IMMEDIATELY (Async UI)
    const newPlaceholders: Document[] = finalFiles.map(file => ({
        id: `doc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: file.name,
        language: 'Detecting...',
        contractNo: 'Processing...',
        processedBy: currentUser.name,
        processedDate: new Date().toISOString().split('T')[0],
        status: 'processing' as const, 
        errorMessage: undefined,
        data: {} as any,
        fileUrl: URL.createObjectURL(file) // Create object URL for viewing
    }));

    // Update UI immediately
    setDocuments(prev => {
        // Sort processing files at top
        const updated = [...newPlaceholders, ...prev];
        return updated;
    });

    setIsLoading(false);
    setLoadingMessage('');
    setIsImportModalOpen(false); 
    // showNotification(`Imported ${finalFiles.length} files. Processing started...`, 'success');

    // 3. Process in Background
    processDocumentsInBackground(finalFiles, newPlaceholders, companyName);
  };

  const processDocumentsInBackground = async (files: File[], placeholders: Document[], companyName: string) => {
    // Initialize Batch Progress State
    setIsBatchProcessing(true);
    setProcessedCount(0);
    setTotalBatchCount(files.length);
    
    // OPTIMIZATION: Concurrency limit.
    const CONCURRENCY_LIMIT = 6; 
    
    const queue = files.map((file, i) => ({ file, placeholder: placeholders[i] }));
    
    const worker = async () => {
        while (queue.length > 0) {
            const item = queue.shift();
            if (!item) break;
            const { file, placeholder } = item;
            
            const startTime = Date.now();

            try {
                const extractedData = await extractContractData(file, (msg) => {
                    // Optional: Update granular progress if we had a progress UI per card
                }, companyName);

                const endTime = Date.now();
                const duration = endTime - startTime;

                setDocuments(prev => prev.map(doc => {
                    if (doc.id === placeholder.id) {
                        return {
                            ...doc,
                            language: extractedData.language || 'English',
                            contractNo: extractedData.contractNumber,
                            data: extractedData,
                            status: 'completed'
                        };
                    }
                    return doc;
                }));

                // Record Success
                setImportResults(prev => [...prev, { fileName: file.name, status: 'success', duration }]);

            } catch (error) {
                const endTime = Date.now();
                const duration = endTime - startTime;
                console.error(`Error processing ${file.name}:`, error);
                
                setDocuments(prev => prev.map(doc => {
                    if (doc.id === placeholder.id) {
                        return {
                            ...doc,
                            status: 'error',
                            errorMessage: error instanceof Error ? error.message : 'Extraction failed'
                        };
                    }
                    return doc;
                }));

                // Record Error
                setImportResults(prev => [...prev, { fileName: file.name, status: 'error', duration, message: error instanceof Error ? error.message : 'Unknown error' }]);
            } finally {
                setProcessedCount(prev => prev + 1);
            }
        }
    };

    // Start workers
    const activeWorkers = Array(Math.min(files.length, CONCURRENCY_LIMIT)).fill(null).map(() => worker());
    await Promise.all(activeWorkers);
    
    // Processing Finished
    setIsBatchProcessing(false);
    
    // Once all are done, open summary
    setIsSummaryModalOpen(true);
  };

  const handleAddUser = (name: string, email: string, role: UserRole) => {
    const newUser: User = {
      id: `user-${Date.now()}`,
      name,
      email,
      role,
      permissions: role === 'Admin' ? 'All Access' : role === 'Editor' ? '3 contracts' : '1 contract',
    };
    setUsers(prev => [...prev, newUser]);
    showNotification(`User ${name} added successfully.`, 'success');
  };

  const handleUpdateUser = (id: string, updates: Partial<User>) => {
      setUsers(prev => prev.map(u => {
          if (u.id === id) {
              const updatedUser = { ...u, ...updates };
              if (updates.role) {
                  updatedUser.permissions = updates.role === 'Admin' ? 'All Access' : updates.role === 'Editor' ? '3 contracts' : '1 contract';
              }
              return updatedUser;
          }
          return u;
      }));
      showNotification('User updated successfully.', 'success');
  };

  const handleDeleteUser = (id: string) => {
      if (window.confirm('Are you sure you want to delete this user?')) {
          setUsers(prev => prev.filter(u => u.id !== id));
          showNotification('User deleted successfully.', 'success');
      }
  };
  
  const handleDeleteDocument = async (id: string) => {
    if (currentUser?.role !== 'Admin') {
      showNotification('Only Admins can delete documents.', 'error');
      return;
    }

    if (view === 'database' || view === 'grouped') {
        if (window.confirm(`Are you sure you want to PERMANENTLY delete this document from the database?`)) {
            try {
                await deleteContract(id);
                setSavedDocuments(prev => prev.filter(doc => doc.id !== id));
                setHistoricalStatsData(prev => prev.filter(doc => doc.id !== id));
                setSelectedDocs(prev => prev.filter(docId => docId !== id));
                showNotification('Document deleted from database.', 'success');
            } catch (e) {
                showNotification('Failed to delete document from database.', 'error');
            }
        }
    } else {
        if (window.confirm(`Are you sure you want to delete this document? This will only remove it from the current session.`)) {
            // Clean up Blob URL if exists
            const doc = documents.find(d => d.id === id);
            if (doc?.fileUrl) URL.revokeObjectURL(doc.fileUrl);

            setDocuments(prev => prev.filter(doc => doc.id !== id));
            setSelectedDocs(prev => prev.filter(docId => docId !== id));
            showNotification('Document removed from session.', 'success');
        }
    }
  };

  // Mass Delete Handler
  const handleDeleteBulk = async (docsToDelete: Document[]) => {
      if (currentUser.role !== 'Admin') {
          showNotification('Only Admins can delete documents.', 'error');
          return;
      }
      if (docsToDelete.length === 0) {
          showNotification('No documents to delete.', 'error');
          return;
      }
      
      const confirmMessage = view === 'database' || view === 'grouped'
          ? `WARNING: You are about to PERMANENTLY delete ${docsToDelete.length} documents from the database. This cannot be undone. Proceed?`
          : `Clear ${docsToDelete.length} documents from current view?`;

      if (!window.confirm(confirmMessage)) return;

      setIsLoading(true);
      setLoadingMessage('Deleting documents...');

      try {
          const idsToDelete = docsToDelete.map(d => d.id);
          
          // 1. Identify which docs are persisted in DB (not just local session)
          const dbDocsToDelete = savedDocuments.filter(d => idsToDelete.includes(d.id));
          
          if (dbDocsToDelete.length > 0) {
              await Promise.all(dbDocsToDelete.map(d => deleteContract(d.id)));
          }

          // 2. Update all local states
          setDocuments(prev => prev.filter(d => !idsToDelete.includes(d.id)));
          setSavedDocuments(prev => prev.filter(d => !idsToDelete.includes(d.id)));
          setHistoricalStatsData(prev => prev.filter(d => !idsToDelete.includes(d.id)));
          setSelectedDocs(prev => prev.filter(id => !idsToDelete.includes(id)));

          showNotification(`Successfully deleted ${docsToDelete.length} documents.`, 'success');

      } catch (e) {
          console.error(e);
          showNotification('Error occured while deleting documents.', 'error');
      } finally {
          setIsLoading(false);
          setLoadingMessage('');
      }
  };

  const handleSelectionChange = (docId: string, isSelected: boolean) => {
    setSelectedDocs(prev => {
      if (isSelected) {
        return [...prev, docId];
      } else {
        return prev.filter(id => id !== docId);
      }
    });
  };

  const handleSelectAll = (isChecked: boolean) => {
    let currentDocs: Document[] = [];
    if (view === 'database' || view === 'grouped') {
        currentDocs = savedDocuments;
    } else {
        currentDocs = (documents.length > 0) ? documents : historicalStatsData;
    }

    if (isChecked) {
      setSelectedDocs(currentDocs.map(d => d.id));
    } else {
      setSelectedDocs([]);
    }
  };

  const getSelectedDocumentsObjects = (): Document[] => {
    const allDocs = [...documents, ...savedDocuments, ...historicalStatsData];
    const uniqueDocs = Array.from(new Map(allDocs.map(item => [item.id, item])).values());
    return uniqueDocs.filter(doc => selectedDocs.includes(doc.id));
  };

  const handleExport = async (type: 'csv' | 'sql') => {
     if (currentUser?.role === 'Viewer') {
      showNotification('Viewers do not have permission to export.', 'error');
      return;
    }
    const docsToExport = getSelectedDocumentsObjects();
    if (docsToExport.length === 0) {
      showNotification('Please select documents to action.', 'error');
      return;
    }
    
    if (docsToExport.some(d => d.status === 'processing')) {
        showNotification('Please wait for all selected documents to finish processing.', 'error');
        return;
    }

    try {
      if (type === 'csv') {
        exportToCsv(docsToExport);
        showNotification('Successfully exported to CSV.', 'success');
      } else {
        setIsLoading(true);
        setLoadingMessage(`Saving ${docsToExport.length} document(s) to the database...`);
        const message = await exportToSql(docsToExport);
        showNotification(message, 'success');
        const stats = await fetchContracts(undefined, 6);
        setHistoricalStatsData(stats || []);
        loadCompanies();
      }
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred.';
      showNotification(`Error: ${errorMessage}`, 'error');
    } finally {
        setIsLoading(false);
        setLoadingMessage('');
    }
  };

  const handleCompare = () => {
     if (currentUser?.role === 'Viewer') {
      showNotification('Viewers do not have permission to compare.', 'error');
      return;
    }
    if (selectedDocs.length < 2) {
      showNotification('Please select at least two documents to compare.', 'error');
      return;
    }
    const docsToCompare = getSelectedDocumentsObjects();
    if (docsToCompare.some(d => d.status === 'processing')) {
        showNotification('Please wait for selected documents to finish processing.', 'error');
        return;
    }

    handleNavigate('comparison');
  };
  
  const handleSaveComparison = async (docs: Document[], diffs: { key: keyof ExtractedData; label: string }[]) => {
    try {
      const message = await saveComparisonToDb(docs, diffs);
      showNotification(message, 'success');
    } catch (error) {
      let errorMessage = 'An unknown error occurred.';
      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        errorMessage = 'Could not connect to the server to save comparison.';
      } else if (error instanceof Error) {
          errorMessage = error.message;
      }
      showNotification(`Error saving comparison: ${errorMessage}`, 'error');
    }
  };

  const handleExportComparison = async (
      docs: Document[], 
      diffs: { key: keyof ExtractedData; label: string }[],
      sims: { key: keyof ExtractedData; label: string }[]
  ) => {
     try {
      await exportComparisonToExcel(docs, diffs, sims);
      showNotification('Comparison exported to Excel successfully.', 'success');
    } catch (error) {
      console.error(error);
      showNotification('Error exporting comparison.', 'error');
    }
  };

  const handleSetCurrentUser = (user: User) => {
    setCurrentUser(user);
    setSelectedDocs([]);
    setView('dashboard');
    showNotification(`Switched to ${user.name} (${user.role}) view.`, 'success');
  };

  const handleViewDetails = (docId: string) => {
    const allDocs = [...documents, ...savedDocuments, ...historicalStatsData];
    const doc = allDocs.find(d => d.id === docId);
    if (doc) {
        if (doc.status === 'processing') return; 
        setDetailModalDoc(doc);
    }
  };

  const handleViewOriginal = (doc: Document) => {
    if (doc.fileUrl) {
      window.open(doc.fileUrl, '_blank');
    } else {
      showNotification('Original file is not available for this document (Database Archive).', 'error');
    }
  };

  const mergeDocs = (sessionDocs: Document[], dbDocs: Document[]) => {
      const sessionIds = new Set(sessionDocs.map(d => d.id));
      const dbUnique = dbDocs.filter(d => !sessionIds.has(d.id));
      return [...sessionDocs, ...dbUnique];
  };

  const filterDocuments = (docs: Document[]) => {
      if (!searchTerm && !selectedCompanyFilter) return docs;
      
      const terms = searchTerm.toLowerCase().split(/\s+/).filter(t => t.length > 0);
      
      return docs.filter(doc => {
          const clientName = doc.data?.clientName || '';
          
          if (selectedCompanyFilter && clientName !== selectedCompanyFilter) {
              return false;
          }

          if (terms.length > 0) {
              const name = String(doc.name ?? '').toLowerCase();
              const contractNo = String(doc.data?.contractNumber ?? '').toLowerCase();
              const partNo = String(doc.data?.partNumber ?? '').toLowerCase();
              const client = String(clientName).toLowerCase();
              const buyer = String(doc.data?.buyerNameAndAddress ?? '').toLowerCase(); 
              const docString = `${name} ${contractNo} ${partNo} ${client} ${buyer}`;
              return terms.every(term => docString.includes(term));
          }
          
          return true;
      });
  };

  const handleLogout = () => {
      setCurrentUser(initialUsers[0]); 
      setDocuments([]); 
      setSelectedDocs([]);
      setView('dashboard');
      showNotification('Session reset. Workspace cleared.', 'success');
  };

  const renderView = () => {
    if (!currentUser) return null;

    const commonProps = {
      selectedDocs,
      currentUser,
      onSelectionChange: handleSelectionChange,
      onSelectAll: handleSelectAll,
      onDeleteDocument: handleDeleteDocument,
      onViewDetails: handleViewDetails,
      onViewOriginal: handleViewOriginal, // Pass the handler
    };
    
    let docsToDisplay: Document[] = [];
    let dashboardTitle = 'Dashboard (Recent Activity)';
    
    if (view === 'dashboard') {
        let baseDocs: Document[] = [];
        
        if (dashboardFilter) {
             baseDocs = mergeDocs(documents, historicalStatsData);
        } else {
             if (documents.length > 0) {
                baseDocs = documents;
                dashboardTitle = 'Dashboard (Current Session Files)';
             } else {
                baseDocs = historicalStatsData;
                dashboardTitle = 'Dashboard (Recent Activity)';
             }
        }
        
        docsToDisplay = baseDocs;

        if (dashboardFilter) {
             const now = new Date();
             const todayStr = now.toISOString().split('T')[0];
             const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
             const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());

             docsToDisplay = docsToDisplay.filter(doc => {
                 const d = new Date(doc.processedDate);
                 const dStr = doc.processedDate.split('T')[0];

                 if (dashboardFilter === 'today') return dStr === todayStr;
                 if (dashboardFilter === 'week') return d >= oneWeekAgo;
                 if (dashboardFilter === '3months') return d >= threeMonthsAgo;
                 if (dashboardFilter === 'older') return d < threeMonthsAgo;
                 return true;
             });
             dashboardTitle = `Dashboard (${dashboardFilter === 'today' ? 'Today' : dashboardFilter === 'week' ? 'Past 7 Days' : dashboardFilter === '3months' ? 'Last 3 Months' : 'Older Archives'})`;
        }
    } else if (view === 'today') {
        const today = new Date().toISOString().split('T')[0];
        const dbToday = historicalStatsData.filter(doc => doc.processedDate.split('T')[0] === today);
        docsToDisplay = mergeDocs(documents, dbToday);
    } else if (view === 'month') {
        const today = new Date();
        const year = today.getFullYear();
        const month = today.getMonth();
        const monthDocs = historicalStatsData.filter(doc => {
            const docDate = new Date(doc.processedDate);
            return docDate.getFullYear() === year && docDate.getMonth() === month;
        });
        docsToDisplay = mergeDocs(documents, monthDocs);
    } else if (view === 'grouped') {
        docsToDisplay = mergeDocs(documents, savedDocuments);
    } else if (view === 'database') {
        docsToDisplay = savedDocuments;
    }
    
    const filteredDocs = filterDocuments(docsToDisplay);

    switch(view) {
      case 'dashboard':
        return <Dashboard 
                  {...commonProps} 
                  documents={filteredDocs} 
                  historicalDocuments={historicalStatsData} 
                  title={dashboardTitle}
                  companies={availableCompanies}
                  selectedCompany={selectedCompanyFilter}
                  onCompanyChange={setSelectedCompanyFilter}
                  onFilterClick={handleDashboardFilterClick} 
                  activeFilter={dashboardFilter}
                  onDeleteBulk={handleDeleteBulk}
               />;
      case 'database':
        return (
            <GroupedView 
                {...commonProps} 
                documents={filteredDocs} 
                title={databaseViewTitle}
                companies={availableCompanies}
                selectedCompany={selectedCompanyFilter}
                onCompanyChange={handleCompanyFilterChange}
                defaultGroupBy={selectedCompanyFilter ? 'partNumber' : 'company'}
                onDeleteBulk={handleDeleteBulk}
            />
        );
      case 'today': {
        return <GroupedView 
                  {...commonProps} 
                  documents={filteredDocs} 
                  title="Today's Files (Grouped by Company)"
                  defaultGroupBy="company"
                  companies={availableCompanies}
                  selectedCompany={selectedCompanyFilter}
                  onCompanyChange={setSelectedCompanyFilter}
                  onDeleteBulk={handleDeleteBulk}
               />;
      }
      case 'month': {
        return <Dashboard 
                  {...commonProps} 
                  documents={filteredDocs} 
                  title="This Month's Processed Documents"
                  companies={availableCompanies}
                  selectedCompany={selectedCompanyFilter}
                  onCompanyChange={setSelectedCompanyFilter}
                  onDeleteBulk={handleDeleteBulk}
               />;
      }
      case 'admin':
        return <UserManagement 
                users={users} 
                onAddUser={handleAddUser}
                onUpdateUser={handleUpdateUser}
                onDeleteUser={handleDeleteUser}
               />;
      case 'grouped': {
         return <GroupedView 
            {...commonProps} 
            documents={filteredDocs} 
            title="Recent Contracts (Session + Last 7 Days)"
            defaultGroupBy="company"
            companies={availableCompanies}
            selectedCompany={selectedCompanyFilter}
            onCompanyChange={setSelectedCompanyFilter}
            onDeleteBulk={handleDeleteBulk}
        />;
      }
      case 'comparison':
        const docsToCompare = getSelectedDocumentsObjects();
        return <ComparisonView 
                  documents={docsToCompare} 
                  onBack={() => setView(previousView)}
                  onSaveComparison={handleSaveComparison}
                  onExportComparison={handleExportComparison}
                />;
      default:
        return <Dashboard {...commonProps} documents={filteredDocs} onDeleteBulk={handleDeleteBulk} />;
    }
  };

  return (
    <>
      <Layout 
        view={view} 
        onNavigate={handleNavigate}
        onImportClick={handleImportClick}
        currentUser={currentUser}
        users={users}
        onSetCurrentUser={handleSetCurrentUser}
        selectedCount={selectedDocs.length}
        onExport={handleExport}
        onCompare={handleCompare}
        onSearch={setSearchTerm}
        searchTerm={searchTerm}
        onLogout={handleLogout}
      >
        {renderView()}
      </Layout>
      <ImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImport={(files, companyName) => {
          handleStartImport(files, companyName);
        }}
      />
      <ImportSummaryModal
        isOpen={isSummaryModalOpen}
        onClose={() => setIsSummaryModalOpen(false)}
        results={importResults}
      />
      <DocumentDetailModal
        isOpen={!!detailModalDoc}
        onClose={() => setDetailModalDoc(null)}
        document={detailModalDoc}
        onSave={async (doc) => {
            setIsLoading(true);
            setLoadingMessage('Saving document to database...');
            try {
                await exportToSql([doc]);
                showNotification('Document saved successfully.', 'success');
                // Refresh data if in database view
                if (view === 'database') {
                    loadSavedContracts(selectedCompanyFilter);
                }
                loadCompanies();
            } catch (e) {
                showNotification('Failed to save document.', 'error');
            } finally {
                setIsLoading(false);
                setLoadingMessage('');
            }
        }}
      />
      
      {/* Processing Popup (Persistent while processing) */}
      {isBatchProcessing && (
        <div className="fixed bottom-5 right-5 bg-white border border-indigo-100 p-4 rounded-lg shadow-xl z-50 flex items-center space-x-4 animate-in slide-in-from-bottom-5">
           <div className="relative">
             <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
           </div>
           <div>
             <h4 className="font-semibold text-gray-800">Processing Documents...</h4>
             <p className="text-xs text-gray-500">{processedCount} of {totalBatchCount} completed</p>
           </div>
        </div>
      )}

      {isLoading && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl flex items-center space-x-4 max-w-sm">
            <Loader2 className="animate-spin text-indigo-500 h-8 w-8" />
            <span className="text-gray-700">{loadingMessage}</span>
          </div>
        </div>
      )}
      {notification && (
        <div className={`fixed bottom-5 right-5 text-white py-2 px-4 rounded-lg shadow-lg z-50 transition-opacity duration-300 ${notification.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
          <p className="max-w-md">{notification.message}</p>
          <button onClick={() => setNotification(null)} className="absolute -top-1 -right-1 text-lg font-bold p-1">&times;</button>
        </div>
      )}
    </>
  );
};

export default App;
