/**
 * YouTube Speed Master — content script.
 *
 * P1: rate engine.
 *  - sets <video>.playbackRate beyond YouTube's 2x UI cap
 *  - keeps pitch natural
 *  - survives SPA navigation, video re-creation and YouTube resetting the rate
 *  - leaves ads at 1x
 *
 * No UI yet (P2), no storage yet (P3). Default rate is 1x.
 *
 * Console test (DevTools → Console → context dropdown → "YouTube Speed Master"):
 *   __ytSpeedMaster.setRate(3)
 *   __ytSpeedMaster.info()
 *   __ytSpeedMaster.reset()
 *
 * Or from the page context:
 *   document.dispatchEvent(new CustomEvent('ytsm', { detail: '3' }))
 */
(() => {
  'use strict';

  const LOG_PREFIX = '[YouTube Speed Master]';
  const MIN_RATE = 0.0625; // Chromium lower bound
  const MAX_RATE = 16; // Chromium upper bound
  const EPSILON = 0.001;

  // Content scripts can run twice (reload / bfcache); keep one engine per page.
  if (window.__ytSpeedMaster) return;

  const state = {
    desired: 1,
    enabled: true,
    preservesPitch: true,
    applying: false, // loop guard: true while we are the ones writing playbackRate
    video: null,
  };

  const clampRate = (value) => {
    const rate = Number(value);
    if (!Number.isFinite(rate)) return state.desired;
    const rounded = Math.round(rate * 100) / 100;
    return Math.min(MAX_RATE, Math.max(MIN_RATE, rounded));
  };

  const getVideo = () =>
    document.querySelector('video.html5-main-video') || document.querySelector('video');

  const isAdShowing = () =>
    Boolean(document.querySelector('#movie_player.ad-showing, .html5-video-player.ad-showing'));

  const setPitch = (video) => {
    const value = state.preservesPitch;
    if ('preservesPitch' in video) video.preservesPitch = value;
    if ('webkitPreservesPitch' in video) video.webkitPreservesPitch = value;
  };

  const writeRate = (video, rate) => {
    if (Math.abs(video.playbackRate - rate) < EPSILON) return;
    state.applying = true;
    video.playbackRate = rate;
    // ratechange fires synchronously, so the flag can drop on the next task.
    setTimeout(() => {
      state.applying = false;
    }, 0);
  };

  const apply = () => {
    const video = getVideo();
    if (!video) return;

    if (video !== state.video) {
      state.video = video;
    }
    setPitch(video);

    if (!state.enabled) return;

    // Ads stay at 1x: safer and avoids interfering with ad playback.
    writeRate(video, isAdShowing() ? 1 : state.desired);
  };

  let applyTimer = 0;
  const scheduleApply = (delay = 0) => {
    if (applyTimer) return;
    applyTimer = window.setTimeout(() => {
      applyTimer = 0;
      apply();
    }, delay);
  };

  // --- Console / automation API -------------------------------------------------

  const api = {
    setRate: (rate) => {
      state.desired = clampRate(rate);
      apply();
      return state.desired;
    },
    getRate: () => state.desired,
    reset: () => api.setRate(1),
    setPitch: (on) => {
      state.preservesPitch = Boolean(on);
      apply();
      return state.preservesPitch;
    },
    enable: (on = true) => {
      state.enabled = Boolean(on);
      apply();
      return state.enabled;
    },
    info: () => {
      const video = getVideo();
      return {
        desired: state.desired,
        applied: video ? video.playbackRate : null,
        enabled: state.enabled,
        preservesPitch: state.preservesPitch,
        ad: isAdShowing(),
        hasVideo: Boolean(video),
      };
    },
    apply,
  };

  Object.defineProperty(window, '__ytSpeedMaster', { value: api, configurable: true });

  // Primitive-only bridge so the page console can drive the engine too.
  document.addEventListener('ytsm', (event) => {
    if (typeof event.detail !== 'string') return;
    const command = event.detail.trim().toLowerCase();
    if (!command) return;

    if (command === 'info') {
      console.log(`${LOG_PREFIX} info`, api.info());
    } else if (command === 'reset') {
      api.reset();
    } else if (command === 'pitch on' || command === 'pitch off') {
      api.setPitch(command.endsWith('on'));
    } else if (command === 'on' || command === 'off') {
      api.enable(command === 'on');
    } else if (Number.isFinite(Number(command))) {
      api.setRate(Number(command));
    }
  });

  // --- YouTube fights back -----------------------------------------------------

  // YouTube and its player write playbackRate at random times. Re-force ours.
  document.addEventListener(
    'ratechange',
    (event) => {
      const video = event.target;
      if (!(video instanceof HTMLVideoElement)) return;
      if (video !== state.video || state.applying || !state.enabled) return;

      const target = isAdShowing() ? 1 : state.desired;
      if (Math.abs(video.playbackRate - target) > EPSILON) writeRate(video, target);
    },
    true
  );

  // New video / metadata loaded / element recreated.
  for (const type of ['loadedmetadata', 'loadeddata', 'canplay', 'play', 'playing', 'emptied']) {
    document.addEventListener(
      type,
      (event) => {
        if (event.target instanceof HTMLVideoElement) scheduleApply();
      },
      true
    );
  }

  // SPA navigation: /watch?v=... swaps the player without a page load.
  for (const type of ['yt-navigate-finish', 'yt-page-data-updated', 'yt-navigate-start']) {
    document.addEventListener(type, () => scheduleApply(300));
  }

  const observer = new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node.nodeType !== Node.ELEMENT_NODE) continue;
        const element = /** @type {Element} */ (node);
        if (element.tagName === 'VIDEO' || element.querySelector('video')) {
          scheduleApply(120);
          return;
        }
      }
      for (const node of record.removedNodes) {
        if (node.nodeType !== Node.ELEMENT_NODE) continue;
        const element = /** @type {Element} */ (node);
        if (element === state.video || element.querySelector('video')) {
          state.video = null;
          return;
        }
      }
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  // Safety net: ads toggling a class, or a player rebuild we did not observe.
  window.setInterval(apply, 1000);

  apply();
  console.log(`${LOG_PREFIX} engine ready (P1). Try __ytSpeedMaster.setRate(3)`);
})();
