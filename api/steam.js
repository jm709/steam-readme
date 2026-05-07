// api/steam.js
export default async function handler(req, res) {
  const { type = 'recent', count = 5 } = req.query;
  const steamid = process.env.STEAM_ID;
  const apiKey = process.env.STEAM_API_KEY;

  try {
    let games = [];
    let title = '';

    if (type === 'recent') {
      const url = `https://api.steampowered.com/IPlayerService/GetRecentlyPlayedGames/v1/?key=${apiKey}&steamid=${steamid}&count=${count}`;
      const data = await (await fetch(url)).json();
      games = (data.response?.games || []).map(g => ({
        name: g.name,
        minutes: g.playtime_2weeks,
        appid: g.appid,
      }));
      title = '🎮 Recently Played (last 2 weeks)';
    } else {
      const url = `https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=${apiKey}&steamid=${steamid}&include_appinfo=1&include_played_free_games=1`;
      const data = await (await fetch(url)).json();
      games = (data.response?.games || [])
        .sort((a, b) => b.playtime_forever - a.playtime_forever)
        .slice(0, count)
        .map(g => ({ name: g.name, minutes: g.playtime_forever, appid: g.appid }));
      title = '🏆 Most Played';
    }

    // Fetch cover art in parallel and inline as base64 data URIs
    const thumbs = await Promise.all(games.map(g => fetchThumb(g.appid)));
    games.forEach((g, i) => { g.thumb = thumbs[i]; });

    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600');
    res.status(200).send(renderSvg(title, games, type));
  } catch (err) {
    res.setHeader('Content-Type', 'image/svg+xml');
    res.status(200).send(`<svg xmlns="http://www.w3.org/2000/svg" width="495" height="60">
      <rect width="495" height="60" fill="#1c1917" rx="6"/>
      <text x="25" y="35" fill="#0891b2" font-family="sans-serif" font-size="13">Steam stats error: ${esc(err.message)}</text>
    </svg>`);
  }
}

const esc = s => String(s).replace(/[<>&'"]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;',"'":'&apos;','"':'&quot;'}[c]));

async function fetchThumb(appid) {
  try {
    const r = await fetch(`https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/capsule_184x69.jpg`);
    if (!r.ok) return null;
    const b64 = Buffer.from(await r.arrayBuffer()).toString('base64');
    return `data:image/jpeg;base64,${b64}`;
  } catch {
    return null;
  }
}

function renderSvg(title, games, type) {
  const width = 495, rowH = 48, pad = 20, headerH = 55;
  const thumbW = 90, thumbH = 34;
  const height = headerH + games.length * rowH + 15;
  const max = Math.max(...games.map(g => g.minutes), 1);

  const rows = games.map((g, i) => {
    const rowTop = headerH + i * rowH;
    const textY = rowTop + 24;
    const thumbY = rowTop + 4;
    const barW = Math.round((g.minutes / max) * 130);
    const label = type === 'recent'
      ? `${(g.minutes / 60).toFixed(1)}h`
      : `${Math.round(g.minutes / 60)}h`;
    const thumb = g.thumb
      ? `<defs><clipPath id="thumbClip${i}"><rect x="${pad}" y="${thumbY}" width="${thumbW}" height="${thumbH}" rx="4"/></clipPath></defs>
         <image href="${g.thumb}" x="${pad}" y="${thumbY}" width="${thumbW}" height="${thumbH}" preserveAspectRatio="xMidYMid slice" clip-path="url(#thumbClip${i})"/>`
      : '';
    return `
      ${thumb}
      <text x="${pad + thumbW + 15}" y="${textY}" fill="#ffffff" font-family="Segoe UI, Ubuntu, sans-serif" font-size="13">${esc(g.name).slice(0, 22)}</text>
      <rect x="${width - 165}" y="${textY - 11}" width="${barW}" height="8" fill="#0891b2" rx="2"/>
      <text x="${width - pad}" y="${textY}" fill="#ffffff" font-family="Segoe UI, Ubuntu, sans-serif" font-size="12" text-anchor="end">${label}</text>`;
  }).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <rect width="${width}" height="${height}" fill="#1c1917" rx="6"/>
    <text x="${pad}" y="32" fill="#0891b2" font-family="Segoe UI, Ubuntu, sans-serif" font-size="16" font-weight="bold">${title}</text>
    ${rows}
  </svg>`;
}