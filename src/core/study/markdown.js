// A safe markdown subset for lessons, rendered straight to DOM nodes (text is always text, never
// HTML): headings (#, ##, ###), paragraphs, "-"/"*" and "1." lists, **bold**, *italic*, `code`, and
// simple tables (| a | b | with a |---| separator row). Anything else shows as plain text.
import { h } from '../dom.js';

/** Inline: **bold**, *italic*, `code`. Returns a list of nodes/strings. */
export function inline(text) {
  const out = [];
  const re = /\*\*([^*]+)\*\*|\*([^*\s][^*]*)\*|`([^`]+)`/g;
  let last = 0;
  let m;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1] !== undefined) out.push(h('strong', {}, m[1]));
    else if (m[2] !== undefined) out.push(h('em', {}, m[2]));
    else out.push(h('code', {}, m[3]));
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

const cells = (line) => line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
const isTableSep = (line) => /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/.test(line);

/** Renders markdown-subset text to a list of block elements. */
export function renderMarkdown(src) {
  const lines = String(src || '').replace(/\r\n?/g, '\n').split('\n');
  const blocks = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    if (heading) {
      // Lesson headings sit under the lesson title (h2), so # becomes h3.
      blocks.push(h(`h${heading[1].length + 2}`, { class: 'md-h' }, inline(heading[2])));
      i++;
      continue;
    }
    if (/^\s*\|/.test(line) && i + 1 < lines.length && isTableSep(lines[i + 1])) {
      const head = cells(line);
      i += 2;
      const body = [];
      while (i < lines.length && /^\s*\|/.test(lines[i])) body.push(cells(lines[i++]));
      blocks.push(
        h(
          'div',
          { class: 'md-table' },
          h(
            'table',
            {},
            h('thead', {}, h('tr', {}, head.map((c) => h('th', {}, inline(c))))),
            h('tbody', {}, body.map((r) => h('tr', {}, r.map((c) => h('td', {}, inline(c)))))),
          ),
        ),
      );
      continue;
    }
    const ul = /^\s*[-*]\s+(.*)$/;
    const ol = /^\s*\d+[.)]\s+(.*)$/;
    if (ul.test(line) || ol.test(line)) {
      const re = ul.test(line) ? ul : ol;
      const items = [];
      while (i < lines.length && re.test(lines[i])) items.push(h('li', {}, inline(re.exec(lines[i++])[1])));
      blocks.push(h(re === ul ? 'ul' : 'ol', { class: 'md-list' }, items));
      continue;
    }
    const para = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^(#{1,3})\s/.test(lines[i]) &&
      !ul.test(lines[i]) &&
      !ol.test(lines[i]) &&
      !(/^\s*\|/.test(lines[i]) && i + 1 < lines.length && isTableSep(lines[i + 1]))
    ) {
      para.push(lines[i++].trim());
    }
    blocks.push(h('p', {}, inline(para.join(' '))));
  }
  return blocks;
}
