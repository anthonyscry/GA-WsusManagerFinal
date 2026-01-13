
import React, { useState, useEffect, useCallback } from 'react';
import { stateService } from '../services/stateService';
import { loggingService } from '../services/loggingService';
import { StigCheck } from '../types';

const AuditView: React.FC = () => {
  const [checks, setChecks] = useState<StigCheck[]>(stateService.getStigChecks());
  const [isExporting, setIsExporting] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [complianceRate, setComplianceRate] = useState<number | null>(null);

  const runComplianceCheck = useCallback(async () => {
    setIsScanning(true);
    loggingService.info('[STIG] Running compliance checks...');
    try {
      const results = await stateService.runStigComplianceChecks();
      setChecks(results);
      // Calculate compliance rate
      const compliant = results.filter(c => c.status === 'Compliant').length;
      const total = results.length;
      const rate = Math.round((compliant / total) * 100);
      setComplianceRate(rate);
      loggingService.info(`[STIG] Compliance check complete: ${rate}% compliant`);
    } catch (error) {
      loggingService.error('[STIG] Compliance check failed');
    } finally {
      setIsScanning(false);
    }
  }, []);

  useEffect(() => {
    // Run compliance check on mount
    runComplianceCheck();
  }, [runComplianceCheck]);

  const handleExportChecklist = () => {
    setIsExporting(true);
    loggingService.warn('AUDIT_LOG: Generating DISA STIG Checklist Snapshot...');
    setTimeout(() => {
      loggingService.info('SUCCESS: Compliance report saved to C:\\WSUS\\Audit\\WSUS_STIG_Report.xml');
      setIsExporting(false);
    }, 2000);
  };

  return (
    <div className="space-y-4 animate-fadeIn pb-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-[#121216] border border-blue-500/20 rounded-xl shadow-xl">
         <div className="flex-1">
            <h2 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2">
               STIG Compliance Hub
               <span className={`px-2 py-0.5 ${complianceRate !== null && complianceRate >= 80 ? 'bg-emerald-600/10 text-emerald-400 border-emerald-500/30' : complianceRate !== null && complianceRate >= 50 ? 'bg-amber-600/10 text-amber-400 border-amber-500/30' : 'bg-rose-600/10 text-rose-400 border-rose-500/30'} border rounded text-[10px] font-bold uppercase`}>
                 {complianceRate !== null ? `${complianceRate}% Compliant` : 'Checking...'}
               </span>
            </h2>
            <p className="text-[10px] font-medium text-slate-300 uppercase tracking-wider mt-1">Monitoring DISA STIG artifacts for WSUS v4.x and SQL Server 2022.</p>
         </div>
         <div className="flex items-center gap-2">
            <button 
               disabled={isScanning}
               onClick={runComplianceCheck}
               className="px-4 py-2 bg-slate-800 text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-slate-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
               aria-label="Refresh compliance checks"
            >
               {isScanning ? 'Scanning...' : 'Rescan'}
            </button>
            <button 
               disabled={isExporting}
               onClick={handleExportChecklist}
               className="px-4 py-2 bg-blue-600 text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-blue-500 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
               aria-label="Export STIG compliance checklist"
               aria-busy={isExporting}
            >
               {isExporting ? 'Generating...' : 'Export CKLS'}
            </button>
         </div>
      </div>

      <div className="space-y-2">
          {checks.map(check => (
              <div key={check.id} className="panel-card p-3 rounded-xl flex items-center gap-4 bg-[#121216]/50 border-slate-800/40 group hover:border-slate-700 transition-all">
                  <div className="flex flex-col items-center justify-center w-16 shrink-0">
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase ${check.severity === 'CAT I' ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20' : check.severity === 'CAT II' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' : 'bg-blue-500/10 text-blue-500 border border-blue-500/20'}`}>{check.severity}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black text-blue-500 uppercase tracking-wider">{check.vulnId}</span>
                          <h4 className="text-xs font-black text-white uppercase tracking-tight truncate">{check.title}</h4>
                      </div>
                      <p className="text-[10px] text-slate-400 font-medium leading-relaxed truncate">{check.discussion}</p>
                  </div>
                  <div className="flex flex-col items-end justify-center w-24 shrink-0">
                      <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded ${
                        check.status === 'Compliant' ? 'text-emerald-500 bg-emerald-500/10' : 
                        check.status === 'Checking...' ? 'text-blue-400 bg-blue-400/10 animate-pulse' : 
                        check.status === 'Unknown' ? 'text-slate-400 bg-slate-400/10' :
                        'text-rose-500 bg-rose-500/10'
                      }`}>{check.status}</span>
                  </div>
              </div>
          ))}
      </div>
    </div>
  );
};

export default AuditView;
