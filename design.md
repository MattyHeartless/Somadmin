# SOMA Music Hub - Dirección de diseño para Admin

## Propósito

El panel administra eventos, reservaciones y accesos de SOMA Music Hub. Debe sentirse como la consola de operación de un club nocturno, no como un SaaS genérico ni como un cartel de festival. La identidad aporta energía y oscuridad. La interfaz aporta orden, rapidez y certeza operativa.

**Lectura de diseño:** administración de club para personal de operación, con lenguaje de cabina techno nocturna, inspirado en venues de Vancouver y en la identidad gráfica de SOMA.

## Lectura de referencias

Las fotografías de DJ, público y escenario comparten una escena oscura, iluminación puntual y contrastes de magenta, azul-violeta y rojo. Comunican una noche activa y humana. El cartel de evento confirma la energía cromática, aunque sus tipografías manuscritas y neón no deben pasar al producto administrativo.

La publicación de SOMA aporta un segundo registro: cielo turquesa, nubes naranjas, volumen blando blanco y tipografía divertida. El logo negro angular de SOMA es el ancla correcta para el producto: sobrio, geométrico y legible.

La combinación resultante es un control room oscuro: superficies casi negras y técnicas, datos con tipografía precisa, fotografías inmersivas para los eventos y destellos de color sólo donde dan información o identidad.

## Diales de diseño

| Dial | Valor | Decisión |
| --- | ---: | --- |
| Variación visual | 5/10 | Composición ordenada, con hero editorial sólo en dashboard y detalle de evento. |
| Movimiento | 3/10 | Transiciones cortas para feedback; nunca movimiento constante durante operación. |
| Densidad | 7/10 | Información visible y escaneable, especialmente en eventos, reservaciones y acceso. |

## Principios

1. **La operación gana a la decoración.** Una cifra, estado o acción crítica debe ser entendible en menos de un segundo.
2. **La noche es el ambiente, no el contraste del texto.** Las fotos reciben un velo oscuro para que controles y texto nunca dependan del fondo.
3. **Color con significado.** El acento SOMA identifica foco y navegación; los colores de estado sólo expresan estados reales.
4. **La marca entra en momentos de contexto.** Dashboard, detalle de evento, login y scanner pueden ser expresivos. Tablas, formularios y auditoría son sobrios.
5. **El scanner es una herramienta física.** Debe poder operarse con una mano, bajo poca luz y con filas de personas esperando.

## Sistema visual

### Tema base

El admin se lanza en modo oscuro fijo. Es coherente con el venue, protege la visión nocturna del staff y da continuidad al logo. No alternar secciones claras dentro de una pantalla.

| Token | Valor sugerido | Uso |
| --- | --- | --- |
| canvas | #0B0C0F | Fondo general, nunca negro puro. |
| surface | #13151A | Barra lateral, formularios y paneles. |
| surface-raised | #1A1D24 | Menús, modal y filas activas. |
| line | #2A2E38 | Bordes y separadores discretos. |
| text-primary | #F3F4F6 | Encabezados y valores. |
| text-secondary | #A7AAB4 | Etiquetas, metadatos y ayuda. |
| soma-accent | #B8FF3D | Foco, navegación activa y CTA principal. |
| soma-accent-ink | #11150A | Texto sobre el acento. |
| photo-violet | #7D5CFF | Tratamiento editorial de imágenes, no CTA. |
| photo-magenta | #FF3DAB | Sólo detalles visuales y media. |

El verde ácido remite a los flashes de la pista y permite una interacción inequívoca sobre el negro. No usar degradados arcoíris ni glow neón continuo. Violeta y magenta aparecen en fotografía, overlays y gráficas secundarias; no compiten con el acento operativo.

### Estados semánticos

