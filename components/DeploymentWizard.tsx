/**
 * Deployment Wizard Component
 * Guides user through automated WSUS server setup
 */

import React, { useState, useCallback } from 'react';
import { loggingService } from '../services/loggingService';
import { deploymentService, DeploymentConfig, DeploymentProgress } from '../services/deploymentService';
import { getElectronIpc } from '../types';

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
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [demoMode, setDemoMode] = useState(false);

  // Demo mode - cycles through deployment steps to show the UI
  const runDemo = () => {
    setDemoMode(true);
    setStep('deploying');
    const steps = [
      { step: 'sql-express', progress: 10, message: 'Installing SQL Express...' },
      { step: 'sql-express', progress: 25, message: 'Configuring SQL Express...' },
      { step: 'ssms', progress: 40, message: 'Installing SSMS...' },
      { step: 'ssms', progress: 55, message: 'Configuring SSMS...' },
      { step: 'wsus-feature', progress: 70, message: 'Installing WSUS Feature...' },
      { step: 'wsus-config', progress: 85, message: 'Configuring WSUS...' },
      { step: 'complete', progress: 100, message: 'Deployment complete!' },
    ];
    let i = 0;
    const interval = setInterval(() => {
      if (i < steps.length) {
        setProgress(steps[i] as DeploymentProgress);
        i++;
      } else {
        clearInterval(interval);
        setTimeout(() => {
          setStep('complete');
          setTimeout(() => {
            setStep('config');
            setDemoMode(false);
            setProgress({ step: 'idle', progress: 0, message: 'Ready to deploy' });
          }, 2000);
        }, 1000);
      }
    }, 1500);
  };

  const handleBrowse = async (field: 'sqlExpressInstallerPath' | 'ssmsInstallerPath') => {
    try {
      const ipc = getElectronIpc();
      if (ipc) {
        const result = await ipc.invoke('show-open-dialog', {
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
      const ipc = getElectronIpc();
      if (ipc) {
        const result = await ipc.invoke('show-directory-dialog', {
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
    if (!config.sqlExpressInstallerPath) {
      loggingService.error('[DEPLOY] SQL Express installer path is required');
      return;
    }
    if (!config.ssmsInstallerPath) {
      loggingService.error('[DEPLOY] SSMS installer path is required');
      return;
    }
    if (config.saPassword !== confirmPassword) {
      setPasswordError('Passwords do not match');
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
  }, [config, confirmPassword]);

  const getStepStatus = (stepName: string, currentStep: string) => {
    const steps = ['sql-express', 'ssms', 'wsus-feature', 'wsus-config'];
    const currentIndex = steps.indexOf(currentStep);
    const stepIndex = steps.indexOf(stepName);
    
    if (currentStep === 'complete' || stepIndex < currentIndex) return 'complete';
    if (stepIndex === currentIndex) return 'active';
    return 'pending';
  };

  const isFormValid = config.sqlExpressInstallerPath && config.ssmsInstallerPath && config.saPassword && confirmPassword;

  return (
    <div className="h-full flex flex-col animate-fadeIn">
      {/* Compact Header */}
      <div className="flex items-center justify-between p-3 bg-gradient-to-r from-blue-600/10 to-emerald-600/10 border border-blue-500/20 rounded-lg mb-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600/20 rounded-lg flex items-center justify-center">
            <span className="text-sm">🚀</span>
          </div>
          <div>
            <h2 className="text-xs font-bold text-theme-primary uppercase tracking-wide">WSUS Deployment</h2>
            <p className="text-xs text-theme-secondary">SQL Express + SSMS + WSUS</p>
          </div>
        </div>
        <div className={`px-2 py-1 rounded text-xs font-bold uppercase ${
          step === 'config' ? 'bg-theme-secondary text-theme-secondary' :
          step === 'deploying' ? 'bg-blue-600/20 text-blue-400' :
          step === 'complete' ? 'bg-emerald-600/20 text-emerald-400' :
          'bg-rose-600/20 text-rose-400'
        }`}>
          {step === 'config' ? 'Ready' : step === 'deploying' ? 'Installing...' : step === 'complete' ? 'Done' : 'Failed'}
        </div>
      </div>

      {step === 'config' && (
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 overflow-auto space-y-3">
            {/* Required Fields - Single Column Compact */}
            <div className="bg-theme-card rounded-lg p-3 border border-theme-secondary">
              <h3 className="text-xs font-bold text-theme-primary uppercase tracking-wide mb-3 flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
                Required Files
              </h3>
              
              <div className="space-y-2">
                {/* SQL Express */}
                <div className="flex items-center gap-2">
                  <label className="text-xs text-theme-secondary w-24 shrink-0">SQL Express</label>
                  <input
                    type="text"
                    value={config.sqlExpressInstallerPath}
                    onChange={e => setConfig(c => ({ ...c, sqlExpressInstallerPath: e.target.value }))}
                    placeholder="Select installer..."
                    className="flex-1 bg-theme-input border border-theme-secondary rounded px-2 py-1.5 text-xs text-theme-primary placeholder-theme-muted focus:outline-none focus:border-blue-500"
                  />
                  <button
                    onClick={() => handleBrowse('sqlExpressInstallerPath')}
                    className="px-2 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-bold"
                  >
                    Browse
                  </button>
                </div>

                {/* SSMS */}
                <div className="flex items-center gap-2">
                  <label className="text-xs text-theme-secondary w-24 shrink-0">SSMS</label>
                  <input
                    type="text"
                    value={config.ssmsInstallerPath}
                    onChange={e => setConfig(c => ({ ...c, ssmsInstallerPath: e.target.value }))}
                    placeholder="Select installer..."
                    className="flex-1 bg-theme-input border border-theme-secondary rounded px-2 py-1.5 text-xs text-theme-primary placeholder-theme-muted focus:outline-none focus:border-blue-500"
                  />
                  <button
                    onClick={() => handleBrowse('ssmsInstallerPath')}
                    className="px-2 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-bold"
                  >
                    Browse
                  </button>
                </div>

                {/* SA Password */}
                <div className="flex items-center gap-2">
                  <label className="text-xs text-theme-secondary w-24 shrink-0">SA Password</label>
                  <input
                    type="password"
                    value={config.saPassword}
                    onChange={e => {
                      setConfig(c => ({ ...c, saPassword: e.target.value }));
                      setPasswordError('');
                    }}
                    placeholder="15+ chars, mixed case, numbers, symbols"
                    className={`flex-1 bg-theme-input border rounded px-2 py-1.5 text-xs text-theme-primary placeholder-theme-muted focus:outline-none ${
                      passwordError ? 'border-rose-500' : 'border-theme-secondary focus:border-blue-500'
                    }`}
                  />
                </div>

                {/* Confirm Password */}
                <div className="flex items-center gap-2">
                  <label className="text-xs text-theme-secondary w-24 shrink-0">Confirm</label>
                  <div className="flex-1">
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={e => {
                        setConfirmPassword(e.target.value);
                        setPasswordError('');
                      }}
                      placeholder="Re-enter password"
                      className={`w-full bg-theme-input border rounded px-2 py-1.5 text-xs text-theme-primary placeholder-theme-muted focus:outline-none ${
                        passwordError ? 'border-rose-500' : 'border-theme-secondary focus:border-blue-500'
                      }`}
                    />
                    {passwordError && <p className="text-xs text-rose-500 mt-1">{passwordError}</p>}
                  </div>
                </div>
              </div>
            </div>

            {/* Advanced Settings - Always Expanded */}
            <div className="bg-theme-card rounded-lg border border-theme-secondary p-3 flex-1">
              <h3 className="text-xs font-bold text-theme-primary uppercase tracking-wide flex items-center gap-2 mb-3">
                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
                Advanced Settings
              </h3>
              
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <label className="text-xs text-theme-secondary w-24 shrink-0">Instance</label>
                  <input
                    type="text"
                    value={config.instanceName}
                    onChange={e => setConfig(c => ({ ...c, instanceName: e.target.value }))}
                    className="flex-1 bg-theme-input border border-theme-secondary rounded px-2 py-2 text-xs text-theme-primary focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-theme-secondary w-24 shrink-0">SQL Path</label>
                  <input
                    type="text"
                    value={config.sqlDataPath}
                    onChange={e => setConfig(c => ({ ...c, sqlDataPath: e.target.value }))}
                    className="flex-1 bg-theme-input border border-theme-secondary rounded px-2 py-2 text-xs text-theme-primary focus:outline-none focus:border-blue-500"
                  />
                  <button
                    onClick={() => handleBrowseDirectory('sqlDataPath')}
                    className="px-3 py-2 bg-theme-secondary hover:bg-theme-secondary/80 text-theme-primary border border-theme-secondary rounded text-xs font-bold"
                  >
                    Browse
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-theme-secondary w-24 shrink-0">WSUS Path</label>
                  <input
                    type="text"
                    value={config.wsusContentPath}
                    onChange={e => setConfig(c => ({ ...c, wsusContentPath: e.target.value }))}
                    className="flex-1 bg-theme-input border border-theme-secondary rounded px-2 py-2 text-xs text-theme-primary focus:outline-none focus:border-blue-500"
                  />
                  <button
                    onClick={() => handleBrowseDirectory('wsusContentPath')}
                    className="px-3 py-2 bg-theme-secondary hover:bg-theme-secondary/80 text-theme-primary border border-theme-secondary rounded text-xs font-bold"
                  >
                    Browse
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Buttons - Fixed at bottom */}
          <div className="mt-3 flex gap-2">
            <button
              onClick={runDemo}
              disabled={demoMode}
              className="px-4 py-3 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold uppercase tracking-wide disabled:opacity-50 transition-all"
            >
              Demo
            </button>
            <button
              onClick={handleStartDeployment}
              disabled={!isFormValid}
              className="flex-1 py-3 bg-gradient-to-r from-blue-600 to-emerald-600 hover:from-blue-500 hover:to-emerald-500 text-white rounded-lg text-xs font-bold uppercase tracking-wide disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              Start Deployment
            </button>
          </div>
        </div>
      )}

      {step === 'deploying' && (
        <div className="flex-1 flex flex-col bg-theme-card rounded-lg p-4 border border-blue-500/20">
          {/* Progress */}
          <div className="mb-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-bold text-theme-primary">{progress.message}</span>
              <span className="text-xs font-bold text-blue-500 mono">{progress.progress}%</span>
            </div>
            <div className="h-2 w-full bg-theme-tertiary rounded-full overflow-hidden">
              <div className="h-full bg-blue-600 transition-all duration-500" style={{ width: `${progress.progress}%` }}></div>
            </div>
          </div>

          {/* Step Indicators - Horizontal */}
          <div className="flex gap-2 mb-4">
            {[
              { id: 'sql-express', label: 'SQL' },
              { id: 'ssms', label: 'SSMS' },
              { id: 'wsus-feature', label: 'Feature' },
              { id: 'wsus-config', label: 'Config' }
            ].map(s => {
              const status = getStepStatus(s.id, progress.step);
              return (
                <div key={s.id} className={`flex-1 p-2 rounded border text-center ${
                  status === 'active' ? 'bg-blue-600/10 border-blue-500/30' :
                  status === 'complete' ? 'bg-emerald-600/10 border-emerald-500/30' :
                  'bg-theme-input border-theme-secondary'
                }`}>
                  <div className={`text-sm mb-1 ${
                    status === 'complete' ? 'text-emerald-500' :
                    status === 'active' ? 'text-blue-500 animate-pulse' :
                    'text-theme-muted'
                  }`}>
                    {status === 'complete' ? '✓' : status === 'active' ? '●' : '○'}
                  </div>
                  <div className="text-xs text-theme-secondary font-medium">{s.label}</div>
                </div>
              );
            })}
          </div>

          <div className="flex-1 flex items-center justify-center">
            <div className="text-center p-6 bg-amber-500/10 border border-amber-500/20 rounded-lg">
              <p className="text-lg font-bold text-amber-500 mb-2">⚠️ Do Not Close This Window</p>
              <p className="text-sm text-theme-secondary">Installation may take 15-30 minutes.</p>
            </div>
          </div>
        </div>
      )}

      {step === 'complete' && (
        <div className="flex-1 flex flex-col bg-theme-card rounded-lg p-4 border border-emerald-500/20">
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 bg-emerald-500/10 rounded-full flex items-center justify-center mb-3">
              <span className="text-2xl text-emerald-500">✓</span>
            </div>
            <h3 className="text-sm font-bold text-emerald-500 uppercase tracking-wide mb-2">Deployment Complete</h3>
            <p className="text-xs text-theme-secondary mb-4">SQL Express, SSMS, and WSUS are ready.</p>
            
            <div className="w-full max-w-md p-3 bg-theme-input rounded-lg border border-theme-secondary text-left mb-4">
              <p className="text-xs font-bold text-theme-secondary uppercase mb-2">Next Steps:</p>
              <ol className="text-xs text-theme-primary space-y-1">
                <li>1. Go to <span className="text-blue-400">Operations</span> → Run sync</li>
                <li>2. Wait for initial synchronization</li>
                <li>3. Export to media for air-gapped servers</li>
              </ol>
            </div>
          </div>
          
          <button
            onClick={() => setStep('config')}
            className="w-full py-2 bg-theme-secondary hover:bg-theme-secondary/80 text-theme-primary border border-theme-secondary rounded-lg text-xs font-bold uppercase"
          >
            Done
          </button>
        </div>
      )}

      {step === 'error' && (
        <div className="flex-1 flex flex-col bg-theme-card rounded-lg p-4 border border-rose-500/20">
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 bg-rose-500/10 rounded-full flex items-center justify-center mb-3">
              <span className="text-2xl text-rose-500">✕</span>
            </div>
            <h3 className="text-sm font-bold text-rose-500 uppercase tracking-wide mb-2">Deployment Failed</h3>
            <p className="text-xs text-theme-secondary mb-2">{progress.error || 'An error occurred'}</p>
            <p className="text-xs text-theme-muted">Check logs for details.</p>
          </div>
          
          <button
            onClick={() => setStep('config')}
            className="w-full py-2 bg-theme-secondary hover:bg-theme-secondary/80 text-theme-primary border border-theme-secondary rounded-lg text-xs font-bold uppercase"
          >
            Back
          </button>
        </div>
      )}
    </div>
  );
};

export default React.memo(DeploymentWizard);
