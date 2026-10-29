// Last.fm now-playing for a static page. The API key is public, same as
// the Spotify Client ID. A track counts only while Last.fm marks it now playing.
const LastFmNow = (() => {
  function user() {
    return (localStorage.getItem('lastfmUser') || '').trim();
  }

  function apiKey() {
    return (localStorage.getItem('lastfmKey') || '').trim();
  }

  function configured() {
    return !!(user() && apiKey());
  }

  function setAccount(name, key) {
    localStorage.setItem('lastfmUser', (name || '').trim());
    localStorage.setItem('lastfmKey', (key || '').trim());
  }

  function liveTrack(payload) {
    const recent = payload && payload.recenttracks;
    let tracks = recent && recent.track;
    if (!tracks) return null;
    if (!Array.isArray(tracks)) tracks = [tracks];
    for (let i = 0; i < tracks.length; i++) {
      const item = tracks[i];
      const attr = item && item['@attr'];
      if (!attr || String(attr.nowplaying) !== 'true') continue;
      const title = item.name || '';
      if (!title) continue;
      let artist = '';
      if (item.artist && typeof item.artist === 'object') artist = item.artist['#text'] || '';
      else if (typeof item.artist === 'string') artist = item.artist;
      let art = '';
      const images = Array.isArray(item.image) ? item.image : [];
      for (let j = 0; j < images.length; j++) {
        const src = images[j] && images[j]['#text'];
        if (src) art = src;
      }
      const line = artist ? artist + ' - ' + title : title;
      return { line: line, title: title, artist: artist, art: art, playing: true };
    }
    return null;
  }

  async function currentlyPlaying() {
    const name = user();
    const key = apiKey();
    if (!name || !key) return null;
    const url = new URL('https://ws.audioscrobbler.com/2.0/');
    url.searchParams.set('method', 'user.getRecentTracks');
    url.searchParams.set('user', name);
    url.searchParams.set('api_key', key);
    url.searchParams.set('format', 'json');
    url.searchParams.set('limit', '1');
    const response = await fetch(url.href);
    const payload = await response.json().catch(() => ({}));
    if (Number(payload.error) === 29) return undefined;
    if (payload.error) throw new Error(payload.message || 'Last.fm could not load the song.');
    if (!response.ok) throw new Error('Last.fm returned ' + response.status + '.');
    return liveTrack(payload);
  }

  const api = {
    user: user,
    apiKey: apiKey,
    configured: configured,
    setAccount: setAccount,
    currentlyPlaying: currentlyPlaying,
  };
  globalThis.LastFmNow = api;
  return api;
})();