| Estado | Color | Tratamiento |
| --- | --- | --- |
| Éxito / check-in autorizado | #6EE7A5 | Fondo tenue y texto claro. |
| Atención / cupo bajo | #FFD166 | Mensaje explícito, no sólo color. |
| Error / acceso denegado | #FF6B6B | Fondo tenue y causa legible. |
| Informativo | #78B7FF | Datos neutros y links secundarios. |
| Inactivo / terminado | #7B808C | Texto y badge apagados. |

Cada badge debe incluir texto. Ningún estado se comunica sólo con un punto de color.

### Tipografía

- **Interfaz y datos:** IBM Plex Sans o Geist, con números tabulares.
- **Timestamps y códigos:** IBM Plex Mono o Geist Mono.
- **Marca:** usar el logo SOMA provisto como asset. No recrearlo ni sustituirlo con una fuente. La tipografía inflada de los posters es una referencia para campañas públicas, no para el admin.

| Elemento | Tamaño / peso |
| --- | --- |
| Título de vista | 28-32 px / 600 |
| Título de panel | 16-18 px / 600 |
| Métrica principal | 32-40 px / 600, tabular |
| Texto de tabla | 14 px / 400 |
| Etiqueta y metadato | 12 px / 500 |
| Código y hora | 12-14 px / mono |

### Forma y profundidad

- Radio: 10 px en inputs y paneles; 8 px en botones; pills sólo para estados.
- Bordes: 1 px con el token line. Evitar sombras flotantes pronunciadas.
- Paneles: superficies opacas. No usar glassmorphism en tablas, formularios ni scanner.
- Textura opcional: grano muy sutil, fijo y fuera de los contenedores con scroll. Debe desaparecer con preferencia de transparencia reducida.

## Estructura de navegación

En escritorio, una barra lateral fija de 248 px contiene el logo SOMA, la navegación y el usuario actual. La navegación debe ser textual e incluir icono de una sola familia. El estado activo usa soma-accent y un fondo sutil.

- Dashboard
- Eventos
- Reservaciones
- Clientes
- Staff
- Acceso: Scanner y registro de accesos
- Configuración
- Perfil y cerrar sesión

En móvil, el scanner evita la barra lateral. Usa una cabecera compacta con volver, evento seleccionado y menú de sesión. Las demás vistas usan menú desplegable o navegación inferior de pocas acciones, sin replicar todas las opciones simultáneamente.

## Pantallas clave

### Login

Pantalla dividida en escritorio. A la izquierda, una fotografía real de SOMA o del venue, con overlay negro y logo. A la derecha, el formulario compacto. En móvil se muestra el formulario primero, con una franja fotográfica breve. No usar fotos detrás de campos.

### Dashboard

El dashboard abre con el próximo evento, no con tarjetas genéricas. Una banda editorial puede usar la imagen del evento con overlay oscuro y mostrar nombre, estado, inicio y fin, OccupiedSlots / Capacity y una acción contextual como Abrir scanner.

Debajo, las métricas operativas se organizan en una cuadrícula desigual de dos columnas: ocupación y accesos en vivo a la izquierda, eventos recientes y alertas de cupo a la derecha. Evitar seis tarjetas idénticas. Los números usan figuras tabulares y cada métrica indica claramente su periodo o evento.

### Lista y detalle de eventos

La lista es una tabla responsiva, no una galería de cards. En escritorio contiene imagen, evento, inicio, cupo ocupado, disponibles, estado y acciones. La miniatura es de 48 x 48 px, con recorte consistente y sin texto superpuesto. En móvil, cada fila se convierte en un bloque compacto con título, fecha, estado y ocupación; las acciones viven en un menú contextual.

El encabezado del detalle usa una imagen panorámica real del evento con un overlay del 70-80% de canvas. El contenido crítico queda sobre una base opaca. Las secciones son resumen, reservaciones, accesos, imágenes y configuración. El estado del evento siempre conserva acciones explícitas: publicar, cerrar, finalizar o cancelar.

### Reservaciones, clientes y staff

Estas pantallas son de trabajo diario: fondo plano, filtros persistentes, resultados rápidos y cero ornamentación fotográfica dentro de la tabla.

