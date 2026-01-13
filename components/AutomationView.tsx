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
    <div className="space-y-4 animate-fadeIn pb-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-[#121216] border border-blue-500/20 rounded-xl shadow-xl">
         <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
               <h2 className="text-xs font-black text-white uppercase tracking-widest">Task Scheduler Integration</h2>
               <span className="px-2 py-0.5 bg-blue-600/10 text-blue-400 border border-blue-500/30 rounded text-[8px] font-bold uppercase tracking-wider leading-none">
                 Service Mode
               </span>
            </div>
            <p className="text-[10px] font-medium text-slate-300 uppercase tracking-wider leading-relaxed">
               Configure unattended maintenance scripts to run as &quot;SYSTEM&quot; under Task Scheduler.
            </p>
         </div>
         <div className="shrink-0 flex items-center gap-3">
            <div className="text-right">
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Engine Status</p>
               <p className="text-xs font-bold text-emerald-500 uppercase">Operational</p>
            </div>
            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_#10b981]"></div>
         </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
         {/* Configuration Side */}
         <div className="panel-card p-5 rounded-xl space-y-4 bg-[#121216]/50 border-slate-800/40">
            <h3 className="text-[10px] font-black text-white uppercase tracking-widest flex items-center gap-2">
               <div className="w-1 h-1 bg-blue-600 rounded-full"></div>
               Register New Rule
            </h3>
            
            <div className="space-y-4">
               <div className="space-y-2">
                  <label className="block text-[10px] font-semibold text-white uppercase tracking-widest">Recurrence Pattern</label>
                  <div className="grid grid-cols-3 gap-2">
                     {(['Daily', 'Weekly', 'Monthly'] as const).map((p) => (
                       <button 
                        key={p} 
                        onClick={() => setNewTrigger(p)}
                        className={`py-2.5 rounded-lg text-[10px] font-bold uppercase tracking-wider border transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${newTrigger === p ? 'bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-900/20' : 'bg-black/30 border-slate-800 text-slate-300 hover:text-white hover:border-slate-700'}`}
                       >
                         {p}
                       </button>
                     ))}
                  </div>
               </div>

               <div className="space-y-2">
                  <label htmlFor="execution-time" className="block text-[10px] font-semibold text-white uppercase tracking-widest">Execution Time (24h)</label>
                  <input 
                    id="execution-time"
                    type="time" 
                    className="w-full bg-black/40 border border-slate-800 rounded-lg px-4 py-2.5 text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-600 transition-colors"
                    value={newTime}
                    onChange={e => setNewTime(e.target.value)}
                  />
               </div>

               <div className="p-3 bg-blue-600/5 rounded-lg border border-blue-500/10">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Target Payload</span>
                  <p className="text-xs mono text-blue-400 font-bold tracking-tight">Invoke-WsusMonthlyMaintenance.ps1</p>
               </div>

               <button 
                disabled={isScheduling}
                onClick={handleRegisterTask}
                className="w-full py-3 bg-blue-600 text-white rounded-lg text-[10px] font-black uppercase tracking-widest shadow-xl shadow-blue-900/40 hover:bg-blue-500 transition-all active:scale-95 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                aria-label="Register task in Windows Task Scheduler"
                aria-busy={isScheduling}
               >
                 {isScheduling ? 'Syncing with Scheduler...' : 'Commit to Task Scheduler'}
               </button>
            </div>
         </div>

         {/* Current Tasks Side */}
         <div className="space-y-3">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-wider px-1 flex items-center justify-between">
               Active Automation Units
               <span className="text-slate-500 font-bold">{tasks.length} Active</span>
            </h3>
            {tasks.map(task => (
              <div key={task.id} className="panel-card p-4 rounded-xl flex items-center justify-between group hover:border-blue-500/50 transition-all bg-[#121216]/50">
                 <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-black rounded-lg flex items-center justify-center border border-slate-800 group-hover:bg-blue-600/10 group-hover:border-blue-500/30 transition-all">
                       <Icons.Logs className="w-4 h-4 text-slate-600 group-hover:text-blue-500" />
                    </div>
                    <div>
                       <h4 className="text-[10px] font-black text-white uppercase tracking-tight">{task.name}</h4>
                       <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter mt-0.5">{task.trigger} Cycle at {task.time}</p>
                    </div>
                 </div>
                 <div className="text-right">
                    <span className="text-[10px] font-black text-emerald-500 uppercase tracking-wider bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">{task.status}</span>
                    <p className="text-[9px] font-bold text-slate-500 uppercase mt-1 tracking-wider">Next: {task.nextRun}</p>
                 </div>
              </div>
            ))}
            {tasks.length === 0 && (
              <div className="p-12 text-center text-slate-500 text-[10px] font-black uppercase tracking-widest border border-dashed border-slate-800 rounded-xl">
                 No active automation policies found.
              </div>
            )}
         </div>
      </div>
    </div>
  );
};

export default AutomationView;