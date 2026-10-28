/** Vista "ofertas": las mejores ofertas para un pedido; elegir una le avisa al chat para reservar y pagar por belo. */
import type { CallToolResult } from "@modelcontextprotocol/client";
import { conectar, datos, el, esc, textoDeError } from "./comun.ts";

interface Pedido { origen: string; destino: string; mercaderia: string; pesoKg: number; fechaLimite: string }
interface Oferta { id: string; proveedor: { nombre: string; calificacion: number }; servicio: string; vehiculo: string; distanciaKm: number; horasViaje: number; retiro: string; entrega: string; precio: number; precioBelo: number; descuentoBelo: number }

const lista = document.getElementById("lista")!;
const estadoEl = document.getElementById("estado")!;
const rutaEl = document.getElementById("ruta")!;
const notaEl = document.getElementById("nota")!;
const promptEl = document.getElementById("prompt")!;
const pesos = (n: number) => n.toLocaleString("es-AR");
const cuando = (iso: string) => new Date(iso).toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
const vehiculo: Record<string, string> = { moto: "moto", utilitario: "utilitario", camion_chico: "camión chico", camion: "camión" };

function pintar(result: CallToolResult) {
  const error = textoDeError(result);
  if (error) {
    estadoEl.textContent = "error";
    estadoEl.className = "estado alerta";
    lista.replaceChildren(el("p", "resultado mal", esc(error)));
    return;
  }
  const { pedido, ofertas = [], descartadas = 0 } = datos<{ pedido?: Pedido; ofertas?: Oferta[]; descartadas?: number }>(result);
  if (pedido) {
    promptEl.textContent = `pickagent ofertas --de "${pedido.origen}" --a "${pedido.destino}" --antes ${cuando(pedido.fechaLimite)}`;
    rutaEl.innerHTML = `<em>&gt;</em> ${esc(pedido.origen)} → ${esc(pedido.destino)}${ofertas[0] ? ` · ${ofertas[0].distanciaKm} km` : ""}`;
  }
  estadoEl.textContent = ofertas.length ? `${ofertas.length} ofertas` : "sin ofertas";
  estadoEl.className = ofertas.length ? "estado" : "estado alerta";
  notaEl.textContent = ofertas.length ? `${descartadas} servicios descartados por cobertura, capacidad, cuidados o plazo. Precio con belo = pagando por belo, con el descuento del proveedor.` : "ningún proveedor puede con este envío: probá con más plazo o menos carga.";
  lista.replaceChildren(
    ...ofertas.map((o, i) =>
      el("article", `oferta${i === 0 ? " mejor" : ""}`, `
        <div>
          <div class="proveedor">${esc(o.proveedor.nombre)} <span class="chip ${i === 0 ? "verde" : ""}">${i === 0 ? "mejor precio" : `★ ${o.proveedor.calificacion.toFixed(1)}`}</span></div>
          <div class="detalle">${esc(o.servicio)} · ${esc(vehiculo[o.vehiculo] ?? o.vehiculo)} · ${o.horasViaje} h de viaje</div>
          <div class="detalle">retiro ${esc(cuando(o.retiro))} · entrega ${esc(cuando(o.entrega))}</div>
        </div>
        <div class="precios">
          <span class="lista">${esc(pesos(o.precio))} ARS de lista</span>
          <span class="belo">${esc(pesos(o.precioBelo))}<small>ARS con belo</small></span>
          <span class="detalle">${Math.round(o.descuentoBelo * 100)} % off pagando por belo</span>
        </div>
        <div class="acciones"><button class="boton ${i === 0 ? "primario" : ""}" data-id="${esc(o.id)}" data-texto="${esc(`${o.proveedor.nombre}, ${o.servicio}, entrega ${cuando(o.entrega)}, ${pesos(o.precioBelo)} ARS pagando con belo`)}" type="button">Elegir y pagar con belo ↵</button></div>`),
    ),
  );
  lista.querySelectorAll<HTMLButtonElement>("button[data-id]").forEach((b) =>
    b.addEventListener("click", async () => {
      lista.querySelectorAll("button").forEach((x) => (x.disabled = true));
      estadoEl.textContent = "elegida";
      await app.sendMessage({ role: "user", content: [{ type: "text", text: `Elijo la oferta ${b.dataset.id}: ${b.dataset.texto}. Reservá y cotizá el pago por belo.` }] });
    }),
  );
}

const app = conectar("pickagent ofertas", pintar, () => {
  const en = (h: number) => new Date(Date.now() + h * 3600_000).toISOString();
  return {
    pedido: { origen: "Villa Crespo", destino: "Rosario", mercaderia: "20 cajas de repuestos", pesoKg: 120, fechaLimite: en(40) },
    descartadas: 5,
    ofertas: [
      { id: "1", proveedor: { nombre: "Ruta Pampa Transportes", calificacion: 4.7 }, servicio: "Camión consolidado al interior", vehiculo: "camion", distanciaKm: 395, horasViaje: 7.1, retiro: en(24), entrega: en(31), precio: 253000, precioBelo: 222640, descuentoBelo: 0.12 },
      { id: "2", proveedor: { nombre: "Cargas del Sur", calificacion: 4.4 }, servicio: "Utilitario al interior", vehiculo: "utilitario", distanciaKm: 395, horasViaje: 6.6, retiro: en(18), entrega: en(25), precio: 247600, precioBelo: 227792, descuentoBelo: 0.08 },
    ],
  };
});
