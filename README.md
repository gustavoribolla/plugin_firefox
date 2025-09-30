
# Plugin de Privacidade — Entrega Completa (README + Relatório + Checklist)

> **Projeto:** Extensão Web (Firefox) para detecção e controle de riscos de privacidade durante a navegação.  
> **Versão entregue:** Conceito **A** (inclui todos os requisitos de C e B).  
> **Como testar rapidamente:** carregue `plugin/manifest.json` (modo temporário do Firefox), abra um site de notícias, ative **Bloquear** no popup e observe **requisições, cookies, storage, canvas FP, sync, hijacking, relatório Top 5 e bloqueios**.

---

## 1) Instalação e Execução (Firefox)

1. Abra o **Firefox** e digite na barra de endereços: `about:debugging` → **Este Firefox**.  
2. Clique em **Carregar Add-on Temporário…**.  
3. Selecione **`plugin/manifest.json`** (dentro do zip entregue).  
4. Abra um site (ex.: portal de notícias) e pressione **F5**.  
5. Clique no **ícone do plugin** (fixe o ícone no menu 🧩 se quiser).  
6. No popup, você verá **score**, **requisições 1ª/3ª**, **cookies**, **storage**, **Canvas FP**, **sync**, **hijacking**, **relatório Top 5**, **botões de bloqueio** e **contadores de bloqueadas**.

> **Observação:** extensões temporárias somem ao fechar o Firefox. Para testar novamente, repita os passos acima.

---

## 2) Como Demonstrar (Roteiro Sugerido)

1. **Cenário 3ª parte + bloqueio**  
   - Abra um portal de notícias, dê **F5** e mostre: **1ª/3ª parte** no popup.  
   - Ative **Bloquear** e (opcional) **Bloquear lista embutida**.  
   - Volte ao site, **F5** e mostre no **Relatório (Top 5)** os domínios marcados como `(tracker)` e/ou `[bloqueado]`.  
   - Observe **“bloqueadas”** subir e o **score** mudar.

2. **Cenário cookies + storage**  
   - Abra um webapp (email, rede social).  
   - Mostre **Cookies** (1ª/3ª; sessão/persistente) e **Storage** (local/session/IndexedDB) com valores > 0.

3. **Canvas Fingerprint**  
   - No console da página (F12 → Console), rode:  
     ```js
     const c=document.createElement('canvas');
     const x=c.getContext('2d');
     x.fillText('test',10,10);
     c.toDataURL(); // o popup deve indicar "Canvas FP: suspeito"
     ```

4. **Hijacking/Hook (indícios)**  
   - Em sites com muita injeção de iframes/ads pode surgir **flags**.  
   - (Opcional) demonstrar inserindo um `<script src=".../hook.js">` em ambiente de teste.

> Capture **3–5 prints** do popup nesses cenários para anexar ao relatório final de apresentação.

---

## 3) Mapeamento de Requisitos ↔ Implementação

### 3.1 Entregáveis (Conceito C)
- **Conexões a domínios de terceira parte:**  
  Contadas em `background/worker.js` com `webRequest.onBeforeRequest`. O popup exibe **1ª parte** vs **3ª parte**.

- **Potenciais ameaças de sequestro (hijacking/hook):**  
  `content/hook-detector.js` usa `MutationObserver` para observar **scripts/iframes** adicionados dinamicamente e marca padrões suspeitos. O popup exibe **flags**.

- **Armazenamento HTML5 (no dispositivo):**  
  `content/detector.js` mede **localStorage**, **sessionStorage** e **IndexedDB** e envia ao background. O popup exibe **Storage** (local/session/IndexedDB).

- **Cookies e supercookies (se possível 1ª/3ª; sessão/navegação):**  
  `background/worker.js` (Firefox) lê por **domínio** + **storeId** usando `browser.cookies.getAll({ domain, storeId })`.  
  Classificação: **1ª vs 3ª parte** por eTLD+1 e **sessão vs persistente** por `expirationDate`. O popup mostra os 4 campos.

- **Detecção de Canvas fingerprint:**  
  `content/canvas-patch.js` intercepta `HTMLCanvasElement.toDataURL`, `toBlob` e `CanvasRenderingContext2D.getImageData`, sinalizando **Canvas FP**.

- **Pontuação (score) e metodologia:**  
  `shared/utils.js > computeScore(metrics)` agrega os sinais em uma nota (0–100) e está **documentado e ajustável**.

