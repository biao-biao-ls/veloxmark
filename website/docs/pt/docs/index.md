---
title: Introdução
description: Bem-vindo à documentação do VeloxMark — um editor de Markdown gratuito e de código aberto, com pré-visualização em tempo real, construído sobre Electron e CodeMirror 6.
keywords: [documentação VeloxMark, guia do editor de Markdown, editor com pré-visualização em tempo real, introdução]
---

# Introdução

Bem-vindo à documentação do VeloxMark — um editor de Markdown gratuito e de código aberto,
com pré-visualização em tempo real para macOS, Windows e Linux, inspirado no Typora e
construído sobre Electron + CodeMirror 6.

<div class="vm-shot">

![Interface do VeloxMark](/img/hero-light.png)

</div>

## O que torna o VeloxMark diferente

**O código-fonte Markdown é a única fonte de dados.** Tudo o que é rico — títulos
renderizados, fórmulas, diagramas, tabelas — é uma decoração efémera sobre o seu arquivo de
texto simples. Salvar escreve `.md` limpo, com zero perda de ida e volta. Não existe
formato de documento proprietário nem estado oculto.

O motor de pré-visualização em tempo real reconstrói as suas decorações a cada alteração do
documento e da seleção: os marcadores de sintaxe são ocultados com substituições
decorativas, e os blocos de código / matemática / mermaid / imagem são trocados por
componentes renderizados. Quando o cursor entra num intervalo, a decoração desse intervalo é
ignorada e a forma de código-fonte volta. A linha do cursor permanece sempre em forma de
código-fonte, para que saiba exatamente o que está editando.

## Para onde ir a seguir

<div class="vm-grid-3" style="margin-top:24px">
  <div class="vm-card">
    <h3><a href="./installation">Instalação</a></h3>
    <p>Instaladores para macOS, Windows e Linux, verificação de checksums e notas por plataforma.</p>
  </div>
  <div class="vm-card">
    <h3><a href="./basics">Noções básicas</a></h3>
    <p>A janela, a barra lateral, as abas e os três modos do editor — tudo o que vê no primeiro arranque.</p>
  </div>
  <div class="vm-card">
    <h3><a href="./editing">Edição aprofundada</a></h3>
    <p>Como a pré-visualização em tempo real se comporta enquanto escreve: componentes de bloco, tabelas, modos de foco e assistências de digitação.</p>
  </div>
  <div class="vm-card">
    <h3><a href="./markdown-syntax">Sintaxe Markdown</a></h3>
    <p>Todos os construtos de sintaxe que o VeloxMark renderiza de forma especial, com exemplos de código-fonte.</p>
  </div>
  <div class="vm-card">
    <h3><a href="./key-bindings">Atalhos de teclado</a></h3>
    <p>A lista completa de comandos com os aceleradores para cada plataforma.</p>
  </div>
  <div class="vm-card">
    <h3><a href="./faq">Perguntas frequentes</a></h3>
    <p>Plataformas suportadas, resolução de problemas e como reportar um bug.</p>
  </div>
</div>

## Licença

O VeloxMark é publicado sob a [Licença MIT](https://github.com/biao-biao-ls/veloxmark/blob/main/LICENSE).
O código-fonte está em [github.com/biao-biao-ls/veloxmark](https://github.com/biao-biao-ls/veloxmark).
