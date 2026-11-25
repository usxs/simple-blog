(function () {
  var d = document.documentElement;
  try {
    var mode = window.localStorage.getItem('site-theme-mode');
    if (mode !== 'auto' && mode !== 'dark' && mode !== 'light') mode = 'auto';
    var isLight = window.matchMedia('(prefers-color-scheme: light)').matches;
    var theme = mode === 'light' ? 'light' : (mode === 'dark' ? 'dark' : (isLight ? 'light' : 'dark'));
    d.setAttribute('data-theme', theme);
    d.setAttribute('data-theme-mode', mode);
    d.style.colorScheme = theme;
  } catch (e) {
    d.setAttribute('data-theme', 'light');
  }

  var code = document.body.getAttribute('data-status-code') || '404';

  function setText(selector, value) {
    if (!value) return;
    var nodes = document.querySelectorAll(selector);
    for (var i = 0; i < nodes.length; i++) nodes[i].textContent = value;
  }

  fetch('https://api.example.com/api/site', { cache: 'no-store', headers: { Accept: 'application/json' } })
    .then(function (res) { return res.ok ? res.json() : null; })
    .then(function (payload) {
      var site = payload && payload.site ? payload.site : null;
      if (!site) return;
      if (site.name) {
        setText('[data-site-name]', site.name);
        document.title = code + ' · ' + site.name;
      }
      if (site.avatarText) setText('[data-site-avatar]', site.avatarText);
      setText('[data-site-copyright]', '© ' + new Date().getFullYear() + ' ' + (site.name || '简单博客'));
      if (site.footer && typeof site.footer.copyright === 'string' && site.footer.copyright.trim()) {
        setText('[data-site-copyright]', site.footer.copyright);
      }
    })
    .catch(function () { /* 静态兜底文案已经足够 */ });
})();
