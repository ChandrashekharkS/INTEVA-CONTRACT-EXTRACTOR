
import React, { useState, useRef, useEffect } from 'react';
import type { View, User } from '../types';
import { LayoutDashboard, Users, Group, Search, Bell, ChevronDown, Plus, Upload, ChevronsRightLeft, FileDown, Calendar, CalendarDays, Database } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  view: View;
  onNavigate: (view: View) => void;
  onImportClick: () => void;
  currentUser: User;
  users: User[];
  onSetCurrentUser: (user: User) => void;
  selectedCount: number;
  onExport: (type: 'csv' | 'sql') => void;
  onCompare: () => void;
  onSearch: (term: string) => void;
  searchTerm: string;
}

const Sidebar: React.FC<{ view: View; onNavigate: (view: View) => void; onImportClick: () => void; currentUser: User }> = ({ view, onNavigate, onImportClick, currentUser }) => {
  const navItemClasses = (currentView: View) => 
    `flex items-center px-4 py-2.5 text-sm font-medium rounded-md cursor-pointer transition-colors w-full text-left ${
      view === currentView 
        ? 'bg-indigo-100 text-indigo-700' 
        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
    }`;

  return (
    <aside className="w-64 bg-white border-r border-gray-200 flex flex-col fixed h-full">
      <div className="flex items-center h-16 px-6 border-b border-gray-200">
        <h1 className="text-xl font-bold text-gray-800">
          Inteva <span className="text-indigo-600">Extractor</span>
        </h1>
      </div>
      <nav className="flex-1 p-4 space-y-4">
        <div>
          <h3 className="px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Contract Data</h3>
          <div className="mt-2 space-y-1">
            <button type="button" onClick={() => onNavigate('dashboard')} className={navItemClasses('dashboard')}>
              <LayoutDashboard className="w-5 h-5 mr-3" />
              Dashboard
            </button>
            <button type="button" onClick={() => onNavigate('database')} className={navItemClasses('database')}>
              <Database className="w-5 h-5 mr-3" />
              Saved Contracts
            </button>
            <button type="button" onClick={() => onNavigate('grouped')} className={navItemClasses('grouped')}>
              <Group className="w-5 h-5 mr-3" />
              Grouped View
            </button>
            <button type="button" onClick={() => onNavigate('today')} className={navItemClasses('today')}>
              <Calendar className="w-5 h-5 mr-3" />
              Today's Files
            </button>
            <button type="button" onClick={() => onNavigate('month')} className={navItemClasses('month')}>
              <CalendarDays className="w-5 h-5 mr-3" />
              This Month's Files
            </button>
          </div>
        </div>
        
        {currentUser.role !== 'Viewer' && (
          <div>
            <h3 className="px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Actions</h3>
            <div className="mt-2 space-y-1">
              <button type="button" onClick={onImportClick} className="w-full text-left flex items-center px-4 py-2.5 text-sm font-medium rounded-md cursor-pointer transition-colors text-gray-600 hover:bg-gray-100 hover:text-gray-900">
                <Upload className="w-5 h-5 mr-3" />
                Import / Unzip Files
              </button>
            </div>
          </div>
        )}

        {currentUser.role === 'Admin' && (
          <div>
            <h3 className="px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Administration</h3>
            <div className="mt-2 space-y-1">
              <button type="button" onClick={() => onNavigate('admin')} className={navItemClasses('admin')}>
                <Users className="w-5 h-5 mr-3" />
                Admin
              </button>
            </div>
          </div>
        )}
      </nav>
    </aside>
  );
};

