# Plan del Dashboard Dedicado

> **Estado:** Diseño previo a implementación.
> **Objetivo:** Definir wireframe textual, componentes y API necesarios para construir un frontend standalone que consuma la API REST de advisor.

---

## 1. Stack propuesto

| Capa | Tecnología | Razón |
|---|---|---|
| Framework | React 18 + Vite + TypeScript | Mismo stack que el proyecto de trading principal |
| HTTP | Fetch API + `node:http` en backend | Sin dependencias externas |
| CSS | CSS Modules o Tailwind | Ligero, sin framework UI pesado |
| Rutas | React Router (opcional, probablemente SPA de 1 página) | Solo 1-2 vistas |
| Despliegue | Mismo servidor que API, servido como static files | Sin infraestructura extra |

**No se usará** Next.js, Express, ni bibliotecas UI (MUI, Chakra). El dashboard debe ser mantenible sin build complejo.

---

## 2. Página principal — Advisor Dashboard

### 2.1 Layout

```
┌──────────────────────────────────────────────────────┐
│  [LOGO] auto-balance-bots          [mode: testnet]   │  ← Header
├──────────────────────────────────────────────────────┤
│  💰 Reserva: $250 (25%)  │  ⚠️ Warnings: 2          │  ← Risk Bar
│  💼 Asignado: $750 (75%) │  ℹ️ Última ejecución: X  │
├──────────────────────────────────────────────────────┤
│                        │                              │
│   Tabla de Pares       │   Panel de Acción           │
│                        │   (seleccionar par →         │
│   ┌────────┬─────┬────┐│    ver detalle)             │
│   │ Par    │Score│ Act││                              │
│   ├────────┼─────┼────┤│   Score breakdown:          │
│   │ SOL    │ 85  │KEEP││   • Volatilidad: +40        │
│   │ BTC    │ 72  │KEEP││   • Volumen: +30            │
│   │ ETH    │ 60  │ADD ││   • Spread: +15             │
│   │ XLM    │ 45  │RED ││   • Rango: -10 (warning)    │
│   └────────┴─────┴────┘│                              │
│                        │   Rango sugerido:            │
│                        │   $145.20 - $185.40          │
│                        │   Centro: $165.30            │
│                        │                              │
│                        │   🎯 Objetivo: $180 (24%)    │
│                        │   Actual: $150 (20%)         │
│                        │   Desviación: +4% → REDUCE   │
│                        │                              │
│                        │   [Preview] [Apply] [Revert] │
│                        │   (deshabilitados en paper)  │
├──────────────────────────────────────────────────────┤
│                                                       │
│   Historial de Decisiones (últimas 10)                │
│                                                       │
│   ┌──────┬────┬────────┬────────┬──────────┐         │
│   │ Hora │ Par│ Acción │ Capital│ Estado   │         │
│   ├──────┼────┼────────┼────────┼──────────┤         │
│   │ 09:00│ SOL│ KEEP   │ $250   │ applied  │         │
│   │ 08:00│ ETH│ ADD    │ $180   │ applied  │         │
│   │ 07:00│ XLM│ REDUCE │ $120   │ reverted │         │
│   └──────┴────┴────────┴────────┴──────────┘         │
│                                                       │
└──────────────────────────────────────────────────────┘
```

### 2.2 Componentes

| Componente | Propósito | Fuente de datos |
|---|---|---|
| `Header` | Logo, modo, red, versión | `GET /health` |
| `RiskBar` | Reserva, asignado, warnings, timestamp | `GET /api/advisor/report` |
| `PairTable` | Tabla de pares con score, capital, acción | `GET /api/advisor/report` |
| `ActionPanel` | Detalle del par seleccionado | `POST /api/advisor/preview` |
| `DecisionHistory` | Historial de decisiones aplicadas | `GET /api/storage/runs` |

### 2.3 PairTable — columnas

| Columna | Formato | Fuente |
|---|---|---|
| Par | `SOLUSDC` | `pairReports[].symbol` |
| Precio | `$165.30` | `pairReports[].price` |
| Score | `85 / 100` con barra de color | `pairReports[].score` |
| Capital Actual | `$150 (20%)` | Allocation actual (input) |
| Capital Objetivo | `$180 (24%)` | `pairReports[].targetWeightPct` |
| Desviación | `+4%` | Calculado |
| Rango | `$145 – $185` | `pairReports[].suggestedRange` |
| Acción | 🟢 KEEP / 🔵 ADD / 🔴 REDUCE | Allocator output |
| Warnings | ⚠️ tooltip | `pairReports[].warnings` |

