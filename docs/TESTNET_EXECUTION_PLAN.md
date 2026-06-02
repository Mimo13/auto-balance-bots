# Plan de Ejecución Binance Testnet

> **Estado:** Documento de diseño previo a implementación.
> **Objetivo:** Definir cómo se ejecutarán órdenes reales en Binance Spot Testnet antes de tocar mainnet.

---

## 1. Endpoints privados Binance

Todos los endpoints requieren firma HMAC-SHA256 y header `X-MBX-APIKEY`.

| Endpoint | Propósito | Peso (weight) |
|---|---|---|
| `POST /api/v3/order` | Crear orden limit | 1 |
| `DELETE /api/v3/order` | Cancelar orden por `symbol` + `orderId` | 1 |
| `GET /api/v3/openOrders?symbol=` | Órdenes abiertas de un par | 3 |
| `GET /api/v3/account` | Balances (free + locked) | 10 |
| `GET /api/v3/allOrders?symbol=&limit=` | Historial de órdenes | 10 |

**Límite de peso:** 1200 por minuto. Una ejecución típica (cancelar viejas + crear nuevas) consume ~8-12 weight. Seguro para ciclos de 5 min.

---

## 2. Firma HMAC

Se usará crypto nativo de Node.js, sin dependencias.

```
POST /api/v3/order
X-MBX-APIKEY: <api key>
Body: symbol=BTCUSDC&side=BUY&type=LIMIT&timeInForce=GTC
      &quantity=0.001&price=95000&timestamp=<ms>&recvWindow=5000
Firma: HMAC-SHA256(query_string, api_secret)
```

### Implementación en TypeScript

```typescript
import { createHmac } from 'node:crypto';

interface SignedRequest {
  path: string;
  method: 'GET' | 'POST' | 'DELETE';
  params: Record<string, string>;
}

function signRequest(req: SignedRequest, apiSecret: string): string {
  const query = new URLSearchParams({
    ...req.params,
    timestamp: String(Date.now()),
    recvWindow: '5000',
  }).toString();
  const signature = createHmac('sha256', apiSecret)
    .update(query)
    .digest('hex');
  return `${query}&signature=${signature}`;
}

async function privateApiCall<T>(
  baseUrl: string,
  req: SignedRequest,
  apiKey: string,
  apiSecret: string,
): Promise<T> {
  const query = signRequest(req, apiSecret);
  const url = `${baseUrl}${req.path}?${query}`;
  const resp = await fetch(url, {
    method: req.method,
    headers: { 'X-MBX-APIKEY': apiKey },
  });
  const json = await resp.json() as Record<string, unknown>;
  if (json.code !== undefined) {
    throw new Error(`Binance error ${json.code}: ${json.msg}`);
  }
  return json as T;
}
```

### Ubicación

Crear `src/exchange/binance-private-client.ts` que extienda o envuelva `BinancePublicClient` con los métodos firmados. NO mezclar con el cliente público.

---

## 3. Aislamiento de capital por bot

Cada par opera con su propio capital asignado. No hay un "pool global" que un bot pueda sobregirar.

### Modelo

```typescript
interface BotCapital {
  botId: string;
  symbol: string;
  allocatedUsdc: number;       // Capital asignado a este bot
  baseQty: number;             // Cantidad de token actual
  usdcReserved: number;        // USDC bloqueado en órdenes abiertas
  lastReconciledAt: number;    // Timestamp última reconciliación
}
```

### Reglas

- **Ningún bot puede gastar capital de otro bot.** Cada par tiene su propio límite `allocatedUsdc`.
- **Al crear órdenes**, se verifica `allocatedUsdc - usdcReserved >= orderTotal`.
- **Al cancelar/reemplazar**, se actualiza `usdcReserved`.
- **Al reconciliar**, se compara balance real vs esperado y se registra desviación.

### Ubicación

Crear `src/risk/bot-capital.ts` para el modelo y validaciones.

---

## 4. Reconciliación de balances

### Ciclo de reconciliación (ejecutar antes de cada ciclo de trading)

1. Llamar `GET /api/v3/account` → obtener balances reales.
2. Para cada bot activo:
   - Balance real = `free + locked` del par.
   - Balance esperado = `baseQty` del `BotCapital`.
   - Si desviación > 1% → alerta y pausar el bot.

### Métricas reconciliadas

