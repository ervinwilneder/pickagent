/**
 * Los puntos de cobro de Spotme, por su MCP (dos tools), con el SDK oficial
 * y sin reintentos. Opcional: sin SPOTME_MCP_URL no hay puntos de cobro.
 */
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";

export interface PuntosDeCobro {
  crear(entrada: { nombre: string; lat: number; lon: number; radioM: number; cvu: string; importe: string }): Promise<{ hotspotId: string; enlace: string; codigo: string }>;
  estado(hotspotId: string): Promise<{ reclamado: boolean; pagado: boolean; fallido: boolean; transaccionId?: string }>;
}

interface Resultado {
  isError?: boolean;
  content?: { type: string; text?: string }[];
  structuredContent?: unknown;
}

export function puntosDeCobroEnSpotme(url: string): PuntosDeCobro {
  let cliente: Client | null = null;
  async function conectar(): Promise<Client> {
    if (cliente) return cliente;
    const c = new Client({ name: "logistica", version: "0.0.0" }, { capabilities: {} });
    await c.connect(new StreamableHTTPClientTransport(new URL(url)));
    cliente = c;
    return c;
  }
  async function llamar<T>(name: string, args: Record<string, unknown>): Promise<T> {
    let r: Resultado;
    try {
      r = (await (await conectar()).callTool({ name, arguments: args }, { timeout: 20_000 })) as Resultado;
    } catch (e) {
      cliente = null;
      throw new Error(`Spotme no respondió: ${e instanceof Error ? e.message : e}`);
    }
    if (r.isError) throw new Error(`Spotme rechazó la operación: ${r.content?.find((c) => c.type === "text")?.text ?? "sin detalle"}`);
    if (r.structuredContent && typeof r.structuredContent === "object") return r.structuredContent as T;
    return JSON.parse(r.content?.find((c) => c.type === "text")?.text ?? "{}") as T;
  }
  return {
    async crear(e) {
      const r = await llamar<{ hotspotId: string; enlaceCobro: string; codigo: string }>("spotme_create_hotspot", { nombre: e.nombre, lat: e.lat, lon: e.lon, radioM: e.radioM, cvu: e.cvu, importe: e.importe });
      return { hotspotId: r.hotspotId, enlace: r.enlaceCobro, codigo: r.codigo };
    },
    async estado(hotspotId) {
      const r = await llamar<{ pago: { estado: string }; registro: { idBelo: string | null } }>("spotme_get_hotspot", { hotspotId });
      const estado = r.pago.estado;
      return { reclamado: estado !== "disponible", pagado: estado === "exitoso", fallido: estado === "fallido" || estado === "rechazado", transaccionId: r.registro.idBelo ?? undefined };
    },
  };
}
