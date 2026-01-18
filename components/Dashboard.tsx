
import React, { useMemo, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts';
import { EnvironmentStats, ServiceState } from '../types';
import { useResourceMonitoring } from '../hooks/useResourceMonitoring';
import { useThroughputData } from '../hooks/useThroughputData';
import { useComplianceTrends } from '../hooks/useComplianceTrends';
import { useDiagnostics } from '../hooks/useDiagnostics';
import { useServiceControl } from '../hooks/useServiceControl';
import { calculateDatabaseUsagePercentage } from '../utils/calculations';
import { getDatabaseUsageColor } from '../utils/statusHelpers';
import { formatPercentage, formatGB } from '../utils/formatters';
import { generatePieChartData } from '../utils/chartHelpers';
import { DASHBOARD_CONSTANTS } from '../utils/dashboardConstants';

const DATABASE_WARNING_THRESHOLD = 80;

type DashboardTab = 'health' | 'trends' | 'services';

interface DashboardProps {
  stats: EnvironmentStats;
}

const Dashboard: React.FC<DashboardProps> = ({ stats }) => {
  const [activeTab, setActiveTab] = useState<DashboardTab>('health');
  const resources = useResourceMonitoring();
  const throughputData = useThroughputData();
  const complianceTrends = useComplianceTrends(stats);
  const { isDiagnosing, runDiagnostics } = useDiagnostics();
  const { startService, stopService, isControlling } = useServiceControl();

  const pieData = useMemo(
    () => generatePieChartData(stats),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stats.healthyComputers, stats.warningComputers, stats.criticalComputers]
  );

  const dbPercentage = useMemo(
    () => calculateDatabaseUsagePercentage(stats.db.currentSizeGB, stats.db.maxSizeGB),
    [stats.db.currentSizeGB, stats.db.maxSizeGB]
  );

  const dbUsageColor = useMemo(() => getDatabaseUsageColor(dbPercentage), [dbPercentage]);

  const isConnected = stats.isInstalled && stats.totalComputers > 0;

  return (
    <div className="h-full flex flex-col animate-fadeIn">
      {/* Top Stats Row - Always visible */}
      <div className="flex items-center gap-3 mb-3">
        {/* Status Badge */}
        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${isConnected ? 'bg-theme-card border-theme-secondary' : 'bg-rose-900/10 border-rose-500/20'}`}>
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`}></div>
          <span className={`text-xs font-bold uppercase ${isConnected ? 'text-emerald-500' : 'text-rose-500'}`}>
            {isConnected ? 'Online' : 'Offline'}
          </span>
        </div>

        {/* Quick Stats */}
        <div className="flex-1 grid grid-cols-6 gap-2">
          <QuickStat label="Nodes" value={stats.totalComputers} />
          <QuickStat label="Healthy" value={`${stats.totalComputers > 0 ? Math.round((stats.healthyComputers / stats.totalComputers) * 100) : 0}%`} color="emerald" />
          <QuickStat label="Warning" value={stats.warningComputers} color="amber" />
          <QuickStat label="Critical" value={stats.criticalComputers} color="rose" />
          <QuickStat label="CPU" value={`${resources.cpu}%`} />
          <QuickStat label="RAM" value={formatPercentage(resources.ram)} />
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex items-center gap-1 mb-3 bg-theme-card p-1 rounded-lg border border-theme-secondary w-fit">
        <TabButton active={activeTab === 'health'} onClick={() => setActiveTab('health')} label="Health" />
        <TabButton active={activeTab === 'trends'} onClick={() => setActiveTab('trends')} label="Trends" />
        <TabButton active={activeTab === 'services'} onClick={() => setActiveTab('services')} label="Services" />
      </div>

      {/* Tab Content - Fills remaining space */}
      <div className="flex-1 min-h-0">
        {activeTab === 'health' && (
          <div className="h-full grid grid-cols-3 gap-3">
            {/* Node Health Pie Chart */}
            <div className="col-span-2 bg-theme-card rounded-lg p-4 border border-theme-secondary flex flex-col">
              <h3 className="text-xs font-bold text-theme-primary uppercase tracking-wide mb-2">Node Health Distribution</h3>
              <div className="flex-1 min-h-0 flex items-center justify-center relative">
                {stats.totalComputers === 0 ? (
                  <div className="text-center">
                    <p className="text-sm font-bold text-theme-muted uppercase mb-1">No Data</p>
                    <p className="text-xs text-theme-muted">Connect to WSUS server</p>
                  </div>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie 
                          data={pieData} 
                          cx="50%" 
                          cy="50%" 
                          innerRadius="60%" 
                          outerRadius="85%" 
                          paddingAngle={DASHBOARD_CONSTANTS.PIE_CHART_PADDING_ANGLE} 
                          dataKey="value" 
                          stroke="none"
                        >
                          {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                        </Pie>
                        <Tooltip contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-secondary)', borderRadius: '6px', fontSize: '12px', color: 'var(--text-primary)' }} itemStyle={{ color: 'var(--text-primary)' }} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute flex flex-col items-center">
                      <span className="text-3xl font-bold text-theme-primary">{stats.totalComputers}</span>
                      <span className="text-xs text-theme-muted font-bold uppercase">Total</span>
                    </div>
                  </>
                )}
              </div>
              {/* Legend */}
              <div className="flex justify-center gap-6 mt-2 pt-2 border-t border-theme-secondary">
                <LegendItem color="bg-emerald-500" label="Healthy" value={stats.healthyComputers} />
                <LegendItem color="bg-amber-500" label="Warning" value={stats.warningComputers} />
                <LegendItem color="bg-rose-500" label="Critical" value={stats.criticalComputers} />
              </div>
            </div>

            {/* Database & Storage */}
            <div className="flex flex-col gap-3">
              {/* Database Usage */}
              <div className="bg-theme-card rounded-lg p-4 border border-theme-secondary flex-1">
                <h3 className="text-xs font-bold text-theme-primary uppercase tracking-wide mb-3">Database</h3>
                <div className="flex items-end justify-between mb-2">
                  <span className="text-2xl font-bold text-theme-primary">{formatGB(stats.db.currentSizeGB, 1)}</span>
                  <span className="text-xs text-theme-muted">/ {formatGB(stats.db.maxSizeGB, 0)}</span>
                </div>
                <div className="h-2 w-full bg-theme-secondary rounded-full overflow-hidden mb-2">
                  <div className={`h-full transition-all duration-1000 ${dbUsageColor}`} style={{ width: `${dbPercentage}%` }}></div>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-theme-muted">Usage</span>
                  <span className={`font-bold ${dbPercentage > DATABASE_WARNING_THRESHOLD ? 'text-rose-500' : 'text-amber-500'}`}>
                    {formatPercentage(dbPercentage)}
                  </span>
                </div>
              </div>

              {/* Storage */}
              <div className="bg-theme-card rounded-lg p-4 border border-theme-secondary flex-1">
                <h3 className="text-xs font-bold text-theme-primary uppercase tracking-wide mb-3">Storage</h3>
                <div className="flex items-end justify-between mb-2">
                  <span className="text-2xl font-bold text-theme-primary">{formatGB(stats.diskFreeGB, 0)}</span>
                  <span className="text-xs text-theme-muted">free</span>
                </div>
                <div className="text-xs text-theme-muted">
                  Instance: {stats.db.instanceName || 'N/A'}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'trends' && (
          <div className="h-full grid grid-cols-2 gap-3">
            {/* Compliance Trends */}
            <div className="bg-theme-card rounded-lg p-4 border border-theme-secondary flex flex-col">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-xs font-bold text-theme-primary uppercase tracking-wide">Compliance Trend</h3>
                {complianceTrends.length > 0 && (
                  <span className="text-sm font-bold text-emerald-500 mono">
                    {complianceTrends[complianceTrends.length - 1]?.compliance || 0}%
                  </span>
                )}
              </div>
              <div className="flex-1 min-h-0">
                {complianceTrends.length === 0 ? (
                  <div className="h-full flex items-center justify-center">
                    <p className="text-xs text-theme-muted">No trend data available</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={complianceTrends}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-secondary)" />
                      <XAxis dataKey="date" stroke="var(--text-muted)" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} interval="preserveStartEnd" />
                      <YAxis domain={[0, 100]} stroke="var(--text-muted)" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} width={30} />
                      <Tooltip contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-secondary)', borderRadius: '6px', fontSize: '12px', color: 'var(--text-primary)' }} itemStyle={{ color: 'var(--text-primary)' }} />
                      <Line type="monotone" dataKey="compliance" stroke="#10b981" strokeWidth={2} dot={{ r: 2 }} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Network Throughput */}
            <div className="bg-theme-card rounded-lg p-4 border border-theme-secondary flex flex-col">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-xs font-bold text-theme-primary uppercase tracking-wide">Network Throughput</h3>
                <span className="text-sm font-bold text-blue-500 mono">
                  {(throughputData[throughputData.length - 1]?.val || 0).toFixed(1)} Mbps
                </span>
              </div>
              <div className="flex-1 min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={throughputData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-secondary)" />
                    <XAxis dataKey="time" stroke="var(--text-muted)" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                    <YAxis stroke="var(--text-muted)" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} width={30} />
                    <Tooltip contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-secondary)', borderRadius: '6px', fontSize: '12px', color: 'var(--text-primary)' }} itemStyle={{ color: 'var(--text-primary)' }} />
                    <Area type="monotone" dataKey="val" stroke="#2563eb" fill="#2563eb" fillOpacity={0.2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'services' && (
          <div className="h-full grid grid-cols-2 gap-3">
            {/* Services List */}
            <div className="bg-theme-card rounded-lg p-4 border border-theme-secondary flex flex-col">
              <h3 className="text-xs font-bold text-theme-primary uppercase tracking-wide mb-3">Service Status</h3>
              <div className="flex-1 space-y-2 overflow-auto">
                {stats.services.length === 0 ? (
                  <div className="h-full flex items-center justify-center">
                    <p className="text-xs text-theme-muted">No services detected</p>
                  </div>
                ) : (
                  stats.services.map((s, i) => (
                    <ServiceRow 
                      key={i} 
                      service={s} 
                      onStart={() => startService(s.name)}
                      onStop={() => stopService(s.name)}
                      isControlling={isControlling === s.name}
                    />
                  ))
                )}
              </div>
              <button 
                disabled={isDiagnosing}
                onClick={runDiagnostics}
                className={`w-full mt-3 py-2.5 border rounded-lg text-xs font-bold uppercase tracking-wide transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDiagnosing ? 'bg-blue-600 text-white animate-pulse' : 'bg-theme-secondary hover:bg-theme-secondary/80 border-theme-secondary text-theme-secondary hover:text-theme-primary'}`}
              >
                {isDiagnosing ? 'Running Diagnostics...' : 'Run Diagnostics'}
              </button>
            </div>

            {/* System Info */}
            <div className="bg-theme-card rounded-lg p-4 border border-theme-secondary flex flex-col">
              <h3 className="text-xs font-bold text-theme-primary uppercase tracking-wide mb-3">System Information</h3>
              <div className="flex-1 space-y-3">
                <InfoRow label="WSUS Status" value={stats.isInstalled ? 'Installed' : 'Not Detected'} status={stats.isInstalled} />
                <InfoRow label="Total Updates" value={stats.totalUpdates.toString()} />
                <InfoRow label="Security Updates" value={stats.securityUpdatesCount.toString()} />
                <InfoRow label="Automation" value={stats.automationStatus} />
                <InfoRow label="Content Path" value={stats.db.contentPath || 'N/A'} />
                <InfoRow label="Last Backup" value={stats.db.lastBackup || 'Never'} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Helper Components
const QuickStat: React.FC<{ label: string; value: string | number; color?: string }> = ({ label, value, color }) => {
  const colorMap: Record<string, string> = {
    emerald: 'text-emerald-500',
    amber: 'text-amber-500',
    rose: 'text-rose-500',
  };
  const colorClass = color ? colorMap[color] || 'text-theme-primary' : 'text-theme-primary';
  return (
    <div className="bg-theme-card px-3 py-2 rounded-lg border border-theme-secondary">
      <p className="text-xs text-theme-muted font-medium">{label}</p>
      <p className={`text-sm font-bold ${colorClass}`}>{value}</p>
    </div>
  );
};

const TabButton: React.FC<{ active: boolean; onClick: () => void; label: string }> = ({ active, onClick, label }) => (
  <button
    onClick={onClick}
    className={`px-4 py-1.5 rounded-md text-xs font-bold uppercase tracking-wide transition-all ${
      active ? 'bg-blue-600 text-white' : 'text-theme-secondary hover:text-theme-primary hover:bg-theme-secondary/20'
    }`}
  >
    {label}
  </button>
);

const LegendItem: React.FC<{ color: string; label: string; value: number }> = ({ color, label, value }) => (
  <div className="flex items-center gap-2">
    <div className={`w-2.5 h-2.5 rounded-full ${color}`}></div>
    <span className="text-xs text-theme-muted">{label}:</span>
    <span className="text-xs font-bold text-theme-primary">{value}</span>
  </div>
);

const InfoRow: React.FC<{ label: string; value: string; status?: boolean }> = ({ label, value, status }) => (
  <div className="flex items-center justify-between p-2 bg-theme-input rounded border border-theme-secondary">
    <span className="text-xs text-theme-muted">{label}</span>
    <span className={`text-xs font-bold ${status !== undefined ? (status ? 'text-emerald-500' : 'text-rose-500') : 'text-theme-primary'}`}>
      {value}
    </span>
  </div>
);

interface ServiceRowProps {
  service: ServiceState;
  onStart: () => void;
  onStop: () => void;
  isControlling: boolean;
}

const ServiceRow: React.FC<ServiceRowProps> = ({ service, onStart, onStop, isControlling }) => {
  const isRunning = service.status === 'Running';
  const isStopped = service.status === 'Stopped';
  
  const handleClick = () => {
    if (isControlling) return;
    if (isStopped) {
      onStart();
    } else if (isRunning) {
      onStop();
    }
  };

  return (
    <div 
      className={`flex items-center justify-between p-3 bg-theme-input rounded-lg border transition-all ${
        isControlling 
          ? 'border-blue-500/50 bg-blue-500/10' 
          : isStopped 
            ? 'border-rose-500/30 hover:border-emerald-500/50 cursor-pointer hover:bg-emerald-500/5' 
            : 'border-theme-secondary hover:border-rose-500/50 cursor-pointer hover:bg-rose-500/5'
      }`}
      onClick={handleClick}
      title={isControlling ? 'Working...' : isStopped ? 'Click to start service' : 'Click to stop service'}
    >
      <div className="flex items-center gap-3">
        <div className={`w-2.5 h-2.5 rounded-full ${
          isControlling 
            ? 'bg-blue-500 animate-pulse' 
            : isRunning 
              ? 'bg-emerald-500 shadow-[0_0_6px_#10b981]' 
              : 'bg-rose-500 shadow-[0_0_6px_#ef4444]'
        }`}></div>
        <div>
          <span className="text-sm font-medium text-theme-primary block">{service.name}</span>
          <span className="text-xs text-theme-muted">Type: {service.type}</span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {isControlling ? (
          <span className="text-xs font-bold text-blue-500 animate-pulse">Working...</span>
        ) : (
          <>
            <span className={`text-xs font-bold uppercase px-2 py-1 rounded ${
              isRunning ? 'text-emerald-500 bg-emerald-500/10' : 'text-rose-500 bg-rose-500/10'
            }`}>
              {service.status}
            </span>
            {isStopped && (
              <span className="text-xs text-emerald-500 opacity-60">▶ Start</span>
            )}
            {isRunning && (
              <span className="text-xs text-rose-500 opacity-60">■ Stop</span>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default React.memo(Dashboard);
