import React, { useState } from 'react';
import { Icons } from '../constants';
import { loggingService } from '../services/loggingService';
import { useScheduledTasks } from '../src/presentation/hooks';

const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAYS_OF_WEEK_FULL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const AutomationView: React.FC = () => {
  const { tasks, addTask } = useScheduledTasks();
  const [isScheduling, setIsScheduling] = useState(false);
  
  // Schedule options
  const [newTrigger, setNewTrigger] = useState<'Daily' | 'Weekly' | 'Monthly'>('Daily');
  const [newTime, setNewTime] = useState('02:00');
  const [selectedDays, setSelectedDays] = useState<string[]>(['Mon']);
  const [dayOfMonth, setDayOfMonth] = useState(1);
  
  // Run level options
  const [runWhetherLoggedOn, setRunWhetherLoggedOn] = useState(true);
  
  // Credentials
  const [useCredentials, setUseCredentials] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const toggleDay = (day: string) => {
    setSelectedDays(prev => 
      prev.includes(day) 
        ? prev.filter(d => d !== day)
        : [...prev, day]
    );
  };

  const handleRegisterTask = async () => {
    setIsScheduling(true);
    
    let triggerPart = '';
    if (newTrigger === 'Daily') {
      triggerPart = `-Daily -At "${newTime}"`;
    } else if (newTrigger === 'Weekly') {
      const daysParam = selectedDays.map(d => DAYS_OF_WEEK_FULL[DAYS_OF_WEEK.indexOf(d)]).join(',');
      triggerPart = `-Weekly -DaysOfWeek ${daysParam} -At "${newTime}"`;
    } else if (newTrigger === 'Monthly') {
      triggerPart = `-Monthly -DaysOfMonth ${dayOfMonth} -At "${newTime}"`;
    }
    
    const userPart = useCredentials && username && password 
      ? `-User "${username}" -Password "${password}"`
      : '-User "SYSTEM"';
    
    const runLevelPart = runWhetherLoggedOn ? '-RunLevel Highest' : '';
    const settingsPart = runWhetherLoggedOn 
      ? '-Settings (New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable)'
      : '';
    
    const cmd = `Register-ScheduledTask -TaskName "WSUS_Automation_Unattended" -Trigger (New-ScheduledTaskTrigger ${triggerPart}) -Action (New-ScheduledTaskAction -Execute 'Powershell.exe' -Argument '-ExecutionPolicy Bypass -File C:\\WSUS\\Scripts\\Invoke-WsusMonthlyMaintenance.ps1') ${userPart} ${runLevelPart} ${settingsPart} -Force`;
    
    loggingService.warn(`[TASK-SCHEDULER] Registering unattended maintenance task...`);
    loggingService.info(`[COMMAND] ${cmd.replace(/-Password "[^"]*"/, '-Password "[REDACTED]"')}`);
    
    try {
      const DAYS_OF_WEEK_FULL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
      const daysOfWeekFull = selectedDays.map(d => DAYS_OF_WEEK_FULL[DAYS_OF_WEEK.indexOf(d)]);
      await addTask({ 
        name: 'WSUS_Automation_Unattended', 
        trigger: newTrigger, 
        time: newTime,
        dayOfMonth: newTrigger === 'Monthly' ? dayOfMonth : undefined,
        daysOfWeek: newTrigger === 'Weekly' ? daysOfWeekFull : undefined
      });
      loggingService.info('[SUCCESS] Task registered in Windows Task Scheduler.');
    } catch (error) {
      loggingService.error(`[ERROR] Failed to register task: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsScheduling(false);
    }
  };

  return (
    <div className="animate-fadeIn h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-3 bg-theme-card border border-theme-secondary rounded-lg mb-2 shrink-0">
        <h2 className="text-sm font-black text-theme-primary uppercase tracking-wide">Task Scheduler</h2>
        <div className="flex items-center gap-3">
          <span className="px-2 py-1 bg-blue-600/10 text-blue-400 border border-blue-500/30 rounded text-[10px] font-bold uppercase">
            Service Mode
          </span>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-emerald-500 uppercase">Online</span>
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
          </div>
        </div>
      </div>

      {/* Main Content - Two Panels */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-2 gap-2 overflow-hidden">
        {/* Left Panel: Configuration */}
        <div className="panel-card rounded-lg bg-theme-card/50 border-theme-secondary flex flex-col overflow-hidden">
          <div className="p-2 border-b border-theme-secondary shrink-0">
            <h3 className="text-[10px] font-black text-theme-primary uppercase tracking-widest flex items-center gap-2">
              <div className="w-1 h-1 bg-blue-600 rounded-full"></div>
              Schedule Configuration
            </h3>
          </div>

          <div className="flex-1 min-h-0 p-3 flex flex-col gap-2">
            {/* Row 1: Pattern + Time */}
            <div className="grid grid-cols-[1fr_90px] gap-3">
              <div>
                <label className="block text-[10px] font-semibold text-theme-muted uppercase mb-1">Pattern</label>
                <div className="grid grid-cols-3 gap-1">
                  {(['Daily', 'Weekly', 'Monthly'] as const).map((p) => (
                    <button 
                      key={p} 
                      onClick={() => setNewTrigger(p)}
                      className={`py-1.5 rounded text-[10px] font-bold uppercase border transition-all ${newTrigger === p ? 'bg-blue-600 text-white border-blue-500' : 'bg-theme-input border-theme-secondary text-theme-secondary hover:text-theme-primary hover:bg-theme-secondary/20'}`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-theme-muted uppercase mb-1">Time</label>
                <input 
                  type="time" 
                  className="w-full bg-theme-input border border-theme-secondary rounded px-1 py-1.5 text-[10px] font-bold text-theme-primary"
                  value={newTime}
                  onChange={e => setNewTime(e.target.value)}
                />
              </div>
            </div>

            {/* Row 2: Day Selection - Fixed height to prevent layout shift */}
            <div className="h-[36px] flex items-center">
              {newTrigger === 'Weekly' && (
                <div className="w-full">
                  <div className="flex gap-1">
                    {DAYS_OF_WEEK.map((day) => (
                      <button
                        key={day}
                        onClick={() => toggleDay(day)}
                        className={`flex-1 py-1 rounded text-[9px] font-bold uppercase border transition-all ${
                          selectedDays.includes(day) ? 'bg-blue-600 text-white border-blue-500' : 'bg-theme-input border-theme-secondary text-theme-secondary hover:text-theme-primary hover:bg-theme-secondary/20'
                        }`}
                      >
                        {day}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {newTrigger === 'Monthly' && (
                <div className="flex items-center gap-2">
                  <label className="text-[10px] font-semibold text-theme-muted uppercase">Day of month:</label>
                  <select
                    value={dayOfMonth}
                    onChange={(e) => setDayOfMonth(Number(e.target.value))}
                    className="bg-theme-input border border-theme-secondary rounded px-2 py-1 text-[10px] font-bold text-theme-primary"
                  >
                    {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                      <option key={d} value={d}>{d}{d === 1 ? 'st' : d === 2 ? 'nd' : d === 3 ? 'rd' : 'th'}</option>
                    ))}
                  </select>
                </div>
              )}
              {newTrigger === 'Daily' && (
                <div className="text-[10px] text-theme-muted italic">Runs every day at {newTime}</div>
              )}
            </div>

            {/* Row 3: Options - horizontal */}
            <div className="grid grid-cols-2 gap-2">
              <label className="flex items-center gap-2 p-2 bg-theme-input rounded border border-theme-secondary cursor-pointer">
                <input
                  type="checkbox"
                  checked={runWhetherLoggedOn}
                  onChange={(e) => setRunWhetherLoggedOn(e.target.checked)}
                  className="w-3 h-3 rounded border-theme-secondary bg-theme-input text-blue-600"
                />
                <span className="text-[9px] font-semibold text-theme-secondary uppercase">Run without login</span>
              </label>
              <label className="flex items-center gap-2 p-2 bg-theme-input rounded border border-theme-secondary cursor-pointer">
                <input
                  type="checkbox"
                  checked={useCredentials}
                  onChange={(e) => setUseCredentials(e.target.checked)}
                  className="w-3 h-3 rounded border-theme-secondary bg-theme-input text-blue-600"
                />
                <span className="text-[9px] font-semibold text-theme-secondary uppercase">Custom credentials</span>
              </label>
            </div>

            {/* Row 4: Credentials - Fixed height container */}
            <div className={`h-[32px] ${useCredentials ? '' : 'invisible'}`}>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="DOMAIN\User"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="bg-theme-input border border-theme-secondary rounded px-2 py-1.5 text-[10px] font-bold text-theme-primary placeholder:text-theme-muted"
                />
                <input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-theme-input border border-theme-secondary rounded px-2 py-1.5 text-[10px] font-bold text-theme-primary placeholder:text-theme-muted"
                />
              </div>
            </div>
          </div>

          {/* Submit */}
          <div className="p-2 border-t border-theme-secondary shrink-0">
            <button 
              disabled={isScheduling || (useCredentials && (!username || !password))}
              onClick={handleRegisterTask}
              className="w-full py-2.5 bg-blue-600 text-white rounded text-[10px] font-black uppercase tracking-widest hover:bg-blue-500 transition-all disabled:opacity-50"
            >
              {isScheduling ? 'Syncing...' : 'Commit to Task Scheduler'}
            </button>
          </div>
        </div>

        {/* Right Panel: Active Tasks */}
        <div className="panel-card rounded-lg bg-theme-card/50 border-theme-secondary flex flex-col overflow-hidden">
          <div className="p-2 border-b border-theme-secondary shrink-0 flex items-center justify-between">
            <h3 className="text-[10px] font-black text-theme-primary uppercase tracking-widest flex items-center gap-2">
              <div className="w-1 h-1 bg-blue-600 rounded-full"></div>
              Active Tasks
            </h3>
            <span className="text-[10px] font-bold text-theme-muted">{tasks.length}</span>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto p-2">
            {tasks.length > 0 ? (
              <div className="space-y-2">
                {tasks.map(task => (
                  <div key={task.id} className="p-2 rounded-lg flex items-center justify-between bg-theme-primary border border-theme-secondary hover:border-blue-500/30 transition-all">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-theme-secondary rounded flex items-center justify-center border border-theme-secondary">
                        <Icons.Logs className="w-3.5 h-3.5 text-theme-muted" />
                      </div>
                      <div>
                        <h4 className="text-[10px] font-black text-theme-primary uppercase">{task.name}</h4>
                        <p className="text-[9px] font-bold text-theme-muted">{task.trigger} at {task.time}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[8px] font-black text-emerald-500 uppercase bg-emerald-500/10 px-1.5 py-0.5 rounded">{task.status}</span>
                      <p className="text-[8px] font-bold text-theme-muted mt-0.5">Next: {task.nextRun}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-full flex items-center justify-center">
                <div className="text-center text-theme-muted text-[10px] font-bold uppercase p-4 border border-dashed border-theme-secondary rounded-lg">
                  No active tasks
                </div>
              </div>
            )}
          </div>

          {/* Summary */}
          <div className="p-2 border-t border-theme-secondary shrink-0">
            <div className="flex items-center justify-between text-[9px] px-1">
              <span className="text-theme-muted">Config: <span className="text-theme-primary font-bold">{newTrigger}</span> @ <span className="text-theme-primary font-bold">{newTime}</span></span>
              <span className="text-theme-muted">As: <span className="text-theme-primary font-bold">{useCredentials && username ? username.split('\\').pop() : 'SYSTEM'}</span></span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default React.memo(AutomationView);
