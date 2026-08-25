(() => {
  "use strict";
  const Board = window.CircuitBoardEvidenceV1;
  if (!Board) return;
  const $ = selector => document.querySelector(selector);
  let currentManifest = null;

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function failClosed(message) {
    currentManifest = null;
    $('#evidenceCount').textContent = '0/8';
    $('#boardClaim').textContent = 'UNCLAIMED';
    $('#boardClaim').dataset.pass = '0';
    $('#boardBindingTable').innerHTML = '';
    $('#boardEvidence').innerHTML = '';
    $('#boardManifestStatus').textContent = message;
    $('#boardBoundary').textContent = 'Fail-closed：沒有通過 machine-readable manifest，就沒有任何 BOARD evidence claim。';
  }

  function render(manifest, sourceLabel) {
    currentManifest = manifest;
    const result = Board.validateManifest(manifest);
    $('#evidenceCount').textContent = `${result.evidenceRows.filter(row => row.passed).length}/${result.evidenceRows.length}`;
    $('#boardClaim').textContent = result.computedClaim;
    $('#boardClaim').dataset.pass = result.computedClaim === 'BOARD_PASS' ? '1' : '0';
    $('#boardManifestStatus').innerHTML = `<b>${escapeHtml(sourceLabel)}</b> · Target build ${result.targetBuildPassed ? 'PASS' : 'MISSING'} · Bindings ${result.bindingRows.filter(row => row.verified).length}/${result.bindingRows.length} · Physical evidence ${result.evidenceRows.filter(row => row.passed).length}/${result.evidenceRows.length}`;
    $('#boardBindingTable').innerHTML = result.bindingRows.map(row => `<tr><td>${escapeHtml(row.id)}</td><td>${row.verified ? 'VERIFIED' : escapeHtml(row.status)}</td><td>${escapeHtml(row.source || '—')}</td></tr>`).join('');
    $('#boardEvidence').innerHTML = result.evidenceRows.map(row => `<article class="evidence-slot ${row.passed ? 'is-pass' : ''}"><span><b>${escapeHtml(row.id.toUpperCase())} · ${row.passed ? 'PASS' : escapeHtml(row.status)}</b><small>${escapeHtml(row.criterion)}</small><small>artifact: ${escapeHtml(row.artifact || '—')}</small></span></article>`).join('');
    $('#boardBoundary').textContent = result.computedClaim === 'BOARD_PASS'
      ? 'BOARD_PASS 的 machine gate 已滿足；此 manifest 必須仍由真實 artifact/source 支持，不能用 synthetic capture。'
      : `Fail-closed：缺 ${result.missingBindings.length} 個 bindings、${result.missingEvidence.length} 個 physical captures。瀏覽器不會替它們打勾。`;
  }

  async function loadReference() {
    failClosed('loading repository reference manifest…');
    try {
      const response = await fetch('board/board-binding.reference.json', { cache:'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      render(await response.json(), 'repository reference manifest');
    } catch (error) {
      failClosed(`Manifest load failed: ${error.message}`);
    }
  }

  $('#boardManifestFile')?.addEventListener('change', async event => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    failClosed(`validating local manifest: ${file.name}…`);
    try {
      const manifest = JSON.parse(await file.text());
      Board.assertBoardPass(manifest);
      render(manifest, `local manifest: ${file.name}`);
    } catch (error) {
      failClosed(`REJECTED: ${error.message}`);
    }
  });

  $('#boardDownload')?.addEventListener('click', () => {
    if (!currentManifest) return;
    const blob = new Blob([JSON.stringify(currentManifest, null, 2) + '\n'], { type:'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'board-binding-evidence.json';
    link.click();
    URL.revokeObjectURL(link.href);
  });

  function loadExtension(src, onload) {
    const extension = document.createElement('script');
    extension.src = src;
    if (onload) extension.addEventListener('load', onload, { once:true });
    document.body.appendChild(extension);
  }

  function loadPrecisionTeaching() {
    if (!document.querySelector('link[data-precision-teaching]')) {
      const style = document.createElement('link');
      style.rel = 'stylesheet';
      style.href = 'precision-teaching-v1.css';
      style.dataset.precisionTeaching = '1';
      document.head.appendChild(style);
    }
    loadExtension('precision-teaching-v1.js');
  }

  loadReference();
  loadExtension('physical-closure-ui.js', loadPrecisionTeaching);
})();