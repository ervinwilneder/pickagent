/**
 * Puerto de belo: lo que la app necesita de belo, independiente de cómo se
 * llegue (MCP de persona con OAuth, API REST de organización con API key, o el
 * adaptador falso para demos sin cuenta).
 *
 * La forma de los datos es la del contrato REST "belo as a Service"
 * (.development/research/api/belo-baas-openapi.json), que coincide con lo que
 * devuelven las 18 tools del MCP. Lo que hoy solo está en REST (cobros,
 * tarjetas, usuarios finales) se asume como tools futuras del MCP.
 *
 * Reglas del dominio que todo adaptador respeta:
 * - Los montos son strings decimales de punta a punta.
 * - Mover plata es dos pasos: cotizar (no debita, vence a los 60 s) y confirmar.
 * - Con una persona conectada, confirmar no ejecuta: belo devuelve un link de
 *   aprobación y la operación queda `pending` hasta que la persona decide.
 */
import type { components } from "./openapi.d.ts";

type S = components["schemas"];

export type Saldo = S["BalanceDto"];
export type DireccionDeposito = S["DepositAddressDto"];
export type Transaccion = S["TransactionResponseDto"];
export type Contacto = S["ContactResponseDto"];
export type Alcancia = S["VaultResponseDto"];
export type RedTransferencia = S["TransferNetworkDto"];
export type CotizacionSwap = S["SwapPreviewResponseDto"];
export type CotizacionTransferencia = S["TransferPreviewResponseDto"];
export type CotizacionPix = S["PixPayoutPreviewResponseDto"];
export type DestinatarioPix = S["PixRecipientResponseDto"];
export type Cobro = S["PaymentResponseDto"];
export type MetodoCobro = S["PaymentMethodResponseDto"];
export type Tarjeta = S["CardResponseDto"];

export type PedidoSwap = S["SwapPreviewRequestDto"];
export type PedidoTransferencia = S["TransferPreviewRequestDto"];
export type PedidoPix = S["PixPayoutPreviewRequestDto"];
export type PedidoCobro = S["CreatePaymentRequestDto"];

export interface FiltroTransacciones {
  currency?: string;
  from?: string;
  to?: string;
  type?: "deposit" | "withdrawal" | "swap" | "transfer" | "pix_payout";
  page?: number;
  limit?: number;
}

export type PaginaTransacciones = S["PaginatedResponseWrapperForTransactionResponseDto"];

/** Resultado de confirmar: `approvalUrl` llega cuando quien confirma es una persona. */
export interface Confirmacion {
  id: string;
  status: string;
  approvalUrl?: string;
}

export interface BeloPort {
  // Lectura (hoy en el MCP)
  saldos(): Promise<Saldo[]>;
  direccionesDeposito(currency?: string): Promise<DireccionDeposito[]>;
  transacciones(filtro?: FiltroTransacciones): Promise<PaginaTransacciones>;
  transaccion(id: string): Promise<Transaccion>;
  contactos(busqueda?: string): Promise<Contacto[]>;
  alcancias(): Promise<Alcancia[]>;
  redes(currency: string): Promise<RedTransferencia[]>;

  // Movimientos en dos pasos (hoy en el MCP)
  cotizarSwap(pedido: PedidoSwap): Promise<CotizacionSwap>;
  confirmarSwap(id: string): Promise<Confirmacion>;
  cotizarTransferencia(pedido: PedidoTransferencia): Promise<CotizacionTransferencia>;
  confirmarTransferencia(id: string): Promise<Confirmacion>;
  destinatarioPix(clave: string): Promise<DestinatarioPix>;
  cotizarPix(pedido: PedidoPix): Promise<CotizacionPix>;
  confirmarPix(id: string): Promise<Confirmacion>;

  // Solo en la API de organización por ahora; se asumen tools futuras del MCP
  metodosCobro(): Promise<MetodoCobro[]>;
  crearCobro(pedido: PedidoCobro): Promise<Cobro>;
  estadoCobro(id: string): Promise<S["PaymentStatusResponseDto"]>;
  tarjetas(): Promise<Tarjeta[]>;

  /** Solo la cuenta falsa: provoca movimientos para la demo. */
  simulacion?: { deposito(monto: string, de: string): Promise<Transaccion> };
}

export class BeloError extends Error {
  constructor(
    readonly code: string,
    readonly type: string,
    message: string,
  ) {
    super(message);
    this.name = "BeloError";
  }
}
