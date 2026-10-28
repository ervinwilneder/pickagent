/**
 * Adaptador REST: "belo as a Service" con API key de organización.
 * Base URL y key salen de la configuración; no hay default de producción.
 */
import createClient from "openapi-fetch";
import { randomUUID } from "node:crypto";
import type { paths } from "./openapi.d.ts";
import { BeloError, type BeloPort, type Confirmacion, type FiltroTransacciones } from "./port.ts";

export interface ConfigRest {
  baseUrl: string;
  apiKey: string;
}

export function beloRest(config: ConfigRest): BeloPort {
  const api = createClient<paths>({ baseUrl: config.baseUrl });

  // El contrato declara Authorization e Idempotency-Key como parámetros de
  // cada operación, así que van en `params.header`. Confirmar deriva la clave
  // de idempotencia de la transacción: repetir la misma confirmación es seguro
  // y devuelve el resultado original.
  const auth = { Authorization: `ApiKey ${config.apiKey}` };
  const lectura = () => ({ header: auth });
  const nueva = () => ({ header: { ...auth, "Idempotency-Key": randomUUID() } });
  const confirmar = (id: string) => ({ header: { ...auth, "Idempotency-Key": `confirm-${id}` }, path: { id } });

  function ok<T>(r: { data?: T; error?: unknown; response: Response }): T {
    if (r.error !== undefined || r.data === undefined) {
      const e = (r.error as { error?: { code?: string; type?: string; message?: string } })?.error;
      throw new BeloError(e?.code ?? `http_${r.response.status}`, e?.type ?? "api_error", e?.message ?? r.response.statusText);
    }
    return r.data;
  }

  const confirmacion = (r: { id: string; status: string; approvalUrl?: string }): Confirmacion => ({
    id: r.id,
    status: r.status,
    approvalUrl: r.approvalUrl,
  });

  return {
    async saldos() {
      return ok(await api.GET("/api/v1/account/balances", { params: lectura() })).data;
    },
    async direccionesDeposito(currency) {
      return ok(await api.GET("/api/v1/account/deposit-addresses", { params: { ...lectura(), query: { currency } } })).data;
    },
    async transacciones(filtro: FiltroTransacciones = {}) {
      return ok(await api.GET("/api/v1/transactions", { params: { ...lectura(), query: filtro } }));
    },
    async transaccion(id) {
      return ok(await api.GET("/api/v1/transactions/{id}", { params: { ...lectura(), path: { id } } }));
    },
    async contactos(search) {
      return ok(await api.GET("/api/v1/contacts", { params: { ...lectura(), query: { search } } })).data;
    },
    async alcancias() {
      return ok(await api.GET("/api/v1/vaults", { params: lectura() })).data;
    },
    async redes(currency) {
      return ok(await api.GET("/api/v1/transfers/networks", { params: { ...lectura(), query: { currency } } })).networks;
    },
    async cotizarSwap(pedido) {
      return ok(await api.POST("/api/v1/swaps/preview", { params: nueva(), body: pedido }));
    },
    async confirmarSwap(id) {
      return confirmacion(ok(await api.PUT("/api/v1/swaps/confirm/{id}", { params: confirmar(id) })));
    },
    async cotizarTransferencia(pedido) {
      return ok(await api.POST("/api/v1/transfers/preview", { params: nueva(), body: pedido }));
    },
    async confirmarTransferencia(id) {
      return confirmacion(ok(await api.PUT("/api/v1/transfers/confirm/{id}", { params: confirmar(id) })));
    },
    async destinatarioPix(address) {
      const r = ok(await api.GET("/api/v1/pix/recipients", { params: { ...lectura(), query: { address } } }));
      return r.data[0]!;
    },
    async cotizarPix(pedido) {
      return ok(await api.POST("/api/v1/pix/payouts/preview", { params: nueva(), body: pedido }));
    },
    async confirmarPix(id) {
      return confirmacion(ok(await api.PUT("/api/v1/pix/payouts/confirm/{id}", { params: confirmar(id) })));
    },
    async metodosCobro() {
      return ok(await api.GET("/api/v1/payments/methods", { params: lectura() })).data;
    },
    async crearCobro(pedido) {
      return ok(await api.POST("/api/v1/payments", { params: nueva(), body: pedido }));
    },
    async estadoCobro(id) {
      return ok(await api.GET("/api/v1/payments/{id}/status", { params: { ...lectura(), path: { id } } }));
    },
    async tarjetas() {
      return ok(await api.GET("/api/v1/cards", { params: lectura() })).data;
    },
  };
}
