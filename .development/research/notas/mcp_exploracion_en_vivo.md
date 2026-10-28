# Exploración en vivo del MCP de belo (2026-10-28, cuenta personal de Ervin, producción)

Fuente: llamadas reales desde Claude Code (sesión belo--hackathon) con token OAuth de la cuenta
ervinwilneder@gmail.com. Solo lecturas y cotizaciones; nada confirmado.

## Conexión
- `claude mcp add --transport http belo https://b2b.belo.app/mcp` + login OAuth (Google). El login
  `claude mcp login belo` exige terminal interactiva; bajo `expect` con `--no-browser` imprime la URL de
  autorización y escucha el callback en `http://localhost:<puerto>/callback`.
- Registro dinámico de cliente: `client_id` tipo `dyn__…`. Scopes pedidos: los 16 de `scopes_supported` + `offline_access`.
- El server no expone resources MCP, solo 18 tools con prefijo `mcp__belo__`.
- Las instrucciones del server (system prompt del MCP) son extensas: preview→confirm obligatorio, montos
  como strings decimales, nunca mostrar códigos de error/tool names al humano, contactos no son destinos
  verificados, cobros (belo pay) NO están en el server, cards no son transacciones, idempotencia la
  maneja el server (repetir un confirm devuelve la respuesta original), con persona conectada el confirm
  devuelve un link de aprobación y se repite con `waitForApproval: true`.

## Catálogo (18 tools)
Lectura: get_balances, list_transactions, get_transaction, list_vaults, get_vault, get_deposit_addresses,
list_contacts, get_contact, get_transfer_networks, get_pix_payout_price.
Escritura (2 pasos): preview_transfer/confirm_transfer, preview_swap/confirm_swap,
preview_pix_payout/confirm_pix_payout, accept_pix_payout_terms, find_pix_recipient.
Sin tools de tarjetas ni de cobro, pese a que las instrucciones mencionan tarjetas.

## Respuestas observadas
- get_balances: 12 monedas (ETH, SOL, USDT, BTC, USDC, BRAt, ARGt, MEXt, CHLt, COLt, BOLt, PERt) con
  `available`, `earned{total,today,month}` y `yield{rate, extraYield?, totalYield?}`. Ej: USDT 3.36% +
  6.63% campaña = 10%; ARGt 19%; BRAt 17.73%; COLt 15.04%. Montos strings con decimales por moneda.
- list_transactions: 331 movimientos (35 deposit, 217 swap, 5 pix_payout, resto transfer). Cada uno trae
  `receipt` con contraparte (nombre, banco, belotag, cuenta), `debits`, `netAmount`, fee, `conversion`
  (pairCode, price, ambos montos), hash/explorer, `bankReference`. Las monedas del recibo son las de la
  app (ARS, BRL), no las de operación (ARGt).
- list_vaults: vacío en esta cuenta. Solo lectura por diseño.
- get_deposit_addresses: direcciones estables por moneda y red (USDT en ethereum/tron/optimism/polygon/
  arbitrum/bsc/plasma/solana/avalanche; tokens fiat en base y arbitrum; BTC bech32 y p2pkh; ARS por CVU
  `0000139300000001793501` y alias `ervinwilneder.belo`).
- list_contacts: 11 contactos; `tier: self` primero con las cuentas propias (CVU/CBU), luego `frequent`.
  Filtro `addressType=PIX` devolvió vacío aunque hay pix pagados por QR en el historial (los QR no se
  guardan como contacto).
- get_transfer_networks: USDT → BELOTAG (fee 0), ETHEREUM (min 3, fee 1), TRON (min 5, fee 1.5),
  OPTIMISM/POLYGON/ARBITRUM (min 3, fee 1), PLASMA (min 5, fee 1), BSC (min 2, fee 1), SOLANA (min 5, fee 1),
  AVALANCHE (min 1, fee 1). BTC → BITCOIN (min 0.0001, fee 0.00002), LIGHTNING (fee 0). ARGt y BRAt →
  BELOTAG, BASE y ARBITRUM (min ~1 USD equivalente, fee 0). **CVU/CBU/ALIAS no aparecen como "redes"**:
  el cash-out en pesos se cotiza directo en preview_transfer con addressType CVU/CBU/ALIAS/QR.
- get_pix_payout_price: `{"price":"5.17","pairCode":"USDT/BRL"}`.
- preview_swap USDC/ARGt SELL 0.01 USDC → id, status pending, price 1637.3421, quoteAmount 16.37,
  `expiresAt` **+60 segundos**. (El "15 minutos" del instructivo es el link de aprobación, no la cotización.)
- preview_transfer USDC BELOTAG "vassa" 0.01 → fee 0, exchangeRate null, debits [USDC 0.01], expira +60 s.
- get_transaction sobre una cotización no confirmada: la devuelve en `pending` con receipt/conversion
  (aunque list_transactions no la lista).
- Errores tipados: `insufficient_funds` (validation_error, con hint), `invalid_address` (alias inexistente,
  "The destination address is invalid for this rail"), validación de esquema en el cliente para
  quoteAmount "0" ("must be a positive decimal string").

## Implicancias para construir
- El agente puede armar todo el flujo sin fondos hasta el confirm; para la demo hacen falta fondos chicos
  (o la cuenta sandbox del buildathon).
- Cotizaciones de 60 s: el agente tiene que cotizar justo antes de pedir aprobación y re-cotizar si pasó.
- El recibo de cada movimiento es rico (contraparte con nombre, conversión aplicada): sirve para
  resúmenes, categorización y detección de anomalías sin ninguna otra fuente.
- El historial muestra pix por QR a comercios (Uber, Mercado Pago Brasil) debitando ARS vía ARS/USDT:
  el caso "viaje a Brasil pagando con pesos" está probado en producción en esta cuenta.