const Header: React.FC<Omit<LayoutProps, 'children' | 'view' | 'onNavigate'>> = (props) => {
  const { onImportClick, currentUser, users, onSetCurrentUser, selectedCount, onExport, onCompare, onSearch, searchTerm } = props;
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);

  const profileRef = useRef<HTMLDivElement>(null);
  const exportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
      if (exportRef.current && !exportRef.current.contains(event.target as Node)) {
        setIsExportOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const canPerformActions = currentUser.role !== 'Viewer';

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-8">
       <div className="flex items-center">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input 
            type="text" 
            placeholder="Search Part # or Company..."
            value={searchTerm}
            onChange={(e) => onSearch(e.target.value)}
            className="w-72 pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-2">
            <button onClick={onImportClick} disabled={!canPerformActions} className="flex items-center bg-indigo-600 text-white px-4 py-2 rounded-md font-semibold hover:bg-indigo-700 transition-colors disabled:bg-indigo-300 disabled:cursor-not-allowed">
                <Plus className="w-5 h-5 mr-2" />
                Import
            </button>
            <div className="relative" ref={exportRef}>
                <button 
                  onClick={() => setIsExportOpen(prev => !prev)} 
                  disabled={!canPerformActions || selectedCount === 0}
                  className="flex items-center bg-white text-gray-700 px-4 py-2 rounded-md font-semibold border border-gray-300 hover:bg-gray-50 transition-colors disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
                >
                    <FileDown className="w-5 h-5 mr-2" />
                    Actions
                    <ChevronDown className={`w-4 h-4 ml-2 transition-transform ${isExportOpen ? 'rotate-180' : ''}`} />
                </button>
                {isExportOpen && (
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-md shadow-lg py-1 z-20 border border-gray-200">
                    <button type="button" onClick={() => { onExport('csv'); setIsExportOpen(false); }} className="w-full text-left block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 cursor-pointer">Export Selected to Excel (.csv)</button>
                    <button type="button" onClick={() => { onExport('sql'); setIsExportOpen(false); }} className="w-full text-left block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 cursor-pointer">Save Selected to Database</button>
                  </div>
                )}
            </div>
            <button 
              onClick={onCompare}
              disabled={!canPerformActions || selectedCount < 2}
              className="flex items-center bg-white text-gray-700 px-4 py-2 rounded-md font-semibold border border-gray-300 hover:bg-gray-50 transition-colors disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
            >
                <ChevronsRightLeft className="w-5 h-5 mr-2" />
                Compare ({selectedCount})
            </button>
        </div>
        <div className="flex items-center space-x-4">
          <button className="text-gray-500 hover:text-gray-800">
            <Bell className="w-6 h-6" />
          </button>
          <div className="relative" ref={profileRef}>
            <div onClick={() => setIsProfileOpen(prev => !prev)} className="flex items-center space-x-2 cursor-pointer p-1 rounded-md hover:bg-gray-100">
              <div className="w-10 h-10 bg-amber-400 rounded-full flex items-center justify-center font-bold text-white text-lg">{currentUser.name.charAt(0)}</div>
              <div>
                <p className="font-semibold text-sm text-gray-800">{currentUser.name}</p>
                <p className="text-xs text-gray-500">{currentUser.role}</p>
              </div>
              <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${isProfileOpen ? 'rotate-180' : ''}`} />
            </div>
            {isProfileOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-md shadow-lg py-1 z-20 border border-gray-200">
                <div className="px-4 py-2 border-b">
                    <p className="text-sm font-medium text-gray-900">Signed in as</p>
                    <p className="text-sm text-gray-500 truncate">{currentUser.email}</p>
                </div>
                <div className="py-1">
                    <p className="px-4 pt-2 pb-1 text-xs font-semibold text-gray-400 uppercase">Switch User</p>
                    {users.map(user => (
                        <button type="button" key={user.id} onClick={() => { onSetCurrentUser(user); setIsProfileOpen(false); }} className={`w-full text-left block px-4 py-2 text-sm cursor-pointer ${currentUser.id === user.id ? 'bg-indigo-50 text-indigo-700' : 'text-gray-700 hover:bg-gray-100'}`}>
                            {user.name} ({user.role})
                        </button>
                    ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};


const Layout: React.FC<LayoutProps> = ({ children, ...props }) => {
  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar view={props.view} onNavigate={props.onNavigate} onImportClick={props.onImportClick} currentUser={props.currentUser} />
      <div className="flex-1 flex flex-col ml-64">
        <Header {...props} />
        <main className="flex-1 p-8 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;
