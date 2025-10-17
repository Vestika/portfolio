const MSG = {
  REQUEST_ID_TOKEN: 'VESTIKA_EXTENSION_GET_ID_TOKEN',
  ID_TOKEN: 'VESTIKA_EXTENSION_ID_TOKEN',
} as const;

// Relay background request into page and back via window.postMessage bridge
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === MSG.REQUEST_ID_TOKEN) {
    const { requestId } = message as { requestId: string };
    // Post to page context; window listener in web app checks source === window
    window.postMessage({ type: MSG.REQUEST_ID_TOKEN, requestId }, '*');

    const handler = (event: MessageEvent) => {
      const data = event.data as any;
      if (!data || data.type !== MSG.ID_TOKEN || data.requestId !== requestId) return;
      window.removeEventListener('message', handler as any);
      // Forward directly to background so it can resolve the token promise
      chrome.runtime.sendMessage({ type: MSG.ID_TOKEN, requestId, token: data.token });
      sendResponse({ ok: true });
    };
    window.addEventListener('message', handler as any);
    return true; // async
  }
});

// Utility to capture page HTML with scripts/styles removed
export function captureHtml(selector?: string): string {
  const cloned = document.documentElement.cloneNode(true) as HTMLElement;
  // Remove script/style tags
  cloned.querySelectorAll('script, style').forEach((el) => el.remove());
  if (selector) {
    const el = document.querySelector(selector);
    if (el) return (el.cloneNode(true) as HTMLElement).outerHTML;
  }
  return cloned.outerHTML;
}

// Simple element picker overlay to capture a CSS selector
export function enableElementPicker() {
  const overlay = document.createElement('div');
  overlay.style.position = 'fixed';
  overlay.style.top = '0';
  overlay.style.left = '0';
  overlay.style.right = '0';
  overlay.style.bottom = '0';
  overlay.style.zIndex = '2147483647';
  overlay.style.pointerEvents = 'none';

  const highlight = document.createElement('div');
  highlight.style.position = 'fixed';
  highlight.style.border = '2px solid #3b82f6';
  highlight.style.background = 'rgba(59,130,246,0.1)';
  highlight.style.pointerEvents = 'none';
  overlay.appendChild(highlight);

  const onMove = (e: MouseEvent) => {
    const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    highlight.style.top = rect.top + 'px';
    highlight.style.left = rect.left + 'px';
    highlight.style.width = rect.width + 'px';
    highlight.style.height = rect.height + 'px';
  };

  const onClick = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
    if (!el) return;
    const selector = buildSimpleSelector(el);
    window.dispatchEvent(new CustomEvent('vestika:element-picked', { detail: { selector } } as any));
    cleanup();
  };

  const cleanup = () => {
    window.removeEventListener('mousemove', onMove, true);
    window.removeEventListener('click', onClick, true);
    window.removeEventListener('keydown', onKey, true);
    overlay.remove();
  };

  const buildSimpleSelector = (el: HTMLElement): string => {
    if (el.id) return `#${CSS.escape(el.id)}`;
    const classes = Array.from(el.classList).map((c) => `.${CSS.escape(c)}`).join('');
    const tag = el.tagName.toLowerCase();
    return `${tag}${classes}`;
  };

  document.body.appendChild(overlay);
  window.addEventListener('mousemove', onMove, true);
  window.addEventListener('click', onClick, true);

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      cleanup();
    }
  };
  window.addEventListener('keydown', onKey, true);
}

// Listen for requests from the extension to start the picker and report back
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'ENABLE_ELEMENT_PICKER') {
    try {
      enableElementPicker();
      const handler = (e: Event) => {
        const detail = (e as CustomEvent).detail as { selector?: string };
        if (detail?.selector) {
          chrome.runtime.sendMessage({ type: 'ELEMENT_PICKED', selector: detail.selector });
        }
        window.removeEventListener('vestika:element-picked', handler as any);
      };
      window.addEventListener('vestika:element-picked', handler as any);
      sendResponse({ ok: true });
    } catch (e) {
      sendResponse({ ok: false });
    }
    return true; // async
  }
});

export {};

