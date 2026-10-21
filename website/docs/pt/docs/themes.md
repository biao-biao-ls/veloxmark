---
title: Temas
description: Os temas claro e escuro do VeloxMark — alternância com um clique, persistência entre sessões e como os temas se aplicam aos componentes de código, matemática e diagramas.
keywords: [modo escuro do editor de Markdown, tema claro, tema escuro, temas do editor, alternar tema]
---

# Temas

O VeloxMark inclui dois temas de primeira classe — claro e escuro — afinados para longas
sessões de escrita. Ambos cobrem o chrome do editor, as cores de sintaxe e os componentes
de blocos renderizados (matemática, diagramas, código, tabelas).

<div class="vm-grid-2" style="margin-top:24px">
  <div class="vm-card" style="padding:0;overflow:hidden">
    <div class="vm-window" style="border:none;border-radius:0">
      <div class="win-bar">
        <span class="dot r"></span><span class="dot y"></span><span class="dot g"></span>
        <span class="fname">light</span>
      </div>
      <img src="/img/hero-light.png" alt="VeloxMark com tema claro" />
    </div>
  </div>
  <div class="vm-card" style="padding:0;overflow:hidden">
    <div class="vm-window" style="border:none;border-radius:0">
      <div class="win-bar">
        <span class="dot r"></span><span class="dot y"></span><span class="dot g"></span>
        <span class="fname">dark</span>
      </div>
      <img src="/img/hero-dark.png" alt="VeloxMark com tema escuro" />
    </div>
  </div>
</div>

## Alternar temas

- Menu: **Exibir → Alternar tema** (também disponível como o comando "Alternar tema").
- Ou escolha explicitamente `light` / `dark` / `system` nas Preferências (modo de tema).
- A escolha é lembrada entre sessões.

A barra de título personalizada sem moldura e os menus do aplicativo (Arquivo / Editar /
Exibir / Inserir / Ajuda) seguem o tema ativo.

## Exemplo de código no tema escuro

<div class="vm-shot">

![Bloco de código no tema escuro](/img/code-dark.png)

</div>

## Como os temas são aplicados

O editor é o [CodeMirror 6](https://codemirror.net); cada tema é um tema CM6 mais variáveis
CSS que cobrem a shell do aplicativo. Os componentes renderizados (KaTeX, Mermaid,
highlight.js) adotam a mesma paleta, pelo que um bloco de código ou um diagrama nunca
parece fora de lugar.
