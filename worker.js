const FIREBASE_AUTH_ORIGIN = 'https://ai-photo-studio-24354.firebaseapp.com';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/__/auth/')) {
      const target = new URL(url.pathname + url.search, FIREBASE_AUTH_ORIGIN);
      const proxied = new Request(target, request);
      proxied.headers.set('host', new URL(FIREBASE_AUTH_ORIGIN).host);
      return fetch(proxied);
    }

    return env.ASSETS.fetch(request);
  }
};
