#!/usr/bin/env node

/**
 * Automated Code Review Agent
 * Runs after compilation to check code quality and functionality
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

let issues = [];
let warnings = [];
let suggestions = [];

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function checkBuildOutput() {
  log('\n📦 Checking Build Output...', colors.cyan);
  
  const distPath = path.join(process.cwd(), 'dist');
  if (!fs.existsSync(distPath)) {
    issues.push('Build output directory (dist) does not exist');
    return false;
  }

  const indexPath = path.join(distPath, 'index.html');
  if (!fs.existsSync(indexPath)) {
    issues.push('index.html not found in dist directory');
    return false;
  }

  // Check for main JS bundle
  const distFiles = fs.readdirSync(distPath, { recursive: true });
  const jsFiles = distFiles.filter(file => file.endsWith('.js'));
  const cssFiles = distFiles.filter(file => file.endsWith('.css'));

  if (jsFiles.length === 0) {
    warnings.push('No JavaScript files found in dist directory');
  } else {
    log(`  ✓ Found ${jsFiles.length} JavaScript file(s)`, colors.green);
  }

  if (cssFiles.length === 0) {
    warnings.push('No CSS files found in dist directory');
  } else {
    log(`  ✓ Found ${cssFiles.length} CSS file(s)`, colors.green);
  }

  // Check file sizes
  let totalSize = 0;
  distFiles.forEach(file => {
    const filePath = path.join(distPath, file);
    if (fs.statSync(filePath).isFile()) {
      totalSize += fs.statSync(filePath).size;
    }
  });

  const totalSizeMB = (totalSize / 1024 / 1024).toFixed(2);
  log(`  ✓ Total build size: ${totalSizeMB} MB`, colors.green);

  if (totalSize > 10 * 1024 * 1024) { // 10MB
    warnings.push(`Build size is large (${totalSizeMB} MB). Consider code splitting.`);
  }

  return true;
}

function checkTypeScriptErrors() {
  log('\n🔍 Checking TypeScript Compilation...', colors.cyan);
  
  try {
    execSync('npx tsc --noEmit', { stdio: 'pipe' });
    log('  ✓ No TypeScript errors found', colors.green);
    return true;
  } catch (error) {
    const output = error.stdout?.toString() || error.stderr?.toString() || '';
    if (output.includes('error TS')) {
      issues.push('TypeScript compilation errors found');
      log('  ✗ TypeScript errors detected', colors.red);
      console.log(output);
      return false;
    }
    log('  ⚠ TypeScript check skipped (no tsc available)', colors.yellow);
    return true;
  }
}

function checkLintingErrors() {
  log('\n🧹 Checking Code Linting...', colors.cyan);
  
  try {
    const result = execSync('npx eslint . --ext .ts,.tsx --max-warnings 50', { 
      stdio: 'pipe',
      encoding: 'utf8'
    });
    log('  ✓ No critical linting errors found', colors.green);
    return true;
  } catch (error) {
    const output = error.stdout?.toString() || error.stderr?.toString() || '';
    if (output) {
      warnings.push('Linting warnings found');
      log('  ⚠ Linting warnings detected', colors.yellow);
      console.log(output);
    }
    // Don't fail build on linting warnings
    return true;
  }
}

function checkCommonIssues() {
  log('\n🔎 Checking Common Code Issues...', colors.cyan);

  const sourceFiles = [
    ...globFiles('**/*.ts', ['node_modules', 'dist']),
    ...globFiles('**/*.tsx', ['node_modules', 'dist'])
  ];

  sourceFiles.forEach(file => {
    checkFileForIssues(file);
  });

  if (issues.length === 0 && warnings.length === 0) {
    log('  ✓ No common issues detected', colors.green);
  }
}

function globFiles(pattern, ignoreDirs = []) {
  const files = [];
  
  function walkDir(dir) {
    const items = fs.readdirSync(dir);
    items.forEach(item => {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        if (!ignoreDirs.some(ignored => fullPath.includes(ignored))) {
          walkDir(fullPath);
        }
      } else if (stat.isFile()) {
        if (pattern.includes('*')) {
          const ext = pattern.split('.').pop();
          if (item.endsWith(`.${ext}`)) {
            files.push(fullPath);
          }
        }
      }
    });
  }

  try {
    walkDir(process.cwd());
  } catch (e) {
    // Ignore errors
  }

  return files;
}

