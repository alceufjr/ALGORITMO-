// Traduções: português (padrão), inglês e espanhol.
// Para adicionar um idioma: copie o bloco "en", traduza e inclua em LANGS.

const STR = {
  pt: {
    tut1: 'Arraste uma <b>bolinha</b> para um furo vazio até as cordas <b>não se cruzarem</b>.',
    tut2: 'Uma única jogada pode desfazer <b>vários nós</b> de uma vez. Procure a corda que atrapalha mais.',
    tut3: 'A <b>ordem</b> importa. Errou? Toque em <b>↶</b> para desfazer (3 grátis por fase).',
    tut4: 'Travou? Toque em <b>💡</b> e veja a melhor jogada.',
    tut5: 'Resolva com até a <b>meta de jogadas</b> para ganhar <b>3 estrelas</b> ⭐',
    no_undo_title: 'Sem desfazer ↶', no_undo_body: 'Assista a um vídeo curto e ganhe <b>{n}</b> desfazeres nesta fase.',
    undo_plus: '+{n} desfazer ↶', perfect: 'Perfeito! ✨',
    tagline: 'Desfaça os nós. Relaxe a mente.',
    play: 'Jogar', levels: 'Fases', daily: 'Desafio diário', styles: 'Estilos',
    stars_won: '{n} ★ conquistadas', privacy: 'Política de privacidade',
    level: 'Fase {n}', level_short: 'Fase',
    crossing_one: 'nó', crossing_many: 'nós',
    tutorial: 'A corda que você arrasta passa <b>por cima</b> das outras.<br>O caminho importa: desfaça <b>todos os nós</b>.',
    win_title: 'Desatado!', moves_line: '{m} jogada(s) · meta {p}',
    bonus_hint: '+1 dica de bônus 💡', replay: 'Repetir', next: 'Próxima ▶', home: 'Menu',
    no_hints_title: 'Sem dicas 💡', no_hints_body: 'Assista a um vídeo curto e ganhe <b>{n}</b> dicas.',
    not_now: 'Agora não', watch: '▶ Assistir', hints_plus: '+{n} dicas 💡',
    ad_unavailable: 'Anúncio indisponível. Tente novamente.', purchase_na: 'Compra ainda não configurada',
    tier_easy: 'Fácil', tier_medium: 'Médio', tier_hard: 'Difícil', tier_expert: 'Expert', tier_master: 'Mestre',
    daily_title: 'Desafio de hoje', daily_win: 'Desafio do dia concluído! Volte amanhã para manter a sequência.',
    daily_done_btn: 'Feito hoje ✓', streak: '🔥 {n} dia(s) seguido(s)', daily_reward: '+1 dica pelo desafio 💡',
    theme_classic: 'Clássico', theme_ocean: 'Oceano', theme_candy: 'Doce', theme_autumn: 'Outono',
    theme_neon: 'Neon', theme_forest: 'Floresta',
    equip: 'Usar', equipped: 'Em uso ✓', unlock_stars: '🔒 {n} ★', unlock_ad: '▶ Desbloquear',
    theme_unlocked: 'Tema desbloqueado! 🎨', need_stars: 'Faltam {n} ★',
    ad_test: 'ANÚNCIO DE TESTE', ad_rewarded: 'Anúncio premiado', ad_interstitial: 'Intersticial',
    ad_body: 'Aqui aparecerá um anúncio real do AdMob/AdSense.', close_in: 'Fechar em', claim: 'Receber recompensa', close: 'Fechar',
    a_sound: 'Som', a_vibe: 'Vibração', a_noads: 'Remover anúncios', a_back: 'Voltar', a_menu: 'Menu',
    a_undo: 'Desfazer', a_restart: 'Recomeçar', a_markers: 'Mostrar nós', a_hint: 'Dica', a_lang: 'Idioma',
  },
  en: {
    tut1: 'Drag a <b>ball</b> to an empty hole until the ropes <b>stop crossing</b>.',
    tut2: 'One move can undo <b>several knots</b> at once. Find the rope in the way.',
    tut3: '<b>Order</b> matters. Made a mistake? Tap <b>↶</b> to undo (3 free per level).',
    tut4: 'Stuck? Tap <b>💡</b> to see the best move.',
    tut5: 'Solve within the <b>move goal</b> to earn <b>3 stars</b> ⭐',
    no_undo_title: 'No undos left ↶', no_undo_body: 'Watch a short video to get <b>{n}</b> undos for this level.',
    undo_plus: '+{n} undo ↶', perfect: 'Perfect! ✨',
    tagline: 'Untie the knots. Relax your mind.',
    play: 'Play', levels: 'Levels', daily: 'Daily challenge', styles: 'Styles',
    stars_won: '{n} ★ earned', privacy: 'Privacy policy',
    level: 'Level {n}', level_short: 'Level',
    crossing_one: 'knot', crossing_many: 'knots',
    tutorial: 'The rope you drag goes <b>over</b> the others.<br>The path matters: undo <b>every knot</b>.',
    win_title: 'Untied!', moves_line: '{m} move(s) · goal {p}',
    bonus_hint: '+1 bonus hint 💡', replay: 'Replay', next: 'Next ▶', home: 'Menu',
    no_hints_title: 'Out of hints 💡', no_hints_body: 'Watch a short video to get <b>{n}</b> hints.',
    not_now: 'Not now', watch: '▶ Watch', hints_plus: '+{n} hints 💡',
    ad_unavailable: 'Ad unavailable. Please try again.', purchase_na: 'Purchase not configured yet',
    tier_easy: 'Easy', tier_medium: 'Medium', tier_hard: 'Hard', tier_expert: 'Expert', tier_master: 'Master',
    daily_title: "Today's challenge", daily_win: 'Daily challenge complete! Come back tomorrow to keep your streak.',
    daily_done_btn: 'Done today ✓', streak: '🔥 {n}-day streak', daily_reward: '+1 hint for the challenge 💡',
    theme_classic: 'Classic', theme_ocean: 'Ocean', theme_candy: 'Candy', theme_autumn: 'Autumn',
    theme_neon: 'Neon', theme_forest: 'Forest',
    equip: 'Use', equipped: 'In use ✓', unlock_stars: '🔒 {n} ★', unlock_ad: '▶ Unlock',
    theme_unlocked: 'Theme unlocked! 🎨', need_stars: '{n} more ★ needed',
    ad_test: 'TEST AD', ad_rewarded: 'Rewarded ad', ad_interstitial: 'Interstitial',
    ad_body: 'A real AdMob/AdSense ad will appear here.', close_in: 'Close in', claim: 'Claim reward', close: 'Close',
    a_sound: 'Sound', a_vibe: 'Vibration', a_noads: 'Remove ads', a_back: 'Back', a_menu: 'Menu',
    a_undo: 'Undo', a_restart: 'Restart', a_markers: 'Show knots', a_hint: 'Hint', a_lang: 'Language',
  },
  es: {
    tut1: 'Arrastra una <b>bolita</b> a un hueco vacío hasta que las cuerdas <b>no se crucen</b>.',
    tut2: 'Una sola jugada puede deshacer <b>varios nudos</b>. Busca la cuerda que más estorba.',
    tut3: 'El <b>orden</b> importa. ¿Te equivocaste? Toca <b>↶</b> para deshacer (3 gratis por nivel).',
    tut4: '¿Atascado? Toca <b>💡</b> para ver la mejor jugada.',
    tut5: 'Resuelve dentro de la <b>meta de jugadas</b> para ganar <b>3 estrellas</b> ⭐',
    no_undo_title: 'Sin deshacer ↶', no_undo_body: 'Mira un video corto y gana <b>{n}</b> deshacer en este nivel.',
    undo_plus: '+{n} deshacer ↶', perfect: '¡Perfecto! ✨',
    tagline: 'Deshaz los nudos. Relaja la mente.',
    play: 'Jugar', levels: 'Niveles', daily: 'Reto diario', styles: 'Estilos',
    stars_won: '{n} ★ conseguidas', privacy: 'Política de privacidad',
    level: 'Nivel {n}', level_short: 'Nivel',
    crossing_one: 'nudo', crossing_many: 'nudos',
    tutorial: 'La cuerda que arrastras pasa <b>por encima</b> de las demás.<br>El camino importa: deshaz <b>todos los nudos</b>.',
    win_title: '¡Desatado!', moves_line: '{m} jugada(s) · meta {p}',
    bonus_hint: '+1 pista extra 💡', replay: 'Repetir', next: 'Siguiente ▶', home: 'Menú',
    no_hints_title: 'Sin pistas 💡', no_hints_body: 'Mira un video corto y gana <b>{n}</b> pistas.',
    not_now: 'Ahora no', watch: '▶ Ver', hints_plus: '+{n} pistas 💡',
    ad_unavailable: 'Anuncio no disponible. Inténtalo de nuevo.', purchase_na: 'Compra aún no configurada',
    tier_easy: 'Fácil', tier_medium: 'Medio', tier_hard: 'Difícil', tier_expert: 'Experto', tier_master: 'Maestro',
    daily_title: 'Reto de hoy', daily_win: '¡Reto diario completado! Vuelve mañana para mantener la racha.',
    daily_done_btn: 'Hecho hoy ✓', streak: '🔥 {n} día(s) seguido(s)', daily_reward: '+1 pista por el reto 💡',
    theme_classic: 'Clásico', theme_ocean: 'Océano', theme_candy: 'Dulce', theme_autumn: 'Otoño',
    theme_neon: 'Neón', theme_forest: 'Bosque',
    equip: 'Usar', equipped: 'En uso ✓', unlock_stars: '🔒 {n} ★', unlock_ad: '▶ Desbloquear',
    theme_unlocked: '¡Tema desbloqueado! 🎨', need_stars: 'Faltan {n} ★',
    ad_test: 'ANUNCIO DE PRUEBA', ad_rewarded: 'Anuncio con recompensa', ad_interstitial: 'Intersticial',
    ad_body: 'Aquí aparecerá un anuncio real de AdMob/AdSense.', close_in: 'Cerrar en', claim: 'Recibir recompensa', close: 'Cerrar',
    a_sound: 'Sonido', a_vibe: 'Vibración', a_noads: 'Quitar anuncios', a_back: 'Volver', a_menu: 'Menú',
    a_undo: 'Deshacer', a_restart: 'Reiniciar', a_markers: 'Mostrar nudos', a_hint: 'Pista', a_lang: 'Idioma',
  },
};

