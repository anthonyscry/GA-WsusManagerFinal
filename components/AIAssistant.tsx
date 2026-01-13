
import React, { useState, useEffect } from 'react';
import { Icons } from '../constants';
import { analyzeEnvironment } from '../services/geminiService';
import { stateService } from '../services/stateService';
import { loggingService } from '../services/loggingService';

const AIAssistant: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [insight, setInsight] = useState<string | null>(null);
  const isAirGap = stateService.isAirGap();

  const handleAnalyze = async () => {
    if (isAirGap) {
        loggingService.error("Cloud-Sync disabled. AI Engine cannot be initialized in Air-Gap mode.");
        return;
    }
    setIsAnalyzing(true);
    const stats = stateService.getStats();
    const logs = loggingService.getLogs();
    
    const result = await analyzeEnvironment(stats, logs);
    setInsight(result);
    setIsAnalyzing(false);
  };

  if (isAirGap && !isOpen) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[160]">
      {isOpen ? (
        <div className="w-80 bg-[#121216]/95 border border-slate-800 rounded-3xl shadow-2xl backdrop-blur-xl animate-scaleIn flex flex-col overflow-hidden">
          <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-blue-600/5">
             <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white">
                   <Icons.AppLogo className="w-4 h-4" />
                </div>
                <div>
                   <h3 className="text-[10px] font-black text-white uppercase tracking-widest leading-none">AI Auditor</h3>
                   <span className="text-[8px] font-bold text-blue-500 uppercase tracking-tighter">Powered by Gemini</span>
                </div>
             </div>
             <button onClick={() => setIsOpen(false)} className="text-slate-500 hover:text-white transition-all">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
             </button>
          </div>

          <div className="p-6 flex-1 overflow-y-auto max-h-[400px] scrollbar-hide space-y-6">
             {!insight ? (
               <div className="text-center py-8">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-relaxed">
                    Ready to analyze environment telemetry for compliance risks.
                  </p>
               </div>
             ) : (
               <div className="space-y-4 animate-fadeIn">
                  <div className="p-4 bg-blue-600/10 border border-blue-500/20 rounded-2xl">
                     <p className="text-[11px] font-medium text-slate-300 leading-relaxed whitespace-pre-wrap">
                        {insight}
                     </p>
                  </div>
                  <p className="text-[8px] font-black text-slate-700 uppercase tracking-widest text-center">Snapshot Timestamp: {new Date().toLocaleTimeString()}</p>
               </div>
             )}
          </div>

          <div className="p-6 bg-black/40 border-t border-slate-800">
             <button 
                disabled={isAnalyzing || isAirGap}
                onClick={handleAnalyze}
                className={`w-full py-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl ${isAnalyzing ? 'bg-blue-600 text-white animate-pulse' : 'bg-slate-900 text-slate-400 hover:bg-white hover:text-black border border-slate-800'}`}
             >
                {isAnalyzing ? 'Processing Logs...' : 'Analyze Health Snapshot'}
             </button>
          </div>
        </div>
      ) : (
        <button 
          onClick={() => setIsOpen(true)}
          className="w-14 h-14 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl shadow-2xl flex items-center justify-center transition-all hover:scale-110 group relative"
        >
          <div className="absolute inset-0 bg-blue-400 rounded-2xl animate-ping opacity-20"></div>
          <Icons.AppLogo className="w-6 h-6 relative z-10" />
        </button>
      )}
    </div>
  );
};

export default AIAssistant;
