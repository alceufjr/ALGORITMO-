# Guia de publicação e monetização — Desenrola!

> Checklist prático para levar o jogo do código às lojas, com anúncios rendendo.
> Valores de taxas e regras das lojas mudam; confira sempre no console oficial.

---

## 0. Antes de tudo

1. **Nome / marca.** "Desenrola" já é usado por um programa do Governo Federal
   ("Desenrola Brasil"). Pesquise no **INPI** (busca.inpi.gov.br), na Google Play e na
   App Store e, se houver conflito, troque o nome em `www/index.html`,
   `www/manifest.webmanifest`, `capacitor.config.json` e `www/js/config.js`.
   Sugestões: *Nó Solto*, *Corda Livre*, *Desata!*, *Fio a Fio*.
2. **ID do app** em `capacitor.config.json` (`appId`): ex. `br.com.seunome.desata`.
   Não dá para mudar depois de publicado.
3. **Política de privacidade:** preencha `www/privacidade.html` e hospede-a numa URL
   pública (GitHub Pages serve). As duas lojas e o AdMob exigem.
4. **Conta de pagamentos:** AdMob paga via transferência internacional; tenha conta que
   receba em dólar/real. Consulte um contador sobre a tributação da receita
   (pessoa física × empresa).

| Conta | Custo | Observação |
|---|---|---|
| Google Play Console | US$ 25 (uma vez) | contas pessoais novas precisam de teste fechado com testadores antes da produção |
| Apple Developer | US$ 99/ano | precisa de um Mac com Xcode (ou build em nuvem: Codemagic, Ionic Appflow) |
| AdMob / AdSense | grátis | |
| Steam | US$ 100 por jogo | opcional |

---

## 1. Anúncios (AdMob)

1. Crie conta em **admob.google.com** → *Apps → Adicionar app* (um para Android, outro para iOS).
2. Em cada app crie 3 **blocos de anúncios**: *Banner*, *Intersticial*, *Premiado*.
3. Cole os IDs em `www/js/config.js` (`ads.admob.android` / `ads.admob.ios`).
4. Coloque o **App ID** (formato `ca-app-pub-XXXX~YYYY`) nos projetos nativos:
   - Android: `android/app/src/main/AndroidManifest.xml`, dentro de `<application>`:
     ```xml
     <meta-data android:name="com.google.android.gms.ads.APPLICATION_ID"
                android:value="ca-app-pub-XXXX~YYYY"/>
     ```
   - iOS: `ios/App/App/Info.plist`:
     ```xml
     <key>GADApplicationIdentifier</key><string>ca-app-pub-XXXX~YYYY</string>
     <key>NSUserTrackingUsageDescription</key>
     <string>Usamos este identificador para mostrar anúncios mais relevantes e manter o jogo gratuito.</string>
     ```
     e adicione a lista `SKAdNetworkItems` indicada na documentação do AdMob.
5. **Consentimento (LGPD/GDPR):** AdMob → *Privacidade e mensagens* → crie a mensagem
   GDPR (e, se quiser, a de regulamentações estaduais dos EUA). O jogo já chama
   `requestConsentInfo()`/`showConsentForm()` e, no iOS, o pedido ATT.
6. **app-ads.txt:** publique o arquivo que o AdMob gera na raiz do site do
   desenvolvedor informado na loja (ex.: `https://seusite.com/app-ads.txt`). Sem isso a
   receita cai bastante.
7. Na publicação: **`testing: false`** em `config.js`. Nunca clique nos seus anúncios reais.

### Estratégia de anúncios já implementada

| Formato | Quando | Configuração |
|---|---|---|
| Banner adaptativo | rodapé, sempre (apps) | `showBanner` |
| Intersticial | a cada 3 fases, nunca antes da fase 4, ≥ 90 s de intervalo | `interstitialEveryLevels`, `firstInterstitialAfterLevel`, `interstitialMinIntervalSec` |
| Premiado (rewarded) | jogador sem dicas escolhe assistir → +2 dicas | `hints.perRewarded` |

O premiado costuma ter o melhor eCPM e a melhor aceitação: é opcional para o jogador.
Intersticial demais derruba a retenção; ajuste a frequência olhando o *D1/D7 retention*
no Firebase/Play Console.

### "Remover anúncios" (compra no app)

O jogo já tem a flag `noAds` salva e o botão 🚫 (oculto). Para ativar:

```bash
npm i @revenuecat/purchases-capacitor && npx cap sync
```

1. Crie o produto não consumível `remove_ads` na Play Console e no App Store Connect.
2. Configure o RevenueCat (grátis até certo faturamento) com os dois apps.
3. Em `main.js`, no `#btnNoAds.onclick`, chame `Purchases.purchaseStoreProduct(...)` e, no
   sucesso, `Store.set({ noAds: true }); Ads.setNoAds(true);`. Inclua também
   "Restaurar compras" (exigência da Apple).
