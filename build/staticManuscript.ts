import { sections } from '../src/data/book'
import { sourceNumberById, sources } from '../src/data/sources'
import type { BookBlock } from '../src/types'

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function citations(ids?: string[]) {
  if (!ids?.length) return ''
  return `<span class="citations">${ids.map((id) => {
    const number = sourceNumberById.get(id) ?? id
    return `<a href="#source-${escapeHtml(id)}" aria-label="Source ${number}">[${number}]</a>`
  }).join('')}</span>`
}

function label(value?: string) {
  return value ? `<span class="label">${escapeHtml(value)}</span>` : ''
}

function renderBlock(block: BookBlock) {
  if (block.type === 'heading') return `<h3>${escapeHtml(block.text)}</h3>`
  if (block.type === 'paragraph') {
    return `<p>${label(block.label)}${escapeHtml(block.text)} ${citations(block.citations)}</p>`
  }
  if (block.type === 'callout') {
    return `<aside>${label(block.label)}<h3>${escapeHtml(block.title)}</h3><p>${escapeHtml(block.text)} ${citations(block.citations)}</p></aside>`
  }
  if (block.type === 'figure') {
    return `<figure>${label(block.label ?? 'Synthesis')}<figcaption><strong>${escapeHtml(block.title)}.</strong> ${escapeHtml(block.caption)} ${citations(block.citations)}</figcaption></figure>`
  }
  if (block.type === 'list') {
    const listTag = block.ordered ? 'ol' : 'ul'
    return `<section class="list">${label(block.label)}${block.title ? `<h3>${escapeHtml(block.title)}</h3>` : ''}<${listTag}>${block.items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</${listTag}>${citations(block.citations)}</section>`
  }
  if (block.type === 'timeline') {
    return `<ol class="timeline">${block.items.map((item) => `<li><time>${escapeHtml(item.year)}</time><div><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.detail)} ${citations(item.citations)}</p></div></li>`).join('')}</ol>`
  }
  return `<dl>${block.items.map((item) => `<div><dt>${escapeHtml(item.term)}</dt><dd>${escapeHtml(item.definition)}</dd></div>`).join('')}</dl>`
}

