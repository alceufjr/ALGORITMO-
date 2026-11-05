// Temas cosméticos: paleta das cordas + cores do tabuleiro e da interface.
// Desbloqueio: grátis, por estrelas acumuladas ou assistindo a um anúncio premiado.
// Cada paleta tem 16 cores (uma por corda possível).

export const THEMES = [
  {
    id: 'classic', unlock: { type: 'free' },
    ui: { bg: '#f6ebe3', bg2: '#efdfd3', muted: '#8a756c', text: '#2b1d1a' },
    board: { peg: '#d8cdc6', pegInner: '#cbbfb7', outline: '#2b1d1a' },
    palette: ['#ff4d6d', '#3a86ff', '#38c172', '#ffbe0b', '#9b5de5', '#ff7f11', '#00bbf9', '#f15bb5',
      '#8ac926', '#6c757d', '#e63946', '#2ec4b6', '#b5838d', '#4361ee', '#c77dff', '#06d6a0'],
  },
  {
    id: 'ocean', unlock: { type: 'ad' },
    ui: { bg: '#e3f4f8', bg2: '#c9e6ef', muted: '#4d7486', text: '#12324a' },
    board: { peg: '#c4dde4', pegInner: '#b0cfd8', outline: '#12324a' },
    palette: ['#0077b6', '#00b4d8', '#ff6b6b', '#ffd166', '#06d6a0', '#118ab2', '#ef476f', '#f78c6b',
      '#83c5be', '#3a0ca3', '#4cc9f0', '#e76f51', '#2a9d8f', '#e9c46a', '#264653', '#90e0ef'],
  },
  {
    id: 'candy', unlock: { type: 'stars', n: 25 },
    ui: { bg: '#fde7f0', bg2: '#f6d3e3', muted: '#9a6a80', text: '#5a2a41' },
    board: { peg: '#efcfdc', pegInner: '#e4bccd', outline: '#5a2a41' },
    palette: ['#ff8fab', '#a0c4ff', '#7fd8e6', '#9ee493', '#ffd166', '#ffadf0', '#bdb2ff', '#ff9e9e',
      '#ffc58a', '#70e09a', '#f4a3b5', '#86c8ee', '#c6a8f0', '#e8e27a', '#7fe6cf', '#e8a6dc'],
  },
  {
    id: 'autumn', unlock: { type: 'ad' },
    ui: { bg: '#f5ead8', bg2: '#ead7bb', muted: '#8a6d4c', text: '#3b2614' },
    board: { peg: '#dccab0', pegInner: '#d0bc9f', outline: '#3b2614' },
    palette: ['#9c2c13', '#d9480f', '#f08c00', '#e8b923', '#6b8e23', '#8b4513', '#b5651d', '#c0392b',
      '#7b3f00', '#556b2f', '#cd853f', '#a0522d', '#d2691e', '#800000', '#bdb76b', '#e07a5f'],
  },
  {
    id: 'neon', unlock: { type: 'stars', n: 60 }, dark: true,
    ui: { bg: '#1b1832', bg2: '#0d0b1a', muted: '#a49cc9', text: '#f1eefc' },
    board: { peg: '#2e2a4d', pegInner: '#24203f', outline: '#05040a' },
    palette: ['#ff0080', '#00f5ff', '#39ff14', '#fff01f', '#bc13fe', '#ff6f00', '#00ff9f', '#ff3131',
      '#1f51ff', '#ff44cc', '#ccff00', '#00bfff', '#fe019a', '#7df9ff', '#ff9933', '#b026ff'],
  },
  {
    id: 'forest', unlock: { type: 'stars', n: 120 },
    ui: { bg: '#e8f2e1', bg2: '#d3e6c6', muted: '#5f7a55', text: '#1f3318' },
    board: { peg: '#cddfc1', pegInner: '#bdd3ae', outline: '#1f3318' },
    palette: ['#2d6a4f', '#40916c', '#74c69d', '#9d4edd', '#e5989b', '#ffb703', '#fb8500', '#8ecae6',
      '#219ebc', '#023047', '#d62828', '#f77f00', '#6a994e', '#a7c957', '#bc4749', '#386641'],
  },
];

export const themeById = (id) => THEMES.find((t) => t.id === id) || THEMES[0];

/** Aplica as cores de interface do tema ao documento. */
export function applyThemeUI(theme) {
  const s = document.documentElement.style;
  s.setProperty('--bg', theme.ui.bg);
  s.setProperty('--bg2', theme.ui.bg2);
  s.setProperty('--muted', theme.ui.muted);
  s.setProperty('--text', theme.ui.text);
  document.body.classList.toggle('dark', !!theme.dark);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme.ui.bg);
}
