/**
 * combineHTML.js
 * Two exported functions:
 *   assembleSections(sections, title) → full HTML document string (used after merging a refinement)
 *   combineHTML(site) → full HTML document string (used from WebsiteOutput which already has full_html/css/js)
 */

// ── CSS Scoping ───────────────────────────────────────────────────────────────
/**
 * Wraps every rule in `css` with `#section-{sectionName}` so styles from
 * different sections never collide. At-rules (@import, @keyframes, @media)
 * are left at the top level.
 */
function scopeCSS(sectionName, css) {
  if (!css || !css.trim()) return ''
  const prefix = `#section-${sectionName}`
  const lines = css.split('\n')
  const output = []
  let depth = 0
  let buffer = []
  let atRule = false

  for (const raw of lines) {
    const line = raw

    // Detect top-level at-rules that should NOT be scoped (@import, @font-face, @keyframes)
    const isAtRule = /^\s*@(import|font-face|keyframes|charset|layer)/i.test(line)
    if (isAtRule && depth === 0) {
      output.push(line)
      // @keyframes has a block — track it
      if (/^\s*@keyframes/i.test(line)) atRule = true
      continue
    }

    const opens  = (line.match(/\{/g) || []).length
    const closes = (line.match(/\}/g) || []).length

    if (depth === 0 && !atRule && opens > 0) {
      // Start of a new top-level rule — prefix the selector
      const prefixed = line.replace(/^(\s*)([^{]+)(\{)/, (_, indent, selector, brace) => {
        // Scope each comma-separated selector
        const scoped = selector
          .split(',')
          .map((s) => {
            const t = s.trim()
            if (!t) return t
            // Don't double-scope if already has the prefix
            if (t.startsWith(prefix)) return `  ${t}`
            // :root and * selectors should stay global
            if (t === ':root' || t === '*' || t === 'body' || t === 'html') return `  ${t}`
            return `  ${prefix} ${t}`
          })
          .join(',\n')
        return `${scoped} ${brace}`
      })
      buffer.push(prefixed)
    } else {
      buffer.push(line)
    }

    depth += opens - closes
    if (depth <= 0) {
      depth = 0
      atRule = false
      output.push(buffer.join('\n'))
      buffer = []
    }
  }
  if (buffer.length) output.push(buffer.join('\n'))
  return output.join('\n')
}


function buildDoc(title, html, css, js) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body { margin: 0; }
    ${css || ''}
  </style>
</head>
<body>
${html || ''}
${js ? `<script>\n${js}\n<\/script>` : ''}
</body>
</html>`
}

/**
 * Assemble a full HTML document from a sections array.
 * Used after merging changed + unchanged sections post-refinement.
 * Each section gets:
 *  - A wrapper div: <div id="section-{name}" class="site-section">
 *  - CSS scoped with #section-{name} prefix
 */
export function assembleSections(sections, title = 'Generated Site') {
  console.log('[ASSEMBLE] Section order:', sections.map((s) => s.section))
  console.log('[ASSEMBLE] Any section missing html?', sections.filter((s) => !s.html).map((s) => s.section))

  const htmlParts = sections.map((s) => {
    // Wrap each section's html in a scoping div
    return `<div id="section-${s.section}" class="site-section">\n${s.html || ''}\n</div>`
  })
  const html = htmlParts.join('\n')

  // Scope each section's CSS
  const rawCSSParts = sections
    .map((s) => (s.css || '').trim())
    .filter(Boolean)

  // Sample log: first section CSS before/after scoping
  if (rawCSSParts.length > 0) {
    const sampleName = sections[0].section
    const sampleBefore = sections[0].css?.slice(0, 200) ?? ''
    const sampleAfter = scopeCSS(sampleName, sections[0].css || '').slice(0, 200)
    console.log('[CSS_SCOPED] Sample section:', sampleName)
    console.log('[CSS_SCOPED] Before (200 chars):', sampleBefore)
    console.log('[CSS_SCOPED] After  (200 chars):', sampleAfter)
  }

  const css = sections
    .map((s) => scopeCSS(s.section, s.css || ''))
    .filter(Boolean)
    .join('\n\n')

  // Only emit <script> for sections with actual JS content
  const jsSections = sections.filter((s) => s.js && s.js.trim())
  console.log('[JS_SECTIONS] Sections contributing JS:', jsSections.map((s) => s.section))
  const js = jsSections.map((s) => s.js.trim()).join('\n\n')

  console.log('[ASSEMBLE] Total CSS length:', css.length)
  console.log('[ASSEMBLE] Google Fonts in CSS?', css.includes('fonts.googleapis'))

  const doc = buildDoc(title, html, css, js)
  console.log('[ASSEMBLE] Tailwind CDN in HTML?', doc.includes('tailwindcss'))
  console.log('[ASSEMBLED_HTML] First 500 chars:', doc.slice(0, 500))

  return doc
}

/**
 * Build a full HTML document from a WebsiteOutput.
 * ALWAYS uses assembleSections when sections[] is available — this is the
 * authoritative source of truth for both /generate and /refine paths.
 * The full_html/full_css fields from the backend contain unscoped CSS that
 * collides across sections, so we always reassemble with scoped CSS here.
 * Falls back to full_html/full_css only if sections[] is missing (legacy).
 */
export function combineHTML(site) {
  if (!site) return ''
  // Prefer the sections array (scoped CSS applied by assembleSections)
  if (site.sections?.length) {
    return assembleSections(site.sections, site.title || 'Generated Site')
  }
  // Legacy flat format { html, css, js } or when sections is empty
  return buildDoc(
    site.title || 'Generated Site',
    site.full_html || site.html || '',
    site.full_css  || site.css  || '',
    site.full_js   || site.js   || '',
  )
}
