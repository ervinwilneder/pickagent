/**
 * Esfera que sigue al puntero fino e invierte lo que tiene debajo.
 * En reposo es un punto lleno; sobre un control se abre en anillo;
 * sobre un campo de texto se vuelve una barra. Al presionar se achica.
 * En táctil no se monta. Con movimiento reducido se pega al puntero.
 */

const FORMAS = {
  punto: { sx: 0.16, sy: 0.16, radio: 50, relleno: 1 },
  arrastre: { sx: 0.56, sy: 0.56, radio: 50, relleno: 0 },
  click: { sx: 1, sy: 1, radio: 50, relleno: 0 },
  texto: { sx: 0.02, sy: 0.22, radio: 0, relleno: 1 },
} as const;

type Modo = keyof typeof FORMAS;

const RESORTE_POSICION = { k: 700, c: 45, m: 0.35 };
const RESORTE_ESCALA = { k: 520, c: 32, m: 0.5 };

const SELECTOR_TEXTO = 'textarea:not(:disabled), [contenteditable="true"], [data-cursor="text"], input:not(:disabled):is([type="text"], [type="email"], [type="tel"], [type="search"], [type="url"], [type="password"], [type="number"], :not([type]))';
const SELECTOR_CLICK = 'a, button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), label, summary, [role="button"]:not([aria-disabled="true"]), [data-cursor="grow"]';
const SELECTOR_ARRASTRE = '.cursor-grab, [data-cursor="drag"]';

function modoDe(objetivo: EventTarget | null): Modo {
  if (!(objetivo instanceof Element)) return "punto";
  if (objetivo.closest(SELECTOR_TEXTO)) return "texto";
  if (objetivo.closest(SELECTOR_CLICK)) return "click";
  if (objetivo.closest(SELECTOR_ARRASTRE)) return "arrastre";
  return "punto";
}

/** Solución exacta del resorte amortiguado. El paso numérico se dispara con esta rigidez. */
function paso(valor: number, velocidad: number, objetivo: number, resorte: { k: number; c: number; m: number }, dt: number, umbral: number, quieto: boolean): [number, number] {
  if (quieto) return [objetivo, 0];
  const y0 = valor - objetivo;
  if (Math.abs(y0) < umbral && Math.abs(velocidad) < umbral) return [objetivo, 0];
  const omega0 = Math.sqrt(resorte.k / resorte.m);
  const zeta = resorte.c / (2 * Math.sqrt(resorte.k * resorte.m));
  if (zeta < 1) {
    const omegaD = omega0 * Math.sqrt(1 - zeta * zeta);
    const A = y0;
    const B = (velocidad + zeta * omega0 * A) / omegaD;
    const decaimiento = Math.exp(-zeta * omega0 * dt);
    const coseno = Math.cos(omegaD * dt);
    const seno = Math.sin(omegaD * dt);
    const y = decaimiento * (A * coseno + B * seno);
    const v = -zeta * omega0 * y + decaimiento * omegaD * (-A * seno + B * coseno);
    return [objetivo + y, v];
  }
  const delta = omega0 * Math.sqrt(zeta * zeta - 1);
  const raiz1 = -zeta * omega0 + delta;
  const raiz2 = -zeta * omega0 - delta;
  const A = (velocidad - raiz2 * y0) / (raiz1 - raiz2);
  const B = y0 - A;
  const exp1 = Math.exp(raiz1 * dt);
  const exp2 = Math.exp(raiz2 * dt);
  return [objetivo + A * exp1 + B * exp2, A * raiz1 * exp1 + B * raiz2 * exp2];
}

