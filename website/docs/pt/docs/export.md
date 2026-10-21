---
title: Exportar um documento
description: Exporte documentos do VeloxMark para PDF ou HTML — opções de página, temas, incorporação de imagens, fontes KaTeX, exportação de HTML apenas da seleção e copiar como texto rico.
keywords: [exportar Markdown para PDF, Markdown para HTML, opções de exportação PDF, exportação de seleção, copiar como texto rico]
---

# Exportar um documento

O VeloxMark exporta a partir do **código-fonte Markdown** — não do DOM do editor — pelo que
a saída corresponde exatamente ao seu documento. Disponível no menu Arquivo:
**Exportar → PDF…** ou **Exportar → HTML…**. Ambos abrem uma caixa de diálogo de exportação
partilhada.

## Opções

| Grupo | Definição | Valores |
| --- | --- | --- |
| Página (PDF) | Tamanho do papel | A4, Letter |
| Página (PDF) | Margens | Normal, Estreitas |
| Página (PDF) | Cabeçalho e rodapé | Ligado / desligado — o cabeçalho mostra o título do documento / nome do arquivo, o rodapé mostra `página / total` |
| Estilo | Tema | Seguir o tema atual ou forçar claro |
| Imagens | Incorporar como base64 / manter caminhos relativos | O PDF incorpora sempre |
| Matemática | Fontes KaTeX | Incorporar (pronto para uso offline) ou recurso a CDN (arquivo menor) |

## O que é renderizado

O pipeline completo reproduz tudo o que a pré-visualização em tempo real mostra:

- Títulos, listas, listas de tarefas (como caixas de seleção marcadas), tabelas com
  alinhamento
- Código com as cores de sintaxe do highlight.js
- **Matemática KaTeX** como matemática verdadeiramente tipografada
- **Diagramas Mermaid** como SVG em linha
- Alertas, notas de rodapé (numeradas com referências de retorno), `==destaques==`,
  sobrescrito, subscrito, abreviações e listas de definições
- Imagens com atributos de tamanho / alinhamento / inversão, resolvidas em relação ao
  documento e incorporadas em linha quando a opção o indica
- O `title` do front matter torna-se o H1 do documento

A geração de PDF renderiza o HTML numa janela oculta com sandbox, espera pelas fontes e
imagens e depois imprime para PDF com fundos.

## Exportação apenas da seleção

**Editar → Exportar seleção como HTML…** exporta apenas o intervalo selecionado como um
arquivo HTML autônomo (com nada selecionado, é usado o documento inteiro). O mesmo âmbito
de seleção-ou-documento aplica-se a **Copiar como texto rico** e **Copiar como HTML**.

## Garantia de ida e volta

A exportação nunca modifica o seu arquivo. O `.md` em disco permanece a única fonte de
verdade; o PDF/HTML exportado é apenas uma renderização dele.
