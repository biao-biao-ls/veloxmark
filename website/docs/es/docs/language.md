---
title: Idioma y localización
description: VeloxMark se ofrece en nueve idiomas de interfaz, con menús nativos y documentos de ejemplo. Cómo funciona la selección de idioma y cómo contribuir con traducciones.
keywords: [idiomas de VeloxMark, localización del editor de Markdown, idioma de la interfaz, traducción]
---

# Idioma y localización

La interfaz de VeloxMark se ofrece en nueve idiomas:

| Idioma | Código |
| --- | --- |
| Inglés | `en` |
| Chino | `zh` |
| Japonés | `ja` |
| Coreano | `ko` |
| Español | `es` |
| Portugués | `pt` |
| Francés | `fr` |
| Alemán | `de` |
| Ruso | `ru` |

(En el selector de idioma de la aplicación, cada idioma aparece bajo su propio nombre
nativo.)

La localización cubre toda la interfaz: menús (nativos en macOS), diálogos, la barra de
estado — e incluso los documentos de ejemplo de bienvenida / ayuda y los cuerpos de las
plantillas Mermaid, que se eligen según la configuración regional.

## Elegir un idioma

- **Seguir el sistema** de forma predeterminada — la aplicación elige el idioma de la
  interfaz a partir de la configuración regional de tu sistema operativo cuando existe un
  paquete para él, y recurre al inglés si no.
- **Establecerlo explícitamente** desde las preferencias / el menú Ver; la elección se
  recuerda entre sesiones.

## Traducir

Las traducciones viven en un archivo de paquete por idioma (diccionario de interfaz,
cadenas de menús nativos, documentos de bienvenida / ayuda y plantillas Mermaid). La
igualdad de claves del diccionario la impone el sistema de tipos: un idioma nuevo debe
incluir los cuatro paquetes para superar `npm run typecheck`. Las contribuciones son bien
recibidas en [GitHub](https://github.com/biao-biao-ls/veloxmark).
