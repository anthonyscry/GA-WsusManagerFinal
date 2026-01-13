
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
    try {
      if (action === 'SYNC') {
        await syncComputers(Array.from(selectedIds));
      } else {
        // PING and RESET still use StateService for now (can be migrated later)
        const { stateService } = await import('../services/stateService');
        await stateService.performBulkAction(Array.from(selectedIds), action);
      }
      clearSelection();
      loggingService.info(`[ACTION] Bulk ${action} completed for ${selectedIds.size} node(s)`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      loggingService.error(`[ACTION] Bulk ${action} failed: ${errorMessage}`);
      // Don't clear selection on failure so user can retry
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn relative pb-24 h-full">
       <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-black text-white uppercase tracking-widest">Node Inventory</h1>
          <p className="text-xs text-slate-400 font-black uppercase tracking-tighter">Compliance telemetry via WinRM from GA-ASI endpoints.</p>
       </div>

      <div className="flex justify-between items-center bg-[#121216] p-4 rounded-xl border border-slate-800 shadow-sm">
        <div className="relative flex-1 max-w-xl">
          <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
            <Icons.Search className="w-5 h-5 text-slate-600" />
          </div>
          <input 
            type="text" 
            placeholder="Search by hostname..." 
            maxLength={255}
            className="w-full bg-black/40 border border-slate-800 rounded-lg pl-12 pr-6 py-3 text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
            value={searchTerm}
            onChange={(e) => {
              if (e.target.value.length <= 255) {
                setSearchTerm(e.target.value);
              }
            }}
            aria-label="Search computers by hostname"
          />
        </div>
      </div>

      <div className="bg-[#121216] rounded-xl border border-slate-800 overflow-hidden shadow-sm">
        <table className="w-full text-left">
          <thead className="bg-black/20 text-xs font-black text-slate-300 uppercase tracking-[0.2em] border-b border-slate-800">
            <tr>
              <th className="px-8 py-5 w-12">
                <input 
                  type="checkbox" 
                  checked={isAllSelected} 
                  onChange={toggleSelectAll}
                  className="w-4 h-4 rounded border-slate-800 bg-black text-blue-600 focus:ring-blue-600 focus:ring-offset-0"
                  aria-label="Select all computers"
                />
              </th>
              <th className="px-8 py-5">Node Identity</th>
              <th className="px-8 py-5">Status</th>
              <th className="px-8 py-5">Compliance</th>
              <th className="px-8 py-5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-8 py-20 text-center">
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-16 h-16 bg-slate-900/40 border border-slate-800 rounded-xl flex items-center justify-center">
                      <Icons.Computers className="w-8 h-8 text-slate-700" />
                    </div>
                    <div>
                      <p className="text-base font-black text-slate-400 uppercase tracking-widest mb-2">No Computers Found</p>
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-tight">
                        {computers.length === 0 
                          ? 'WSUS server not connected. Please ensure WSUS is installed and running.'
                          : 'No computers match your search criteria.'}
                      </p>
                    </div>
                  </div>
                </td>
              </tr>
            ) : (
              filtered.map((computer) => {
              const perc = calculateCompliancePercentage(computer.updatesInstalled, computer.updatesNeeded);
              const isItemSelected = isSelected(computer.id);
              return (
                <tr key={computer.id} className={`hover:bg-slate-800/20 transition-colors group ${isItemSelected ? 'bg-blue-600/5' : ''}`}>
                  <td className="px-8 py-6">
                    <input 
                      type="checkbox" 
                      checked={isItemSelected} 
                      onChange={() => toggleSelect(computer.id)}
                      className="w-4 h-4 rounded border-slate-800 bg-black text-blue-600 focus:ring-blue-600 focus:ring-offset-0"
                      aria-label={`Select ${computer.name}`}
                    />
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-slate-900 border border-slate-800 rounded-lg flex items-center justify-center text-slate-600 group-hover:bg-blue-600/10 group-hover:text-blue-500 group-hover:border-blue-500/30 transition-all">
                        <Icons.Computers className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="font-black text-white text-sm uppercase tracking-tight">{computer.name}</p>
                        <p className="text-[9px] font-bold text-slate-600 uppercase tracking-tighter mt-0.5">{computer.ipAddress}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-2.5">
                      <span className={`w-2 h-2 rounded-full ${getStatusBadgeColor(computer.status)} shadow-[0_0_5px_currentColor]`}></span>
                      <span className="text-xs font-black text-slate-300 uppercase tracking-widest">{computer.status}</span>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-3">
                       <div className="w-24 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all duration-1000 ${perc < 70 ? 'bg-rose-500' : perc < 90 ? 'bg-amber-500' : 'bg-blue-500'}`} 
                            style={{ width: `${perc}%` }}
                          ></div>
                       </div>
                       <span className="text-xs font-black text-slate-400">{perc.toFixed(0)}%</span>
                    </div>
                  </td>
                  <td className="px-8 py-6 text-right">
                    <button 
                      onClick={() => setSelectedNode(computer)}
                      className="text-xs font-black text-blue-500 hover:text-white uppercase tracking-widest px-4 py-2 hover:bg-blue-600 rounded-lg transition-all border border-transparent hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                      aria-label={`Interact with ${computer.name}`}
                    >
                      Interact
                    </button>
                  </td>
              </tr>
            );
            }))}
          </tbody>
        </table>
      </div>

      {/* Node Detail Drawer */}
      {selectedNode && (
          <div className="fixed inset-y-0 right-0 w-[450px] bg-[#121216] border-l border-slate-800 z-[150] shadow-2xl animate-slideInRight flex flex-col">
              <div className="p-8 border-b border-slate-800 flex justify-between items-center">
                  <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-blue-600/10 border border-blue-600/20 rounded-xl flex items-center justify-center text-blue-500">
                          <Icons.Computers className="w-6 h-6" />
                      </div>
                      <div>
                          <h3 className="text-lg font-black text-white uppercase tracking-tight">{selectedNode.name}</h3>
                          <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">{selectedNode.ipAddress}</p>
                      </div>
                  </div>
                  <button onClick={() => setSelectedNode(null)} className="p-2 hover:bg-slate-800 rounded-lg text-slate-500 hover:text-white transition-all">
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 space-y-8">
                  {/* System Information */}
                  <div className="space-y-4">
                      <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">System Information</h4>
                      <div className="grid grid-cols-2 gap-4">
                          <div className="p-4 bg-black/40 rounded-xl border border-slate-800">
                              <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Operating System</p>
                              <p className="text-sm font-bold text-white">{selectedNode.os}</p>
                          </div>
                          <div className="p-4 bg-black/40 rounded-xl border border-slate-800">
                              <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Target Group</p>
                              <p className="text-sm font-bold text-white">{selectedNode.targetGroup}</p>
                          </div>
                          <div className="p-4 bg-black/40 rounded-xl border border-slate-800">
                              <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">IP Address</p>
                              <p className="text-sm font-bold text-white mono">{selectedNode.ipAddress}</p>
                          </div>
                          <div className="p-4 bg-black/40 rounded-xl border border-slate-800">
                              <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Health Status</p>
                              <div className="flex items-center gap-2 mt-1">
                                  <span className={`w-2 h-2 rounded-full ${getStatusBadgeColor(selectedNode.status)} shadow-[0_0_5px_currentColor]`}></span>
                                  <p className="text-[11px] font-bold text-white uppercase">{selectedNode.status}</p>
                              </div>
                          </div>
                      </div>
                  </div>

                  {/* Compliance Breakdown */}
                  <div className="space-y-4">
                      <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Compliance Breakdown</h4>
                      <div className="space-y-3">
                          <div className="p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-xl">
                              <div className="flex justify-between items-center mb-2">
                                  <span className="text-xs font-bold text-emerald-500 uppercase">Updates Installed</span>
                                  <span className="text-sm font-black text-white mono">{selectedNode.updatesInstalled}</span>
                              </div>
                              <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden">
                                  <div 
                                    className="h-full bg-emerald-500 transition-all duration-1000" 
                                    style={{ width: `${calculateCompliancePercentage(selectedNode.updatesInstalled, selectedNode.updatesNeeded)}%` }}
                                  ></div>
                              </div>
                          </div>
                          <div className={`p-4 rounded-xl border ${selectedNode.updatesNeeded > 0 ? 'bg-rose-500/5 border-rose-500/10' : 'bg-slate-900/40 border-slate-800'}`}>
                              <div className="flex justify-between items-center mb-2">
                                  <span className={`text-xs font-bold uppercase ${selectedNode.updatesNeeded > 0 ? 'text-rose-500' : 'text-slate-400'}`}>Updates Pending</span>
                                  <span className="text-sm font-black text-white mono">{selectedNode.updatesNeeded}</span>
                              </div>
                              {selectedNode.updatesNeeded > 0 && (
                                  <p className="text-xs text-rose-400 mt-2">Action required: {selectedNode.updatesNeeded} update{selectedNode.updatesNeeded !== 1 ? 's' : ''} pending installation</p>
                              )}
                          </div>
                          <div className="p-4 bg-blue-500/5 border border-blue-500/10 rounded-xl">
                              <div className="flex justify-between items-center">
                                  <span className="text-[10px] font-bold text-blue-500 uppercase">Compliance Rate</span>
                                  <span className="text-lg font-black text-white mono">{calculateCompliancePercentage(selectedNode.updatesInstalled, selectedNode.updatesNeeded).toFixed(1)}%</span>
                              </div>
                          </div>
                      </div>
                  </div>

                  {/* Sync Information */}
                  <div className="space-y-4 pt-4 border-t border-slate-800">
                      <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Synchronization</h4>
                      <div className="p-4 bg-black/40 rounded-xl border border-slate-800">
                          <div className="flex justify-between items-center mb-2">
                              <span className="text-xs font-bold text-slate-300 uppercase">Last Sync</span>
                              <span className="text-sm font-bold text-white">{selectedNode.lastSync}</span>
                          </div>
                          <p className="text-xs text-slate-400 mt-2">Last successful synchronization with WSUS server</p>
                      </div>
                  </div>

                  <div className="space-y-3 pt-6 border-t border-slate-800">
                      <button
                        onClick={async () => {
                          try {
                            await syncComputers([selectedNode.id]);
                            loggingService.info(`[ACTION] Sync completed for ${selectedNode.name}`);
                            setSelectedNode(null);
                          } catch (error) {
                            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                            loggingService.error(`[ACTION] Sync failed for ${selectedNode.name}: ${errorMessage}`);
                          }
                        }}
                        className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-xl transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                      >
                        Force Client Sync
                      </button>
                      <button 
                        onClick={() => setConfirmDialog({ action: 'RESET', nodeId: selectedNode.id })}
                        className="w-full py-4 bg-slate-900 hover:bg-slate-800 text-slate-400 rounded-xl text-xs font-black uppercase tracking-widest border border-slate-800 transition-all focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2"
                      >
                        Remote Reboot Node
                      </button>
                  </div>
              </div>

              <div className="p-6 bg-black/40 border-t border-slate-800">
                  <p className="text-xs font-black text-slate-500 uppercase text-center tracking-widest">Last Heartbeat: {selectedNode.lastSync}</p>
              </div>
          </div>
      )}

      {/* Bulk Action Strip */}
      {selectedIds.size > 0 && (
          <div className="fixed bottom-12 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-8 py-4 rounded-2xl shadow-2xl flex items-center gap-8 z-[100] animate-slideUp border border-blue-400/40 backdrop-blur-xl">
             <div className="flex items-center gap-3">
                <span className="text-sm font-black uppercase tracking-widest bg-white/20 px-3 py-1 rounded-lg">{Array.from(selectedIds).length} Nodes Selected</span>
             </div>
             <div className="h-6 w-px bg-white/20"></div>
             <div className="flex items-center gap-4">
                <button 
                    disabled={isProcessing}
                    onClick={() => handleBulkAction('PING')} 
                    className="text-xs font-black uppercase tracking-widest hover:underline disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-white/50 rounded px-2 py-1"
                >
                    {isProcessing ? 'Processing...' : 'Bulk Ping'}
                </button>
                <button 
                    disabled={isProcessing}
                    onClick={() => handleBulkAction('SYNC')} 
                    className="text-xs font-black uppercase tracking-widest hover:underline disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-white/50 rounded px-2 py-1"
                >
                    {isProcessing ? 'Processing...' : 'Force Sync'}
                </button>
                <button 
                    disabled={isProcessing}
                    onClick={() => {
                      if (selectedIds.size > 0) {
                        setConfirmDialog({ action: 'RESET', nodeId: Array.from(selectedIds)[0] });
                      }
                    }} 
                    className="text-xs font-black uppercase tracking-widest text-rose-100 hover:text-white disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-white/50 rounded px-2 py-1"
                >
                    {isProcessing ? 'Processing...' : 'Remote Reboot'}
                </button>
             </div>
             <div className="h-6 w-px bg-white/20"></div>
             <button onClick={clearSelection} className="text-xs font-black uppercase tracking-widest opacity-60 hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-white/50 rounded px-2 py-1">Cancel</button>
          </div>
      )}

      {/* Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!confirmDialog}
        title="Confirm Remote Reboot"
        message={confirmDialog?.action === 'RESET' 
          ? `Are you sure you want to remotely reboot ${confirmDialog.nodeId === selectedNode?.id ? selectedNode.name : 'the selected node(s)'}? This action cannot be undone.`
          : ''}
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

export default ComputersTable;
