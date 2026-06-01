# Desglose de tareas para Kanban

Estas tareas están escritas para que cualquier usuario asignado pueda entender el contexto sin conocer conversaciones previas.

## Épica 1 — Fundación del proyecto

### Tarea 1.1 — Verificar skeleton TypeScript

Objetivo: asegurar que el proyecto instala, compila y ejecuta la CLI mínima.

Archivos: `package.json`, `tsconfig.json`, `src/index.ts`.

Pasos:
1. Ejecutar `npm install`.
2. Ejecutar `npm run build`.
3. Ejecutar `npm run advisor -- --pairs SOLUSDC,BTCUSDC`.
4. Confirmar que el comando imprime un reporte aunque Binance no responda; en ese caso debe mostrar error controlado.

Criterios de aceptación:
- Build TypeScript sin errores.
- README actualizado si cambia algún comando.

### Tarea 1.2 — Añadir configuración tipada

Objetivo: crear módulo de configuración que lea env vars con defaults seguros.

Crear: `src/config.ts`.

Debe incluir:
- `TRADING_MODE`: paper/testnet/live, default paper.
- `BINANCE_ENV`: testnet/mainnet, default testnet.
- `ADVISOR_PAIRS`: lista de pares.
- thresholds de riesgo.

Criterios de aceptación:
- Modo live debe requerir variable explícita futura, no activarse por accidente.
- Tests unitarios para defaults y parsing de porcentajes.

## Épica 2 — Exchange y market data

### Tarea 2.1 — Crear interfaz ExchangeClient

Objetivo: definir contrato mínimo para clientes de exchange.

Crear: `src/exchange/exchange-client.ts`.

Métodos mínimos:
- `getTicker(symbol)`
- `getCandles(symbol, interval, limit)`
- `getExchangeInfo(symbol)`

Criterios de aceptación:
- Tipos exportados para ticker, candle e instrument filters.

### Tarea 2.2 — Implementar Binance public client

Objetivo: cliente público Binance sin claves privadas para advisor/backtest.

Crear: `src/exchange/binance-public-client.ts`.

Debe soportar:
- mainnet y testnet.
- `/api/v3/ticker/24hr`.
- `/api/v3/klines`.
- `/api/v3/exchangeInfo`.

Criterios de aceptación:
- Manejo de errores HTTP con mensajes claros.
- No imprime secretos.
- Test o fixture para normalización de respuesta.

### Tarea 2.3 — Implementar LOT_SIZE/stepSize helpers

Objetivo: evitar errores Binance -1013 por cantidades inválidas.

Crear: `src/exchange/filters.ts`.

Debe incluir:
- `roundToStepSize(value, stepSize)`.
- `floorToStepSize(value, stepSize)`.
- `assertMinNotional(qty, price, minNotional)`.

Criterios de aceptación:
- Tests para stepSize `1`, `0.1`, `0.001`.

## Épica 3 — Advisor de pares

### Tarea 3.1 — Calcular volatilidad realizada

Objetivo: medir si un par es útil para grid.

Crear: `src/market-data/volatility.ts`.

Entrada: candles OHLCV.
Salida: volatilidad porcentual, rango high/low y ATR simplificado.

Criterios de aceptación:
- No usa datos futuros en cálculos por candle.
- Tests con candles artificiales.

### Tarea 3.2 — Scoring de pares

Objetivo: asignar puntuación comparable por par.

Crear: `src/allocator/pair-scorer.ts`.

Factores iniciales:
- volatilidad útil positiva,
- volumen positivo,
- spread bajo positivo,
- penalización por exceso de rango,
- penalización por errores de datos.

Criterios de aceptación:
- El score debe venir acompañado de razones humanas.

### Tarea 3.3 — Capital allocator

Objetivo: convertir scores en pesos objetivo respetando límites.

Crear: `src/allocator/capital-allocator.ts`.

Reglas:
- Reserva USDC global 20-25% por defecto.
- Peso máximo por par 45% por defecto.
- No mover si desviación menor a 7%.
- Cambio máximo por ciclo 15%.

Criterios de aceptación:
- Tests de suma de pesos = 100%.
- Tests de max weight y reserve.

### Tarea 3.4 — Range advisor

Objetivo: sugerir rango inicial por par para grid.

Crear: `src/grid/range-advisor.ts`.

Reglas iniciales:
- Centro = precio actual.
- Ancho basado en volatilidad realizada.
- Mínimo de ancho configurable.
- Redondeo según tickSize futuro.

Criterios de aceptación:
- Rango siempre contiene precio actual.
- Explica por qué propone ese rango.

### Tarea 3.5 — Reporte advisor

Objetivo: unificar datos, score, capital y rango en un reporte.

Crear: `src/advisor/advisor-report.ts`.

Salida:
- JSON serializable.
- Resumen Markdown opcional.

Criterios de aceptación:
- CLI imprime tabla legible.
- Si un par falla, el reporte continúa con los demás.

## Épica 4 — Backtesting

### Tarea 4.1 — Modelo de grid simulado

Objetivo: simular fills de grid sobre candles sin mirar el futuro.

Crear: `src/backtest/grid-simulator.ts`.

Criterios de aceptación:
- Cada candle solo puede usar OHLC de esa candle en orden conservador documentado.
- Incluye fees y slippage configurables.

### Tarea 4.2 — Métricas de backtest

Crear: `src/backtest/metrics.ts`.

Métricas:
- PnL USDC.
- PnL %.
- Max drawdown.
- Profit factor.
- Fill count.
- Tiempo fuera de rango.

## Épica 5 — Ejecución Testnet futura

### Tarea 5.1 — Cliente privado Binance Testnet

Objetivo: añadir órdenes solo para testnet.

Debe incluir:
- createLimitOrder
- cancelOrder
- getOpenOrders
- getBalances

Criterios de aceptación:
- Nunca usa mainnet si `TRADING_MODE` no es live.
- Tests/mocks para firma HMAC.

### Tarea 5.2 — Reconciliación por bot

Objetivo: contabilidad separada por bot/par.

Debe modelar:
- capital_usdc
- capital_token
- realized_pnl
- unrealized_pnl
- total_base_bought/sold

Criterios de aceptación:
- Ningún bot puede gastar capital de otro bot.

### Tarea 5.3 — Kill switch y límites duros

Objetivo: cortar ejecución automática ante riesgo.

Reglas:
- Error rate alto.
- Drawdown alto.
- Balance inconsistente.
- Modo live no autorizado.

## Épica 6 — API/Dashboard futuro

### Tarea 6.1 — API REST de advisor

Endpoints:
- `GET /health`
- `GET /api/advisor/report`
- `POST /api/advisor/preview`

### Tarea 6.2 — Dashboard dedicado

Debe mostrar:
- pares, score, capital objetivo, rango sugerido, riesgo, acción recomendada.
- Botón aplicar solo cuando exista modo seguro.
