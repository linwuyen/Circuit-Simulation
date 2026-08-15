const fs = require('fs');
const path = require('path');

const outputPath = path.resolve(process.cwd(), 'playwright-failures.jsonl');

class CiDiagnosticReporter {
  printsToStdio() {
    return true;
  }

  onBegin() {
    try {
      fs.rmSync(outputPath, { force: true });
    } catch (_) {
      // Diagnostics must never change the test result.
    }
  }

  onTestEnd(test, result) {
    if (result.status === 'passed' || result.status === 'skipped') return;

    const error = result.error || (result.errors && result.errors[0]) || {};
    const location = test.location || {};
    const payload = {
      title: test.titlePath().join(' > '),
      status: result.status,
      file: location.file || '',
      line: location.line || 0,
      column: location.column || 0,
      message: error.message || '',
      stack: error.stack || ''
    };
    const line = JSON.stringify(payload);

    console.error('[PWFAIL]' + line);
    try {
      fs.appendFileSync(outputPath, line + '\n', 'utf8');
    } catch (_) {
      // Diagnostics must never change the test result.
    }
  }
}

module.exports = CiDiagnosticReporter;
