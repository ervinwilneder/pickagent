/** La portada se reescribe entera al elegir idioma. La elección queda en el navegador. */

export const IDIOMAS = [
  { id: "es-AR", html: "es-AR", nombre: "Español", region: "Argentina" },
  { id: "es-419", html: "es-419", nombre: "Español", region: "Latinoamérica" },
  { id: "en", html: "en", nombre: "English", region: "" },
] as const;

export type IdiomaId = (typeof IDIOMAS)[number]["id"];

const esAR = {
  salto: "Ir al contenido",
  marcaAria: "pickagent, inicio",
  nav: "Navegación principal",
  como: "Cómo funciona",
  transportistas: "Transportistas",
  pagos: "Pagos",
  probar: "Probar pickagent",
  hero1: "Decile qué mandar.",
  hero2: "pickagent lo resuelve.",
  bajada: "Compará opciones de transporte, elegí tu envío y aprobá el pago con belo. Todo desde una conversación.",
  verComo: "Ver cómo funciona",
  ejemplo: "Ejemplo de envío",
  burbujaVos: "Tengo que mandar 20 cajas de repuestos, 120 kg, de Villa Crespo a Rosario. Es frágil.",
  burbujaAgente: "Esta es la mejor opción pagando con belo:",
  precioBelo: "Precio con belo",
  detalle: "Retira jueves de 9 a 12 · entrega viernes antes de las 10 · acepta carga frágil.",
  ahorro: "Ahorrás $ 28.109 con belo.",
  reservo: "¿Reservo y te paso la aprobación?",
  dale: "Dale. Ya aprobé el pago en belo.",
  confirmado: "Tu envío está confirmado.",
  seguimiento: "Seguimiento",
  tituloComo: "Cómo funciona un envío",
  bajadaComo: "De lo que tenés que mandar al seguimiento, sin salir de la conversación.",
  paso1: "Contás el envío",
  paso1p: "Qué mandás, de dónde a dónde y para cuándo. Completás los datos que falten.",
  paso2: "Comparás opciones",
  paso2p: "Ves hasta cinco ofertas, con retiro, entrega y precio pagando con belo.",
  paso3: "Elegís y aprobás",
  paso3p: "Aprobás el pago en belo o elegís contra entrega con belo air cuando esté disponible.",
  paso4: "Recibís el seguimiento",
  paso4p: "Cuando entra el pago, pickagent confirma la reserva y te da el código de seguimiento.",
  pago1: "El envío y el pago,",
  pago2: "en el mismo lugar.",
  pagoBajada: "Revisás las condiciones y aprobás el importe. pickagent se ocupa de confirmar el envío cuando llega el pago.",
  ben1: "Precio con belo",
  ben1p: "Ves el precio de lista, el precio con belo y cuánto ahorrás antes de elegir.",
  ben2: "El pago lo aprobás vos",
  ben2p: "El importe y el destinatario ya están preparados. Revisás y confirmás desde belo.",
  ben3: "Confirmación automática",
  ben3p: "Cuando entra el pago, tu reserva se confirma y recibís el seguimiento.",
  ben4: "Contra entrega con belo air",
  ben4p: "Si la oferta lo admite, pagás acercando tu teléfono al del chofer. Revisás el monto y aprobás, sin efectivo.",
  trans1: "¿Tenés una empresa",
  trans2: "de transporte?",
  transBajada: "Sumá tus servicios al motor de pickagent. Podés hacerlo con tu catálogo o con tu propia API.",
  cat: "Con tu catálogo",
  catp: "Definís vehículos, cobertura, tarifas, capacidad y horarios de retiro. pickagent cotiza tus servicios.",
  api: "Con tu API",
  apip: "Conectás cotización, creación de envíos y seguimiento. El motor consulta tu disponibilidad y tus precios.",
  liquidacion: "El cliente le paga a pickagent. Después, pickagent liquida al transportista lo cobrado menos su comisión, desde su cuenta de belo.",
  cierre1: "Tu próximo envío empieza",
  cierre2: "con un mensaje.",
  cierreBajada: "Contá qué querés mandar. pickagent te ayuda a encontrar cómo llevarlo.",
  pie: "Envíos y pagos con belo.",
  seguinos: "Seguinos",
  preguntales: "Preguntale a la IA",
  etiquetaIdioma: "Idioma",
  tituloPagina: "pickagent · tu próximo envío empieza con un mensaje",
  descripcion: "Contá qué querés mandar. Compará transportistas, elegí tu envío y aprobá el pago con belo desde una misma conversación.",
  preguntaIa: "¿Qué es pickagent y cómo resuelve un envío pagando con belo? Contame qué ofrece.",
  ariaChatgpt: "Preguntarle a ChatGPT sobre pickagent",
  ariaClaude: "Preguntarle a Claude sobre pickagent",
  ariaGemini: "Preguntarle a Gemini sobre pickagent",
  ariaPerplexity: "Preguntarle a Perplexity sobre pickagent",
  cambiarIdioma: "Cambiar idioma. Actual: Español (Argentina)",
  elegirIdioma: "Seleccioná el idioma",
  temaGrupo: "Tema",
  temaOscuro: "Tema oscuro",
  temaClaro: "Tema claro",
  ilustrPagos: "Pago de un envío confirmado en un teléfono, junto a una caja y un camión.",
  ilustrTrans: "Catálogo de servicios de transporte conectado por API, con un camión y paquetes.",
};

