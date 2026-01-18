/**
 * STIG Results Export
 * Export compliance results to various formats
 */

import type { StigRule } from './types';

/**
 * Export compliance results to CSV
 */
export async function exportResults(
  rules: StigRule[],
  outputPath: string
): Promise<boolean> {
  const { powershellService } = await import('../powershellService');
  
  const csvData = rules.map(r => ({
    'Vuln ID': r.vulnId,
    'Rule ID': r.ruleId,
    'STIG': r.stigId,
    'Title': r.title.replace(/"/g, '""'),
    'Severity': r.severity,
    'Status': r.status,
    'Check Type': r.checkType,
    'Last Checked': r.lastChecked?.toISOString() || 'Never'
  }));
  
  const csvContent = [
    Object.keys(csvData[0] || {}).join(','),
    ...csvData.map(row => Object.values(row).map(v => `"${v}"`).join(','))
  ].join('\n');
  
  const escapedPath = outputPath.replace(/\\/g, '\\\\');
  const escapedContent = csvContent.replace(/`/g, '``').replace(/\$/g, '`$');
  
  const script = `
    $content = @"
${escapedContent}
"@
    $content | Out-File -FilePath "${escapedPath}" -Encoding UTF8
    Write-Output "SUCCESS"
  `;
  
  const result = await powershellService.execute(script, 30000);
  return result.success && result.stdout.includes('SUCCESS');
}

/**
 * Generate CSV content string (without writing to file)
 */
export function generateCsvContent(rules: StigRule[]): string {
  const csvData = rules.map(r => ({
    'Vuln ID': r.vulnId,
    'Rule ID': r.ruleId,
    'STIG': r.stigId,
    'Title': r.title.replace(/"/g, '""'),
    'Severity': r.severity,
    'Status': r.status,
    'Check Type': r.checkType,
    'Last Checked': r.lastChecked?.toISOString() || 'Never'
  }));
  
  return [
    Object.keys(csvData[0] || {}).join(','),
    ...csvData.map(row => Object.values(row).map(v => `"${v}"`).join(','))
  ].join('\n');
}