export function renderStaticManuscript() {
  const contents = sections.map((section) => `<li><a href="#${escapeHtml(section.id)}"><span>${String(section.number + 1).padStart(2, '0')}</span>${escapeHtml(section.title)}</a></li>`).join('')
  const manuscript = sections.map((section) => `
    <article id="${escapeHtml(section.id)}">
      <header>
        <span>${escapeHtml(section.part)} · ${String(section.number + 1).padStart(2, '0')} / ${String(sections.length).padStart(2, '0')}</span>
        <h2>${escapeHtml(section.title)}</h2>
        <p class="deck">${escapeHtml(section.deck)}</p>
      </header>
      ${section.blocks.map(renderBlock).join('\n')}
      <p class="back"><a href="#contents">Back to contents</a></p>
    </article>`).join('\n')
  const evidence = sources.map((source) => `
    <li id="source-${escapeHtml(source.id)}">
      <span>${String(sourceNumberById.get(source.id) ?? 0).padStart(2, '0')}</span>
      <p><strong>${escapeHtml(source.author)}.</strong> <cite>${escapeHtml(source.title)}</cite>. ${escapeHtml(source.publication)}, ${escapeHtml(source.year)}. <em>${escapeHtml(source.type)}</em>${source.note ? ` ${escapeHtml(source.note)}` : ''} <a href="${escapeHtml(source.url)}">Open source</a></p>
    </li>`).join('\n')

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="description" content="The complete static manuscript of The Programmable Voice.">
  <title>Static manuscript — The Programmable Voice</title>
  <style>
    *{box-sizing:border-box}html{color-scheme:light dark;scroll-behavior:smooth}body{max-width:78rem;margin:0 auto;padding:1rem clamp(1rem,4vw,4rem) 6rem;background:Canvas;color:CanvasText;font-family:Georgia,serif;line-height:1.65}a{color:inherit;text-underline-offset:.2em}a:focus-visible{outline:2px solid currentColor;outline-offset:3px}.masthead{padding:8vh 0 3rem;border-bottom:1px solid currentColor}.masthead>span,.label,article>header>span{font:600 .68rem/1.4 ui-monospace,monospace;letter-spacing:.08em;text-transform:uppercase}.masthead h1{max-width:12ch;margin:.35rem 0 1rem;font-size:clamp(3.3rem,10vw,8rem);font-weight:500;line-height:.84;letter-spacing:-.06em}.masthead p,.deck{max-width:42rem;font-size:clamp(1.25rem,2.2vw,1.8rem);font-style:italic}nav{padding:3rem 0;border-bottom:1px solid currentColor}nav h2{font:600 .78rem ui-monospace,monospace;text-transform:uppercase;letter-spacing:.08em}nav ol{margin:1rem 0 0;padding:0;list-style:none;columns:2;column-gap:3rem}nav li{break-inside:avoid;border-top:1px solid color-mix(in srgb,currentColor 20%,transparent)}nav a{display:grid;min-height:44px;padding:.7rem 0;grid-template-columns:3rem 1fr;text-decoration:none}nav span{font:.7rem ui-monospace,monospace}article{padding:5rem 0;border-bottom:1px solid currentColor}article>header{margin-bottom:3rem}article h2{max-width:14ch;margin:.5rem 0 1rem;font-size:clamp(3rem,7vw,6.5rem);font-weight:500;line-height:.9;letter-spacing:-.05em}article h3{margin:2.5rem 0 .75rem;font-size:clamp(1.5rem,3vw,2.2rem);line-height:1.05}article>p,.list,aside,figure,dl,.timeline{max-width:48rem;font-size:1.15rem}.label{display:block;width:max-content;margin:1.8rem 0 .7rem;padding:.2rem .35rem;border:1px solid currentColor;font-size:.58rem;font-style:normal}aside,figure{margin:3rem 0;padding:1.5rem 0 1.5rem 1.4rem;border-block:1px solid currentColor;border-left:5px solid currentColor}figure{border-left:1px solid currentColor}.citations{white-space:nowrap}.citations a{display:inline-grid;min-width:44px;min-height:44px;place-items:center;font:.68rem ui-monospace,monospace}.list ol,.list ul{padding-left:1.5rem}.list li{padding:.55rem 0;overflow-wrap:anywhere}.timeline{padding:0;list-style:none}.timeline li,dl>div{display:grid;padding:1rem 0;grid-template-columns:8rem 1fr;gap:1rem;border-top:1px solid color-mix(in srgb,currentColor 20%,transparent)}.timeline h3{margin:0}.timeline p{margin:0}dt{font:600 .7rem ui-monospace,monospace;text-transform:uppercase}dd{margin:0}.back{font:600 .65rem ui-monospace,monospace;text-transform:uppercase}.sources{padding:5rem 0}.sources h2{font-size:clamp(2.6rem,6vw,5rem);font-weight:500}.sources ol{padding:0;list-style:none}.sources li{display:grid;padding:1rem 0;grid-template-columns:3rem 1fr;border-top:1px solid color-mix(in srgb,currentColor 20%,transparent)}.sources li>span{font:.68rem ui-monospace,monospace}.sources p{margin:0;overflow-wrap:anywhere}.sources a{display:inline-block;min-height:44px;padding-top:.6rem}@media(max-width:600px){nav ol{columns:1}.timeline li,dl>div{grid-template-columns:1fr;gap:.25rem}.masthead h1{overflow-wrap:anywhere}}@media print{html{color-scheme:light}body{max-width:none;padding:0}nav,.back{display:none}article{break-before:page}.sources{break-before:page}}
  </style>
</head>
<body>
  <header class="masthead"><span>Static reading edition</span><h1>The Programmable Voice</h1><p>How humanity taught machines to hear, speak and converse.</p><p>This edition contains the complete manuscript and evidence register without JavaScript, animation, or audio.</p></header>
  <nav id="contents" aria-label="Book contents"><h2>Contents</h2><ol>${contents}</ol></nav>
  <main>${manuscript}<section class="sources" id="evidence"><h2>Evidence register</h2><ol>${evidence}</ol></section></main>
</body>
</html>`
}
