/**
 * YouTube Speed Master — popup script.
 *
 * Stores the global default speed + pitch preference in chrome.storage.sync.
 * The content script listens for changes and applies them live.
 */
(() => {
  'use strict';

  const DEFAULTS = { defaultRate: 1, preservesPitch: true };
  const PRESETS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3, 3.5, 4];
  const MIN_RATE = 0.25;
  const MAX_RATE = 4;

  const slider = document.getElementById('speed');
  const value = document.getElementById('speed-value');
  const presetBox = document.getElementById('presets');
  const pitch = document.getElementById('pitch');
  const reset = document.getElementById('reset');
  const saved = document.getElementById('saved');

  const clampRate = (rate) => {
    const number = Number(rate);
    if (!Number.isFinite(number)) return 1;
    return Math.min(MAX_RATE, Math.max(MIN_RATE, Math.round(number * 100) / 100));
  };

  const presetButtons = PRESETS.map((rate) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'preset';
    button.dataset.rate = String(rate);
    button.textContent = `${rate}x`;
    presetBox.appendChild(button);
    return button;
  });

  let state = { ...DEFAULTS };
  let savedTimer = 0;

  const flashSaved = () => {
    saved.hidden = false;
    clearTimeout(savedTimer);
    savedTimer = setTimeout(() => {
      saved.hidden = true;
    }, 1200);
  };

  const render = () => {
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

  const save = (patch) => {
    state = { ...state, ...patch };
    render();

    chrome.storage.sync.set(patch, () => {
      if (chrome.runtime.lastError) {
        console.warn('[Speed Master] could not save settings', chrome.runtime.lastError.message);
        return;
      }
      flashSaved();
    });
  };

  slider.addEventListener('input', () => {
    state.defaultRate = clampRate(slider.value);
    render();
  });
  slider.addEventListener('change', () => save({ defaultRate: clampRate(slider.value) }));

  presetBox.addEventListener('click', (event) => {
    const button = event.target.closest?.('.preset');
    if (button) save({ defaultRate: clampRate(button.dataset.rate) });
  });

  reset.addEventListener('click', () => save({ defaultRate: 1 }));
  pitch.addEventListener('change', () => save({ preservesPitch: pitch.checked }));

  chrome.storage.sync.get(DEFAULTS, (items) => {
    if (chrome.runtime.lastError) return;
    state = {
      defaultRate: clampRate(items.defaultRate),
      preservesPitch: Boolean(items.preservesPitch),
    };
    render();
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync') return;
    if (changes.defaultRate) state.defaultRate = clampRate(changes.defaultRate.newValue);
    if (changes.preservesPitch) {
      state.preservesPitch = Boolean(changes.preservesPitch.newValue);
    }
    render();
  });

  render();
})();
