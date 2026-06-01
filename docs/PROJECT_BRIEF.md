# Project Brief — auto-balance-bots

## Qué estamos construyendo

Un sistema de bots de trading cripto que pueda balancearse automáticamente en dos niveles:

1. **Entre pares**: decidir cuánto capital USDC asignar a cada par/bot, por ejemplo SOLUSDC, BTCUSDC, ETHUSDC o XLMUSDC.
2. **Dentro de cada bot**: decidir si el rango del grid debe mantenerse, recentrarse, ensancharse, estrecharse o pausarse.

## Por qué proyecto nuevo

El repositorio `grvt-binance-bots` ya contiene lógica viva y útil, pero también mucho acoplamiento histórico: GRVT, Binance, dashboard, multiusuario, migraciones y fixes de producción. Este proyecto debe nacer limpio para experimentar sin romper lo existente.

## Qué se puede reutilizar

Reutilizar/adaptar de `grvt-binance-bots` solo piezas probadas:

- Cliente Binance Spot/Testnet.
- Helpers de símbolo y LOT_SIZE/stepSize.
- Ideas de `capital_usdc` y `capital_token`.
- Cálculo de grid y rango.
- Activity logs JSONL.
- Regla operativa de cancelar órdenes lejanas primero.

No copiar inicialmente:

- Dashboard completo.
- GRVT.
- Auth multiusuario.
- DB completa antigua.
- Engine completo si está demasiado acoplado.

## Usuario objetivo

Un operador que quiere ver recomendaciones claras y auditables antes de permitir ejecución automática. Cualquier tarea debe explicar:

- Qué cambia.
- Qué archivo tocar.
- Cómo probarlo.
- Qué riesgo evita.
- Qué salida esperada debe ver.

## Éxito del MVP

El MVP será correcto cuando pueda ejecutar un comando advisor que produzca un reporte como:

- Pares analizados.
- Precio actual.
- Volatilidad estimada.
- Score por par.
- Rango recomendado.
- Peso/capital recomendado.
- Motivo humano de cada recomendación.
- Advertencias de riesgo.

Sin enviar órdenes reales.
