/**
 * WSUS Air-Gap Operations (Export/Import to removable media)
 */

import { powershellService } from '../powershellService';
import { loggingService } from '../loggingService';
import type { ExportResult, ImportResult } from './types';

/**
 * Export WSUS data for air-gap transfer
 */
export async function exportToMedia(
  mediaPath: string,
  exportType: 'Full' | 'Differential' = 'Differential',
  maxDays: number = 30
): Promise<ExportResult> {
  try {
    // Validate path
    if (!mediaPath || mediaPath.length > 260) {
      throw new Error('Invalid media path');
    }

    // Sanitize path
    const sanitizedPath = mediaPath.replace(/[<>"|?*]/g, '').replace(/'/g, "''");

    const script = `
      $mediaPath = '${sanitizedPath}'
      $exportType = '${exportType}'
      $maxDays = ${maxDays}
      $errors = @()
      $exportedCount = 0
      $totalSize = 0
      
      Write-Output "[EXPORT] Starting WSUS export to $mediaPath..."
      Write-Output "[EXPORT] Type: $exportType, Max Age: $maxDays days"
      
      # Create export directory structure
      $exportDir = Join-Path $mediaPath 'WsusExport'
      $metadataDir = Join-Path $exportDir 'Metadata'
      $contentDir = Join-Path $exportDir 'Content'
      
      try {
        New-Item -ItemType Directory -Path $exportDir -Force | Out-Null
        New-Item -ItemType Directory -Path $metadataDir -Force | Out-Null
        New-Item -ItemType Directory -Path $contentDir -Force | Out-Null
        Write-Output "[EXPORT] Created export directories"
      } catch {
        $errors += "Failed to create export directories: $_"
      }
      
      try {
        $wsus = Get-WsusServer -Name localhost -PortNumber 8530
        $cutoffDate = (Get-Date).AddDays(-$maxDays)
        
        # Get approved updates within date range
        Write-Output "[EXPORT] Finding approved updates..."
        $updates = Get-WsusUpdate -UpdateServer $wsus | Where-Object {
          $_.Update.IsApproved -eq $true -and
          $_.Update.IsDeclined -eq $false -and
          ($exportType -eq 'Full' -or $_.Update.CreationDate -ge $cutoffDate)
        }
        
        $total = ($updates | Measure-Object).Count
        Write-Output "[EXPORT] Found $total updates to export"
        
        # Export metadata using wsusutil
        Write-Output "[EXPORT] Exporting metadata..."
        $wsusUtilPath = 'C:\\Program Files\\Update Services\\Tools\\wsusutil.exe'
        if (Test-Path $wsusUtilPath) {
          $metadataFile = Join-Path $metadataDir "wsus_metadata_$(Get-Date -Format 'yyyyMMdd_HHmmss').xml.gz"
          & $wsusUtilPath export $metadataFile (Join-Path $metadataDir 'export.log')
          if ($LASTEXITCODE -eq 0) {
            Write-Output "[EXPORT] Metadata exported successfully"
            $exportedCount = $total
            if (Test-Path $metadataFile) {
              $totalSize += (Get-Item $metadataFile).Length / 1GB
            }
          } else {
            $errors += "wsusutil export failed with code $LASTEXITCODE"
          }
        } else {
          $errors += "wsusutil.exe not found at expected path"
        }
        
        # Export manifest with update list
        Write-Output "[EXPORT] Creating export manifest..."
        $manifest = @{
          ExportDate = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss')
          ExportType = $exportType
          MaxAgeDays = $maxDays
          UpdateCount = $total
          Updates = $updates | Select-Object -First 1000 | ForEach-Object {
            @{
              UpdateId = $_.Update.Id.UpdateId.ToString()
              Title = $_.Update.Title
              Classification = $_.Update.UpdateClassificationTitle
              CreationDate = $_.Update.CreationDate.ToString('yyyy-MM-dd')
            }
          }
        }
        $manifest | ConvertTo-Json -Depth 3 | Out-File (Join-Path $exportDir 'manifest.json')
        
      } catch {
        $errors += "Export failed: $_"
      }
      
      Write-Output "[EXPORT] Export complete. Updates: $exportedCount, Size: $([math]::Round($totalSize, 2)) GB"
      
      [PSCustomObject]@{
        Success = ($errors.Count -eq 0)
        ExportedUpdates = $exportedCount
        SizeGB = [math]::Round($totalSize, 2)
        Errors = $errors
      } | ConvertTo-Json -Compress
    `;

    loggingService.info(`[WSUS] Exporting to ${mediaPath}...`);
    const result = await powershellService.execute(script, 3600000); // 1 hour timeout

    if (result.stdout) {
      result.stdout.split('\n').forEach(line => {
        if (line.trim().startsWith('[EXPORT]')) {
          loggingService.info(line.trim());
        }
      });
    }

    if (result.success && result.stdout) {
      try {
        const jsonMatch = result.stdout.match(/\{.*"Success".*\}/s);
        if (jsonMatch) {
          const data = JSON.parse(jsonMatch[0]);
          return {
            success: data.Success || false,
            exportedUpdates: data.ExportedUpdates || 0,
            sizeGB: data.SizeGB || 0,
            errors: data.Errors || []
          };
        }
      } catch {
        loggingService.warn('[WSUS] Failed to parse exportToMedia response');
      }
    }

    return { success: false, exportedUpdates: 0, sizeGB: 0, errors: ['Export failed'] };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    loggingService.error(`Error exporting to media: ${errorMessage}`);
    return { success: false, exportedUpdates: 0, sizeGB: 0, errors: [errorMessage] };
  }
}

/**
 * Import WSUS data from air-gap media
 */
export async function importFromMedia(mediaPath: string): Promise<ImportResult> {
  try {
    // Validate path
    if (!mediaPath || mediaPath.length > 260) {
      throw new Error('Invalid media path');
    }

    // Sanitize path
    const sanitizedPath = mediaPath.replace(/[<>"|?*]/g, '').replace(/'/g, "''");

    const script = `
      $mediaPath = '${sanitizedPath}'
      $errors = @()
      $importedCount = 0
      
      Write-Output "[IMPORT] Starting WSUS import from $mediaPath..."
      
      $exportDir = Join-Path $mediaPath 'WsusExport'
      $metadataDir = Join-Path $exportDir 'Metadata'
      
      # Verify export exists
      if (-not (Test-Path $exportDir)) {
        $errors += "Export directory not found: $exportDir"
        [PSCustomObject]@{ Success = $false; ImportedUpdates = 0; Errors = $errors } | ConvertTo-Json -Compress
        exit
      }
      
      # Read manifest
      $manifestPath = Join-Path $exportDir 'manifest.json'
      if (Test-Path $manifestPath) {
        $manifest = Get-Content $manifestPath | ConvertFrom-Json
        Write-Output "[IMPORT] Found export from $($manifest.ExportDate) with $($manifest.UpdateCount) updates"
      }
      
      try {
        # Find metadata file
        $metadataFiles = Get-ChildItem -Path $metadataDir -Filter '*.xml.gz' | Sort-Object LastWriteTime -Descending
        if ($metadataFiles.Count -eq 0) {
          $errors += "No metadata files found in $metadataDir"
        } else {
          $metadataFile = $metadataFiles[0].FullName
          Write-Output "[IMPORT] Importing from $metadataFile..."
          
          # Import using wsusutil
          $wsusUtilPath = 'C:\\Program Files\\Update Services\\Tools\\wsusutil.exe'
          if (Test-Path $wsusUtilPath) {
            & $wsusUtilPath import $metadataFile (Join-Path $metadataDir 'import.log')
            if ($LASTEXITCODE -eq 0) {
              Write-Output "[IMPORT] Metadata imported successfully"
              $importedCount = $manifest.UpdateCount
            } else {
              $errors += "wsusutil import failed with code $LASTEXITCODE"
            }
          } else {
            $errors += "wsusutil.exe not found at expected path"
          }
        }
        
      } catch {
        $errors += "Import failed: $_"
      }
      
      Write-Output "[IMPORT] Import complete. Updates: $importedCount"
      
      [PSCustomObject]@{
        Success = ($errors.Count -eq 0)
        ImportedUpdates = $importedCount
        Errors = $errors
      } | ConvertTo-Json -Compress
    `;

    loggingService.info(`[WSUS] Importing from ${mediaPath}...`);
    const result = await powershellService.execute(script, 3600000); // 1 hour timeout

    if (result.stdout) {
      result.stdout.split('\n').forEach(line => {
        if (line.trim().startsWith('[IMPORT]')) {
          loggingService.info(line.trim());
        }
      });
    }

    if (result.success && result.stdout) {
      try {
        const jsonMatch = result.stdout.match(/\{.*"Success".*\}/s);
        if (jsonMatch) {
          const data = JSON.parse(jsonMatch[0]);
          return {
            success: data.Success || false,
            importedUpdates: data.ImportedUpdates || 0,
            errors: data.Errors || []
          };
        }
      } catch {
        loggingService.warn('[WSUS] Failed to parse importFromMedia response');
      }
    }

    return { success: false, importedUpdates: 0, errors: ['Import failed'] };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    loggingService.error(`Error importing from media: ${errorMessage}`);
    return { success: false, importedUpdates: 0, errors: [errorMessage] };
  }
}
