# auto-balance-bots

Nuevo proyecto limpio para investigar y construir bots de trading cripto con auto-balanceo entre pares y auto-ajuste de rangos por bot.

El objetivo es reutilizar aprendizajes y piezas probadas de `grvt-binance-bots` sin ensuciar ese repositorio. Este proyecto nace como laboratorio limpio para Binance Spot/Testnet, paper trading, backtesting y posterior ejecución limitada.

## Principios

- Primero paper/testnet; live queda bloqueado hasta validación explícita.
- Rebalanceo por umbral, no por impulsos ni por reloj fijo.
- Capital aislado por bot/par: USDC y token base se contabilizan por estrategia.
- Cancelar órdenes lejanas primero; nunca cancelar niveles cercanos si hay alternativa.
- Cada decisión debe ser auditable con explicación, métricas y log JSONL.
- Backtesting sin look-ahead bias antes de confiar en resultados.

## MVP inicial

1. Advisor sin ejecución: calcula score por par, rango sugerido y capital objetivo.
2. Simulador/backtester de grid sobre candles OHLCV.
3. Ejecución Binance Testnet con límites duros.
4. Auto-balanceo entre pares y rangos en modo semi-autónomo.

## Comandos

```bash
npm install
npm run advisor -- --pairs SOLUSDC,BTCUSDC,ETHUSDC,XLMUSDC
npm run advisor -- --pairs SOLUSDC,BTCUSDC --format json
npm run advisor -- --pairs SOLUSDC --format md
npm run build
```

## API REST

Advisor también expone API REST (sin auth, solo local):

```bash
# Arrancar servidor (puerto por defecto 3141)
npm run api

# Endpoints
curl http://localhost:3141/health
curl http://localhost:3141/api/advisor/report
curl -X POST http://localhost:3141/api/advisor/preview \
  -H 'Content-Type: application/json' \
  -d '{"pairs":["BTCUSDC","ETHUSDC"],"capital":500}'
```

Puerto configurable via `API_PORT` env var. Sin dependencias externas (usa `node:http`).

## Documentación

- `docs/PROJECT_BRIEF.md` — visión funcional para cualquier usuario asignado.
- `docs/ARCHITECTURE.md` — arquitectura técnica inicial.
- `docs/ROADMAP.md` — fases y entregables.
- `docs/TASK_BREAKDOWN.md` — tareas detalladas para Kanban/GitHub issues.
- `docs/DECISIONS.md` — decisiones de diseño ya tomadas.
