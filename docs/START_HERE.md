# START HERE — auto-balance-bots

Este documento consolida la información inicial del proyecto para que cualquier usuario o agente asignado pueda entender rápidamente qué se ha creado, dónde está, cómo validarlo y cuál es el plan.

## 1. Identificación del proyecto

Nombre del proyecto:

`auto-balance-bots`

Ruta local:

`/root/proyectos/auto-balance-bots`

Repositorio GitHub:

https://github.com/Mimo13/auto-balance-bots

Rama principal:

`main`

Board Hermes Kanban:

`auto-balance-bots`

Workdir Kanban por defecto:

`/root/proyectos/auto-balance-bots`

## 2. Motivo del proyecto

El objetivo es crear un proyecto nuevo y limpio para bots de trading cripto con auto-balanceo, sin ensuciar ni acoplar más el repositorio existente `grvt-binance-bots`.

El repo anterior puede servir como fuente de código probado y aprendizajes, pero este proyecto debe evolucionar de forma independiente.

## 3. Qué se quiere construir

Un sistema de bots de trading cripto que se auto-balancee en dos niveles:

1. Entre pares:
   - decidir cuánto capital USDC asignar a cada par/bot;
   - comparar SOLUSDC, BTCUSDC, ETHUSDC, XLMUSDC u otros pares;
   - mover capital solo cuando haya una desviación relevante y con límites duros.

2. Dentro de cada bot/rango:
   - mantener, recentrar, ensanchar o estrechar el rango del grid;
   - pausar bots si el riesgo aumenta;
   - evitar cambios peligrosos cuando haya fills pendientes o estado inconsistente.

## 4. Principios no negociables

- No tocar ni ensuciar `grvt-binance-bots` salvo instrucción explícita.
- Primero advisor/paper/testnet; live queda bloqueado.
- No ejecutar órdenes reales en el MVP inicial.
- Rebalanceo por umbral, no por impulsos.
- Mantener reserva USDC global.
- Respetar peso máximo por par.
- Capital aislado por bot/par.
- Nunca cambiar cantidad por nivel silenciosamente en caliente.
- Cancelar órdenes lejanas primero.
- Nunca cancelar órdenes cercanas si hay alternativa.
- Toda decisión automática debe tener explicación humana y log JSONL.
- Backtesting sin look-ahead bias antes de confiar en resultados.

## 5. Qué se puede reutilizar de grvt-binance-bots

Reutilizar/adaptar selectivamente:

- Cliente Binance Spot/Testnet.
- Normalización de símbolos.
- Helpers LOT_SIZE / stepSize / minNotional.
- Ideas de `capital_usdc` y `capital_token`.
- Cálculo de grid/rango.
- Activity logs JSONL.
- Reglas de cancelación segura de órdenes.

No copiar inicialmente:

- Dashboard completo.
- GRVT.
- Auth multiusuario.
- DB completa antigua.
- Engine completo si está demasiado acoplado.

## 6. Estado técnico inicial

Stack inicial:

- TypeScript
- Node.js
- npm
- Binance public API/testnet
- CLI simple de advisor

Archivos principales creados:

- `README.md`
- `LICENSE`
- `package.json`
- `tsconfig.json`
- `.env.example`
- `src/index.ts`
- `src/types.ts`
- `src/exchange/binance-public-client.ts`
- `src/advisor/simple-advisor.ts`
- `docs/PROJECT_BRIEF.md`
- `docs/ARCHITECTURE.md`
- `docs/ROADMAP.md`
- `docs/TASK_BREAKDOWN.md`
- `docs/DECISIONS.md`
- `docs/KANBAN.md`
- `docs/START_HERE.md`

## 7. Comandos básicos

Instalar dependencias:

```bash
npm install
```

Compilar:

```bash
npm run build
```

Ejecutar advisor inicial:

```bash
npm run advisor -- --pairs SOLUSDC,BTCUSDC,ETHUSDC,XLMUSDC
```

Ver Kanban:

```bash
hermes kanban boards switch auto-balance-bots
hermes kanban list
```

## 8. Validación ya realizada

Se ejecutó:

