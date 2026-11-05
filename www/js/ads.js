// ==========================================================================
// Camada única de anúncios.
//  - Android / iOS (Capacitor): AdMob via @capacitor-community/admob
//      * consentimento UMP (LGPD/GDPR) + ATT no iOS
//      * banner adaptativo, intersticial entre fases, premiado (dicas)
//  - Web: Google H5 Games Ads (adBreak) se CONFIG.ads.web.adsenseClient
//         estiver preenchido; senão, simulação em modo teste.
// O resto do jogo só chama: Ads.init(), Ads.levelCompleted(), Ads.rewarded().
// ==========================================================================
import { CONFIG } from './config.js';

const cap = window.Capacitor;
const isNative = !!(cap && cap.isNativePlatform && cap.isNativePlatform());
const platform = (cap && cap.getPlatform && cap.getPlatform()) || 'web';

let AdMob = null;
let provider = 'none'; // 'admob' | 'h5' | 'mock' | 'none'
let noAds = false;
let lastInterstitial = 0;
let levelsSinceAd = 0;
let hooks = { onPause: () => {}, onResume: () => {}, onBannerHeight: () => {} };

const ids = () => CONFIG.ads.admob[platform === 'ios' ? 'ios' : 'android'];

// ---------------------------------------------------------------- AdMob
async function initAdMob() {
  AdMob = cap.registerPlugin ? cap.registerPlugin('AdMob') : cap.Plugins && cap.Plugins.AdMob;
  if (!AdMob) return false;
  try {
    await AdMob.initialize({ initializeForTesting: CONFIG.ads.testing });

    // iOS 14+: App Tracking Transparency
    if (platform === 'ios') {
      try {
        const st = await AdMob.trackingAuthorizationStatus();
        if (st && st.status === 'notDetermined') await AdMob.requestTrackingAuthorization();
      } catch { /* versão antiga do plugin */ }
    }

    // Consentimento (UMP) — obrigatório para EEA/Reino Unido; boa prática para LGPD
    try {
      const info = await AdMob.requestConsentInfo();
      if (info && info.isConsentFormAvailable && info.status === 'REQUIRED') {
        await AdMob.showConsentForm();
      }
    } catch { /* sem formulário configurado no AdMob */ }

    AdMob.addListener('bannerAdSizeChanged', (s) => hooks.onBannerHeight((s && s.height) || 0));
    AdMob.addListener('onRewardedVideoAdReward', () => { rewardEarned = true; });
    preloadInterstitial();
    preloadRewarded();
    return true;
  } catch (e) {
    console.warn('AdMob init falhou', e);
    return false;
  }
}

let interstitialReady = false;
let rewardedReady = false;
let rewardEarned = false;

async function preloadInterstitial() {
  try {
    await AdMob.prepareInterstitial({ adId: ids().interstitial, isTesting: CONFIG.ads.testing });
    interstitialReady = true;
  } catch { interstitialReady = false; }
}
async function preloadRewarded() {
  try {
    await AdMob.prepareRewardVideoAd({ adId: ids().rewarded, isTesting: CONFIG.ads.testing });
    rewardedReady = true;
  } catch { rewardedReady = false; }
}

