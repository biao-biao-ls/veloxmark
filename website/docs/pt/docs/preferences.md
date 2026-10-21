---
title: Preferências
description: Todas as definições do VeloxMark com os valores padrão — tema, fontes do editor, assistências de digitação, salvamento automático e recuperação após falha, imagens e anexos, idioma.
keywords: [definições do VeloxMark, preferências do editor, salvamento automático, recuperação após falha, tamanho da fonte, pasta de anexos]
---

# Preferências

Abra as preferências com `Ctrl+,` (`Cmd+,` no macOS) ou pelo menu **Arquivo →
Preferências** no aplicativo. As definições são persistidas entre sessões.

## Aparência

| Definição | Padrão | Descrição |
| --- | --- | --- |
| Tema | Sistema | `light` / `dark` / seguir o SO. Alternado no menu Exibir. |
| Fonte do editor | Pilha do sistema | Família tipográfica da superfície de escrita. |
| Tamanho da fonte | 16 | Tamanho da fonte do editor em pixels. |
| Altura da linha | 1.6 | Altura da linha no editor. |
| Largura da coluna de conteúdo | 0 (auto) | Largura máxima de linha da coluna de escrita; `0` deixa o aplicativo escolher. |
| Mostrar barra de status | Ligado | Posição do cursor, contagens e indicadores de modo. |
| Barra lateral aberta por padrão | Ligado | Quando não há sessão anterior memorizada. |

## Editor

| Definição | Padrão | Descrição |
| --- | --- | --- |
| Assistências de digitação | Ligado | Continuação de listas, aumento de nível de título, transformações ao colar. |
| Envolver URLs isoladas ao colar | Ligado | Transforma uma URL isolada colada num link Markdown. |
| Converter HTML ao colar | Ligado | Converte texto rico colado em Markdown limpo. |
| Formatar ao salvar | Desligado | Normaliza o Markdown (espaçamento, marcadores de lista, alinhamento de tabelas) antes de escrever. |
| Mostrar números de linha | Desligado | Coluna de números de linha no editor. |
| Números de linha em blocos de código | Desligado | Renderiza números de linha dentro dos componentes de bloco de código. |
| Quebra suave em blocos de código | Ligado | Quebra linhas longas dentro dos blocos de código. |
| Limiar de colapso de blocos de código | 20 linhas | Blocos mais longos colapsam com um controle de expansão; `0` desativa. |
| Modo de foco | Desligado | Escurece tudo, exceto a região atual. |
| Modo máquina de escrever | Desligado | Mantém a linha do cursor presa ao centro vertical. |
| Modo de código-fonte | Desligado | Mostra sempre o Markdown em bruto. |

## Arquivos

| Definição | Padrão | Descrição |
| --- | --- | --- |
| Salvamento automático | Com atraso (3 s) | `off` / `debounce` (quando a digitação para) / `interval` (a cada N minutos). |
| Atraso do salvamento automático | 3 s | Atraso do modo com atraso (debounce). |
| Intervalo de salvamento automático | 5 min | Intervalo do modo de intervalo. |
| Rascunhos de recuperação após falha | Ligado | Mantém rascunhos de alterações não salvas e oferece recuperação após uma falha. |
| Restaurar a última sessão | Ligado | Reabre abas, pastas e a posição do cursor ao arrancar. |
| Mostrar arquivos ocultos | Desligado | Mostra arquivos com ponto inicial na árvore de arquivos. |
| Nomes ignorados | `node_modules`, `.git`, … | Nomes ocultos na árvore de arquivos. |

## Imagens e anexos

| Definição | Padrão | Descrição |
| --- | --- | --- |
| Pasta de anexos | `assets` | Pasta (relativa ao documento) para imagens coladas/inseridas. |
| Nomenclatura de arquivos de imagem | Carimbo de data/hora | Nomes com carimbo de data/hora, ou manter o nome de arquivo original. |
| Copiar imagens externas | Ligado | Copia imagens de fora da pasta do documento para os anexos. |
| Transferir imagens remotas | Desligado | Obtém URLs de imagens remotas para os anexos. |

## Idioma

| Definição | Padrão | Descrição |
| --- | --- | --- |
| Idioma da interface | Sistema | Segue a configuração regional do SO ou fixa um dos nove idiomas. Consulte [Idioma e localização](./language). |

## Links

| Definição | Padrão | Descrição |
| --- | --- | --- |
| Confirmar links externos | Ligado | Pergunta antes de abrir um link no navegador. |