```bash
npm install
npm run build
npm run advisor -- --pairs SOLUSDC,BTCUSDC,ETHUSDC,XLMUSDC
```

Resultado:

- `npm install` OK.
- `npm run build` OK.
- Advisor funcionando contra Binance testnet.
- No crea órdenes.
- Solo genera recomendaciones iniciales.

Salida resumida observada:

```text
SOLUSDC     true 80.87          score 68.24  target 17.7%
BTCUSDC     true 71234.42       score 85     target 22.05%
ETHUSDC     true 1999.07        score 58.85  target 15.26%
XLMUSDC     true 0.2405         score 77.09  target 19.99%
```

## 9. Roadmap resumido

Fase 0 — Arranque limpio:

- repo nuevo;
- docs iniciales;
- TypeScript;
- CLI mínima;
- sin ejecución de órdenes.

Fase 1 — Advisor sin ejecución:

- cliente público Binance;
- tickers/candles;
- volatilidad;
- scoring;
- rangos sugeridos;
- capital objetivo;
- reportes JSON/Markdown.

Fase 2 — Backtester/simulador:

- OHLCV histórico;
- grid simulation sin look-ahead bias;
- métricas PnL, MaxDD, fill rate, capital efficiency.

Fase 3 — Binance Testnet execution:

- cliente privado testnet;
- órdenes limit;
- reconciliación de balances;
- activity logs;
- kill-switch.

Fase 4 — Auto-balanceo limitado:

- auto-shift/auto-resize;
- movimiento de capital entre pares;
- cooldowns;
- thresholds;
- alertas.

Fase 5 — API/Dashboard:

- API REST;
- dashboard dedicado;
- historial de decisiones;
- preview/apply/revert.

## 10. Tareas Kanban iniciales

Board:

`auto-balance-bots`

Tareas creadas:

- `t_1c9d0f20` — 00 · Leer primero: contexto y reglas del proyecto
- `t_abd4ea70` — 01 · Validar arranque del skeleton TypeScript
- `t_0c1945c6` — 02 · Crear configuración tipada y segura
- `t_04974230` — 03 · Definir interfaz ExchangeClient
- `t_08f9b225` — 04 · Implementar candles y exchangeInfo en BinancePublicClient
- `t_f7110dbe` — 05 · Añadir helpers Binance LOT_SIZE, tickSize y minNotional
- `t_b04a637c` — 06 · Volatilidad realizada y ATR simplificado
- `t_8cb6cdf6` — 07 · Pair scorer con razones humanas
- `t_3edeb4c4` — 08 · Capital allocator por umbral
- `t_f6997315` — 09 · Range advisor: sugerir rangos de grid
- `t_861caaca` — 10 · Advisor report JSON y Markdown
- `t_de91001c` — 11 · Diseñar storage SQLite y migraciones iniciales
- `t_7f5f4768` — 12 · Backtester: modelo de grid sin look-ahead bias
- `t_73199364` — 13 · Métricas de backtest y evaluación
- `t_91800b48` — 14 · Activity log JSONL
- `t_49371dbc` — 15 · Plan de ejecución Binance Testnet futura
- `t_58ce3d7e` — 16 · API REST futura para advisor
- `t_f36ae644` — 17 · Dashboard futuro dedicado
- `t_5244b9ed` — 18 · Sincronizar issues GitHub desde Kanban si se decide

El detalle completo está en:

`docs/TASK_BREAKDOWN.md`

La lista de IDs está en:

`docs/KANBAN.md`

## 11. Documentos del proyecto

Leer en este orden:

1. `docs/START_HERE.md`
2. `docs/PROJECT_BRIEF.md`
3. `docs/ARCHITECTURE.md`
4. `docs/ROADMAP.md`
5. `docs/TASK_BREAKDOWN.md`
6. `docs/DECISIONS.md`
7. `docs/KANBAN.md`

## 12. Estado Git

Repositorio remoto:

`https://github.com/Mimo13/auto-balance-bots`

Commits iniciales realizados:

- `0305dea` — `chore: bootstrap auto-balance-bots`
- `3a01515` — `docs: record kanban board tasks`

Este documento debe commitearse después de su creación.