| Campo | Origen |
|---|---|
| `usdc_total` | Balance real USDC (`free + locked`) |
| `usdc_reserved` | Suma de locked de todas las órdenes |
| `base_total` | Balance real del token base |
| `base_in_orders` | Suma de qty en órdenes abiertas |
| `expected_usdc` | `allocatedUsdc` - usdc invertido |
| `pnl_realized` | Diferencia acumulada entre buys/sells cerrados |

### Cuándo pausar

- Desviación > 1% en cualquier bot.
- Balance USDC global no coincide con suma de capitales asignados + reserva.
- Órdenes fantasma (en Binance pero no registradas en el sistema).

### Ubicación

Crear `src/risk/reconciliation.ts`.

---

## 5. Cancelación de órdenes

### Orden de cancelación: lejanas primero

Cuando se necesita reemplazar la grilla de un par, cancelar en este orden:

1. **Órdenes de compra más bajas** (lejanas del precio actual, con menor probabilidad de fill).
2. **Órdenes de venta más altas** (lejanas del precio actual).
3. **Órdenes cercanas** (las que podrían estar a punto de ejecutarse se cancelan al final para minimizar el impacto en la grilla activa).

Esto minimiza el tiempo en que la grilla está parcialmente cancelada. Si el precio se mueve rápido mientras cancelamos, las órdenes cercanas pueden ejecutarse favorablemente.

### Algoritmo

```typescript
async function cancelGridOrders(
  symbol: string,
  openOrders: Order[],
  currentPrice: number,
): Promise<void> {
  // Separar buys y sells
  const buys = openOrders.filter(o => o.side === 'BUY').sort((a, b) => a.price - b.price);
  const sells = openOrders.filter(o => o.side === 'SELL').sort((a, b) => b.price - a.price);

  // Cancelar lejanas primero
  for (const order of [...buys, ...sells]) {
    await cancelOrder(symbol, order.orderId);
  }
}
```

Las más lejanas tienen menor probabilidad de fill en el momento de cancelación, por lo que cancelarlas primero reduce el riesgo de fills no deseados durante el reemplazo de la grilla.

### Ubicación

Crear `src/exchange/grid-order-manager.ts`.

---

## 6. Kill-switches

### Niveles

| Nivel | Disparo | Acción | Recuperación |
|---|---|---|---|
| **Soft** | Desviación balance > 1% | Pausar solo ese bot | Manual tras reconciliar |
| **Soft** | 3 errores consecutivos al crear orden | Pausar solo ese par | Manual tras revisar |
| **Hard** | Error rate > 20% en últimos 10 intentos | Pausar TODOS los bots | `killSwitch.reset()` + revisión |
| **Hard** | Drawdown global > `RISK_MAX_DRAWDOWN_PCT` (30%) | Cancelar TODAS las órdenes abiertas | Solo manual |
| **Hard** | `TRADING_MODE=live` sin `LIVE_ENABLED=true` | No arrancar | Cambiar config |

### Implementación

```typescript
interface KillSwitchState {
  softPausedBots: Set<string>;
  hardPaused: boolean;
  consecutiveErrors: Map<string, number>;
  errorHistory: number[];  // últimos N resultados (1=éxito, 0=error)
  hardPausedAt?: number;
}

class KillSwitch {
  private state: KillSwitchState = {
    softPausedBots: new Set(),
    hardPaused: false,
    consecutiveErrors: new Map(),
    errorHistory: [],
  };

  recordResult(botId: string, success: boolean): 'ok' | 'soft_pause' | 'hard_pause' {
    this.state.errorHistory.push(success ? 1 : 0);
    if (this.state.errorHistory.length > 10) this.state.errorHistory.shift();

    if (success) {
      this.state.consecutiveErrors.set(botId, 0);
      return 'ok';
    }

    const errs = (this.state.consecutiveErrors.get(botId) ?? 0) + 1;
    this.state.consecutiveErrors.set(botId, errs);

    if (errs >= 3) {
      this.state.softPausedBots.add(botId);
      return 'soft_pause';
    }

    const recentErrors = this.state.errorHistory.filter(v => v === 0).length;
    if (recentErrors >= 2) {  // 20% error rate
      this.state.hardPaused = true;
      this.state.hardPausedAt = Date.now();
      return 'hard_pause';
    }

    return 'ok';
  }

  isPaused(botId: string): boolean {
    return this.state.hardPaused || this.state.softPausedBots.has(botId);
  }

  reset(): void {
    this.state = {
      softPausedBots: new Set(),
      hardPaused: false,
      consecutiveErrors: new Map(),
      errorHistory: [],
    };
  }
}
```

