/* ============================================
   Main app logic — index.html (game list)
   ============================================ */

(function () {
  'use strict';

  // ---------- Element refs ----------
  const usernameInput = document.getElementById('username-input');
  const saveUsernameBtn = document.getElementById('save-username-btn');
  const depthSelect = document.getElementById('depth-select');
  const maxGamesSelect = document.getElementById('max-games-select');
  const filterSelect = document.getElementById('filter-select');
  const scanBtn = document.getElementById('scan-btn');
  const clearBtn = document.getElementById('clear-btn');
  const lastScanEl = document.getElementById('last-scan');
  const progressWrap = document.getElementById('progress-wrapper');
  const progressText = document.getElementById('progress-text');
  const progressPct = document.getElementById('progress-percent');
  const progressFill = document.getElementById('progress-fill');

  const statTotal = document.getElementById('stat-total');
  const statAnalyzed = document.getElementById('stat-analyzed');
  const statWins = document.getElementById('stat-wins');
  const statLosses = document.getElementById('stat-losses');
  const statAccuracy = document.getElementById('stat-accuracy');

  const emptyState = document.getElementById('empty-state');
  const gamesTable = document.getElementById('games-table');
  const gamesTbody = document.getElementById('games-tbody');
  const toastContainer = document.getElementById('toast-container');

  // ---------- Toast helper ----------
  function toast(msg, type = 'info', timeout = 4000) {
    const el = document.createElement('div');
    el.className = 'toast ' + type;
    el.textContent = msg;
    toastContainer.appendChild(el);
    setTimeout(() => {
      el.style.transition = 'opacity 0.3s, transform 0.3s';
      el.style.opacity = '0';
      el.style.transform = 'translateX(-20%)';
      setTimeout(() => el.remove(), 300);
    }, timeout);
  }

  // ---------- Progress helper ----------
  function showProgress() { progressWrap.classList.add('active'); }
  function hideProgress() { progressWrap.classList.remove('active'); }
  function setProgress({ current, total, message }) {
    const pct = total > 0 ? Math.round((current / total) * 100) : 0;
    progressText.textContent = message || '';
    progressPct.textContent = pct + '%';
    progressFill.style.width = pct + '%';
  }

  // ---------- Rendering ----------
  function fmtDate(unixSec) {
    if (!unixSec) return '–';
    const d = new Date(unixSec * 1000);
    return d.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  function fmtTimeControl(tc, cls) {
    const labels = { rapid: 'מהיר', blitz: 'בזק', bullet: 'בולט', daily: 'יומי' };
    return (labels[cls] || cls || tc || '–');
  }

  function resultBadge(r) {
    if (r === 'win') return '<span class="result-badge result-win">ניצחון</span>';
    if (r === 'loss') return '<span class="result-badge result-loss">הפסד</span>';
    return '<span class="result-badge result-draw">תיקו</span>';
  }

  function statusBadge(game, analysis) {
    if (analysis && analysis.status === 'done') return '<span class="status-badge status-analyzed">נותח ✓</span>';
    if (analysis && analysis.status === 'running') return '<span class="status-badge status-analyzing">בניתוח...</span>';
    return '<span class="status-badge status-pending">ממתין</span>';
  }

  function accuracyCell(analysis, ourColor) {
    if (!analysis || analysis.status !== 'done') return '<span style="color: var(--text-muted);">–</span>';
    const acc = ourColor === 'white' ? analysis.whiteAccuracy : analysis.blackAccuracy;
    if (acc == null) return '<span style="color: var(--text-muted);">–</span>';
    const rounded = acc.toFixed(1);
    return `<span style="font-weight: 700;">${rounded}%</span>
            <div class="accuracy-bar"><div class="accuracy-fill" style="width:${Math.min(100, acc)}%"></div></div>`;
  }

  function colorIndicator(color) {
    return `<span class="color-indicator color-${color}"></span>${color === 'white' ? 'לבן' : 'שחור'}`;
  }

  function matchesFilter(g, filter) {
    if (filter === 'all' || !filter) return true;
    if (filter === 'win')       return g.result === 'win';
    if (filter === 'loss')      return g.result === 'loss';
    if (filter === 'loss_draw') return g.result === 'loss' || g.result === 'draw';
    return true;
  }

  function renderGames() {
    const games = Storage.getAllGames();
    const all = Object.values(games).sort((a, b) => b.endTime - a.endTime);

    // Show only games belonging to the CURRENT username — if you switch
    // account, the other account's games stay stored but are hidden.
    const u = Storage.getUsername().toLowerCase();
    const mine = all.filter(g =>
      (g.whiteUsername || '').toLowerCase() === u ||
      (g.blackUsername || '').toLowerCase() === u
    );

    // Apply filter + max-games cap to the displayed list
    const filter = Storage.getFilter();
    const maxGames = Storage.getMaxGames();
    let list = mine.filter(g => matchesFilter(g, filter));
    if (maxGames > 0) list = list.slice(0, maxGames);

    // Stats reflect what's currently shown
    statTotal.textContent = list.length;
    let analyzedCount = 0, wins = 0, losses = 0;
    let totalAcc = 0, accCount = 0;
    for (const g of list) {
      if (g.result === 'win') wins++;
      else if (g.result === 'loss') losses++;
      const a = Storage.getAnalysis(g.id);
      if (a && a.status === 'done') {
        analyzedCount++;
        const ac = g.ourColor === 'white' ? a.whiteAccuracy : a.blackAccuracy;
        if (ac != null) { totalAcc += ac; accCount++; }
      }
    }
    statAnalyzed.textContent = analyzedCount;
    statWins.textContent = wins;
    statLosses.textContent = losses;
    statAccuracy.textContent = accCount > 0 ? (totalAcc / accCount).toFixed(1) + '%' : '–';

    if (list.length === 0) {
      emptyState.style.display = 'block';
      gamesTable.style.display = 'none';
      if (mine.length > 0) {
        emptyState.querySelector('.empty-state-title').textContent = 'אין משחקים שתואמים לסינון';
        emptyState.querySelector('.empty-state-desc').textContent =
          `לחשבון זה יש ${mine.length} משחקים שמורים. שנה את הסינון או לחץ "סרוק עכשיו" להבאת חדשים.`;
      } else if (!u) {
        emptyState.querySelector('.empty-state-title').textContent = 'הזן שם משתמש כדי להתחיל';
        emptyState.querySelector('.empty-state-desc').textContent =
          'הקלד את שם המשתמש שלך מ-chess.com בשדה למעלה ולחץ "סרוק עכשיו".';
      } else {
        emptyState.querySelector('.empty-state-title').textContent = 'אין עדיין משחקים לחשבון זה';
        emptyState.querySelector('.empty-state-desc').textContent =
          `לחץ "סרוק עכשיו" כדי לטעון את המשחקים של "${Storage.getUsername()}" מ-chess.com.`;
      }
      return;
    }

    emptyState.style.display = 'none';
    gamesTable.style.display = '';

    gamesTbody.innerHTML = list.map(g => {
      const analysis = Storage.getAnalysis(g.id);
      const isAnalyzed = analysis && analysis.status === 'done';
      const opp = g.opponent.username + (g.opponent.rating ? ` <span style="color: var(--text-muted); font-size:12px;">(${g.opponent.rating})</span>` : '');
      const analyzeBtn = isAnalyzed
        ? ''
        : `<button class="btn btn-sm analyze-row-btn" data-id="${g.id}">נתח</button>`;
      return `
        <tr data-id="${g.id}">
          <td class="td-date">${fmtDate(g.endTime)}</td>
          <td class="td-color">${colorIndicator(g.ourColor === 'unknown' ? 'white' : g.ourColor)}</td>
          <td class="td-opponent">${opp}</td>
          <td class="td-result">${resultBadge(g.result)}</td>
          <td class="td-opening">${g.opening || g.eco || '–'}<br><span style="color: var(--text-muted);">${fmtTimeControl(g.timeControl, g.timeClass)}</span></td>
          <td class="td-status">${statusBadge(g, analysis)}</td>
          <td class="td-accuracy">${accuracyCell(analysis, g.ourColor)}</td>
          <td class="td-action">${analyzeBtn}<a href="game.html?id=${g.id}" class="btn btn-secondary btn-sm">פתח</a></td>
        </tr>
      `;
    }).join('');

    // Make whole row clickable (but not when clicking a button/link inside it)
    gamesTbody.querySelectorAll('tr').forEach(tr => {
      tr.addEventListener('click', e => {
        if (e.target.closest('a, button')) return;
        window.location.href = 'game.html?id=' + tr.dataset.id;
      });
    });

    // Per-row analyze buttons
    gamesTbody.querySelectorAll('.analyze-row-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        analyzeGameRow(btn.dataset.id, btn);
      });
    });
  }

  // ---------- In-table analysis ----------
  let analyzingNow = false;

  async function analyzeGameRow(gameId, btn) {
    if (analyzingNow) {
      toast('ניתוח אחר כבר רץ — המתן לסיומו', 'warning');
      return;
    }
    const g = Storage.getGame(gameId);
    if (!g || !g.pgn) { toast('אין PGN למשחק זה', 'error'); return; }
    if (typeof Chess === 'undefined') {
      toast('ספריית chess.js לא נטענה — בדוק חיבור אינטרנט', 'error', 8000);
      return;
    }

    analyzingNow = true;
    btn.disabled = true;
    btn.innerHTML = '<span class="loader"></span> מנתח…';
    showProgress();
    setProgress({ current: 0, total: 1, message: 'טוען את מנוע Stockfish…' });

    try {
      Analyzer.reset();
      const result = await Analyzer.analyzeGame(g.pgn, {
        depth: Storage.getDepth(),
        onProgress: setProgress,
      });
      Storage.saveAnalysis(gameId, result);
      const acc = g.ourColor === 'white' ? result.whiteAccuracy : result.blackAccuracy;
      toast(`הניתוח הושלם! הדיוק שלך: ${acc != null ? acc.toFixed(1) + '%' : '–'}`, 'info', 6000);
    } catch (e) {
      console.error(e);
      toast('שגיאה בניתוח: ' + e.message, 'error', 7000);
    } finally {
      hideProgress();
      analyzingNow = false;
      renderGames();
    }
  }

  function renderLastScan() {
    const iso = Storage.getLastScan();
    if (!iso) { lastScanEl.textContent = 'לא בוצעה סריקה עדיין'; return; }
    const d = new Date(iso);
    lastScanEl.textContent = 'סריקה אחרונה: ' + d.toLocaleString('he-IL');
  }

  // ---------- Scan ----------
  async function performScan(opts = {}) {
    const { silent = false } = opts;
    // Always use whatever is typed in the input RIGHT NOW — auto-save it.
    // (Previously the scan used the stored name, so typing a new username
    // without clicking "save" silently scanned the old account.)
    const typed = usernameInput.value.trim();
    if (typed) Storage.setUsername(typed);
    const username = Storage.getUsername();
    if (!username) {
      toast('נא להזין שם משתמש מ-chess.com', 'error');
      return;
    }

    scanBtn.disabled = true;
    showProgress();
    setProgress({ current: 0, total: 1, message: 'מתחיל סריקה…' });

    try {
      const maxGames = Storage.getMaxGames();
      const filter = Storage.getFilter();
      const filterLabel = {
        all: 'כל המשחקים',
        win: 'רק ניצחונות',
        loss: 'רק הפסדים',
        loss_draw: 'הפסדים ותיקו',
      }[filter] || 'כל המשחקים';

      const { newGames, totalChecked } = await ChessAPI.scanForNewGames(username, {
        maxGames,
        filter,
        onProgress: setProgress,
      });

      if (newGames.length > 0) {
        const map = {};
        for (const g of newGames) map[g.id] = g;
        Storage.saveGames(map);
        toast(`נמצאו ${newGames.length} משחקים חדשים (${filterLabel})`, 'info');
      } else if (!silent) {
        toast(`לא נמצאו משחקים חדשים (נבדקו ${totalChecked}, סינון: ${filterLabel})`, 'info');
      }

      Storage.setLastScan(new Date().toISOString());
      renderGames();
      renderLastScan();
    } catch (e) {
      console.error(e);
      toast('שגיאה בסריקה: ' + e.message, 'error', 6000);
    } finally {
      hideProgress();
      scanBtn.disabled = false;
    }
  }

  // ---------- Event handlers ----------
  saveUsernameBtn.addEventListener('click', () => {
    const v = usernameInput.value.trim();
    if (!v) { toast('הזן שם משתמש תקין', 'error'); return; }
    Storage.setUsername(v);
    toast('שם משתמש נשמר: ' + v);
    // Switch the table to the new account's games immediately
    renderGames();
  });

  usernameInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') { saveUsernameBtn.click(); scanBtn.click(); }
  });

  depthSelect.addEventListener('change', () => {
    Storage.setDepth(parseInt(depthSelect.value, 10));
    toast('עומק ניתוח עודכן: ' + depthSelect.value);
  });

  maxGamesSelect.addEventListener('change', () => {
    Storage.setMaxGames(parseInt(maxGamesSelect.value, 10));
    renderGames();
  });

  filterSelect.addEventListener('change', () => {
    Storage.setFilter(filterSelect.value);
    renderGames();
  });

  scanBtn.addEventListener('click', () => performScan({ silent: false }));

  clearBtn.addEventListener('click', () => {
    if (!confirm('בטוח שברצונך למחוק את כל המשחקים והניתוחים השמורים? פעולה זו אינה הפיכה.')) return;
    Storage.clearAll();
    toast('כל הנתונים נמחקו');
    location.reload();
  });

  // ---------- Init ----------
  function init() {
    usernameInput.value = Storage.getUsername();
    depthSelect.value = String(Storage.getDepth());
    maxGamesSelect.value = String(Storage.getMaxGames());
    filterSelect.value = Storage.getFilter();
    renderLastScan();
    renderGames();

    // NO automatic scan on page load — scanning happens ONLY when the user
    // clicks "סרוק עכשיו". The single exception: ?scan=1 in the URL, which is
    // what the daily Task Scheduler .bat uses, and it only works when a
    // username was already saved.
    if (location.search.includes('scan=1') && Storage.getUsername()) {
      setTimeout(() => performScan({ silent: false }), 400);
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
