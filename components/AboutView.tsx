
import React, { useState } from 'react';
import { Icons } from '../constants';

type AboutTab = 'overview' | 'specs';
type SpecsSubTab = 'build' | 'requirements';

const AboutView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AboutTab>('overview');
  const [specsSubTab, setSpecsSubTab] = useState<SpecsSubTab>('build');

  return (
    <div className="animate-fadeIn h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-3 bg-theme-card border border-theme-secondary rounded-lg mb-2 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <Icons.AppLogo className="w-4 h-4 text-white" />
          </div>
          <div>
            <h2 className="text-sm font-black text-theme-primary uppercase tracking-wide">WSUS Pro</h2>
            <p className="text-[10px] font-bold text-theme-muted uppercase">v3.8.6</p>
          </div>
        </div>
        <div className="flex items-center gap-1 p-1 bg-theme-input border border-theme-secondary rounded-lg">
          {([
            { id: 'overview', label: 'Overview' },
            { id: 'specs', label: 'Specs' }
          ] as const).map(tab => (
            <button 
              key={tab.id} 
              onClick={() => setActiveTab(tab.id)} 
              className={`px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wide transition-all ${activeTab === tab.id ? 'bg-blue-600 text-white' : 'text-theme-secondary hover:text-theme-primary hover:bg-theme-secondary/20'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {activeTab === 'overview' && (
          <div className="h-full flex flex-col gap-2">
            {/* Top Row: Mission + Developer */}
            <div className="grid grid-cols-[2fr_1fr] gap-2 shrink-0">
              {/* Mission */}
              <div className="p-3 rounded-lg bg-theme-card/50 border border-theme-secondary">
                <p className="text-sm text-theme-secondary leading-relaxed">
                  Specialized admin interface for high-security environments. Bridges WSUS management with 
                  air-gapped network requirements, providing unified control for SQL Express and W3SVC pipelines.
                </p>
              </div>
              {/* Developer */}
              <div className="p-3 rounded-lg bg-theme-card/50 border border-theme-secondary flex items-center gap-3">
                <div className="w-8 h-8 bg-theme-secondary border border-theme-secondary rounded flex items-center justify-center shrink-0">
                  <div className="w-4 h-4 bg-blue-600/20 rounded border border-blue-500/30 flex items-center justify-center">
                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-bold text-theme-primary">Tony Tran</h4>
                  <a href="mailto:tony.tran@ga-asi.com" className="text-[10px] font-bold text-blue-500 hover:text-blue-400">tony.tran@ga-asi.com</a>
                </div>
              </div>
            </div>

            {/* Capabilities Grid - 3x2 layout */}
            <div className="flex-1 min-h-0 p-3 rounded-lg bg-theme-card/50 border border-theme-secondary">
              <div className="grid grid-cols-3 grid-rows-2 gap-2 h-full">
                {[
                  { title: 'Metadata Cleanup', desc: 'Remove expired updates, superseded patches, and orphaned content from SUSDB to prevent database bloat.', icon: Icons.Maintenance },
                  { title: 'Air-Gap Sync', desc: 'Export and import update packages via removable media for isolated networks without internet access.', icon: Icons.Updates },
                  { title: 'Service Control', desc: 'Monitor and manage SQL Server, IIS, and WSUS services with one-click start, stop, and restart.', icon: Icons.Dashboard },
                  { title: 'Task Scheduler', desc: 'Configure automated maintenance tasks in Windows Task Scheduler with custom triggers and credentials.', icon: Icons.Automation },
                  { title: 'Real-time Telemetry', desc: 'Live dashboard showing update compliance, sync status, database health, and service states.', icon: Icons.Computers },
                  { title: 'STIG Compliance', desc: 'Parse DISA STIG XCCDF files and run automated compliance checks against security benchmarks.', icon: Icons.Audit }
                ].map(cap => (
                  <div key={cap.title} className="p-3 bg-theme-input rounded-lg border border-theme-secondary flex gap-3">
                    <div className="w-10 h-10 bg-blue-600/10 border border-blue-500/20 rounded-lg flex items-center justify-center shrink-0">
                      <cap.icon className="w-5 h-5 text-blue-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-bold text-theme-primary block mb-1">{cap.title}</span>
                      <span className="text-xs text-theme-muted leading-snug block">{cap.desc}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom Row: Quick Stats */}
            <div className="grid grid-cols-4 gap-2 shrink-0">
              {[
                { label: 'Objective', value: 'SUSDB Bloat Prevention' },
                { label: 'Compliance', value: 'STIG/RMF Auditing' },
                { label: 'Target DB', value: 'SQL Express 2022' },
                { label: 'Platform', value: 'GA-ASI Systems' }
              ].map(stat => (
                <div key={stat.label} className="p-2 bg-theme-card/50 rounded-lg border border-theme-secondary">
                  <span className="text-[9px] font-bold text-theme-muted uppercase block">{stat.label}</span>
                  <span className="text-xs font-bold text-theme-primary">{stat.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'specs' && (
          <div className="panel-card p-3 rounded-lg bg-theme-card/50 border-theme-secondary h-full overflow-hidden flex flex-col">
            {/* Sub-tabs */}
            <div className="flex items-center gap-2 mb-2 shrink-0">
              <h3 className="text-xs font-bold text-theme-muted uppercase">Specifications</h3>
              <div className="flex items-center gap-1 ml-auto p-0.5 bg-theme-input border border-theme-secondary rounded">
                <button 
                  onClick={() => setSpecsSubTab('build')} 
                  className={`px-3 py-1 rounded text-[10px] font-bold uppercase transition-all ${specsSubTab === 'build' ? 'bg-blue-600 text-white' : 'text-theme-secondary hover:text-theme-primary'}`}
                >
                  Build
                </button>
                <button 
                  onClick={() => setSpecsSubTab('requirements')} 
                  className={`px-3 py-1 rounded text-[10px] font-bold uppercase transition-all ${specsSubTab === 'requirements' ? 'bg-blue-600 text-white' : 'text-theme-secondary hover:text-theme-primary'}`}
                >
                  Requirements
                </button>
              </div>
            </div>

            {/* Specs Content */}
            <div className="flex-1 min-h-0 grid grid-cols-2 lg:grid-cols-4 gap-2 content-start">
              {(specsSubTab === 'build' ? [
                { label: 'Version', value: '3.8.6' },
                { label: 'Framework', value: 'React 19 + Electron 31' },
                { label: 'Build Tool', value: 'Vite 6.0' },
                { label: 'Runtime', value: 'Node.js 20 LTS' },
                { label: 'TypeScript', value: '5.7.2' },
                { label: 'Styling', value: 'Tailwind CSS 4.x' },
                { label: 'Architecture', value: 'Clean Architecture' },
                { label: 'Engine', value: 'PRO_INTEGRATOR_V5' }
              ] : [
                { label: 'OS', value: 'Windows Server 2016+' },
                { label: 'WSUS', value: 'WSUS 4.0+' },
                { label: 'SQL', value: 'SQL Express 2019/2022' },
                { label: 'Memory', value: '4GB RAM minimum' },
                { label: 'PowerShell', value: '5.1 or 7.x' },
                { label: 'Disk', value: '500MB free' },
                { label: '.NET', value: 'Framework 4.8+' },
                { label: 'Privileges', value: 'Administrator' }
              ]).map(spec => (
                <div key={spec.label} className="p-2 bg-theme-input rounded border border-theme-secondary">
                  <span className="text-[10px] font-bold text-theme-muted uppercase block">{spec.label}</span>
                  <span className="text-sm font-bold text-theme-primary">{spec.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default React.memo(AboutView);
