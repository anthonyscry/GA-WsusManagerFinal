/**
 * STIG Directory Scanner
 * Scans directories for XCCDF/STIG XML files
 */

import { loggingService } from '../loggingService';
import type { StigBenchmark, StigConfig } from './types';
import { parseXccdfFile } from './parser';

/**
 * Scan STIG directory for XML/XCCDF files
 */
export async function scanDirectory(
  config: StigConfig,
  onBenchmarkLoaded?: (benchmark: StigBenchmark) => void
): Promise<StigBenchmark[]> {
  const { powershellService } = await import('../powershellService');
  
  loggingService.info(`[STIG] Scanning directory: ${config.stigDirectory}`);
  
  // Get list of STIG files
  const listScript = `
    $path = "${config.stigDirectory.replace(/\\/g, '\\\\')}"
    if (Test-Path $path) {
      Get-ChildItem -Path $path -Filter "*.xml" -Recurse | 
        Where-Object { $_.Name -match "xccdf|stig|benchmark" -or (Get-Content $_.FullName -First 5 -Raw) -match "Benchmark" } |
        Select-Object -ExpandProperty FullName |
        ConvertTo-Json
    } else {
      Write-Output "[]"
    }
  `;
  
  const result = await powershellService.execute(listScript, 30000);
  
  if (!result.success) {
    loggingService.error(`[STIG] Failed to scan directory: ${result.stderr}`);
    return [];
  }
  
  let files: string[] = [];
  try {
    const output = result.stdout.trim();
    if (output && output !== '[]') {
      const parsed = JSON.parse(output);
      files = Array.isArray(parsed) ? parsed : [parsed];
    }
  } catch {
    loggingService.error('[STIG] Failed to parse file list');
    return [];
  }
  
  loggingService.info(`[STIG] Found ${files.length} potential STIG files`);
  
  // Parse each file
  const benchmarks: StigBenchmark[] = [];
  for (const file of files) {
    try {
      const benchmark = await parseXccdfFile(file);
      if (benchmark) {
        benchmarks.push(benchmark);
        loggingService.info(`[STIG] Loaded: ${benchmark.title} (${benchmark.ruleCount} rules)`);
        onBenchmarkLoaded?.(benchmark);
      }
    } catch (error) {
      loggingService.error(`[STIG] Failed to parse ${file}: ${error}`);
    }
  }
  
  return benchmarks;
}
