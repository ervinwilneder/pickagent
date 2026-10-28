/** Vista "ofertas": las mejores ofertas para un pedido; elegir una le avisa al chat para reservar y pagar por belo. */
import type { CallToolResult } from "@modelcontextprotocol/client";
import { conectar, datos, el, esc, textoDeError } from "./comun.ts";

interface Pedido { origen: { localidad: { nombre: string } }; destino: { localidad: { nombre: string } }; mercaderia: string; pesoKg: number; fechaLimite: string }
interface Oferta { id: string; transportista: { nombre: string; calificacion: number; modo: string }; servicio: string; vehiculo: string; distanciaKm: number; horasViaje: number; retiro: string; entrega: string; precio: number; precioBelo: number; descuentoBelo: number; condiciones?: string[] }

const lista = document.getElementById("lista")!;
const estadoEl = document.getElementById("estado")!;
const rutaEl = document.getElementById("ruta")!;
const notaEl = document.getElementById("nota")!;
const promptEl = document.getElementById("prompt")!;
const pesos = (n: number) => n.toLocaleString("es-AR");
const cuando = (iso: string) => new Date(iso).toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });
const vehiculo: Record<string, string> = { moto: "moto", utilitario: "utilitario", camion_chico: "camión chico", camion: "camión", red_sucursales: "red de sucursales" };

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
    const de = pedido.origen.localidad.nombre;
    const a = pedido.destino.localidad.nombre;
    promptEl.textContent = `pickagent ofertas --de "${de}" --a "${a}" --antes ${cuando(pedido.fechaLimite)}`;
    rutaEl.innerHTML = `<em>&gt;</em> ${esc(de)} → ${esc(a)}${ofertas[0] ? ` · ${ofertas[0].distanciaKm} km` : ""}`;
  }
  estadoEl.textContent = ofertas.length ? `${ofertas.length} ofertas` : "sin ofertas";
  estadoEl.className = ofertas.length ? "estado" : "estado alerta";
  const sinRespuesta = fallas.length ? ` Sin respuesta de ${fallas.map((f) => f.transportista).join(", ")}.` : "";
  notaEl.textContent = ofertas.length ? `${consultados} transportistas consultados.${sinRespuesta} Precio con belo = pagando por belo, con el descuento del transportista.` : `ningún transportista de ${consultados} puede con este envío: probá con más plazo o menos carga.${sinRespuesta}`;
  lista.replaceChildren(
    ...ofertas.map((o, i) =>
      el("article", `oferta${i === 0 ? " mejor" : ""}`, `
        <div>
          <div class="proveedor">${esc(o.transportista.nombre)} <span class="chip ${i === 0 ? "verde" : ""}">${i === 0 ? "mejor precio" : `★ ${o.transportista.calificacion.toFixed(1)}`}</span>${o.transportista.modo === "conectado" ? ` <span class="chip">api</span>` : ""}</div>
          <div class="detalle">${esc(o.servicio)} · ${esc(vehiculo[o.vehiculo] ?? o.vehiculo)} · ${o.horasViaje} h</div>
          <div class="detalle">retiro ${esc(cuando(o.retiro))} · entrega ${esc(cuando(o.entrega))}</div>
          ${o.condiciones?.length ? `<div class="detalle">${esc(o.condiciones.join(" · "))}</div>` : ""}
        </div>
        <div class="precios">
          <span class="lista">${esc(pesos(o.precio))} ARS de lista</span>
          <span class="belo">${esc(pesos(o.precioBelo))}<small>ARS con belo</small></span>
          <span class="detalle">${Math.round(o.descuentoBelo * 100)} % off pagando por belo</span>
        </div>
        <div class="acciones"><button class="boton ${i === 0 ? "primario" : ""}" data-id="${esc(o.id)}" data-texto="${esc(`${o.transportista.nombre}, ${o.servicio}, entrega ${cuando(o.entrega)}, ${pesos(o.precioBelo)} ARS pagando con belo`)}" type="button">Elegir y pagar con belo ↵</button></div>`),
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
    pedido: { origen: { localidad: { nombre: "Villa Crespo" } }, destino: { localidad: { nombre: "Rosario" } }, mercaderia: "20 cajas de repuestos", pesoKg: 120, fechaLimite: en(40) },
    consultados: 5,
    fallas: [],
    ofertas: [
      { id: "1", transportista: { nombre: "Ruta Pampa Transportes", calificacion: 4.7, modo: "catalogo" }, servicio: "Camión consolidado al interior", vehiculo: "camion", distanciaKm: 356, horasViaje: 7.1, retiro: en(24), entrega: en(31), precio: 234240, precioBelo: 206131, descuentoBelo: 0.12 },
      { id: "2", transportista: { nombre: "Andreani", calificacion: 4.5, modo: "conectado" }, servicio: "Andreani Estándar a domicilio", vehiculo: "red_sucursales", distanciaKm: 356, horasViaje: 96, retiro: en(24), entrega: en(120), precio: 240000, precioBelo: 225600, descuentoBelo: 0.06, condiciones: ["seguro incluido hasta el valor declarado"] },
    ],
  };
});
