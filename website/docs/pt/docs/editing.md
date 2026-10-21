---
title: Edição aprofundada
description: Como a pré-visualização em tempo real do VeloxMark se comporta enquanto escreve — marcadores de sintaxe, componentes de bloco, edição de tabelas nativa, assistências de digitação e fluxos de trabalho com várias abas.
keywords: [edição com pré-visualização em tempo real, edição de tabelas Markdown, componentes de bloco, assistências de digitação, colar HTML em Markdown]
---

# Edição aprofundada

O editor do VeloxMark é o CodeMirror 6 com um motor de decorações que reconstrói a vista
renderizada a cada alteração do documento e da seleção. Esta página explica como isso se
comporta enquanto você escreve.

## Pré-visualização em tempo real

- Quando o cursor abandona uma linha, os seus marcadores de sintaxe (`#`, `**`, `` ` ``,
  `*`, `~~`, `==`) ficam ocultos com substituições decorativas e a linha mostra a sua forma
  final com estilo.
- **A linha do cursor permanece sempre em forma de código-fonte** — você vê sempre
  exatamente o que está digitando.
- Clicar num marcador oculto devolve a forma de código-fonte para esse intervalo.

<div class="vm-shot">

![Linha do cursor em forma de código-fonte](/img/caret-source-line.png)

</div>

## Componentes de bloco

Blocos de código, matemática `$$`, diagramas Mermaid e imagens são renderizados como
componentes no lugar do seu código-fonte. **Clique em qualquer bloco renderizado para
editar o seu código-fonte**; abandone o bloco e ele volta a ser renderizado.

<div class="vm-grid-2" style="margin-top:24px">
  <div class="vm-card" style="padding:0;overflow:hidden">
    <img src="/img/math-light.png" alt="Matemática KaTeX em bloco" style="display:block;width:100%" />
  </div>
  <div class="vm-card" style="padding:0;overflow:hidden">
    <img src="/img/mermaid-light.png" alt="Diagrama Mermaid renderizado no local" style="display:block;width:100%" />
  </div>
</div>

## Tabelas

As tabelas são de primeira classe: cada célula é um editor CodeMirror aninhado.

- **Inserir / converter** — use a caixa de diálogo de inserir tabela para criar uma tabela
  com um número escolhido de linhas e colunas, ou converta o parágrafo atual numa tabela.
- **Redimensionar colunas** — arraste a borda da coluna.
- **Alinhamento** — defina o alinhamento por coluna (esquerda / centro / direita); a linha
  separadora do código-fonte (`:---`, `:--:`, `---:`) é mantida em sincronia.
- Todas as edições passam por transações de volta para o intervalo de código-fonte
  Markdown a que o componente pertence — o documento nunca é alterado às suas costas.

<div class="vm-shot">

![Edição de tabelas](/img/table-widget-light.png)

</div>

## Modos de foco e máquina de escrever

- **Modo de foco** escurece tudo, exceto o parágrafo que você está escrevendo.
- **Modo máquina de escrever** mantém a linha do cursor presa ao centro vertical.
- Ambos podem ser combinados; a barra de status mostra os chips `FOCUS` / `TYPEWRITER`
  enquanto ativos.

<div class="vm-shot">

![Modo de foco](/img/focus-mode.png)

</div>

## Assistências de digitação

- **Colar HTML → Markdown** — texto rico colado da área de transferência é convertido em
  Markdown limpo.
- **URLs isoladas** — uma URL isolada colada é envolvida num link automaticamente.
- **Listas de tarefas** — `- [ ]` é renderizado como uma caixa de seleção clicável; clique
  para alternar.
- **Desfazer/refazer** — histórico completo de transações (`Ctrl+Z` / `Ctrl+Shift+Z`).

## Edição com várias abas

Abra vários arquivos ao mesmo tempo. As abas podem ser fechadas e reabertas, as alterações
não salvas são marcadas, e a faixa de abas pode ser reordenada por arrastar.

## Blocos de código

- Realce de sintaxe via highlight.js para centenas de linguagens.
- Números de linha opcionais, quebra suave de linhas e colapso de blocos longos — consulte
  [Preferências](./preferences).

## Exportação

Exporte para PDF ou HTML pelo menu Arquivo, incluindo a exportação de HTML apenas da
seleção. Consulte [Exportar um documento](./export).
