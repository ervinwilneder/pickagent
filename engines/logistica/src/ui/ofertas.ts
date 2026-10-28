/** Vista "ofertas": cadenas de tramos con sus adjuntos; elegir una (con sus adjuntos) le avisa al chat para reservar y pagar por belo. */
import type { CallToolResult } from "@modelcontextprotocol/client";
import { conectar, datos, el, esc, textoDeError } from "./comun.ts";

interface Pedido { origen: { localidad: { nombre: string } }; destino: { localidad: { nombre: string } }; mercaderia: string; pesoKg: number; fechaLimite: string }
interface Adjunto { tipo: string; nombre: string; precio: number; detalle: string }
interface Tramo { n: number; tipo: string; desde: { texto: string }; hasta: { texto: string }; transportista: { nombre: string; calificacion: number; modo: string }; servicio: string; vehiculo: string; distanciaKm: number; horasViaje: number; retiro: string; entrega: string; precio: number; precioBelo: number; descuentoBelo: number; condiciones?: string[]; adjuntosDisponibles: Adjunto[] }
interface Oferta { id: string; tramos: Tramo[]; precio: number; precioBelo: number; retiro: string; entrega: string; contraEntrega?: boolean }

const lista = document.getElementById("lista")!;
const estadoEl = document.getElementById("estado")!;
const rutaEl = document.getElementById("ruta")!;
const notaEl = document.getElementById("nota")!;
const promptEl = document.getElementById("prompt")!;
const pesos = (n: number) => n.toLocaleString("es-AR");
const cuando = (iso: string) => new Date(iso).toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });
const vehiculo: Record<string, string> = { moto: "moto", utilitario: "utilitario", camion_chico: "camión chico", camion: "camión", red_sucursales: "red de sucursales" };
const tipo: Record<string, string> = { directo: "puerta a puerta", linea: "hasta el depósito", ultima_milla: "última milla" };
const adjuntoNombre: Record<string, string> = { seguro: "seguro", entrega_a_tiempo: "entrega a tiempo" };

function pintar(result: CallToolResult) {
  const error = textoDeError(result);
  if (error) {
    estadoEl.textContent = "error";
    estadoEl.className = "estado alerta";
    lista.replaceChildren(el("p", "resultado mal", esc(error)));
    return;
  }
  const { pedido, ofertas = [], consultados = 0, fallas = [] } = datos<{ pedido?: Pedido; ofertas?: Oferta[]; consultados?: number; fallas?: { transportista: string; motivo: string }[] }>(result);
  if (pedido) {
    promptEl.textContent = `${pedido.mercaderia}, ${pedido.pesoKg} kg · entregar antes de ${cuando(pedido.fechaLimite)}`;
    const km = ofertas[0]?.tramos.reduce((k, t) => k + t.distanciaKm, 0);
    rutaEl.innerHTML = `${esc(pedido.origen.localidad.nombre)} <em>→</em> ${esc(pedido.destino.localidad.nombre)}${km ? ` <span class="chip">${km} km</span>` : ""}`;
  }
  estadoEl.textContent = ofertas.length ? `${ofertas.length} ofertas` : "sin ofertas";
  estadoEl.className = ofertas.length ? "estado" : "estado alerta";
  const sinRespuesta = fallas.length ? ` Sin respuesta de ${fallas.map((f) => f.transportista).join(", ")}.` : "";
  notaEl.textContent = ofertas.length ? `${consultados} transportistas consultados.${sinRespuesta} Cada oferta es una cadena de tramos; marcá los adjuntos que quieras por tramo. Precio con belo = pagando por belo, con el descuento de cada transportista.` : `ningún transportista de ${consultados} puede con este envío: probá con más plazo o menos carga.${sinRespuesta}`;
  lista.replaceChildren(
    ...ofertas.map((o, i) => {
      const titulo = o.tramos.length === 1 ? esc(o.tramos[0]!.transportista.nombre) : `${o.tramos.length} tramos · ${o.tramos.map((t) => esc(t.transportista.nombre)).join(" + ")}`;
      const tramos = o.tramos
        .map(
          (t) => `
          <div class="tramo">
            <div class="detalle"><b>Tramo ${t.n}</b> · ${esc(tipo[t.tipo] ?? t.tipo)} · ${esc(t.transportista.nombre)} · ${esc(vehiculo[t.vehiculo] ?? t.vehiculo)} · ${t.distanciaKm} km · ${esc(pesos(t.precioBelo))} ARS con belo</div>
            <div class="detalle">${esc(t.desde.texto)} → ${esc(t.hasta.texto)} · retiro ${esc(cuando(t.retiro))} · llegada ${esc(cuando(t.entrega))}</div>
            ${t.adjuntosDisponibles.map((a) => `<label class="adjunto"><input type="checkbox" data-oferta="${esc(o.id)}" data-tramo="${t.n}" data-tipo="${esc(a.tipo)}" data-precio="${a.precio}"> ${esc(a.nombre)} <b>+${esc(pesos(a.precio))} ARS</b> <span class="detalle">${esc(a.detalle)}</span></label>`).join("")}
          </div>`,
        )
        .join("");
      return el("article", `oferta${i === 0 ? " mejor" : ""}`, `
        <div>
          <div class="proveedor">${titulo} <span class="chip ${i === 0 ? "verde" : ""}">${i === 0 ? "mejor precio" : `★ ${o.tramos[0]!.transportista.calificacion.toFixed(1)}`}</span>${o.contraEntrega ? ` <span class="chip">contra entrega con belo air</span>` : ""}</div>
          <div class="detalle">retiro ${esc(cuando(o.retiro))} · entrega ${esc(cuando(o.entrega))}</div>
          ${tramos}
        </div>
        <div class="precios">
          <span class="lista">${esc(pesos(o.precio))} ARS de lista</span>
          <span class="belo" data-total="${esc(o.id)}" data-base="${o.precioBelo}">${esc(pesos(o.precioBelo))}<small>ARS con belo</small></span>
          <span class="detalle">tramos con belo + adjuntos elegidos</span>
        </div>
        <div class="acciones"><button class="boton ${i === 0 ? "primario" : ""}" data-id="${esc(o.id)}" type="button">Elegir y pagar con belo ↵</button></div>`);
    }),
  );
  const elegidos = (id: string) => [...lista.querySelectorAll<HTMLInputElement>(`input[data-oferta="${CSS.escape(id)}"]:checked`)].map((c) => ({ tramo: Number(c.dataset.tramo), tipo: c.dataset.tipo!, precio: Number(c.dataset.precio) }));
  lista.querySelectorAll<HTMLInputElement>("input[data-oferta]").forEach((c) =>
    c.addEventListener("change", () => {
      const id = c.dataset.oferta!;
      const total = lista.querySelector<HTMLElement>(`[data-total="${CSS.escape(id)}"]`)!;
      const suma = Number(total.dataset.base) + elegidos(id).reduce((s, a) => s + a.precio, 0);
      total.innerHTML = `${esc(pesos(suma))}<small>ARS con belo</small>`;
    }),
  );
  lista.querySelectorAll<HTMLButtonElement>("button[data-id]").forEach((b) =>
    b.addEventListener("click", async () => {
      lista.querySelectorAll("button").forEach((x) => (x.disabled = true));
      estadoEl.textContent = "elegida";
      const o = ofertas.find((x) => x.id === b.dataset.id)!;
      const ad = elegidos(o.id);
      const texto = `${o.tramos.map((t) => `${t.transportista.nombre} (${tipo[t.tipo] ?? t.tipo})`).join(" + ")}, entrega ${cuando(o.entrega)}, ${pesos(o.precioBelo + ad.reduce((s, a) => s + a.precio, 0))} ARS pagando con belo`;
      const adjuntos = ad.length ? ` con adjuntos: ${ad.map((a) => `${adjuntoNombre[a.tipo] ?? a.tipo} en el tramo ${a.tramo}`).join(", ")} (adjuntos JSON: ${JSON.stringify(ad.map((a) => ({ tramo: a.tramo, tipo: a.tipo })))})` : " sin adjuntos";
      await app.sendMessage({ role: "user", content: [{ type: "text", text: `Elijo la oferta ${o.id}${adjuntos}: ${texto}. Reservá con esos adjuntos y cotizá el pago por belo.` }] });
    }),
  );
}

