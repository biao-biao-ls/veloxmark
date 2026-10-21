---
title: Atualização automática
description: Como o VeloxMark se atualiza por forma de instalação — atualização automática completa em NSIS do Windows e AppImage do Linux, apenas notificação nos restantes casos, alternativa manual.
keywords: [atualização automática do VeloxMark, electron-updater, atualização AppImage, atualização NSIS, atualizar manualmente]
---

# Atualização automática

O VeloxMark procura novas versões no
[GitHub Releases](https://github.com/biao-biao-ls/veloxmark/releases)
e encaminha a atualização de forma diferente consoante a forma como o instalou.

## Comportamento por forma de instalação

| Forma de instalação | Comportamento de atualização |
| --- | --- |
| Instalador NSIS do Windows | Verificação completa → transferência → pedido → instalação ao reiniciar |
| AppImage do Linux | Verificação completa → transferência → pedido → instalação ao reiniciar |
| macOS (dmg / zip) | Apenas verificação — a compilação por assinar não consegue concluir atualizações Squirrel.Mac, pelo que o aplicativo abre a página de releases |
| Zip portátil / deb / rpm / snap / tar.gz | Apenas notificação — uma nova versão é anunciada e ligada |
| Modo de desenvolvimento (`npm run dev`) | Apenas notificação |

Depois de uma transferência terminar, **o aplicativo pede confirmação antes de sair para
instalar** — nada acontece às suas costas.

## Verificar manualmente

Use **Ajuda → Verificar atualizações** no menu do aplicativo. Nas formas de instalação
apenas com notificação, isto abre ou aponta-o para a página de releases.

## Manifestos de atualização

Os artefatos de release incluem manifestos do electron-updater (`latest.yml`,
`latest-mac.yml`, `latest-linux.yml`, `latest-linux-arm64.yml`) e `SHA256SUMS.txt`. O
caminho `path` do manifesto do Windows aponta para o `VeloxMark-Setup-<ver>.exe` universal.

## Se uma atualização falhar

1. Verifique a sua rede / proxy — as atualizações vêm do GitHub Releases.
2. Verifique a transferência manualmente contra o `SHA256SUMS.txt`
   (consulte [Instalação](./installation#verificar-a-transferencia)).
3. Recorra a uma instalação nova a partir da
   [página de releases](https://github.com/biao-biao-ls/veloxmark/releases) —
   as suas definições e rascunhos são mantidos.
