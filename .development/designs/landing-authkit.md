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
- Foco, selección, contraste y preferencias de movimiento/transparencia se
  conservan. Se comprueban escritorio y móvil, navegación y enlace al chat.

## Ajustes de la conversación

Los diálogos tienen burbujas con una cola hacia cada emisor: cliente a la
derecha y agente a la izquierda. Se eliminan la introducción «Esta es la mejor
opción pagando con belo» y la etiqueta «Precio con belo» de la oferta del
ejemplo. La confirmación usa verde de éxito en el ícono y el mensaje, con el
seguimiento debajo. Los importes, el orden del pago y el contenido restante
conservan su significado.

El precio principal y su moneda usan el violeta de marca en una variante
clara para texto sobre fondo oscuro, con contraste suficiente también en ARS.

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
