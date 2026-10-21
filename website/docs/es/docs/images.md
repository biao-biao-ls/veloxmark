---
title: Imágenes
description: Soporte de imágenes en VeloxMark — rutas relativas y absolutas, URL remotas, tamaño de visualización con =WxH, atributos de alineación y volteo, adjuntos.
keywords: [imágenes en Markdown, sintaxis de tamaño de imagen, alineación de imagen, carpeta de adjuntos, imágenes remotas]
---

# Imágenes

VeloxMark resuelve las imágenes como debería hacerlo un archivo Markdown en disco:
relativas al archivo que estás editando.

## Rutas admitidas

| Forma | Ejemplo | Se resuelve contra |
| --- | --- | --- |
| Ruta relativa | `![alt](./img/chart.png)` | Directorio del archivo `.md` actual |
| Ruta absoluta | `![alt](C:\pics\a.png)` / `![alt](/home/me/a.png)` | Raíz del sistema de archivos |
| URL remota | `![alt](https://example.com/a.png)` | Se obtiene por la red |
| Data URI | `![alt](data:image/png;base64,…)` | Incrustado en línea |

Las rutas relativas son la opción portable: mueve juntas la carpeta que contiene tu `.md`
y sus imágenes, y todo sigue funcionando.

## Tamaño y atributos

Un sufijo opcional `=WxH` después de la URL fija las dimensiones renderizadas, y los
grupos `{…}` después del paréntesis de cierre fijan la alineación y el volteo:

```markdown
![logo](./logo.png =128x128)
![banner](./banner.png =800x200){align=center}{flip=h}
```

| Atributo | Valores | Efecto |
| --- | --- | --- |
| `=WxH` | p. ej. `=128x128` | Tamaño de visualización en píxeles |
| `{align=…}` | `left`, `center`, `right` | Alineación horizontal |
| `{flip=…}` | `h`, `v`, `hv` | Espejo horizontal / vertical / ambos |

Las imágenes renderizadas también pueden **redimensionarse arrastrando** con el ratón
(emite un ancho en `%`), y el componente de imagen ofrece alinear, voltear, restablecer
tamaño, editar la URL y «Mostrar en el explorador de archivos».

## Clic para editar

Las imágenes se renderizan como componentes. Haz clic en la imagen para editar su código
fuente Markdown; deja el bloque y se renderiza otra vez — el mismo comportamiento que los
bloques de código, fórmulas y diagramas.

## Seguridad local

Las imágenes locales se sirven a través del protocolo interno `mdres://` de la aplicación
en lugar del acceso `file://` en bruto, de modo que un documento solo puede mostrar
imágenes que la aplicación expone deliberadamente.
