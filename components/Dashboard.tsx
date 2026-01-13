
import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';
import { EnvironmentStats } from '../types';
import { useResourceMonitoring } from '../hooks/useResourceMonitoring';
import { useThroughputData } from '../hooks/useThroughputData';
import { useComplianceTrends } from '../hooks/useComplianceTrends';
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
  const complianceTrends = useComplianceTrends(stats);
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

  const isConnected = stats.isInstalled && stats.totalComputers > 0;

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Top Banner */}
      <div className={`rounded-2xl p-6 border flex items-center justify-between relative overflow-hidden shadow-2xl ${isConnected ? 'bg-[#121216] border-slate-800/40' : 'bg-rose-900/10 border-rose-500/20'}`}>
         <div className="flex items-center gap-5 relative z-10">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isConnected ? 'bg-blue-600/10 border border-blue-600/20 text-blue-500' : 'bg-rose-500/10 border border-rose-500/20 text-rose-500'}`}>
               <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            </div>
            <div>
               <h3 className="text-sm font-black tracking-widest uppercase text-white">Environment Integrity</h3>
               <p className={`text-xs font-bold uppercase mt-1 ${isConnected ? 'text-slate-300' : 'text-rose-400'}`}>
                 {isConnected ? 'Infrastructure operational on portable runspace' : 'WSUS not connected - No data available'}
               </p>
            </div>
         </div>
         <div className="flex items-center gap-6 relative z-10">
            <div className="flex items-center gap-8 pr-6 border-r border-slate-800">
                <div className="text-right">
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest">CPU LOAD</p>
                    <p className="text-base font-black text-white mono">{resources.cpu}%</p>
                </div>
                <div className="text-right">
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest">RAM UTIL</p>
                    <p className="text-base font-black text-white mono">{formatPercentage(resources.ram)}</p>
                </div>
            </div>
            <div className={`px-4 py-2 rounded-lg border ${isConnected ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-rose-500/10 border-rose-500/20'}`}>
               <span className={`text-xs font-black uppercase tracking-widest ${isConnected ? 'text-emerald-500' : 'text-rose-500'}`}>
                 {isConnected ? 'System Stable' : 'Not Connected'}
               </span>
            </div>
         </div>
         <div className="absolute top-0 right-0 w-32 h-full bg-blue-600/5 rotate-12 translate-x-16"></div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
         <StatCard label="Total Nodes" value={stats.totalComputers} color="blue" />
         
         {/* DB Card */}
         <div className="bg-[#121216] p-5 rounded-xl border border-slate-800/40 shadow-lg group hover:border-blue-500/30 transition-all">
            <div className="flex justify-between items-start mb-1">
               <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Database Usage</p>
               <span className={`text-xs font-black uppercase ${dbPercentage > DATABASE_WARNING_THRESHOLD ? 'text-rose-500' : 'text-amber-500'}`}>
                  {formatPercentage(dbPercentage)}
               </span>
            </div>
            <p className="text-2xl font-black tracking-tight text-white">{formatGB(stats.db.currentSizeGB, 0)} <span className="text-xs text-slate-400 font-bold uppercase">/ {formatGB(stats.db.maxSizeGB, 0)}</span></p>
            <div className="mt-3 h-1 w-full bg-slate-900 rounded-full overflow-hidden">
               <div 
                  className={`h-full transition-all duration-1000 ${dbUsageColor}`} 
                  style={{ width: `${dbPercentage}%` }}
               ></div>
            </div>
         </div>

         <StatCard label="Compliance Rate" value={stats.totalComputers > 0 ? `${Math.round((stats.healthyComputers / stats.totalComputers) * 100)}%` : 'N/A'} color="emerald" />
         <StatCard label="Available Storage" value={formatGB(stats.diskFreeGB)} color="slate" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-[#121216] rounded-2xl p-8 border border-slate-800/40 relative shadow-2xl">
            <div className="flex justify-between items-center mb-10">
               <div>
                  <h3 className="text-sm font-black text-white uppercase tracking-widest">Topology Compliance</h3>
                  <p className="text-xs font-bold text-slate-400 mt-1 uppercase">Distribution of Node Health</p>
               </div>
            </div>
            {stats.totalComputers === 0 ? (
              <div className="h-[240px] w-full flex items-center justify-center">
                <div className="text-center">
                  <p className="text-base font-black text-slate-400 uppercase tracking-widest mb-2">No Data Available</p>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-tight">Connect to WSUS server to view topology</p>
                </div>
              </div>
            ) : (
              <div className="h-[240px] w-full flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie 
                      data={pieData} 
                      cx="50%" 
                      cy="50%" 
                      innerRadius={DASHBOARD_CONSTANTS.PIE_CHART_INNER_RADIUS} 
                      outerRadius={DASHBOARD_CONSTANTS.PIE_CHART_OUTER_RADIUS} 
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
                  <span className="text-3xl font-black text-white tracking-tighter">{stats.totalComputers}</span>
                  <span className="text-xs text-slate-400 font-black uppercase tracking-widest">Total Nodes</span>
                </div>
              </div>
            )}
          </div>

          {/* Compliance Trends Chart */}
          <div className="bg-[#121216] rounded-2xl p-6 border border-slate-800/40 shadow-lg">
             <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-sm font-black text-white uppercase tracking-widest">Compliance Trends</h3>
                  <p className="text-xs font-bold text-slate-400 mt-1 uppercase">30-Day Historical View</p>
                </div>
                {complianceTrends.length > 0 && (
                  <span className="text-xs font-bold text-emerald-500 mono uppercase tracking-tight">
                    Current: {complianceTrends[complianceTrends.length - 1]?.compliance || 0}%
                  </span>
                )}
             </div>
             {complianceTrends.length === 0 ? (
               <div className="h-48 w-full flex items-center justify-center">
                 <div className="text-center">
                   <p className="text-xs font-bold text-slate-400 uppercase tracking-tight">No trend data available</p>
                   <p className="text-xs text-slate-500 mt-1">Connect to WSUS to view compliance history</p>
                 </div>
               </div>
             ) : (
               <div className="h-48 w-full">
                 <ResponsiveContainer width="100%" height="100%">
                   <LineChart data={complianceTrends}>
                     <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                     <XAxis 
                       dataKey="date" 
                       stroke="#64748b"
                       tick={{ fill: '#64748b', fontSize: 9, fontWeight: 'bold' }}
                       interval="preserveStartEnd"
                     />
                     <YAxis 
                       domain={[0, 100]}
                       stroke="#64748b"
                       tick={{ fill: '#64748b', fontSize: 9, fontWeight: 'bold' }}
                       label={{ value: 'Compliance %', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 9 }}
                     />
                     <Tooltip 
                       contentStyle={{ 
                         backgroundColor: '#121216', 
                         border: '1px solid #1e293b', 
                         borderRadius: '8px',
                         fontSize: '10px',
                         padding: '8px'
                       }}
                       labelStyle={{ color: '#94a3b8', fontWeight: 'bold', fontSize: '9px' }}
                     />
                     <Line 
                       type="monotone" 
                       dataKey="compliance" 
                       stroke="#10b981" 
                       strokeWidth={2}
                       dot={{ fill: '#10b981', r: 3 }}
                       activeDot={{ r: 5 }}
                       name="Compliance %"
                     />
                   </LineChart>
                 </ResponsiveContainer>
               </div>
             )}
          </div>

          {/* Network Graph Simulation */}
          <div className="bg-[#121216] rounded-2xl p-6 border border-slate-800/40 shadow-lg">
             <div className="flex justify-between items-center mb-6">
                <h3 className="text-sm font-black text-white uppercase tracking-widest">Network Throughput</h3>
                <span className="text-xs font-bold text-slate-400 mono uppercase tracking-tight">Active Transfer: {(throughputData[throughputData.length - 1]?.val || 0).toFixed(1)} Mbps</span>
             </div>
             <div className="h-32 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={throughputData}>
                    <Area type="monotone" dataKey="val" stroke="#2563eb" fill="#2563eb" fillOpacity={0.1} isAnimationActive={false} />
                  </AreaChart>
                </ResponsiveContainer>
             </div>
          </div>
        </div>

        <div className="bg-[#121216] rounded-2xl p-8 border border-slate-800/40 flex flex-col h-full shadow-2xl">
           <h3 className="text-sm font-black text-white uppercase tracking-widest mb-2">Service Monitor</h3>
           <p className="text-xs font-bold text-slate-400 mb-8 uppercase">Live Runtime Heartbeat</p>
           <div className="space-y-3 flex-1">
              {stats.services.length === 0 ? (
                <div className="p-4 text-center">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-tight">No service data available</p>
                </div>
              ) : (
                stats.services.map((s, i) => (
                  <div key={i} className="flex items-center justify-between p-4 bg-black/40 rounded-xl border border-slate-800/30 group hover:border-blue-500/20 transition-all">
                    <div className="flex items-center gap-3">
                      <div className={`w-1.5 h-1.5 rounded-full ${s.status === 'Running' ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-rose-500 shadow-[0_0_8px_#ef4444]'}`}></div>
                      <span className="text-xs font-bold text-slate-300 uppercase tracking-tight">{s.name}</span>
                    </div>
                    <span className="text-xs font-black text-slate-400 uppercase tracking-widest">{s.status}</span>
                  </div>
                ))
              )}
           </div>
           <button 
            disabled={isDiagnosing}
            onClick={runDiagnostics}
            className={`w-full mt-6 py-4 border rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-900 ${isDiagnosing ? 'bg-blue-600 text-white animate-pulse' : 'bg-slate-900 hover:bg-slate-800 border-slate-800/50 text-slate-300 hover:text-white'}`}
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
    <div className="bg-[#121216] p-5 rounded-xl border border-slate-800/40 shadow-lg group hover:border-blue-500/20 transition-all">
      <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>
      <p className={`text-2xl font-black tracking-tight ${colorMap[color]}`}>{value}</p>
    </div>
  );
};

export default Dashboard;