4. `CONFIG.iap.enabled = true`.

---

## 2. Android (Google Play)

Requisitos: Node 20+, Android Studio (JDK 21 incluso).

```bash
npm install
npm run icons                     # gera PNGs (opcional; já estão em assets/)
npx cap add android
npx capacitor-assets generate     # ícones e splash em todas as resoluções
npx cap sync android
npx cap open android              # abre o Android Studio
```

No Android Studio: *Build → Generate Signed Bundle → Android App Bundle (.aab)*.
**Guarde o keystore e as senhas em local seguro** (ou use Play App Signing).

Na Play Console:
- *Ficha da loja:* ícone 512 px (`www/icons/icon-512.png`), gráfico de destaque 1024×500,
  ≥ 2 capturas de tela (rode `node tests/e2e.test.js --shots pasta`).
- *Conteúdo do app:* política de privacidade, **contém anúncios = Sim**, classificação
  etária (questionário IARC), público-alvo (≥ 13 anos simplifica as regras de anúncio),
  formulário de **Segurança dos dados** (declare: ID de publicidade, dados de uso e
  diagnóstico coletados pelo SDK do AdMob, para publicidade/analytics).
- Faixa de teste fechado → produção.
- Mantenha o `targetSdkVersion` no mínimo exigido pela Play no momento.

## 3. iOS (App Store)

```bash
npx cap add ios
npx capacitor-assets generate
npx cap sync ios
npx cap open ios                  # Xcode
```

No Xcode: Signing com seu time, *Product → Archive → Distribute App*. No App Store
Connect: capturas 6,7"/6,5" e iPad (se habilitar iPad), "Privacidade do app"
(Identificadores → Publicidade de terceiros; Rastreamento = Sim se pedir ATT),
classificação etária e revisão.

Sem Mac: Codemagic ou Ionic Appflow compilam na nuvem a partir deste repositório.

## 4. Web (site próprio + AdSense)

1. Hospede a pasta `www/` (GitHub Pages, Netlify, Vercel, Cloudflare Pages — HTTPS).
2. Solicite no AdSense o programa **H5 Games Ads (Ad Placement API)** e coloque o
   `ca-pub-...` em `CONFIG.ads.web.adsenseClient`.
3. O jogo já instala como PWA (manifest + service worker) e funciona offline.

## 5. Portais de jogos web

Os portais pagam por *revenue share* e **proíbem AdSense próprio**: deixe
`adsenseClient` vazio e use o SDK deles dentro de `ads.js` (mesma interface):

```js
// CrazyGames (SDK v3) — intersticial / premiado
window.CrazyGames.SDK.ad.requestAd('midgame',  { adFinished: done, adError: done });
window.CrazyGames.SDK.ad.requestAd('rewarded', { adFinished: () => done(true), adError: () => done(false) });

// Poki
PokiSDK.commercialBreak().then(done);
PokiSDK.rewardedBreak().then((ok) => done(ok));
```

Empacote com `npm run zip:web` e envie pelo painel do portal (CrazyGames, Poki,
GameDistribution, itch.io).

## 6. Desktop (Steam / itch.io / Microsoft Store)

Na versão paga **remova os anúncios** (`ads.enabled = false`). Empacote `www/` com
**Electron** (`electron-builder`) ou **Tauri**. A Microsoft Store também aceita PWA
via **PWABuilder.com** (gera pacote MSIX a partir da URL do site).

---

## 7. Checklist final

- [ ] Nome livre (INPI + lojas) e `appId` definitivo
- [ ] `testing: false` e IDs reais do AdMob
- [ ] App ID do AdMob no AndroidManifest / Info.plist
- [ ] Mensagem de consentimento GDPR criada no AdMob
- [ ] `app-ads.txt` publicado no site do desenvolvedor
- [ ] Política de privacidade preenchida e online
- [ ] `npm test` e `node tests/e2e.test.js` passando
- [ ] Testado em aparelho real (Android e iPhone)
- [ ] Capturas de tela e textos da loja em PT-BR e EN
- [ ] Formulários Segurança dos dados (Play) / Privacidade (Apple)

## 8. Próximos passos que aumentam receita

- **Firebase Analytics + Remote Config:** ajustar frequência de anúncios e curva de
  dificuldade sem publicar nova versão.
- **Mediação AdMob** (AppLovin, Meta, Unity, Liftoff): +20–40 % de eCPM típico.
- **Desafio diário** (semente = data) e sequência de dias → retenção.
- **Temas/cordas cosméticas** desbloqueáveis por anúncio premiado ou compra.
- **Localização** (EN, ES): o mercado de puzzle casual é global.