type Clave = keyof typeof esAR;

const es419: Record<Clave, string> = {
  salto: "Ir al contenido",
  marcaAria: "pickagent, inicio",
  nav: "Navegación principal",
  como: "Cómo funciona",
  transportistas: "Transportistas",
  pagos: "Pagos",
  probar: "Probar pickagent",
  hero1: "Dile qué enviar.",
  hero2: "pickagent lo resuelve.",
  bajada: "Compara opciones de transporte, elige tu envío y aprueba el pago con belo. Todo desde una conversación.",
  verComo: "Ver cómo funciona",
  ejemplo: "Ejemplo de envío",
  burbujaVos: "Tengo que enviar 20 cajas de repuestos, 120 kg, de Villa Crespo a Rosario. Es frágil.",
  burbujaAgente: "Esta es la mejor opción pagando con belo:",
  precioBelo: "Precio con belo",
  detalle: "Retira el jueves de 9 a 12 · entrega el viernes antes de las 10 · acepta carga frágil.",
  ahorro: "Ahorras $ 28.109 con belo.",
  reservo: "¿La reservo y te envío la aprobación?",
  dale: "Listo. Ya aprobé el pago en belo.",
  confirmado: "Tu envío está confirmado.",
  seguimiento: "Seguimiento",
  tituloComo: "Cómo funciona un envío",
  bajadaComo: "De lo que tienes que enviar al seguimiento, sin salir de la conversación.",
  paso1: "Cuentas el envío",
  paso1p: "Qué envías, de dónde a dónde y para cuándo. Completas los datos que falten.",
  paso2: "Comparas opciones",
  paso2p: "Ves hasta cinco ofertas, con retiro, entrega y precio pagando con belo.",
  paso3: "Eliges y apruebas",
  paso3p: "Apruebas el pago en belo o eliges contra entrega con belo air cuando esté disponible.",
  paso4: "Recibes el seguimiento",
  paso4p: "Cuando entra el pago, pickagent confirma la reserva y te da el código de seguimiento.",
  pago1: "El envío y el pago,",
  pago2: "en el mismo lugar.",
  pagoBajada: "Revisas las condiciones y apruebas el importe. pickagent se ocupa de confirmar el envío cuando llega el pago.",
  ben1: "Precio con belo",
  ben1p: "Ves el precio de lista, el precio con belo y cuánto ahorras antes de elegir.",
  ben2: "El pago lo apruebas tú",
  ben2p: "El importe y el destinatario ya están preparados. Revisas y confirmas desde belo.",
  ben3: "Confirmación automática",
  ben3p: "Cuando entra el pago, tu reserva se confirma y recibes el seguimiento.",
  ben4: "Contra entrega con belo air",
  ben4p: "Si la oferta lo admite, pagas acercando tu teléfono al del conductor. Revisas el monto y apruebas, sin efectivo.",
  trans1: "¿Tienes una empresa",
  trans2: "de transporte?",
  transBajada: "Suma tus servicios al motor de pickagent. Puedes hacerlo con tu catálogo o con tu propia API.",
  cat: "Con tu catálogo",
  catp: "Defines vehículos, cobertura, tarifas, capacidad y horarios de retiro. pickagent cotiza tus servicios.",
  api: "Con tu API",
  apip: "Conectas cotización, creación de envíos y seguimiento. El motor consulta tu disponibilidad y tus precios.",
  liquidacion: "El cliente le paga a pickagent. Después, pickagent liquida al transportista lo cobrado menos su comisión, desde su cuenta de belo.",
  cierre1: "Tu próximo envío empieza",
  cierre2: "con un mensaje.",
  cierreBajada: "Cuenta qué quieres enviar. pickagent te ayuda a encontrar cómo llevarlo.",
  pie: "Envíos y pagos con belo.",
  seguinos: "Síguenos",
  preguntales: "Pregúntale a la IA",
  etiquetaIdioma: "Idioma",
  tituloPagina: "pickagent · tu próximo envío empieza con un mensaje",
  descripcion: "Cuenta qué quieres enviar. Compara transportistas, elige tu envío y aprueba el pago con belo desde una misma conversación.",
  preguntaIa: "¿Qué es pickagent y cómo resuelve un envío pagando con belo? Cuéntame qué ofrece.",
  ariaChatgpt: "Preguntarle a ChatGPT sobre pickagent",
  ariaClaude: "Preguntarle a Claude sobre pickagent",
  ariaGemini: "Preguntarle a Gemini sobre pickagent",
  ariaPerplexity: "Preguntarle a Perplexity sobre pickagent",
  cambiarIdioma: "Cambiar idioma. Actual: Español (Latinoamérica)",
  elegirIdioma: "Selecciona el idioma",
  temaGrupo: "Tema",
  temaOscuro: "Tema oscuro",
  temaClaro: "Tema claro",
  ilustrPagos: "Pago de un envío confirmado en un teléfono, junto a una caja y un camión.",
  ilustrTrans: "Catálogo de servicios de transporte conectado por API, con un camión y paquetes.",
};

