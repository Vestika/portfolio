// Messaging keys
const MSG = {
  REQUEST_ID_TOKEN: 'VESTIKA_EXTENSION_GET_ID_TOKEN',
  ID_TOKEN: 'VESTIKA_EXTENSION_ID_TOKEN',
} as const;
// Firebase-in-extension auth (custom token)
let extUserToken: string | null = null;

async function signInWithCustomToken(): Promise<string | null> {
  try {
    const { apiBase } = await chrome.storage.sync.get('apiBase');
    const envBase = (import.meta && (import.meta as any).env && (import.meta as any).env.VITE_API_BASE) || 'http://localhost:8080';
    const base = apiBase || envBase;
    // Use existing bearer to request a custom token; fallback to web-app token bridge
    let bearer = await getAuthToken();
    if (!bearer) return null;
    const res = await fetch(`${base}/extension/identity/custom-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${bearer}` },
    });
    if (!res.ok) return null;
    const json = await res.json();
    extUserToken = json.custom_token;
    // Store for future reuse in session
    try { await chrome.storage.session.set({ extCustomToken: extUserToken }); } catch {}
    return extUserToken;
  } catch {
    return null;
  }
}

async function getExtensionAuthHeader(): Promise<string | null> {
  if (extUserToken) return extUserToken;
  try {
    const sess = await chrome.storage.session.get('extCustomToken');
    if (sess && sess.extCustomToken) {
      extUserToken = sess.extCustomToken as string;
      return extUserToken;
    }
  } catch {}
  return null;
}

async function startChromeIdentityLogin(): Promise<string | null> {
  return new Promise((resolve) => {
    const redirectUri = `https://${chrome.runtime.id}.chromiumapp.org/`; // whitelisted in Google console
    const clientId = '962053007917-m3tjj95uaa08o04nfjjihsit73j7npem.apps.googleusercontent.com';
    const scope = 'openid email profile';
    const url = 'https://accounts.google.com/o/oauth2/v2/auth' +
      `?client_id=${encodeURIComponent(clientId)}` +
      `&response_type=id_token` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&scope=${encodeURIComponent(scope)}` +
      `&prompt=consent` +
      `&nonce=${encodeURIComponent(Math.random().toString(36).slice(2))}`;

    chrome.identity.launchWebAuthFlow({ url, interactive: true }, async (responseUrl) => {
      if (chrome.runtime.lastError || !responseUrl) {
        return resolve(null);
      }
      const m = responseUrl.match(/[&#?]id_token=([^&]+)/);
      const idToken = m ? decodeURIComponent(m[1]) : null;
      if (!idToken) return resolve(null);

      // Exchange for Firebase custom token
      try {
        const { apiBase } = await chrome.storage.sync.get('apiBase');
        const envBase = (import.meta && (import.meta as any).env && (import.meta as any).env.VITE_API_BASE) || 'http://localhost:8080';
        const base = apiBase || envBase;
        const res = await fetch(`${base}/extension/identity/custom-token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id_token: idToken })
        });
        const json = await res.json();
        if (!res.ok || !json.custom_token) return resolve(null);
        await chrome.storage.session.set({ extCustomToken: json.custom_token });
        extUserToken = json.custom_token;
        resolve(extUserToken);
      } catch {
        resolve(null);
      }
    });
  });
}


// Active token cache (ephemeral)
let cachedToken: string | null = null;
let lastTokenAt = 0;

async function getWebAppToken(tabId: number, forceRefresh = false): Promise<string | null> {
  // Ask content script to bridge the request into the page context and listen for its one-off reply
  const requestId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return await new Promise<string | null>((resolve) => {
    const responseHandler = (msg: any, sender: chrome.runtime.MessageSender) => {
      if (msg?.type === MSG.ID_TOKEN && msg.requestId === requestId && sender.tab?.id === tabId) {
        chrome.runtime.onMessage.removeListener(responseHandler);
        resolve(msg.token ?? null);
      }
    };
    chrome.runtime.onMessage.addListener(responseHandler);
    chrome.tabs.sendMessage(tabId, { type: MSG.REQUEST_ID_TOKEN, requestId, forceRefresh });
    setTimeout(() => {
      chrome.runtime.onMessage.removeListener(responseHandler);
      resolve(null);
    }, 3000);
  });
}

async function findWebAppTabId(): Promise<number | null> {
  return new Promise((resolve) => {
    chrome.tabs.query(
      { url: ['https://app.vestika.io/*', 'http://localhost:5173/*'] },
      (tabs) => {
        if (chrome.runtime.lastError) return resolve(null);
        if (!tabs || tabs.length === 0) return resolve(null);
        // Prefer active tab
        const active = tabs.find((t) => t.active && typeof t.id === 'number');
        if (active && active.id != null) return resolve(active.id);
        // Fallback to first
        const first = tabs[0];
        resolve(first && first.id != null ? first.id : null);
      }
    );
  });
}

async function getAuthToken(_requestingTabId?: number): Promise<string | null> {
  const now = Date.now();
  if (cachedToken && now - lastTokenAt < 4 * 60 * 1000) return cachedToken; // 4 min cache
  const appTabId = await findWebAppTabId();
  if (!appTabId) return null;
  const token = await getWebAppToken(appTabId);
  if (token) {
    cachedToken = token;
    lastTokenAt = now;
  }
  return token;
}

