
import React, { useState, useMemo } from 'react';
import { WsusComputer } from '../types';
import { Icons } from '../constants';
import { loggingService } from '../services/loggingService';
import { useSelection } from '../hooks/useSelection';
import { useSearch } from '../hooks/useSearch';
import { getStatusBadgeColor } from '../utils/statusHelpers';
import { calculateCompliancePercentage } from '../utils/calculations';
import { ConfirmDialog } from './ConfirmDialog';
import { useBulkSync } from '../src/presentation/hooks';

interface ComputersTableProps {
  computers: WsusComputer[];
}

const ComputersTable: React.FC<ComputersTableProps> = ({ computers }) => {
  const [selectedNode, setSelectedNode] = useState<WsusComputer | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{action: 'RESET', nodeId: string} | null>(null);
  const { sync: syncComputers, isSyncing: isProcessing } = useBulkSync();

  const { searchTerm, setSearchTerm, filtered } = useSearch(
    computers,
    (computer) => `${computer.name} ${computer.ipAddress}`
  );

  const filteredIds = useMemo(() => filtered.map(c => c.id), [filtered]);

  const {
    selectedIds,
    isAllSelected,
    isSelected,
    toggleSelect,
    toggleSelectAll: handleToggleSelectAll,
    clearSelection
  } = useSelection(filteredIds);

  const toggleSelectAll = () => {
    handleToggleSelectAll();
  };

  const handleBulkAction = async (action: 'PING' | 'SYNC' | 'RESET') => {
    if (action === 'SYNC') {
      await syncComputers(Array.from(selectedIds));
      clearSelection();
    } else {
      const { stateService } = await import('../services/stateService');
      await stateService.performBulkAction(Array.from(selectedIds), action);
      clearSelection();
    }
  };

  return (
    <div className="h-full flex flex-col animate-fadeIn relative">
      {/* Compact Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h1 className="text-sm font-bold text-theme-primary uppercase tracking-wide">Node Inventory</h1>
          <p className="text-xs text-theme-muted">Compliance telemetry via WinRM</p>
        </div>
        <div className="relative w-64">
          <Icons.Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-theme-muted" />
          <input 
            type="text" 
            placeholder="Search hostname..." 
            maxLength={255}
            className="w-full bg-theme-input border border-theme rounded-lg pl-9 pr-3 py-2 text-xs text-theme-primary placeholder-theme-muted focus:outline-none focus:border-blue-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Compact Table */}
      <div className="flex-1 bg-theme-card rounded-lg border border-theme overflow-hidden flex flex-col min-h-0">
        <table className="w-full text-left">
          <thead className="bg-theme-tertiary text-xs font-bold text-theme-secondary uppercase tracking-wide border-b border-theme">
            <tr>
              <th className="px-4 py-2.5 w-10">
                <input 
                  type="checkbox" 
                  checked={isAllSelected} 
                  onChange={toggleSelectAll}
                  className="w-3.5 h-3.5 rounded border-theme-secondary bg-theme-input text-blue-600"
                />
              </th>
              <th className="px-4 py-2.5">Node</th>
              <th className="px-4 py-2.5">Status</th>
              <th className="px-4 py-2.5">Compliance</th>
              <th className="px-4 py-2.5 text-right">Actions</th>
            </tr>
          </thead>
        </table>
        <div className="flex-1 overflow-auto">
          <table className="w-full text-left">
            <tbody className="divide-y divide-theme-secondary/50">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center">
                    <Icons.Computers className="w-8 h-8 text-theme-muted mx-auto mb-2" />
                    <p className="text-xs font-bold text-theme-muted uppercase">
                      {computers.length === 0 ? 'WSUS not connected' : 'No matches'}
                    </p>
                  </td>
                </tr>
              ) : (
                filtered.map((computer) => {
                  const perc = calculateCompliancePercentage(computer.updatesInstalled, computer.updatesNeeded);
                  const isItemSelected = isSelected(computer.id);
                  return (
                    <tr key={computer.id} className={`hover:bg-theme-secondary/20 ${isItemSelected ? 'bg-blue-600/5' : ''}`}>
                      <td className="px-4 py-2.5 w-10">
                        <input 
                          type="checkbox" 
                          checked={isItemSelected} 
                          onChange={() => toggleSelect(computer.id)}
                          className="w-3.5 h-3.5 rounded border-theme-secondary bg-theme-input text-blue-600"
                        />
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <Icons.Computers className="w-4 h-4 text-theme-muted" />
                          <div>
                            <p className="text-xs font-bold text-theme-primary">{computer.name}</p>
                            <p className="text-xs text-theme-muted">{computer.ipAddress}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1.5">
                          <span className={`w-1.5 h-1.5 rounded-full ${getStatusBadgeColor(computer.status)}`}></span>
                          <span className="text-xs font-medium text-theme-secondary">{computer.status}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1 bg-theme-tertiary rounded-full overflow-hidden">
                            <div 
                              className={`h-full ${perc < 70 ? 'bg-rose-500' : perc < 90 ? 'bg-amber-500' : 'bg-blue-500'}`} 
                              style={{ width: `${perc}%` }}
                            ></div>
                          </div>
                          <span className="text-xs text-theme-muted">{perc.toFixed(0)}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <button 
                          onClick={() => setSelectedNode(computer)}
                          className="text-xs font-bold text-blue-500 hover:text-blue-400 px-2 py-1 hover:bg-blue-600/10 rounded"
                        >
                          Details
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Node Detail Drawer - Compact */}
      {selectedNode && (
        <div className="fixed inset-y-0 right-0 w-80 bg-theme-card border-l border-theme z-[150] shadow-2xl flex flex-col">
          <div className="p-4 border-b border-theme flex justify-between items-center">
            <div>
              <h3 className="text-sm font-bold text-theme-primary">{selectedNode.name}</h3>
              <p className="text-xs text-theme-muted">{selectedNode.ipAddress}</p>
            </div>
            <button onClick={() => setSelectedNode(null)} className="p-1 hover:bg-theme-secondary/20 rounded text-theme-muted">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* System Info */}
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2 bg-theme-input rounded border border-theme">
                <p className="text-xs text-theme-muted">OS</p>
                <p className="text-xs font-bold text-theme-primary truncate">{selectedNode.os}</p>
              </div>
              <div className="p-2 bg-theme-input rounded border border-theme">
                <p className="text-xs text-theme-muted">Group</p>
                <p className="text-xs font-bold text-theme-primary truncate">{selectedNode.targetGroup}</p>
              </div>
              <div className="p-2 bg-theme-input rounded border border-theme">
                <p className="text-xs text-theme-muted">Status</p>
                <div className="flex items-center gap-1">
                  <span className={`w-1.5 h-1.5 rounded-full ${getStatusBadgeColor(selectedNode.status)}`}></span>
                  <p className="text-xs font-bold text-theme-primary">{selectedNode.status}</p>
                </div>
              </div>
              <div className="p-2 bg-theme-input rounded border border-theme">
                <p className="text-xs text-theme-muted">Last Sync</p>
                <p className="text-xs font-bold text-theme-primary">{selectedNode.lastSync}</p>
              </div>
            </div>

            {/* Compliance */}
            <div className="p-3 bg-blue-500/5 border border-blue-500/20 rounded">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs text-blue-400">Compliance</span>
                <span className="text-sm font-bold text-theme-primary">{calculateCompliancePercentage(selectedNode.updatesInstalled, selectedNode.updatesNeeded).toFixed(1)}%</span>
              </div>
              <div className="flex gap-4 text-xs">
                <div><span className="text-theme-muted">Installed:</span> <span className="text-emerald-400 font-bold">{selectedNode.updatesInstalled}</span></div>
                <div><span className="text-theme-muted">Pending:</span> <span className="text-rose-400 font-bold">{selectedNode.updatesNeeded}</span></div>
              </div>
            </div>
          </div>

          <div className="p-3 border-t border-theme space-y-2">
            <button 
              onClick={async () => { await syncComputers([selectedNode.id]); setSelectedNode(null); }}
              className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-bold uppercase"
            >
              Force Sync
            </button>
            <button 
              onClick={() => setConfirmDialog({ action: 'RESET', nodeId: selectedNode.id })}
              className="w-full py-2 bg-theme-secondary hover:bg-theme-secondary/80 text-theme-secondary hover:text-theme-primary border border-theme-secondary rounded text-xs font-bold uppercase"
            >
              Remote Reboot
            </button>
          </div>
        </div>
      )}

      {/* Bulk Action Strip - Compact */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-xl flex items-center gap-4 z-[100]">
          <span className="text-xs font-bold">{selectedIds.size} selected</span>
          <div className="h-4 w-px bg-white/20"></div>
          <button disabled={isProcessing} onClick={() => handleBulkAction('PING')} className="text-xs font-bold hover:underline disabled:opacity-50">Ping</button>
          <button disabled={isProcessing} onClick={() => handleBulkAction('SYNC')} className="text-xs font-bold hover:underline disabled:opacity-50">Sync</button>
          <button disabled={isProcessing} onClick={() => { if (selectedIds.size > 0) setConfirmDialog({ action: 'RESET', nodeId: Array.from(selectedIds)[0] }); }} className="text-xs font-bold text-rose-200 hover:underline disabled:opacity-50">Reboot</button>
          <div className="h-4 w-px bg-white/20"></div>
          <button onClick={clearSelection} className="text-xs opacity-70 hover:opacity-100">Cancel</button>
        </div>
      )}

      <ConfirmDialog
        isOpen={!!confirmDialog}
        title="Confirm Remote Reboot"
        message={confirmDialog?.action === 'RESET' ? `Reboot ${confirmDialog.nodeId === selectedNode?.id ? selectedNode.name : 'selected node(s)'}?` : ''}
        confirmLabel="Reboot"
        cancelLabel="Cancel"
        confirmVariant="danger"
        onConfirm={() => {
          if (confirmDialog) {
            if (confirmDialog.nodeId === selectedNode?.id) {
              loggingService.warn(`[ACTION] Remote reboot initiated for ${selectedNode.name}`);
              setSelectedNode(null);
            } else if (selectedIds.size > 0) {
              handleBulkAction('RESET');
            }
            setConfirmDialog(null);
          }
        }}
        onCancel={() => setConfirmDialog(null)}
      />
    </div>
  );
};

export default React.memo(ComputersTable);
