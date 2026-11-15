// Sesquipedalian – installable, offline app (step 6).
// Registers the service worker (sw.js), notices when a new version is waiting,
// and handles 'Add to home screen'. game.js decides where to show things:
// it sets Pwa.onChange and reads the flags below.
//
// Service workers need http(s), so from file:// (double-clicking index.html)
// none of this runs and the game simply plays without offline caching.

'use strict';

const Pwa = (() => {
  const api = {
    updateReady: false,     // a new version is installed and waiting
    updateVersion: null,    // its { commit, dirty, builtAt }, for the bar
    canInstall: false,      // Android/Chrome: we hold a deferred install prompt
    onChange: () => {},     // game.js re-renders when any of this changes
  };
  let registration = null;
  let installPrompt = null;
  let reloading = false;

  const changed = () => { try { api.onChange(); } catch (e) { /* never break the game */ } };

  // Ask a worker for its version (the bar shows it, to match against commits).
  function askVersion(worker) {
    return new Promise(resolve => {
      const channel = new MessageChannel();
      const timer = setTimeout(() => resolve(null), 2000);
      channel.port1.onmessage = e => { clearTimeout(timer); resolve(e.data); };
      worker.postMessage({ type: 'GET_VERSION' }, [channel.port2]);
    });
  }

  async function waiting(worker) {
    api.updateVersion = await askVersion(worker);
    api.updateReady = true;
    changed();
  }

  // A worker that finishes installing while another controls the page is an update.
  function watch(worker) {
    if (!worker) return;
    worker.addEventListener('statechange', () => {
      if (worker.state === 'installed' && navigator.serviceWorker.controller) waiting(worker);
    });
  }

  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    navigator.serviceWorker.register('./sw.js').then(reg => {
      registration = reg;
      if (reg.waiting && navigator.serviceWorker.controller) waiting(reg.waiting);
      watch(reg.installing);
      reg.addEventListener('updatefound', () => watch(reg.installing));
    }).catch(() => { /* no offline support this time; the game still plays */ });

    // After the player taps the bar, the new worker takes over: reload once.
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloading || !api.updateReady) return;
      reloading = true;
      location.reload();
    });
  }

  // Look for a new version (called when the front card or scoreboard shows),
  // at most once a minute.
  let lastCheck = 0;
  api.checkForUpdate = () => {
    if (!registration || Date.now() - lastCheck < 60000) return;
    lastCheck = Date.now();
    registration.update().catch(() => {});
  };

  // Tap on the bar: let the waiting worker take over (the reload follows).
  api.applyUpdate = () => {
    const w = registration && registration.waiting;
    if (w) w.postMessage({ type: 'SKIP_WAITING' });
    else location.reload();
  };

  // --- Add to home screen ---
  // Android/Chrome: hold the browser's prompt and offer it from Settings instead
  // of letting it pop up uninvited.
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    installPrompt = e;
    api.canInstall = true;
    changed();
  });
  window.addEventListener('appinstalled', () => {
    installPrompt = null;
    api.canInstall = false;
    changed();
  });
  api.promptInstall = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    try { await installPrompt.userChoice; } catch (e) { /* dismissed */ }
    installPrompt = null;
    api.canInstall = false;
    changed();
  };

  // iPhone/iPad have no prompt: Settings shows a one-line hint instead, unless
  // the game is already running from the home screen.
  api.standalone = () => Boolean(navigator.standalone) || window.matchMedia('(display-mode: standalone)').matches;
  api.isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  return api;
})();
