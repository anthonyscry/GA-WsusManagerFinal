/**
 * STIG compliance checking
 */

import { StigCheck } from '../../types';

export class StigChecker {
  /**
   * Get default STIG checks (initial state)
   */
  getDefaultChecks(): StigCheck[] {
    return [
      { id: '1', vulnId: 'V-2200', title: 'WSUS server must use HTTPS.', severity: 'CAT I', status: 'Checking...', discussion: 'Ensures metadata and content are encrypted during transit to downstream nodes.' },
      { id: '2', vulnId: 'V-2101', title: 'SQL Server must have page verify set to CHECKSUM.', severity: 'CAT II', status: 'Checking...', discussion: 'Prevents database corruption from being propagated during I/O operations.' },
      { id: '3', vulnId: 'V-2554', title: 'WSUS service must be running.', severity: 'CAT I', status: 'Checking...', discussion: 'WSUS service (WsusService) must be running for update distribution.' },
      { id: '4', vulnId: 'V-9932', title: 'IIS W3SVC service must be running.', severity: 'CAT I', status: 'Checking...', discussion: 'IIS web service is required for WSUS client communication.' },
      { id: '5', vulnId: 'V-3401', title: 'SQL Server service must be running.', severity: 'CAT I', status: 'Checking...', discussion: 'SQL Server is required for SUSDB database operations.' }
    ];
  }

  /**
   * Run STIG compliance checks
   */
  async runComplianceChecks(): Promise<StigCheck[]> {
    const results: StigCheck[] = [];
    
    try {
      // Dynamically import powershellService
      const { powershellService } = await import('../powershellService');
      
      // Check 1: WSUS HTTPS configuration
      try {
        const httpsCheck = await powershellService.execute(`
          $ErrorActionPreference = 'SilentlyContinue'
          $wsusConfig = Get-ItemProperty -Path "HKLM:\\SOFTWARE\\Microsoft\\Update Services\\Server\\Setup" -ErrorAction SilentlyContinue
          if ($wsusConfig -and $wsusConfig.UsingSSL -eq 1) {
            Write-Output "COMPLIANT"
          } else {
            Write-Output "OPEN"
          }
        `, 10000);
        results.push({
          id: '1',
          vulnId: 'V-2200',
          title: 'WSUS server must use HTTPS.',
          severity: 'CAT I',
          status: httpsCheck.stdout.trim() === 'COMPLIANT' ? 'Compliant' : 'Open',
          discussion: 'Ensures metadata and content are encrypted during transit to downstream nodes.'
        });
      } catch {
        results.push({ id: '1', vulnId: 'V-2200', title: 'WSUS server must use HTTPS.', severity: 'CAT I', status: 'Unknown', discussion: 'Unable to check WSUS HTTPS configuration.' });
      }

      // Check 2: SQL Server page verify
      try {
        const pageVerifyCheck = await powershellService.execute(`
          $ErrorActionPreference = 'SilentlyContinue'
          try {
            $moduleLoaded = $false
            foreach ($moduleName in @('SqlServer', 'SQLPS')) {
              if (Get-Module -ListAvailable -Name $moduleName -ErrorAction SilentlyContinue) {
                Import-Module $moduleName -ErrorAction Stop -DisableNameChecking
                $moduleLoaded = $true
                break
              }
            }
            if ($moduleLoaded) {
              $result = Invoke-Sqlcmd -Query "SELECT page_verify_option_desc FROM sys.databases WHERE name = 'SUSDB'" -ServerInstance "localhost" -TrustServerCertificate -ErrorAction Stop
              if ($result.page_verify_option_desc -eq 'CHECKSUM') {
                Write-Output "COMPLIANT"
              } else {
                Write-Output "OPEN"
              }
            } else {
              Write-Output "UNKNOWN"
            }
          } catch {
            Write-Output "UNKNOWN"
          }
        `, 15000);
        results.push({
          id: '2',
          vulnId: 'V-2101',
          title: 'SQL Server must have page verify set to CHECKSUM.',
          severity: 'CAT II',
          status: pageVerifyCheck.stdout.trim() === 'COMPLIANT' ? 'Compliant' : pageVerifyCheck.stdout.trim() === 'OPEN' ? 'Open' : 'Unknown',
          discussion: 'Prevents database corruption from being propagated during I/O operations.'
        });
      } catch {
        results.push({ id: '2', vulnId: 'V-2101', title: 'SQL Server must have page verify set to CHECKSUM.', severity: 'CAT II', status: 'Unknown', discussion: 'Unable to check SQL Server configuration.' });
      }

      // Check 3: WSUS Service running
      try {
        const wsusServiceCheck = await powershellService.execute(`
          $service = Get-Service -Name "WsusService" -ErrorAction SilentlyContinue
          if ($service -and $service.Status -eq 'Running') {
            Write-Output "COMPLIANT"
          } else {
            Write-Output "OPEN"
          }
        `, 10000);
        results.push({
          id: '3',
          vulnId: 'V-2554',
          title: 'WSUS service must be running.',
          severity: 'CAT I',
          status: wsusServiceCheck.stdout.trim() === 'COMPLIANT' ? 'Compliant' : 'Open',
          discussion: 'WSUS service (WsusService) must be running for update distribution.'
        });
      } catch {
        results.push({ id: '3', vulnId: 'V-2554', title: 'WSUS service must be running.', severity: 'CAT I', status: 'Unknown', discussion: 'Unable to check WSUS service status.' });
      }

      // Check 4: IIS W3SVC Service running
      try {
        const iisServiceCheck = await powershellService.execute(`
          $service = Get-Service -Name "W3SVC" -ErrorAction SilentlyContinue
          if ($service -and $service.Status -eq 'Running') {
            Write-Output "COMPLIANT"
          } else {
            Write-Output "OPEN"
          }
        `, 10000);
        results.push({
          id: '4',
          vulnId: 'V-9932',
          title: 'IIS W3SVC service must be running.',
          severity: 'CAT I',
          status: iisServiceCheck.stdout.trim() === 'COMPLIANT' ? 'Compliant' : 'Open',
          discussion: 'IIS web service is required for WSUS client communication.'
        });
      } catch {
        results.push({ id: '4', vulnId: 'V-9932', title: 'IIS W3SVC service must be running.', severity: 'CAT I', status: 'Unknown', discussion: 'Unable to check IIS service status.' });
      }

      // Check 5: SQL Server Service running
      try {
        const sqlServiceCheck = await powershellService.execute(`
          $services = Get-Service -Name "MSSQL*" -ErrorAction SilentlyContinue | Where-Object { $_.Status -eq 'Running' }
          if ($services -and $services.Count -gt 0) {
            Write-Output "COMPLIANT"
          } else {
            Write-Output "OPEN"
          }
        `, 10000);
        results.push({
          id: '5',
          vulnId: 'V-3401',
          title: 'SQL Server service must be running.',
          severity: 'CAT I',
          status: sqlServiceCheck.stdout.trim() === 'COMPLIANT' ? 'Compliant' : 'Open',
          discussion: 'SQL Server is required for SUSDB database operations.'
        });
      } catch {
        results.push({ id: '5', vulnId: 'V-3401', title: 'SQL Server service must be running.', severity: 'CAT I', status: 'Unknown', discussion: 'Unable to check SQL Server service status.' });
      }

    } catch {
      // Return default checks if PowerShell fails
      return this.getDefaultChecks();
    }

    return results;
  }
}
