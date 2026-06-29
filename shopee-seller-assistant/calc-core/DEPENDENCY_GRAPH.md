# calc-core — Dependency Graph (authoritative)

Records the **actual** internal dependency graph. Phase 1 complete.

## Layers (low → high)

```
L0  errors            (no internal deps)
      │
L1  money             (depends on: errors, decimal.js)
      │
L2  types             (depends on: money)
      │
L3  validation        (depends on: types, errors)
      │
L4  fees/resolver     (depends on: validation, types, errors)
    fees/calculator   (depends on: types, money)
    discount          (depends on: types, errors)
      │
L5  profit-engine     (depends on: validation, discount, fees/calculator,
    │                               types, errors)
    break-even        (depends on: types, money, errors)
      │
L6  recommend-price   (depends on: validation, profit-engine, break-even,
    │                               types, money, errors)
      │
L7  round-trip        (depends on: profit-engine, types, errors)
```

## Declared edges

| From | To | Reason |
|---|---|---|
| `money` | `errors` | `Money` throws `InvariantViolationError` on invalid construction / unsafe `toNumber()`. |
| `money` | `decimal.js` | Underlying fixed-point arithmetic. |
| `types` | `money` | `Rate` and value objects reference `Money` / the decimal constructor. |
| `validation` | `types`, `errors` | Validates value objects; returns typed `Result`. |
| `fees/resolver` | `validation`, `types`, `errors` | Config validation + input guards; resolves a profile. |
| `fees/calculator` | `types`, `money` | Forward fee computation and rounding. |
| `discount` | `types`, `errors` | Discount/effective-price math. |
| `profit-engine` | `validation`, `discount`, `fees/calculator`, `types`, `errors` | Orchestrates the profit calculation. |
| `break-even` | `types`, `money`, `errors` | Cap-correction solver. |
| `recommend-price` | `validation`, `profit-engine`, `break-even`, `types`, `money`, `errors` | Mode dispatch, gross-up, internal round-trip assert. |
| `round-trip` | `profit-engine`, `types`, `errors` | Independent forward re-check (±2 IDR). See deviation note. |
| `errors` | — | None. `errors` is dependency-free and must remain the bottom layer. |

## Resolved (release audit D4): round-trip → recommend-price edge removed

The blueprint dependency map originally suggested a `round-trip → recommend-price`
edge. The release audit confirmed it is unnecessary: the verifier operates on a
`RecommendResult` (a type owned by `types`) and re-runs `profit-engine` as the
forward source of truth, so it stays independent of the module it validates —
which is the preferable design for a verifier. The edge is removed from the
map; `round-trip` depends only on `profit-engine`, `types`, and `errors`.

## Rules

- Acyclic. A module may import only from layers strictly below it.
- `errors` imports nothing internal.
