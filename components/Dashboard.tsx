
import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, AreaChart, Area } from 'recharts';
import { EnvironmentStats } from '../types';
import { useResourceMonitoring } from '../hooks/useResourceMonitoring';
import { useThroughputData } from '../hooks/useThroughputData';
import { useDiagnostics } from '../hooks/useDiagnostics';
import { calculateDatabaseUsagePercentage } from '../utils/calculations';
import { getDatabaseUsageColor } from '../utils/statusHelpers';
import { formatPercentage, formatGB } from '../utils/formatters';
import { generatePieChartData } from '../utils/chartHelpers';
import { DASHBOARD_CONSTANTS } from '../utils/dashboardConstants';

const DATABASE_WARNING_THRESHOLD = 80;

interface DashboardProps {
  stats: EnvironmentStats;
}

const Dashboard: React.FC<DashboardProps> = ({ stats }) => {
  const resources = useResourceMonitoring();
  const throughputData = useThroughputData();
  const { isDiagnosing, runDiagnostics } = useDiagnostics();

  const pieData = useMemo(() => generatePieChartData(stats), [
    stats.healthyComputers,
    stats.warningComputers,
    stats.criticalComputers,
    stats
  ]);

  const dbPercentage = useMemo(
    () => calculateDatabaseUsagePercentage(stats.db.currentSizeGB, stats.db.maxSizeGB),
    [stats.db.currentSizeGB, stats.db.maxSizeGB]
  );

  const dbUsageColor = useMemo(() => getDatabaseUsageColor(dbPercentage), [dbPercentage]);

  // Check if WSUS is connected - don't require computers to be present
  const isConnected = stats.isInstalled;

  return (
    <div className="space-y-4 animate-fadeIn pb-8">
      {/* Top Banner - Compact */}
      <div className={`rounded-xl p-4 border flex items-center justify-between relative overflow-hidden shadow-xl ${isConnected ? 'bg-[#121216] border-slate-800/40' : 'bg-rose-900/10 border-rose-500/20'}`}>
         <div className="flex items-center gap-3 relative z-10">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isConnected ? 'bg-blue-600/10 border border-blue-600/20 text-blue-500' : 'bg-rose-500/10 border border-rose-500/20 text-rose-500'}`}>
               <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            </div>
            <div>
               <h3 className="text-xs font-black tracking-widest uppercase text-white">Environment Integrity</h3>
               <p className={`text-[10px] font-bold uppercase mt-0.5 ${isConnected ? 'text-slate-300' : 'text-rose-400'}`}>
                 {isConnected ? 'Infrastructure operational' : 'WSUS not connected'}
               </p>
            </div>
         </div>
         <div className="flex items-center gap-4 relative z-10">
            <div className="flex items-center gap-6 pr-4 border-r border-slate-800">
                <div className="text-right">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">CPU</p>
                    <p className="text-sm font-black text-white mono">{resources.cpu}%</p>
                </div>
                <div className="text-right">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">RAM</p>
                    <p className="text-sm font-black text-white mono">{formatPercentage(resources.ram)}</p>
                </div>
            </div>
            <div className={`px-3 py-1.5 rounded-lg border ${isConnected ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-rose-500/10 border-rose-500/20'}`}>
               <span className={`text-[10px] font-black uppercase tracking-wider ${isConnected ? 'text-emerald-500' : 'text-rose-500'}`}>
                 {isConnected ? 'Stable' : 'Offline'}
               </span>
            </div>
         </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
         <StatCard label="Total Nodes" value={stats.totalComputers} color="blue" />

         {/* DB Card */}
         <div className="bg-[#121216] p-3 rounded-lg border border-slate-800/40 shadow-lg group hover:border-blue-500/30 transition-all">
            <div className="flex justify-between items-start mb-0.5">
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">DB Usage</p>
               <span className={`text-[10px] font-black uppercase ${dbPercentage > DATABASE_WARNING_THRESHOLD ? 'text-rose-500' : 'text-amber-500'}`}>
                  {formatPercentage(dbPercentage)}
               </span>
            </div>
            <p className="text-lg font-black tracking-tight text-white">{formatGB(stats.db.currentSizeGB, 0)} <span className="text-[10px] text-slate-400 font-bold uppercase">/ {formatGB(stats.db.maxSizeGB, 0)}</span></p>
            <div className="mt-2 h-1 w-full bg-slate-900 rounded-full overflow-hidden">
               <div
                  className={`h-full transition-all duration-1000 ${dbUsageColor}`}
                  style={{ width: `${dbPercentage}%` }}
               ></div>
            </div>
         </div>

         <StatCard label="Storage" value={formatGB(stats.diskFreeGB)} color="slate" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-[#121216] rounded-xl p-5 border border-slate-800/40 relative shadow-xl">
            <div className="flex justify-between items-center mb-4">
               <div>
                  <h3 className="text-xs font-black text-white uppercase tracking-widest">Topology Compliance</h3>
                  <p className="text-[10px] font-bold text-slate-400 mt-0.5 uppercase">Distribution of Node Health</p>
               </div>
            </div>
            {stats.totalComputers === 0 ? (
              <div className="h-[160px] w-full flex items-center justify-center">
                <div className="text-center">
                  <p className="text-sm font-black text-slate-400 uppercase tracking-widest mb-1">No Data Available</p>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">Connect to WSUS server to view topology</p>
                </div>
              </div>
            ) : (
              <div className="h-[160px] w-full flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie 
                      data={pieData} 
                      cx="50%" 
                      cy="50%" 
                      innerRadius={50} 
                      outerRadius={70} 
                      paddingAngle={DASHBOARD_CONSTANTS.PIE_CHART_PADDING_ANGLE} 
                      dataKey="value" 
                      stroke="none"
                    >
                      {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: '#121216', border: '1px solid #1e293b', borderRadius: '8px', fontSize: '10px' }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute flex flex-col items-center">
                  <span className="text-2xl font-black text-white tracking-tighter">{stats.totalComputers}</span>
                  <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider">Nodes</span>
                </div>
              </div>
            )}
          </div>

          {/* Network Graph Simulation */}
          <div className="bg-[#121216] rounded-xl p-4 border border-slate-800/40 shadow-lg">
             <div className="flex justify-between items-center mb-3">
                <h3 className="text-xs font-black text-white uppercase tracking-widest">Network Throughput</h3>
                <span className="text-[10px] font-bold text-slate-400 mono uppercase tracking-tight">Active: {(throughputData[throughputData.length - 1]?.val || 0).toFixed(1)} Mbps</span>
             </div>
             <div className="h-20 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={throughputData}>
                    <Area type="monotone" dataKey="val" stroke="#2563eb" fill="#2563eb" fillOpacity={0.1} isAnimationActive={false} />
                  </AreaChart>
                </ResponsiveContainer>
             </div>
          </div>
        </div>

        <div className="bg-[#121216] rounded-xl p-5 border border-slate-800/40 flex flex-col shadow-xl">
           <h3 className="text-xs font-black text-white uppercase tracking-widest mb-1">Service Monitor</h3>
           <p className="text-[10px] font-bold text-slate-400 mb-4 uppercase">Live Runtime Heartbeat</p>
           <div className="space-y-2 flex-1">
              {stats.services.length === 0 ? (
                <div className="p-3 text-center">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">No service data available</p>
                </div>
              ) : (
                stats.services.map((s, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-black/40 rounded-lg border border-slate-800/30 group hover:border-blue-500/20 transition-all">
                    <div className="flex items-center gap-2">
                      <div className={`w-1.5 h-1.5 rounded-full ${s.status === 'Running' ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-rose-500 shadow-[0_0_8px_#ef4444]'}`}></div>
                      <span className="text-[10px] font-bold text-slate-300 uppercase tracking-tight">{s.name}</span>
                    </div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{s.status}</span>
                  </div>
                ))
              )}
           </div>
           <button 
            disabled={isDiagnosing}
            onClick={runDiagnostics}
            className={`w-full mt-4 py-3 border rounded-lg text-[10px] font-black uppercase tracking-widest transition-all shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-900 ${isDiagnosing ? 'bg-blue-600 text-white animate-pulse' : 'bg-slate-900 hover:bg-slate-800 border-slate-800/50 text-slate-300 hover:text-white'}`}
            aria-label="Run infrastructure diagnostics"
            aria-busy={isDiagnosing}
           >
              {isDiagnosing ? 'Diagnostics Active...' : 'Run Infrastructure Test'}
           </button>
        </div>
      </div>
    </div>
  );
};

interface StatCardProps {
  label: string;
  value: string | number;
  color: 'blue' | 'amber' | 'emerald' | 'slate';
}

const StatCard: React.FC<StatCardProps> = ({ label, value, color }) => {
  const colorMap: Record<string, string> = {
    blue: 'text-blue-500',
    amber: 'text-amber-500',
    emerald: 'text-emerald-500',
    slate: 'text-slate-400'
  };
  return (
    <div className="bg-[#121216] p-3 rounded-lg border border-slate-800/40 shadow-lg group hover:border-blue-500/20 transition-all">
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-0.5">{label}</p>
      <p className={`text-lg font-black tracking-tight ${colorMap[color]}`}>{value}</p>
    </div>
  );
};

export default Dashboard;
