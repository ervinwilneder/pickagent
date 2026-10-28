# Portada de PickAgent · criterios compartidos con el chat

Revisión: 2026-10-28. Lucas pidió aplicar a `https://belo-agente.vercel.app/`
los criterios de UI/UX que ya aprobó en el chat. Ese dominio sirve la portada
de PickAgent del mismo paquete `interfaces/web/agente/pantalla`.

## Alcance

La dirección visual está fijada por el chat: medianoche, texto azul hielo,
Space Grotesk e Inter locales, vidrio sutil, violeta para la acción primaria,
Phosphor Regular y divisores que se desvanecen hacia los extremos. La base
compartida queda en `src/base.css`; el chat conserva su composición actual.

La portada ayuda a quien necesita enviar mercadería a entender el recorrido
y abrir el chat. Conserva la demostración de conversación, los cuatro pasos,
la información para transportistas y las ventajas de pagar con Belo. Todos
los CTA abren `/app.html`, el único modo del producto.

Se conserva el significado de las condiciones de envío y pago. El ejemplo
de conversación mantiene sus importes y se identifica como ejemplo; no se
presenta como un pedido en vivo. El resultado financiero se muestra después
de la aprobación. No se agregan métricas, clientes, precios ni capacidades.

## Decisiones

- Encabezado con marca tipográfica y navegación simple. Sin isotipos genéricos.
- Primer bloque con promesa y una acción principal; conversación como prueba
  concreta del funcionamiento, sin badges técnicos ni mensajes de conexión.
- Los cuatro pasos se muestran como una secuencia; no como tarjetas repetidas.
- Transportistas e integraciones se explican en su sección. API y catálogo
  permanecen porque son opciones relevantes para ese público.
- Las ventajas de Belo se muestran en un único recorrido. Se retira la
  comparación con el modo sin Belo que ya no existe en la interfaz.
- Foco, contraste y preferencias de movimiento/transparencia se conservan.
  El texto seleccionado se pinta con el violeta de la acción primaria. Se
  comprueban escritorio y móvil, navegación y enlace al chat.
- Con puntero fino, portada y chat muestran una esfera que sigue al cursor
  e invierte el color de debajo. En reposo es un punto lleno de 16px; sobre
  un enlace o botón se abre en un anillo de 100px; sobre un campo de texto
  se vuelve una barra. Al presionar se achica a 0,85. En táctil no aparece.
  Con movimiento reducido se pega al puntero, sin resorte.
- El pie deja la marca sola arriba. Los tres
  grupos van de punta a punta, con el mismo aire entre ellos. Los íconos de redes e IA son las
  marcas de Loybox, a 44px. Las redes no navegan. ChatGPT, Claude, Gemini y
  Perplexity abren una pregunta sobre pickagent en ese idioma. El idioma
  reescribe toda la portada en español de Argentina, español de Latinoamérica
  o inglés, y la elección queda en el navegador.
- El encabezado de la portada y del chat tiene dos botones de tema. Oscuro
  es el de siempre. Claro repinta fondo, texto, vidrio y bordes. La elección
  queda en el navegador.
- El texto de la portada entra como en Linear. Cada línea arranca con blur de
  10px, un 20% más abajo y opacidad 0, y en un segundo llega a su lugar con la
  curva 0.25, 0.1, 0.25, 1. El título espera 0,4s y cada línea siguiente, 0,1s.
  El resto aparece al entrar en pantalla. Con movimiento reducido el texto
  está visible desde el primer instante.

## Ajustes de la conversación

Los diálogos tienen burbujas con una cola hacia cada emisor: cliente a la
derecha y agente a la izquierda. Se eliminan la introducción «Esta es la mejor
opción pagando con belo» y la etiqueta «Precio con belo» de la oferta del
ejemplo. La confirmación usa verde de éxito en el ícono y el mensaje, con el
seguimiento debajo. Los importes, el orden del pago y el contenido restante
conservan su significado.

El precio principal y su moneda usan el violeta de marca en una variante
clara para texto sobre fondo oscuro. En tema claro esa variante es más oscura
para seguir leyéndose. El contraste alcanza también en ARS.

## Imagen de envíos y pagos

La ilustración provista por Lucas acompaña «El envío y el pago, en el mismo
lugar», debajo del texto introductorio y al lado de los beneficios en
escritorio. Se conserva completa, con su transparencia y proporción original,
sin marco. En móvil queda entre la introducción y los beneficios, dentro del
ancho disponible. Tiene descripción alternativa y carga diferida.

La segunda ilustración provista por Lucas acompaña «¿Tenés una empresa de
transporte?», debajo de la introducción. Comparte tamaño y comportamiento
adaptable con la imagen de pagos, conserva la transparencia y se muestra
completa. Su alternativa describe el catálogo de transporte y la conexión API.

La entrega sigue la ruta de código acordada en este chat: commit en `main`.
Los dominios publicados pertenecen a un equipo de Vercel que no está conectado
a esta sesión; un push no confirma por sí solo que el sitio público cambió.
