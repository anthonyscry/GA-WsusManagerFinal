/**
 * WSUS Service - Re-export from modular architecture
 * 
 * This file maintains backward compatibility by re-exporting from the new
 * modular wsus/ directory structure.
 * 
 * @deprecated Import directly from './wsus' or './wsus/[module]' for new code
 */

export { wsusService } from './wsus';
export * from './wsus/types';
