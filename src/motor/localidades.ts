/** Localidades conocidas, con coordenadas y código postal: alcanza para cotizar sin mapas externos. */
import type { Localidad } from "./dominio.ts";

export const localidades: Localidad[] = [
  { nombre: "Villa Crespo", provincia: "CABA", zona: "AMBA", codigoPostal: "1414", lat: -34.5987, lon: -58.4389 },
  { nombre: "Palermo", provincia: "CABA", zona: "AMBA", codigoPostal: "1425", lat: -34.5781, lon: -58.4253 },
  { nombre: "Caballito", provincia: "CABA", zona: "AMBA", codigoPostal: "1405", lat: -34.6187, lon: -58.4433 },
  { nombre: "Microcentro", provincia: "CABA", zona: "AMBA", codigoPostal: "1043", lat: -34.6037, lon: -58.3816 },
  { nombre: "Belgrano", provincia: "CABA", zona: "AMBA", codigoPostal: "1428", lat: -34.5627, lon: -58.4568 },
  { nombre: "Barracas", provincia: "CABA", zona: "AMBA", codigoPostal: "1275", lat: -34.6435, lon: -58.3818 },
  { nombre: "Avellaneda", provincia: "Buenos Aires", zona: "AMBA", codigoPostal: "1870", lat: -34.6627, lon: -58.3657 },
  { nombre: "Quilmes", provincia: "Buenos Aires", zona: "AMBA", codigoPostal: "1878", lat: -34.7203, lon: -58.2548 },
  { nombre: "San Isidro", provincia: "Buenos Aires", zona: "AMBA", codigoPostal: "1642", lat: -34.4713, lon: -58.5278 },
  { nombre: "Tigre", provincia: "Buenos Aires", zona: "AMBA", codigoPostal: "1648", lat: -34.4262, lon: -58.5796 },
  { nombre: "Pilar", provincia: "Buenos Aires", zona: "AMBA", codigoPostal: "1629", lat: -34.4587, lon: -58.9142 },
  { nombre: "Morón", provincia: "Buenos Aires", zona: "AMBA", codigoPostal: "1708", lat: -34.6534, lon: -58.6198 },
  { nombre: "La Plata", provincia: "Buenos Aires", zona: "AMBA", codigoPostal: "1900", lat: -34.9215, lon: -57.9545 },
  { nombre: "Ezeiza", provincia: "Buenos Aires", zona: "AMBA", codigoPostal: "1804", lat: -34.8548, lon: -58.5227 },
  { nombre: "Rosario", provincia: "Santa Fe", zona: "interior", codigoPostal: "2000", lat: -32.9468, lon: -60.6393 },
  { nombre: "Santa Fe", provincia: "Santa Fe", zona: "interior", codigoPostal: "3000", lat: -31.6333, lon: -60.7 },
  { nombre: "Córdoba", provincia: "Córdoba", zona: "interior", codigoPostal: "5000", lat: -31.4201, lon: -64.1888 },
  { nombre: "Mar del Plata", provincia: "Buenos Aires", zona: "interior", codigoPostal: "7600", lat: -38.0055, lon: -57.5426 },
  { nombre: "Bahía Blanca", provincia: "Buenos Aires", zona: "interior", codigoPostal: "8000", lat: -38.7183, lon: -62.2663 },
  { nombre: "Mendoza", provincia: "Mendoza", zona: "interior", codigoPostal: "5500", lat: -32.8895, lon: -68.8458 },
  { nombre: "Tucumán", provincia: "Tucumán", zona: "interior", codigoPostal: "4000", lat: -26.8083, lon: -65.2176 },
  { nombre: "Paraná", provincia: "Entre Ríos", zona: "interior", codigoPostal: "3100", lat: -31.7333, lon: -60.5333 },
  { nombre: "Neuquén", provincia: "Neuquén", zona: "interior", codigoPostal: "8300", lat: -38.9516, lon: -68.0591 },
  { nombre: "Salta", provincia: "Salta", zona: "interior", codigoPostal: "4400", lat: -24.7821, lon: -65.4232 },
];

export const normalizar = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** Busca una localidad por nombre o código postal dentro de un texto libre ("Villa Crespo, CABA", "CP 2000"). */
export function localidad(texto: string): Localidad | undefined {
  const t = normalizar(texto);
  const exacta = localidades.find((l) => normalizar(l.nombre) === t || l.codigoPostal === t);
  if (exacta) return exacta;
  const porNombre = localidades.find((l) => t.includes(normalizar(l.nombre)));
  if (porNombre) return porNombre;
  const cp = t.match(/\b(\d{4})\b/)?.[1];
  const porCp = cp ? localidades.find((l) => l.codigoPostal === cp) : undefined;
  if (porCp) return porCp;
  return t.includes("caba") || t.includes("capital") ? localidades[3] : undefined;
}

/** Distancia por ruta estimada: haversine por un factor de 1,3. */
export function distanciaKm(a: Localidad, b: Localidad): number {
  const r = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  const recta = 2 * r * Math.asin(Math.sqrt(h));
  return Math.max(3, Math.round(recta * 1.3));
}
