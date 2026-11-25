/**
 * backend/frontmatter.js — YAML / TOML front matter 解析与生成（零依赖）
 *
 * 静态博客（Hugo / Hexo / Jekyll / Astro / Ghost / Obsidian）的正文都长这样：
 *   ---
 *   title: 你好
 *   date: 2024-05-01 12:00:00
 *   tags: [随笔, 折腾]
 *   ---
 *   正文……
 *
 * Hugo 还支持 TOML 的 +++ 分隔。这里实现的是「够用且不误伤」的子集：
 *   · 标量：字符串（含引号）、数字、布尔、null
 *   · 行内数组 [a, b] / ["a", "b"]
 *   · 块数组（- a 换行）
 *   · 多行字符串 | 与 >
 *   · TOML 的 key = "value" 与 key = [ "a", "b" ]
 * 复杂嵌套（对象套对象）不展开，原样保留为字符串，避免导入时丢字段或抛错。
 */

'use strict';

function stripQuotes(raw) {
  const s = String(raw == null ? '' : raw).trim();
  if (s.length >= 2) {
    const first = s[0];
    const last = s[s.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      const inner = s.slice(1, -1);
      if (first === '"') {
        return inner
          .replace(/\\n/g, '\n')
          .replace(/\\t/g, '\t')
          .replace(/\\"/g, '"')
          .replace(/\\\\/g, '\\');
      }
      return inner.replace(/''/g, "'");
    }
  }
  return s;
}

function parseScalar(raw) {
  // 去掉行尾注释（引号内的 # 不算）
  let s = String(raw == null ? '' : raw);
  let inQuote = '';
  let cut = -1;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inQuote) {
      if (ch === inQuote && s[i - 1] !== '\\') inQuote = '';
    } else if (ch === '"' || ch === "'") {
      inQuote = ch;
    } else if (ch === '#' && (i === 0 || /\s/.test(s[i - 1]))) {
      cut = i;
      break;
    }
  }
  if (cut !== -1) s = s.slice(0, cut);
  s = s.trim();
  if (!s) return '';

  if (/^\[.*\]$/.test(s)) {
    const inner = s.slice(1, -1).trim();
    if (!inner) return [];
    return splitTopLevel(inner).map(part => stripQuotes(part.trim())).filter(v => v !== '');
  }

  const lower = s.toLowerCase();
  if (lower === 'true' || lower === 'yes') return true;
  if (lower === 'false' || lower === 'no') return false;
  if (lower === 'null' || lower === '~') return '';
  if (/^-?\d+$/.test(s)) return Number(s);
  if (/^-?\d+\.\d+$/.test(s)) return Number(s);
  return stripQuotes(s);
}

// 按逗号切分，忽略引号/括号里的逗号
function splitTopLevel(text) {
  const out = [];
  let buf = '';
  let depth = 0;
  let quote = '';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quote) {
      buf += ch;
      if (ch === quote && text[i - 1] !== '\\') quote = '';
      continue;
    }
    if (ch === '"' || ch === "'") { quote = ch; buf += ch; continue; }
    if (ch === '[' || ch === '{') depth++;
    if (ch === ']' || ch === '}') depth--;
    if (ch === ',' && depth === 0) { out.push(buf); buf = ''; continue; }
    buf += ch;
  }
  if (buf.trim()) out.push(buf);
  return out;
}

