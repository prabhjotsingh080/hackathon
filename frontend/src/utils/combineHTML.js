/**
 * combineHTML.js
 * Assembles a full standalone HTML document from the WebsiteOutput fields
 * so it can be loaded into an iframe via srcdoc.
 */

/**
 * @param {{ html: string, css: string, js: string, title: string }} site
 * @returns {string} Complete HTML document string
 */
export function combineHTML({ html = '', css = '', js = '', title = 'Generated Site' }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body { margin: 0; }
    ${css}
  </style>
</head>
<body>
${html}
${js ? `<script>\n${js}\n<\/script>` : ''}
</body>
</html>`
}
