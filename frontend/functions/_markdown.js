function markdownEscapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderMarkdown(md) {
  var lines = String(md || '').replace(/\r\n?/g, '\n').split('\n');
  var html = '';
  var paragraph = [];
  var listType = '';
  var inCode = false;
  var codeLines = [];

  function flushParagraph() {
    if (paragraph.length) {
      html += '<p>' + renderInlineMarkdown(paragraph.join(' ')) + '</p>';
      paragraph = [];
    }
  }

  function closeList() {
    if (listType) {
      html += '</' + listType + '>';
      listType = '';
    }
  }

  function tableCells(line) {
    return line.trim().replace(/^\||\|$/g, '').split('|').map(function (cell) {
      return cell.trim();
    });
  }

  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    var trimmed = line.trim();

    if (trimmed.indexOf('```') === 0) {
      flushParagraph();
      closeList();
      if (inCode) {
        html += '<pre><code>' + markdownEscapeHtml(codeLines.join('\n')) + '</code></pre>';
        codeLines = [];
        inCode = false;
      } else {
        inCode = true;
      }
      continue;
    }
    if (inCode) {
      codeLines.push(line);
      continue;
    }
    if (!trimmed) {
      flushParagraph();
      closeList();
      continue;
    }

    var nextLine = i + 1 < lines.length ? lines[i + 1].trim() : '';
    if (trimmed.indexOf('|') !== -1 && /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(nextLine)) {
      flushParagraph();
      closeList();
      var headers = tableCells(trimmed);
      var alignments = tableCells(nextLine).map(function (cell) {
        return cell.charAt(0) === ':' && cell.charAt(cell.length - 1) === ':' ? 'center' : (cell.charAt(cell.length - 1) === ':' ? 'right' : (cell.charAt(0) === ':' ? 'left' : ''));
      });
      html += '<div class="markdown-table-wrap"><table><thead><tr>';
      headers.forEach(function (cell, index) {
        html += '<th' + (alignments[index] ? ' style="text-align:' + alignments[index] + '"' : '') + '>' + renderInlineMarkdown(cell) + '</th>';
      });
      html += '</tr></thead><tbody>';
      i += 2;
      while (i < lines.length && lines[i].trim().indexOf('|') !== -1) {
        var cells = tableCells(lines[i]);
        html += '<tr>';
        for (var cellIndex = 0; cellIndex < headers.length; cellIndex++) {
          var cellValue = cells[cellIndex] || '';
          html += '<td' + (alignments[cellIndex] ? ' style="text-align:' + alignments[cellIndex] + '"' : '') + '>' + renderInlineMarkdown(cellValue) + '</td>';
        }
        html += '</tr>';
        i++;
      }
      html += '</tbody></table></div>';
      i--;
      continue;
    }

    var heading = /^(#{1,6})\s+(.+)$/.exec(trimmed);
    if (heading) {
      flushParagraph();
      closeList();
      var level = Math.min(Number(heading[1].length) + 1, 6);
      html += '<h' + level + '>' + renderInlineMarkdown(heading[2]) + '</h' + level + '>';
      continue;
    }

    var task = /^[-*+]\s+\[([ xX])\]\s+(.+)$/.exec(trimmed);
    var unordered = /^[-*+]\s+(.+)$/.exec(trimmed);
    var ordered = /^\d+[.)]\s+(.+)$/.exec(trimmed);
    if (task || unordered || ordered) {
      flushParagraph();
      var desiredListType = ordered ? 'ol' : 'ul';
      if (listType !== desiredListType) {
        closeList();
        listType = desiredListType;
        html += '<' + listType + (task ? ' class="task-list"' : '') + '>';
      }
      if (task) {
        html += '<li class="task-list-item"><input type="checkbox" disabled' + (task[1].toLowerCase() === 'x' ? ' checked' : '') + ' /> ' + renderInlineMarkdown(task[2]) + '</li>';
      } else {
        html += '<li>' + renderInlineMarkdown((unordered || ordered)[1]) + '</li>';
      }
      continue;
    }

    closeList();
    paragraph.push(trimmed);
  }

  if (inCode) html += '<pre><code>' + markdownEscapeHtml(codeLines.join('\n')) + '</code></pre>';
  flushParagraph();
  closeList();
  return html;
}

function renderInlineMarkdown(value) {
  return markdownEscapeHtml(value)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.+?)__/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/_(.+?)_/g, '<em>$1</em>')
    .replace(/~~(.+?)~~/g, '<del>$1</del>')
    .replace(/!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g, '<img src="$2" alt="$1" loading="lazy" />')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
}
// Worker 模块导出（与前端 markdown.js 保持同一渲染实现，SSR 与 SPA 输出一致）
export { renderMarkdown, markdownEscapeHtml };
