/**
 * Speed Master — popup script.
 *
 * Stores the global default speed, pitch preference and custom presets in
 * chrome.storage.sync, and per-channel rates in chrome.storage.local.
 * The content script listens for changes and applies them live.
 */
(() => {
  'use strict';

  const DEFAULT_PRESETS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3, 3.5, 4];
  const MIN_RATE = 0.25;
  const MAX_RATE = 4;
  const MIN_PRESETS = 3;
  const MAX_PRESETS = 12;
  const MAX_CHANNELS = 500;
  const CHANNEL_PATH = /^\/(?:@|channel\/|c\/|user\/)/;
  const DEFAULTS = {
    defaultRate: 1,
    preservesPitch: true,
    presets: DEFAULT_PRESETS,
    uiScale: 1,
    uiOpacity: 1,
    uiPosition: 'right',
    uiAutoHide: false,
    hotkeysEnabled: true,
    hotkeyStep: 0.25,
  };
  const UI_KEYS = [
    'uiScale',
    'uiOpacity',
    'uiPosition',
    'uiAutoHide',
    'hotkeysEnabled',
    'hotkeyStep',
  ];

  const el = (id) => document.getElementById(id);
  const slider = el('speed');
  const value = el('speed-value');
  const presetsBox = el('presets');
  const pitch = el('pitch');
  const reset = el('reset');
  const saved = el('saved');
  const presetEditor = el('preset-editor');
  const presetForm = el('preset-form');
  const presetInput = el('preset-input');
  const presetDefaults = el('preset-defaults');
  const channelList = el('channel-list');
  const channelEmpty = el('channel-empty');
  const channelsClear = el('channels-clear');
  const exportSettings = el('export-settings');
  const importSettings = el('import-settings');
  const importFile = el('import-file');
  const resetAll = el('reset-all');
  const openOptions = el('open-options');
  const status = el('status');

  let state = { ...DEFAULTS, presets: [...DEFAULT_PRESETS] };
  let channels = {};
  let savedTimer = 0;
  let statusTimer = 0;
  let presetButtons = [];

  const clampRate = (value) => {
    const number = Number(value);
    if (!Number.isFinite(number)) return 1;
    return Math.min(MAX_RATE, Math.max(MIN_RATE, Math.round(number * 100) / 100));
  };

  const sanitizePresets = (list) => {
    if (!Array.isArray(list)) return [...DEFAULT_PRESETS];
    const seen = new Set();
    const out = [];
    for (const entry of list) {
      const rate = Number(entry);
      if (!Number.isFinite(rate)) continue;
      const rounded = clampRate(rate);
      const key = rounded.toFixed(2);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(rounded);
    }
    out.sort((a, b) => a - b);
    return out.length < MIN_PRESETS ? [...DEFAULT_PRESETS] : out.slice(0, MAX_PRESETS);
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

  const flashSaved = () => {
    saved.hidden = false;
    clearTimeout(savedTimer);
    savedTimer = setTimeout(() => {
      saved.hidden = true;
    }, 1200);
  };

  const showStatus = (message, isError = false) => {
    status.textContent = message;
    status.hidden = false;
    status.classList.toggle('is-error', isError);
    clearTimeout(statusTimer);
    statusTimer = setTimeout(() => {
      status.hidden = true;
    }, 2600);
  };

  // --- render ------------------------------------------------------------------

  const renderSpeed = () => {
    const rate = clampRate(state.defaultRate);
    slider.value = String(rate);
    value.textContent = `${rate.toFixed(2)}x`;
    const percent = ((rate - MIN_RATE) / (MAX_RATE - MIN_RATE)) * 100;
    slider.style.setProperty('--fill', `${percent}%`);
    for (const button of presetButtons) {
      button.classList.toggle(
        'is-active',
        Math.abs(Number(button.dataset.rate) - rate) < 0.001
      );
    }
    pitch.checked = state.preservesPitch;
  };

  const renderPresetButtons = () => {
    presetsBox.textContent = '';
    presetButtons = state.presets.map((rate) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'preset';
      button.dataset.rate = String(rate);
      button.textContent = `${rate}x`;
      presetsBox.appendChild(button);
      return button;
    });
  };

  const renderPresetEditor = () => {
    presetEditor.textContent = '';
    for (const rate of state.presets) {
      const chip = document.createElement('span');
      chip.className = 'chip';

      const label = document.createElement('span');
      label.textContent = `${rate}x`;
      chip.appendChild(label);

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'chip-remove';
      remove.dataset.rate = String(rate);
      remove.setAttribute('aria-label', `Remove ${rate}x preset`);
      remove.textContent = '×';
      remove.disabled = state.presets.length <= MIN_PRESETS;
      chip.appendChild(remove);

      presetEditor.appendChild(chip);
    }
  };

  const renderChannels = () => {
    const entries = Object.entries(channels).sort(
      (a, b) => (b[1]?.updated || 0) - (a[1]?.updated || 0)
    );
    channelList.textContent = '';
    channelEmpty.hidden = entries.length > 0;
    channelsClear.disabled = entries.length === 0;

    for (const [key, entry] of entries) {
      const row = document.createElement('div');
      row.className = 'channel-row';

      const text = document.createElement('span');
      text.className = 'channel-text';
      const name = document.createElement('span');
      name.className = 'channel-name';
      name.textContent = entry.name || key;
      name.title = key;
      const rate = document.createElement('span');
      rate.className = 'channel-rate';
      rate.textContent = `${Number(entry.rate).toFixed(2)}x`;
      text.append(name, rate);

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'channel-remove';
      remove.dataset.key = key;
      remove.setAttribute('aria-label', `Forget ${entry.name || key}`);
      remove.textContent = '×';

      row.append(text, remove);
      channelList.appendChild(row);
    }
  };

  const renderAll = () => {
    renderSpeed();
    renderPresetButtons();
    renderPresetEditor();
    renderChannels();
  };

  // --- storage -----------------------------------------------------------------

  const saveSync = (patch) => {
    chrome.storage.sync.set(patch, () => {
      if (chrome.runtime.lastError) {
        showStatus(chrome.runtime.lastError.message, true);
        return;
      }
      flashSaved();
    });
  };

  const saveChannels = (next) => {
    channels = sanitizeChannels(next);
    chrome.storage.local.set({ channelRates: channels }, () => {
      if (chrome.runtime.lastError) {
        showStatus(chrome.runtime.lastError.message, true);
        return;
      }
      flashSaved();
    });
    renderChannels();
  };

  // --- speed + pitch -----------------------------------------------------------

  slider.addEventListener('input', () => {
    state.defaultRate = clampRate(slider.value);
    renderSpeed();
  });

  slider.addEventListener('change', () => {
    state.defaultRate = clampRate(slider.value);
    saveSync({ defaultRate: state.defaultRate });
  });

  presetsBox.addEventListener('click', (event) => {
    const button = event.target.closest?.('.preset');
    if (!button) return;
    state.defaultRate = clampRate(button.dataset.rate);
    renderSpeed();
    saveSync({ defaultRate: state.defaultRate });
  });

  reset.addEventListener('click', () => {
    state.defaultRate = 1;
    renderSpeed();
    saveSync({ defaultRate: 1 });
  });

  openOptions.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  pitch.addEventListener('change', () => {
    state.preservesPitch = pitch.checked;
    saveSync({ preservesPitch: state.preservesPitch });
  });

  // --- preset editor -----------------------------------------------------------

  presetEditor.addEventListener('click', (event) => {
    const button = event.target.closest?.('.chip-remove');
    if (!button || state.presets.length <= MIN_PRESETS) return;
    const rate = Number(button.dataset.rate);
    state.presets = state.presets.filter((entry) => Math.abs(entry - rate) > 0.001);
    saveSync({ presets: state.presets });
    renderPresetButtons();
    renderPresetEditor();
    renderSpeed();
  });

  presetForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const rate = clampRate(presetInput.value);
    if (!presetInput.value.trim()) return;

    if (state.presets.some((entry) => Math.abs(entry - rate) < 0.001)) {
      showStatus(`${rate.toFixed(2)}x is already a preset`, true);
      return;
    }
    if (state.presets.length >= MAX_PRESETS) {
      showStatus(`Limit is ${MAX_PRESETS} presets`, true);
      return;
    }

    state.presets = sanitizePresets([...state.presets, rate]);
    saveSync({ presets: state.presets });
    presetInput.value = '';
    renderPresetButtons();
    renderPresetEditor();
    renderSpeed();
  });

  presetDefaults.addEventListener('click', () => {
    state.presets = [...DEFAULT_PRESETS];
    saveSync({ presets: state.presets });
    renderPresetButtons();
    renderPresetEditor();
    renderSpeed();
  });

  // --- channel memory ----------------------------------------------------------

  channelList.addEventListener('click', (event) => {
    const button = event.target.closest?.('.channel-remove');
    if (!button) return;
    const next = { ...channels };
    delete next[button.dataset.key];
    saveChannels(next);
  });

  channelsClear.addEventListener('click', () => {
    if (!Object.keys(channels).length) return;
    saveChannels({});
    showStatus('Remembered channels cleared');
  });

  // --- export / import / reset -------------------------------------------------

  exportSettings.addEventListener('click', () => {
    const payload = {
      app: 'speed-master',
      schema: 1,
      exportedAt: new Date().toISOString(),
      settings: {
        defaultRate: clampRate(state.defaultRate),
        preservesPitch: state.preservesPitch,
        presets: [...state.presets],
        ...Object.fromEntries(UI_KEYS.map((key) => [key, state[key]])),
      },
      channels,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'speed-master-settings.json';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showStatus('Settings exported');
  });

  importSettings.addEventListener('click', () => importFile.click());

  importFile.addEventListener('change', async () => {
    const file = importFile.files?.[0];
    importFile.value = '';
    if (!file) return;

    let data;
    try {
      data = JSON.parse(await file.text());
    } catch (error) {
      showStatus('Not a valid JSON file', true);
      return;
    }

    const settings = data?.settings ?? data;
    if (!settings || typeof settings !== 'object' || data?.app !== 'speed-master') {
      showStatus('Not a Speed Master settings file', true);
      return;
    }

    const next = {
      defaultRate: clampRate(settings.defaultRate ?? 1),
      preservesPitch: settings.preservesPitch !== false,
      presets: sanitizePresets(settings.presets),
    };
    for (const key of UI_KEYS) {
      if (settings[key] !== undefined) next[key] = settings[key];
    }
    const nextChannels = sanitizeChannels(data.channels ?? {});

    chrome.storage.sync.set(next, () => {
      if (chrome.runtime.lastError) {
        showStatus(chrome.runtime.lastError.message, true);
        return;
      }
      chrome.storage.local.set({ channelRates: nextChannels }, () => {
        if (chrome.runtime.lastError) {
          showStatus(chrome.runtime.lastError.message, true);
          return;
        }
        state = { ...next };
        channels = nextChannels;
        renderAll();
        flashSaved();
        showStatus('Settings imported');
      });
    });
  });

  resetAll.addEventListener('click', () => {
    chrome.storage.sync.remove(['defaultRate', 'preservesPitch', 'presets', ...UI_KEYS], () => {
      chrome.storage.local.set({ channelRates: {} }, () => {
        state = { ...DEFAULTS, presets: [...DEFAULT_PRESETS] };
        channels = {};
        renderAll();
        showStatus('All settings reset');
      });
    });
  });

  // --- live updates ------------------------------------------------------------

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync') {
      if (changes.defaultRate) state.defaultRate = clampRate(changes.defaultRate.newValue ?? 1);
      if (changes.preservesPitch) state.preservesPitch = changes.preservesPitch.newValue !== false;
      if (changes.presets) state.presets = sanitizePresets(changes.presets.newValue);
      for (const key of UI_KEYS) {
        if (changes[key]) state[key] = changes[key].newValue;
      }
      renderAll();
    } else if (area === 'local' && changes.channelRates) {
      channels = sanitizeChannels(changes.channelRates.newValue);
      renderChannels();
    }
  });

  // --- boot --------------------------------------------------------------------

  chrome.storage.sync.get(DEFAULTS, (items) => {
    if (chrome.runtime.lastError) return;
    state = {
      ...DEFAULTS,
      defaultRate: clampRate(items.defaultRate),
      preservesPitch: items.preservesPitch !== false,
      presets: sanitizePresets(items.presets),
    };
    for (const key of UI_KEYS) {
      if (items[key] !== undefined) state[key] = items[key];
    }
    renderSpeed();
    renderPresetButtons();
    renderPresetEditor();
  });

  chrome.storage.local.get({ channelRates: {} }, (items) => {
    if (chrome.runtime.lastError) return;
    channels = sanitizeChannels(items.channelRates);
    renderChannels();
  });

  renderAll();
})();