### 3.2 Conceito B (adicional)
- **Interface simples (listas):**  
  **Opções** em `options/options.html/js` para **Allowlist** e **Blocklist**, persistidas em `browser.storage.local`.

- **Relatório básico no app:**  
  O **popup** mostra **Top 5 domínios 3ª parte** (host, contagem e rótulo `(tracker)` quando bate na lista embutida).

### 3.3 Conceito A (adicional)
- **Identificação, bloqueio e personalização completa:**  
  `background/worker.js` cancela requisições via `webRequest` com `["blocking"]` quando o host estiver na **Blocklist**, ou (opcionalmente) na lista embutida (**toggle**: “Bloquear lista embutida”).  
  Opções avançadas:
  - **Bloquear** (liga/desliga o bloqueio).  
  - **Bloquear lista embutida** (ativa uso da lista local de trackers).  
  - **Bloquear 1ª parte** (também cancela quando o host de 1ª parte estiver bloqueado).  
  - **Bloquear host atual** / **Permitir host atual** (atalhos no popup).  
  Relatório mostra **bloqueadas** e separa **trackers 1ª vs 3ª parte**.

---

## 4) Arquitetura (arquivos principais)

```
plugin/
├─ manifest.json                # MV3 (Firefox) com background.scripts
├─ shared/
│  ├─ utils.js                  # etld2/sameSite + computeScore (ajustável)
│  └─ trackers.json             # pequena lista embutida de trackers (exemplos)
├─ background/
│  └─ worker.js                 # núcleo: contador 1p/3p, cookies, sync, bloqueio, relatório, config
├─ content/
│  ├─ detector.js               # mede Storage
│  ├─ canvas-patch.js           # sinaliza Canvas FP
│  └─ hook-detector.js          # indícios de hijacking/hook
├─ popup/
│  ├─ popup.html/css/js         # UI principal (score, contadores, relatório, toggles, atalhos)
└─ options/
   ├─ options.html/js           # UI de listas e toggles persistentes
```

**Detalhes técnicos relevantes:**
- **Firefox MV3:** usa `background.scripts` (event page).  
- **Terceira parte:** baseada em comparação de **eTLD+1** (simplificada) com `sameSite(a,b)`/`etld2()`.  
- **Cookies no Firefox:** coleta por `domain` + `storeId` (containers/FPI).  
- **Cookie sync:** heurística por **parâmetros de ID comuns** (`uid`, `cid`, `_ga`, `gclid`, `fbp` etc.) aparecendo em hosts diferentes.  
- **Relatório Top 5:** log por aba dos **hosts 3ª parte** e contagem; marca `(tracker)` e `[bloqueado]`.  
- **Bloqueio:** decisão por **Allowlist/Blocklist** do usuário + (opcional) **lista embutida**. Cancela via `return { cancel: true }` no listener.

---

## 5) Metodologia de Score (explicada)

**Objetivo:** sintetizar o risco de privacidade da página em um número **0–100** (quanto maior, melhor).  
**Base:** começa em **100** e aplica **penalizações** (e um pequeno bônus por bloqueio).

**Pesos (default):**
- **Requisições 3ª parte:** −2 por request (até −30) → expõe a superfície de rastreio.  
- **Cookies 3ª parte:** −2 por cookie (até −20) → persistência cross-site.  
- **Storage (local/session/IndexedDB):** −5 por tipo presente → persistência local.  
- **Canvas FP:** −15 se detectado → técnica robusta de fingerprinting.  
- **Cookie Sync:** −5 por par detectado → correlação cross-domain.  
- **Hijacking/Hook:** −15 por flag → risco de injeção/abuso.  
- **Bônus (versão A):** +0,2 por request **bloqueada** (até +20) → mitigação ativa.

**Por que esses limites?**  
Evitar que um único fator “estoure” a nota (ex.: páginas com centenas de requests). Os caps (30/20) estabilizam o efeito.

**Onde ajustar:** `shared/utils.js > computeScore(metrics)` — o avaliador pode alterar os pesos e refazer os testes.

---

## 6) Configuração e Personalização

