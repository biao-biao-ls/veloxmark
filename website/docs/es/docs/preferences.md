---
title: Preferencias
description: Todos los ajustes de VeloxMark con sus valores predeterminados — tema, fuentes del editor, asistencias de escritura, autoguardado y recuperación tras fallos, imágenes y adjuntos, idioma.
keywords: [ajustes de VeloxMark, preferencias del editor, autoguardado, recuperación tras fallos, tamaño de fuente, carpeta de adjuntos]
---

# Preferencias

Abre las preferencias con `Ctrl+,` (`Cmd+,` en macOS) o desde el menú de la aplicación
**Archivo → Preferencias**. Los ajustes se persisten entre sesiones.

## Apariencia

| Ajuste | Predeterminado | Descripción |
| --- | --- | --- |
| Tema | Sistema | `claro` / `oscuro` / seguir el sistema. Se alterna en el menú Ver. |
| Fuente del editor | Pila del sistema | Familia tipográfica de la superficie de escritura. |
| Tamaño de fuente | 16 | Tamaño de la fuente del editor en píxeles. |
| Altura de línea | 1.6 | Altura de línea del editor. |
| Ancho de la columna de contenido | 0 (auto) | Ancho máximo de línea de la columna de escritura; `0` deja elegir a la aplicación. |
| Mostrar barra de estado | Activado | Posición del cursor, recuentos e indicadores de modo. |
| Barra lateral abierta de forma predeterminada | Activado | Cuando no hay una sesión anterior que recordar. |

## Editor

| Ajuste | Predeterminado | Descripción |
| --- | --- | --- |
| Asistencias de escritura | Activado | Continuación de listas, subida de nivel de títulos, transformaciones al pegar. |
| Envolver URL desnudas al pegar | Activado | Convierte una URL desnuda pegada en un enlace de Markdown. |
| Convertir HTML al pegar | Activado | Convierte el texto enriquecido pegado en Markdown limpio. |
| Formatear al guardar | Desactivado | Normaliza el Markdown (espaciado, marcadores de lista, alineación de tablas) antes de escribir. |
| Mostrar números de línea | Desactivado | Canal de números de línea en el editor. |
| Números de línea en bloques de código | Desactivado | Renderiza números de línea dentro de los componentes de bloque de código. |
| Ajuste de línea en bloques de código | Activado | Ajusta las líneas largas dentro de los bloques de código. |
| Umbral de plegado de bloques de código | 20 líneas | Los bloques más largos se pliegan con un control de expansión; `0` lo desactiva. |
| Modo de enfoque | Desactivado | Atenúa todo salvo la región actual. |
| Modo de máquina de escribir | Desactivado | Mantiene la línea del cursor fija en el centro vertical. |
| Modo de código fuente | Desactivado | Muestra siempre el Markdown crudo. |

## Archivos

| Ajuste | Predeterminado | Descripción |
| --- | --- | --- |
| Autoguardado | Retardo (3 s) | `desactivado` / `retardo` (tras dejar de escribir) / `intervalo` (cada N minutos). |
| Retardo de autoguardado | 3 s | Retardo para el modo de retardo. |
| Intervalo de autoguardado | 5 min | Intervalo para el modo de intervalo. |
| Borradores de recuperación tras fallos | Activado | Conserva borradores de los cambios sin guardar y ofrece la recuperación tras un fallo. |
| Restaurar la última sesión | Activado | Vuelve a abrir pestañas, carpetas y posición del cursor al arrancar. |
| Mostrar archivos ocultos | Desactivado | Muestra los archivos que empiezan por punto en el árbol de archivos. |
| Nombres ignorados | `node_modules`, `.git`, … | Nombres ocultos en el árbol de archivos. |

## Imágenes y adjuntos

| Ajuste | Predeterminado | Descripción |
| --- | --- | --- |
| Carpeta de adjuntos | `assets` | Carpeta (relativa al documento) para las imágenes pegadas o insertadas. |
| Nombrado de archivos de imagen | Marca de tiempo | Nombres con marca de tiempo, o conservar el nombre de archivo original. |
| Copiar imágenes externas | Activado | Copia las imágenes de fuera de la carpeta del documento a los adjuntos. |
| Descargar imágenes remotas | Desactivado | Obtiene las URL de imágenes remotas en los adjuntos. |

## Idioma

| Ajuste | Predeterminado | Descripción |
| --- | --- | --- |
| Idioma de la interfaz | Sistema | Sigue la configuración regional del sistema o fija uno de nueve idiomas. Consulta [Idioma y localización](./language). |

## Enlaces

| Ajuste | Predeterminado | Descripción |
| --- | --- | --- |
| Confirmar enlaces externos | Activado | Pregunta antes de abrir un enlace en el navegador. |
