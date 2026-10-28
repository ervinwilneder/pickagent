/** Oscuro es el tema de la portada. Claro lo reemplaza y la elección queda en el navegador. */

const CLAVE = "pickagent-tema";
export type Tema = "oscuro" | "claro";

const COLOR: Record<Tema, string> = { oscuro: "#05060f", claro: "#f4f7fb" };

export function temaGuardado(): Tema {
  try {
    return localStorage.getItem(CLAVE) === "claro" ? "claro" : "oscuro";
  } catch {
    return "oscuro";
  }
}

export function aplicarTema(tema: Tema): void {
  document.documentElement.dataset.tema = tema;
  document.documentElement.style.colorScheme = tema === "claro" ? "light" : "dark";
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", COLOR[tema]);
  document.querySelector('meta[name="color-scheme"]')?.setAttribute("content", tema === "claro" ? "light" : "dark");
  document.querySelectorAll<HTMLButtonElement>("[data-tema-opcion]").forEach((boton) => {
    boton.setAttribute("aria-pressed", String(boton.dataset.temaOpcion === tema));
  });
  try { localStorage.setItem(CLAVE, tema); } catch { /* el modo privado no conserva la elección */ }
}

export function montarTema(): void {
  aplicarTema(temaGuardado());
  document.querySelectorAll<HTMLButtonElement>("[data-tema-opcion]").forEach((boton) => {
    boton.addEventListener("click", () => {
      const opcion = boton.dataset.temaOpcion;
      if (opcion === "claro" || opcion === "oscuro") aplicarTema(opcion);
    });
  });
}
