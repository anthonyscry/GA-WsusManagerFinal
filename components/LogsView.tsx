
import React, { useEffect, useState, useRef } from 'react';
import { LogEntry, LogLevel } from '../types';
import { loggingService } from '../services/loggingService';
import { wsusService } from '../services/wsusService';

interface LogsViewProps {
  hideHeader?: boolean;
}

interface SyncStatus {
  status: string;
  lastSyncTime: string;
  lastSyncResult: string;
  nextSyncTime: string;
}

const LogsView: React.FC<LogsViewProps> = ({ hideHeader = false }) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filter, setFilter] = useState<LogLevel | 'ALL'>('ALL');
  const [isSyncing, setIsSyncing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const refreshLogs = () => {
      setLogs(loggingService.getLogs());
    };
    refreshLogs();

    window.addEventListener('wsus_log_added', refreshLogs);
    window.addEventListener('wsus_log_cleared', refreshLogs);
    return () => {
      window.removeEventListener('wsus_log_added', refreshLogs);
      window.removeEventListener('wsus_log_cleared', refreshLogs);
    };
  }, []);

  // Fetch sync status on mount and after sync
  const fetchSyncStatus = async () => {
    try {
      const status = await wsusService.getSyncStatus();
      setSyncStatus(status);
    } catch {
      // Silently fail - WSUS might not be available
    }
  };

  useEffect(() => {
    fetchSyncStatus();
    // Refresh every 30 seconds
    const interval = setInterval(fetchSyncStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const filteredLogs = filter === 'ALL' ? logs : logs.filter(l => l.level === filter);

  const handleSyncNow = async () => {
    setIsSyncing(true);
    loggingService.info('[WSUS] Triggering manual synchronization...');
    try {
      const result = await wsusService.syncNow();
      if (result.success) {
        loggingService.info(`[WSUS] ${result.message}`);
        // Refresh sync status after triggering sync
        setTimeout(fetchSyncStatus, 2000);
      } else {
        loggingService.error(`[WSUS] Sync failed: ${result.message}`);
      }
    } catch (error) {
      loggingService.error(`[WSUS] Sync error: ${error instanceof Error ? error.message : 'Unknown'}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const getSyncStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'running': return 'text-amber-400 bg-amber-500/20';
      case 'notprocessing': return 'text-emerald-400 bg-emerald-500/20';
      case 'succeeded': return 'text-emerald-400 bg-emerald-500/20';
      case 'failed': return 'text-rose-400 bg-rose-500/20';
      default: return 'text-slate-300 bg-slate-600/30';
    }
  };

  const handleExportLogs = async (format: 'txt' | 'json' | 'csv') => {
    setIsExporting(true);
    try {
      await loggingService.exportLogs(format);
    } finally {
      setIsExporting(false);
    }
  };

  const getLevelColor = (level: LogLevel) => {
    switch (level) {
      case LogLevel.ERROR: return "text-rose-500";
      case LogLevel.WARNING: return "text-amber-500";
      default: return "text-blue-400";
    }
  };

  return (
    <div className={`animate-fadeIn h-full flex flex-col overflow-hidden`}>
      {!hideHeader && (
        <div className="flex items-center justify-between p-3 bg-theme-card border border-theme-secondary rounded-lg mb-2 shrink-0">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-black text-white uppercase tracking-wide">System Console</h2>
            
            {/* Sync Status Indicator */}
            {syncStatus && (
              <div className="flex items-center gap-2 ml-1 pl-2 border-l border-theme-secondary">
                <div className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${getSyncStatusColor(syncStatus.status)}`}>
                  {syncStatus.status === 'Running' && (
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse mr-1"></span>
                  )}
                  {syncStatus.status}
                </div>
                <div className="text-xs text-slate-400">
                  Last: <span className="text-slate-300">{syncStatus.lastSyncTime}</span>
                </div>
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            {/* Sync Now Button */}
            <button
              onClick={handleSyncNow}
              disabled={isSyncing}
              className="px-3 py-1.5 text-xs font-bold uppercase bg-emerald-600 hover:bg-emerald-500 text-white rounded transition-all disabled:opacity-50 flex items-center gap-1.5"
              title="Trigger WSUS synchronization"
            >
              {isSyncing ? (
                <>
                  <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Syncing...
                </>
              ) : (
                <>
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Sync
                </>
              )}
            </button>

            {/* Filter Dropdown */}
            <div className="relative group">
              <button 
                className="px-3 py-1.5 text-xs font-bold uppercase text-blue-400 hover:text-blue-300 border border-theme-secondary hover:border-blue-500/30 rounded transition-all flex items-center gap-1"
              >
                {filter === 'ALL' ? 'All Logs' : filter}
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              <div className="absolute right-0 top-full mt-1 bg-theme-card border border-theme-secondary rounded shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 min-w-[100px]">
                <button onClick={() => setFilter('ALL')} className={`block w-full px-3 py-2 text-xs font-bold uppercase text-left ${filter === 'ALL' ? 'text-blue-400 bg-blue-600/20' : 'text-slate-400 hover:text-white hover:bg-blue-600/20'}`}>All Logs</button>
                <button onClick={() => setFilter(LogLevel.INFO)} className={`block w-full px-3 py-2 text-xs font-bold uppercase text-left ${filter === LogLevel.INFO ? 'text-blue-400 bg-blue-600/20' : 'text-slate-400 hover:text-white hover:bg-blue-600/20'}`}>Info</button>
                <button onClick={() => setFilter(LogLevel.WARNING)} className={`block w-full px-3 py-2 text-xs font-bold uppercase text-left ${filter === LogLevel.WARNING ? 'text-amber-400 bg-amber-600/20' : 'text-slate-400 hover:text-white hover:bg-blue-600/20'}`}>Warning</button>
                <button onClick={() => setFilter(LogLevel.ERROR)} className={`block w-full px-3 py-2 text-xs font-bold uppercase text-left ${filter === LogLevel.ERROR ? 'text-rose-400 bg-rose-600/20' : 'text-slate-400 hover:text-white hover:bg-blue-600/20'}`}>Error</button>
              </div>
            </div>

            {/* Export Dropdown */}
            <div className="relative group">
              <button 
                disabled={isExporting}
                className="px-3 py-1.5 text-xs font-bold uppercase text-blue-400 hover:text-blue-300 border border-theme-secondary hover:border-blue-500/30 rounded transition-all flex items-center gap-1 disabled:opacity-50"
              >
                {isExporting ? 'Exporting...' : 'Export'}
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              <div className="absolute right-0 top-full mt-1 bg-theme-card border border-theme-secondary rounded shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 min-w-[100px]">
                <button onClick={() => handleExportLogs('txt')} className="block w-full px-3 py-2 text-xs font-bold uppercase text-left text-slate-400 hover:text-white hover:bg-blue-600/20">Text (.txt)</button>
                <button onClick={() => handleExportLogs('json')} className="block w-full px-3 py-2 text-xs font-bold uppercase text-left text-slate-400 hover:text-white hover:bg-blue-600/20">JSON (.json)</button>
                <button onClick={() => handleExportLogs('csv')} className="block w-full px-3 py-2 text-xs font-bold uppercase text-left text-slate-400 hover:text-white hover:bg-blue-600/20">CSV (.csv)</button>
              </div>
            </div>

            <button 
              onClick={() => loggingService.clearLogs()} 
              className="px-3 py-1.5 text-xs font-bold uppercase text-rose-400 hover:text-rose-300 border border-theme-secondary hover:border-rose-500/30 rounded transition-all"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      <div className={`flex-1 min-h-0 overflow-hidden flex flex-col bg-theme-card rounded-lg border border-theme-secondary`}>
        <div ref={scrollRef} className="flex-1 p-4 font-mono text-[11px] overflow-y-auto space-y-1">
          {filteredLogs.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <p className="text-theme-muted font-bold uppercase tracking-widest text-[10px]">Buffer empty</p>
            </div>
          ) : (
            filteredLogs.map((log) => (
              <div key={log.id} className="flex gap-3 hover:bg-theme-secondary/20 py-0.5 px-2 rounded -mx-2 transition-colors">
                <span className="text-theme-muted whitespace-nowrap hidden md:block">[{log.timestamp.split('T')[1].split('.')[0]}]</span>
                <span className={`font-black uppercase w-10 shrink-0 ${getLevelColor(log.level)}`}>{log.level}</span>
                <span className="text-blue-500/50 font-bold shrink-0">C:\&gt;</span>
                <span className="text-theme-primary font-medium leading-relaxed">{log.message}</span>
              </div>
            ))
          )}
        </div>
        
        <div className="h-8 bg-theme-input border-t border-theme-secondary px-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse"></div>
            <span className="text-[10px] font-bold text-emerald-500/70 uppercase">Listening</span>
          </div>
          <span className="text-[10px] font-bold text-theme-muted uppercase">Entries: {filteredLogs.length}</span>
        </div>
      </div>
    </div>
  );
};

export default React.memo(LogsView);