const en: Record<Clave, string> = {
  salto: "Skip to content",
  marcaAria: "pickagent, home",
  nav: "Main navigation",
  como: "How it works",
  transportistas: "Carriers",
  pagos: "Payments",
  probar: "Try pickagent",
  hero1: "Tell it what to send.",
  hero2: "pickagent takes care of it.",
  bajada: "Compare shipping options, choose your shipment and approve the payment with belo. All in one conversation.",
  verComo: "See how it works",
  ejemplo: "Shipment example",
  burbujaVos: "I need to send 20 boxes of spare parts, 120 kg, from Villa Crespo to Rosario. It's fragile.",
  burbujaAgente: "This is the best option paying with belo:",
  precioBelo: "Price with belo",
  detalle: "Pickup Thursday 9 to 12 · delivery Friday before 10 · accepts fragile cargo.",
  ahorro: "You save $ 28.109 with belo.",
  reservo: "Shall I book it and send you the approval?",
  dale: "Done. I already approved the payment in belo.",
  confirmado: "Your shipment is confirmed.",
  seguimiento: "Tracking",
  tituloComo: "How a shipment works",
  bajadaComo: "From what you need to send through to tracking, without leaving the conversation.",
  paso1: "You describe the shipment",
  paso1p: "What you're sending, from where to where, and by when. You fill in anything missing.",
  paso2: "You compare options",
  paso2p: "You see up to five offers, with pickup, delivery and the price paying with belo.",
  paso3: "You choose and approve",
  paso3p: "You approve the payment in belo, or choose cash on delivery with belo air when it's available.",
  paso4: "You get tracking",
  paso4p: "When the payment arrives, pickagent confirms the booking and gives you the tracking code.",
  pago1: "The shipment and the payment,",
  pago2: "in the same place.",
  pagoBajada: "You review the terms and approve the amount. pickagent confirms the shipment when the payment arrives.",
  ben1: "Price with belo",
  ben1p: "You see the list price, the belo price and how much you save before you choose.",
  ben2: "You approve the payment",
  ben2p: "The amount and the recipient are already set. You review and confirm from belo.",
  ben3: "Automatic confirmation",
  ben3p: "When the payment arrives, your booking is confirmed and you get tracking.",
  ben4: "Cash on delivery with belo air",
  ben4p: "If the offer allows it, you pay by holding your phone near the driver's. You review the amount and approve, with no cash.",
  trans1: "Do you run a",
  trans2: "transport company?",
  transBajada: "Add your services to pickagent's engine. You can do it with your catalog or with your own API.",
  cat: "With your catalog",
  catp: "You define vehicles, coverage, rates, capacity and pickup hours. pickagent quotes your services.",
  api: "With your API",
  apip: "You connect quoting, shipment creation and tracking. The engine checks your availability and your prices.",
  liquidacion: "The customer pays pickagent. Then pickagent settles the carrier for what was collected minus its commission, from its belo account.",
  cierre1: "Your next shipment starts",
  cierre2: "with a message.",
  cierreBajada: "Tell us what you want to send. pickagent helps you find how to move it.",
  pie: "Shipments and payments with belo.",
  seguinos: "Follow us",
  preguntales: "Ask the AI",
  etiquetaIdioma: "Language",
  tituloPagina: "pickagent · your next shipment starts with a message",
  descripcion: "Tell us what you want to send. Compare carriers, choose your shipment and approve the payment with belo in one conversation.",
  preguntaIa: "What is pickagent and how does it handle a shipment paid with belo? Tell me what it offers.",
  ariaChatgpt: "Ask ChatGPT about pickagent",
  ariaClaude: "Ask Claude about pickagent",
  ariaGemini: "Ask Gemini about pickagent",
  ariaPerplexity: "Ask Perplexity about pickagent",
  cambiarIdioma: "Change language. Current: English",
  elegirIdioma: "Choose a language",
  temaGrupo: "Theme",
  temaOscuro: "Dark theme",
  temaClaro: "Light theme",
  ilustrPagos: "A confirmed shipment payment on a phone, next to a box and a truck.",
  ilustrTrans: "A transport service catalog connected by API, with a truck and packages.",
};