async function refreshAuthToken(): Promise<string | null> {
  const appTabId = await findWebAppTabId();
  if (!appTabId) return null;
  const token = await getWebAppToken(appTabId, true);
  if (token) {
    cachedToken = token;
    lastTokenAt = Date.now();
  }
  return token;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'ELEMENT_PICKED' && message.selector) {
    try {
      chrome.storage.session.set({ lastPickedSelector: message.selector });
      if (chrome.action && chrome.action.setBadgeText) {
        chrome.action.setBadgeText({ text: '✓' });
        chrome.action.setBadgeBackgroundColor?.({ color: '#22c55e' });
        setTimeout(() => chrome.action.setBadgeText({ text: '' }), 2000);
      }
    } catch {}
    return; // no response needed
  }
  if (message?.type === 'GET_AUTH_TOKEN') {
    getAuthToken().then((token) => sendResponse({ token })).catch(() => sendResponse({ token: null }));
    return true;
  }
  if (message?.type === 'REFRESH_AUTH_TOKEN') {
    refreshAuthToken().then((token) => sendResponse({ token })).catch(() => sendResponse({ token: null }));
    return true;
  }
  if (message?.type === 'START_IDENTITY_LOGIN') {
    startChromeIdentityLogin().then((token) => sendResponse({ token })).catch(() => sendResponse({ token: null }));
    return true;
  }
});

// Auto-sync: When page loads, if URL matches a shared config and user has a private mapping, capture and import
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete' || !tab.url) return;
  try {
    // Load configs
    const tokenRes = await new Promise<{ token: string | null }>((resolve) => {
      getAuthToken(tabId).then((token) => resolve({ token })).catch(() => resolve({ token: null }));
    });
    if (!tokenRes.token) return;
    const headers: Record<string, string> = { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenRes.token}` };
    const { apiBase } = await chrome.storage.sync.get('apiBase');
    const envBase = (import.meta && (import.meta as any).env && (import.meta as any).env.VITE_API_BASE) || 'http://localhost:8080';
    const base = apiBase || envBase;

    const [shared, priv] = await Promise.all([
      fetch(`${base}/extension/configs/shared`, { headers }).then((r) => r.json()).catch(() => ({ items: [] })),
      fetch(`${base}/extension/configs/private`, { headers }).then((r) => r.json()).catch(() => ({ items: [] })),
    ]);

    const privateItems: any[] = priv.items || [];
    if (!privateItems.length) return;

    const matchConfig = (url: string) => {
      for (const s of shared.items || []) {
        const pattern: string = s.url || '';
        const rx = new RegExp('^' + pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$');
        if (rx.test(url)) return s;
      }
      return null;
    };

    const sCfg = matchConfig(tab.url);
    if (!sCfg) return;

    // Find a private config targeting this shared config
    const pCfg = privateItems.find((p) => p.extension_config_id === sCfg.extension_config_id && p.auto_sync);
    if (!pCfg) return;

    // Capture page
    const selector = sCfg.selector || undefined;
    const [{ result: html }] = await chrome.scripting.executeScript({
      target: { tabId },
      func: (sel) => {
        const cloned = document.documentElement.cloneNode(true);
        (cloned as HTMLElement).querySelectorAll('script, style').forEach((el) => el.remove());
        if (sel) {
          const el = document.querySelector(sel);
          return el ? (el.cloneNode(true) as HTMLElement).outerHTML : (cloned as HTMLElement).outerHTML;
        }
        return (cloned as HTMLElement).outerHTML;
      },
      args: [selector]
    });

    // Extract
    let extractRes = await fetch(`${base}/extension/extract`, { method: 'POST', headers, body: JSON.stringify({ html }) });
    if (extractRes.status === 401) {
      const refreshed = await refreshAuthToken();
      if (!refreshed) return;
      headers.Authorization = `Bearer ${refreshed}`;
      extractRes = await fetch(`${base}/extension/extract`, { method: 'POST', headers, body: JSON.stringify({ html }) });
    }
    const extractJson = await extractRes.json();
    const data = extractJson.data || {};

    // Import (update if account provided)
    const importBody: any = {
      portfolio_id: pCfg.portfolio_id,
      account_id: pCfg.account_id || undefined,
      account_name: pCfg.account_id || data.account_name || 'Imported Account',
      account_type: data.account_type || 'brokerage',
      owners: data.owners || ['me'],
      holdings: data.holdings || [],
      rsu_plans: data.rsu_plans || [],
      espp_plans: data.espp_plans || [],
      options_plans: data.options_plans || [],
    };
    let importRes = await fetch(`${base}/extension/import`, { method: 'POST', headers, body: JSON.stringify(importBody) });
    if (importRes.status === 401) {
      const refreshed2 = await refreshAuthToken();
      if (!refreshed2) return;
      headers.Authorization = `Bearer ${refreshed2}`;
      importRes = await fetch(`${base}/extension/import`, { method: 'POST', headers, body: JSON.stringify(importBody) });
    }
  } catch {
    // Ignore
  }
});

export {};

