class CiDiagnosticReporter {
  printsToStdio() {
    return true;
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

    console.error('[PWFAIL]' + JSON.stringify(payload));
  }
}

module.exports = CiDiagnosticReporter;
