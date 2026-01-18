import React, { useState, useEffect, useCallback } from 'react';
import { wsusService } from '../services/wsusService';
import { loggingService } from '../services/loggingService';

interface ComputerGroup {
  id: string;
  name: string;
  computerCount: number;
}

interface GroupComputer {
  id: string;
  name: string;
  ipAddress: string;
  lastReported: string;
}

const GroupsView: React.FC = () => {
  const [groups, setGroups] = useState<ComputerGroup[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  
  // Computer assignment state
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [groupComputers, setGroupComputers] = useState<GroupComputer[]>([]);
  const [isLoadingComputers, setIsLoadingComputers] = useState(false);
  const [selectedComputer, setSelectedComputer] = useState<string | null>(null);
  const [targetGroup, setTargetGroup] = useState<string>('');
  const [isMoving, setIsMoving] = useState(false);

  const loadGroups = useCallback(async () => {
    setIsLoading(true);
    loggingService.info('[GROUPS] Loading computer groups...');
    
    try {
      const data = await wsusService.getComputerGroups();
      setGroups(data);
      loggingService.info(`[GROUPS] Loaded ${data.length} groups`);
    } catch (error) {
      loggingService.error(`[GROUPS] Failed to load: ${error instanceof Error ? error.message : 'Unknown'}`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadGroups();
  }, [loadGroups]);

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) return;
    
    setIsCreating(true);
    loggingService.info(`[GROUPS] Creating group: ${newGroupName}`);
    
    try {
      // Import powershellService dynamically
      const { powershellService } = await import('../services/powershellService');
      
      const safeName = newGroupName.replace(/[^a-zA-Z0-9_\- ]/g, '');
      const script = `
        $wsus = Get-WsusServer -Name localhost -PortNumber 8530
        $existingGroup = $wsus.GetComputerTargetGroups() | Where-Object { $_.Name -eq "${safeName}" }
        if ($existingGroup) {
          Write-Output "EXISTS"
        } else {
          $wsus.CreateComputerTargetGroup("${safeName}")
          Write-Output "SUCCESS"
        }
      `;
      
      const result = await powershellService.execute(script, 30000);
      
      if (result.stdout.includes('SUCCESS')) {
        loggingService.info(`[GROUPS] Created group: ${safeName}`);
        setNewGroupName('');
        await loadGroups();
      } else if (result.stdout.includes('EXISTS')) {
        loggingService.warn(`[GROUPS] Group already exists: ${safeName}`);
      } else {
        loggingService.error(`[GROUPS] Failed to create group: ${result.stderr || 'Unknown error'}`);
      }
    } catch (error) {
      loggingService.error(`[GROUPS] Error: ${error instanceof Error ? error.message : 'Unknown'}`);
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteGroup = async (groupName: string) => {
    if (groupName === 'All Computers' || groupName === 'Unassigned Computers') {
      loggingService.warn('[GROUPS] Cannot delete system groups');
      return;
    }
    
    if (!confirm(`Delete group "${groupName}"? Computers will be moved to "Unassigned Computers".`)) {
      return;
    }
    
    loggingService.info(`[GROUPS] Deleting group: ${groupName}`);
    
    try {
      const { powershellService } = await import('../services/powershellService');
      
      const script = `
        $wsus = Get-WsusServer -Name localhost -PortNumber 8530
        $group = $wsus.GetComputerTargetGroups() | Where-Object { $_.Name -eq "${groupName}" }
        if ($group) {
          $group.Delete()
          Write-Output "SUCCESS"
        } else {
          Write-Output "NOTFOUND"
        }
      `;
      
      const result = await powershellService.execute(script, 30000);
      
      if (result.stdout.includes('SUCCESS')) {
        loggingService.info(`[GROUPS] Deleted group: ${groupName}`);
        if (selectedGroup === groupName) {
          setSelectedGroup(null);
          setGroupComputers([]);
        }
        await loadGroups();
      } else {
        loggingService.error(`[GROUPS] Failed to delete: ${result.stderr || 'Group not found'}`);
      }
    } catch (error) {
      loggingService.error(`[GROUPS] Error: ${error instanceof Error ? error.message : 'Unknown'}`);
    }
  };

  const loadComputersInGroup = async (groupName: string) => {
    setIsLoadingComputers(true);
    setSelectedGroup(groupName);
    loggingService.info(`[GROUPS] Loading computers in group: ${groupName}`);
    
    try {
      const computers = await wsusService.getComputersInGroup(groupName);
      setGroupComputers(computers);
      loggingService.info(`[GROUPS] Found ${computers.length} computers in ${groupName}`);
    } catch (error) {
      loggingService.error(`[GROUPS] Failed to load computers: ${error instanceof Error ? error.message : 'Unknown'}`);
      setGroupComputers([]);
    } finally {
      setIsLoadingComputers(false);
    }
  };

  const handleMoveComputer = async () => {
    if (!selectedComputer || !targetGroup) return;
    
    setIsMoving(true);
    loggingService.info(`[GROUPS] Moving computer ${selectedComputer} to ${targetGroup}`);
    
    try {
      const success = await wsusService.moveComputerToGroup(selectedComputer, targetGroup);
      
      if (success) {
        loggingService.info(`[GROUPS] Computer moved successfully`);
        setSelectedComputer(null);
        setTargetGroup('');
        // Refresh both groups list and current group's computers
        await loadGroups();
        if (selectedGroup) {
          await loadComputersInGroup(selectedGroup);
        }
      } else {
        loggingService.error(`[GROUPS] Failed to move computer`);
      }
    } catch (error) {
      loggingService.error(`[GROUPS] Error: ${error instanceof Error ? error.message : 'Unknown'}`);
    } finally {
      setIsMoving(false);
    }
  };

  return (
    <div className="animate-fadeIn h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-3 bg-theme-card border border-theme-secondary rounded-lg mb-2 shrink-0">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-black text-theme-primary uppercase tracking-wide">Computer Groups</h2>
          <span className="px-2 py-1 bg-blue-600/10 text-blue-400 border border-blue-500/30 rounded text-[10px] font-bold uppercase">
            {groups.length} Groups
          </span>
        </div>
        <button
          onClick={loadGroups}
          disabled={isLoading}
          className="px-3 py-1.5 bg-theme-secondary hover:bg-theme-secondary/80 text-theme-primary border border-theme-secondary rounded text-[10px] font-black uppercase disabled:opacity-50"
        >
          {isLoading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {/* Create Group */}
      <div className="flex items-center gap-2 p-2 bg-theme-card border border-theme-secondary rounded-lg mb-2 shrink-0">
        <input
          type="text"
          value={newGroupName}
          onChange={(e) => setNewGroupName(e.target.value)}
          placeholder="New group name..."
          className="flex-1 bg-theme-input border border-theme rounded px-3 py-1.5 text-sm text-theme-primary placeholder-theme-muted"
          onKeyDown={(e) => e.key === 'Enter' && handleCreateGroup()}
        />
        <button
          onClick={handleCreateGroup}
          disabled={!newGroupName.trim() || isCreating}
          className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-[10px] font-black uppercase disabled:opacity-50"
        >
          {isCreating ? 'Creating...' : 'Create Group'}
        </button>
      </div>

      {/* Two-column layout: Groups | Computers */}
      <div className="flex-1 min-h-0 flex gap-2">
        {/* Groups List (Left) */}
        <div className="w-1/2 bg-theme-card rounded-lg border border-theme-secondary overflow-hidden flex flex-col">
          <div className="grid grid-cols-[1fr_70px_60px] gap-2 px-3 py-2 bg-theme-tertiary border-b border-theme-secondary shrink-0">
            <span className="text-xs font-bold text-theme-secondary uppercase">Group Name</span>
            <span className="text-xs font-bold text-theme-secondary uppercase text-center">Count</span>
            <span className="text-xs font-bold text-theme-secondary uppercase text-right">Actions</span>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-sm text-theme-muted">Loading groups...</p>
              </div>
            ) : groups.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-sm text-theme-muted">No groups found</p>
              </div>
            ) : (
              groups.map((group, idx) => {
                const isSystemGroup = group.name === 'All Computers' || group.name === 'Unassigned Computers';
                const isSelected = selectedGroup === group.name;
                return (
                  <div
                    key={group.id}
                    onClick={() => loadComputersInGroup(group.name)}
                    className={`grid grid-cols-[1fr_70px_60px] gap-2 px-3 py-2 items-center border-b border-theme-secondary cursor-pointer transition-colors ${
                      isSelected ? 'bg-blue-600/20 border-l-2 border-l-blue-500' : idx % 2 === 1 ? 'bg-theme-secondary/10 hover:bg-theme-secondary/20' : 'hover:bg-theme-secondary/20'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={`w-2 h-2 rounded-full shrink-0 ${isSystemGroup ? 'bg-amber-500' : 'bg-blue-500'}`}></div>
                      <span className="text-sm font-medium text-theme-primary truncate">{group.name}</span>
                      {isSystemGroup && (
                        <span className="text-[8px] font-bold text-amber-500/70 uppercase px-1 py-0.5 bg-amber-500/10 rounded shrink-0">Sys</span>
                      )}
                    </div>
                    <span className="text-sm font-bold text-theme-secondary text-center">{group.computerCount}</span>
                    <div className="text-right">
                      {!isSystemGroup && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteGroup(group.name); }}
                          className="text-[10px] font-bold uppercase text-rose-500/70 hover:text-rose-500 transition-colors"
                        >
                          Del
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Computers in Group (Right) */}
        <div className="w-1/2 bg-theme-card rounded-lg border border-theme-secondary overflow-hidden flex flex-col">
          <div className="px-3 py-2 bg-theme-tertiary border-b border-theme-secondary shrink-0 flex items-center justify-between">
            <span className="text-xs font-bold text-theme-secondary uppercase">
              {selectedGroup ? `Computers in "${selectedGroup}"` : 'Select a group'}
            </span>
            {selectedGroup && (
              <span className="text-[10px] text-theme-muted">{groupComputers.length} computers</span>
            )}
          </div>

          {/* Move Computer Bar */}
          {selectedComputer && (
            <div className="px-3 py-2 bg-blue-600/10 border-b border-blue-500/30 shrink-0 flex items-center gap-2">
              <span className="text-xs text-blue-400">Move to:</span>
              <select
                value={targetGroup}
                onChange={(e) => setTargetGroup(e.target.value)}
                className="flex-1 bg-theme-input border border-theme rounded px-2 py-1 text-xs text-theme-primary"
              >
                <option value="">Select group...</option>
                {groups.filter(g => g.name !== selectedGroup && g.name !== 'All Computers').map(g => (
                  <option key={g.id} value={g.name}>{g.name}</option>
                ))}
              </select>
              <button
                onClick={handleMoveComputer}
                disabled={!targetGroup || isMoving}
                className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-[10px] font-bold uppercase disabled:opacity-50"
              >
                {isMoving ? 'Moving...' : 'Move'}
              </button>
              <button
                onClick={() => { setSelectedComputer(null); setTargetGroup(''); }}
                className="px-2 py-1 text-theme-secondary hover:text-theme-primary text-[10px]"
              >
                Cancel
              </button>
            </div>
          )}

          <div className="flex-1 min-h-0 overflow-y-auto">
            {!selectedGroup ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-sm text-theme-muted">Click a group to view computers</p>
              </div>
            ) : isLoadingComputers ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-sm text-theme-muted">Loading computers...</p>
              </div>
            ) : groupComputers.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-sm text-theme-muted">No computers in this group</p>
              </div>
            ) : (
              groupComputers.map((computer, idx) => (
                <div
                  key={computer.id}
                  onClick={() => setSelectedComputer(selectedComputer === computer.id ? null : computer.id)}
                  className={`px-3 py-2 border-b border-theme-secondary cursor-pointer transition-colors ${
                    selectedComputer === computer.id ? 'bg-blue-600/20' : idx % 2 === 1 ? 'bg-theme-secondary/10 hover:bg-theme-secondary/20' : 'hover:bg-theme-secondary/20'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-theme-primary truncate">{computer.name}</p>
                      <p className="text-[10px] text-theme-muted">{computer.ipAddress}</p>
                    </div>
                    <div className="text-right shrink-0 ml-2">
                      <p className="text-[10px] text-theme-muted">Last seen</p>
                      <p className="text-xs text-theme-secondary">{computer.lastReported}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default React.memo(GroupsView);
