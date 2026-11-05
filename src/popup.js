/**
 * YouTube Speed Master — popup script.
 *
 * P0: static placeholder. Real settings (chrome.storage.sync) land in P3.
 */
(() => {
  'use strict';

  const slider = document.getElementById('speed');
  const value = document.getElementById('speed-value');

  const render = () => {
    value.textContent = `${Number(slider.value).toFixed(2)}x`;
  };

  slider.addEventListener('input', render);
  render();
})();
