/* ============================================
   Chess piece SVG sprites
   Public-domain Cburnett pieces (Wikimedia)
   Inlined as data-URIs so no extra HTTP requests.
   Key format: 'wP', 'wN', 'wB', 'wR', 'wQ', 'wK',
               'bP', 'bN', 'bB', 'bR', 'bQ', 'bK'
   ============================================ */

const PIECE_SVG = (() => {
  // Base style for outlines
  const wFill = '#ffffff', wStroke = '#000000';
  const bFill = '#000000', bStroke = '#000000';

  function piece(color, body) {
    const fill = color === 'w' ? wFill : bFill;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45" width="45" height="45"><g style="fill:${fill};stroke:#000;stroke-width:1.5;stroke-linejoin:round">${body}</g></svg>`;
  }

  // Source: Cburnett's chess pieces (CC BY-SA 3.0). Compact path data:
  const PIECES = {
    wK: piece('w', '<path d="M22.5 11.63V6M20 8h5" style="fill:none;stroke-linecap:butt"/><path d="M22.5 25s4.5-7.5 3-10.5c0 0-1-2.5-3-2.5s-3 2.5-3 2.5c-1.5 3 3 10.5 3 10.5" style="fill:#fff;stroke-linecap:butt;stroke-linejoin:miter"/><path d="M11.5 37c5.5 3.5 15.5 3.5 21 0v-7s9-4.5 6-10.5c-4-6.5-13.5-3.5-16 4V27v-3.5c-3.5-7.5-13-10.5-16-4-3 6 5 10 5 10V37z" style="fill:#fff"/><path d="M11.5 30c5.5-3 15.5-3 21 0m-21 3.5c5.5-3 15.5-3 21 0m-21 3.5c5.5-3 15.5-3 21 0" style="fill:none;stroke:#000"/>'),
    wQ: piece('w', '<path d="M8 12a2 2 0 1 1-4 0 2 2 0 1 1 4 0zM24.5 7.5a2 2 0 1 1-4 0 2 2 0 1 1 4 0zM41 12a2 2 0 1 1-4 0 2 2 0 1 1 4 0zM16 8.5a2 2 0 1 1-4 0 2 2 0 1 1 4 0zM33 9a2 2 0 1 1-4 0 2 2 0 1 1 4 0z"/><path d="M9 26c8.5-1.5 21-1.5 27 0l2-12-7 11V11l-5.5 13.5-3-15-3 15-5.5-14V25L7 14l2 12zM9 26c0 2 1.5 2 2.5 4 1 1.5 1 1 .5 3.5-1.5 1-1.5 2.5-1.5 2.5-1.5 1.5.5 2.5.5 2.5 6.5 1 16.5 1 23 0 0 0 1.5-1 0-2.5 0 0 .5-1.5-1-2.5-.5-2.5-.5-2 .5-3.5 1-2 2.5-2 2.5-4-8.5-1.5-18.5-1.5-27 0z" style="stroke-linecap:butt"/><path d="M11 38.5a35 35 1 0 0 23 0" style="fill:none;stroke-linecap:butt"/><path d="M11 29a35 35 1 0 1 23 0M12.5 31.5h20M11.5 34.5a35 35 1 0 0 22 0M10.5 37.5a35 35 1 0 0 24 0" style="fill:none;stroke:#000"/>'),
    wR: piece('w', '<path d="M9 39h27v-3H9v3zM12.5 32l1.5-2.5h17l1.5 2.5h-20zM12 36v-4h21v4H12z" style="stroke-linecap:butt"/><path d="M14 29.5v-13h17v13H14z" style="stroke-linecap:butt;stroke-linejoin:miter"/><path d="M14 16.5L11 14h23l-3 2.5H14zM11 14V9h4v2h5V9h5v2h5V9h4v5H11z" style="stroke-linecap:butt"/><path d="M12 35.5h21M13 31.5h19M14 29.5h17M14 16.5h17M11 14h23" style="fill:none;stroke:#000;stroke-width:1;stroke-linejoin:miter"/>'),
    wB: piece('w', '<g style="fill:#fff;stroke-linecap:butt"><path d="M9 36c3.39-.97 10.11.43 13.5-2 3.39 2.43 10.11 1.03 13.5 2 0 0 1.65.54 3 2-.68.97-1.65.99-3 .5-3.39-.97-10.11.46-13.5-1-3.39 1.46-10.11.03-13.5 1-1.354.49-2.323.47-3-.5 1.354-1.94 3-2 3-2zM15 32c2.5 2.5 12.5 2.5 15 0 .5-1.5 0-2 0-2 0-2.5-2.5-4-2.5-4 5.5-1.5 6-11.5-5-15.5-11 4-10.5 14-5 15.5 0 0-2.5 1.5-2.5 4 0 0-.5.5 0 2z"/><path d="M25 8a2.5 2.5 0 1 1-5 0 2.5 2.5 0 1 1 5 0z"/></g><path d="M17.5 26h10M15 30h15m-7.5-14.5v5M20 18h5" style="fill:none;stroke:#000;stroke-linejoin:miter"/>'),
    wN: piece('w', '<path d="M22 10c10.5 1 16.5 8 16 29H15c0-9 10-6.5 8-21" style="fill:#fff"/><path d="M24 18c.38 2.91-5.55 7.37-8 9-3 2-2.82 4.34-5 4-1.042-.94 1.41-3.04 0-3-1 0 .19 1.23-1 2-1 0-4.003 1-4-4 0-2 6-12 6-12s1.89-1.9 2-3.5c-.73-.994-.5-2-.5-3 1-1 3 2.5 3 2.5h2s.78-1.992 2.5-3c1 0 1 3 1 3" style="fill:#fff"/><path d="M9.5 25.5a.5.5 0 1 1-1 0 .5.5 0 1 1 1 0zM15 15.5a.5 1.5 30 1 1-1-.26.5 1.5 30 1 1 1 .26z" style="fill:#000"/>'),
    wP: piece('w', '<path d="M22.5 9c-2.21 0-4 1.79-4 4 0 .89.29 1.71.78 2.38-1.95 1.12-3.28 3.21-3.28 5.62 0 2.03.94 3.84 2.41 5.03-3 1.06-7.41 5.55-7.41 13.47h23c0-7.92-4.41-12.41-7.41-13.47 1.47-1.19 2.41-3 2.41-5.03 0-2.41-1.33-4.5-3.28-5.62.49-.67.78-1.49.78-2.38 0-2.21-1.79-4-4-4z" style="fill:#fff;stroke-linecap:butt"/>'),
    bK: piece('b', '<path d="M22.5 11.63V6" style="fill:none;stroke-linejoin:miter"/><path d="M22.5 25s4.5-7.5 3-10.5c0 0-1-2.5-3-2.5s-3 2.5-3 2.5c-1.5 3 3 10.5 3 10.5" style="fill:#000;stroke-linecap:butt;stroke-linejoin:miter"/><path d="M11.5 37c5.5 3.5 15.5 3.5 21 0v-7s9-4.5 6-10.5c-4-6.5-13.5-3.5-16 4V27v-3.5c-3.5-7.5-13-10.5-16-4-3 6 5 10 5 10V37z" style="fill:#000"/><path d="M20 8h5" style="fill:none;stroke-linejoin:miter"/><path d="M32 29.5s8.5-4 6.03-9.65C34.15 14 25 18 22.5 24.5l.01 2.1-.01-2.1C20 18 9.906 14 6.997 19.85c-2.497 5.65 4.853 9 4.853 9M11.5 30c5.5-3 15.5-3 21 0m-21 3.5c5.5-3 15.5-3 21 0m-21 3.5c5.5-3 15.5-3 21 0" style="fill:none;stroke:#fff"/>'),
    bQ: piece('b', '<g style="fill:#000;stroke:none"><circle cx="6" cy="12" r="2.75"/><circle cx="14" cy="9" r="2.75"/><circle cx="22.5" cy="8" r="2.75"/><circle cx="31" cy="9" r="2.75"/><circle cx="39" cy="12" r="2.75"/></g><path d="M9 26c8.5-1.5 21-1.5 27 0l2.5-12.5L31 25l-.3-14.1-5.2 13.6-3-14.5-3 14.5-5.2-13.6L14 25 6.5 13.5 9 26zM9 26c0 2 1.5 2 2.5 4 1 1.5 1 1 .5 3.5-1.5 1-1.5 2.5-1.5 2.5-1.5 1.5.5 2.5.5 2.5 6.5 1 16.5 1 23 0 0 0 1.5-1 0-2.5 0 0 .5-1.5-1-2.5-.5-2.5-.5-2 .5-3.5 1-2 2.5-2 2.5-4-8.5-1.5-18.5-1.5-27 0z" style="stroke-linecap:butt"/><path d="M11 38.5a35 35 1 0 0 23 0" style="fill:none;stroke-linecap:butt"/><path d="M11 29a35 35 1 0 1 23 0M12.5 31.5h20M11.5 34.5a35 35 1 0 0 22 0M10.5 37.5a35 35 1 0 0 24 0" style="fill:none;stroke:#fff"/>'),
    bR: piece('b', '<path d="M9 39h27v-3H9v3zM12.5 32l1.5-2.5h17l1.5 2.5h-20zM12 36v-4h21v4H12z" style="stroke-linecap:butt"/><path d="M14 29.5v-13h17v13H14z" style="stroke-linecap:butt;stroke-linejoin:miter"/><path d="M14 16.5L11 14h23l-3 2.5H14zM11 14V9h4v2h5V9h5v2h5V9h4v5H11z" style="stroke-linecap:butt"/><path d="M12 35.5h21M13 31.5h19M14 29.5h17M14 16.5h17M11 14h23" style="fill:none;stroke:#fff;stroke-width:1;stroke-linejoin:miter"/>'),
    bB: piece('b', '<g style="fill:#000;stroke-linecap:butt"><path d="M9 36c3.39-.97 10.11.43 13.5-2 3.39 2.43 10.11 1.03 13.5 2 0 0 1.65.54 3 2-.68.97-1.65.99-3 .5-3.39-.97-10.11.46-13.5-1-3.39 1.46-10.11.03-13.5 1-1.354.49-2.323.47-3-.5 1.354-1.94 3-2 3-2zM15 32c2.5 2.5 12.5 2.5 15 0 .5-1.5 0-2 0-2 0-2.5-2.5-4-2.5-4 5.5-1.5 6-11.5-5-15.5-11 4-10.5 14-5 15.5 0 0-2.5 1.5-2.5 4 0 0-.5.5 0 2z"/><path d="M25 8a2.5 2.5 0 1 1-5 0 2.5 2.5 0 1 1 5 0z"/></g><path d="M17.5 26h10M15 30h15m-7.5-14.5v5M20 18h5" style="fill:none;stroke:#fff;stroke-linejoin:miter"/>'),
    bN: piece('b', '<path d="M22 10c10.5 1 16.5 8 16 29H15c0-9 10-6.5 8-21" style="fill:#000"/><path d="M24 18c.38 2.91-5.55 7.37-8 9-3 2-2.82 4.34-5 4-1.042-.94 1.41-3.04 0-3-1 0 .19 1.23-1 2-1 0-4.003 1-4-4 0-2 6-12 6-12s1.89-1.9 2-3.5c-.73-.994-.5-2-.5-3 1-1 3 2.5 3 2.5h2s.78-1.992 2.5-3c1 0 1 3 1 3" style="fill:#000"/><path d="M9.5 25.5a.5.5 0 1 1-1 0 .5.5 0 1 1 1 0zM15 15.5a.5 1.5 30 1 1-1-.26.5 1.5 30 1 1 1 .26z" style="fill:#fff;stroke:#fff"/><path d="M24.55 10.4l-.45 1.45.5.15c3.15 1 5.65 2.49 7.9 6.75S35.75 29.06 35.25 39l-.05.5h2.25l.05-.5c.5-10.06-.88-16.85-3.25-21.34-2.37-4.49-5.79-6.64-9.19-7.16l-.51-.1z" style="fill:#fff;stroke:none"/>'),
    bP: piece('b', '<path d="M22.5 9c-2.21 0-4 1.79-4 4 0 .89.29 1.71.78 2.38-1.95 1.12-3.28 3.21-3.28 5.62 0 2.03.94 3.84 2.41 5.03-3 1.06-7.41 5.55-7.41 13.47h23c0-7.92-4.41-12.41-7.41-13.47 1.47-1.19 2.41-3 2.41-5.03 0-2.41-1.33-4.5-3.28-5.62.49-.67.78-1.49.78-2.38 0-2.21-1.79-4-4-4z" style="fill:#000;stroke-linecap:butt"/>'),
  };

  // Wrap each as a data-URI for use as background-image
  const out = {};
  for (const [k, v] of Object.entries(PIECES)) {
    out[k] = `url("data:image/svg+xml;utf8,${encodeURIComponent(v)}")`;
  }
  return out;
})();

/* chess.com official "neo" piece theme (PNG).
   We preload ONE image to test availability; only if it loads do we use the
   PNG theme (exclusively). Otherwise we stay on the inline SVG pieces.
   Never stack both — stacking paints both layers and looks doubled. */
const PIECE_PNG = (() => {
  const base = 'https://images.chesscomfiles.com/chess-themes/pieces/neo/150/';
  const out = {};
  for (const color of ['w', 'b']) {
    for (const p of ['k', 'q', 'r', 'b', 'n', 'p']) {
      out[color + p.toUpperCase()] = `url("${base}${color}${p}.png")`;
    }
  }
  return out;
})();

let PIECE_PNG_OK = false;
(function preloadPieceTheme() {
  const img = new Image();
  img.onload = () => {
    PIECE_PNG_OK = true;
    // Let the app re-render the board with the nicer theme
    window.dispatchEvent(new Event('pieces-theme-ready'));
  };
  img.onerror = () => { PIECE_PNG_OK = false; };
  img.src = 'https://images.chesscomfiles.com/chess-themes/pieces/neo/150/wk.png';
})();
