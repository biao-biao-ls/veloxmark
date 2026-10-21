---
title: Conceptos básicos
description: La ventana de VeloxMark de un vistazo — barra de título, barra lateral (archivos, esquema, búsqueda), pestañas, modos del editor, apertura y guardado de archivos.
keywords: [conceptos básicos de VeloxMark, interfaz del editor de Markdown, panel de esquema, pestañas, modo de enfoque, modo de máquina de escribir, modo de código fuente]
---

# Conceptos básicos

VeloxMark se abre con un documento de bienvenida que hace a la vez de recorrido por las
funciones. Esta página recorre la ventana, la barra lateral, las pestañas y los modos del
editor.

## La ventana

<div class="vm-shot">

![Ventana de VeloxMark](/img/hero-light.png)

</div>

- **Barra de título** — barra personalizada sin marco con el menú de la aplicación
  (Archivo / Editar / Ver / Insertar / Ayuda) y los controles de ventana. Sigue el tema
  claro/oscuro.
- **Barra lateral** — tres paneles: **Archivos** (espacio de trabajo de carpetas),
  **Esquema** (árbol de títulos del documento activo) y **Búsqueda** (buscar en la
  carpeta).
- **Barra de pestañas** — una pestaña por documento abierto, con las modificaciones sin
  guardar marcadas.
- **Editor** — la superficie de escritura con vista previa en vivo.
- **Barra de estado** — posición del cursor, recuentos de palabras / caracteres / líneas
  e indicadores del modo de enfoque cuando está activo.

## Barra lateral

- **Archivos** — abre una carpeta y navega por sus archivos Markdown; haz clic para
  abrirlos en una pestaña.
- **Esquema** — árbol de títulos del documento activo con salto al hacer clic y
  resaltado de la posición actual.
- **Búsqueda** — búsqueda de texto completo en la carpeta abierta, con reemplazo.

## Pestañas

- Abre varios archivos a la vez; cada uno obtiene una pestaña.
- Las modificaciones sin guardar se marcan en la pestaña.
- Cierra y vuelve a abrir pestañas; una pestaña cerrada puede restaurarse.
- Arrastra las pestañas para reordenarlas.

## Modos del editor

| Modo | Qué hace |
| --- | --- |
| **Vista previa en vivo** (predeterminado) | El Markdown se renderiza en el lugar; la línea del cursor permanece en forma de código fuente |
| **Modo de código fuente** | Markdown crudo todo el tiempo, para control total |
| **Modo de enfoque** | Todo salvo la línea actual se atenúa |
| **Modo de máquina de escribir** | La línea actual permanece fija en el centro vertical |

Cambia el tema desde el menú Ver. Lista completa de comandos:
[Atajos de teclado](./key-bindings).

## Abrir y guardar

- **Abre** un archivo `.md` (`Ctrl+O` / `Cmd+O`) o abre una carpeta desde el menú
  Archivo.
- **Guardar** (`Ctrl+S` / `Cmd+S`) escribe el código fuente plano de vuelta — pérdida
  cero de ida y vuelta.
- **Guardar como** escribe una copia con un nombre nuevo.
- El trabajo sin guardar se conserva como borrador y puede recuperarse.

## Siguientes pasos

- [Edición en profundidad](./editing) — cómo se comporta la vista previa en vivo mientras escribes.
- [Sintaxis de Markdown](./markdown-syntax) — todo lo que se renderiza de forma especial.
- [Preferencias](./preferences) — ajusta el editor a tu gusto.
