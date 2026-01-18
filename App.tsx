
import React, { useState, useEffect } from 'react';
import { Icons } from './constants';
import Dashboard from './components/Dashboard';
import ComputersTable from './components/ComputersTable';
import LogsView from './components/LogsView';
import MaintenanceView from './components/MaintenanceView';
import AutomationView from './components/AutomationView';
import AuditView from './components/AuditView';
import AboutView from './components/AboutView';
import DeploymentWizard from './components/DeploymentWizard';
import UpdatesView from './components/UpdatesView';
import GroupsView from './components/GroupsView';
import JobOverlay from './components/JobOverlay';
import ErrorBoundary from './components/ErrorBoundary';
import { ToastContainer } from './components/Toast';
import { useToast } from './hooks/useToast';
import { stateService } from './services/stateService';
import { loggingService } from './services/loggingService';
import { startConnectivityMonitoring, stopConnectivityMonitoring, checkConnectivityOnce } from './utils/connectivityChecker';
import { useStats, useComputers, useJobs, useRefreshTelemetry, useTerminalCommand } from './src/presentation/hooks';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';

const REFRESH_INTERVAL_SECONDS = 30;
const MAX_TERMINAL_INPUT_LENGTH = 1000;

interface NavItemProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  collapsed?: boolean;
}

