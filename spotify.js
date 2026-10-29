// Spotify now-playing for a static page. Authorization code with PKCE,
// so the page never holds a client secret. The Client ID is public.
const SpotifyNow = (() => {
  const SCOPES = 'user-read-currently-playing user-read-playback-state';

  function redirectUri() {
    return location.origin + location.pathname;
  }

  function clientId() {
    return (localStorage.getItem('spotifyClientId') || '').trim();
  }

  function setClientId(id) {
    localStorage.setItem('spotifyClientId', (id || '').trim());
  }

  function connected() {
    return !!localStorage.getItem('spotifyRefresh');
  }

  function logout() {
    localStorage.removeItem('spotifyAccess');
    localStorage.removeItem('spotifyRefresh');
    localStorage.removeItem('spotifyExpiry');
  }

  function base64url(bytes) {
    let text = '';
    for (let i = 0; i < bytes.length; i++) text += String.fromCharCode(bytes[i]);
    return btoa(text).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  async function codeChallenge(verifier) {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
    return base64url(new Uint8Array(digest));
  }

  async function beginLogin() {
    const id = clientId();
    if (!id) throw new Error('Add a Spotify Client ID in Settings.');
    const bytes = new Uint8Array(48);
    crypto.getRandomValues(bytes);
    const verifier = base64url(bytes);
    const stateBytes = new Uint8Array(16);
    crypto.getRandomValues(stateBytes);
    const state = base64url(stateBytes);
    sessionStorage.setItem('spotifyVerifier', verifier);
    sessionStorage.setItem('spotifyState', state);
    const url = new URL('https://accounts.spotify.com/authorize');
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', id);
    url.searchParams.set('scope', SCOPES);
    url.searchParams.set('redirect_uri', redirectUri());
    url.searchParams.set('code_challenge_method', 'S256');
    url.searchParams.set('code_challenge', await codeChallenge(verifier));
    url.searchParams.set('state', state);
    location.assign(url.href);
  }

  async function tokenRequest(body) {
    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(body),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = payload.error_description || payload.error || 'Spotify sign-in failed.';
      throw new Error(message);
    }
    return payload;
  }

  function saveToken(payload) {
    localStorage.setItem('spotifyAccess', payload.access_token);
    if (payload.refresh_token) localStorage.setItem('spotifyRefresh', payload.refresh_token);
    const expiresIn = Number(payload.expires_in) || 3600;
    localStorage.setItem('spotifyExpiry', String(Date.now() + expiresIn * 1000));
  }

  async function finishLogin() {
    const params = new URLSearchParams(location.search);
    const code = params.get('code');
    const error = params.get('error');
    if (!code && !error) return false;
    const state = params.get('state');
    const expected = sessionStorage.getItem('spotifyState');
    const verifier = sessionStorage.getItem('spotifyVerifier');
    history.replaceState({}, '', location.pathname);
    sessionStorage.removeItem('spotifyState');
    sessionStorage.removeItem('spotifyVerifier');
    if (error) throw new Error(error === 'access_denied' ? 'Spotify sign-in was cancelled.' : error);
    if (!verifier || state !== expected) throw new Error('Spotify sign-in did not match this page. Try again.');
    saveToken(await tokenRequest({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri(),
      client_id: clientId(),
      code_verifier: verifier,
    }));
    return true;
  }

  async function accessToken() {
    const expiry = Number(localStorage.getItem('spotifyExpiry') || 0);
    const current = localStorage.getItem('spotifyAccess');
    if (current && Date.now() < expiry - 60000) return current;
    const refresh = localStorage.getItem('spotifyRefresh');
    if (!refresh) throw new Error('Sign in to Spotify again.');
    saveToken(await tokenRequest({
      grant_type: 'refresh_token',
      refresh_token: refresh,
      client_id: clientId(),
    }));
    return localStorage.getItem('spotifyAccess');
  }

  // Pull a backpack line out of a currently-playing payload.
  function trackLine(body) {
    if (!body || !body.item) return null;
    const item = body.item;
    const title = item.name || '';
    let artist = '';
    if (item.artists && item.artists.length) artist = item.artists.map((a) => a.name).join(', ');
    else if (item.show && item.show.name) artist = item.show.name;
    const images = (item.album && item.album.images) || item.images || [];
    const art = images.length ? images[images.length - 1].url : '';
    const line = artist ? artist + ' - ' + title : title;
    return { line, title, artist, art, playing: !!body.is_playing };
  }

  async function currentlyPlaying() {
    const token = await accessToken();
    const response = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
      headers: { Authorization: 'Bearer ' + token },
    });
    if (response.status === 204) return null;
    if (response.status === 401) {
      localStorage.removeItem('spotifyAccess');
      localStorage.setItem('spotifyExpiry', '0');
      const retry = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
        headers: { Authorization: 'Bearer ' + await accessToken() },
      });
      if (retry.status === 204) return null;
      if (!retry.ok) throw new Error('Spotify did not share what is playing.');
      return trackLine(await retry.json());
    }
    if (response.status === 429) return undefined;
    if (!response.ok) throw new Error('Spotify did not share what is playing.');
    return trackLine(await response.json());
  }

  async function profileName() {
    const token = await accessToken();
    const response = await fetch('https://api.spotify.com/v1/me', {
      headers: { Authorization: 'Bearer ' + token },
    });
    if (!response.ok) return '';
    const body = await response.json();
    return body.display_name || body.id || '';
  }

  const api = {
    redirectUri,
    clientId,
    setClientId,
    connected,
    logout,
    beginLogin,
    finishLogin,
    currentlyPlaying,
    profileName,
    trackLine,
  };
  globalThis.SpotifyNow = api;
  return api;
})();
