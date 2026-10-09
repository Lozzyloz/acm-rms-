const API = (() => {
  let csrfToken = null;

  async function refreshCsrf() {
    const res = await fetch('/api/csrf-token', { credentials: 'same-origin' });
    const data = await res.json();
    csrfToken = data.csrfToken;
    return csrfToken;
  }

  async function request(method, url, body) {
    if (!csrfToken) await refreshCsrf();
    const opts = {
      method,
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' }
    };
    if (method !== 'GET') opts.headers['X-CSRF-Token'] = csrfToken;
    if (body !== undefined) opts.body = JSON.stringify(body);

    const res = await fetch(url, opts);
    let data = {};
    try { data = await res.json(); } catch (e) { /* non-json (e.g. csv) */ }

    if (res.status === 401) {
      window.dispatchEvent(new CustomEvent('acm:unauthorized'));
    }
    if (!res.ok) {
      const err = new Error(data.error || 'Something went wrong. Please try again.');
      err.details = data.details;
      err.status = res.status;
      throw err;
    }
    return data;
  }

  return {
    get: (url) => request('GET', url),
    post: async (url, body) => {
      const data = await request('POST', url, body);
      // Login/logout regenerate the session, invalidating the old CSRF token.
      if (url === '/api/auth/login' && data.csrfToken) csrfToken = data.csrfToken;
      if (url === '/api/auth/logout') csrfToken = null;
      return data;
    },
    put: (url, body) => request('PUT', url, body),
    del: (url) => request('DELETE', url),
    refreshCsrf
  };
})();
