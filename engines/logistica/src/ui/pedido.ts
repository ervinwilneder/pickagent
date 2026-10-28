/** Vista "pedido": el formulario de envío, precargado con lo que el agente ya sabe. Al confirmar, registra el pedido y le avisa al chat. */
import type { CallToolResult } from "@modelcontextprotocol/client";
import { conectar, datos, esc, textoDeError } from "./comun.ts";

interface Borrador { origen?: string; destino?: string; direccionOrigen?: string; direccionDestino?: string; fechaLimite?: string; mercaderia?: string; pesoKg?: number; volumenM3?: number; cuidados?: string[]; fragil?: boolean; refrigerado?: boolean; valorDeclarado?: number; contacto?: string; notas?: string }

const form = document.getElementById("form") as HTMLFormElement;
const estadoEl = document.getElementById("estado")!;
const resultadoEl = document.getElementById("resultado")!;
const boton = document.getElementById("confirmar") as HTMLButtonElement;
const campo = (n: string) => form.elements.namedItem(n) as HTMLInputElement;

/** ISO → valor de datetime-local en hora argentina. */
function aLocal(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const ar = new Date(d.getTime() - 3 * 3600_000);
  return ar.toISOString().slice(0, 16);
}
/** datetime-local (hora argentina) → ISO con zona -03:00. */
const aIso = (local: string) => (local ? `${local}:00-03:00` : "");

function pintar(result: CallToolResult) {
  const error = textoDeError(result);
  if (error) {
    estadoEl.textContent = "error";
    estadoEl.className = "estado alerta";
    resultadoEl.textContent = error;
    return;
  }
  const { borrador = {}, localidades = [] } = datos<{ borrador?: Borrador; localidades?: string[] }>(result);
  document.getElementById("localidades")!.innerHTML = localidades.map((l) => `<option value="${esc(l)}"></option>`).join("");
  for (const k of ["origen", "destino", "direccionOrigen", "direccionDestino", "mercaderia", "contacto", "notas"] as const) if (borrador[k]) campo(k).value = String(borrador[k]);
  if (borrador.valorDeclarado) campo("valorDeclarado").value = String(borrador.valorDeclarado);
  if (borrador.pesoKg) campo("pesoKg").value = String(borrador.pesoKg);
  if (borrador.volumenM3) campo("volumenM3").value = String(borrador.volumenM3);
  if (borrador.fechaLimite) campo("fechaLimite").value = aLocal(borrador.fechaLimite);
  campo("fragil").checked = Boolean(borrador.cuidados?.includes("fragil") || borrador.fragil);
  campo("refrigerado").checked = Boolean(borrador.cuidados?.includes("refrigerado") || borrador.refrigerado);
  const faltan = ["origen", "destino", "fechaLimite", "mercaderia", "pesoKg", "volumenM3", "contacto"].filter((k) => !campo(k).value);
  estadoEl.textContent = faltan.length ? `faltan ${faltan.length} datos` : "listo para buscar";
  (faltan[0] ? campo(faltan[0]) : boton).focus();
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  boton.disabled = true;
  resultadoEl.className = "resultado";
  resultadoEl.textContent = "[..] registrando el pedido";
  const args = {
    origen: campo("origen").value,
    destino: campo("destino").value,
    fechaLimite: aIso(campo("fechaLimite").value),
    mercaderia: campo("mercaderia").value,
    pesoKg: Number(campo("pesoKg").value),
    volumenM3: Number(campo("volumenM3").value),
    direccionOrigen: campo("direccionOrigen").value || undefined,
    direccionDestino: campo("direccionDestino").value || undefined,
    cuidados: [campo("fragil").checked ? "fragil" : null, campo("refrigerado").checked ? "refrigerado" : null].filter(Boolean),
    valorDeclarado: campo("valorDeclarado").value ? Number(campo("valorDeclarado").value) : undefined,
    contacto: campo("contacto").value,
    notas: campo("notas").value || undefined,
  };
  const r = await app.callServerTool({ name: "crear_pedido", arguments: args });
  const error = textoDeError(r);
  if (error) {
    resultadoEl.className = "resultado mal";
    resultadoEl.textContent = `[!!] ${error}`;
    boton.disabled = false;
    return;
  }
  const { pedidoId, resumen } = datos<{ pedidoId: string; resumen: string }>(r);
  resultadoEl.className = "resultado ok";
  resultadoEl.textContent = `[OK] ${resumen}`;
  estadoEl.textContent = "pedido registrado";
  form.querySelectorAll("input").forEach((i) => (i.disabled = true));
  await app.sendMessage({ role: "user", content: [{ type: "text", text: `Confirmé el pedido de envío ${pedidoId}: ${resumen} Buscá las ofertas.` }] });
});

const app = conectar("pickagent pedido", pintar, () => ({
  borrador: { origen: "Villa Crespo", destino: "Rosario", mercaderia: "20 cajas de repuestos", pesoKg: 120, fechaLimite: new Date(Date.now() + 2 * 86_400_000).toISOString() },
  localidades: ["Villa Crespo, CABA", "Rosario, Santa Fe", "Córdoba, Córdoba"],
}));
