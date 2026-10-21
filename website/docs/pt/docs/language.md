---
title: Idioma e localização
description: O VeloxMark é distribuído em nove idiomas de interface, incluindo menus nativos e documentos de exemplo. Como funciona a escolha de idioma e como contribuir com traduções.
keywords: [idiomas do VeloxMark, localização do editor de Markdown, idioma da interface, tradução]
---

# Idioma e localização

A interface do VeloxMark é distribuída em nove idiomas:

| Idioma | Código |
| --- | --- |
| Inglês | `en` |
| Chinês | `zh` |
| Japonês | `ja` |
| Coreano | `ko` |
| Espanhol | `es` |
| Português | `pt` |
| Francês | `fr` |
| Alemão | `de` |
| Russo | `ru` |

(No seletor de idioma do aplicativo, cada idioma é listado com o seu nome nativo.)

A localização cobre toda a interface: menus (nativos no macOS), caixas de diálogo, a barra
de status — e até os documentos de exemplo de boas-vindas / ajuda e os corpos dos modelos
Mermaid, que são escolhidos por configuração regional.

## Escolher um idioma

- **Seguir o sistema** por padrão — o aplicativo escolhe o idioma da interface a partir da
  configuração regional do seu SO quando existe um pacote para ele, com recurso ao inglês
  como alternativa.
- **Defina-o explicitamente** nas preferências / no menu Exibir; a escolha é lembrada entre
  sessões.

## Traduzir

As traduções vivem num arquivo de pacote por idioma (dicionário da interface, strings dos
menus nativos, documentos de boas-vindas/ajuda e modelos Mermaid). A paridade de chaves do
dicionário é imposta pelo sistema de tipos — um novo idioma tem de incluir os quatro
pacotes para passar o `npm run typecheck`. Contribuições são bem-vindas no
[GitHub](https://github.com/biao-biao-ls/veloxmark).
