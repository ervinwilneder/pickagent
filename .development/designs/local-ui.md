# Entorno local y adaptación AuthKit

Revisión: 2026-10-28. Alcance pedido por Lucas: levantar este repositorio en
`/Users/lucasdelrio/belo/pickagent` para aplicar la UI ya diseñada.

## Decisión

Se conserva el chat propio de PickAgent, sus agentes, las vistas MCP en sandbox
y el motor de logística. La referencia visual es el front existente en
`../hotspots-front`: fondo medianoche, vidrio esmerilado, texto azul hielo,
Space Grotesk / Inter / JetBrains Mono y violeta para la acción principal.
No se reemplaza el dominio de envíos por el simulador de entregas del prototipo.

La pantalla conversacional vive en `interfaces/web/agente/pantalla/app.html`.
La portada se adapta a la misma identidad según `landing-authkit.md`, con
fundaciones compartidas en `src/base.css`. Las vistas que sirven los MCP
conservan su presentación y comportamiento actuales. Los archivos de fuentes
se distribuyen localmente con sus licencias OFL.

El estado vacío explica cómo empezar; los ejemplos completan el campo sin
enviar pedidos. Hay un único modo de PickAgent con Belo conectado; no hay
selectores de agente ni interruptor de conexión. Los estados de foco y error
deben seguir siendo visibles en escritorio y móvil.
La bienvenida no usa ícono: título, descripción y ejemplos se alinean al centro.
Los ejemplos dicen «Quiero mandar mercadería a...» y «Compará opciones de envío...».
El primero completa el inicio del mensaje y deja el destino para la persona.
La marca del encabezado se presenta solo como texto, sin el rombo decorativo.
El encabezado no muestra estados técnicos del hilo. Los errores de conexión o
envío se comunican junto al campo de mensaje solo cuando ocurren.

Por indicación de Lucas, la pantalla no muestra aclaraciones sobre el entorno,
credenciales, simulación ni recuentos de herramientas y vistas. La configuración
queda en esta guía y los diagnósticos en la consola de desarrollo.

El composer tiene 132px de alto inicial (el doble del anterior) y un textarea
para varias líneas. Su placeholder es «¿Qué querés mandar?». Enter envía el
mensaje; Shift+Enter agrega un salto de línea.
El bloque del composer tiene 32px de padding inferior para separarlo del pie.
Todos los tamaños de texto de la pantalla aumentan un 20%, también en móvil.
La bienvenida dispone de ancho suficiente para conservar el título en una
línea en escritorio.
Los divisores usan un degradado de opacidad 0% → 100% → 0%, con el color
actual de la línea en el centro y extremos transparentes. Se aplica a los
separadores del chat, la landing y las vistas MCP; el contenido mantiene su
opacidad. Los divisores verticales siguen el mismo patrón de arriba abajo.

## Iconografía

Se usa Phosphor, peso Regular, en el chat, la landing y las vistas MCP de
logística y Belo. Las flechas, checks, cruces, estrellas y marcadores de estado
se reemplazan por SVG oficiales de `@phosphor-icons/core` 2.1.1, publicados
el 29/03/2024. Se conserva la marca como texto, sin agregar un isotipo.

La selección de assets y su licencia MIT viven en `shared/ui/phosphor/`.
`shared/ui/phosphor.ts` y su CSS son el punto único de renderizado. Vite
incluye solo estos archivos locales en las páginas, también en las vistas MCP
autocontenidas: no se requieren CDN ni fuentes de íconos. Los íconos
decorativos quedan ocultos para lectores de pantalla; los indicadores de
estado mantienen etiquetas accesibles. La animación de espera respeta
`prefers-reduced-motion`.

## Modo único

La pantalla usa siempre el agente de atención al cliente (`asistente`) y su
hilo existente, con logística y la cuenta Belo del cliente. La marca y el
nombre en los mensajes son PickAgent. Se eliminan la selección por query
`agente`, la variable `VITE_AGENTE` y la variante `asistente-sin-belo` del backend.
Los enlaces anteriores se normalizan a `/app.html` sin cambiar el modo.

El agente de la empresa sigue siendo una pieza interna: recibe el depósito,
cruza la reserva y confirma el envío. Las cuentas de cliente y empresa siguen
separadas. Ese trabajo interno no es un segundo modo de la interfaz.

## Arranque

`node scripts/local.mjs install`, `node scripts/local.mjs build` y
`node scripts/local.mjs dev` coordinan los cuatro paquetes sin cambiar sus
lockfiles. Requiere Node 24 o superior. El proceso local usa dos cuentas Belo
ficticias enlazadas y el motor de logística; nunca toma credenciales Belo del
entorno. Los datos de la demo del motor no equivalen a transportistas reales.

La API de Anthropic se configura como `ANTHROPIC_API_KEY` en `.env.local`
de la raíz (ignorado por Git) o en el entorno. Sin la clave se pueden recorrer
la pantalla y los servicios, pero no se pueden enviar mensajes hasta configurar
el modelo. No se simulan respuestas del agente.
En ese modo se omiten las suscripciones a movimientos de Belo para impedir
turnos automáticos sin credenciales; el chat puede leer su historial vacío.
La memoria de vista previa y la del agente configurado se guardan en archivos
locales separados, ignorados por Git.

En esta Mac el Node global es 22. Se puede ejecutar sin cambiar esa instalación:

```sh
cd /Users/lucasdelrio/belo/pickagent
npm exec --yes --package=node@24 -- node scripts/local.mjs dev
```

Los mismos argumentos `install` y `build` sirven para reinstalar desde los
lockfiles o volver a comprobar el proyecto. Abrí
`http://127.0.0.1:5173/app.html`, con el único modo de PickAgent. Mastra
Studio queda en `http://localhost:4111`. Ctrl+C cierra todos los procesos.
Los puertos 3001, 3004, 3002, 4111 y 5173 deben estar libres antes de arrancar.

## Validación

Instalación con `npm ci`, typecheck y build de los paquetes; conexión a los MCP
y al historial de Mastra; inspección de la pantalla en escritorio y móvil.
Las respuestas del modelo y el recorrido conversacional completo requieren
la clave y deben reportarse por separado si no está disponible.

Comprobado localmente el 28/10/2026: los cuatro paquetes instalan con sus
lockfiles originales; los typechecks y builds configurados pasan. Los MCP
exponen 11 herramientas / 2 vistas de logística y 12 herramientas / 5 vistas
en cada cuenta Belo; todas esas vistas pueden leerse. La API de agentes y
las páginas de chat y sandbox responden 200. La pantalla se suscribe al hilo;
se verificaron el ejemplo que completa el campo y el diseño
a 390px sin desborde horizontal. Sin clave de Anthropic, no se probaron
respuestas ni pagos mediante la conversación.
