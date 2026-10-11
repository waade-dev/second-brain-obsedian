(() => {
  const media=matchMedia('(prefers-color-scheme: dark)');let chosen;
  function apply(theme){document.documentElement.dataset.theme=theme;const button=document.getElementById('theme-toggle');if(button){button.textContent=theme==='dark'?'☀':'☾';button.setAttribute('aria-label',theme==='dark'?'Switch to light mode':'Switch to dark mode');button.setAttribute('aria-pressed',String(theme==='dark'));}}
  apply(media.matches?'dark':'light');
  chrome.storage.local.get({theme:''},stored=>{chosen=stored.theme;apply(chosen==='light'||chosen==='dark'?chosen:media.matches?'dark':'light');});
  media.addEventListener('change',()=>{if(!chosen)apply(media.matches?'dark':'light');});
  document.addEventListener('DOMContentLoaded',()=>{apply(document.documentElement.dataset.theme);document.getElementById('theme-toggle')?.addEventListener('click',()=>{chosen=document.documentElement.dataset.theme==='dark'?'light':'dark';chrome.storage.local.set({theme:chosen});apply(chosen);});});
})();
