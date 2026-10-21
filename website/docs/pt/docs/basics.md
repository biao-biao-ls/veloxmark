---
title: Noções básicas
description: A janela do VeloxMark num relance — barra de título, barra lateral (arquivos, estrutura, pesquisa), abas, modos do editor, abrir e salvar arquivos.
keywords: [noções básicas do VeloxMark, interface do editor de Markdown, painel de estrutura, abas, modo de foco, modo máquina de escrever, modo de código-fonte]
---

# Noções básicas

O VeloxMark abre num documento de boas-vindas que também serve como visita guiada às
funcionalidades. Esta página percorre a janela, a barra lateral, as abas e os modos do
editor.

## A janela

<div class="vm-shot">

![Janela do VeloxMark](/img/hero-light.png)

</div>

- **Barra de título** — barra personalizada sem moldura, com o menu do aplicativo (Arquivo /
  Editar / Exibir / Inserir / Ajuda) e os controles da janela. Acompanha o tema claro/escuro.
- **Barra lateral** — três painéis: **Arquivos** (espaço de trabalho de pasta),
  **Estrutura** (árvore de títulos do documento ativo) e **Pesquisa** (procurar na pasta).
- **Barra de abas** — uma aba por documento aberto, com as alterações não salvas
  marcadas.
- **Editor** — a superfície de escrita com pré-visualização em tempo real.
- **Barra de status** — posição do cursor, contagens de palavras / caracteres / linhas, e
  indicadores do modo de foco quando ativo.

## Barra lateral

- **Arquivos** — abra uma pasta e navegue pelos seus arquivos Markdown; clique para abrir
  numa aba.
- **Estrutura** — árvore de títulos do documento ativo, com salto por clique e realce da
  posição atual.
- **Pesquisa** — pesquisa de texto integral na pasta aberta, com substituição.

## Abas

- Abra vários arquivos ao mesmo tempo; cada um recebe uma aba.
- As alterações não salvas são marcadas na aba.
- Feche e reabra abas; uma aba fechada pode ser restaurada.
- Arraste as abas para reordenar.

## Modos do editor

| Modo | O que faz |
| --- | --- |
| **Pré-visualização em tempo real** (padrão) | O Markdown é renderizado no local; a linha do cursor permanece em forma de código-fonte |
| **Modo de código-fonte** | Markdown em bruto o tempo todo, para controle total |
| **Modo de foco** | Tudo, exceto a linha atual, fica esmaecido |
| **Modo máquina de escrever** | A linha atual fica presa ao centro vertical |

Alterne o tema pelo menu Exibir. Lista completa de comandos:
[Atalhos de teclado](./key-bindings).

## Abrir e salvar

- **Abra** um arquivo `.md` (`Ctrl+O` / `Cmd+O`) ou abra uma pasta pelo menu Arquivo.
- **Salvar** (`Ctrl+S` / `Cmd+S`) escreve o código-fonte simples de volta — zero perda de
  ida e volta.
- **Salvar como** escreve uma cópia com um novo nome.
- O trabalho não salvo é guardado como rascunho e pode ser recuperado.

## Próximos passos

- [Edição aprofundada](./editing) — como a pré-visualização em tempo real se comporta
  enquanto escreve.
- [Sintaxe Markdown](./markdown-syntax) — tudo o que é renderizado de forma especial.
- [Preferências](./preferences) — ajuste o editor ao seu gosto.
