
import { GoogleGenAI } from "@google/genai";
import { EnvironmentStats, LogEntry } from '../types';

export const analyzeEnvironment = async (stats: EnvironmentStats, logs: LogEntry[]) => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const logSummary = logs.slice(0, 10).map(l => `[${l.level}] ${l.message}`).join('\n');
    
    const prompt = `
      You are an AI specialized in WSUS (Windows Server Update Services) and GA-ASI aerospace IT infrastructure.
      Analyze this environment state and provide 3 concise, mission-critical recommendations.
      
      STATS:
      - Healthy Nodes: ${stats.healthyComputers}/${stats.totalComputers}
      - DB Size: ${stats.db.currentSizeGB}GB / ${stats.db.maxSizeGB}GB
      - Disk Free: ${stats.diskFreeGB}GB
      - Critical Status: ${stats.criticalComputers} nodes failing.
      
      RECENT LOGS:
      ${logSummary}
      
      Respond with a bulleted list of 3 high-impact items. Keep it professional and technical.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });

    return response.text || "Unable to parse environment telemetry.";
  } catch (error) {
    console.error('Gemini analysis failed:', error);
    return "AI Engine Offline: Ensure Cloud-Sync is active and API key is valid.";
  }
};

export const generateComplianceReport = async (stats: EnvironmentStats) => {
   // Simplified AI report generation
   return `COMPLIANCE_SNAPSHOT: Environment is ${(stats.healthyComputers / stats.totalComputers * 100).toFixed(1)}% compliant.`;
};
