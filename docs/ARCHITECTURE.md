# Arquitectura inicial

## Capas

```text
src/
  exchange/        Clientes de exchange y normalización de instrumentos
  market-data/     Tickers, candles, volatilidad y liquidez
  grid/            Modelos de grid, rango y planes de órdenes
  allocator/       Scoring de pares y asignación de capital
  risk/            Límites, drawdown guard, kill-switch
  advisor/         Reporte unificado de recomendaciones
  backtest/        Simulación sin look-ahead bias
  storage/         SQLite, migraciones y repositorios
  worker/          Scheduler/autobalance loop
  api/             API REST futura
  cli/             CLI para advisor/backtest/run
```

## Flujo del Advisor

1. Cargar universo de pares.
2. Descargar ticker y candles recientes.
3. Calcular métricas por par:
   - precio actual,
   - volatilidad realizada,
   - rango sugerido,
   - score bruto,
   - penalizaciones por riesgo.
4. Convertir scores en pesos objetivo.
5. Aplicar límites de riesgo:
   - reserva USDC global,
   - peso máximo por par,
   - cambio máximo por ciclo,
   - umbral mínimo de rebalanceo.
6. Emitir reporte auditable.

## Modos

- `paper`: no usa claves privadas ni crea órdenes.
- `testnet`: puede usar Binance Spot Testnet con límites.
- `live`: bloqueado hasta que exista kill-switch, reconciliación y aprobación explícita.

## Reglas de seguridad no negociables

- Nunca ejecutar live por defecto.
- Nunca mover capital si hay estado inconsistente.
- Nunca cancelar órdenes cercanas antes de órdenes lejanas si hay alternativa.
- Nunca cambiar cantidad por nivel silenciosamente en caliente.
- Cada acción automática debe tener preview previo y log persistente.
