# pickagent: logística con pago por belo

Revisión: 2026-10-28. Estado: borrador para construir hoy, en el Buildathon 001.

## Qué es

pickagent es un agente que resuelve envíos: la persona le dice qué tiene que
mandar, a dónde y para cuándo; el agente junta los datos que faltan con un
formulario, busca entre los proveedores de logística agregados, arma las
mejores ofertas y cobra por belo, con descuento para quien paga así.

Tres piezas:

- **El motor de logística** (`engines/logistica`): agrega proveedores y sus
  servicios, y responde cotizaciones y reservas. Lo exponen un MCP con vistas
  (MCP Apps) y, después, una API para que los proveedores carguen lo suyo.
- **belo como pasarela**: el server MCP de belo (`interfaces/mcp`) cotiza y
  confirma el pago, con la vista de aprobación que ya existe.
- **pickagent, el agente** (`interfaces/web/agente`): el cliente siempre
  encendido sobre Mastra, conectado a los dos MCP, con la pantalla propia.

## Historia de usuario

1. "Necesito mandar 20 cajas de repuestos de Villa Crespo a Rosario el jueves
   antes de las 10."
2. pickagent abre el **formulario de envío** en el chat: origen, destino,
   fecha y hora límite, qué es, peso y volumen, si es frágil o refrigerado,
   contacto. Lo que la persona ya dijo viene precargado.
3. Con el pedido completo, el agente pide **ofertas** al motor: proveedores
   cuyas zonas cubren el trayecto, con capacidad y ventana compatibles. El
   motor calcula distancia, tiempo estimado y precio por servicio, y aplica
   el descuento por pago con belo.
4. El agente presenta las **mejores ofertas** en una vista: proveedor,
   vehículo, retiro y entrega estimados, precio de lista, precio pagando con
   belo. La persona elige.
5. El agente **reserva** en el motor y **cobra** por belo: cotiza la
   transferencia al proveedor por el monto con descuento, muestra la vista de
   aprobación, y confirma cuando la persona aprueba.
6. El motor marca la reserva como pagada, y la persona recibe el resumen del
   envío con el código de seguimiento.

## El motor

Dominio en términos del rubro:

- **Proveedor**: empresa de logística (nombre, belotag o CVU para cobrar,
  descuento por pago con belo).
- **Servicio**: lo que un proveedor ofrece: tipo de vehículo (moto, utilitario,
  camión chico, camión), zonas que cubre (origen y destino por localidad),
  tarifa (base + por km + por kg), capacidad (kg y m³), ventanas horarias,
  días de anticipación mínimos, aptitudes (frágil, refrigerado).
- **Pedido**: lo que la persona quiere mandar (el formulario).
- **Oferta**: un servicio aplicado a un pedido: precio, precio con belo,
  retiro y entrega estimados, ruta (distancia y tiempo).
- **Reserva**: una oferta elegida, con estado (reservada, pagada, en curso,
  entregada) y código de seguimiento.

Reglas: las localidades conocidas tienen coordenadas; la distancia es
haversine por 1,3 de factor de ruta; el tiempo es distancia sobre velocidad
media del vehículo más tiempos de carga y descarga; una oferta solo existe si
el servicio cubre las dos localidades, la capacidad alcanza y la ventana
permite llegar antes de la hora límite. Las ofertas se ordenan por precio
con belo y se devuelven hasta cinco. Los proveedores y servicios de hoy son
datos de ejemplo cargados al arrancar.

Arquitectura: hexagonal mínima. Dominio y casos de uso en `src/motor/`,
puerto de almacenamiento con adaptador en memoria, y el MCP como interfaz.
La API REST para proveedores queda para después.

## El MCP de logística

Tools con vista:

- `pedido_envio`: abre el formulario con lo que el agente ya sabe
  precargado; la vista devuelve el pedido completo al chat (`ui/message`).
- `ofertas`: busca y muestra las ofertas para un pedido; la vista deja
  elegir una y se lo dice al chat.
- `reservar`: crea la reserva de una oferta y devuelve cuánto cobrar, a
  quién (belotag o CVU del proveedor) y el descuento aplicado.
- `marcar_pagada`: el agente la llama con el id de la transacción de belo
  después de confirmar.
- `seguimiento`: estado de una reserva.
- `proveedores` y `cargar_servicio`: el lado del proveedor, sin vista hoy.

Mismo stack que el MCP de belo: Mastra `MCPServer`, vistas con la estética
de belo Agentic Banking (misma hoja de estilos), puerto y adaptadores.

## pickagent, el agente

