# Roadmap

## Fase 0 — Arranque limpio

- Crear repo nuevo.
- Documentar objetivo, arquitectura y tareas.
- Inicializar TypeScript.
- Crear CLI mínima.
- Sin ejecución de órdenes.

## Fase 1 — Advisor sin ejecución

- Cliente público Binance.
- Descarga de tickers/candles.
- Métricas básicas de volatilidad.
- Scoring por par.
- Rango recomendado por par.
- Capital objetivo por par.
- Reporte JSON y Markdown.

## Fase 2 — Backtester/simulador

- Cargar OHLCV histórico.
- Simular grid sin look-ahead bias.
- Métricas PnL, MaxDD, fill rate, capital efficiency.
- Comparar rangos y pares.

## Fase 3 — Testnet execution

- Cliente privado Binance Testnet.
- Gestión de órdenes limit.
- Reconciliación de balances por bot.
- Activity log JSONL.
- Kill-switch.

## Fase 4 — Auto-balanceo limitado

- Auto-shift y auto-resize de rangos.
- Movimiento de capital entre bots con límites.
- Cooldowns y thresholds.
- Alertas Telegram.

## Fase 5 — Dashboard/API

- API REST.
- Dashboard dedicado.
- Historial de decisiones.
- Botones de aplicar/revertir plan.