- Filtros arriba, con labels visibles.
- Búsqueda por nombre, correo, QR o evento según el contexto.
- Estados en badges con texto.
- Detalle en panel lateral o ruta dedicada, no un modal gigante.
- Estados vacío, carga y error con instrucciones concretas.

### Scanner de acceso

Esta es la pantalla más importante del producto en móvil.

- Cabecera: volver y evento seleccionado.
- Modo: Entrada / Salida con selector segmentado grande.
- Área de cámara 4:5, con marco simple y alto contraste.
- Resultado de la última lectura debajo del área de cámara.
- Acción alternativa: ingresar código manual.

El área de cámara ocupa la mayor parte del viewport y no contiene decoración. Al validar, el resultado reemplaza temporalmente el área inferior, no abre un modal.

- **Autorizado:** verde semántico, nombre, evento y hora.
- **Denegado:** rojo semántico, razón específica y siguiente acción.
- **Duplicado:** color de atención, hora de entrada o salida previa.

Incluir vibración y sonido opcionales, configurables desde el dispositivo. Usar un gesto o botón explícito para reanudar cámara. No depender de una animación para comunicar éxito o error.

## Imagen y tratamiento de media

Las fotos del venue son imprescindibles en login, dashboard, detalle de evento y assets de eventos. El lenguaje buscado es público real, DJs, cabina, banda o pista; contraste alto, sombras profundas y luces magenta, azul, rojo o verde; encuadres documentales y no fotos de stock corporativas.

La imagen de Instagram de SOMA muestra que las campañas pueden tener turquesa, naranja y tipografía blanda. Reservar ese lenguaje para thumbnails y material promocional que el admin cargue. No convertir formularios ni tablas en una campaña visual.

El logo debe tener una versión clara para la barra oscura. Conservar un área de seguridad generosa y no aplicarle glow, degradados o efectos 3D.

## Interacción y movimiento

Las transiciones duran 150-200 ms y sólo animan opacidad o transform. Su función es confirmar una acción, no simular una pista de baile.

- Hover en filas, botones y miniaturas: contraste o elevación mínima.
- Cambio de datos por polling: actualización silenciosa, con timestamp visible si afecta decisiones operativas.
- Scanner: transición breve y táctil al resultado.
- Respetar prefers-reduced-motion; sin loops, parallax ni strobes.

## Accesibilidad y operación nocturna

- Contraste WCAG AA como mínimo; texto secundario nunca se pierde en el fondo.
- Objetivos táctiles de al menos 44 x 44 px en móvil.
- No usar magenta, verde o rojo como única señal.
- Foco de teclado visible en verde SOMA con contorno adicional claro.
- Cámara, flash, sonido y vibración deben ser opt-in y mostrar permisos o errores comprensibles.
- Los datos de una reservación deben ser legibles desde aproximadamente un brazo de distancia en la puerta.

## Lo que se debe evitar

- Gradientes arcoíris, cajas con glow y neón permanente.
- Tipografía de poster o manuscrita en controles y datos.
- Fondos fotográficos debajo de tablas o formularios.
- Cards idénticas para cada métrica.
- Transparencias que reduzcan contraste en el scanner.
- Simular aforo o métricas con cifras inventadas.
- Usar la estética de fiesta para ocultar errores, carga o permisos.

## Implementación visual sugerida

- Next.js + TypeScript.
- Tokens CSS semánticos, compartidos por todos los módulos.
- Componentes base: Button, IconButton, StatusBadge, DataTable, Metric, FilterBar, EmptyState, ConfirmDialog y ScannerResult.
- Una sola familia de iconos de trazo, por ejemplo Phosphor o Tabler.
- Usar imágenes optimizadas y reservar dimensiones para evitar saltos de layout.

## Criterio de aceptación visual

Una persona de SOMA debe reconocer el ambiente nocturno y el logo al abrir el panel, pero un AccessStaff debe poder encontrar el evento, escanear un QR y entender el resultado sin conocer la estética de la marca.