El agente de `interfaces/web/agente`, renombrado, con los dos MCP en el
`MCPClient` (`logistica` y `belo`), instrucciones del flujo y las señales de
belo. La pantalla pasa a conectar con los dos servers para renderizar las
vistas de ambos.

## Quién le paga a quién

El cliente le paga a **pickagent**, no al transportista. pickagent tiene su
propia cuenta de belo (la de la empresa): su belotag es el destinatario de
todo cobro por adelantado. Con el evento `movimiento.nuevo` de esa cuenta,
pickagent cruza cada depósito con las reservas pendientes de pago
(`reservas_pendientes`) y marca la que coincide como pagada.

La **liquidación** a los transportistas es un proceso de fondo de pickagent:
no pasa a la vista del cliente, el agente no la menciona ni la propone, y no
es parte de la demo. Existe y es viable: cada reserva lleva su
liquidación (neto para el transportista = precio con belo menos la comisión
de pickagent; comisión para pickagent), y `liquidaciones` netea por
transportista lo pagado y no liquidado. Con saldo positivo, pickagent
transfiere desde su belo al belotag o CVU del transportista y marca
`marcar_liquidada`. Para el contra entrega con belo air, cobra el chofer en
mano por el transportista, así que el transportista le debe a pickagent la
comisión y el neteo lo descuenta.

Hoy hay un único cliente, ya logueado: no hay capa de usuarios. El asistente
personal usa la cuenta de belo del cliente; pickagent, la de la empresa. En la
demo son dos cuentas de ejemplo de belo enlazadas: una transferencia del
cliente al belotag de pickagent entra como depósito en la cuenta de
pickagent.

## El asistente personal y el beneficio de conectar belo

pickagent es el agente de la empresa. La persona tiene el suyo: un asistente
personal (en nuestra pantalla hoy; en Claude o ChatGPT mañana) que usa a
pickagent como a cualquier servicio, por MCP. pickagent queda expuesto de dos
formas: el MCP del motor (tools con vistas: formulario, ofertas, reserva,
seguimiento) y un MCP del agente (`ask_pickagent`) para pedirle planificación
y recomendaciones.

Conectar el MCP de belo de la persona a su asistente le da tres cosas que sin
belo no tiene:

1. **Precio con belo**: cada oferta trae precio de lista y precio pagando con
   belo, con el descuento del transportista (liquidación instantánea, sin
   contracargos). El asistente siempre muestra el ahorro.
2. **Pago en un paso**: el asistente cotiza la transferencia al transportista
   con el monto exacto y muestra la vista de aprobación de belo; la persona
   aprueba y listo, sin copiar CVU ni montos. Sin belo, pickagent entrega el
   CVU y el monto de lista, y la reserva queda pendiente hasta que el
   transportista vea el pago.
3. **Confirmación automática**: el asistente escucha `movimiento.nuevo` de la
   cuenta de belo; cuando sale el pago, marca la reserva pagada y avisa con el
   código de seguimiento, sin que nadie pregunte.

4. **Pago contra entrega con belo air**: belo air permite pedir y mandar
   plata acercando los teléfonos, entre usuarios de belo, al instante (quien
   cobra crea el pedido con el monto, quien paga acerca el teléfono, revisa y
   confirma). En logística eso es el "contra entrega" sin efectivo: la
   persona no paga nada al reservar; cuando el chofer retira o entrega, pide
   desde su belo el monto exacto de la reserva, la persona acerca su
   teléfono, revisa y confirma, y la plata llega en el acto. El motor lo modela como capacidad del transportista
   (`contraEntrega`) y como modo de pago de la reserva
   (`contra_entrega_belo_air`); el asistente lo ofrece cuando la oferta lo
   acepta, no cotiza nada, y la reserva se confirma sola cuando llega el
   evento del pago. Sirve para quien quiere ver la carga retirada antes de
   pagar, para cuando paga quien recibe, y para los transportistas, que cobran
   en el momento sin manejar efectivo ni esperar transferencias.

Y conoce la cuenta: si no alcanza en pesos pero hay USDT, propone convertir
antes de pagar. La pantalla tiene un switch de agente (pickagent / mi asistente) y, para el
asistente, un interruptor "belo conectado" que cambia entre el asistente con
belo y sin belo, cada uno con su hilo.

## Riesgos

- El pago es una transferencia belo a belo del usuario al proveedor; en el
  sandbox el "usuario" es la organización de la API key. Para la demo
  alcanza; con OAuth por persona queda real.
- Sin mapas externos: distancias por coordenadas de localidades conocidas.
  Suficiente para AMBA e interior en la demo.
