// HTML extraction logic for content script

/**
 * Extract HTML from current page
 */
export function extractHTML(selector?: string, fullPage: boolean = true): string {
  if (!fullPage && selector) {
    const element = document.querySelector(selector);
    if (!element) {
      throw new Error(`Element not found for selector: ${selector}`);
    }
    return cleanHTML(element.outerHTML);
  }

  return cleanHTML(document.documentElement.outerHTML);
}

/**
 * Clean HTML by removing scripts, styles, and event handlers
 */
function cleanHTML(html: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  // Remove script, style, and noscript tags
  doc.querySelectorAll('script, style, noscript').forEach(el => el.remove());

  // Remove inline event handlers
  doc.querySelectorAll('*').forEach(el => {
    Array.from(el.attributes).forEach(attr => {
      if (attr.name.startsWith('on')) {
        el.removeAttribute(attr.name);
      }
    });
  });

  return doc.documentElement.outerHTML;
}

/**
 * Highlight element on page (for visual selector)
 */
export function highlightElement(selector: string) {
  // Remove previous highlights
  document.querySelectorAll('.vestika-highlight').forEach(el => {
    el.classList.remove('vestika-highlight');
  });

  // Add highlight to selected element
  const element = document.querySelector(selector);
  if (element) {
    element.classList.add('vestika-highlight');
  }
}

// Inject highlight CSS
const style = document.createElement('style');
style.textContent = `
  .vestika-highlight {
    outline: 3px solid #4CAF50 !important;
    outline-offset: 2px !important;
  }
`;
document.head.appendChild(style);
