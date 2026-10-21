---
title: Edición en profundidad
description: Cómo se comporta la vista previa en vivo de VeloxMark mientras escribes — marcadores de sintaxis, componentes de bloque, edición nativa de tablas, asistencias de escritura y flujos con varias pestañas.
keywords: [edición con vista previa en vivo, edición de tablas Markdown, componentes de bloque, asistencias de escritura, pegar HTML a Markdown]
---

# Edición en profundidad

El editor de VeloxMark es CodeMirror 6 con un motor de decoraciones que reconstruye la
vista renderizada en cada cambio de documento y de selección. Esta página explica cómo se
comporta eso mientras escribes.

## Vista previa en vivo

- Cuando el cursor deja una línea, sus marcadores de sintaxis (`#`, `**`, `` ` ``, `*`,
  `~~`, `==`) se ocultan con decoraciones de reemplazo y la línea muestra su forma final
  con estilo.
- **La línea del cursor siempre permanece en forma de código fuente** — siempre ves
  exactamente lo que estás escribiendo.
- Al hacer clic en un marcador oculto, la forma de código fuente vuelve para ese rango.

<div class="vm-shot">

![Línea del cursor en forma de código fuente](/img/caret-source-line.png)

</div>

## Componentes de bloque

Los bloques de código, las fórmulas `$$`, los diagramas Mermaid y las imágenes se
renderizan como componentes en el lugar de su código fuente. **Haz clic en cualquier
bloque renderizado para editar su código fuente**; al dejar el bloque, se renderiza otra
vez.

<div class="vm-grid-2" style="margin-top:24px">
  <div class="vm-card" style="padding:0;overflow:hidden">
    <img src="/img/math-light.png" alt="Fórmula KaTeX de bloque" style="display:block;width:100%" />
  </div>
  <div class="vm-card" style="padding:0;overflow:hidden">
    <img src="/img/mermaid-light.png" alt="Diagrama Mermaid renderizado en el lugar" style="display:block;width:100%" />
  </div>
</div>

## Tablas

Las tablas son de primera clase: cada celda es un editor CodeMirror anidado.

- **Insertar / convertir** — usa el diálogo de insertar tabla para crear una tabla con un
  número elegido de filas y columnas, o convierte el párrafo actual en una tabla.
- **Redimensionar columnas** — arrastra el borde de la columna.
- **Alineación** — define la alineación por columna (izquierda / centro / derecha); la
  fila separadora del código fuente (`:---`, `:--:`, `---:`) se mantiene sincronizada.
- Todas las ediciones pasan por transiciones de vuelta al rango del código fuente
  Markdown del que es dueño el componente — el documento nunca se muta a tus espaldas.

<div class="vm-shot">

![Edición de tablas](/img/table-widget-light.png)

</div>

## Modos de enfoque y máquina de escribir

- El **modo de enfoque** atenúa todo salvo el párrafo que estás escribiendo.
- El **modo de máquina de escribir** mantiene la línea del cursor fija en el centro
  vertical.
- Ambos pueden combinarse; la barra de estado muestra los indicadores `FOCUS` /
  `TYPEWRITER` mientras están activos.

<div class="vm-shot">

![Modo de enfoque](/img/focus-mode.png)

</div>

## Asistencias de escritura

- **Pegar HTML → Markdown** — el texto enriquecido pegado desde el portapapeles se
  convierte en Markdown limpio.
- **URL desnudas** — una URL desnuda pegada se envuelve automáticamente en un enlace.
- **Listas de tareas** — `- [ ]` se renderiza como una casilla clicable; haz clic para
  alternarla.
- **Deshacer/rehacer** — historial completo de transiciones (`Ctrl+Z` / `Ctrl+Shift+Z`).

## Edición con varias pestañas

Abre varios archivos a la vez. Las pestañas pueden cerrarse y reabrirse, las
modificaciones sin guardar se marcan, y la tira de pestañas puede reordenarse arrastrando.

## Bloques de código

- Resaltado de sintaxis mediante highlight.js para cientos de lenguajes.
- Números de línea opcionales, ajuste de línea y plegado de bloques largos — consulta
  [Preferencias](./preferences).

## Exportación

Exporta a PDF o HTML desde el menú Archivo, incluida la exportación de HTML solo de la
selección. Consulta [Exportar un documento](./export).
