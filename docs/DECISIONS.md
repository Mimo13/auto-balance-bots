# Decisiones iniciales

## 2026-06-02 — Proyecto nuevo

Se crea `auto-balance-bots` como proyecto limpio. No se desarrollará encima de `grvt-binance-bots` para evitar ensuciar un sistema que ya funciona.

## 2026-06-02 — TypeScript primero

Se usa TypeScript/Node para poder reutilizar código y patrones del proyecto actual.

## 2026-06-02 — Advisor antes que ejecución

La primera entrega no creará órdenes. Solo recomendará. La ejecución automática se posterga hasta tener métricas, testnet, logs y kill-switch.

## 2026-06-02 — Binance Spot/Testnet como primer exchange

El primer adaptador será Binance Spot/Testnet con pares USDC. GRVT queda fuera del MVP para reducir acoplamiento.
