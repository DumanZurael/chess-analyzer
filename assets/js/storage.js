/* ============================================
   Storage Layer - localStorage wrapper
   ============================================ */

const Storage = (() => {
  const KEYS = {
    USERNAME: 'ca_username',
    LAST_SCAN: 'ca_last_scan',
    GAMES: 'ca_games',            // map: gameId -> game object
    ANALYSIS: 'ca_analysis_',     // prefix + gameId -> analysis object
    DEPTH: 'ca_depth',
    MAX_GAMES: 'ca_max_games',
    FILTER: 'ca_filter',
  };

  function getJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      console.warn('storage read failed', key, e);
      return fallback;
    }
  }

  function setJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.error('storage write failed', key, e);
      // localStorage may be full
      if (e.name === 'QuotaExceededError') {
        alert('שטח האחסון מלא. שקול לאפס נתונים ישנים.');
      }
    }
  }

  return {
    getUsername: () => localStorage.getItem(KEYS.USERNAME) || '',
    setUsername: (u) => localStorage.setItem(KEYS.USERNAME, u.trim().toLowerCase()),

    getDepth: () => parseInt(localStorage.getItem(KEYS.DEPTH) || '15', 10),
    setDepth: (d) => localStorage.setItem(KEYS.DEPTH, String(d)),

    getMaxGames: () => {
      const v = localStorage.getItem(KEYS.MAX_GAMES);
      return v == null ? 50 : parseInt(v, 10);
    },
    setMaxGames: (n) => localStorage.setItem(KEYS.MAX_GAMES, String(n)),

    getFilter: () => localStorage.getItem(KEYS.FILTER) || 'all',
    setFilter: (f) => localStorage.setItem(KEYS.FILTER, f),

    getLastScan: () => localStorage.getItem(KEYS.LAST_SCAN),
    setLastScan: (iso) => localStorage.setItem(KEYS.LAST_SCAN, iso),

    getAllGames: () => getJSON(KEYS.GAMES, {}),

    getGame: (id) => {
      const games = getJSON(KEYS.GAMES, {});
      return games[id] || null;
    },

    saveGames: (gameMap) => {
      const existing = getJSON(KEYS.GAMES, {});
      Object.assign(existing, gameMap);
      setJSON(KEYS.GAMES, existing);
    },

    saveGame: (id, game) => {
      const existing = getJSON(KEYS.GAMES, {});
      existing[id] = game;
      setJSON(KEYS.GAMES, existing);
    },

    getAnalysis: (gameId) => getJSON(KEYS.ANALYSIS + gameId, null),

    saveAnalysis: (gameId, analysis) => {
      setJSON(KEYS.ANALYSIS + gameId, analysis);
    },

    deleteAnalysis: (gameId) => {
      localStorage.removeItem(KEYS.ANALYSIS + gameId);
    },

    clearAll: () => {
      Object.keys(localStorage)
        .filter(k => k.startsWith('ca_'))
        .forEach(k => localStorage.removeItem(k));
    },
  };
})();
