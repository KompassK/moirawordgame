// Step 6 tests: the 'New version available' bar and the install options.
// The service worker itself is tested in Node (tests/sw.test.js); here the
// page side is driven through Pwa's state, as pwa.js sets it when a new worker
// finishes installing. (From file:// pwa.js registers nothing.)

'use strict';

// What pwa.js does when a new worker reaches 'installed' while another controls the page.
function newWorkerWaiting(version = { commit: 'abc1234', dirty: false, builtAt: '2026-11-15T20:30:00.000Z' }) {
  Pwa.updateVersion = version;
  Pwa.updateReady = true;
  Pwa.onChange();
}

function noUpdate() {
  Pwa.updateReady = false;
  Pwa.updateVersion = null;
  Pwa.canInstall = false;
}

test('Update bar: appears on the front card when a new worker is waiting, with the new version\u2019s stamp', () => {
  fresh(); noUpdate(); render();
  assert(!document.querySelector('.update-bar'), 'no bar before');
  newWorkerWaiting();
  const bar = document.querySelector('.front .update-bar');
  assert(bar, 'bar shown (re-rendered by Pwa.onChange)');
  eq(bar.querySelector('.update-bar__text').textContent, 'New version available \u2013 tap to update', 'wording');
  assert(/^v abc1234 \u00b7 15 Nov 2026 \d\d:\d\d$/.test(bar.querySelector('.update-bar__version').textContent), 'new version\u2019s stamp');
  eq(bar.parentElement.firstElementChild, bar, 'at the top of the front card');
  noUpdate();
});

test('Update bar: never mid-game; back on the scoreboard; tapping it applies the update', () => {
  fresh(); noUpdate();
  beginTestGame(2);
  newWorkerWaiting();
  assert(!document.querySelector('.update-bar'), 'not on the turn screen');
  finishTurn(); assert(!document.querySelector('.update-bar'), 'not on the reveal card');
  tap('next'); assert(!document.querySelector('.update-bar'), 'not on the pass-the-device screen');
  tap('nextTurn'); finishTurn(); tap('next');
  eq(state.screen, 'final', 'scoreboard');
  assert(document.querySelector('.final .update-bar'), 'on the scoreboard');
  let applied = 0;
  const real = Pwa.applyUpdate;
  Pwa.applyUpdate = () => { applied++; };
  try { tap('applyUpdate'); } finally { Pwa.applyUpdate = real; }
  eq(applied, 1, 'tapping the bar activates the new worker');
  noUpdate();
});

test('Add to home screen: offered in Settings only when the browser has given us an install prompt', () => {
  fresh(); noUpdate(); render();
  tap('showSettings');
  assert(!document.querySelector('[data-action="installApp"]'), 'no button without a prompt');
  tap('closeOverlay');
  Pwa.canInstall = true; Pwa.onChange();
  tap('showSettings');
  assert(document.querySelector('[data-action="installApp"]'), 'button once the prompt is caught');
  eq(document.querySelector('[data-action="installApp"]').textContent, 'Add to home screen', 'wording');
  tap('closeOverlay');
  noUpdate();
});

test('iPhone hint: shown in Settings on iOS when not running from the home screen, and not otherwise', () => {
  const real = { isIOS: Pwa.isIOS, standalone: Pwa.standalone };
  try {
    fresh(); noUpdate(); render();
    Pwa.isIOS = () => true; Pwa.standalone = () => false;
    tap('showSettings');
    eq(document.querySelector('.install-hint')?.textContent, 'In Safari: Share \u2192 Add to Home Screen', 'hint shown');
    tap('closeOverlay');
    Pwa.standalone = () => true;
    tap('showSettings');
    assert(!document.querySelector('.install-hint'), 'not when already on the home screen');
    tap('closeOverlay');
    Pwa.isIOS = () => false; Pwa.standalone = () => false;
    tap('showSettings');
    assert(!document.querySelector('.install-hint'), 'not on other devices');
    tap('closeOverlay');
  } finally { Object.assign(Pwa, real); }
});
