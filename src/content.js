/**
 * YouTube Speed Master — content script.
 *
 * P1: rate engine.
 *  - sets <video>.playbackRate beyond YouTube's 2x UI cap
 *  - keeps pitch natural
 *  - survives SPA navigation, video re-creation and YouTube resetting the rate
 *  - leaves ads at 1x
 *
 * P2: overlay panel.
 *  - floating pill + panel inside the YouTube player
 *  - slider 0.25x–4x (step 0.05), presets, pitch toggle
 *  - Shift+. / Shift+, step ±0.25x
 *
 * Console test (DevTools → Console → context dropdown → "Speed Master"):
 *   __ytSpeedMaster.setRate(3)
 *   __ytSpeedMaster.info()
 *   __ytSpeedMaster.reset()
 *
 * Or from the page context:
 *   document.dispatchEvent(new CustomEvent('ytsm', { detail: '3' }))
 */
(() => {
  'use strict';

  const LOG_PREFIX = '[Speed Master]';
  const MIN_RATE = 0.0625; // Chromium lower bound
  const MAX_RATE = 16; // Chromium upper bound
  const UI_MIN_RATE = 0.25;
  const UI_MAX_RATE = 4;
  const EPSILON = 0.001;
  const DEFAULT_PRESETS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3, 3.5, 4];
  const MIN_PRESETS = 3;
  const MAX_PRESETS = 12;
  const MAX_CHANNELS = 500;
  const CHANNEL_PATH = /^\/(?:@|channel\/|c\/|user\/)/;
  const QUALITY_HEIGHTS = {
    highres: 4320,
    hd2880: 2880,
    hd2160: 2160,
    hd1440: 1440,
    hd1080: 1080,
    hd720: 720,
    large: 480,
    medium: 360,
    small: 240,
    tiny: 144,
  };
  const QUALITY_MODES = ['auto', 'max', 'fixed'];
  const QUALITY_CAPS = [4320, 2160, 1440, 1080, 720, 480, 360];
  const QUALITY_WRITE_INTERVAL = 2000;
  const UI_DEFAULTS = {
    uiScale: 1,
    uiOpacity: 1,
    uiPosition: 'right',
    uiAutoHide: false,
    hotkeysEnabled: true,
    hotkeyStep: 0.25,
  };
  const UI_KEYS = Object.keys(UI_DEFAULTS);

  // Content scripts can run twice (reload / bfcache); keep one engine per page.
  if (window.__ytSpeedMaster) return;

  const state = {
    desired: 1,
    defaultRate: 1,
    enabled: true,
    preservesPitch: true,
    presets: [...DEFAULT_PRESETS],
    channelKey: null,
    channelName: '',
    channelRates: {},
    ui: { ...UI_DEFAULTS },
    quality: {
      mode: 'auto', // auto | max | fixed
      cap: 1080, // used when mode === 'fixed'
      lock: true, // keep YouTube from silently lowering the quality
    },
    applying: false, // loop guard: true while we are the ones writing playbackRate
    video: null,
    ad: false,
  };

  const listeners = new Set();
  let api = null;
  let applyUiFn = () => {};

  const hasSyncStorage = typeof chrome !== 'undefined' && Boolean(chrome.storage?.sync);
  const hasLocalStorage = typeof chrome !== 'undefined' && Boolean(chrome.storage?.local);
  let persistTimer = 0;
  let channelTimer = 0;
  let suppressPersist = false;

  const clampRate = (value) => {
    const rate = Number(value);
    if (!Number.isFinite(rate)) return state.desired;
    const rounded = Math.round(rate * 100) / 100;
    return Math.min(MAX_RATE, Math.max(MIN_RATE, rounded));
  };

  const clampUiRate = (value) =>
    Math.min(UI_MAX_RATE, Math.max(UI_MIN_RATE, Math.round(value * 100) / 100));

  const sanitizePresets = (value) => {
    if (!Array.isArray(value)) return [...DEFAULT_PRESETS];
    const seen = new Set();
    const list = [];
    for (const entry of value) {
      const rate = Number(entry);
      if (!Number.isFinite(rate)) continue;
      const rounded = clampUiRate(rate);
      const key = rounded.toFixed(2);
      if (seen.has(key)) continue;
      seen.add(key);
      list.push(rounded);
    }
    list.sort((a, b) => a - b);
    return list.length < MIN_PRESETS ? [...DEFAULT_PRESETS] : list.slice(0, MAX_PRESETS);
  };

  const sanitizeChannels = (value) => {
    if (!value || typeof value !== 'object') return {};
    const entries = [];
    for (const [key, entry] of Object.entries(value)) {
      if (typeof key !== 'string' || !CHANNEL_PATH.test(key)) continue;
      if (!entry || typeof entry !== 'object') continue;
      const rate = Number(entry.rate);
      if (!Number.isFinite(rate)) continue;
      entries.push([
        key,
        {
          rate: clampRate(rate),
          name: typeof entry.name === 'string' ? entry.name.slice(0, 60) : '',
          updated: Number.isFinite(entry.updated) ? entry.updated : 0,
        },
      ]);
    }
    entries.sort((a, b) => b[1].updated - a[1].updated);
    return Object.fromEntries(entries.slice(0, MAX_CHANNELS));
  };

  const getChannel = () => {
    const link = document.querySelector(
      'ytd-video-owner-renderer a[href], ytd-watch-metadata #owner a[href], #owner a[href]'
    );
    if (!link) return { key: null, name: '' };
    let pathname;
    try {
      pathname = new URL(link.getAttribute('href'), location.origin).pathname;
    } catch (error) {
      return { key: null, name: '' };
    }
    const trimmed = pathname.replace(/\/+$/, '');
    if (!CHANNEL_PATH.test(trimmed)) return { key: null, name: '' };
    const name = (link.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 60);
    return { key: trimmed.toLowerCase(), name };
  };

  const isRemembered = () =>
    Boolean(state.channelKey && state.channelRates[state.channelKey]);

  const clampNumber = (value, min, max, fallback) => {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.min(max, Math.max(min, number));
  };

  const readUi = (items = {}) => ({
    scale: clampNumber(items.uiScale, 0.8, 1.4, 1),
    opacity: clampNumber(items.uiOpacity, 0.4, 1, 1),
    position: items.uiPosition === 'left' ? 'left' : 'right',
    autoHide: items.uiAutoHide === true,
    hotkeysEnabled: items.hotkeysEnabled !== false,
    step: clampNumber(items.hotkeyStep, 0.05, 0.5, 0.25),
  });

  const uiSnapshot = () => ({
    uiScale: state.ui.scale,
    uiOpacity: state.ui.opacity,
    uiPosition: state.ui.position,
    uiAutoHide: state.ui.autoHide,
    hotkeysEnabled: state.ui.hotkeysEnabled,
    hotkeyStep: state.ui.step,
  });

  const isShorts = () => /^\/shorts\//.test(location.pathname);

  const getVideo = () =>
    document.querySelector('video.html5-main-video') || document.querySelector('video');

  const isAdShowing = () =>
    Boolean(
      document.querySelector(
        '#movie_player.ad-showing, .html5-video-player.ad-showing, .ytp-ad-player-overlay'
      )
    );

  function notify() {
    if (!api) return;
    const info = api.info();
    for (const listener of listeners) {
      try {
        listener(info);
      } catch (error) {
        console.error(`${LOG_PREFIX} listener failed`, error);
      }
    }
  }

  const writeSync = (patch) => {
    if (!hasSyncStorage) return;
    try {
      chrome.storage.sync.set(patch, () => {
        if (chrome.runtime.lastError) {
          console.warn(
            `${LOG_PREFIX} could not save settings`,
            chrome.runtime.lastError.message
          );
        }
      });
    } catch (error) {
      console.warn(`${LOG_PREFIX} could not save settings`, error);
    }
  };

  const writeChannels = () => {
    if (!hasLocalStorage) return;
    try {
      chrome.storage.local.set({ channelRates: state.channelRates }, () => {
        if (chrome.runtime.lastError) {
          console.warn(
            `${LOG_PREFIX} could not save channel rates`,
            chrome.runtime.lastError.message
          );
        }
      });
    } catch (error) {
      console.warn(`${LOG_PREFIX} could not save channel rates`, error);
    }
  };

  const pruneChannels = () => {
    const entries = Object.entries(state.channelRates);
    if (entries.length <= MAX_CHANNELS) return;
    entries.sort((a, b) => (b[1]?.updated || 0) - (a[1]?.updated || 0));
    state.channelRates = Object.fromEntries(entries.slice(0, MAX_CHANNELS));
  };

  const saveChannel = (key, rate, name) => {
    if (!key) return;
    state.channelRates[key] = {
      rate: clampRate(rate),
      name: (name || state.channelRates[key]?.name || '').slice(0, 60),
      updated: Date.now(),
    };
    pruneChannels();
    clearTimeout(channelTimer);
    channelTimer = window.setTimeout(writeChannels, 250);
  };

  const removeChannel = (key) => {
    if (!key || !state.channelRates[key]) return;
    delete state.channelRates[key];
    clearTimeout(channelTimer);
    writeChannels();
  };

  const persistRate = () => {
    if (suppressPersist) return;
    // A remembered channel takes the write; otherwise the global default does.
    if (state.channelKey && state.channelRates[state.channelKey]) {
      saveChannel(state.channelKey, state.desired, state.channelName);
      return;
    }
    if (!hasSyncStorage) return;
    state.defaultRate = state.desired;
    clearTimeout(persistTimer);
    persistTimer = window.setTimeout(() => {
      writeSync({ defaultRate: state.desired, preservesPitch: state.preservesPitch });
    }, 250);
  };

  const persistPitch = () => {
    if (suppressPersist) return;
    writeSync({ preservesPitch: state.preservesPitch });
  };

  const setDesired = (rate, { persist = true } = {}) => {
    const next = clampRate(rate);
    if (Math.abs(next - state.desired) > EPSILON) {
      state.desired = next;
      notify();
      if (persist) persistRate();
    }
    apply();
    return state.desired;
  };

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

  function apply() {
    const ad = isAdShowing();
    if (ad !== state.ad) {
      state.ad = ad;
      notify();
      // Re-assert exactly once when the ad hands playback back.
      if (!ad) scheduleApply(80);
    }

    const video = getVideo();
    if (!video) return;

    state.video = video;
    setPitch(video);

    if (!state.enabled) return;

    // Ads stay at 1x: safer and avoids interfering with ad playback.
    writeRate(video, ad ? 1 : state.desired);
  }

  let applyTimer = 0;
  const scheduleApply = (delay = 0) => {
    if (applyTimer) return;
    applyTimer = window.setTimeout(() => {
      applyTimer = 0;
      apply();
    }, delay);
  };

  // --- Console / automation API -------------------------------------------------

  const refreshChannel = ({ force = false } = {}) => {
    const { key, name } = getChannel();
    if (!force && key === state.channelKey) {
      if (name) state.channelName = name;
      return;
    }

    state.channelKey = key;
    state.channelName = name;

    const entry = key ? state.channelRates[key] : null;
    const next = entry ? clampRate(entry.rate) : clampRate(state.defaultRate);
    if (Math.abs(next - state.desired) > EPSILON) {
      state.desired = next;
      notify();
    } else if (force) {
      notify();
    }
    apply();
  };

  api = {
    setRate: (rate) => setDesired(rate),
    getRate: () => state.desired,
    reset: () => api.setRate(1),
    setPitch: (on) => {
      state.preservesPitch = Boolean(on);
      apply();
      notify();
      persistPitch();
      return state.preservesPitch;
    },
    setPresets: (list) => {
      state.presets = sanitizePresets(list);
      notify();
      writeSync({ presets: state.presets });
      return [...state.presets];
    },
    remember: (on) => {
      if (!state.channelKey) return false;
      if (on) saveChannel(state.channelKey, state.desired, state.channelName);
      else removeChannel(state.channelKey);
      notify();
      return isRemembered();
    },
    refreshChannel: () => refreshChannel({ force: true }),
    enable: (on = true) => {
      state.enabled = Boolean(on);
      apply();
      notify();
      return state.enabled;
    },
    subscribe: (listener) => {
      if (typeof listener !== 'function') return () => {};
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    info: () => {
      const video = getVideo();
      return {
        desired: state.desired,
        applied: video ? video.playbackRate : null,
        defaultRate: state.defaultRate,
        enabled: state.enabled,
        preservesPitch: state.preservesPitch,
        ad: isAdShowing(),
        hasVideo: Boolean(video),
        channel: state.channelKey,
        channelName: state.channelName,
        remembered: isRemembered(),
        presets: [...state.presets],
        ui: { ...state.ui },
        page: isShorts() ? 'shorts' : 'watch',
      };
    },
    apply,
  };

  api.extensionId = typeof chrome !== 'undefined' && chrome.runtime ? chrome.runtime.id : null;

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

  // --- Overlay UI --------------------------------------------------------------

  const isTypingTarget = (target) => {
    if (!(target instanceof Element)) return false;
    if (target.isContentEditable) return true;

    if (target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') return true;
    if (target.tagName !== 'INPUT') return false;

    const type = (target.getAttribute('type') || 'text').toLowerCase();
    return !['range', 'checkbox', 'radio', 'button', 'submit', 'reset', 'file', 'color'].includes(
      type
    );
  };

  function initUi() {
    const root = document.createElement('div');
    root.id = 'ytsm-root';
    root.dataset.open = 'false';
    root.innerHTML = `
      <div class="ytsm-dock">
        <div class="ytsm-panel" id="ytsm-panel" role="group" aria-label="Playback speed controls">
          <div class="ytsm-head">
            <span class="ytsm-title">Playback speed</span>
            <span class="ytsm-value">1.00x</span>
            <button type="button" class="ytsm-close" aria-label="Close speed panel">✕</button>
          </div>
          <input
            class="ytsm-slider"
            type="range"
            min="0.25"
            max="4"
            step="0.05"
            value="1"
            aria-label="Playback speed"
          />
          <div class="ytsm-presets" role="group" aria-label="Speed presets"></div>
          <label class="ytsm-remember" hidden>
            <input type="checkbox" />
            <span class="ytsm-remember-text">Remember this channel</span>
          </label>
          <div class="ytsm-foot">
            <label class="ytsm-pitch">
              <input type="checkbox" checked />
              <span>Keep pitch</span>
            </label>
            <span class="ytsm-hint">Shift+, / Shift+.</span>
          </div>
          <div class="ytsm-ad" hidden>Ad · 1x</div>
          <span class="ytsm-sr" role="status" aria-live="polite"></span>
        </div>
        <button
          type="button"
          class="ytsm-toggle"
          aria-expanded="false"
          aria-controls="ytsm-panel"
          title="Speed Master — Shift+, / Shift+."
        >1.00x</button>
      </div>
    `;

    const toggle = root.querySelector('.ytsm-toggle');
    const value = root.querySelector('.ytsm-value');
    const slider = root.querySelector('.ytsm-slider');
    const close = root.querySelector('.ytsm-close');
    const pitch = root.querySelector('.ytsm-pitch input');
    const adBadge = root.querySelector('.ytsm-ad');
    const presetBox = root.querySelector('.ytsm-presets');
    const rememberRow = root.querySelector('.ytsm-remember');
    const rememberBox = rememberRow.querySelector('input');
    const rememberText = rememberRow.querySelector('.ytsm-remember-text');
    const hint = root.querySelector('.ytsm-hint');
    const announce = root.querySelector('.ytsm-sr');

    let presetButtons = [];
    let presetSignature = '';
    let lastAnnounced = '';

    const applyUi = () => {
      const ui = state.ui;
      root.style.setProperty('--ytsm-scale', String(ui.scale));
      root.style.setProperty('--ytsm-opacity', String(ui.opacity));
      root.dataset.position = ui.position;
      root.dataset.autohide = String(ui.autoHide);
      root.dataset.page = isShorts() ? 'shorts' : 'watch';
      root.dataset.uiScale = ui.scale.toFixed(2);
      root.dataset.uiOpacity = ui.opacity.toFixed(2);
      root.dataset.hotkeys = String(ui.hotkeysEnabled);
      hint.textContent = ui.hotkeysEnabled
        ? `Shift+, / Shift+. · ${ui.step.toFixed(2)}x`
        : 'Hotkeys off';
    };
    applyUiFn = applyUi;
    applyUi();

    const announceRate = (label) => {
      if (label === lastAnnounced) return;
      lastAnnounced = label;
      announce.textContent = `Playback speed ${label}`;
    };

    const renderPresets = (list) => {
      const signature = list.join(',');
      if (signature === presetSignature) return;
      presetSignature = signature;
      presetBox.textContent = '';
      presetButtons = list.map((rate) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'ytsm-preset';
        button.dataset.rate = String(rate);
        button.textContent = `${rate}x`;
        presetBox.appendChild(button);
        return button;
      });
    };

    let dragging = false;
    let open = false;

    const sync = (info) => {
      renderPresets(info.presets);
      const label = `${info.desired.toFixed(2)}x`;
      value.textContent = label;
      toggle.textContent = label;
      slider.setAttribute('aria-valuetext', label);
      if (!dragging) {
        slider.value = String(Math.min(UI_MAX_RATE, Math.max(UI_MIN_RATE, info.desired)));
      }
      const percent = ((Number(slider.value) - UI_MIN_RATE) / (UI_MAX_RATE - UI_MIN_RATE)) * 100;
      slider.style.setProperty('--ytsm-fill', `${percent}%`);
      for (const button of presetButtons) {
        button.classList.toggle(
          'is-active',
          Math.abs(Number(button.dataset.rate) - info.desired) < EPSILON
        );
      }
      pitch.checked = info.preservesPitch;
      adBadge.hidden = !info.ad;

      rememberRow.hidden = !info.channel;
      rememberBox.checked = info.remembered;
      if (info.channel) {
        rememberText.textContent = info.channelName
          ? `Remember ${info.channelName}`
          : 'Remember this channel';
        rememberRow.title = info.remembered
          ? 'This channel uses its own saved speed'
          : 'Save the current speed for this channel';
      }

      // Small read-only mirror for manual inspection and the QA harness.
      root.dataset.channel = info.channel || '';
      root.dataset.remembered = String(info.remembered);
      root.dataset.presets = info.presets.join(',');
      root.dataset.extensionId = api.extensionId || '';
      root.dataset.page = isShorts() ? 'shorts' : 'watch';
      announceRate(label);
    };

    const setOpen = (next, { focus = false } = {}) => {
      open = Boolean(next);
      root.dataset.open = String(open);
      toggle.setAttribute('aria-expanded', String(open));
      if (open) {
        sync(api.info());
        if (focus) slider.focus({ preventScroll: true });
      } else if (focus) {
        toggle.focus({ preventScroll: true });
      }
    };

    toggle.addEventListener('click', () => setOpen(!open));
    close.addEventListener('click', () => setOpen(false, { focus: true }));
    slider.addEventListener('pointerdown', () => {
      dragging = true;
    });
    window.addEventListener('pointerup', () => {
      dragging = false;
    });
    slider.addEventListener('input', () => api.setRate(Number(slider.value)));
    presetBox.addEventListener('click', (event) => {
      const button = event.target.closest?.('.ytsm-preset');
      if (button) api.setRate(Number(button.dataset.rate));
    });
    pitch.addEventListener('change', () => api.setPitch(pitch.checked));
    rememberBox.addEventListener('change', () => {
      api.remember(rememberBox.checked);
    });

    // Keep player clicks (play/pause, seek, fullscreen) out of our controls.
    for (const type of [
      'click',
      'dblclick',
      'pointerdown',
      'pointerup',
      'mousedown',
      'mouseup',
      'touchstart',
      'touchend',
      'wheel',
    ]) {
      root.addEventListener(type, (event) => event.stopPropagation());
    }

    document.addEventListener(
      'pointerdown',
      (event) => {
        if (!open) return;
        if (event.target instanceof Node && root.contains(event.target)) return;
        setOpen(false);
      },
      true
    );

    document.addEventListener(
      'keydown',
      (event) => {
        if (event.key === 'Escape' && open) setOpen(false, { focus: true });
      },
      true
    );

    // Shift+. / Shift+, → step by the configured amount (inside 0.25–4x).
    // Shift+0 → 1x. Shift+1…4 → 1x, 2x, 3x, 4x.
    document.addEventListener(
      'keydown',
      (event) => {
        if (event.defaultPrevented || event.isComposing) return;
        if (!state.ui.hotkeysEnabled) return;
        if (event.altKey || event.ctrlKey || event.metaKey || !event.shiftKey) return;
        if (isTypingTarget(event.target)) return;

        const step = state.ui.step;
        const faster = event.code === 'Period' || event.key === '>';
        const slower = event.code === 'Comma' || event.key === '<';
        if (faster || slower) {
          event.preventDefault();
          api.setRate(clampUiRate(api.getRate() + (faster ? step : -step)));
          return;
        }

        const digit = /^Digit([0-4])$/.exec(event.code);
        if (!digit) return;
        const value = Number(digit[1]);
        event.preventDefault();
        api.setRate(value === 0 ? 1 : value);
      },
      true
    );

    api.subscribe(sync);
    sync(api.info());

    // The player is re-created on SPA navigation; keep the panel attached to it.
    const ensureMounted = () => {
      const player = document.querySelector('#movie_player');
      if (!player) {
        if (root.isConnected) root.remove();
        return;
      }
      if (root.parentElement !== player) player.appendChild(root);
    };
    ensureMounted();
    document.addEventListener('yt-navigate-finish', () => {
      applyUi();
      refreshChannel();
      ensureMounted();
    });
    window.setInterval(() => {
      ensureMounted();
      applyUi();
      refreshChannel();
    }, 1000);

    return { root, setOpen };
  }

  // --- Settings (chrome.storage) -----------------------------------------------

  const loadSettings = () => {
    const applySettings = (items, channels) => {
      suppressPersist = true;
      try {
        state.defaultRate = clampRate(items.defaultRate ?? 1);
        state.presets = sanitizePresets(items.presets);
        state.preservesPitch = items.preservesPitch !== false;
        state.channelRates = sanitizeChannels(channels);
        state.ui = readUi(items);
        state.desired = state.defaultRate;
      } finally {
        suppressPersist = false;
      }
      applyUiFn();
      refreshChannel({ force: true });
    };

    if (!hasSyncStorage) {
      applySettings({}, {});
      return;
    }

    chrome.storage.sync.get(
      { defaultRate: 1, preservesPitch: true, presets: DEFAULT_PRESETS, ...UI_DEFAULTS },
      (items) => {
        if (chrome.runtime.lastError) {
          console.warn(`${LOG_PREFIX} could not load settings`, chrome.runtime.lastError.message);
          applySettings({}, {});
          return;
        }
        if (!hasLocalStorage) {
          applySettings(items, {});
          return;
        }
        chrome.storage.local.get({ channelRates: {} }, (local) => {
          if (chrome.runtime.lastError) {
            console.warn(
              `${LOG_PREFIX} could not load channel rates`,
              chrome.runtime.lastError.message
            );
            applySettings(items, {});
            return;
          }
          applySettings(items, local.channelRates);
        });
      }
    );
  };

  const watchSettings = () => {
    if (!hasSyncStorage) return;
    chrome.storage.onChanged.addListener((changes, area) => {
      suppressPersist = true;
      try {
        if (area === 'sync') {
          if (changes.defaultRate) {
            state.defaultRate = clampRate(changes.defaultRate.newValue ?? 1);
            // A remembered channel keeps its own rate.
            if (!isRemembered()) state.desired = state.defaultRate;
          }
          if (changes.preservesPitch) {
            state.preservesPitch = changes.preservesPitch.newValue !== false;
          }
          if (changes.presets) {
            state.presets = sanitizePresets(changes.presets.newValue);
          }
          if (UI_KEYS.some((key) => changes[key])) {
            const next = uiSnapshot();
            for (const key of UI_KEYS) {
              if (changes[key]) next[key] = changes[key].newValue;
            }
            state.ui = readUi(next);
            applyUiFn();
          }
        } else if (area === 'local' && changes.channelRates) {
          state.channelRates = sanitizeChannels(changes.channelRates.newValue);
          const entry = state.channelKey ? state.channelRates[state.channelKey] : null;
          state.desired = entry ? clampRate(entry.rate) : clampRate(state.defaultRate);
        } else {
          return;
        }
      } finally {
        suppressPersist = false;
      }
      notify();
      apply();
    });
  };

  initUi();
  loadSettings();
  watchSettings();

  // Safety net: ads toggling a class, or a player rebuild we did not observe.
  window.setInterval(apply, 1000);

  apply();
  console.log(`${LOG_PREFIX} ready. Try Shift+. / Shift+, or __ytSpeedMaster.setRate(3)`);
})();
