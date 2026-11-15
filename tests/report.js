// Runs every queued test in order (waiting for async ones), then reports.
// Loaded last by tests/index.html.
//
// On live data (?data=live) a failure's message could contain a word or quote
// (e.g. an eq() on the tester panel), so only where it failed is shown.

(async () => {
  for (const { name, fn, skip } of queued) {
    if (skip) { results.push({ name, ok: true, skipped: skip }); continue; }
    try { await fn(); results.push({ name, ok: true }); }
    catch (e) {
      const stack = (e && e.stack) || String(e);
      // The first frame outside the harness's assert()/eq() helpers.
      const frames = stack.match(/tests\/[\w.]+\.js:\d+/g) || [];
      const where = frames.find(f => !/^tests\/step3\.test\.js:(\d)\d?$/.test(f) || +f.split(':')[1] > 30) || 'unknown place';
      results.push({ name, ok: false, error: LIVE ? `failed at ${where} (details hidden: live data)` : stack });
    }
  }
  const failed = results.filter(r => !r.ok);
  const skipped = results.filter(r => r.skipped);
  const ran = results.length - skipped.length;
  const label = `${LIVE ? 'live' : 'dummy'} data`;
  document.getElementById('results').innerHTML = `
    <h1 class="${failed.length ? 'fail' : 'pass'}">${ran - failed.length} of ${ran} tests passed (${label}, ${skipped.length} skipped)</h1>
    <ol>${results.map(r => `<li class="${r.ok ? 'pass' : 'fail'}">${r.skipped ? '–' : r.ok ? '✓' : '✗'} ${esc(r.name)}${r.skipped ? ` <small>(${esc(r.skipped)})</small>` : ''}${r.ok ? '' : `<pre>${esc(r.error)}</pre>`}</li>`).join('')}</ol>`;
  document.title = `Sesquipedalian tests: ${failed.length ? 'FAIL' : 'PASS'} (${ran - failed.length}/${ran}, ${label}, ${skipped.length} skipped)`;
  console.log(document.title);
  failed.forEach(r => console.error(r.name, r.error));
})();
