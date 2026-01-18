/**
 * STIG Service - Re-exports from modular implementation
 * @deprecated Import directly from './stig' or './stig/types' instead
 * 
 * Parses and manages DISA STIG files (XCCDF XML format)
 * Users can download official STIGs from: https://public.cyber.mil/stigs/downloads/
 */

// Re-export everything from modular implementation
export { stigService } from './stig';
export type { StigRule, StigBenchmark, StigConfig, ComplianceStats } from './stig/types';
