function markdownEscapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* 只允许安全协议，避免 javascript: 之类的链接混入 */
function markdownSafeUrl(url) {
  var value = String(url || '').trim();
  if (/^(https?:\/\/|mailto:|\/|\.\/|\.\.\/|#)/i.test(value)) return value;
  if (/^[\w.-]+\.[a-z]{2,}\//i.test(value)) return 'https://' + value;
  return '';
}

/* 代码块：带语言标签、行号、复制、灯箱（放大）按钮 */
function markdownCodeBlock(code, lang) {
  var language = String(lang || '').toLowerCase() || 'text';
  var rows = String(code || '').split('\n').map(function (line) {
    var blank = line === '';
    return '<span class="code-line">' + (blank ? '\u200b' : markdownEscapeHtml(line)) + '</span>';
  }).join('');
  return '<div class="code-block" data-lang="' + markdownEscapeHtml(language) + '">' +
      '<div class="code-head">' +
        '<span class="code-lang">' + markdownEscapeHtml(language) + '</span>' +
        '<div class="code-actions">' +
          '<button type="button" class="code-btn code-copy" aria-label="复制代码">复制</button>' +
          '<button type="button" class="code-btn code-expand" aria-label="放大代码">放大</button>' +
        '</div>' +
      '</div>' +
      '<pre class="code-pre"><code class="language-' + markdownEscapeHtml(language) + '">' + rows + '</code></pre>' +
    '</div>';
}

/* ```mermaid 交由图示库在浏览器端渲染 */
function markdownMermaidBlock(code) {
  return '<figure class="mermaid-figure"><div class="mermaid">' + markdownEscapeHtml(code) + '</div></figure>';
}

function renderMarkdown(md) {
  var lines = String(md == null ? '' : md).replace(/\r\n?/g, '\n').split('\n');
  var html = '';
  var i = 0;

  function isFence(trimmed) {
    return /^(`{3,}|~{3,})/.test(trimmed);
  }

  function isTableStart(index) {
    var head = (lines[index] || '').trim();
    var sep = (lines[index + 1] || '').trim();
    return head.indexOf('|') !== -1 && /^\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)+\|?$/.test(sep);
  }

  function isBlockStart(index) {
    var t = (lines[index] || '').trim();
    if (!t) return true;
    if (isFence(t)) return true;
    if (/^>/.test(t)) return true;
    if (/^(#{1,6})\s+/.test(t)) return true;
    if (/^([-*_])(\s*\1){2,}$/.test(t)) return true;
    if (/^([-*+]|\d+[.)])\s+/.test(t)) return true;
    if (isTableStart(index)) return true;
    return false;
  }

  while (i < lines.length) {
    var line = lines[i];
    var trimmed = line.trim();

    /* ── 加密片段占位块（正文里只有密文，解锁后才渲染内容）── */
    var lockMatch = /^:::locked\s+([A-Za-z0-9+/=]+)\s*$/.exec(trimmed);
    if (lockMatch) {
      var lockPayload = lockMatch[1];
      i++;
      if (i < lines.length && lines[i].trim() === ':::') i++;
      html += '<div class="md-lock" data-lock="' + markdownEscapeHtml(lockPayload) + '">' +
        '<div class="md-lock-icon" aria-hidden="true">🔒</div>' +
        '<div class="md-lock-body">' +
          '<p class="md-lock-title">这段内容已加密</p>' +
          '<p class="md-lock-tip">输入口令后查看被加密的文字或图片</p>' +
          '<div class="md-lock-form"><input type="password" class="md-lock-input" placeholder="输入口令" autocomplete="off" /><button type="button" class="md-lock-btn">解锁</button></div>' +
          '<p class="md-lock-error" hidden></p>' +
        '</div>' +
      '</div>';
      continue;
    }

    /* ── 围栏代码块 ───────────────────────────── */
    if (isFence(trimmed)) {
      var fenceChar = trimmed.charAt(0);
      var fenceLen = /^(`+|~+)/.exec(trimmed)[1].length;
      var info = trimmed.slice(fenceLen).trim().split(/\s+/)[0] || '';
      var closeRe = new RegExp('^\\' + fenceChar + '{' + fenceLen + ',}\\s*$');
      var codeLines = [];
      i++;
      while (i < lines.length && !closeRe.test(lines[i].trim())) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // 跳过结束围栏
      if (/^(mermaid|mmd)$/i.test(info)) {
        html += markdownMermaidBlock(codeLines.join('\n'));
      } else {
        html += markdownCodeBlock(codeLines.join('\n'), info);
      }
      continue;
    }

    /* ── 引用块（可嵌套、可多段）────────────────── */
    if (/^>/.test(trimmed)) {
      var quoteLines = [];
      while (i < lines.length) {
        if (/^\s*>/.test(lines[i])) {
          quoteLines.push(lines[i].replace(/^\s*>\s?/, ''));
          i++;
          continue;
        }
        if (lines[i].trim() === '') {
          var peek = i + 1;
          while (peek < lines.length && lines[peek].trim() === '') peek++;
          if (peek < lines.length && /^\s*>/.test(lines[peek])) {
            quoteLines.push('');
            i = peek;
            continue;
          }
        }
        break;
      }
      html += '<blockquote>' + renderMarkdown(quoteLines.join('\n')) + '</blockquote>';
      continue;
    }

    /* ── 分隔线 ───────────────────────────────── */
    if (/^([-*_])(\s*\1){2,}$/.test(trimmed)) {
      html += '<hr />';
      i++;
      continue;
    }

    /* ── 标题（# → h2，保持与旧版一致）────────── */
    var heading = /^(#{1,6})\s+(.*)$/.exec(trimmed);
    if (heading) {
      var level = Math.min(heading[1].length + 1, 6);
      var headingText = heading[2].trim().replace(/\s+#+\s*$/, '');
      html += '<h' + level + '>' + renderInlineMarkdown(headingText) + '</h' + level + '>';
      i++;
      continue;
    }

    /* ── 表格 ─────────────────────────────────── */
    if (isTableStart(i)) {
      var parseCells = function (row) {
        return row.trim().replace(/^\||\|$/g, '').split('|').map(function (cell) {
          return cell.trim();
        });
      };
      var headers = parseCells(lines[i]);
      var aligns = parseCells(lines[i + 1]).map(function (cell) {
        var left = cell.charAt(0) === ':';
        var right = cell.charAt(cell.length - 1) === ':';
        return left && right ? 'center' : right ? 'right' : left ? 'left' : '';
      });
      html += '<div class="markdown-table-wrap"><table><thead><tr>';
      headers.forEach(function (cell, index) {
        html += '<th' + (aligns[index] ? ' style="text-align:' + aligns[index] + '"' : '') + '>' + renderInlineMarkdown(cell) + '</th>';
      });
      html += '</tr></thead><tbody>';
      i += 2;
      while (i < lines.length && lines[i].trim() && lines[i].indexOf('|') !== -1) {
        var cells = parseCells(lines[i]);
        html += '<tr>';
        for (var c = 0; c < headers.length; c++) {
          html += '<td' + (aligns[c] ? ' style="text-align:' + aligns[c] + '"' : '') + '>' + renderInlineMarkdown(cells[c] || '') + '</td>';
        }
        html += '</tr>';
        i++;
      }
      html += '</tbody></table></div>';
      continue;
    }

    /* ── 列表（支持 2 空格缩进的多级嵌套 / 任务清单）── */
    if (/^([-*+]|\d+[.)])\s+/.test(trimmed)) {
      var items = [];
      while (i < lines.length && /^([-*+]|\d+[.)])\s+/.test(lines[i].trim()) && !isFence(lines[i].trim())) {
        var raw = lines[i];
        var indent = (/^[ \t]*/.exec(raw)[0] || '').replace(/\t/g, '  ').length;
        var itemText = raw.trim().replace(/^([-*+]|\d+[.)])\s+/, '');
        var task = /^\[([ xX])\]\s+(.*)$/.exec(itemText);
        items.push({
          indent: indent,
          tag: /^\d/.test(raw.trim()) ? 'ol' : 'ul',
          task: !!task,
          html: task
            ? '<input type="checkbox" disabled' + (task[1].toLowerCase() === 'x' ? ' checked' : '') + ' /> ' + renderInlineMarkdown(task[2])
            : renderInlineMarkdown(itemText)
        });
        i++;
      }
      html += renderMarkdownList(items);
      continue;
    }

    /* ── 段落 ─────────────────────────────────── */
    var para = [];
    while (i < lines.length && !isBlockStart(i)) {
      para.push(lines[i]);
      i++;
    }
    if (para.length) {
      html += '<p>' + renderInlineMarkdown(para.join('\n')) + '</p>';
      continue;
    }
    i++; // 兜底，避免死循环
  }

  return html;
}

/* 列表用缩进栈增量生成，支持 ul/ol 混排与多级嵌套 */
function renderMarkdownList(items) {
  var out = '';
  var stack = [];
  var hasTask = false;

  function closeTop() {
    var top = stack.pop();
    out += '</li></' + top.tag + '>';
    return top;
  }

  items.forEach(function (item) {
    while (stack.length && item.indent < stack[stack.length - 1].indent) closeTop();
    var top = stack[stack.length - 1];
    if (!top || item.indent > top.indent) {
      out += '<' + item.tag + '>';
      stack.push({ indent: item.indent, tag: item.tag });
    } else if (item.tag !== top.tag) {
      closeTop();
      out += '<' + item.tag + '>';
      stack.push({ indent: item.indent, tag: item.tag });
    } else {
      out += '</li>';
    }
    if (item.task) hasTask = true;
    out += '<li' + (item.task ? ' class="task-list-item"' : '') + '>' + item.html;
  });

  while (stack.length) closeTop();

  if (hasTask) {
    out = out.replace(/^<(ul|ol)>/, '<$1 class="task-list">');
  }
  return out;
}

function renderInlineMarkdown(value) {
  var codes = [];
  var text = String(value == null ? '' : value);

  // 行尾两个空格 = 手动换行；段内单个换行按空格处理
  text = text.replace(/ {2,}\n/g, '\u0001').replace(/\n/g, ' ');

  // 行内代码先抽出来占位，避免内容被后续规则二次解析
  text = text.replace(/`([^`\n]+)`/g, function (match, code) {
    codes.push(code);
    return '\u0000' + (codes.length - 1) + '\u0000';
  });

  var out = markdownEscapeHtml(text)
    .replace(/\u0001/g, '<br />');

  // 图片（任意安全地址，含站内相对路径），点击进灯箱
  out = out.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+&quot;[^&]*&quot;)?\)/g, function (match, alt, src) {
    var safe = markdownSafeUrl(src.replace(/&amp;/g, '&'));
    if (!safe) return '![' + alt + '](' + src + ')';
    return '<img class="md-image" src="' + markdownEscapeHtml(safe) + '" alt="' + alt + '" loading="lazy" />';
  });

  // 链接（支持可选 title）
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+&quot;[^&]*&quot;)?\)/g, function (match, label, href) {
    var safe = markdownSafeUrl(href.replace(/&amp;/g, '&'));
    if (!safe) return '[' + label + '](' + href + ')';
    return '<a href="' + markdownEscapeHtml(safe) + '" target="_blank" rel="noopener noreferrer">' + label + '</a>';
  });
  return out
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^\w])__(.+?)__(?!\w)/g, '$1<strong>$2</strong>')
    .replace(/(^|[^\w])\*(?!\s)(.+?)(?<!\s)\*(?!\w)/g, '$1<em>$2</em>')
    .replace(/(^|[^\w])_(?!\s)(.+?)(?<!\s)_(?!\w)/g, '$1<em>$2</em>')
    .replace(/~~(.+?)~~/g, '<del>$1</del>')
    .replace(/==(.+?)==/g, '<mark>$1</mark>')
    .replace(/\u0000(\d+)\u0000/g, function (match, index) {
      return '<code>' + markdownEscapeHtml(codes[Number(index)]) + '</code>';
    });
}
