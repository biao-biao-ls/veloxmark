---
title: Exportar un documento
description: Exporta documentos de VeloxMark a PDF o HTML — opciones de página, temas, incrustación de imágenes, fuentes KaTeX, exportación de HTML solo de la selección y copia como texto enriquecido.
keywords: [exportar Markdown a PDF, Markdown a HTML, opciones de exportación a PDF, exportación de selección, copia como texto enriquecido]
---

# Exportar un documento

VeloxMark exporta desde el **código fuente Markdown** — no desde el DOM del editor — de
modo que la salida coincide exactamente con tu documento. Disponible desde el menú
Archivo: **Exportar → PDF…** o **Exportar → HTML…**. Ambos abren un diálogo de exportación
compartido.

## Opciones

| Grupo | Ajuste | Valores |
| --- | --- | --- |
| Página (PDF) | Tamaño del papel | A4, Letter |
| Página (PDF) | Márgenes | Normal, Estrecho |
| Página (PDF) | Encabezado y pie de página | Activado / desactivado — el encabezado muestra el título del documento / nombre del archivo; el pie muestra `página / total` |
| Estilo | Tema | Seguir el tema actual, o forzar claro |
| Imágenes | Incrustar en base64 / conservar rutas relativas | PDF siempre incrusta |
| Matemáticas | Fuentes KaTeX | Incrustar (listo para uso sin conexión) o reserva de CDN (archivo más pequeño) |

## Qué se renderiza

La canalización completa reproduce todo lo que muestra la vista previa en vivo:

- Títulos, listas, listas de tareas (como casillas marcadas), tablas con alineación
- Código con colores de sintaxis de highlight.js
- **Matemáticas KaTeX** como fórmulas compuestas de verdad
- **Diagramas Mermaid** como SVG en línea
- Notas destacadas, notas al pie (numeradas con referencias de retorno), `==resaltados==`,
  superíndice, subíndice, abreviaturas y listas de definiciones
- Imágenes con atributos de tamaño / alineación / volteo, resueltas relativas al documento
  e incrustadas en línea cuando la opción lo indica
- El `title` del front matter se convierte en el H1 del documento

La generación de PDF renderiza el HTML en una ventana oculta y aislada, espera a las
fuentes y las imágenes, y luego imprime a PDF con fondos.

## Exportación solo de la selección

**Editar → Exportar la selección como HTML…** exporta solo el rango seleccionado como un
archivo HTML independiente (sin nada seleccionado, se usa el documento entero). El mismo
ámbito de selección o documento se aplica a **Copiar como texto enriquecido** y **Copiar
como HTML**.

## Garantía de ida y vuelta

La exportación nunca modifica tu archivo. El `.md` del disco sigue siendo la única fuente
de verdad; el PDF/HTML exportado es solo una representación suya.
