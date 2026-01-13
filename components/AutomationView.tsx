import React, { useState } from 'react';
import { Icons } from '../constants';
import { loggingService } from '../services/loggingService';
import { useScheduledTasks } from '../src/presentation/hooks';

const AutomationView: React.FC = () => {
  const { tasks, addTask, isLoading } = useScheduledTasks();
  const [isScheduling, setIsScheduling] = useState(false);
  const [newTrigger, setNewTrigger] = useState<'Daily' | 'Weekly' | 'Monthly'>('Daily');
  const [newTime, setNewTime] = useState('03:00');

  const handleRegisterTask = async () => {
    setIsScheduling(true);
    const cmd = `Register-ScheduledTask -TaskName "WSUS_Automation_Unattended" -Trigger (New-ScheduledTaskTrigger -${newTrigger} -At "${newTime}") -Action (New-ScheduledTaskAction -Execute 'Powershell.exe' -Argument '-File C:\\WSUS\\Scripts\\Invoke-WsusMonthlyMaintenance.ps1') -User "SYSTEM" -RunLevel Highest`;
    
    loggingService.warn(`[TASK-SCHEDULER] Registering unattended maintenance task...`);
    loggingService.info(`[COMMAND] ${cmd}`);
    
    try {
      await addTask({
        name: 'WSUS_Automation_Unattended',
        trigger: newTrigger,
        time: newTime
      });
      loggingService.info('[SUCCESS] Task registered in Windows Task Scheduler and state session.');
    } catch (error) {
      loggingService.error(`[ERROR] Failed to register task: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsScheduling(false);
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 p-8 bg-[#121216] border border-blue-500/20 rounded-2xl shadow-xl">
         <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
               <h2 className="text-sm font-black text-white uppercase tracking-widest">Task Scheduler Integration</h2>
               <span className="px-2.5 py-1 bg-blue-600/10 text-blue-400 border border-blue-500/30 rounded text-[9px] font-bold uppercase tracking-wider leading-none">
                 Service Mode
               </span>
            </div>
            <p className="text-sm font-medium text-slate-300 uppercase tracking-widest leading-relaxed">
               Configure unattended maintenance scripts to run as &quot;SYSTEM&quot; under the local task scheduler engine for consistent compliance.
            </p>
         </div>
         <div className="hidden md:block w-px h-12 bg-slate-800"></div>
         <div className="shrink-0 flex items-center gap-4">
            <div className="text-right">
               <p className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Engine Status</p>
               <p className="text-sm font-bold text-emerald-500 uppercase">Operational</p>
            </div>
            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_#10b981]"></div>
         </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
         {/* Configuration Side */}
         <div className="panel-card p-8 rounded-2xl space-y-8 bg-[#121216]/50 border-slate-800/40">
            <h3 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-3">
               <div className="w-1 h-1 bg-blue-600 rounded-full"></div>
               Register New Rule
            </h3>
            
            <div className="space-y-6">
               <div className="space-y-3">
                  <label className="block text-xs font-semibold text-white uppercase tracking-widest mb-1">Recurrence Pattern</label>
                  <div className="grid grid-cols-3 gap-3">
                     {(['Daily', 'Weekly', 'Monthly'] as const).map((p) => (
                       <button 
                        key={p} 
                        onClick={() => setNewTrigger(p)}
                        className={`py-4 rounded-xl text-xs font-bold uppercase tracking-widest border transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${newTrigger === p ? 'bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-900/20' : 'bg-black/30 border-slate-800 text-slate-300 hover:text-white hover:border-slate-700'}`}
                       >
                         {p}
                       </button>
                     ))}
                  </div>
               </div>

               <div className="space-y-3">
                  <label htmlFor="execution-time" className="block text-xs font-semibold text-white uppercase tracking-widest mb-1">Execution Time (24h Window)</label>
                  <input 
                    id="execution-time"
                    type="time" 
                    className="w-full bg-black/40 border border-slate-800 rounded-xl px-5 py-4 text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-600 transition-colors"
                    value={newTime}
                    onChange={e => setNewTime(e.target.value)}
                  />
               </div>

               <div className="p-4 bg-blue-600/5 rounded-xl border border-blue-500/10">
                  <span className="text-xs font-black text-slate-400 uppercase tracking-widest block mb-2">Target Payload</span>
                  <p className="text-sm mono text-blue-400 font-bold tracking-tight">Invoke-WsusMonthlyMaintenance.ps1</p>
               </div>

               <button 
                disabled={isScheduling}
                onClick={handleRegisterTask}
                className="w-full py-5 bg-blue-600 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-xl shadow-blue-900/40 hover:bg-blue-500 transition-all active:scale-95 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                aria-label="Register task in Windows Task Scheduler"
                aria-busy={isScheduling}
               >
                 {isScheduling ? 'Syncing with Scheduler...' : 'Commit to Task Scheduler'}
               </button>
            </div>
         </div>

         {/* Current Tasks Side */}
         <div className="space-y-4">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] px-2 mb-2 flex items-center justify-between">
               Active Automation Units
               <span className="text-slate-500 font-bold">{tasks.length} Active</span>
            </h3>
            {tasks.map(task => (
              <div key={task.id} className="panel-card p-6 rounded-2xl flex items-center justify-between group hover:border-blue-500/50 transition-all bg-[#121216]/50">
                 <div className="flex items-center gap-5">
                    <div className="w-12 h-12 bg-black rounded-xl flex items-center justify-center border border-slate-800 group-hover:bg-blue-600/10 group-hover:border-blue-500/30 transition-all">
                       <Icons.Logs className="w-5 h-5 text-slate-600 group-hover:text-blue-500" />
                    </div>
                    <div>
                       <h4 className="text-xs font-black text-white uppercase tracking-tight">{task.name}</h4>
                       <p className="text-xs font-bold text-slate-400 uppercase tracking-tighter mt-1">{task.trigger} Cycle at {task.time}</p>
                    </div>
                 </div>
                 <div className="text-right">
                    <span className="text-xs font-black text-emerald-500 uppercase tracking-widest bg-emerald-500/10 px-2.5 py-1 rounded border border-emerald-500/20">{task.status}</span>
                    <p className="text-xs font-bold text-slate-500 uppercase mt-2 tracking-widest">Next Run: {task.nextRun}</p>
                 </div>
              </div>
            ))}
            {tasks.length === 0 && (
              <div className="p-20 text-center text-slate-500 text-xs font-black uppercase tracking-widest border border-dashed border-slate-800 rounded-2xl">
                 No active automation policies found.
              </div>
            )}
         </div>
      </div>
    </div>
  );
};

export default AutomationView;