const TEXTOS: Record<IdiomaId, Record<Clave, string>> = { "es-AR": esAR, "es-419": es419, en };

const DESTINOS = {
  chatgpt: "https://chatgpt.com/?q=",
  claude: "https://claude.ai/new?q=",
  gemini: "https://www.google.com/search?udm=50&q=",
  perplexity: "https://www.perplexity.ai/search?q=",
} as const;

const CLAVE = "pickagent-idioma";

function leerIdioma(): IdiomaId {
  try {
    const guardado = localStorage.getItem(CLAVE);
    return esIdioma(guardado) ? guardado : "es-AR";
  } catch {
    return "es-AR";
  }
}

function guardarIdioma(id: IdiomaId) {
  try { localStorage.setItem(CLAVE, id); } catch { /* el modo privado no conserva la elección */ }
}

function esIdioma(valor: string | null): valor is IdiomaId {
  return IDIOMAS.some((idioma) => idioma.id === valor);
}

export function montarIdioma(): void {
  let actual: IdiomaId = leerIdioma();
  const boton = document.querySelector<HTMLButtonElement>("#boton-idioma");
  const lista = document.querySelector<HTMLUListElement>("#lista-idioma");
  const caja = document.querySelector<HTMLElement>(".idioma");
  if (!boton || !lista || !caja) return;

  const nombre = document.querySelector<HTMLElement>("#idioma-nombre");
  const region = document.querySelector<HTMLElement>("#idioma-region");
  const opciones = [...lista.querySelectorAll<HTMLButtonElement>("[data-idioma]")];

  function aplicar(id: IdiomaId) {
    actual = id;
    const textos = TEXTOS[id];
    const meta = IDIOMAS.find((idioma) => idioma.id === id)!;
    document.documentElement.lang = meta.html;
    document.title = textos.tituloPagina;
    document.querySelector('meta[name="description"]')?.setAttribute("content", textos.descripcion);
    document.querySelectorAll<HTMLElement>("[data-t]").forEach((elemento) => {
      const clave = elemento.dataset.t as Clave;
      if (clave in textos) elemento.textContent = textos[clave];
    });
    document.querySelectorAll<HTMLElement>("[data-t-aria]").forEach((elemento) => {
      const clave = elemento.dataset.tAria as Clave;
      if (clave in textos) elemento.setAttribute("aria-label", textos[clave]);
    });
    document.querySelectorAll<HTMLImageElement>("[data-t-alt]").forEach((imagen) => {
      const clave = imagen.dataset.tAlt as Clave;
      if (clave in textos) imagen.alt = textos[clave];
    });
    document.querySelectorAll<HTMLAnchorElement>("[data-ia]").forEach((enlace) => {
      const destino = DESTINOS[enlace.dataset.ia as keyof typeof DESTINOS];
      if (destino) enlace.href = destino + encodeURIComponent(textos.preguntaIa);
    });
    if (nombre) nombre.textContent = meta.nombre;
    if (region) {
      region.textContent = meta.region;
      region.hidden = meta.region === "";
    }
    boton!.setAttribute("aria-label", textos.cambiarIdioma);
    lista!.setAttribute("aria-label", textos.elegirIdioma);
    for (const opcion of opciones) opcion.setAttribute("aria-selected", String(opcion.dataset.idioma === id));
    guardarIdioma(id);
  }

  function abierto() {
    return boton!.getAttribute("aria-expanded") === "true";
  }

  function cerrar() {
    lista!.hidden = true;
    boton!.setAttribute("aria-expanded", "false");
  }

  function abrir() {
    lista!.hidden = false;
    boton!.setAttribute("aria-expanded", "true");
    lista!.querySelector<HTMLButtonElement>('[aria-selected="true"]')?.focus();
  }

  boton.addEventListener("click", () => (abierto() ? cerrar() : abrir()));
  lista.addEventListener("click", (evento) => {
    const opcion = evento.target instanceof Element ? evento.target.closest<HTMLButtonElement>("[data-idioma]") : null;
    if (!opcion) return;
    const elegido = opcion.dataset.idioma ?? null;
    if (!esIdioma(elegido)) return;
    aplicar(elegido);
    cerrar();
    boton.focus();
  });
  lista.addEventListener("keydown", (evento) => {
    const i = opciones.indexOf(document.activeElement as HTMLButtonElement);
    if (evento.key === "ArrowDown" || evento.key === "ArrowUp") {
      evento.preventDefault();
      const delta = evento.key === "ArrowDown" ? 1 : -1;
      opciones[(i + delta + opciones.length) % opciones.length]?.focus();
    }
  });
  document.addEventListener("click", (evento) => {
    if (!abierto()) return;
    if (evento.target instanceof Node && caja.contains(evento.target)) return;
    cerrar();
  });
  document.addEventListener("keydown", (evento) => {
    if (evento.key === "Escape" && abierto()) {
      cerrar();
      boton.focus();
    }
  });

  aplicar(actual);
}