const AppContent: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'computers' | 'updates' | 'groups' | 'maintenance' | 'automation' | 'logs' | 'audit' | 'setup' | 'help'>('dashboard');
  const [isAirGap, setIsAirGap] = useState(stateService.isAirGap());
  const [refreshTimer, setRefreshTimer] = useState(REFRESH_INTERVAL_SECONDS);
  const [showTerminal, setShowTerminal] = useState(false);
  const [terminalInput, setTerminalInput] = useState('');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { toasts, removeToast } = useToast();
  const { theme, toggleTheme } = useTheme();
  
  // Use new architecture hooks
  const { stats } = useStats();
  const { computers } = useComputers();
  const { jobs } = useJobs();
  const { refresh: refreshTelemetry } = useRefreshTelemetry();
  const { execute: executeTerminalCommand } = useTerminalCommand();

  useEffect(() => {
    loggingService.info('GA-WsusManager Command Center v3.9.0 Initialized');

    // Subscribe to StateService for air gap mode changes (temporary - will be migrated later)
    const unsubscribe = stateService.subscribe(() => {
      setIsAirGap(stateService.isAirGap());
    });

    // Check connectivity on startup and set mode automatically
    checkConnectivityOnce().then(isOnline => {
      loggingService.info(`[SYSTEM] Initial connectivity check: ${isOnline ? 'ONLINE' : 'OFFLINE'}`);
      stateService.setAirGapFromConnectivity(isOnline);
    });

    // Start connectivity monitoring
    const handleConnectivityChange = (isOnline: boolean) => {
      stateService.setAirGapFromConnectivity(isOnline);
    };
    startConnectivityMonitoring(handleConnectivityChange);

    // Auto-refresh timer using new architecture
    const timer = setInterval(() => {
      setRefreshTimer(prev => {
        if (prev <= 1) {
          refreshTelemetry().catch(err => {
            const errorMessage = err instanceof Error ? err.message : 'Unknown error';
            loggingService.error(`Failed to refresh telemetry: ${errorMessage}`);
          });
          return REFRESH_INTERVAL_SECONDS;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      unsubscribe();
      clearInterval(timer);
      stopConnectivityMonitoring(handleConnectivityChange);
    };
  }, [refreshTelemetry]);

  const handleCommand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!terminalInput) return;
    await executeTerminalCommand(terminalInput);
    setTerminalInput('');
  };

  const toggleMode = async () => {
    // Manual override - temporarily disable automatic switching
    // Note: Automatic switching will resume on next connectivity check
    if (!isAirGap) {
      // Manually switching to air-gap
      loggingService.info('[SYSTEM] Manual override: Switching to AIR-GAP mode');
      stateService.setAirGap(true);
    } else {
      // Manually switching to cloud-sync - check connectivity first
      const isOnline = await checkConnectivityOnce();
      if (!isOnline) {
        loggingService.warn('[SYSTEM] Cannot switch to Cloud-Sync mode - no internet connection detected');
        return;
      }
      loggingService.info('[SYSTEM] Manual override: Switching to CLOUD-SYNC mode');
      stateService.setAirGap(false);
    }
  };

  return (
    <ErrorBoundary>
      <div className="flex h-screen bg-theme-primary text-theme-primary overflow-hidden font-sans select-none relative">
      {/* Collapsible Sidebar */}
      <nav className={`${sidebarCollapsed ? 'w-16' : 'w-52'} sidebar-navy border-r border-theme-secondary flex flex-col z-50 transition-all duration-300`}>
        <div className={`p-4 ${sidebarCollapsed ? 'px-3' : 'px-4'} pb-6 flex items-center gap-3`}>
          <button 
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center text-white shadow-xl p-2 transition-transform hover:rotate-3 shrink-0"
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
             <Icons.AppLogo className="w-full h-full" />
          </button>
          {!sidebarCollapsed && (
            <div className="leading-tight overflow-hidden">
              <span className="text-sm font-black tracking-wider text-theme-primary block uppercase mono">WSUS_PRO</span>
              <span className="text-xs font-bold text-theme-secondary uppercase tracking-tight">Console</span>
            </div>
          )}
        </div>

        <div className="flex-1 px-2 pt-2 space-y-1 overflow-y-auto scrollbar-hide">
          <NavItem active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<Icons.Dashboard className="w-4 h-4" />} label="Overview" collapsed={sidebarCollapsed} />
          <NavItem active={activeTab === 'setup'} onClick={() => setActiveTab('setup')} icon={<Icons.Updates className="w-4 h-4" />} label="Deploy" collapsed={sidebarCollapsed} />
          <NavItem active={activeTab === 'computers'} onClick={() => setActiveTab('computers')} icon={<Icons.Computers className="w-4 h-4" />} label="Inventory" collapsed={sidebarCollapsed} />
          <NavItem active={activeTab === 'updates'} onClick={() => setActiveTab('updates')} icon={<Icons.Updates className="w-4 h-4" />} label="Updates" collapsed={sidebarCollapsed} />
          <NavItem active={activeTab === 'groups'} onClick={() => setActiveTab('groups')} icon={<Icons.Computers className="w-4 h-4" />} label="Groups" collapsed={sidebarCollapsed} />
          <NavItem active={activeTab === 'maintenance'} onClick={() => setActiveTab('maintenance')} icon={<Icons.Maintenance className="w-4 h-4" />} label="Operations" collapsed={sidebarCollapsed} />
          <NavItem active={activeTab === 'automation'} onClick={() => setActiveTab('automation')} icon={<Icons.Automation className="w-4 h-4" />} label="Automation" collapsed={sidebarCollapsed} />
          <NavItem active={activeTab === 'audit'} onClick={() => setActiveTab('audit')} icon={<Icons.Audit className="w-4 h-4" />} label="Auditing" collapsed={sidebarCollapsed} />
          <div className="my-4 border-t border-theme-secondary mx-2"></div>
          <NavItem active={activeTab === 'logs'} onClick={() => setActiveTab('logs')} icon={<Icons.Logs className="w-4 h-4" />} label="Logs" collapsed={sidebarCollapsed} />
          <NavItem active={activeTab === 'help'} onClick={() => setActiveTab('help')} icon={<Icons.Help className="w-4 h-4" />} label="About" collapsed={sidebarCollapsed} />
        </div>

        <button 
          onClick={() => setShowTerminal(!showTerminal)}
          className={`mx-2 mb-3 p-3 rounded-xl border transition-all flex items-center ${sidebarCollapsed ? 'justify-center' : 'justify-between'} ${showTerminal ? 'bg-blue-600/20 border-blue-500/40 text-blue-400' : 'bg-theme-input border-theme-secondary text-theme-secondary hover:border-theme'}`}
          title="Toggle Terminal"
        >
            {!sidebarCollapsed && (
              <div className="flex items-center gap-2">
                <div className={`w-1.5 h-1.5 rounded-full ${showTerminal ? 'bg-blue-400' : 'bg-theme-muted'}`}></div>
                <span className="text-xs font-bold uppercase tracking-wider">Terminal</span>
              </div>
            )}
          <Icons.Logs className="w-4 h-4" />
        </button>
      </nav>

      <main className="flex-1 flex flex-col overflow-hidden relative">
        <header className="h-14 bg-theme-card/60 backdrop-blur-lg border-b border-theme-secondary px-6 flex items-center justify-between z-40">
          <h1 className="text-sm font-black text-theme-primary uppercase tracking-widest">{activeTab}</h1>
          <div className="flex items-center gap-4">
             {/* Connection Mode Switcher - Compact */}
             <div className="flex items-center gap-3 px-3 py-1.5 bg-theme-input rounded-lg border border-theme">
                <span className={`text-xs font-bold uppercase tracking-wide transition-colors ${isAirGap ? 'text-blue-500' : 'text-theme-secondary'}`}>Air-Gap</span>
                <button 
                  onClick={toggleMode}
                  className={`w-9 h-5 rounded-full relative transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${isAirGap ? 'bg-theme-tertiary' : 'bg-blue-600'}`}
                  title="Auto mode: Switches based on connectivity"
                  aria-label="Toggle connection mode"
                >
                  <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${isAirGap ? 'left-1' : 'left-5'}`}></div>
                </button>
                <span className={`text-xs font-bold uppercase tracking-wide transition-colors ${!isAirGap ? 'text-blue-500' : 'text-theme-secondary'}`}>Cloud</span>
             </div>

             <div className="flex items-center gap-2 px-3 py-1.5 bg-theme-input rounded-lg border border-theme">
                 <span className="text-xs font-bold text-theme-secondary uppercase">Next:</span>
                 <span className="text-sm font-black text-blue-500 mono">{refreshTimer}s</span>
              </div>

              {/* Theme Toggle */}
              <button
                onClick={toggleTheme}
                className="p-2 bg-theme-input rounded-lg border border-theme hover:border-blue-500/50 transition-all"
                title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
                aria-label="Toggle theme"
              >
                {theme === 'dark' ? (
                  <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                )}
              </button>
           </div>
        </header>

        <div className="flex-1 overflow-hidden p-4 bg-theme-primary flex flex-col">
          <div className="flex-1 min-h-0 overflow-hidden">
            {activeTab === 'dashboard' && <Dashboard stats={stats} />}
            {activeTab === 'setup' && <DeploymentWizard />}
            {activeTab === 'computers' && <ComputersTable computers={computers} />}
            {activeTab === 'updates' && <UpdatesView />}
            {activeTab === 'groups' && <GroupsView />}
            {activeTab === 'maintenance' && <MaintenanceView isAirGap={isAirGap} />}
            {activeTab === 'automation' && <AutomationView />}
            {activeTab === 'audit' && <AuditView />}
            {activeTab === 'logs' && <LogsView />}
            {activeTab === 'help' && <AboutView />}
          </div>
        </div>

        {/* Improved Terminal with Input */}
        <div className={`absolute bottom-0 left-0 right-0 bg-theme-primary/98 backdrop-blur-3xl border-t border-blue-500/20 transition-all duration-300 z-[60] flex flex-col ${showTerminal ? 'h-80' : 'h-0'}`}>
          {showTerminal && (
            <div className="h-full flex flex-col">
              <div className="px-6 py-3 border-b border-theme flex justify-between items-center shrink-0">
                <div className="flex items-center gap-4">
                   <span className="text-[9px] font-black text-blue-500 uppercase tracking-widest">Powershell Hub 7.4.x</span>
                   <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_5px_#10b981]"></div>
                </div>
                <button onClick={() => setShowTerminal(false)} className="text-theme-muted hover:text-theme-primary p-1 transition-colors">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <div className="flex-1 overflow-hidden">
                <LogsView hideHeader />
              </div>
              <form onSubmit={handleCommand} className="p-4 bg-theme-primary border-t border-theme flex items-center gap-4">
                 <span className="text-blue-500 font-black text-xs mono shrink-0">PS C:\GA-ASI\WSUS&gt;</span>
                 <input 
                  autoFocus
                  type="text" 
                  maxLength={MAX_TERMINAL_INPUT_LENGTH}
                  value={terminalInput}
                  onChange={(e) => {
                    if (e.target.value.length <= MAX_TERMINAL_INPUT_LENGTH) {
                      setTerminalInput(e.target.value);
                    }
                  }}
                  placeholder="Enter runspace command..."
                  className="bg-transparent border-none outline-none flex-1 text-theme-secondary font-mono text-xs font-bold"
                  aria-label="Terminal command input"
                />
              </form>
            </div>
          )}
        </div>
      </main>

      <JobOverlay jobs={jobs} />
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      </div>
    </ErrorBoundary>
  );
};

const NavItem: React.FC<NavItemProps> = ({ active, onClick, icon, label, collapsed }) => (
  <button 
    onClick={onClick} 
    className={`w-full flex items-center ${collapsed ? 'justify-center px-2' : 'gap-3 px-4'} py-2.5 rounded-lg text-xs font-bold uppercase tracking-wide transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 ${active ? 'bg-blue-600 text-white shadow-lg' : 'text-theme-secondary hover:text-theme-primary hover:bg-theme-secondary/20'}`}
    aria-label={`Navigate to ${label}`}
    aria-current={active ? 'page' : undefined}
    title={collapsed ? label : undefined}
  >
    <span className="shrink-0 w-4 h-4 flex items-center justify-center">{icon}</span>
    {!collapsed && <span>{label}</span>}
  </button>
);

// Wrap with ThemeProvider
const App: React.FC = () => (
  <ThemeProvider>
    <AppContent />
  </ThemeProvider>
);

export default App;
