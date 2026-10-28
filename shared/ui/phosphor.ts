/** SVG oficiales de @phosphor-icons/core 2.1.1, peso Regular; licencia en phosphor/LICENSE. */
import arrowUp from "./phosphor/arrow-up.svg?raw";
import arrowUpRight from "./phosphor/arrow-up-right.svg?raw";
import arrowRight from "./phosphor/arrow-right.svg?raw";
import arrowBendDownLeft from "./phosphor/arrow-bend-down-left.svg?raw";
import arrowsClockwise from "./phosphor/arrows-clockwise.svg?raw";
import magnifyingGlass from "./phosphor/magnifying-glass.svg?raw";
import check from "./phosphor/check.svg?raw";
import x from "./phosphor/x.svg?raw";
import dotsThree from "./phosphor/dots-three.svg?raw";
import star from "./phosphor/star.svg?raw";
import warningCircle from "./phosphor/warning-circle.svg?raw";
import circleNotch from "./phosphor/circle-notch.svg?raw";
import clock from "./phosphor/clock.svg?raw";
import checkCircle from "./phosphor/check-circle.svg?raw";
import licencia from "./phosphor/LICENSE?raw";
import "./phosphor.css";

const formas = {
  "arrow-up": arrowUp, "arrow-up-right": arrowUpRight, "arrow-right": arrowRight,
  "arrow-bend-down-left": arrowBendDownLeft, "arrows-clockwise": arrowsClockwise,
  "magnifying-glass": magnifyingGlass, check, x, "dots-three": dotsThree, star,
  "warning-circle": warningCircle, "circle-notch": circleNotch, clock, "check-circle": checkCircle,
} as const;
export type Icono = keyof typeof formas;
let licenciaIncluida = false;

/** Solo recibe nombres del catálogo local; nunca interpreta SVG o HTML remoto. */
export function icono(nombre: Icono): string {
  const clase = nombre === "circle-notch" ? "icono-phosphor girando" : "icono-phosphor";
  return formas[nombre].replace("<svg ", `<svg class="${clase}" data-phosphor="${nombre}" aria-hidden="true" focusable="false" `);
}

/** Resuelve los placeholders del HTML inicial y de las plantillas recién insertadas. */
export function montarIconos(raiz: ParentNode = document): void {
  // Mantiene el aviso MIT también dentro de los HTML autocontenidos del MCP.
  if (!licenciaIncluida) {
    document.head.append(document.createComment(licencia));
    licenciaIncluida = true;
  }
  raiz.querySelectorAll<HTMLElement>("[data-icono]").forEach((elemento) => {
    const nombre = elemento.dataset.icono as Icono;
    if (Object.hasOwn(formas, nombre)) elemento.innerHTML = icono(nombre);
  });
}

/** Conserva el texto como texto incluso cuando viene de un resultado de herramienta. */
export function mensajeConIcono(elemento: HTMLElement, nombre: Icono, texto: string): void {
  elemento.innerHTML = icono(nombre);
  elemento.append(document.createTextNode(` ${texto}`));
}

export function marcaEstado(estado: string): string {
  if (estado === "success") return `<span class="marca ok" role="img" aria-label="Completado">${icono("check-circle")}</span>`;
  if (estado === "failed") return `<span class="marca mal" role="img" aria-label="Fallido">${icono("warning-circle")}</span>`;
  return `<span class="marca" role="img" aria-label="Pendiente">${icono("clock")}</span>`;
}