// ---------------------------------------------------------------- H5 Games Ads (web)
function initH5() {
  const client = CONFIG.ads.web.adsenseClient;
  if (!client) return false;
  window.adsbygoogle = window.adsbygoogle || [];
  window.adBreak = window.adConfig = function (o) { window.adsbygoogle.push(o); };
  const s = document.createElement('script');
  s.async = true;
  s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${client}`;
  s.crossOrigin = 'anonymous';
  s.setAttribute('data-ad-client', client);
  s.setAttribute('data-ad-frequency-hint', `${CONFIG.ads.interstitialMinIntervalSec}s`);
  if (CONFIG.ads.testing) s.setAttribute('data-adbreak-test', 'on');
  document.head.appendChild(s);
  window.adConfig({ preloadAdBreaks: 'on', sound: 'on' });
  return true;
}

// ---------------------------------------------------------------- Simulação (desenvolvimento)
function mockAd(kind) {
  return new Promise((resolve) => {
    const el = document.createElement('div');
    el.className = 'mock-ad';
    let left = kind === 'rewarded' ? 5 : 3;
    el.innerHTML = `<div class="mock-ad-box"><small>ANÚNCIO DE TESTE</small>
      <h3>${kind === 'rewarded' ? 'Anúncio premiado' : 'Intersticial'}</h3>
      <p>Aqui aparecerá um anúncio real do AdMob/AdSense.</p>
      <button class="btn" disabled>Fechar em <b>${left}</b></button></div>`;
    document.body.appendChild(el);
    const btn = el.querySelector('button');
    const timer = setInterval(() => {
      left--;
      if (left > 0) { btn.querySelector('b').textContent = left; return; }
      clearInterval(timer);
      btn.disabled = false;
      btn.textContent = kind === 'rewarded' ? 'Receber recompensa' : 'Fechar';
    }, 1000);
    btn.onclick = () => { el.remove(); resolve(true); };
  });
}

// ---------------------------------------------------------------- API pública
export const Ads = {
  get provider() { return provider; },
  get isNative() { return isNative; },

  async init(opts = {}) {
    hooks = { ...hooks, ...opts.hooks };
    noAds = !!opts.noAds;
    levelsSinceAd = opts.levelsSinceAd || 0;
    if (!CONFIG.ads.enabled) { provider = 'none'; return; }
    if (isNative && (await initAdMob())) provider = 'admob';
    else if (!isNative && initH5()) provider = 'h5';
    else provider = CONFIG.ads.testing ? 'mock' : 'none';
    if (!noAds) this.showBanner();
  },

  async showBanner() {
    if (provider !== 'admob' || noAds || !CONFIG.ads.showBanner) return;
    try {
      await AdMob.showBanner({
        adId: ids().banner,
        adSize: 'ADAPTIVE_BANNER',
        position: 'BOTTOM_CENTER',
        margin: 0,
        isTesting: CONFIG.ads.testing,
      });
    } catch (e) { console.warn('banner', e); }
  },

  async hideBanner() {
    if (provider !== 'admob') return;
    try { await AdMob.removeBanner(); } catch { /* */ }
    hooks.onBannerHeight(0);
  },

  setNoAds(v) {
    noAds = v;
    if (v) this.hideBanner();
  },

  /**
   * Chamar ao avançar de fase. Mostra intersticial respeitando frequência.
   * Retorna o novo contador levelsSinceAd (para salvar).
   */
  async levelCompleted(level) {
    levelsSinceAd++;
    const a = CONFIG.ads;
    const now = Date.now() / 1000;
    const due =
      !noAds && provider !== 'none' &&
      level >= a.firstInterstitialAfterLevel &&
      levelsSinceAd >= a.interstitialEveryLevels &&
      now - lastInterstitial >= a.interstitialMinIntervalSec;
    if (!due) return levelsSinceAd;

    let shown = false;
    hooks.onPause();
    try {
      if (provider === 'admob') {
        if (!interstitialReady) await preloadInterstitial();
        if (interstitialReady) {
          await AdMob.showInterstitial();
          shown = true;
          interstitialReady = false;
          preloadInterstitial();
        }
      } else if (provider === 'h5') {
        shown = await new Promise((res) => {
          window.adBreak({
            type: 'next',
            name: `fase-${level}`,
            adBreakDone: (info) => res(info && info.breakStatus === 'viewed'),
          });
        });
      } else if (provider === 'mock') {
        shown = await mockAd('interstitial');
      }
    } catch (e) { console.warn('intersticial', e); }
    hooks.onResume();
    if (shown) { lastInterstitial = now; levelsSinceAd = 0; }
    return levelsSinceAd;
  },

  /** Anúncio premiado. Resolve true se o jogador deve receber a recompensa. */
  async rewarded() {
    if (provider === 'none') return true; // sem anúncios: recompensa grátis
    hooks.onPause();
    let ok = false;
    try {
      if (provider === 'admob') {
        if (!rewardedReady) await preloadRewarded();
        if (rewardedReady) {
          rewardEarned = false;
          const item = await AdMob.showRewardVideoAd();
          ok = rewardEarned || !!(item && item.amount > 0);
          rewardedReady = false;
          preloadRewarded();
        }
      } else if (provider === 'h5') {
        ok = await new Promise((res) => {
          let viewed = false, offered = false;
          window.adBreak({
            type: 'reward',
            name: 'dicas',
            beforeReward: (showAdFn) => { offered = true; showAdFn(); },
            adViewed: () => { viewed = true; },
            adDismissed: () => { viewed = false; },
            adBreakDone: () => res(offered ? viewed : true), // sem anúncio disponível => concede
          });
        });
      } else if (provider === 'mock') {
        ok = await mockAd('rewarded');
      }
    } catch (e) { console.warn('premiado', e); ok = false; }
    hooks.onResume();
    return ok;
  },
};