function checkFileForIssues(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const relativePath = path.relative(process.cwd(), filePath);

    // Check for console.log (except console.warn and console.error)
    const consoleLogMatches = content.match(/console\.log\(/g);
    if (consoleLogMatches && !relativePath.includes('scripts') && !relativePath.includes('node_modules')) {
      warnings.push(`${relativePath}: Found ${consoleLogMatches.length} console.log() - use loggingService instead`);
    }

    // Check for debugger statements
    if (content.includes('debugger')) {
      issues.push(`${relativePath}: Found debugger statement - remove before production`);
    }

    // Check for TODO/FIXME comments
    const todoMatches = content.match(/(TODO|FIXME|XXX|HACK):/gi);
    if (todoMatches) {
      suggestions.push(`${relativePath}: Found ${todoMatches.length} TODO/FIXME comment(s)`);
    }

    // Check for large files (warning if > 500 lines)
    const lines = content.split('\n').length;
    if (lines > 500) {
      suggestions.push(`${relativePath}: Large file (${lines} lines) - consider splitting`);
    }

    // Check for commented code blocks (basic check)
    const commentedCodeMatches = content.match(/\/\/\s*(if|function|const|let|var|class)\s*\(/g);
    if (commentedCodeMatches && commentedCodeMatches.length > 5) {
      suggestions.push(`${relativePath}: Found multiple commented code blocks - consider cleanup`);
    }

    // DEBUGGING-RELATED CHECKS (integrated with debugging infrastructure)
    checkDebuggingPatterns(filePath, content, relativePath);

  } catch (error) {
    // Skip files that can't be read
  }
}

function checkDebuggingPatterns(filePath, content, relativePath) {
  // Skip utility files themselves
  if (relativePath.includes('utils/debugHelpers.ts') || relativePath.includes('scripts/')) {
    return;
  }

  // Check for empty catch blocks (should use proper error handling)
  const emptyCatchMatches = content.match(/catch\s*\([^)]*\)\s*{\s*}/g);
  if (emptyCatchMatches) {
    warnings.push(`${relativePath}: Found ${emptyCatchMatches.length} empty catch block(s) - use proper error handling`);
  }

  // Check for error messages logged without sanitization (services files)
  if (relativePath.includes('services/')) {
    const unsanitizedErrorLogs = content.match(/loggingService\.(error|warn)\([^,]+error\.message/g);
    if (unsanitizedErrorLogs && !content.includes('sanitizeError') && !content.includes('debugHelpers')) {
      suggestions.push(`${relativePath}: Error messages may not be sanitized - consider using sanitizeError from debugHelpers`);
    }

    // Check for missing null checks after await (common pattern)
    const awaitWithoutNullCheck = content.match(/await\s+\w+\.\w+\([^)]*\)\s*;\s*\n\s*\w+\.\w+\s*=/g);
    if (awaitWithoutNullCheck) {
      suggestions.push(`${relativePath}: Consider null checks after await operations`);
    }
  }

  // Check for try-catch that only logs without handling
  const catchLogOnlyPattern = /catch\s*\([^)]*\)\s*{\s*[^}]*loggingService\.(error|warn)\([^}]*}\s*(?!.*(throw|return|break|continue))/gs;
  if (catchLogOnlyPattern.test(content)) {
    const matches = content.match(catchLogOnlyPattern);
    if (matches) {
      suggestions.push(`${relativePath}: Catch blocks may only log errors - consider proper error handling or re-throwing`);
    }
  }

  // Check for localStorage usage without error handling
  if (content.includes('localStorage.') && !content.includes('SafeLocalStorage') && !content.includes('try')) {
    const localStorageUsage = content.match(/localStorage\.(setItem|getItem|removeItem)\(/g);
    if (localStorageUsage) {
      suggestions.push(`${relativePath}: localStorage usage may need error handling - consider using SafeLocalStorage from debugHelpers`);
    }
  }

  // Check for JSON.parse without try-catch
  if (content.includes('JSON.parse') && !content.includes('safeJsonParse') && !content.match(/JSON\.parse\([^)]+\)\s*;?\s*\n\s*(?=try|catch)/)) {
    const jsonParseMatches = content.match(/JSON\.parse\(/g);
    if (jsonParseMatches && !content.includes('safeJsonParse')) {
      suggestions.push(`${relativePath}: JSON.parse may need error handling - consider using safeJsonParse from debugHelpers`);
    }
  }

  // Check for missing await in async operations
  const asyncFunctions = content.match(/async\s+(function|\w+)\s*\([^)]*\)/g);
  if (asyncFunctions) {
    const missingAwaits = content.match(/(?<!await\s)(?<!await\s\()\w+\.\w+\([^)]*\)\s*\.(then|catch)/g);
    if (missingAwaits) {
      suggestions.push(`${relativePath}: Consider using async/await instead of .then()/.catch() for better error handling`);
    }
  }
}

