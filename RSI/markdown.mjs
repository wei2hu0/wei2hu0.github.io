import katex from './vendor/katex/katex.mjs';

export const escapeHTML = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function renderMath(tex, displayMode = false, strict = false) {
  return katex.renderToString(tex, {displayMode, throwOnError: strict, strict: 'ignore', trust: false, output: 'htmlAndMathml'});
}

export function inline(source) {
  const protectedHTML = [];
  const hold = html => `\uE000${protectedHTML.push(html)-1}\uE001`;
  let text = source.replace(/`([^`]+)`|(?<!\\)\$([^$\n]+)\$/g, (match, code, math) => hold(code !== undefined ? `<code>${escapeHTML(code)}</code>` : renderMath(math)));
  text = escapeHTML(text).replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_,label,rawURL) => {
    if (!/^(https?:|#|\.\/|\.\.\/)/.test(rawURL)) return label;
    return `<a href="${rawURL}"${rawURL.startsWith('http') ? ' target="_blank" rel="noopener noreferrer"' : ''}>${label}</a>`;
  }).replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>');
  return text.replace(/\uE000(\d+)\uE001/g, (_,i) => protectedHTML[Number(i)]);
}

function tableCells(line) {
  const math = [];
  const protectedLine = line.replace(/\$[^$]+\$|`[^`]+`/g, m => `\uE002${math.push(m)-1}\uE003`);
  return protectedLine.split('|').slice(1,-1).map(cell => inline(cell.trim().replace(/\uE002(\d+)\uE003/g,(_,i)=>math[Number(i)])));
}

export function markdown(source, widget = () => '') {
  const lines = source.replace(/\r\n/g,'\n').split('\n');
  const headings = [];
  let html = '', i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    if (line.startsWith('```')) {
      const language = line.slice(3).trim(), code = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) code.push(lines[i++]);
      i++;
      html += `<pre data-language="${escapeHTML(language)}"><code>${escapeHTML(code.join('\n'))}</code></pre>`;
      continue;
    }
    if (line.trim().startsWith('$$')) {
      const opening = line.trim().slice(2), equation = [];
      if (opening.endsWith('$$')) { equation.push(opening.slice(0,-2)); i++; }
      else {
        if (opening) equation.push(opening);
        i++;
        while (i < lines.length && !lines[i].trim().endsWith('$$')) equation.push(lines[i++]);
        if (i < lines.length) { const end = lines[i++].trim().slice(0,-2); if(end)equation.push(end); }
      }
      html += `<div class="math-display" tabindex="0" role="region" aria-label="数学公式，可横向滚动">${renderMath(equation.join('\n'),true)}</div>`;
      continue;
    }
    if (/^#{2,4} /.test(line)) {
      const level = line.match(/^#+/)[0].length, title = line.slice(level+1), id = `section-${headings.length}`;
      headings.push({id,title,level});
      html += `<h${level} id="${id}">${inline(title)}</h${level}>`; i++; continue;
    }
    if (line.startsWith('|') && /^\|[ :|\-]+\|$/.test(lines[i+1] || '')) {
      html += '<div class="table-wrap" tabindex="0" role="region" aria-label="可横向滚动的数据表"><table><thead><tr>' + tableCells(line).map(c=>`<th>${c}</th>`).join('') + '</tr></thead><tbody>';
      i += 2;
      while (lines[i]?.startsWith('|')) html += '<tr>' + tableCells(lines[i++]).map(c=>`<td>${c}</td>`).join('') + '</tr>';
      html += '</tbody></table></div>'; continue;
    }
    if (line.startsWith('<details>')) {
      const raw = [];
      do { raw.push(lines[i++]); } while (i < lines.length && !raw.at(-1).includes('</details>'));
      const detail = raw.join('\n').match(/^<details>\s*<summary>([\s\S]*?)<\/summary>([\s\S]*?)<\/details>$/);
      if (detail) {
        const body = detail[2].replace(/<p>/g,'\n\n').replace(/<\/p>/g,'\n\n').trim();
        html += `<details><summary>${inline(detail[1])}</summary>${markdown(body,widget).html}</details>`;
      } else html += `<p>${escapeHTML(raw.join('\n'))}</p>`;
      continue;
    }
    if (/^\{\{[\w-]+\}\}$/.test(line.trim())) { html += widget(line.trim().slice(2,-2)); i++; continue; }
    if (line.startsWith('> ')) {
      const quote = [];
      while (lines[i]?.startsWith('> ')) quote.push(lines[i++].slice(2));
      html += `<aside class="callout">${inline(quote.join(' '))}</aside>`; continue;
    }
    if (/^(?:\d+\. |- )/.test(line)) {
      const ordered = /^\d+\. /.test(line), pattern = ordered ? /^\d+\. / : /^- /, tag = ordered ? 'ol' : 'ul';
      html += `<${tag}>`;
      while (lines[i] && pattern.test(lines[i])) html += `<li>${inline(lines[i++].replace(pattern,''))}</li>`;
      html += `</${tag}>`; continue;
    }
    if (/^---+$/.test(line.trim())) { html += '<hr>'; i++; continue; }
    const paragraph = [line]; i++;
    while (i < lines.length && lines[i].trim() && !/^(##|\||```|\$\$|<details|\{\{|> |\d+\. |- |---)/.test(lines[i])) paragraph.push(lines[i++]);
    html += `<p>${inline(paragraph.join(' '))}</p>`;
  }
  return {html,headings};
}