export function montarCursor(): void {
  const fino = window.matchMedia("(pointer: fine)");
  if (!fino.matches) {
    const alCambiar = () => {
      if (!fino.matches) return;
      fino.removeEventListener("change", alCambiar);
      montarCursor();
    };
    fino.addEventListener("change", alCambiar);
    return;
  }

  const quieto = window.matchMedia("(prefers-reduced-motion: reduce)");
  const esfera = document.createElement("div");
  esfera.className = "cursor-esfera";
  esfera.setAttribute("aria-hidden", "true");
  document.body.append(esfera);

  let modo: Modo = "punto";
  let presionado = false;
  let colocado = false;
  let x = 0;
  let y = 0;
  let vx = 0;
  let vy = 0;
  let sx: number = FORMAS.punto.sx;
  let sy: number = FORMAS.punto.sy;
  let vsx = 0;
  let vsy = 0;
  let objetivoX = 0;
  let objetivoY = 0;
  let escalaX = FORMAS.punto.sx;
  let escalaY = FORMAS.punto.sy;
  let ultimo = 0;
  let cuadro = 0;
  let desplazar = 0;

  function fijarEscala() {
    const forma = FORMAS[modo];
    const factor = presionado ? 0.85 : 1;
    escalaX = forma.sx * factor;
    escalaY = forma.sy * factor;
    esfera.style.borderRadius = `${forma.radio}px`;
    esfera.style.backgroundColor = `rgba(255, 255, 255, ${forma.relleno})`;
  }

  function fijarModo(objetivo: EventTarget | null) {
    const siguiente = modoDe(objetivo);
    if (siguiente === modo) return;
    modo = siguiente;
    fijarEscala();
  }

  function pintar() {
    esfera.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${sx}, ${sy})`;
  }

  function pedirCuadro() {
    if (cuadro) return;
    ultimo = 0;
    cuadro = requestAnimationFrame(animar);
  }

  function animar(ahora: number) {
    cuadro = 0;
    const dt = ultimo === 0 ? 1 / 60 : Math.min(0.032, (ahora - ultimo) / 1000);
    ultimo = ahora;
    const sinResorte = quieto.matches;
    [x, vx] = paso(x, vx, objetivoX, RESORTE_POSICION, dt, 0.2, sinResorte);
    [y, vy] = paso(y, vy, objetivoY, RESORTE_POSICION, dt, 0.2, sinResorte);
    [sx, vsx] = paso(sx, vsx, escalaX, RESORTE_ESCALA, dt, 0.001, sinResorte);
    [sy, vsy] = paso(sy, vsy, escalaY, RESORTE_ESCALA, dt, 0.001, sinResorte);
    pintar();
    const sigue = x !== objetivoX || y !== objetivoY || sx !== escalaX || sy !== escalaY;
    if (sigue) cuadro = requestAnimationFrame(animar);
  }

  function alMover(evento: PointerEvent) {
    if (evento.pointerType === "touch") return;
    objetivoX = evento.clientX;
    objetivoY = evento.clientY;
    if (!colocado || quieto.matches) {
      x = objetivoX;
      y = objetivoY;
      vx = 0;
      vy = 0;
      colocado = true;
    }
    esfera.style.opacity = "1";
    fijarModo(evento.target);
    pedirCuadro();
  }

  function alPresionar(evento: PointerEvent) {
    if (evento.pointerType === "touch") return;
    presionado = true;
    fijarEscala();
    pedirCuadro();
  }

  function alSoltar() {
    if (!presionado) return;
    presionado = false;
    fijarEscala();
    pedirCuadro();
  }

  function alSalir() {
    esfera.style.opacity = "0";
    alSoltar();
  }

  function alDesplazar() {
    if (desplazar) return;
    desplazar = requestAnimationFrame(() => {
      desplazar = 0;
      fijarModo(document.elementFromPoint(objetivoX, objetivoY));
      pedirCuadro();
    });
  }

  fijarEscala();
  pintar();
  window.addEventListener("pointermove", alMover, { passive: true });
  window.addEventListener("scroll", alDesplazar, { passive: true, capture: true });
  window.addEventListener("pointerdown", alPresionar, { capture: true });
  window.addEventListener("pointerup", alSoltar, { capture: true });
  window.addEventListener("pointercancel", alSoltar, { capture: true });
  window.addEventListener("blur", alSoltar);
  document.addEventListener("pointerleave", alSalir);
  window.addEventListener("blur", alSalir);
}
