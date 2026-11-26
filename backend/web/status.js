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

  function paintFavicon() {
    var link = document.getElementById('status-favicon');
    if (!link) return;
    var dark = d.getAttribute('data-theme') === 'dark';
    var text = d.getAttribute('data-favicon-text') || '简';
    var c = document.createElement('canvas');
    c.width = 128;
    c.height = 128;
    var ctx = c.getContext('2d');
    if (!ctx) return;
    var r = 26;
    ctx.beginPath();
    ctx.moveTo(r, 0);
    ctx.arcTo(128, 0, 128, 128, r);
    ctx.arcTo(128, 128, 0, 128, r);
    ctx.arcTo(0, 128, 0, 0, r);
    ctx.arcTo(0, 0, 128, 0, r);
    ctx.closePath();
    ctx.fillStyle = dark ? '#FFFFFF' : '#18181B';
    ctx.fill();
    ctx.fillStyle = dark ? '#18181B' : '#F4F4F5';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '700 ' + (Array.from(text).length > 1 ? 62 : 94) + 'px -apple-system,BlinkMacSystemFont,"Helvetica Neue",Arial,"PingFang SC","Microsoft YaHei",sans-serif';
    ctx.fillText(text, 64, 67);
    link.type = 'image/png';
    link.href = c.toDataURL('image/png');
  }
  paintFavicon();

  var code = document.body.getAttribute('data-status-code') || '404';

  function setText(selector, value) {
    if (!value) return;
    var nodes = document.querySelectorAll(selector);
    for (var i = 0; i < nodes.length; i++) nodes[i].textContent = value;
  }

  fetch('/api/site', { cache: 'no-store', headers: { Accept: 'application/json' } })
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
