import React, { useState, useEffect, useCallback } from 'react';
import { wsusService } from '../services/wsusService';
import { loggingService } from '../services/loggingService';

interface PendingUpdate {
  id: string;
  title: string;
  classification: string;
  severity: string;
  releaseDate: string;
}

interface ComputerGroup {
  id: string;
  name: string;
  computerCount: number;
}

const UpdatesView: React.FC = () => {
  const [updates, setUpdates] = useState<PendingUpdate[]>([]);
  const [groups, setGroups] = useState<ComputerGroup[]>([]);
  const [selectedUpdates, setSelectedUpdates] = useState<Set<string>>(new Set());
  const [selectedGroup, setSelectedGroup] = useState<string>('All Computers');
  const [isLoading, setIsLoading] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isDeclining, setIsDeclining] = useState(false);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    loggingService.info('[UPDATES] Loading pending updates and groups...');
    
    try {
      const [updatesData, groupsData] = await Promise.all([
        wsusService.getPendingUpdates(),
        wsusService.getComputerGroups()
      ]);
      
      setUpdates(updatesData);
      setGroups(groupsData);
      loggingService.info(`[UPDATES] Loaded ${updatesData.length} pending updates, ${groupsData.length} groups`);
    } catch (error) {
      loggingService.error(`[UPDATES] Failed to load: ${error instanceof Error ? error.message : 'Unknown'}`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const toggleUpdate = (id: string) => {
    setSelectedUpdates(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAll = () => {
    if (selectedUpdates.size === updates.length) {
      setSelectedUpdates(new Set());
    } else {
      setSelectedUpdates(new Set(updates.map(u => u.id)));
    }
  };

  const handleApprove = async () => {
    if (selectedUpdates.size === 0) return;
    
    setIsApproving(true);
    loggingService.info(`[UPDATES] Approving ${selectedUpdates.size} updates for ${selectedGroup}...`);
    
    try {
      const result = await wsusService.approveUpdates(Array.from(selectedUpdates), selectedGroup);
      loggingService.info(`[UPDATES] Approved ${result.approved}, failed ${result.failed}`);
      
      // Refresh list
      setSelectedUpdates(new Set());
      await loadData();
    } catch (error) {
      loggingService.error(`[UPDATES] Approval failed: ${error instanceof Error ? error.message : 'Unknown'}`);
    } finally {
      setIsApproving(false);
    }
  };

  const handleDecline = async () => {
    if (selectedUpdates.size === 0) return;
    
    if (!confirm(`Decline ${selectedUpdates.size} update(s)? This action cannot be undone.`)) {
      return;
    }
    
    setIsDeclining(true);
    loggingService.info(`[UPDATES] Declining ${selectedUpdates.size} updates...`);
    
    try {
      const result = await wsusService.declineUpdates(Array.from(selectedUpdates));
      loggingService.info(`[UPDATES] Declined ${result.declined}, failed ${result.failed}`);
      
      // Refresh list
      setSelectedUpdates(new Set());
      await loadData();
    } catch (error) {
      loggingService.error(`[UPDATES] Decline failed: ${error instanceof Error ? error.message : 'Unknown'}`);
    } finally {
      setIsDeclining(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity?.toLowerCase()) {
      case 'critical': return 'bg-rose-500/10 text-rose-500';
      case 'important': return 'bg-amber-500/10 text-amber-500';
      case 'moderate': return 'bg-blue-500/10 text-blue-500';
      default: return 'bg-theme-muted/10 text-theme-secondary';
    }
  };

  return (
    <div className="animate-fadeIn h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-3 bg-theme-card border border-theme-secondary rounded-lg mb-2 shrink-0">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-black text-theme-primary uppercase tracking-wide">Update Approval</h2>
          <span className="px-2 py-1 bg-blue-600/10 text-blue-400 border border-blue-500/30 rounded text-[10px] font-bold uppercase">
            {updates.length} Pending
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            disabled={isLoading}
            className="px-3 py-1.5 bg-theme-secondary hover:bg-theme-secondary/80 text-theme-primary border border-theme-secondary rounded text-[10px] font-black uppercase disabled:opacity-50"
          >
            {isLoading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Controls Bar */}
      <div className="flex items-center justify-between p-2 bg-theme-card border border-theme-secondary rounded-lg mb-2 shrink-0">
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={selectedUpdates.size === updates.length && updates.length > 0}
              onChange={selectAll}
              className="w-4 h-4 rounded border-theme-secondary bg-theme-input text-blue-600"
            />
            <span className="text-xs font-bold text-theme-secondary uppercase">Select All</span>
          </label>
          <span className="text-xs text-theme-muted">|</span>
          <span className="text-xs font-bold text-theme-primary">{selectedUpdates.size} selected</span>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-theme-muted uppercase">Target Group:</label>
          <select
            value={selectedGroup}
            onChange={(e) => setSelectedGroup(e.target.value)}
            className="bg-theme-input border border-theme rounded px-2 py-1 text-xs font-bold text-theme-primary"
          >
            {groups.length === 0 ? (
              <option value="All Computers">All Computers</option>
            ) : (
              groups.map(g => (
                <option key={g.id} value={g.name}>{g.name} ({g.computerCount})</option>
              ))
            )}
          </select>

          <button
            onClick={handleDecline}
            disabled={selectedUpdates.size === 0 || isDeclining || isApproving}
            className="px-4 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded text-[10px] font-black uppercase disabled:opacity-50 flex items-center gap-1.5"
          >
            {isDeclining ? (
              <>
                <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Declining...
              </>
            ) : (
              <>Decline Selected</>
            )}
          </button>

          <button
            onClick={handleApprove}
            disabled={selectedUpdates.size === 0 || isApproving || isDeclining}
            className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[10px] font-black uppercase disabled:opacity-50 flex items-center gap-1.5"
          >
            {isApproving ? (
              <>
                <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Approving...
              </>
            ) : (
              <>Approve Selected</>
            )}
          </button>
        </div>
      </div>

      {/* Updates Table */}
      <div className="flex-1 min-h-0 bg-theme-card rounded-lg border border-theme-secondary overflow-hidden flex flex-col">
        {/* Table Header */}
        <div className="grid grid-cols-[40px_1fr_120px_100px_100px] gap-2 px-3 py-2 bg-theme-tertiary border-b border-theme-secondary shrink-0">
          <span></span>
          <span className="text-xs font-bold text-theme-secondary uppercase">Update</span>
          <span className="text-xs font-bold text-theme-secondary uppercase">Classification</span>
          <span className="text-xs font-bold text-theme-secondary uppercase">Severity</span>
          <span className="text-xs font-bold text-theme-secondary uppercase">Released</span>
        </div>

        {/* Table Body */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <svg className="w-8 h-8 animate-spin mx-auto mb-2 text-blue-500" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <p className="text-sm text-theme-muted">Loading updates...</p>
              </div>
            </div>
          ) : updates.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <p className="text-sm font-bold text-theme-muted mb-1">No pending updates</p>
                <p className="text-xs text-theme-muted">All updates have been approved or declined</p>
              </div>
            </div>
          ) : (
            updates.map((update, idx) => (
              <div
                key={update.id}
                className={`grid grid-cols-[40px_1fr_120px_100px_100px] gap-2 px-3 py-2 items-center border-b border-theme-secondary hover:bg-blue-600/5 cursor-pointer transition-colors ${idx % 2 === 1 ? 'bg-theme-secondary/10' : ''} ${selectedUpdates.has(update.id) ? 'bg-blue-600/10' : ''}`}
                onClick={() => toggleUpdate(update.id)}
              >
                <div className="flex items-center justify-center">
                  <input
                    type="checkbox"
                    checked={selectedUpdates.has(update.id)}
                    onChange={() => toggleUpdate(update.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="w-4 h-4 rounded border-theme-secondary bg-theme-input text-blue-600"
                  />
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-theme-primary truncate" title={update.title}>{update.title}</p>
                </div>
                <span className="text-xs text-theme-secondary truncate">{update.classification}</span>
                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded text-center ${getSeverityColor(update.severity)}`}>
                  {update.severity}
                </span>
                <span className="text-xs text-theme-muted">{update.releaseDate}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default React.memo(UpdatesView);
