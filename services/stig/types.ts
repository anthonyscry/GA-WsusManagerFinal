/**
 * STIG Service Types
 */

// STIG Rule from parsed XCCDF file
export interface StigRule {
  id: string;
  vulnId: string;           // V-XXXXXX
  ruleId: string;           // SV-XXXXXX
  stigId: string;           // Which STIG file this came from
  title: string;
  severity: 'CAT I' | 'CAT II' | 'CAT III';
  description: string;
  checkContent: string;     // What to check (from XCCDF)
  fixText: string;          // How to fix it
  checkType: 'auto' | 'manual';  // Can we auto-check this?
  status: 'Not Checked' | 'Compliant' | 'Open' | 'Not Applicable' | 'Error';
  lastChecked?: Date;
}

// Parsed STIG file info
export interface StigBenchmark {
  id: string;
  title: string;
  version: string;
  releaseDate: string;
  description: string;
  fileName: string;
  ruleCount: number;
  rules: StigRule[];
}

// STIG Directory configuration
export interface StigConfig {
  stigDirectory: string;
  autoScanOnStartup: boolean;
  lastScanDate?: string;
}

// Check mapping - maps STIG check patterns to PowerShell commands
export interface CheckMapping {
  pattern: RegExp;
  command: (match: RegExpMatchArray, rule: StigRule) => string;
}

// Severity to CSS class mapping
export type SeverityClass = 'text-red-500' | 'text-yellow-500' | 'text-blue-500';

// Status to CSS class mapping  
export type StatusClass = 'text-green-500' | 'text-red-500' | 'text-yellow-500' | 'text-gray-500';

// Compliance statistics
export interface ComplianceStats {
  total: number;
  compliant: number;
  open: number;
  notChecked: number;
  notApplicable: number;
  error: number;
  rate: number;
}
