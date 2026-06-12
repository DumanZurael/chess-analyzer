/* ============================================
   Chess.com Public API
   Docs: https://www.chess.com/news/view/published-data-api
   ============================================ */

const ChessAPI = (() => {
  const BASE = 'https://api.chess.com/pub';

  async function fetchJSON(url) {
    const res = await fetch(url, {
      headers: { 'Accept': 'application/json' },
    });
    if (!res.ok) {
      if (res.status === 404) return null;
      throw new Error(`API error ${res.status}: ${url}`);
    }
    return res.json();
  }

  /** Returns list of "YYYY/MM" archive URLs */
  async function getArchives(username) {
    const data = await fetchJSON(`${BASE}/player/${encodeURIComponent(username)}/games/archives`);
    if (!data) throw new Error(`משתמש "${username}" לא נמצא ב-chess.com`);
    return data.archives || [];
  }

  /** Returns all games from a specific archive URL */
  async function getGamesFromArchive(archiveUrl) {
    const data = await fetchJSON(archiveUrl);
    return data ? (data.games || []) : [];
  }

  /** Fetch player profile */
  async function getProfile(username) {
    return fetchJSON(`${BASE}/player/${encodeURIComponent(username)}`);
  }

  /**
   * Scan: fetches games from chess.com, returns new games (not already stored).
   * options:
   *   - maxGames: cap on total NEW games to save (0 = unlimited). Default 50.
   *   - filter: 'all' | 'win' | 'loss' | 'loss_draw' — which game outcomes to keep.
   *   - onProgress({current, total, message})
   */
  async function scanForNewGames(username, options = {}) {
    const {
      maxGames = 50,
      filter = 'all',
      onProgress = () => {},
    } = options;

    onProgress({ current: 0, total: 1, message: 'מחפש ארכיוני משחקים…' });
    const archives = await getArchives(username);
    if (archives.length === 0) {
      return { newGames: [], totalChecked: 0 };
    }

    const existing = Storage.getAllGames();
    const newGames = [];
    let totalChecked = 0;

    // Walk archives newest -> oldest, take games newest -> oldest within each archive,
    // stop as soon as we've collected enough matching games.
    const reversedArchives = [...archives].reverse();

    for (let i = 0; i < reversedArchives.length; i++) {
      // Stop early if we already have enough games
      if (maxGames > 0 && newGames.length >= maxGames) break;

      const archUrl = reversedArchives[i];
      const monthLabel = archUrl.match(/\d{4}\/\d{2}$/)?.[0] || '';
      onProgress({
        current: newGames.length,
        total: maxGames > 0 ? maxGames : (newGames.length + 1),
        message: `טוען משחקים מ-${monthLabel}…`,
      });

      const games = await getGamesFromArchive(archUrl);
      totalChecked += games.length;

      // Process newest first within the archive
      const sorted = [...games].sort((a, b) => (b.end_time || 0) - (a.end_time || 0));

      for (const g of sorted) {
        if (maxGames > 0 && newGames.length >= maxGames) break;
        const id = makeGameId(g);
        if (existing[id]) continue;

        const normalized = normalizeGame(g, id, username);
        if (!passesFilter(normalized, filter)) continue;

        newGames.push(normalized);
        onProgress({
          current: newGames.length,
          total: maxGames > 0 ? maxGames : (newGames.length + 1),
          message: `נמצאו ${newGames.length} משחקים…`,
        });
      }
    }

    onProgress({
      current: newGames.length,
      total: newGames.length || 1,
      message: 'בוצע',
    });
    return { newGames, totalChecked };
  }

  function passesFilter(game, filter) {
    if (filter === 'all' || !filter) return true;
    if (filter === 'win')       return game.result === 'win';
    if (filter === 'loss')      return game.result === 'loss';
    if (filter === 'loss_draw') return game.result === 'loss' || game.result === 'draw';
    return true;
  }

  /** Build a stable id from a chess.com game object */
  function makeGameId(g) {
    // chess.com `url` field is like https://www.chess.com/game/live/12345678
    if (g.url) {
      const m = g.url.match(/\/(\d+)$/);
      if (m) return m[1];
    }
    // Fallback to uuid
    return g.uuid || `${g.end_time}_${g.white?.username}_${g.black?.username}`;
  }

  /** Normalize a chess.com game into our internal shape */
  function normalizeGame(g, id, ourUsername) {
    const ours = ourUsername.toLowerCase();
    const whiteName = (g.white?.username || '').toLowerCase();
    const blackName = (g.black?.username || '').toLowerCase();
    const ourColor = whiteName === ours ? 'white' : (blackName === ours ? 'black' : 'unknown');

    const whiteResult = g.white?.result || '';
    const blackResult = g.black?.result || '';
    const ourResult = ourColor === 'white' ? whiteResult : blackResult;

    let outcome = 'draw';
    if (ourResult === 'win') outcome = 'win';
    else if (['agreed', 'repetition', 'stalemate', '50move', 'insufficient', 'timevsinsufficient'].includes(ourResult)) outcome = 'draw';
    else if (ourResult) outcome = 'loss';

    const opponent = ourColor === 'white' ? g.black : g.white;

    return {
      id,
      url: g.url || '',
      pgn: g.pgn || '',
      timeControl: g.time_control || '',
      timeClass: g.time_class || '',
      rated: !!g.rated,
      endTime: g.end_time || 0,
      rules: g.rules || 'chess',
      ourColor,
      ourRating: ourColor === 'white' ? g.white?.rating : g.black?.rating,
      opponent: {
        username: opponent?.username || 'יריב לא ידוע',
        rating: opponent?.rating || 0,
      },
      result: outcome,            // win / loss / draw
      termination: ourResult,     // raw termination reason for our side
      eco: g.eco || '',
      opening: extractOpeningName(g.pgn || ''),
      whiteUsername: g.white?.username || '',
      blackUsername: g.black?.username || '',
      whiteRating: g.white?.rating || 0,
      blackRating: g.black?.rating || 0,
    };
  }

  function extractOpeningName(pgn) {
    if (!pgn) return '';
    // Try ECOUrl which contains opening name as last URL segment
    const ecoUrlMatch = pgn.match(/\[ECOUrl\s+"([^"]+)"\]/);
    if (ecoUrlMatch) {
      const last = ecoUrlMatch[1].split('/').pop() || '';
      return last.replace(/-/g, ' ');
    }
    const ecoMatch = pgn.match(/\[ECO\s+"([^"]+)"\]/);
    return ecoMatch ? ecoMatch[1] : '';
  }

  return {
    getArchives,
    getGamesFromArchive,
    getProfile,
    scanForNewGames,
  };
})();
