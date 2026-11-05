# Rope Maze

Quebra-cabeça clássico das 5 salas: passar uma corda por **todas as 15 portas, uma vez
cada**, sem que dois trechos da corda se cruzem dentro da mesma sala. A página mostra a
busca com volta atrás passo a passo (*Next Step*), automática (*Run*) ou pausada (*Stop*),
desenha a corda e conta portas (*Count*) e tentativas (*Tries*).

Versão moderna (sem jQuery) do código original, com correções:

- nome de porta errado: `door_sw_n` apontava para `door_nw_sw` (inexistente) → `door_nw_s`;
- a checagem de cruzamento comparava com a tentativa antiga da própria sala;
- erro ao esgotar a busca (agora mostra "Sem solução");
- *Count* não atualizava no *Next Step*.

```bash
npx serve ..          # na pasta ropemaze; abra http://localhost:3000/ropemaze/
npm test              # valida a solução (15 portas, sem repetir, sem cruzar)
```

Resultado: solução em 21 tentativas, começando do lado de fora e terminando na sala
nordeste — as únicas duas regiões com número ímpar de portas (9 e 5), como exige a
teoria de caminhos de Euler.