export const LANGS = ['pt', 'en', 'es'];
let lang = 'pt';

export function detectLang() {
  const nav = (navigator.language || 'pt').slice(0, 2).toLowerCase();
  return LANGS.includes(nav) ? nav : 'en';
}

export function setLang(l) {
  lang = LANGS.includes(l) ? l : 'pt';
  document.documentElement.lang = lang === 'pt' ? 'pt-BR' : lang;
  applyI18n();
}
export const getLang = () => lang;

/** t('level', {n: 3}) -> "Fase 3". "(s)" vira plural/singular conforme o 1º número. */
export function t(key, vars = {}) {
  let s = (STR[lang] && STR[lang][key]) ?? STR.pt[key] ?? key;
  for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, v);
  const first = Object.values(vars).find((v) => typeof v === 'number');
  return s.replace(/\(s\)/g, first === 1 ? '' : 's');
}

/** Traduz elementos marcados com data-i18n / data-i18n-html / data-i18n-aria. */
export function applyI18n(root = document) {
  root.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  root.querySelectorAll('[data-i18n-html]').forEach((el) => { el.innerHTML = t(el.dataset.i18nHtml); });
  root.querySelectorAll('[data-i18n-aria]').forEach((el) => { el.setAttribute('aria-label', t(el.dataset.i18nAria)); });
}
