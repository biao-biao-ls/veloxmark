---
title: Introducción
description: Bienvenido a la documentación de usuario de VeloxMark — un editor de Markdown gratuito y de código abierto con vista previa en vivo, construido sobre Electron y CodeMirror 6.
keywords: [documentación de VeloxMark, guía del editor de Markdown, editor con vista previa en vivo, introducción]
---

# Introducción

Bienvenido a la documentación de usuario de VeloxMark — un editor de Markdown gratuito y
de código abierto con vista previa en vivo para macOS, Windows y Linux, inspirado en
Typora y construido sobre Electron + CodeMirror 6.

<div class="vm-shot">

![Interfaz de VeloxMark](/img/hero-light.png)

</div>

## Qué hace diferente a VeloxMark

**El código fuente Markdown es la única fuente de datos.** Todo lo enriquecido — títulos
renderizados, fórmulas, diagramas, tablas — es una decoración efímera sobre tu archivo de
texto plano. Al guardar se escribe un `.md` limpio con pérdida cero de ida y vuelta. No
hay formato de documento propietario ni estado oculto.

El motor de vista previa en vivo reconstruye sus decoraciones en cada cambio de documento
y de selección: los marcadores de sintaxis se ocultan con decoraciones de reemplazo, y los
bloques de código / fórmulas / mermaid / imágenes se sustituyen por componentes
renderizados. Cuando el cursor entra en un rango, la decoración de ese rango se omite y
vuelve la forma de código fuente. La línea del cursor siempre permanece en forma de código
fuente, así que siempre sabes exactamente qué estás editando.

## Dónde ir ahora

<div class="vm-grid-3" style="margin-top:24px">
  <div class="vm-card">
    <h3><a href="./installation">Instalación</a></h3>
    <p>Instaladores para macOS, Windows y Linux, verificación de sumas y notas por plataforma.</p>
  </div>
  <div class="vm-card">
    <h3><a href="./basics">Conceptos básicos</a></h3>
    <p>La ventana, la barra lateral, las pestañas y los tres modos del editor — todo lo que ves en el primer arranque.</p>
  </div>
  <div class="vm-card">
    <h3><a href="./editing">Edición en profundidad</a></h3>
    <p>Cómo se comporta la vista previa en vivo mientras escribes: componentes de bloque, tablas, modos de enfoque y asistencias de escritura.</p>
  </div>
  <div class="vm-card">
    <h3><a href="./markdown-syntax">Sintaxis de Markdown</a></h3>
    <p>Cada construcción de sintaxis que VeloxMark renderiza de forma especial, con ejemplos de código fuente.</p>
  </div>
  <div class="vm-card">
    <h3><a href="./key-bindings">Atajos de teclado</a></h3>
    <p>La lista completa de comandos con sus aceleradores para cada plataforma.</p>
  </div>
  <div class="vm-card">
    <h3><a href="./faq">Preguntas frecuentes</a></h3>
    <p>Plataformas compatibles, solución de problemas y cómo reportar un error.</p>
  </div>
</div>

## Licencia

VeloxMark se publica bajo la
[licencia MIT](https://github.com/biao-biao-ls/veloxmark/blob/main/LICENSE).
El código fuente vive en
[github.com/biao-biao-ls/veloxmark](https://github.com/biao-biao-ls/veloxmark).
