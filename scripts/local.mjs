#!/usr/bin/env node
/** Arranque local reproducible. Usa exclusivamente las cuentas Belo ficticias. */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packages = ["interfaces/mcp", "engines/logistica", "interfaces/web/agente", "interfaces/web/agente/pantalla"];
const mode = process.argv[2] ?? "dev";
const children = new Set();
let closing = false;

if (Number(process.versions.node.split(".")[0]) < 24) {
  console.error("PickAgent necesita Node 24 o superior. Activá esa versión y volvé a ejecutar el comando.");
  process.exit(1);
}
if (!["install", "build", "dev"].includes(mode)) {
  console.error("Uso: node scripts/local.mjs [install|build|dev]");
  process.exit(1);
}

if (existsSync(path.join(root, ".env.local"))) process.loadEnvFile(path.join(root, ".env.local"));
const env = { ...process.env, PATH: `${path.dirname(process.execPath)}${path.delimiter}${process.env.PATH ?? ""}` };
const preview = !env.ANTHROPIC_API_KEY;
// El arranque local siempre usa simulación, aunque la terminal tenga credenciales reales.
delete env.BELO_API_KEY;
delete env.BELO_BASE_URL;

function run(label, cwd, args, overrides = {}) {
  console.log(`[${label}] npm ${args.join(" ")}`);
  const child = spawn("npm", args, { cwd: path.join(root, cwd), env: { ...env, ...overrides }, detached: true, stdio: "inherit" });
  children.add(child);
  child.on("error", (error) => { console.error(`[${label}] ${error.message}`); stop(1); });
  child.once("exit", () => children.delete(child));
  return child;
}
function finished(child) {
  return new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code, signal) => code === 0 ? resolve() : reject(new Error(`El proceso terminó con ${signal ?? code}.`)));
  });
}
function listening(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ host: "127.0.0.1", port });
    socket.setTimeout(500);
    const done = (connected) => { socket.destroy(); resolve(connected); };
    socket.once("connect", () => done(true));
    socket.once("error", () => done(false));
    socket.once("timeout", () => done(false));
  });
}
async function ready(port, child) {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline && child.exitCode === null && child.signalCode === null) {
    if (await listening(port)) return;
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(`No arrancó el servicio del puerto ${port}. Revisá su salida arriba.`);
}
function stop(code = 0) {
  if (closing) return;
  closing = true;
  for (const child of children) {
    try { process.kill(-child.pid, "SIGTERM"); } catch {}
  }
  setTimeout(() => {
    for (const child of children) {
      try { process.kill(-child.pid, "SIGKILL"); } catch {}
    }
    process.exit(code);
  }, 1500);
}
process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());

try {
  if (mode === "install") {
    for (const pkg of packages) await finished(run(pkg, pkg, ["ci", "--no-fund", "--no-audit"]));
  } else {
    for (const pkg of packages) {
      if (!existsSync(path.join(root, pkg, "node_modules"))) throw new Error("Faltan dependencias. Ejecutá primero: node scripts/local.mjs install");
    }
    if (mode === "build") {
      await finished(run("belo", packages[0], ["run", "build"]));
      await finished(run("logística", packages[1], ["run", "build"]));
      await finished(run("agentes", packages[2], ["run", "typecheck"]));
      await finished(run("pantalla", packages[3], ["run", "build"]));
      console.log("Builds y typechecks locales completos.");
    } else {
      for (const port of [3001, 3004, 3002, 4111, 5173]) {
        if (await listening(port)) throw new Error(`El puerto ${port} ya está ocupado. Detené ese proceso o usá el entorno que ya está abierto.`);
      }
      for (const pkg of packages.slice(0, 2)) {
        if (!existsSync(path.join(root, pkg, "dist/version"))) await finished(run(pkg, pkg, ["run", "build:ui"]));
      }
      const client = run("belo cliente · cuenta de ejemplo", packages[0], ["run", "serve"], {
        PORT: "3001", BELO_FALSO_PAR_BELOTAG: "pickagent", BELO_FALSO_PAR_URL: "http://localhost:3004", BELO_FALSO_NOMBRE: "Cliente de pickagent",
      });
      await ready(3001, client);
      const company = run("belo pickagent · cuenta de ejemplo", packages[0], ["run", "serve"], { PORT: "3004", BELO_FALSO_NOMBRE: "pickagent", BELO_FALSO_PAR_BELOTAG: "", BELO_FALSO_PAR_URL: "" });
      await ready(3004, company);
      const logistics = run("logística", packages[1], ["run", "serve"], { PORT: "3002", PICKAGENT_BELOTAG: "pickagent" });
      await ready(3002, logistics);
      const agents = run("agentes", packages[2], ["run", "dev"], {
        PORT: "4111", BELO_MCP_URL: "http://localhost:3001/mcp", PICKAGENT_BELO_MCP_URL: "http://localhost:3004/mcp", LOGISTICA_MCP_URL: "http://localhost:3002/mcp", BELO_AGENTE_PERSONA: "local",
        PICKAGENT_LOCAL_PREVIEW: preview ? "1" : "0",
        BELO_AGENTE_DB: `file:${path.join(root, packages[2], preview ? "pickagent-local-preview.db" : "pickagent-local.db")}`,
      });
      await ready(4111, agents);
      const screen = run("pantalla", packages[3], ["run", "dev", "--", "--host", "127.0.0.1", "--strictPort"], {
        VITE_MASTRA_URL: "http://localhost:4111", VITE_BELO_MCP_URL: "http://localhost:3001/mcp", VITE_LOGISTICA_MCP_URL: "http://localhost:3002/mcp", VITE_SANDBOX_URL: "http://localhost:5173/sandbox.html", VITE_PERSONA: "local", VITE_LOCAL_SIN_MODELO: preview ? "1" : "0",
      });
      await ready(5173, screen);
      console.log("\nPickAgent: http://127.0.0.1:5173/app.html\nLanding: http://127.0.0.1:5173/\nMastra Studio: http://localhost:4111\nBelo: cuentas de ejemplo. Ctrl+C detiene todos los servicios.");
      if (!env.ANTHROPIC_API_KEY) console.warn("Falta ANTHROPIC_API_KEY: el chat queda en vista previa. Agregala en .env.local de la raíz y reiniciá este comando.");
      for (const child of children) child.once("exit", (code, signal) => {
        if (!closing) { console.error(`Un servicio se detuvo (${signal ?? code}). Cerrando el entorno local.`); stop(1); }
      });
    }
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  if (children.size) stop(1); else process.exitCode = 1;
}
