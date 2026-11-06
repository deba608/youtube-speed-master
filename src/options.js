/**
 * Speed Master — options page.
 *
 * Appearance and keyboard preferences live in chrome.storage.sync, next to the
 * speed settings from the popup. The content script watches for changes and
 * restyles its panel without a reload.
 */
(() => {
  'use strict';

  const DEFAULTS = {
    uiScale: 1,
    uiOpacity: 1,
    uiPosition: 'right',
    uiAutoHide: false,
    hotkeysEnabled: true,
    hotkeyStep: 0.25,
  };

  const el = (id) => document.getElementById(id);
  const scale = el('ui-scale');
  const scaleValue = el('ui-scale-value');
  const opacity = el('ui-opacity');
  const opacityValue = el('ui-opacity-value');
  const positionRadios = [...document.querySelectorAll('input[name="ui-position"]')];
  const autoHide = el('ui-autohide');
  const hotkeysEnabled = el('hotkeys-enabled');
  const hotkeyStep = el('hotkey-step');
  const saved = el('saved');
  const status = el('status');
  const resetAppearance = el('reset-appearance');
  const resetAll = el('reset-all');
  const previewDock = el('preview-dock');
  const previewPanel = el('preview-panel');

  const state = { ...DEFAULTS };
  let savedTimer = 0;
  let statusTimer = 0;

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

  const save = (patch) => {
    chrome.storage.sync.set(patch, () => {
      if (chrome.runtime.lastError) {
        showStatus(chrome.runtime.lastError.message, true);
        return;
      }
      flashSaved();
    });
  };

  const renderPreview = () => {
    previewDock.style.setProperty('--preview-scale', String(state.uiScale));
    previewDock.style.setProperty('--preview-opacity', String(state.uiOpacity));
    previewDock.dataset.position = state.uiPosition;
    previewDock.dataset.autohide = String(state.uiAutoHide);
  };

  const render = () => {
    scale.value = String(state.uiScale);
    scaleValue.textContent = `${Math.round(state.uiScale * 100)}%`;
    opacity.value = String(state.uiOpacity);
    opacityValue.textContent = `${Math.round(state.uiOpacity * 100)}%`;
    for (const radio of positionRadios) {
      radio.checked = radio.value === state.uiPosition;
    }
    autoHide.checked = state.uiAutoHide;
    hotkeysEnabled.checked = state.hotkeysEnabled;
    hotkeyStep.value = String(state.hotkeyStep);
    hotkeyStep.disabled = !state.hotkeysEnabled;
    renderPreview();
  };

  // --- appearance --------------------------------------------------------------

  scale.addEventListener('input', () => {
    state.uiScale = Number(scale.value);
    render();
  });
  scale.addEventListener('change', () => save({ uiScale: state.uiScale }));

  opacity.addEventListener('input', () => {
    state.uiOpacity = Number(opacity.value);
    render();
  });
  opacity.addEventListener('change', () => save({ uiOpacity: state.uiOpacity }));

  for (const radio of positionRadios) {
    radio.addEventListener('change', () => {
      if (!radio.checked) return;
      state.uiPosition = radio.value;
      renderPreview();
      save({ uiPosition: state.uiPosition });
    });
  }

  autoHide.addEventListener('change', () => {
    state.uiAutoHide = autoHide.checked;
    renderPreview();
    save({ uiAutoHide: state.uiAutoHide });
  });

  // --- keyboard ----------------------------------------------------------------

  hotkeysEnabled.addEventListener('change', () => {
    state.hotkeysEnabled = hotkeysEnabled.checked;
    hotkeyStep.disabled = !state.hotkeysEnabled;
    save({ hotkeysEnabled: state.hotkeysEnabled });
  });

  hotkeyStep.addEventListener('change', () => {
    state.hotkeyStep = Number(hotkeyStep.value);
    save({ hotkeyStep: state.hotkeyStep });
  });

  // --- reset -------------------------------------------------------------------

  resetAppearance.addEventListener('click', () => {
    Object.assign(state, {
      uiScale: DEFAULTS.uiScale,
      uiOpacity: DEFAULTS.uiOpacity,
      uiPosition: DEFAULTS.uiPosition,
      uiAutoHide: DEFAULTS.uiAutoHide,
    });
    render();
    save({
      uiScale: state.uiScale,
      uiOpacity: state.uiOpacity,
      uiPosition: state.uiPosition,
      uiAutoHide: state.uiAutoHide,
    });
    showStatus('Appearance reset');
  });

  resetAll.addEventListener('click', () => {
    chrome.storage.sync.remove([
      'defaultRate',
      'preservesPitch',
      'presets',
      ...Object.keys(DEFAULTS),
    ], () => {
      chrome.storage.local.set({ channelRates: {} }, () => {
        Object.assign(state, DEFAULTS);
        render();
        showStatus('All settings reset');
      });
    });
  });

  // --- live updates ------------------------------------------------------------

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync') return;
    let dirty = false;
    for (const key of Object.keys(DEFAULTS)) {
      if (changes[key]) {
        state[key] = changes[key].newValue ?? DEFAULTS[key];
        dirty = true;
      }
    }
    if (dirty) render();
  });

  // --- boot --------------------------------------------------------------------

  chrome.storage.sync.get(DEFAULTS, (items) => {
    if (chrome.runtime.lastError) {
      showStatus(chrome.runtime.lastError.message, true);
      render();
      return;
    }
    Object.assign(state, {
      uiScale: Number(items.uiScale) || DEFAULTS.uiScale,
      uiOpacity: Number(items.uiOpacity) || DEFAULTS.uiOpacity,
      uiPosition: items.uiPosition === 'left' ? 'left' : 'right',
      uiAutoHide: items.uiAutoHide === true,
      hotkeysEnabled: items.hotkeysEnabled !== false,
      hotkeyStep: Number(items.hotkeyStep) || DEFAULTS.hotkeyStep,
    });
    render();
  });

  render();
})();