function parseYaml(text) {
  const data = {};
  const lines = String(text || '').split(/\r?\n/);
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    i++;
    if (!line.trim() || /^\s*#/.test(line)) continue;
    if (/^\s/.test(line)) continue;               // 不支持嵌套对象，跳过缩进行
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let rest = line.slice(idx + 1);
    if (!key) continue;

    const trimmed = rest.trim();
    // 多行字符串：| 保留换行，> 折叠为空格
    if (trimmed === '|' || trimmed === '>' || trimmed === '|-' || trimmed === '>-') {
      const block = [];
      while (i < lines.length && (/^\s{2,}/.test(lines[i]) || !lines[i].trim())) {
        block.push(lines[i].replace(/^\s{2}/, ''));
        i++;
      }
      while (block.length && !block[block.length - 1].trim()) block.pop();
      data[key] = trimmed[0] === '|' ? block.join('\n') : block.join(' ').replace(/\s+/g, ' ').trim();
      continue;
    }

    if (trimmed === '') {
      // 可能是块数组（- a）或嵌套对象
      const items = [];
      let consumed = 0;
      while (i + consumed < lines.length) {
        const next = lines[i + consumed];
        if (!next.trim()) { consumed++; continue; }
        const m = next.match(/^\s*-\s+(.*)$/);
        if (!m) break;
        items.push(parseScalar(m[1]));
        consumed++;
      }
      if (items.length) {
        data[key] = items;
        i += consumed;
        continue;
      }
      // 嵌套对象：把缩进行拼成原始字符串，保留信息
      const nested = [];
      while (i < lines.length && /^\s+\S/.test(lines[i])) {
        nested.push(lines[i].trim());
        i++;
      }
      data[key] = nested.join('\n');
      continue;
    }

    data[key] = parseScalar(rest);
  }
  return data;
}

function parseToml(text) {
  const data = {};
  const lines = String(text || '').split(/\r?\n/);
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    i++;
    const t = line.trim();
    if (!t || t[0] === '#') continue;
    if (t[0] === '[') continue;                   // 表头 [params]：扁平化，忽略
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    const key = t.slice(0, eq).trim();
    const rest = t.slice(eq + 1).trim();
    if (!key) continue;
    if (rest.startsWith('"""') || rest.startsWith("'''")) {
      const fence = rest.slice(0, 3);
      const block = [rest.slice(3)];
      while (i < lines.length) {
        const cur = lines[i];
        i++;
        const end = cur.indexOf(fence);
        if (end !== -1) { block.push(cur.slice(0, end)); break; }
        block.push(cur);
      }
      data[key] = block.join('\n').replace(/^\n/, '');
      continue;
    }
    if (rest.startsWith('[')) {
      // 可能是多行数组
      let buf = rest;
      while (!/\]\s*(#.*)?$/.test(buf) && i < lines.length) {
        buf += ' ' + lines[i].trim();
        i++;
      }
      data[key] = parseScalar(buf);
      continue;
    }
    data[key] = parseScalar(rest);
  }
  return data;
}

/**
 * 拆分 front matter 与正文。支持 --- (YAML) 与 +++ (TOML)。
 * @returns {{ format: 'yaml'|'toml'|'none', data: object, body: string }}
 */
function split(raw) {
  const text = String(raw == null ? '' : raw).replace(/^\uFEFF/, '');
  const m = text.match(/^(---|\+\+\+)[ \t]*\r?\n([\s\S]*?)\r?\n\1[ \t]*(?:\r?\n|$)([\s\S]*)$/);
  if (!m) return { format: 'none', data: {}, body: text };
  const fence = m[1];
  const block = m[2];
  const body = m[3];
  if (fence === '+++') return { format: 'toml', data: parseToml(block), body };
  return { format: 'yaml', data: parseYaml(block), body };
}

function yamlValue(v) {
  if (Array.isArray(v)) return '[' + v.map(x => yamlScalar(String(x))).join(', ') + ']';
  return yamlScalar(v);
}

function yamlScalar(v) {
  // 布尔 / 数字保持裸值：Hugo、Jekyll 的 draft: "true" 是字符串，会被当成真值以外的怪东西
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  const s = String(v == null ? '' : v);
  if (!s) return '""';
  if (/^[A-Za-z0-9\u4e00-\u9fa5][^:#\n"'\[\]{}]*$/.test(s) && !/^(true|false|null|yes|no)$/i.test(s)) {
    return s;
  }
  return '"' + s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n') + '"';
}

/** 生成 YAML front matter（只处理扁平字段 + 数组） */
function stringify(data) {
  const lines = ['---'];
  Object.keys(data || {}).forEach((key) => {
    const v = data[key];
    if (v === undefined || v === null || v === '') return;
    if (Array.isArray(v)) {
      if (!v.length) return;
      lines.push(key + ': ' + yamlValue(v));
      return;
    }
    lines.push(key + ': ' + yamlValue(v));
  });
  lines.push('---', '');
  return lines.join('\n');
}

module.exports = {
  split,
  parse: split,
  stringify,
  parseYaml,
  parseToml,
  parseScalar,
  stripQuotes
};
