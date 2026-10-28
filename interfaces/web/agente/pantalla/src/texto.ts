/** El texto entra como en linear.app: cada línea sale de un blur de 10px, sube un 20% y tarda un segundo. */

import gsap from "gsap";
import { CustomEase } from "gsap/CustomEase";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(CustomEase, ScrollTrigger);

/** La misma curva que usa Linear: cubic-bezier(0.25, 0.1, 0.25, 1). */
const EASE = CustomEase.create("linear-texto", "0.25, 0.1, 0.25, 1");
const DURACION = 1;
const DESDE = { opacity: 0, filter: "blur(10px)", y: "20%" };
const HASTA = { opacity: 1, filter: "blur(0px)", y: "0%", duration: DURACION, ease: EASE };

function reducido(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function lineas(titulo: HTMLElement): HTMLElement[] {
  const partes = [...titulo.querySelectorAll<HTMLElement>(":scope > span")];
  return partes.length > 0 ? partes : [titulo];
}

function piezasDe(bloque: HTMLElement): HTMLElement[] {
  const piezas: HTMLElement[] = [];
  const vistos = new Set<HTMLElement>();
  const agregar = (elemento: HTMLElement) => {
    if (vistos.has(elemento)) return;
    vistos.add(elemento);
    piezas.push(elemento);
  };

  bloque.querySelectorAll<HTMLElement>("h2, h3, p, dt, dd, .numero, .ilustracion-seccion, .enlace-texto, .marca").forEach((elemento) => {
    if (elemento.matches("h2")) {
      lineas(elemento).forEach(agregar);
      return;
    }
    if (elemento.parentElement?.matches("h2")) return;
    agregar(elemento);
  });

  const boton = bloque.querySelector<HTMLElement>(":scope > .boton");
  if (boton) agregar(boton);
  return piezas;
}

function revelar(piezas: HTMLElement[], extra: gsap.TweenVars): void {
  if (piezas.length === 0) return;
  gsap.fromTo(piezas, DESDE, { ...HASTA, stagger: 0.1, ...extra });
}

export function montarTexto(): void {
  if (reducido()) {
    document.documentElement.classList.remove("con-revelado");
    return;
  }

  try {
    const hero = document.querySelector(".hero");
    const titulo = hero?.querySelector<HTMLElement>("#titulo-principal");
    const bajada = hero?.querySelector<HTMLElement>(".bajada");
    const acciones = hero?.querySelector<HTMLElement>(".acciones");
    const muestra = hero?.querySelector<HTMLElement>(".muestra");
    revelar(
      [
        ...(titulo ? lineas(titulo) : []),
        ...(bajada ? [bajada] : []),
        ...(acciones ? [acciones] : []),
        ...(muestra ? [muestra] : []),
      ],
      { delay: 0.4 },
    );

    document.querySelectorAll<HTMLElement>("main .seccion, .pie-landing").forEach((bloque) => {
      revelar(piezasDe(bloque), {
        scrollTrigger: { trigger: bloque, start: "top 80%", once: true },
      });
    });

    document.addEventListener("pickagent-idioma", () => ScrollTrigger.refresh());
  } catch {
    document.documentElement.classList.remove("con-revelado");
  }
}
