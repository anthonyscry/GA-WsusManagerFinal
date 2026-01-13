/**
 * Deployment Wizard Component
 * Guides user through automated WSUS server setup
 */

import React, { useState, useCallback } from 'react';
import { loggingService } from '../services/loggingService';
import { deploymentService, DeploymentConfig, DeploymentProgress } from '../services/deploymentService';

const MIN_PASSWORD_LENGTH = 15;

const validateSAPassword = (password: string): { valid: boolean; error?: string } => {
  if (!password || password.length < MIN_PASSWORD_LENGTH) {
    return { valid: false, error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` };
  }
  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password);
  
  if (!hasLower || !hasUpper || !hasNumber || !hasSpecial) {
    return { valid: false, error: 'Password must contain uppercase, lowercase, number, and special character' };
  }
  return { valid: true };
};

const DeploymentWizard: React.FC = () => {
  const [step, setStep] = useState<'config' | 'deploying' | 'complete' | 'error'>('config');
  const [config, setConfig] = useState<DeploymentConfig>({
    sqlExpressInstallerPath: '',
    ssmsInstallerPath: '',
    saPassword: '',
    instanceName: 'SQLEXPRESS',
    sqlDataPath: 'C:\\Program Files\\Microsoft SQL Server',
    wsusContentPath: 'C:\\WSUS'
  });
  const [progress, setProgress] = useState<DeploymentProgress>({
    step: 'idle',
    progress: 0,
    message: 'Ready to deploy'
  });
  const [passwordError, setPasswordError] = useState<string>('');

  const handleBrowse = async (field: 'sqlExpressInstallerPath' | 'ssmsInstallerPath') => {
    try {
      if (typeof window !== 'undefined' && (window as any).require) {
        const { ipcRenderer } = (window as any).require('electron');
        const result = await ipcRenderer.invoke('show-open-dialog', {
          title: field === 'sqlExpressInstallerPath' ? 'Select SQL Express Installer' : 'Select SSMS Installer',
          filters: [
            { name: 'Installer Files', extensions: ['exe', 'zip'] },
            { name: 'All Files', extensions: ['*'] }
          ],
          properties: ['openFile']
        });
        
        if (!result.canceled && result.filePaths.length > 0) {
          setConfig(c => ({ ...c, [field]: result.filePaths[0] }));
        }
      }
    } catch (error) {
      loggingService.error(`Failed to open file dialog: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleBrowseDirectory = async (field: 'sqlDataPath' | 'wsusContentPath') => {
    try {
      if (typeof window !== 'undefined' && (window as any).require) {
        const { ipcRenderer } = (window as any).require('electron');
        const result = await ipcRenderer.invoke('show-directory-dialog', {
          title: field === 'sqlDataPath' ? 'Select SQL Data Directory' : 'Select WSUS Content Directory',
          properties: ['openDirectory']
        });
        
        if (!result.canceled && result.filePaths.length > 0) {
          setConfig(c => ({ ...c, [field]: result.filePaths[0] }));
        }
      }
    } catch (error) {
      loggingService.error(`Failed to open directory dialog: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleStartDeployment = useCallback(async () => {
    // Validate
    if (!config.sqlExpressInstallerPath) {
      loggingService.error('[DEPLOY] SQL Express installer path is required');
      return;
    }
    if (!config.ssmsInstallerPath) {
      loggingService.error('[DEPLOY] SSMS installer path is required');
      return;
    }
    const passwordValidation = validateSAPassword(config.saPassword);
    if (!passwordValidation.valid) {
      setPasswordError(passwordValidation.error || 'Invalid password');
      return;
    }

    setStep('deploying');
    setPasswordError('');

    const success = await deploymentService.runFullDeployment(config, setProgress);

    if (success) {
      setStep('complete');
    } else {
      setStep('error');
    }
  }, [config]);

  const getStepIcon = (stepName: string, currentStep: string) => {
    const steps = ['sql-express', 'ssms', 'wsus-feature', 'wsus-config'];
    const currentIndex = steps.indexOf(currentStep);
    const stepIndex = steps.indexOf(stepName);
    
    if (currentStep === 'complete' || stepIndex < currentIndex) {
      return <span className="text-emerald-500">✓</span>;
    } else if (stepIndex === currentIndex) {
      return <span className="animate-pulse text-blue-500">●</span>;
    }
    return <span className="text-slate-600">○</span>;
  };

  return (
    <div className="space-y-4 animate-fadeIn pb-8">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-600/10 to-emerald-600/10 border border-blue-500/20 rounded-xl">
        <div>
          <h2 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2">
            🚀 WSUS Deployment Wizard
          </h2>
          <p className="text-[10px] font-medium text-slate-300 uppercase tracking-wider mt-0.5">
            Automated SQL Express + SSMS + WSUS Installation
          </p>
        </div>
        <div className="px-3 py-1.5 bg-blue-600/20 border border-blue-500/30 rounded-lg">
          <span className="text-[10px] font-black text-blue-400 uppercase tracking-wider">
            {step === 'config' ? 'Configure' : step === 'deploying' ? 'Deploying...' : step === 'complete' ? 'Complete' : 'Error'}
          </span>
        </div>
      </div>

      {step === 'config' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Configuration Form */}
          <div className="bg-[#121216] rounded-xl p-5 border border-slate-800/40 space-y-4">
            <h3 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
              Installer Files
            </h3>

            {/* SQL Express Installer */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                SQL Express 2022 Installer <span className="text-rose-500">*</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={config.sqlExpressInstallerPath}
                  onChange={e => setConfig(c => ({ ...c, sqlExpressInstallerPath: e.target.value }))}
                  placeholder="C:\Installers\SQLEXPR_x64_ENU.exe"
                  className="flex-1 bg-black/40 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={() => handleBrowse('sqlExpressInstallerPath')}
                  className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-[10px] font-black uppercase tracking-wider"
                >
                  Browse
                </button>
              </div>
            </div>

            {/* SSMS Installer */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                SSMS Installer <span className="text-rose-500">*</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={config.ssmsInstallerPath}
                  onChange={e => setConfig(c => ({ ...c, ssmsInstallerPath: e.target.value }))}
                  placeholder="C:\Installers\SSMS-Setup-ENU.exe"
                  className="flex-1 bg-black/40 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={() => handleBrowse('ssmsInstallerPath')}
                  className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-[10px] font-black uppercase tracking-wider"
                >
                  Browse
                </button>
              </div>
            </div>

            {/* SA Password */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                SQL SA Password <span className="text-rose-500">*</span>
              </label>
              <input
                type="password"
                value={config.saPassword}
                onChange={e => {
                  setConfig(c => ({ ...c, saPassword: e.target.value }));
                  setPasswordError('');
                }}
                placeholder="Strong password (15+ chars, mixed case, numbers, symbols)"
                className="w-full bg-black/40 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {passwordError && (
                <p className="text-[10px] text-rose-500 font-bold">{passwordError}</p>
              )}
            </div>
          </div>

          {/* Advanced Settings */}
          <div className="bg-[#121216] rounded-xl p-5 border border-slate-800/40 space-y-4">
            <h3 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
              Configuration
            </h3>

            {/* Instance Name */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                SQL Instance Name
              </label>
              <input
                type="text"
                value={config.instanceName}
                onChange={e => setConfig(c => ({ ...c, instanceName: e.target.value }))}
                className="w-full bg-black/40 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* SQL Data Path */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                SQL Data Directory
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={config.sqlDataPath}
                  onChange={e => setConfig(c => ({ ...c, sqlDataPath: e.target.value }))}
                  className="flex-1 bg-black/40 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={() => handleBrowseDirectory('sqlDataPath')}
                  className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-[10px] font-black uppercase tracking-wider"
                >
                  Browse
                </button>
              </div>
            </div>

            {/* WSUS Content Path */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                WSUS Content Directory
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={config.wsusContentPath}
                  onChange={e => setConfig(c => ({ ...c, wsusContentPath: e.target.value }))}
                  className="flex-1 bg-black/40 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={() => handleBrowseDirectory('wsusContentPath')}
                  className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-[10px] font-black uppercase tracking-wider"
                >
                  Browse
                </button>
              </div>
            </div>

            {/* What will be installed */}
            <div className="mt-4 p-3 bg-black/30 rounded-lg border border-slate-800/50">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">Deployment Steps:</p>
              <ol className="text-[10px] text-slate-300 space-y-1">
                <li>1. Install SQL Server Express 2022</li>
                <li>2. Install SQL Server Management Studio</li>
                <li>3. Install WSUS Windows Feature</li>
                <li>4. Configure WSUS with SQL Express backend</li>
                <li>5. Set initial sync configuration</li>
              </ol>
            </div>
          </div>
        </div>
      )}

      {step === 'deploying' && (
        <div className="bg-[#121216] rounded-xl p-6 border border-blue-500/20 space-y-6">
          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs font-black text-white uppercase tracking-widest">{progress.message}</span>
              <span className="text-xs font-bold text-blue-500 mono">{progress.progress}%</span>
            </div>
            <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden">
              <div 
                className="h-full bg-blue-600 transition-all duration-500"
                style={{ width: `${progress.progress}%` }}
              ></div>
            </div>
          </div>

          {/* Step Indicators */}
          <div className="grid grid-cols-4 gap-4">
            {[
              { id: 'sql-express', label: 'SQL Express' },
              { id: 'ssms', label: 'SSMS' },
              { id: 'wsus-feature', label: 'WSUS Feature' },
              { id: 'wsus-config', label: 'WSUS Config' }
            ].map(s => (
              <div key={s.id} className={`p-3 rounded-lg border ${progress.step === s.id ? 'bg-blue-600/10 border-blue-500/30' : 'bg-black/30 border-slate-800/50'}`}>
                <div className="flex items-center gap-2">
                  {getStepIcon(s.id, progress.step)}
                  <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider">{s.label}</span>
                </div>
              </div>
            ))}
          </div>

          <p className="text-[10px] text-slate-400 text-center">
            ⚠️ Do not close this window. Installation may take 15-30 minutes.
          </p>
        </div>
      )}

      {step === 'complete' && (
        <div className="bg-[#121216] rounded-xl p-6 border border-emerald-500/20 text-center space-y-4">
          <div className="w-16 h-16 mx-auto bg-emerald-500/10 rounded-full flex items-center justify-center">
            <span className="text-3xl">✓</span>
          </div>
          <h3 className="text-sm font-black text-emerald-500 uppercase tracking-widest">Deployment Complete!</h3>
          <p className="text-xs text-slate-300">
            SQL Express, SSMS, and WSUS have been installed and configured.
          </p>
          <div className="p-4 bg-black/30 rounded-lg border border-slate-800/50 text-left">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">Next Steps:</p>
            <ol className="text-[10px] text-slate-300 space-y-1">
              <li>1. Go to <span className="text-blue-400">Operations</span> → Run <span className="text-blue-400">Monthly Maintenance</span> to sync updates</li>
              <li>2. Wait for initial synchronization to complete (may take hours)</li>
              <li>3. Use <span className="text-blue-400">Export to Media</span> to transfer to air-gapped servers</li>
            </ol>
          </div>
          <button
            onClick={() => setStep('config')}
            className="px-6 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-[10px] font-black uppercase tracking-wider"
          >
            Done
          </button>
        </div>
      )}

      {step === 'error' && (
        <div className="bg-[#121216] rounded-xl p-6 border border-rose-500/20 text-center space-y-4">
          <div className="w-16 h-16 mx-auto bg-rose-500/10 rounded-full flex items-center justify-center">
            <span className="text-3xl">✕</span>
          </div>
          <h3 className="text-sm font-black text-rose-500 uppercase tracking-widest">Deployment Failed</h3>
          <p className="text-xs text-slate-300">{progress.error || 'An error occurred during deployment'}</p>
          <p className="text-[10px] text-slate-400">Check the logs for more details.</p>
          <button
            onClick={() => setStep('config')}
            className="px-6 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-[10px] font-black uppercase tracking-wider"
          >
            Back to Configuration
          </button>
        </div>
      )}

      {/* Start Button */}
      {step === 'config' && (
        <button
          onClick={handleStartDeployment}
          disabled={!config.sqlExpressInstallerPath || !config.ssmsInstallerPath || !config.saPassword}
          className="w-full py-4 bg-gradient-to-r from-blue-600 to-emerald-600 hover:from-blue-500 hover:to-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          🚀 Start Full Deployment
        </button>
      )}
    </div>
  );
};

export default DeploymentWizard;
