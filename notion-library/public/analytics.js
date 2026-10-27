// Vercel Web Analytics bootstrap for pages without a JavaScript bundler.
(() => {
  if (location.protocol !== 'https:') return;
  if (['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)) return;
  window.va = window.va || function () { (window.vaq = window.vaq || []).push(arguments); };
  if (document.querySelector('script[src="/_vercel/insights/script.js"]')) return;
  const script = document.createElement('script');
  script.defer = true;
  script.src = '/_vercel/insights/script.js';
  document.head.appendChild(script);
})();
