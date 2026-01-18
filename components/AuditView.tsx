/**
 * Audit View - STIG Compliance Management
 * Supports loading official DISA STIG files from a configured directory
 */

import React, { useState, useEffect, useCallback } from 'react';
import { stigService, StigBenchmark, StigRule, StigConfig } from '../services/stigService';
import { stateService } from '../services/stateService';
import { loggingService } from '../services/loggingService';
import { getElectronIpc } from '../types';

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

  useEffect(() => {
    setStats(stigService.getComplianceStats());
  }, [rules, benchmarks]);

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

  const handleConfigChange = (key: keyof StigConfig, value: string | boolean) => {
    const newConfig = { ...config, [key]: value };
    setConfig(newConfig);
    stigService.saveConfig({ [key]: value });
  };

  const handleBrowseDirectory = async () => {
    try {
      const ipc = getElectronIpc();
      if (ipc) {
        const result = await ipc.invoke('show-directory-dialog', {
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

  const handleViewBenchmark = (benchmarkId: string) => {
    setSelectedBenchmark(benchmarkId);
    const benchmark = benchmarks.find(b => b.id === benchmarkId);
    setRules(benchmark?.rules || []);
    setViewMode('rules');
  };

  const filteredRules = rules.filter(r => {
    if (filterSeverity !== 'all' && r.severity !== filterSeverity) return false;
    if (filterStatus !== 'all' && r.status !== filterStatus) return false;
    return true;
  });

  return (
    <div className="animate-fadeIn h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-3 bg-theme-card border border-theme-secondary rounded-lg mb-2 shrink-0">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-black text-theme-primary uppercase tracking-wide">STIG Compliance</h2>
          <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase border ${
            stats.rate >= 80 ? 'bg-emerald-600/10 text-emerald-400 border-emerald-500/30' : 
            stats.rate >= 50 ? 'bg-amber-600/10 text-amber-400 border-amber-500/30' : 
            'bg-rose-600/10 text-rose-400 border-rose-500/30'
          }`}>
            {stats.total > 0 ? `${stats.rate}% Compliant` : 'No STIGs'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {viewMode === 'rules' && (
            <button
              onClick={() => { setViewMode('overview'); setSelectedBenchmark(null); }}
              className="px-3 py-1.5 bg-theme-secondary text-theme-primary border border-theme-secondary rounded text-[10px] font-black uppercase hover:bg-theme-secondary/80"
            >
              Back
            </button>
          )}
          <button
            disabled={isRunningChecks}
            onClick={handleQuickCheck}
            className="px-3 py-1.5 bg-theme-secondary text-theme-primary border border-theme-secondary rounded text-[10px] font-black uppercase hover:bg-theme-secondary/80 disabled:opacity-50"
          >
            Quick Check
          </button>
          <button
            disabled={isExporting || stats.total === 0}
            onClick={handleExport}
            className="px-3 py-1.5 bg-blue-600 text-white rounded text-[10px] font-black uppercase hover:bg-blue-500 disabled:opacity-50"
          >
            {isExporting ? 'Exporting...' : 'Export CSV'}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col gap-2">
        {viewMode === 'overview' && (
          <>
            {/* Top Row: Config + Stats */}
            <div className="grid grid-cols-[1fr_auto] gap-2 shrink-0">
              {/* Configuration Panel */}
              <div className="bg-theme-card rounded-lg p-2 border border-theme-secondary">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={config.stigDirectory}
                    onChange={e => handleConfigChange('stigDirectory', e.target.value)}
                    placeholder="C:\STIG_Files"
                    className="flex-1 bg-theme-input border border-theme-secondary rounded px-2 py-1.5 text-xs text-theme-primary placeholder-theme-muted"
                  />
                  <button
                    onClick={handleBrowseDirectory}
                    className="px-2 py-1.5 bg-theme-secondary hover:bg-theme-secondary/80 text-theme-primary border border-theme-secondary rounded text-[10px] font-bold uppercase"
                  >
                    Browse
                  </button>
                  <button
                    disabled={isScanning}
                    onClick={handleScanDirectory}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-[10px] font-bold uppercase disabled:opacity-50"
                  >
                    {isScanning ? 'Scanning...' : 'Scan'}
                  </button>
                </div>
              </div>

              {/* Stats Row */}
              {stats.total > 0 && (
                <div className="flex gap-1">
                  {[
                    { label: 'Total', value: stats.total, color: 'text-theme-primary' },
                    { label: 'Pass', value: stats.compliant, color: 'text-emerald-400' },
                    { label: 'Open', value: stats.open, color: 'text-rose-400' },
                    { label: 'N/A', value: stats.notApplicable, color: 'text-blue-400' }
                  ].map(s => (
                    <div key={s.label} className="bg-theme-card rounded-lg px-3 py-1.5 border border-theme-secondary text-center min-w-[60px]">
                      <div className={`text-sm font-black ${s.color}`}>{s.value}</div>
                      <div className="text-[8px] font-bold text-theme-muted uppercase">{s.label}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Benchmarks Grid */}
            <div className="flex-1 min-h-0 bg-theme-card rounded-lg border border-theme-secondary overflow-hidden flex flex-col">
              <div className="px-3 py-2 border-b border-theme-secondary shrink-0">
                <h3 className="text-xs font-bold text-theme-muted uppercase">Loaded Benchmarks ({benchmarks.length})</h3>
              </div>
              
              <div className="flex-1 min-h-0 overflow-y-auto p-2">
                {benchmarks.length === 0 ? (
                  <div className="h-full flex items-center justify-center">
                    <div className="text-center">
                      <p className="text-sm text-theme-muted font-bold">No STIG files loaded</p>
                      <p className="text-xs text-theme-secondary mt-1">Configure directory and click Scan</p>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
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
                          className="bg-theme-input rounded-lg p-2 border border-theme-secondary hover:border-blue-500/30 transition-all cursor-pointer"
                          onClick={() => handleViewBenchmark(benchmark.id)}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <h4 className="text-xs font-bold text-theme-primary truncate flex-1 mr-2">{benchmark.title}</h4>
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              rate >= 80 ? 'bg-emerald-500/10 text-emerald-400' : 
                              rate >= 50 ? 'bg-amber-500/10 text-amber-400' : 
                              'bg-rose-500/10 text-rose-400'
                            }`}>
                              {rate}%
                            </span>
                          </div>
                          <div className="h-1 w-full bg-theme-secondary rounded-full overflow-hidden">
                            <div 
                              className={`h-full ${rate >= 80 ? 'bg-emerald-500' : rate >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`}
                              style={{ width: `${rate}%` }}
                            ></div>
                          </div>
                          <div className="flex items-center justify-between mt-1 text-[9px] font-bold text-theme-muted">
                            <span>{benchmark.ruleCount} rules</span>
                            <span className="text-emerald-400">{benchmarkStats.compliant} pass</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {viewMode === 'rules' && (
          <>
            {/* Filters Bar */}
            <div className="flex items-center gap-3 bg-theme-card rounded-lg p-2 border border-theme-secondary shrink-0">
              <div className="flex items-center gap-2">
                <label className="text-[10px] font-bold text-theme-muted uppercase">Severity:</label>
                <select
                  value={filterSeverity}
                  onChange={e => setFilterSeverity(e.target.value)}
                  className="bg-theme-input border border-theme-secondary rounded px-2 py-1 text-xs text-theme-primary"
                >
                  <option value="all">All</option>
                  <option value="CAT I">CAT I</option>
                  <option value="CAT II">CAT II</option>
                  <option value="CAT III">CAT III</option>
                </select>
              </div>
              
              <div className="flex items-center gap-2">
                <label className="text-[10px] font-bold text-theme-muted uppercase">Status:</label>
                <select
                  value={filterStatus}
                  onChange={e => setFilterStatus(e.target.value)}
                  className="bg-theme-input border border-theme-secondary rounded px-2 py-1 text-xs text-theme-primary"
                >
                  <option value="all">All</option>
                  <option value="Compliant">Compliant</option>
                  <option value="Open">Open</option>
                  <option value="Not Checked">Unchecked</option>
                </select>
              </div>

              <span className="text-[10px] text-theme-secondary">{filteredRules.length}/{rules.length}</span>

              <button
                disabled={isRunningChecks}
                onClick={handleRunChecks}
                className="ml-auto px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-[10px] font-bold uppercase disabled:opacity-50"
              >
                {isRunningChecks ? 'Running...' : 'Run Checks'}
              </button>
            </div>

            {/* Rules Table */}
            <div className="flex-1 min-h-0 bg-theme-card rounded-lg border border-theme-secondary overflow-hidden flex flex-col">
              {/* Table Header */}
              <div className="grid grid-cols-[60px_1fr_80px] gap-2 px-3 py-2 bg-theme-secondary/60 border-b border-theme-secondary shrink-0">
                <span className="text-xs font-bold text-theme-muted uppercase">Severity</span>
                <span className="text-xs font-bold text-theme-muted uppercase">Rule</span>
                <span className="text-xs font-bold text-theme-muted uppercase text-right">Status</span>
              </div>
              
              {/* Rules Rows */}
              <div className="flex-1 min-h-0 overflow-y-auto">
                {filteredRules.map((rule, idx) => (
                  <div 
                    key={`${rule.stigId}-${rule.id}`} 
                    className={`grid grid-cols-[60px_1fr_80px] gap-2 px-3 py-2 items-center border-b border-theme-secondary hover:bg-blue-600/5 ${idx % 2 === 1 ? 'bg-theme-secondary/10' : ''}`}
                  >
                    <span className={`text-[10px] font-bold uppercase text-center py-0.5 rounded ${
                      rule.severity === 'CAT I' ? 'bg-rose-500/10 text-rose-500' : 
                      rule.severity === 'CAT II' ? 'bg-amber-500/10 text-amber-500' : 
                      'bg-blue-500/10 text-blue-500'
                    }`}>
                      {rule.severity}
                    </span>
                    
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-blue-400">{rule.vulnId}</span>
                        <span className="text-sm text-theme-primary truncate">{rule.title}</span>
                      </div>
                    </div>
                    
                    <span className={`text-[10px] font-bold uppercase text-right ${
                      rule.status === 'Compliant' ? 'text-emerald-500' : 
                      rule.status === 'Open' ? 'text-rose-500' :
                      'text-theme-muted'
                    }`}>
                      {rule.status === 'Not Checked' ? 'Unchecked' : rule.status}
                    </span>
                  </div>
                ))}
                
                {filteredRules.length === 0 && (
                  <div className="p-6 text-center text-theme-muted text-sm">
                    No rules match filters
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default React.memo(AuditView);
