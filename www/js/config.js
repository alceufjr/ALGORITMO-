// ============================================================
//  CONFIGURAÇÃO CENTRAL DO JOGO — edite aqui antes de publicar
// ============================================================
// Versão de computador (Steam / itch.io): paga e sem anúncios.
// O app de desktop (desktop/main.cjs) abre o jogo com ?desktop=1.
const IS_DESKTOP = typeof location !== 'undefined' && /[?&]desktop=1/.test(location.search);

export const CONFIG = {
  isDesktop: IS_DESKTOP,
  appName: 'Desata!',
  version: '1.0.0',

  ads: {
    enabled: !IS_DESKTOP,
    // ⚠️ MUDE PARA false ANTES DE PUBLICAR NAS LOJAS.
    // Com true, são exibidos apenas anúncios de TESTE (nunca clique em
    // anúncios reais seus — o AdMob bane a conta).
    testing: true,

    // Frequência de intersticial (tela cheia) entre fases
    interstitialEveryLevels: 3,      // a cada N fases concluídas
    interstitialMinIntervalSec: 90,  // intervalo mínimo entre dois intersticiais
    firstInterstitialAfterLevel: 4,  // não mostra nada nas primeiras fases

    showBanner: true,                // banner fixo no rodapé (apps nativos)

    // IDs do AdMob. Os valores abaixo são os IDs OFICIAIS DE TESTE do Google.
    // Substitua pelos seus (AdMob > Apps > Blocos de anúncios).
    admob: {
      android: {
        banner: 'ca-app-pub-3940256099942544/9214589741',
        interstitial: 'ca-app-pub-3940256099942544/1033173712',
        rewarded: 'ca-app-pub-3940256099942544/5224354917',
      },
      ios: {
        banner: 'ca-app-pub-3940256099942544/2435281174',
        interstitial: 'ca-app-pub-3940256099942544/4411468910',
        rewarded: 'ca-app-pub-3940256099942544/1712485313',
      },
    },

    // Web: Google AdSense "H5 Games Ads" (Ad Placement API).
    // Preencha com seu publisher id, ex.: 'ca-pub-1234567890123456'.
    // Vazio = sem anúncios reais na versão web (usa simulação em modo teste).
    web: {
      adsenseClient: '',
    },
  },

  // Compra "Remover anúncios" (ver docs/PUBLICACAO.md, seção IAP)
  iap: {
    enabled: false,
    removeAdsProductId: 'remove_ads',
  },

  // Desfazer: grátis algumas vezes por fase; depois, +N assistindo a um vídeo premiado
  undo: {
    freePerLevel: 3,
    perRewarded: 3,
  },

  hints: {
    initial: 3,         // dicas iniciais
    perRewarded: 2,     // dicas ganhas por anúncio premiado
    bonusEveryLevels: 5 // +1 dica grátis a cada N fases
  },
};