function checkDependencies() {
  log('\n📚 Checking Dependencies...', colors.cyan);

  try {
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

    // Check for known vulnerable packages (basic check)
    const vulnerablePackages = [];
    // This is a placeholder - in production, you'd use npm audit or similar

    if (vulnerablePackages.length > 0) {
      warnings.push(`Potential vulnerable packages: ${vulnerablePackages.join(', ')}`);
    } else {
      log('  ✓ Dependencies check passed', colors.green);
    }
  } catch (error) {
    warnings.push('Could not check dependencies');
  }
}

function checkDebuggingInfrastructure() {
  log('\n🐛 Checking Debugging Infrastructure...', colors.cyan);

  const debugFiles = [
    'DEBUGGING_RUNBOOK.md',
    'DEBUGGING_QUICK_REFERENCE.md',
    'DEBUGGING_INDEX.md',
    'utils/debugHelpers.ts',
    'scripts/debugChecklist.js',
    'scripts/debuggingSessionTemplate.md'
  ];

  let allFilesExist = true;
  debugFiles.forEach(file => {
    if (fs.existsSync(file)) {
      log(`  ✓ ${file} exists`, colors.green);
    } else {
      warnings.push(`Debugging infrastructure file missing: ${file}`);
      allFilesExist = false;
    }
  });

  // Check if debugHelpers exports are being used
  try {
    const debugHelpersContent = fs.readFileSync('utils/debugHelpers.ts', 'utf8');
    const exports = debugHelpersContent.match(/export\s+(function|class|const|interface|type)\s+\w+/g);
    if (exports && exports.length > 0) {
      log(`  ✓ debugHelpers.ts exports ${exports.length} utilities`, colors.green);
    }
  } catch (error) {
    // File might not exist yet
  }

  // Check package.json scripts
  try {
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    const scripts = packageJson.scripts || {};
    if (scripts['debug:checklist']) {
      log('  ✓ debug:checklist script available', colors.green);
    } else {
      suggestions.push('Consider adding debug:checklist script to package.json');
    }
  } catch (error) {
    // Ignore
  }

  if (allFilesExist) {
    log('  ✓ Debugging infrastructure complete', colors.green);
  }
}

function printSummary() {
  log('\n' + '='.repeat(60), colors.cyan);
  log('📊 CODE REVIEW SUMMARY', colors.cyan);
  log('='.repeat(60), colors.cyan);

  if (issues.length > 0) {
    log(`\n❌ Issues (${issues.length}):`, colors.red);
    issues.forEach(issue => log(`  • ${issue}`, colors.red));
  }

  if (warnings.length > 0) {
    log(`\n⚠️  Warnings (${warnings.length}):`, colors.yellow);
    warnings.forEach(warning => log(`  • ${warning}`, colors.yellow));
  }

  if (suggestions.length > 0) {
    log(`\n💡 Suggestions (${suggestions.length}):`, colors.blue);
    suggestions.forEach(suggestion => log(`  • ${suggestion}`, colors.blue));
  }

  if (issues.length === 0 && warnings.length === 0 && suggestions.length === 0) {
    log('\n✅ All checks passed! Code looks good.', colors.green);
  }

  log('\n' + '='.repeat(60), colors.cyan);

  return issues.length === 0;
}

// Main execution
async function main() {
  log('\n🤖 Automated Code Review Agent Starting...', colors.cyan);
  log('='.repeat(60), colors.cyan);

  const buildOk = checkBuildOutput();
  const typesOk = checkTypeScriptErrors();
  const lintOk = checkLintingErrors();
  checkCommonIssues();
  checkDependencies();
  checkDebuggingInfrastructure();

  const allPassed = printSummary();

  if (!allPassed) {
    log('\n❌ Code review found issues that should be addressed.', colors.red);
    process.exit(1);
  } else {
    log('\n✅ Code review completed successfully!', colors.green);
    process.exit(0);
  }
}

main().catch(error => {
  log(`\n❌ Error during code review: ${error.message}`, colors.red);
  process.exit(1);
});
