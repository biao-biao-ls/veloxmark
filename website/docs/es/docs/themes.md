---
title: Temas
description: Los temas claro y oscuro de VeloxMark — cambio con un clic, persistencia entre sesiones y cómo se aplican los temas a los componentes de código, fórmulas y diagramas.
keywords: [modo oscuro del editor de Markdown, tema claro, tema oscuro, temas del editor, alternar tema]
---

# Temas

VeloxMark incluye dos temas de primera clase — claro y oscuro — ajustados para largas
sesiones de escritura. Ambos cubren el cromo del editor, los colores de sintaxis y los
componentes de bloques renderizados (fórmulas, diagramas, código, tablas).

<div class="vm-grid-2" style="margin-top:24px">
  <div class="vm-card" style="padding:0;overflow:hidden">
    <div class="vm-window" style="border:none;border-radius:0">
      <div class="win-bar">
        <span class="dot r"></span><span class="dot y"></span><span class="dot g"></span>
        <span class="fname">claro</span>
      </div>
      <img src="/img/hero-light.png" alt="Tema claro de VeloxMark" />
    </div>
  </div>
  <div class="vm-card" style="padding:0;overflow:hidden">
    <div class="vm-window" style="border:none;border-radius:0">
      <div class="win-bar">
        <span class="dot r"></span><span class="dot y"></span><span class="dot g"></span>
        <span class="fname">oscuro</span>
      </div>
      <img src="/img/hero-dark.png" alt="Tema oscuro de VeloxMark" />
    </div>
  </div>
</div>

## Cambiar de tema

- Menú: **Ver → Alternar tema** (también disponible como el comando «Alternar tema»).
- O elige `claro` / `oscuro` / `sistema` explícitamente en Preferencias (modo de tema).
- La elección se recuerda entre sesiones.

La barra de título personalizada sin marco y los menús de la aplicación
(Archivo / Editar / Ver / Insertar / Ayuda) siguen el tema activo.

## Ejemplo de código en tema oscuro

<div class="vm-shot">

![Bloque de código en tema oscuro](/img/code-dark.png)

</div>

## Cómo se aplican los temas

El editor es [CodeMirror 6](https://codemirror.net); cada tema es un tema de CM6 más
variables CSS que cubren el armazón de la aplicación. Los componentes renderizados
(KaTeX, Mermaid, highlight.js) toman la misma paleta, de modo que un bloque de código o un
diagrama nunca parece fuera de lugar.
