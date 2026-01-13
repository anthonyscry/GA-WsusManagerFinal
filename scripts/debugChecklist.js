/**
 * Debugging Checklist Automation Script
 * 
 * Runs automated checks to help identify common debugging scenarios.
 * Use this script before starting a debugging session to gather context.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logSection(title) {
  log('\n' + '='.repeat(60), colors.cyan);
  log(title, colors.cyan);
  log('='.repeat(60), colors.cyan);
}

function checkEnvironment() {
  logSection('🔍 Environment Check');
  
  try {
    const nodeVersion = execSync('node --version', { encoding: 'utf-8' }).trim();
    log(`Node.js: ${nodeVersion}`, colors.green);
  } catch {
    log('Node.js: Not found', colors.red);
  }

  try {
    const npmVersion = execSync('npm --version', { encoding: 'utf-8' }).trim();
    log(`npm: ${npmVersion}`, colors.green);
  } catch {
    log('npm: Not found', colors.red);
  }

  // Check package.json for versions
  try {
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
    log(`\nProject: ${packageJson.name} v${packageJson.version}`, colors.blue);
    
    if (packageJson.dependencies) {
      log('\nKey Dependencies:', colors.yellow);
      if (packageJson.dependencies.react) {
        log(`  React: ${packageJson.dependencies.react}`, colors.green);
      }
      if (packageJson.dependencies.electron) {
        log(`  Electron: ${packageJson.devDependencies?.electron || 'N/A'}`, colors.green);
      }
    }
  } catch (error) {
    log('Failed to read package.json', colors.red);
  }
}

function checkBuild() {
  logSection('🔨 Build Status');
  
  try {
    log('Running TypeScript type check...', colors.yellow);
    execSync('npm run typecheck', { stdio: 'pipe' });
    log('✓ TypeScript: No type errors', colors.green);
  } catch (error) {
    log('✗ TypeScript: Type errors found', colors.red);
    log('Run: npm run typecheck', colors.yellow);
  }

  try {
    log('Checking for linting errors...', colors.yellow);
    execSync('npm run lint', { stdio: 'pipe' });
    log('✓ ESLint: No linting errors', colors.green);
  } catch (error) {
    log('✗ ESLint: Linting errors found', colors.red);
    log('Run: npm run lint', colors.yellow);
  }
}

function checkCommonIssues() {
  logSection('🐛 Common Issue Detection');
  
  const issues = [];
  const warnings = [];
  
  // Check for console.log statements (should use loggingService)
  function checkFile(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const relativePath = path.relative(process.cwd(), filePath);
      
      // Skip node_modules, dist, build
      if (relativePath.includes('node_modules') || 
          relativePath.includes('dist') ||
          relativePath.includes('build') ||
          relativePath.includes('scripts')) {
        return;
      }
      
      // Check for console.log (except in scripts)
      const consoleLogMatches = content.match(/console\.log\(/g);
      if (consoleLogMatches && !relativePath.includes('scripts')) {
        warnings.push(`${relativePath}: Found ${consoleLogMatches.length} console.log() - use loggingService`);
      }
      
      // Check for debugger statements
      if (content.includes('debugger')) {
        issues.push(`${relativePath}: Found debugger statement - remove before production`);
      }
      
      // Check for empty catch blocks
      const emptyCatchMatches = content.match(/catch\s*\([^)]*\)\s*{\s*}/g);
      if (emptyCatchMatches) {
        issues.push(`${relativePath}: Found ${emptyCatchMatches.length} empty catch block(s)`);
      }
      
      // Check for TODO/FIXME in critical files
      if (relativePath.includes('services') || relativePath.includes('components')) {
        const todoMatches = content.match(/(TODO|FIXME|XXX|HACK):/gi);
        if (todoMatches) {
          warnings.push(`${relativePath}: Found ${todoMatches.length} TODO/FIXME comment(s)`);
        }
      }
    } catch (error) {
      // Skip files that can't be read
    }
  }
  
  function walkDir(dir) {
    const files = fs.readdirSync(dir);
    files.forEach(file => {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      if (stat.isDirectory()) {
        // Skip certain directories
        if (!['node_modules', 'dist', 'build', '.git', 'release'].includes(file)) {
          walkDir(filePath);
        }
      } else if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.js')) {
        checkFile(filePath);
      }
    });
  }
  
  try {
    walkDir('.');
  } catch (error) {
    log('Error scanning files', colors.red);
  }
  
  if (issues.length > 0) {
    log('\n⚠️  Issues Found:', colors.red);
    issues.forEach(issue => log(`  - ${issue}`, colors.red));
  } else {
    log('\n✓ No critical issues found', colors.green);
  }
  
  if (warnings.length > 0) {
    log('\n⚠️  Warnings:', colors.yellow);
    warnings.forEach(warning => log(`  - ${warning}`, colors.yellow));
  }
}

function checkKeyFiles() {
  logSection('📁 Key Files Status');
  
  const keyFiles = [
    'services/stateService.ts',
    'services/wsusService.ts',
    'services/sqlService.ts',
    'services/powershellService.ts',
    'services/loggingService.ts',
    'components/Dashboard.tsx',
    'DEBUGGING_RUNBOOK.md'
  ];
  
  keyFiles.forEach(file => {
    if (fs.existsSync(file)) {
      const stats = fs.statSync(file);
      const size = (stats.size / 1024).toFixed(2);
      log(`✓ ${file} (${size} KB)`, colors.green);
    } else {
      log(`✗ ${file} (missing)`, colors.red);
    }
  });
}

function checkDocumentation() {
  logSection('📚 Documentation Status');
  
  const docs = [
    { file: 'DEBUGGING_RUNBOOK.md', desc: 'Main debugging runbook' },
    { file: 'DEBUGGING_QUICK_REFERENCE.md', desc: 'Quick reference guide' },
    { file: 'scripts/debuggingSessionTemplate.md', desc: 'Session template' },
    { file: 'CODE_REVIEW_REPORT.md', desc: 'Code review report' },
    { file: 'ARCHITECTURE_REFACTORING_PLAN.md', desc: 'Architecture plan' }
  ];
  
  docs.forEach(doc => {
    if (fs.existsSync(doc.file)) {
      log(`✓ ${doc.file} - ${doc.desc}`, colors.green);
    } else {
      log(`✗ ${doc.file} - ${doc.desc} (missing)`, colors.red);
    }
  });
}

function generateQuickReport() {
  logSection('📊 Quick Diagnostic Report');
  
  const report = {
    timestamp: new Date().toISOString(),
    environment: {},
    files: {},
    issues: []
  };
  
  // Get environment info
  try {
    report.environment.nodeVersion = execSync('node --version', { encoding: 'utf-8' }).trim();
    report.environment.npmVersion = execSync('npm --version', { encoding: 'utf-8' }).trim();
  } catch {
    // Ignore
  }
  
  // Check key files
  const keyFiles = [
    'services/stateService.ts',
    'services/wsusService.ts',
    'services/sqlService.ts'
  ];
  
  keyFiles.forEach(file => {
    if (fs.existsSync(file)) {
      const stats = fs.statSync(file);
      report.files[file] = {
        exists: true,
        size: stats.size,
        modified: stats.mtime
      };
    } else {
      report.files[file] = { exists: false };
    }
  });
  
  log('Report generated (would be saved to debug-report.json)', colors.blue);
  log('Use this data for debugging sessions', colors.blue);
}

function showUsage() {
  log('\nUsage:', colors.cyan);
  log('  node scripts/debugChecklist.js [options]', colors.yellow);
  log('\nOptions:', colors.cyan);
  log('  --full      Run all checks (default)', colors.yellow);
  log('  --env       Environment check only', colors.yellow);
  log('  --build     Build status check only', colors.yellow);
  log('  --issues    Common issues detection only', colors.yellow);
  log('  --files     Key files status only', colors.yellow);
  log('  --docs      Documentation status only', colors.yellow);
  log('  --report    Generate diagnostic report', colors.yellow);
}

function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    showUsage();
    return;
  }
  
  log('\n' + '='.repeat(60), colors.cyan);
  log('🔍 GA-WsusManager Pro - Debugging Checklist', colors.bright);
  log('='.repeat(60), colors.cyan);
  
  if (args.length === 0 || args.includes('--full')) {
    checkEnvironment();
    checkBuild();
    checkCommonIssues();
    checkKeyFiles();
    checkDocumentation();
    generateQuickReport();
  } else {
    if (args.includes('--env')) checkEnvironment();
    if (args.includes('--build')) checkBuild();
    if (args.includes('--issues')) checkCommonIssues();
    if (args.includes('--files')) checkKeyFiles();
    if (args.includes('--docs')) checkDocumentation();
    if (args.includes('--report')) generateQuickReport();
  }
  
  log('\n' + '='.repeat(60), colors.cyan);
  log('✓ Checklist complete', colors.green);
  log('='.repeat(60) + '\n', colors.cyan);
  
  log('Next steps:', colors.blue);
  log('  1. Review any issues/warnings above', colors.yellow);
  log('  2. Check DEBUGGING_RUNBOOK.md for detailed guidance', colors.yellow);
  log('  3. Use scripts/debuggingSessionTemplate.md to track your session', colors.yellow);
}

if (require.main === module) {
  main();
}

module.exports = { main };
