---
title: Imagens
description: Suporte a imagens no VeloxMark — caminhos relativos e absolutos, URLs remotos, dimensão de exibição com =WxH, atributos de alinhamento e inversão, anexos.
keywords: [imagens Markdown, sintaxe de tamanho de imagem, alinhamento de imagem, pasta de anexos, imagens remotas]
---

# Imagens

O VeloxMark resolve as imagens da forma como um arquivo Markdown em disco deveria — em
relação ao arquivo que está editando.

## Caminhos suportados

| Forma | Exemplo | Resolvido em relação a |
| --- | --- | --- |
| Caminho relativo | `![alt](./img/chart.png)` | Pasta do arquivo `.md` atual |
| Caminho absoluto | `![alt](C:\pics\a.png)` / `![alt](/home/me/a.png)` | Raiz do sistema de arquivos |
| URL remoto | `![alt](https://example.com/a.png)` | Obtido pela rede |
| Data URI | `![alt](data:image/png;base64,…)` | Incorporado em linha |

Os caminhos relativos são a escolha portátil — mova a pasta que contém o seu `.md` e as
suas imagens em conjunto e tudo continua a funcionar.

## Tamanho e atributos

Um sufixo opcional `=WxH` após o URL define as dimensões renderizadas, e os grupos `{…}`
após o parêntese de fecho definem alinhamento e inversão:

```markdown
![logo](./logo.png =128x128)
![banner](./banner.png =800x200){align=center}{flip=h}
```

| Atributo | Valores | Efeito |
| --- | --- | --- |
| `=WxH` | p. ex. `=128x128` | Tamanho de exibição em pixels |
| `{align=…}` | `left`, `center`, `right` | Alinhamento horizontal |
| `{flip=…}` | `h`, `v`, `hv` | Espelhar horizontalmente / verticalmente / ambos |

As imagens renderizadas também podem ser **redimensionadas com o rato** (emite uma largura
em `%`), e o componente de imagem oferece alinhar, inverter, repor tamanho, editar URL e
“Mostrar no gerenciador de arquivos”.

## Clique para editar

As imagens são renderizadas como componentes. Clique na imagem para editar o seu
código-fonte Markdown; abandone o bloco e ela volta a ser renderizada — o mesmo
comportamento dos blocos de código, matemática e diagramas.

## Segurança local

As imagens locais são servidas pelo protocolo interno `mdres://` do aplicativo em vez de
acesso `file://` direto, pelo que um documento só pode mostrar imagens que o aplicativo
exponha deliberadamente.
