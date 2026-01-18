/**
 * STIG Compliance Checking
 * Runs automated compliance checks against STIG rules
 */

import { loggingService } from '../loggingService';
import type { StigRule, StigBenchmark, ComplianceStats } from './types';
import { checkMappings } from './checkMappings';
import { generateGenericCheck } from './parser';

/**
 * Run compliance checks for rules
 */
export async function runComplianceChecks(
  benchmarks: StigBenchmark[],
  benchmarkId?: string
): Promise<StigRule[]> {
  const { powershellService } = await import('../powershellService');
  
  const rulesToCheck = benchmarkId 
    ? benchmarks.find(b => b.id === benchmarkId)?.rules || []
    : benchmarks.flatMap(b => b.rules);
  
  loggingService.info(`[STIG] Running compliance checks on ${rulesToCheck.length} rules`);
  
  const results: StigRule[] = [];
  
  for (const rule of rulesToCheck) {
    const updatedRule = { ...rule };
    
    if (rule.checkType === 'manual') {
      updatedRule.status = 'Not Checked';
      updatedRule.lastChecked = new Date();
      results.push(updatedRule);
      continue;
    }
    
    // Try to find a matching check command
    let checkCommand: string | null = null;
    
    for (const mapping of checkMappings) {
      const match = rule.checkContent.match(mapping.pattern);
      if (match) {
        checkCommand = mapping.command(match, rule);
        break;
      }
    }
    
    if (!checkCommand) {
      // Try generic checks based on keywords
      checkCommand = generateGenericCheck(rule);
    }
    
    if (checkCommand) {
      try {
        const result = await powershellService.execute(checkCommand, 15000);
        const output = result.stdout.trim().toUpperCase();
        
        if (output === 'COMPLIANT') {
          updatedRule.status = 'Compliant';
        } else if (output === 'OPEN' || output === 'NOT COMPLIANT') {
          updatedRule.status = 'Open';
        } else if (output === 'NOT_APPLICABLE' || output === 'N/A') {
          updatedRule.status = 'Not Applicable';
        } else {
          updatedRule.status = 'Not Checked';
        }
      } catch {
        updatedRule.status = 'Error';
      }
    } else {
      updatedRule.status = 'Not Checked';
    }
    
    updatedRule.lastChecked = new Date();
    results.push(updatedRule);
  }
  
  loggingService.info(`[STIG] Compliance check complete`);
  return results;
}

/**
 * Update benchmarks with compliance check results
 */
export function applyComplianceResults(
  benchmarks: StigBenchmark[],
  results: StigRule[]
): void {
  for (const benchmark of benchmarks) {
    for (let i = 0; i < benchmark.rules.length; i++) {
      const result = results.find(
        r => r.id === benchmark.rules[i].id && r.stigId === benchmark.id
      );
      if (result) {
        benchmark.rules[i] = result;
      }
    }
  }
}

/**
 * Get compliance statistics from rules
 */
export function getComplianceStats(rules: StigRule[]): ComplianceStats {
  const stats: ComplianceStats = {
    total: rules.length,
    compliant: rules.filter(r => r.status === 'Compliant').length,
    open: rules.filter(r => r.status === 'Open').length,
    notChecked: rules.filter(r => r.status === 'Not Checked').length,
    notApplicable: rules.filter(r => r.status === 'Not Applicable').length,
    error: rules.filter(r => r.status === 'Error').length,
    rate: 0
  };
  
  const checkable = stats.total - stats.notApplicable - stats.notChecked - stats.error;
  stats.rate = checkable > 0 ? Math.round((stats.compliant / checkable) * 100) : 0;
  
  return stats;
}