const app = conectar("pickagent ofertas", pintar, () => {
  const en = (h: number) => new Date(Date.now() + h * 3600_000).toISOString();
  const seguro = (precio: number) => ({ tipo: "seguro", nombre: "Seguro del tramo", precio, detalle: "Cubre hasta 2.000.000 ARS en este tramo." });
  const sla = (p: number) => ({ tipo: "entrega_a_tiempo", nombre: "Entrega a tiempo", precio: Math.round(p * 0.05), detalle: `Si el tramo cierra tarde, se te devuelven ${pesos(Math.round(p * 0.2))} ARS.` });
  return {
    pedido: { origen: { localidad: { nombre: "Villa Crespo" } }, destino: { localidad: { nombre: "Rosario" } }, mercaderia: "20 cajas de repuestos", pesoKg: 120, fechaLimite: en(40) },
    consultados: 6,
    fallas: [],
    ofertas: [
      { id: "1", precio: 234240, precioBelo: 206131, retiro: en(24), entrega: en(31), contraEntrega: true, tramos: [{ n: 1, tipo: "directo", desde: { texto: "Villa Crespo" }, hasta: { texto: "Rosario" }, transportista: { nombre: "Ruta Pampa Transportes", calificacion: 4.7, modo: "catalogo" }, servicio: "Camión chico directo", vehiculo: "camion_chico", distanciaKm: 356, horasViaje: 7.1, retiro: en(24), entrega: en(31), precio: 234240, precioBelo: 206131, descuentoBelo: 0.12, adjuntosDisponibles: [seguro(7800), sla(206131)] }] },
      { id: "2", precio: 262000, precioBelo: 231700, retiro: en(24), entrega: en(34), tramos: [{ n: 1, tipo: "linea", desde: { texto: "Villa Crespo" }, hasta: { texto: "depósito de Ruta Pampa en Rosario" }, transportista: { nombre: "Ruta Pampa Transportes", calificacion: 4.7, modo: "catalogo" }, servicio: "Camión consolidado", vehiculo: "camion", distanciaKm: 356, horasViaje: 7.5, retiro: en(24), entrega: en(32), precio: 240000, precioBelo: 211200, descuentoBelo: 0.12, adjuntosDisponibles: [seguro(7800), sla(211200)] }, { n: 2, tipo: "ultima_milla", desde: { texto: "depósito de Ruta Pampa en Rosario" }, hasta: { texto: "Rosario" }, transportista: { nombre: "Rosario Express", calificacion: 4.5, modo: "catalogo" }, servicio: "Utilitario última milla", vehiculo: "utilitario", distanciaKm: 3, horasViaje: 1.1, retiro: en(32), entrega: en(34), precio: 22000, precioBelo: 20500, descuentoBelo: 0.1, adjuntosDisponibles: [seguro(7200), sla(20500)] }] },
    ],
  };
});
