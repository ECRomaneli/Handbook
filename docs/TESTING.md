# Testes — Handbook

Documentação sobre a infraestrutura de testes do projeto, desafios enfrentados durante a implementação, guia para criação de novos testes e pontos de atenção.

---

## Sumário

- [Visão geral](#visão-geral)
- [Estrutura de arquivos](#estrutura-de-arquivos)
- [Comandos](#comandos)
- [Testes unitários (Vitest)](#testes-unitários-vitest)
  - [Mock do Electron](#mock-do-electron)
  - [Anatomia de um teste unitário](#anatomia-de-um-teste-unitário)
- [Testes E2E (Playwright)](#testes-e2e-playwright)
  - [Arquitetura: Test Bridge](#arquitetura-test-bridge)
  - [Ciclo de vida de um teste E2E](#ciclo-de-vida-de-um-teste-e2e)
  - [Helpers compartilhados](#helpers-compartilhados)
- [Desafios enfrentados](#desafios-enfrentados)
- [Como criar novos testes](#como-criar-novos-testes)
  - [Novo teste unitário](#novo-teste-unitário)
  - [Novo teste E2E](#novo-teste-e2e)
- [Pontos de atenção](#pontos-de-atenção)

---

## Visão geral

| Camada | Framework | Escopo | Quantidade |
|---|---|---|---|
| Unitária / Lógica | **Vitest 4.x** | Propagators, utilitários, lógica pura do main process | 4 |
| E2E / Integração | **Playwright 1.58** (`_electron.launch`) | Bootstrap, Frame, IPC, Tray, State | 12 |

Os testes unitários rodam em ambiente Node com mocks do Electron. Os testes E2E iniciam uma instância real do Electron e interagem via Chrome DevTools Protocol (CDP).

---

## Estrutura de arquivos

```
tests/
├── setup/
│   └── electron-mock.ts          # Mocks compartilhados (BaseWindow, app, ipcMain…)
├── unit/
│   └── FramePropagator.spec.ts   # Testes unitários dos Propagators
└── e2e/
    ├── global-setup.ts           # Build único antes da suite (npm run build:dev)
    ├── helpers/
    │   └── launch.ts             # launchApp(), seedTestPage(), waitForBridge()
    ├── lifecycle.spec.ts         # Phase 2 — Bootstrap & Frame Assembly
    ├── ipc-orchestration.spec.ts # Phase 3 — IPC via Propagators
    └── tray-state.spec.ts        # Phase 4 — Tray & StatePropagator

vitest.config.ts                  # Config Vitest (exclui tests/e2e/**)
playwright.config.ts              # Config Playwright (testDir: tests/e2e)
```

---

## Comandos

```bash
# Todos os testes unitários
npm test

# Apenas unitários (explícito)
npm run test:unit

# Unitários em watch mode
npm run test:watch

# Todos os testes E2E (faz build automaticamente via globalSetup)
npm run test:e2e

# E2E de um único arquivo
npx playwright test tests/e2e/lifecycle.spec.ts --config playwright.config.ts

# E2E de um único test (por linha)
npx playwright test tests/e2e/tray-state.spec.ts:26 --config playwright.config.ts
```

---

## Testes unitários (Vitest)

### Mock do Electron

O arquivo `tests/setup/electron-mock.ts` substitui o módulo `electron` inteiro via `vi.mock('electron', ...)`. As classes principais são reimplementadas sobre `EventEmitter`:

| Classe/Objeto mock | O que simula |
|---|---|
| `MockBaseWindow` | `BaseWindow` — com `show()`, `hide()`, `focus()`, `isDestroyed()`, `contentView` |
| `MockWebContentsView` | `WebContentsView` — possui `webContents` interno |
| `MockWebContents` | `WebContents` — `send()`, `isDestroyed()`, `destroy()` |
| `mockIpcMain` | `ipcMain` — `on()`, `handle()`, `removeAllListeners()` |
| `mockApp` | `app` — `whenReady()`, `quit()`, `getAppPath()`, herda `EventEmitter` |

Todos os mocks são automaticamente limpos entre testes (`clearMocks: true`, `restoreMocks: true`).

### Anatomia de um teste unitário

```ts
import { BaseWindow } from 'electron';            // Na verdade é MockBaseWindow
import { FramePropagator } from '@/propagator/FramePropagator';

it('routes frame lifecycle events', () => {
  const propagator = new FramePropagator();        // Instância nova (sem singleton)
  const frame = new BaseWindow();                  // Mock com EventEmitter

  const listener = vi.fn();
  propagator.on('show', listener);
  propagator.propagate(frame);                     // Registra os handlers

  frame.emit('show');                              // Simula evento nativo
  expect(listener).toHaveBeenCalledTimes(1);
});
```

> **Importante:** nos testes unitários, instanciamos classes diretamente (ex: `new FramePropagator()`) ao invés de usar os singletons exportados por padrão. Isso garante isolamento entre testes.

---

## Testes E2E (Playwright)

### Arquitetura: Test Bridge

O Handbook usa `BaseWindow` + `WebContentsView` (sem `BrowserWindow`), e todo o estado vive em singletons do main process. O Playwright `electronApp.evaluate()` roda callbacks no processo main via CDP, mas **não tem acesso ao `require()` do webpack bundle** — apenas ao `globalThis` do processo Node.

Para resolver isso, quando a variável de ambiente `HANDBOOK_E2E=1` está ativa, o `Bootstrap.initialize()` expõe os singletons no `globalThis`:

```ts
// src/Bootstrap.ts
private exposeTestBridge() {
  if (!process.env.HANDBOOK_E2E) { return; }
  (globalThis as Record<string, unknown>).__handbook = {
    AppState, FrameService, PageService, ViewService,
    NavbarPropagator, ViewPropagator, PreferencesPropagator,
    TrayPropagator, StatePropagator, Storage,
  };
}
```

Dentro dos testes, acessamos via:

```ts
await app.evaluate(async () => {
  const hb = (globalThis as any).__handbook;
  const frame = hb.FrameService.getFrame();
  // ...
});
```

### Ciclo de vida de um teste E2E

```
1. globalSetup      →  npm run build:dev (uma vez)
2. beforeAll        →  launchApp()       →  _electron.launch() com user-data-dir temporário
                    →  seedTestPage()    →  waitForBridge() + injeta página de teste
3. test()           →  app.evaluate()    →  interage com singletons via __handbook
4. afterAll         →  app.close()       →  encerra o processo Electron
```

### Helpers compartilhados

**`launchApp()`** — Inicia o Electron com:
- `--no-sandbox` — evita problemas de sandbox em CI
- `--user-data-dir=<tmp>` — diretório temporário único por suite, evita colisão com o single-instance lock de instâncias em execução
- `HANDBOOK_E2E=1` — ativa o test bridge e desabilita `setupAutoLaunch()` (que abre um dialog modal)

**`waitForBridge(app)`** — Faz polling a cada 100ms até `globalThis.__handbook` existir (timeout de 10s). Necessário porque `_electron.launch()` pode resolver antes de `Bootstrap.initialize()` completar.

**`seedTestPage(app)`** — Injeta uma página de teste (`data:text/html,...`) no Storage e chama `PageService.updatePages()` + `setupOrTogglePage()` para criar o Frame e a View. Sem isso, o app inicia apenas com o Tray (perfil vazio).

---

## Desafios enfrentados

### 1. Single-instance lock

O Handbook chama `app.requestSingleInstanceLock()` na inicialização. Se o desenvolvedor já tem uma instância aberta, o lock falha e o processo de teste encerra silenciosamente.

**Solução:** cada execução de teste usa `--user-data-dir` com `mkdtempSync()`, criando um perfil isolado que tem seu próprio lock file.

### 2. `require()` indisponível no `evaluate()`

O `electronApp.evaluate()` do Playwright executa via CDP (Chrome DevTools Protocol), num contexto onde o `require()` do Node não está disponível para acessar módulos do webpack bundle.

**Solução:** o padrão **Test Bridge** — `Bootstrap.exposeTestBridge()` coloca todos os singletons necessários em `globalThis.__handbook`, acessível por qualquer `evaluate()`.

### 3. Race condition no bootstrap

O `_electron.launch()` resolve assim que o Playwright conecta ao Chrome DevTools, *antes* do `app.whenReady().then(...)` executar `Bootstrap.initialize()`. Qualquer `evaluate()` imediato encontra `__handbook` como `undefined`.

**Solução:** `waitForBridge()` faz polling com `evaluate(() => !!globalThis.__handbook)` a cada 100ms antes de prosseguir.

### 4. Validação de URL nas páginas

O modelo `Page` exige que a URL contenha `://` ou comece com `data:`. URLs como `about:blank` são consideradas inválidas e o `PageService.updatePages()` descarta a página silenciosamente.

**Solução:** a página de teste usa `data:text/html,<h1>E2E</h1>` como URL.

### 5. `setupAutoLaunch()` abre dialog modal

Em perfis novos (como os temporários dos testes), o `ApplicationService.setupAutoLaunch()` pode abrir um `Dialog.confirm()` que ninguém interage, travando o processo.

**Solução:** guard no início do método:
```ts
if (process.env.HANDBOOK_E2E) { return; }
```

### 6. Eventos nativos do macOS e timing

Chamadas como `frame.show()` / `frame.hide()` emitem eventos nativos do OS que podem não ser imediatos. Testes que dependem desses eventos precisam de `setTimeout` com margem suficiente (200–300ms).

Além disso, testes anteriores na mesma suite podem alterar a visibilidade do frame. Se um teste depende de um estado inicial específico, ele deve **garantir esse estado explicitamente** antes de registrar listeners.

### 7. Resolução de `__dirname` no helper

O arquivo `tests/e2e/helpers/launch.ts` precisa resolver o path da raiz do projeto. Como `__dirname` aponta para `tests/e2e/helpers/`, é necessário subir **3 níveis** (`../../..`), não 2.

---

## Como criar novos testes

### Novo teste unitário

1. Crie o arquivo em `tests/unit/NomeDoModulo.spec.ts`
2. Importe a classe **não-singleton** (ex: `import { FramePropagator } from '@/propagator/FramePropagator'`)
3. Use os mocks de `electron` já disponíveis via setup file
4. Se precisar de novos mocks do Electron, adicione em `tests/setup/electron-mock.ts`

```ts
import { describe, it, expect, vi } from 'vitest';
import { MinhaClasse } from '@/caminho/MinhaClasse';

describe('MinhaClasse', () => {
  it('faz algo esperado', () => {
    const instancia = new MinhaClasse();
    // ...
    expect(instancia.resultado).toBe(valorEsperado);
  });
});
```

> Use `vi.useFakeTimers()` para testar debounce/throttle. Lembre de `vi.useRealTimers()` no `afterEach`.

### Novo teste E2E

1. Crie o arquivo em `tests/e2e/meu-teste.spec.ts`
2. Use o boilerplate padrão:

```ts
import { ElectronApplication, expect, test } from '@playwright/test';
import { launchApp, seedTestPage } from './helpers/launch';

let app: ElectronApplication;

test.beforeAll(async () => {
  app = await launchApp();
  await seedTestPage(app);
});
test.afterAll(async () => { await app?.close(); });

test.describe('Minha Feature', () => {
  test('descrição do comportamento', async () => {
    const result = await app.evaluate(async () => {
      const hb = (globalThis as any).__handbook;
      // Interaja com os singletons...
      return { /* dados serializáveis */ };
    });

    expect(result.algumaCoisa).toBe(valorEsperado);
  });
});
```

3. Se o teste precisa de um singleton que não está no bridge, adicione-o em `Bootstrap.exposeTestBridge()`

4. Se o teste precisa aguardar um evento assíncrono/nativo, use `setTimeout` com margem:
```ts
await new Promise((r) => setTimeout(r, 200));
```

---

## Pontos de atenção

### Serialização no `evaluate()`

O `evaluate()` serializa o valor de retorno via JSON. Isso significa:
- **Não retorne** objetos com referências circulares, funções, ou instâncias de classe
- **Retorne** apenas objetos planos, arrays, primitivos
- `typeof algumaInstancia` pode retornar `"undefined"` — use propriedades específicas para verificações

### Estado compartilhado entre testes

Testes E2E na mesma suite (`describe`) compartilham a mesma instância do Electron. Ações de um teste (ex: esconder o frame) afetam os seguintes. **Sempre garanta o estado inicial necessário** no começo de cada teste.

### Cada spec file = um processo Electron

Cada arquivo `.spec.ts` faz seu próprio `launchApp()` / `app.close()`. O Playwright roda com `workers: 1` (serial), então não há paralelismo, mas os processos são independentes entre arquivos.

### Build automático no E2E

O `globalSetup` roda `npm run build:dev` antes de todos os testes E2E. Isso inclui `rimraf dist` — se você precisa do `dist/` após rodar E2E, faça um novo build.

### Variável `HANDBOOK_E2E`

Esta variável de ambiente controla dois comportamentos no código da aplicação:
1. **`Bootstrap.exposeTestBridge()`** — expõe singletons no `globalThis`
2. **`ApplicationService.setupAutoLaunch()`** — pula completamente (evita dialog modal)

Qualquer novo comportamento que precise ser desabilitado em testes pode usar a mesma variável como guard.

### CI / Headless

Em ambientes headless (CI), pode ser necessário:
- Usar `xvfb-run` no Linux para emular display
- Garantir que o Electron consegue criar um Tray (pode falhar sem display)
- O `--no-sandbox` já é passado pelo helper

### Não use singletons nos testes unitários

Os singletons (`export default new Classe()`) carregam estado entre testes. Sempre instancie a classe diretamente:
```ts
// ✅ Correto
import { FramePropagator } from '@/propagator/FramePropagator';
const propagator = new FramePropagator();

// ❌ Evitar (singleton preserva estado)
import FramePropagator from '@/propagator/FramePropagator';
```

### Timeouts

| Contexto | Valor | Onde configurar |
|---|---|---|
| `_electron.launch()` | 30s | `helpers/launch.ts` |
| `waitForBridge()` | 10s | `helpers/launch.ts` |
| Cada teste Playwright | 60s | `playwright.config.ts` → `timeout` |
| Vitest (global) | 5s (padrão) | `vitest.config.ts` → `test.testTimeout` |
