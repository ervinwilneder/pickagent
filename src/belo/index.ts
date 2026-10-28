/**
 * Elige el adaptador de belo según la configuración:
 * - BELO_API_KEY y BELO_BASE_URL presentes → API REST de organización;
 * - si no → cuenta falsa en memoria para la demo.
 * No hay default de producción: la URL siempre sale de la configuración.
 */
import { beloFalso } from "./falso.ts";
import type { BeloPort } from "./port.ts";
import { beloRest } from "./rest.ts";

export type { BeloPort } from "./port.ts";

export function belo(): BeloPort {
  const apiKey = process.env.BELO_API_KEY;
  const baseUrl = process.env.BELO_BASE_URL;
  if (apiKey && baseUrl) return beloRest({ apiKey, baseUrl });
  if (apiKey || baseUrl) throw new Error("Configurá BELO_API_KEY y BELO_BASE_URL juntas, o ninguna para la cuenta falsa");
  console.error("belo: sin API key, usando la cuenta falsa en memoria");
  return beloFalso();
}
