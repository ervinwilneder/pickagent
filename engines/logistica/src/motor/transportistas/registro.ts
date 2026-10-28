/**
 * El registro de transportistas: consulta a todos en paralelo, con plazo por
 * cada uno, y aísla las fallas: una empresa caída no tira las ofertas de las
 * demás; se informa qué falló.
 */
import type { Cotizacion, Pedido } from "../dominio.ts";
import type { Contexto, Transportista } from "../puerto.ts";

export interface Falla {
  transportista: string;
  motivo: string;
}

export class Registro {
  readonly #transportistas = new Map<string, Transportista>();

  constructor(iniciales: Transportista[] = [], private readonly plazoMs = 6_000) {
    for (const t of iniciales) this.agregar(t);
  }

  agregar(t: Transportista): void {
    if (this.#transportistas.has(t.id)) throw new Error(`Ya hay un transportista con id ${t.id}`);
    this.#transportistas.set(t.id, t);
  }

  todos(): Transportista[] {
    return [...this.#transportistas.values()];
  }

  por(id: string): Transportista | undefined {
    return this.#transportistas.get(id);
  }

  /** Cotizaciones de todos los transportistas para un pedido, con las fallas aparte. */
  async cotizar(pedido: Pedido, contexto: Contexto): Promise<{ cotizaciones: { transportista: Transportista; cotizacion: Cotizacion }[]; fallas: Falla[] }> {
    const resultados = await Promise.allSettled(
      this.todos().map(async (t) => {
        const plazo = new Promise<never>((_, rej) => setTimeout(() => rej(new Error(`no respondió en ${this.plazoMs / 1000} s`)), this.plazoMs));
        const cotizaciones = await Promise.race([t.cotizar(pedido, contexto), plazo]);
        return cotizaciones.map((cotizacion) => ({ transportista: t, cotizacion }));
      }),
    );
    const cotizaciones = resultados.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
    const fallas = resultados.flatMap((r, i) => (r.status === "rejected" ? [{ transportista: this.todos()[i]!.nombre, motivo: r.reason instanceof Error ? r.reason.message : String(r.reason) }] : []));
    return { cotizaciones, fallas };
  }
}
