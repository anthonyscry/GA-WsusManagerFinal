/**
 * Audit View - STIG Compliance Management
 * Supports loading official DISA STIG files from a configured directory
 */

import React, { useState, useEffect, useCallback } from 'react';
import { stigService, StigBenchmark, StigRule, StigConfig } from '../services/stigService';
import { stateService } from '../services/stateService';
import { loggingService } from '../services/loggingService';

type ViewMode = 'overview' | 'rules';

const AuditView: React.FC = () => {
  const [viewMode, setViewMode] = useState<ViewMode>('overview');
  const [config, setConfig] = useState<StigConfig>(stigService.getConfig());
  const [benchmarks, setBenchmarks] = useState<StigBenchmark[]>(stigService.getBenchmarks());
  const [selectedBenchmark, setSelectedBenchmark] = useState<string | null>(null);
  const [rules, setRules] = useState<StigRule[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [isRunningChecks, setIsRunningChecks] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [stats, setStats] = useState(stigService.getComplianceStats());
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // Update stats when rules change
  useEffect(() => {
    setStats(stigService.getComplianceStats());
  }, [rules, benchmarks]);

  // Handle directory scan
  const handleScanDirectory = useCallback(async () => {
    setIsScanning(true);
    loggingService.info('[STIG] Scanning STIG directory...');
    try {
      const results = await stigService.scanDirectory();
      setBenchmarks(results);
      setStats(stigService.getComplianceStats());
      loggingService.info(`[STIG] Found ${results.length} STIG benchmarks`);
    } catch (error) {
      loggingService.error(`[STIG] Directory scan failed: ${error}`);
    } finally {
      setIsScanning(false);
    }
  }, []);

  // Handle compliance check
  const handleRunChecks = useCallback(async () => {
    setIsRunningChecks(true);
    loggingService.info('[STIG] Running compliance checks...');
    try {
      const results = await stigService.runComplianceChecks(selectedBenchmark || undefined);
      setRules(results);
      setBenchmarks(stigService.getBenchmarks());
      setStats(stigService.getComplianceStats());
      loggingService.info(`[STIG] Compliance check complete: ${stats.rate}% compliant`);
    } catch (error) {
      loggingService.error(`[STIG] Compliance check failed: ${error}`);
    } finally {
      setIsRunningChecks(false);
    }
  }, [selectedBenchmark, stats.rate]);

  // Handle quick checks (using existing stateService checks)
  const handleQuickCheck = useCallback(async () => {
    setIsRunningChecks(true);
    try {
      await stateService.runStigComplianceChecks();
      loggingService.info('[STIG] Quick compliance check complete');
    } catch (error) {
      loggingService.error(`[STIG] Quick check failed: ${error}`);
    } finally {
      setIsRunningChecks(false);
    }
  }, []);

  // Handle export
  const handleExport = useCallback(async () => {
    setIsExporting(true);
    try {
      const exportPath = `${config.stigDirectory}\\STIG_Compliance_Report_${new Date().toISOString().split('T')[0]}.csv`;
      const success = await stigService.exportResults(exportPath);
      if (success) {
        loggingService.info(`[STIG] Report exported to ${exportPath}`);
      } else {
        loggingService.error('[STIG] Export failed');
      }
    } catch (error) {
      loggingService.error(`[STIG] Export failed: ${error}`);
    } finally {
      setIsExporting(false);
    }
  }, [config.stigDirectory]);

  // Handle config update
  const handleConfigChange = (key: keyof StigConfig, value: string | boolean) => {
    const newConfig = { ...config, [key]: value };
    setConfig(newConfig);
    stigService.saveConfig({ [key]: value });
  };

  // Handle browse for STIG directory
  const handleBrowseDirectory = async () => {
    try {
      if (typeof window !== 'undefined' && (window as any).require) {
        const { ipcRenderer } = (window as any).require('electron');
        const result = await ipcRenderer.invoke('show-directory-dialog', {
          title: 'Select STIG Files Directory',
          properties: ['openDirectory']
        });
        
        if (!result.canceled && result.filePaths.length > 0) {
          handleConfigChange('stigDirectory', result.filePaths[0]);
        }
      }
    } catch (error) {
      loggingService.error(`[STIG] Failed to open directory dialog: ${error}`);
    }
  };

  // View benchmark rules
  const handleViewBenchmark = (benchmarkId: string) => {
    setSelectedBenchmark(benchmarkId);
    const benchmark = benchmarks.find(b => b.id === benchmarkId);
    setRules(benchmark?.rules || []);
    setViewMode('rules');
  };

  // Filter rules
  const filteredRules = rules.filter(r => {
    if (filterSeverity !== 'all' && r.severity !== filterSeverity) return false;
    if (filterStatus !== 'all' && r.status !== filterStatus) return false;
    return true;
  });

  return (
    <div className="space-y-4 animate-fadeIn pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-gradient-to-r from-purple-600/10 to-blue-600/10 border border-purple-500/20 rounded-xl">
        <div className="flex-1">
          <h2 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2">
            🛡️ STIG Compliance Scanner
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
              stats.rate >= 80 ? 'bg-emerald-600/10 text-emerald-400 border-emerald-500/30' : 
              stats.rate >= 50 ? 'bg-amber-600/10 text-amber-400 border-amber-500/30' : 
              'bg-rose-600/10 text-rose-400 border-rose-500/30'
            }`}>
              {stats.total > 0 ? `${stats.rate}% Compliant` : 'No STIGs Loaded'}
            </span>
          </h2>
          <p className="text-[10px] font-medium text-slate-300 uppercase tracking-wider mt-0.5">
            Load official DISA STIG files from public.cyber.mil/stigs/downloads/
          </p>
        </div>
        <div className="flex items-center gap-2">
          {viewMode === 'rules' && (
            <button
              onClick={() => { setViewMode('overview'); setSelectedBenchmark(null); }}
              className="px-3 py-2 bg-slate-700 text-white rounded-lg text-[10px] font-black uppercase tracking-wider hover:bg-slate-600"
            >
              ← Back
            </button>
          )}
          <button
            disabled={isRunningChecks}
            onClick={handleQuickCheck}
            className="px-3 py-2 bg-slate-800 text-white rounded-lg text-[10px] font-black uppercase tracking-wider hover:bg-slate-700 disabled:opacity-50"
          >
            Quick Check
          </button>
          <button
            disabled={isExporting || stats.total === 0}
            onClick={handleExport}
            className="px-3 py-2 bg-blue-600 text-white rounded-lg text-[10px] font-black uppercase tracking-wider hover:bg-blue-500 disabled:opacity-50"
          >
            {isExporting ? 'Exporting...' : 'Export CSV'}
          </button>
        </div>
      </div>

      {viewMode === 'overview' && (
        <>
          {/* Configuration Panel */}
          <div className="bg-[#121216] rounded-xl p-4 border border-slate-800/40 space-y-4">
            <h3 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-purple-500 rounded-full"></span>
              STIG File Directory
            </h3>
            
            <div className="flex gap-2">
              <input
                type="text"
                value={config.stigDirectory}
                onChange={e => handleConfigChange('stigDirectory', e.target.value)}
                placeholder="C:\STIG_Files"
                className="flex-1 bg-black/40 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <button
                onClick={handleBrowseDirectory}
                className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-[10px] font-black uppercase tracking-wider"
              >
                Browse
              </button>
              <button
                disabled={isScanning}
                onClick={handleScanDirectory}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-[10px] font-black uppercase tracking-wider disabled:opacity-50"
              >
                {isScanning ? 'Scanning...' : 'Scan Directory'}
              </button>
            </div>

            <div className="p-3 bg-black/30 rounded-lg border border-slate-800/50">
              <p className="text-[10px] text-slate-400 font-medium">
                <strong className="text-slate-300">How to use:</strong> Download official STIG benchmark files (*.xml) from{' '}
                <span className="text-purple-400">public.cyber.mil/stigs/downloads/</span>
                and place them in the directory above. Supported STIGs include Windows Server, SQL Server, IIS, and more.
              </p>
            </div>
          </div>

          {/* Stats Cards */}
          {stats.total > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
              <div className="bg-[#121216] rounded-xl p-3 border border-slate-800/40 text-center">
                <div className="text-xl font-black text-white">{stats.total}</div>
                <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Total Rules</div>
              </div>
              <div className="bg-[#121216] rounded-xl p-3 border border-emerald-500/20 text-center">
                <div className="text-xl font-black text-emerald-400">{stats.compliant}</div>
                <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Compliant</div>
              </div>
              <div className="bg-[#121216] rounded-xl p-3 border border-rose-500/20 text-center">
                <div className="text-xl font-black text-rose-400">{stats.open}</div>
                <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Open</div>
              </div>
              <div className="bg-[#121216] rounded-xl p-3 border border-slate-800/40 text-center">
                <div className="text-xl font-black text-slate-400">{stats.notChecked}</div>
                <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Not Checked</div>
              </div>
              <div className="bg-[#121216] rounded-xl p-3 border border-blue-500/20 text-center">
                <div className="text-xl font-black text-blue-400">{stats.notApplicable}</div>
                <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">N/A</div>
              </div>
              <div className="bg-[#121216] rounded-xl p-3 border border-amber-500/20 text-center">
                <div className="text-xl font-black text-amber-400">{stats.error}</div>
                <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Errors</div>
              </div>
            </div>
          )}

          {/* Loaded Benchmarks */}
          <div className="space-y-3">
            <h3 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
              Loaded STIG Benchmarks ({benchmarks.length})
            </h3>
            
            {benchmarks.length === 0 ? (
              <div className="bg-[#121216] rounded-xl p-8 border border-slate-800/40 text-center">
                <div className="text-3xl mb-3">📁</div>
                <h4 className="text-sm font-black text-white uppercase tracking-wider mb-2">No STIG Files Loaded</h4>
                <p className="text-[10px] text-slate-400 font-medium max-w-md mx-auto">
                  Configure the STIG directory above and click &quot;Scan Directory&quot; to load DISA STIG benchmark files.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {benchmarks.map(benchmark => {
                  const benchmarkStats = {
                    compliant: benchmark.rules.filter(r => r.status === 'Compliant').length,
                    open: benchmark.rules.filter(r => r.status === 'Open').length,
                    total: benchmark.rules.length
                  };
                  const rate = benchmarkStats.total > 0 
                    ? Math.round((benchmarkStats.compliant / benchmarkStats.total) * 100) 
                    : 0;
                  
                  return (
                    <div 
                      key={benchmark.id}
                      className="bg-[#121216] rounded-xl p-4 border border-slate-800/40 hover:border-purple-500/30 transition-all cursor-pointer"
                      onClick={() => handleViewBenchmark(benchmark.id)}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1 min-w-0 pr-3">
                          <h4 className="text-xs font-black text-white uppercase tracking-tight truncate">
                            {benchmark.title}
                          </h4>
                          <p className="text-[10px] text-slate-500 font-medium truncate">
                            v{benchmark.version} • {benchmark.ruleCount} rules
                          </p>
                        </div>
                        <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase whitespace-nowrap ${
                          rate >= 80 ? 'bg-emerald-500/10 text-emerald-400' : 
                          rate >= 50 ? 'bg-amber-500/10 text-amber-400' : 
                          'bg-rose-500/10 text-rose-400'
                        }`}>
                          {rate}%
                        </span>
                      </div>
                      
                      {/* Mini progress bar */}
                      <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden mb-2">
                        <div 
                          className={`h-full transition-all ${rate >= 80 ? 'bg-emerald-500' : rate >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`}
                          style={{ width: `${rate}%` }}
                        ></div>
                      </div>
                      
                      <div className="flex items-center gap-3 text-[9px] font-bold uppercase tracking-wider">
                        <span className="text-emerald-400">{benchmarkStats.compliant} Pass</span>
                        <span className="text-rose-400">{benchmarkStats.open} Open</span>
                        <span className="text-slate-500 ml-auto">Click to view →</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {viewMode === 'rules' && (
        <>
          {/* Filters and Actions */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase">Severity:</label>
              <select
                value={filterSeverity}
                onChange={e => setFilterSeverity(e.target.value)}
                className="bg-black/40 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="all">All</option>
                <option value="CAT I">CAT I (High)</option>
                <option value="CAT II">CAT II (Medium)</option>
                <option value="CAT III">CAT III (Low)</option>
              </select>
            </div>
            
            <div className="flex items-center gap-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase">Status:</label>
              <select
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
                className="bg-black/40 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="all">All</option>
                <option value="Compliant">Compliant</option>
                <option value="Open">Open</option>
                <option value="Not Checked">Not Checked</option>
                <option value="Not Applicable">N/A</option>
              </select>
            </div>

            <div className="ml-auto">
              <button
                disabled={isRunningChecks}
                onClick={handleRunChecks}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-[10px] font-black uppercase tracking-wider disabled:opacity-50"
              >
                {isRunningChecks ? 'Running Checks...' : 'Run All Checks'}
              </button>
            </div>
          </div>

          {/* Rules List */}
          <div className="space-y-2">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              Showing {filteredRules.length} of {rules.length} rules
            </div>
            
            {filteredRules.map(rule => (
              <div 
                key={`${rule.stigId}-${rule.id}`}
                className="bg-[#121216]/50 rounded-xl p-3 border border-slate-800/40 hover:border-slate-700 transition-all"
              >
                <div className="flex items-start gap-3">
                  {/* Severity Badge */}
                  <div className="flex flex-col items-center gap-1 w-14 shrink-0 pt-0.5">
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase ${
                      rule.severity === 'CAT I' ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20' : 
                      rule.severity === 'CAT II' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' : 
                      'bg-blue-500/10 text-blue-500 border border-blue-500/20'
                    }`}>
                      {rule.severity}
                    </span>
                    <span className={`text-[8px] font-bold uppercase ${
                      rule.checkType === 'auto' ? 'text-emerald-500' : 'text-slate-500'
                    }`}>
                      {rule.checkType}
                    </span>
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-black text-purple-400 uppercase tracking-wider">{rule.vulnId}</span>
                      {rule.ruleId && <span className="text-[9px] font-bold text-slate-600">{rule.ruleId}</span>}
                    </div>
                    <h4 className="text-xs font-bold text-white leading-tight mb-1">{rule.title}</h4>
                    {rule.description && (
                      <p className="text-[10px] text-slate-400 font-medium leading-relaxed line-clamp-2">
                        {rule.description.substring(0, 200)}{rule.description.length > 200 ? '...' : ''}
                      </p>
                    )}
                  </div>
                  
                  {/* Status */}
                  <div className="w-24 shrink-0 text-right">
                    <span className={`inline-block text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded ${
                      rule.status === 'Compliant' ? 'text-emerald-500 bg-emerald-500/10' : 
                      rule.status === 'Open' ? 'text-rose-500 bg-rose-500/10' :
                      rule.status === 'Not Applicable' ? 'text-blue-400 bg-blue-400/10' :
                      rule.status === 'Error' ? 'text-amber-500 bg-amber-500/10' :
                      'text-slate-400 bg-slate-400/10'
                    }`}>
                      {rule.status}
                    </span>
                    {rule.lastChecked && (
                      <div className="text-[8px] text-slate-600 mt-1">
                        {new Date(rule.lastChecked).toLocaleTimeString()}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
            
            {filteredRules.length === 0 && (
              <div className="bg-[#121216] rounded-xl p-8 border border-slate-800/40 text-center">
                <p className="text-[10px] text-slate-400 font-medium">
                  No rules match the current filters.
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default AuditView;