### Ubicación

Crear `src/risk/kill-switch.ts`.

---

## 7. Variables de entorno requeridas

```env
# Modo de trading (paper | testnet | live)
TRADING_MODE=testnet

# Binance Testnet API credentials
BINANCE_TESTNET_API_KEY=your_testnet_api_key
BINANCE_TESTNET_SECRET_KEY=your_testnet_secret_key

# Binance Mainnet credentials (solo si TRADING_MODE=live)
BINANCE_LIVE_API_KEY=
BINANCE_LIVE_SECRET_KEY=

# Para desbloquear modo live (safety gate doble)
LIVE_ENABLED=false

# Red de Binance para datos públicos (testnet | mainnet)
BINANCE_ENV=testnet

# Pares supervisados
ADVISOR_PAIRS=SOLUSDC,BTCUSDC,ETHUSDC,XLMUSDC

# Límites de riesgo
RISK_MAX_DRAWDOWN_PCT=0.30
```

### Regla de seguridad

```typescript
// En loadConfig — NUNCA arrancar en live sin LIVE_ENABLED=true
if (tradingMode === 'live' && !liveEnabled) {
  throw new Error(
    'TRADING_MODE=live requires LIVE_ENABLED=true. Refusing to start in live mode.'
  );
}
```

---

## 8. NO hacer (reglas que el sistema debe reforzar)

1. **No ejecutar live por defecto.** El modo por defecto es `paper`. `TRADING_MODE=live` requiere `LIVE_ENABLED=true` explícito.
2. **No usar capital global como pool compartido.** Cada bot tiene `allocatedUsdc` y no puede excederlo.
3. **No cambiar cantidad por nivel silenciosamente en caliente.** Cualquier cambio a la grilla debe loggear el antes/después.
4. **No saltarse el preview.** Cada acción automática debe tener preview previo (el advisor genera un plan, no lo ejecuta sin revisión).
5. **No ignorar errores de Binance.** Códigos `-2015` (no autorizado) y `-1021` (timestamp fuera de ventana) detienen el bot inmediatamente.
6. **No mezclar claves mainnet y testnet.** El cliente privado usa la red según `BINANCE_ENV` independientemente del `TRADING_MODE`.

---

## 9. Orden de implementación

| Paso | Archivo | Depende de |
|---|---|---|
| 1 | `src/exchange/binance-private-client.ts` | exchange-client.ts |
| 2 | `src/risk/bot-capital.ts` | types.ts |
| 3 | `src/risk/reconciliation.ts` | bot-capital.ts, private-client |
| 4 | `src/exchange/grid-order-manager.ts` | private-client, bot-capital |
| 5 | `src/risk/kill-switch.ts` | — (independiente) |
| 6 | `src/worker/execution-worker.ts` | todos los anteriores |
| 7 | Tests de integración | todos los anteriores |

Cada paso incluye TDD estricto: test → fail → implement → pass.

---

## 10. Arquitectura final (Fase 3)

```text
src/
  exchange/
    exchange-client.ts         ← interfaz
    binance-public-client.ts   ← datos públicos (sin clave)
    binance-private-client.ts  ← órdenes firmadas (HMAC)
    grid-order-manager.ts      ← cancelación y reemplazo de grillas
    filters.ts                 ← roundToStepSize, assertMinNotional
  risk/
    bot-capital.ts             ← aislamiento de capital por bot
    reconciliation.ts          ← comparación balance real vs esperado
    kill-switch.ts             ← cortes automáticos
  worker/
    execution-worker.ts        ← ciclo de ejecución testnet
```

---

## Checklist de autorización para Testnet

- [ ] Cliente privado implementado y probado (HMAC funciona contra testnet).
- [ ] Aislamiento de capital: ningún bot puede usar fondos de otro.
- [ ] Reconciliación ejecutada antes de cada ciclo (desviación > 1% → pausa).
- [ ] Cancelación de órdenes siempre lejanas primero.
- [ ] Kill-switch soft (3 errores consecutivos) y hard (20% error rate) implementados.
- [ ] Preview obligatorio antes de ejecutar plan.
- [ ] Logging completo de cada orden (crear, cancelar, fill, error).
- [ ] Modo paper y testnet verificados con 0 órdenes reales en mainnet.
- [ ] Modo live bloqueado por `LIVE_ENABLED=false`.
- [ ] Documento de operación (este plan) actualizado.
