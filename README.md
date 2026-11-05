# Desata! — puzzle de cordas

Jogo casual original no gênero "untangle": arraste as pontas das cordas para furos
vazios até que **nenhuma corda cruze outra**. Fases **infinitas e procedurais**, com
dificuldade progressiva, e anúncios já integrados para monetização.

Um único código-fonte (HTML5 + JavaScript, sem framework) roda em:

| Plataforma | Como | Monetização |
|---|---|---|
| Android (Google Play) | Capacitor → `.aab` | AdMob (banner, intersticial, premiado) |
| iOS (App Store) | Capacitor → Xcode | AdMob + ATT |
| Web / PWA | pasta `www/` em qualquer hospedagem | AdSense H5 Games Ads |
| Portais (CrazyGames, Poki, GameDistribution, itch.io) | `npm run zip:web` | SDK do portal (ver docs) |
| Windows/Mac/Linux (Steam, itch) | Electron/Tauri sobre `www/` | venda paga (sem anúncios) |

## Rodar agora

```bash
npm start            # abre http://localhost:8080
npm test             # valida 300 fases, desafio diário e temas
npm run test:e2e     # joga no navegador (precisa de npm start rodando e do Playwright)
```

## Como o jogo funciona

- **Regra:** vence quando o nº de cruzamentos chega a 0. Encostar a ponta no meio de
  outra corda também conta como cruzamento.
- **Gerador com solução garantida** (`www/js/levels.js`): cria um tabuleiro resolvido e
  o embaralha com jogadas reversíveis; a meta de jogadas (3 estrelas) é calculada de
  forma exata nas fases pequenas e por limite superior nas grandes.
- **Curva de dificuldade:**

| Fases | Nível | Cordas | Grade | Cruzamentos iniciais |
|---|---|---|---|---|
| 1–12 | Fácil | 2–4 | 3×3 → 4×4 | 1–3 |
| 13–30 | Médio | 5–9 | 4×4 → 5×5 | 5–24 |
| 31–60 | Difícil | 9–16 | 5×6 → 5×8 | 25–90 |
| 61–100 | Expert | 16 | 5×8, menos furos livres | ~90–100 |
| 100+ | Mestre | 16 | furos livres no mínimo | ~90–100 |

- **Desafio diário:** uma fase nova por dia (igual para todos), mais difícil ao longo da
  semana, com sequência de dias 🔥 e dica de recompensa.
- **Estilos:** 6 temas (Clássico, Oceano, Doce, Outono, Neon, Floresta), liberados por
  estrelas ou assistindo a um anúncio premiado.
- **Idiomas:** português, inglês e espanhol (detecta o idioma do aparelho).
- Extras: desfazer, recomeçar, marcadores de cruzamento, dicas com anúncio
  premiado, estrelas, seleção de fases, som sintetizado, vibração, modo offline (PWA).

## Estrutura

```
www/                 jogo (é isto que vai para as lojas)
  js/config.js       ← IDs de anúncio, frequência, modo teste
  js/levels.js       gerador procedural + curva de dificuldade
  js/core.js         geometria exata dos cruzamentos
  js/game.js         jogadas, desfazer, dica, estrelas
  js/render.js       desenho em canvas
  js/ads.js          AdMob / AdSense / simulação
  js/i18n.js         traduções PT/EN/ES
  js/themes.js       temas cosméticos
  privacidade.html   modelo de política de privacidade (LGPD)
assets/              ícone e splash 1024/2732 px p/ lojas
tests/               testes do gerador e E2E no navegador
scripts/             ícones e configuração dos projetos nativos
.github/workflows/   compila Android (APK/AAB) e iOS a cada envio
docs/PUBLICACAO.md   passo a passo de publicação e monetização
```

Leia **[docs/PUBLICACAO.md](docs/PUBLICACAO.md)** antes de publicar.