### 2.4 Color coding

| Elemento | Condición | Color |
|---|---|---|
| Score | ≥ 70 | `#22c55e` (verde) |
| Score | ≥ 40 y < 70 | `#eab308` (amarillo) |
| Score | < 40 | `#ef4444` (rojo) |
| Acción | KEEP | `#22c55e` |
| Acción | ADD | `#3b82f6` (azul) |
| Acción | REDUCE | `#ef4444` |
| Rango | Dentro de límites | Normal |
| Rango | Volatilidad > maxWidth | Borde amarillo + warning |

---

## 3. API endpoints necesarios

### Existentes (ya implementados)

| Endpoint | Usado para |
|---|---|
| `GET /health` | Header (modo, versión, red) |
| `GET /api/advisor/report` | PairTable, RiskBar, warnings |
| `POST /api/advisor/preview` | ActionPanel (preview con parámetros custom) |

### Futuros (a implementar cuando se active ejecución)

| Endpoint | Propósito |
|---|---|
| `GET /api/storage/runs` | DecisionHistory (historial de runs de advisor) |
| `POST /api/advisor/apply` | Apply plan — ejecutar asignación |
| `POST /api/advisor/revert/{runId}` | Revertir un plan aplicado |

---

## 4. DecisionHistory

Cuando el storage esté conectado al API, el historial se carga de la tabla `advisor_runs`:

```json
{
  "runs": [
    {
      "id": 1,
      "generated_at": "2026-06-02T09:00:00Z",
      "mode": "paper",
      "universe": ["SOLUSDC", "BTCUSDC", "ETHUSDC", "XLMUSDC"],
      "reserve_pct": 0.25,
      "status": "applied",
      "pair_decisions": [
        {"symbol": "SOLUSDC", "action": "KEEP", "capital_after": 250},
        {"symbol": "ETHUSDC", "action": "ADD", "capital_after": 180}
      ]
    }
  ]
}
```

---

## 5. Estados de UI

| Estado | Qué mostrar |
|---|---|
| **Cargando** | Skeleton loaders en PairTable y ActionPanel |
| **Error de API** | Banner rojo con mensaje + botón reintentar |
| **Sin datos** | "No hay datos de advisor. Ejecuta `npm run advisor` primero." |
| **Selección nula** | ActionPanel muestra "Selecciona un par para ver detalle" |
| **Botones deshabilitados** | Preview/Apply/Revert aparecen pero grises en modo paper |
| **Preview generado** | ActionPanel muestra diff de capital (antes → después) |
| **Apply exitoso** | Toast verde "Plan aplicado — cambios reflejados en {N} pares" |
| **Apply fallido** | Toast rojo con error de validación |

---

## 6. Mobile responsive

El dashboard debe funcionar en móvil (Mimo revisa desde Telegram):

```css
/* Por defecto: dos columnas */
.dashboard-grid {
  display: grid;
  grid-template-columns: 1fr 350px;
  gap: 1rem;
}

/* Móvil: apilar */
@media (max-width: 768px) {
  .dashboard-grid {
    grid-template-columns: 1fr;
  }
}
```

La PairTable se vuelve scroll horizontal en móvil. El ActionPanel va debajo de la tabla.

---

## 7. No hacer

1. **No copiar el dashboard de grvt-binance-bots.** Este dashboard es independiente, sin migas de aquel proyecto.
2. **No añadir auth compleja.** En MVP local, el dashboard solo es accesible desde localhost o SSH tunnel.
3. **No usar WebSockets para precio en tiempo real.** El advisor es un snapshot, no un tracker de tiempo real.
4. **No implementar Apply/Revert hasta que exista ejecución testnet.** Los botones existen pero están deshabilitados.

---

## 8. Implementación futura

Cuando se decida implementar:

```bash
npm create vite@latest frontend -- --template react-ts
# Proxy VITE_API_URL → backend en vite.config.ts
# Componentes según este plan
# npm run build → static files servidos por API o nginx
```

Ver README.md sección "API REST" para curl de prueba de los endpoints que consumirá el dashboard.
