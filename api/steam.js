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

function renderSvg(title, games, type) {
  const width = 495, rowH = 32, pad = 25, headerH = 55;
  const height = headerH + games.length * rowH + 15;
  const max = Math.max(...games.map(g => g.minutes), 1);

  const rows = games.map((g, i) => {
    const y = headerH + i * rowH;
    const barW = Math.round((g.minutes / max) * 180);
    const label = type === 'recent'
      ? `${(g.minutes / 60).toFixed(1)}h`
      : `${Math.round(g.minutes / 60)}h`;
    return `
      <text x="${pad}" y="${y}" fill="#ffffff" font-family="Segoe UI, Ubuntu, sans-serif" font-size="13">${esc(g.name).slice(0, 30)}</text>
      <rect x="280" y="${y - 11}" width="${barW}" height="8" fill="#0891b2" rx="2"/>
      <text x="${width - pad}" y="${y}" fill="#ffffff" font-family="Segoe UI, Ubuntu, sans-serif" font-size="12" text-anchor="end">${label}</text>`;
  }).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <rect width="${width}" height="${height}" fill="#1c1917" rx="6"/>
    <text x="${pad}" y="32" fill="#0891b2" font-family="Segoe UI, Ubuntu, sans-serif" font-size="16" font-weight="bold">${title}</text>
    ${rows}
  </svg>`;
}