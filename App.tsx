
import React, { useState, useEffect } from 'react';
import { Icons } from './constants';
import Dashboard from './components/Dashboard';
import ComputersTable from './components/ComputersTable';
import LogsView from './components/LogsView';
import MaintenanceView from './components/MaintenanceView';
import AutomationView from './components/AutomationView';
import AuditView from './components/AuditView';
import AboutView from './components/AboutView';
import JobOverlay from './components/JobOverlay';
import AIAssistant from './components/AIAssistant';
import { stateService } from './services/stateService';
import { loggingService } from './services/loggingService';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'computers' | 'maintenance' | 'automation' | 'logs' | 'audit' | 'help'>('dashboard');
  const [isAirGap, setIsAirGap] = useState(stateService.isAirGap());
  const [refreshTimer, setRefreshTimer] = useState(30);
  const [stats, setStats] = useState(stateService.getStats());
  const [computers, setComputers] = useState(stateService.getComputers());
  const [jobs, setJobs] = useState(stateService.getJobs());
  const [showTerminal, setShowTerminal] = useState(false);
  const [terminalInput, setTerminalInput] = useState('');

  useEffect(() => {
    loggingService.info('GA-WsusManager Command Center v3.9.0 Initialized');
    
    const unsubscribe = stateService.subscribe(() => {
      setStats({ ...stateService.getStats() });
      setComputers([...stateService.getComputers()]);
      setJobs([...stateService.getJobs()]);
      setIsAirGap(stateService.isAirGap());
    });

    const timer = setInterval(() => {
      setRefreshTimer(prev => {
        if (prev <= 1) {
          stateService.refreshTelemetry();
          return 30;
        }
        return prev - 1;
      });
    }, 1000);

    return () => { unsubscribe(); clearInterval(timer); };
  }, []);

  const handleCommand = (e: React.FormEvent) => {
    e.preventDefault();
    if (!terminalInput) return;
    stateService.processTerminalCommand(terminalInput);
    setTerminalInput('');
  };

  const toggleMode = () => {
    stateService.setAirGap(!isAirGap);
  };

  return (
    <div className="flex h-screen bg-[#0a0a0c] text-zinc-100 overflow-hidden font-sans select-none relative">
      <nav className="w-64 sidebar-navy border-r border-slate-800/40 flex flex-col z-50">
        <div className="p-8 pb-10 flex items-center gap-4">
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white shadow-xl p-2 transition-transform hover:rotate-3">
             <Icons.AppLogo className="w-full h-full" />
          </div>
          <div className="leading-tight">
            <span className="text-sm font-black tracking-widest text-white block uppercase mono">WSUS_PRO</span>
            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter">Lab Console</span>
          </div>
        </div>

        <div className="flex-1 px-3 space-y-1 overflow-y-auto scrollbar-hide">
          <NavItem active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<Icons.Dashboard className="w-4 h-4" />} label="Overview" />
          <NavItem active={activeTab === 'computers'} onClick={() => setActiveTab('computers')} icon={<Icons.Computers className="w-4 h-4" />} label="Inventory" />
          <NavItem active={activeTab === 'maintenance'} onClick={() => setActiveTab('maintenance')} icon={<Icons.Maintenance className="w-4 h-4" />} label="Operations" />
          <NavItem active={activeTab === 'automation'} onClick={() => setActiveTab('automation')} icon={<Icons.Automation className="w-4 h-4" />} label="Automation" />
          <NavItem active={activeTab === 'audit'} onClick={() => setActiveTab('audit')} icon={<Icons.Audit className="w-4 h-4" />} label="Auditing" />
          <div className="my-6 border-t border-slate-800/20 mx-4"></div>
          <NavItem active={activeTab === 'logs'} onClick={() => setActiveTab('logs')} icon={<Icons.Logs className="w-4 h-4" />} label="Full Logs" />
          <NavItem active={activeTab === 'help'} onClick={() => setActiveTab('help')} icon={<Icons.Help className="w-4 h-4" />} label="About" />
        </div>

        <button 
          onClick={() => setShowTerminal(!showTerminal)}
          className={`mx-4 mb-4 p-4 rounded-2xl border transition-all flex items-center justify-between ${showTerminal ? 'bg-blue-600/20 border-blue-500/40 text-blue-400' : 'bg-black/40 border-slate-800/40 text-slate-500 hover:border-slate-700'}`}
        >
          <div className="flex items-center gap-3">
            <div className={`w-1.5 h-1.5 rounded-full ${showTerminal ? 'bg-blue-400' : 'bg-slate-700'}`}></div>
            <span className="text-[10px] font-black uppercase tracking-widest">Live Terminal</span>
          </div>
          <Icons.Logs className="w-4 h-4" />
        </button>
      </nav>

      <main className="flex-1 flex flex-col overflow-hidden relative">
        <header className="h-16 bg-[#121216]/60 backdrop-blur-lg border-b border-slate-800/40 px-8 flex items-center justify-between z-40">
          <h1 className="text-xs font-black text-white uppercase tracking-[0.4em]">{activeTab}</h1>
          <div className="flex items-center gap-8">
             {/* Connection Mode Switcher */}
             <div className="flex items-center gap-4 px-4 py-2 bg-black/40 rounded-xl border border-slate-800">
                <span className={`text-[8px] font-black uppercase tracking-widest transition-colors ${isAirGap ? 'text-blue-500' : 'text-slate-600'}`}>Air-Gap</span>
                <button 
                  onClick={toggleMode}
                  className={`w-10 h-5 rounded-full relative transition-colors ${isAirGap ? 'bg-slate-800' : 'bg-blue-600'}`}
                >
                  <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${isAirGap ? 'left-1' : 'left-6 shadow-[0_0_8px_white]'}`}></div>
                </button>
                <span className={`text-[8px] font-black uppercase tracking-widest transition-colors ${!isAirGap ? 'text-blue-500' : 'text-slate-600'}`}>Cloud-Sync</span>
             </div>

             <div className="h-6 w-px bg-slate-800"></div>

             <div className="flex flex-col items-end">
                <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest">Cycle</span>
                <span className="text-[11px] font-black text-blue-500 mono">{refreshTimer}s</span>
             </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-10 bg-[#0a0a0c]">
          {activeTab === 'dashboard' && <Dashboard stats={stats} />}
          {activeTab === 'computers' && <ComputersTable computers={computers} />}
          {activeTab === 'maintenance' && <MaintenanceView isAirGap={isAirGap} />}
          {activeTab === 'automation' && <AutomationView />}
          {activeTab === 'audit' && <AuditView />}
          {activeTab === 'logs' && <LogsView />}
          {activeTab === 'help' && <AboutView />}
        </div>

        {/* Improved Terminal with Input */}
        <div className={`absolute bottom-0 left-0 right-0 bg-[#0a0a0c]/98 backdrop-blur-3xl border-t border-blue-500/20 transition-all duration-300 z-[60] flex flex-col ${showTerminal ? 'h-80' : 'h-0'}`}>
          {showTerminal && (
            <div className="h-full flex flex-col">
              <div className="px-6 py-3 border-b border-slate-800 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-4">
                   <span className="text-[9px] font-black text-blue-500 uppercase tracking-widest">Powershell Hub 7.4.x</span>
                   <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_5px_#10b981]"></div>
                </div>
                <button onClick={() => setShowTerminal(false)} className="text-slate-600 hover:text-white p-1 transition-colors">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <div className="flex-1 overflow-hidden">
                <LogsView hideHeader />
              </div>
              <form onSubmit={handleCommand} className="p-4 bg-black border-t border-slate-800 flex items-center gap-4">
                 <span className="text-blue-500 font-black text-xs mono shrink-0">PS C:\GA-ASI\WSUS&gt;</span>
                 <input 
                  autoFocus
                  type="text" 
                  value={terminalInput}
                  onChange={(e) => setTerminalInput(e.target.value)}
                  placeholder="Enter runspace command..."
                  className="bg-transparent border-none outline-none flex-1 text-zinc-300 font-mono text-xs font-bold"
                 />
              </form>
            </div>
          )}
        </div>
      </main>

      <JobOverlay jobs={jobs} />
      <AIAssistant />
    </div>
  );
};

const NavItem = ({ active, onClick, icon, label }: any) => (
  <button onClick={onClick} className={`w-full flex items-center gap-4 px-5 py-3.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${active ? 'bg-blue-600 text-white shadow-xl translate-x-1' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-900/40'}`}>
    {icon}{label}
  </button>
);

export default App;
