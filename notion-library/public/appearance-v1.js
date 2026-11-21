(() => {
  const palettes = {mush:'#181512', carbon:'#10110f', moss:'#111a17', paper:'#eeece4', cmux:'#0c1016'};
  const valid = value => Object.hasOwn(palettes, value);
  const root = document.documentElement;
  const key = 'library-palette';
  function read(name) {
    try { return localStorage.getItem(name); } catch { return null; }
  }
  function apply(value) {
    if (!valid(value)) value = 'carbon';
    root.dataset.palette = value;
    root.dataset.orbitTheme = value;
    root.dataset.theme = value === 'paper' ? 'light' : 'dark';
    document.querySelector('meta[name=theme-color]')?.setAttribute('content', palettes[value]);
    for (const select of document.querySelectorAll('[data-library-palette]')) select.value = value;
  }
  const saved = read(key);
  apply(valid(saved) ? saved : read('library-theme') === 'light' ? 'paper' : 'carbon');
  document.addEventListener('DOMContentLoaded', () => {
    apply(root.dataset.palette);
    document.addEventListener('change', event => {
      if (!event.target.matches('[data-library-palette]')) return;
      if (!valid(event.target.value)) return;
      try { localStorage.setItem(key,event.target.value); } catch {}
      apply(event.target.value);
    });
  });
  window.addEventListener('storage', event => {
    if (event.key === key || event.key === null)
      apply(valid(event.newValue) ? event.newValue : read('library-theme') === 'light' ? 'paper' : 'carbon');
  });
})();
