// Runs every queued test in order (waiting for async ones), then reports.
// Loaded last by tests/index.html.

(async () => {
  for (const { name, fn } of queued) {
    try { await fn(); results.push({ name, ok: true }); }
    catch (e) { results.push({ name, ok: false, error: e && e.stack || String(e) }); }
  }
  const failed = results.filter(r => !r.ok);
  document.getElementById('results').innerHTML = `
    <h1 class="${failed.length ? 'fail' : 'pass'}">${results.length - failed.length} of ${results.length} tests passed</h1>
    <ol>${results.map(r => `<li class="${r.ok ? 'pass' : 'fail'}">${r.ok ? '✓' : '✗'} ${esc(r.name)}${r.ok ? '' : `<pre>${esc(r.error)}</pre>`}</li>`).join('')}</ol>`;
  document.title = `Sesquipedalian tests: ${failed.length ? 'FAIL' : 'PASS'} (${results.length - failed.length}/${results.length})`;
  console.log(document.title);
  failed.forEach(r => console.error(r.name, r.error));
})();