- **Popup (rápido):**  
  - **Bloquear** (liga/desliga).  
  - **Bloquear lista embutida** (usa `shared/trackers.json`).  
  - **Bloquear 1ª parte** (também cancela quando o domínio de 1ª parte estiver bloqueado).  
  - **Bloquear host atual** / **Permitir host atual**: adiciona o eTLD+1 da aba ativa à **Blocklist/Allowlist**.

- **Opções (persistente):**  
  - Gerencie **Allowlist** e **Blocklist** (valores salvos em `browser.storage.local`).  
  - Alterações refletem imediatamente no comportamento do background.

---

## 7) Como Testar (Casos e Evidências)

1. **Portal de notícias** (ex.: G1, UOL, CNN, etc.)  
   - Esperado: **3ª parte >> 1ª parte**, vários `(tracker)` no **Top 5**.  
   - Com **Bloquear** ligado: **bloqueadas** > 0 e tags `[bloqueado]` no relatório.  
   - **Score** deve cair sem bloqueio e melhorar levemente com bloqueio.

2. **App Web logado** (Gmail, Drive, rede social)  
   - Esperado: **Cookies persistentes** e **Storage** > 0.  
   - **3ª parte** menor que no portal, mas ainda presente.

3. **Canvas FP**  
   - No console, executar snippet (Seção 2).  
   - Esperado: popup mostra **“Canvas FP: suspeito”**.

4. **Hijacking/Hook**  
   - Em páginas com injeções de anúncios, pode aparecer **flags**.  
   - (Opcional) Inserir um script com nome suspeito em ambiente de teste para validar o detector.

5. **Cookie Sync**  
   - Portais com ad-tech frequentemente exibem **pares** ≥ 1.  
   - (Opcional) Navegar entre domínios com mesma query de `uid/cid/_ga` para forçar o evento.

> **Dica:** use as capturas para compor o relatório final de apresentação (anexar prints dos cenários acima).

---

## 8) Limitações conhecidas e Trabalhos Futuros

- **eTLD+1 simplificado:** não consulta a Public Suffix List; pode errar em ccTLDs complexos (`co.uk`). (Mitigável importando PSL.)  
- **Hijacking heurístico:** visa indícios; pode gerar falso-positivo/negativo.  
- **Cookie Sync heurístico:** regex de parâmetros comum; poderia evoluir para matching por **valor** + **janela temporal**.  
- **Lista embutida curta:** exemplos mínimos; para produção, integrar listas públicas (ex.: EasyPrivacy) com atualização periódica.  
- **Performance:** bloqueio baseado em `webRequest` é suficiente aqui; para Chromium, considerar **declarativeNetRequest**.

---

## 9) Checklist de Correção (com status)

### Conceito **C**
- [x] Conexões a domínios de **terceira parte** (contagem 1p/3p exibida no popup).  
- [x] **Hijacking/Hook**: flags exibidas (MutationObserver).  
- [x] **Storage** (local/session/IndexedDB) detectado e mostrado.  
- [x] **Cookies/supercookies**: 1ª vs 3ª + **sessão/persistente**.  
- [x] **Canvas fingerprint** detectado.  
- [x] **Pontuação (score)** com metodologia documentada.

### Conceito **B**
- [x] **Interface** simples para listas (Allowlist/Blocklist) nas **Opções**.  
- [x] **Relatório** básico no popup (Top 5 domínios 3ª parte, `(tracker)`).

### Conceito **A**
- [x] **Bloqueio de conteúdo** via `webRequest` (**blocking**) conforme listas e toggles.  
- [x] **Personalização completa**: toggles (Bloquear, Lista embutida, 1ª parte) + atalhos bloquear/permitir host atual.  
- [x] **Relatório adicional**: contagem de **bloqueadas** e distinção **trackers 1ª vs 3ª parte**.

---

## 10) Troubleshooting (rápido)

- **Erro “service_worker não suportado”**: Firefox usa `background.scripts` (já aplicado).  
- **Cookies aparecendo 0**: recarregue a aba; no Firefox usamos `getAll({domain, storeId})`.  
- **Números acumulando ao trocar de site**: o background **zera métricas** ao detectar `changeInfo.url` (já aplicado).  
- **Nada acontece no popup**: após editar, use **Reload** da extensão em `about:debugging` e **F5** na aba.

---

## 11) Observações de Privacidade

O plugin roda **localmente**, não envia dados para terceiros e exibe apenas **agregados por aba**. As listas personalizadas ficam no `browser.storage.local` do usuário.
