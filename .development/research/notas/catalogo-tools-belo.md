Sí, el servidor **belo** expone 18 tools. No llamé a ninguna, solo leí sus definiciones. Los nombres van con el prefijo `mcp__belo__`.

## Lectura de cuenta

| Tool | Descripción | Parámetros |
|---|---|---|
| `belo_get_balances` | Saldo disponible por moneda. Incluye rendimiento (`yield`) y lo ganado (`earned`). Es el punto de partida antes de transferir o convertir. | Ninguno |
| `belo_list_transactions` | Historial completo de movimientos, del más nuevo al más viejo. Incluye depósitos, transferencias, swaps y retiros pix. | Todos opcionales: `currency` (string, 2 a 16 caracteres), `from` y `to` (fecha ISO-8601), `type` (`deposit`, `withdrawal`, `swap`, `transfer` o `pix_payout`), `page` (entero ≥1), `limit` (1 a 100, por defecto 20) |
| `belo_get_transaction` | Una transacción por id. Se usa para consultar el estado (`pending`, `success` o `failed`) después de confirmar. | `transactionId` (UUID, obligatorio) |
| `belo_list_vaults` | Todas las bóvedas de ahorro, con saldo, tasa y si generan rendimiento. | `currencyCode` (string, opcional) |
| `belo_get_vault` | Una bóveda con lo ganado (total, hoy, ayer, semana, mes y año). | `vaultId` (string numérico, obligatorio, por ejemplo `"1295"`) |
| `belo_get_deposit_addresses` | Direcciones para fondear la cuenta, una por moneda y red. | `currency` (string, opcional) |
| `belo_list_contacts` | Agenda de contactos, hasta 30. Los propios van primero. | `search` (nombre o apodo, opcional) y `addressType` (opcional, uno de: BELOTAG, CBU, CVU, ALIAS, CBU_USD, ALIAS_USD, BANK_ACCOUNT, PIX, BREB, ACH, SEPA, INTERNATIONAL_ACCOUNT, BITCOIN y sus variantes, ETHEREUM, ETHEREUM_ENS, TRON, POLYGON, OPTIMISM, ARBITRUM_ONE, BSC, STELLAR, SOLANA, BASE, AVALANCHE, PLASMA) |
| `belo_get_contact` | Un contacto con todas sus cuentas y direcciones. | `contactId` (string de 24 caracteres hexadecimales, obligatorio) |
| `belo_get_transfer_networks` | Redes disponibles para enviar una moneda, con mínimo, máximo y comisión. Se consulta antes de cotizar una transferencia. | `currency` (string, obligatorio) |

## Transferencias (cotizar y luego confirmar)

| Tool | Descripción | Parámetros |
|---|---|---|
| `belo_preview_transfer` | Cotiza un envío on-chain, un cash-out en pesos a CVU/CBU/alias, o una transferencia interna belo→belo. No mueve fondos. | Todos obligatorios: `address`, `addressType` (BITCOIN, BITCOIN_LIGHTNING, ETHEREUM, TRON, POLYGON, OPTIMISM, ARBITRUM_ONE, BSC, SOLANA, PLASMA, BASE, STELLAR, AVALANCHE, CVU, CBU, ALIAS, QR, BELOTAG, EMAIL, USER o DEPAY_QR), `currency`, `quoteAmount` (string decimal). Opcional: `quoteCurrency` |
| `belo_confirm_transfer` | **Ejecuta el envío y es irreversible.** Se usa solo después de que el usuario aprobó la cotización. | `transactionId` (UUID, obligatorio), `waitForApproval` (boolean, opcional) |

## Swaps

| Tool | Descripción | Parámetros |
|---|---|---|
| `belo_preview_swap` | Cotiza una conversión fiat↔cripto o cripto↔cripto. No mueve fondos. | Todos obligatorios: `pairCode` (por ejemplo `"USDT/ARGt"`), `type` (`BUY` o `SELL`), `quoteCurrency`, `quoteAmount` (string decimal) |
| `belo_confirm_swap` | **Ejecuta la conversión y es irreversible.** | `transactionId` (UUID, obligatorio), `waitForApproval` (boolean, opcional) |

## Retiros pix (BRL)

| Tool | Descripción | Parámetros |
|---|---|---|
| `belo_accept_pix_payout_terms` | Registra que el usuario aceptó los términos de retiros pix. Hay que hacerlo una vez, y solo con un "sí" explícito. | `acceptedTerms` (debe ser `true`, obligatorio) |
| `belo_find_pix_recipient` | Busca una clave pix en el directorio y devuelve el nombre del titular. Gasta cuota, así que se usa una sola vez por clave. | `address` (CPF, CNPJ, email, teléfono, clave aleatoria o QR "copia e cola", obligatorio) |
| `belo_get_pix_payout_price` | Precio actual del par de un retiro pix. Es informativo y no reserva nada. | `brlAmount` (string decimal, opcional) |
| `belo_preview_pix_payout` | Cotiza un pago en BRL a una clave pix. No mueve fondos. | `address` (clave pix, obligatorio), `amount` (BRL, string decimal, obligatorio) |
| `belo_confirm_pix_payout` | **Envía el pix y es irreversible.** | `transactionId` (UUID, obligatorio), `waitForApproval` (boolean, opcional) |

## Notas de uso

- **Dos pasos:** las operaciones que mueven dinero se cotizan primero y se confirman después. La cotización no debita nada.
- **Aprobación:** antes de confirmar hay que mostrarle al usuario destino, monto, comisión, tipo de cambio, vencimiento y de qué saldos se debita. En pix el destino incluye el nombre del titular.
- **Cuando hay una persona conectada:** el confirm devuelve un link para que la persona apruebe en belo. Después hay que volver a llamar con `waitForApproval: true`.
- **Liquidación asíncrona:** tras confirmar, la operación queda `pending`. El estado final se consulta con `belo_get_transaction`.
- **Montos:** siempre strings decimales.
- **Sin cobros:** no hay ninguna tool para generar links de cobro (belo pay checkout).
- **Bóvedas:** son de solo lectura, no se puede mover dinero hacia ellas ni desde ellas.
- **Tarjetas:** las instrucciones del servidor las mencionan, pero no hay ninguna tool de tarjetas en este catálogo.
