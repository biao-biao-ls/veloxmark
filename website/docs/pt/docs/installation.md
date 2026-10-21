---
title: Instalação
description: Instale o VeloxMark em macOS, Windows ou Linux — formatos de instalador, verificação de checksums SHA256, compilação a partir do código-fonte, atualização e desinstalação.
keywords: [instalar VeloxMark, instalador do editor de Markdown, AppImage, NSIS, dmg, deb, rpm, snap, verificação de checksums]
---

# Instalação

O VeloxMark é gratuito e de código aberto. Binários pré-compilados para macOS, Windows e
Linux são publicados no
[GitHub Releases](https://github.com/biao-biao-ls/veloxmark/releases).
Cada release inclui um arquivo `SHA256SUMS.txt` para que possa verificar o que transfere.

## Windows

| Artefato | Notas |
| --- | --- |
| `VeloxMark-Setup-<ver>-x64.exe` / `-arm64.exe` | Instalador NSIS, recomendado. Atualiza-se no próprio lugar. |
| `VeloxMark-Setup-<ver>.exe` | Instalador universal (o manifesto de atualização automática aponta para aqui). |
| `VeloxMark-Win-<arch>-<ver>.zip` | Compilação portátil — descompacte e execute, sem instalador, sem atualização automática. |

Execute o instalador e inicie o VeloxMark pelo menu Iniciar. Não é necessária conta.

## macOS

| Artefato | Notas |
| --- | --- |
| `VeloxMark-Mac-arm64-<ver>.dmg` / `VeloxMark-Mac-x64-<ver>.dmg` | Imagens de disco para Apple Silicon e Intel. |
| `VeloxMark-Mac-arm64-<ver>.zip` / `VeloxMark-Mac-x64-<ver>.zip` | Arquivos zip (também o veículo de atualização automática). |

Arraste o aplicativo para **Aplicações** e inicie-o.

> [!WARNING]
> As compilações de release estão atualmente **por assinar**. O macOS Gatekeeper se recusa
> a abrir o aplicativo na primeira execução. Em vez disso, remova o atributo de quarentena:
>
> ```sh
> xattr -d com.apple.quarantine /Applications/VeloxMark.app
> ```

Como as compilações são por assinar, a atualização automática dentro do aplicativo não
consegue instalar no macOS — o atualizador recorre a abrir a página de releases, para
que possa transferir a nova versão manualmente.

## Linux

| Formato | Notas |
| --- | --- |
| `VeloxMark-Linux-x86_64-<ver>.AppImage` / `…-aarch64-…` | Recomendado. `chmod +x` e execute. Atualização automática completa. |
| `VeloxMark-Linux-amd64-<ver>.deb` / `…-arm64-…` | Debian / Ubuntu: `sudo apt install ./VeloxMark-Linux-amd64-<ver>.deb` |
| `VeloxMark-Linux-x86_64-<ver>.rpm` / `…-aarch64-…` | Fedora / RHEL / openSUSE. |
| `VeloxMark-Linux-<arch>-<ver>.tar.gz` | Tarball portátil. |
| `VeloxMark-Linux-x64-<ver>.snap` | Pacote Snap (apenas x64). |

As instalações deb, rpm, snap e tar.gz apenas recebem notificações de atualização — o
aplicativo informa que existe uma nova versão e aponta-o para a página de releases.

## Verificar a transferência

Cada release inclui `SHA256SUMS.txt`. Verifique o seu arquivo contra ele:

```sh
sha256sum -c SHA256SUMS.txt --ignore-missing
```

No macOS: `shasum -a 256 -c SHA256SUMS.txt --ignore-missing` (ou `shasum -a 256 <file>` e
compare à mão). No Windows (PowerShell):

```powershell
Get-FileHash .\VeloxMark-Setup-0.1.0-x64.exe -Algorithm SHA256
```

## Atualização

O VeloxMark procura novas versões no GitHub Releases. O comportamento depende da forma de
instalação:

- **NSIS do Windows** e **AppImage do Linux** — verificação, transferência e instalação
  completas. Após a transferência, o aplicativo pede confirmação antes de sair para instalar.
- **macOS** — a verificação encontra a release, mas a compilação por assinar não consegue
  concluir atualizações Squirrel.Mac; o aplicativo abre a página de releases.
- **Todo o resto** (zip portátil, deb / rpm / snap / tar.gz, modo de desenvolvimento) —
  verificação manual apenas com notificação.

Também pode sempre obter a versão mais recente na
[página de releases](https://github.com/biao-biao-ls/veloxmark/releases).

## Compilar a partir do código-fonte

```sh
git clone https://github.com/biao-biao-ls/veloxmark.git
cd veloxmark
npm install
npm run dev      # modo de desenvolvimento
npm run build    # compilação de produção para out/
```

Se os binários do Electron falharem a transferir em redes restritas:

```sh
ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ npm install
```

Empacote uma versão distribuível com `npm run build:win`, `npm run build:mac` ou
`npm run build:linux`.

## Desinstalação

- **Windows** — Configurações → Aplicativos → VeloxMark → Desinstalar.
- **macOS** — arraste VeloxMark.app de Aplicações para o Lixo.
- **Linux** — remova o pacote (`apt remove`, `dnf remove`, `snap remove`) ou apague o
  AppImage / o tarball extraído.

Os dados do usuário (rascunhos, preferências, estado da sessão) ficam na pasta padrão de
dados do aplicativo por usuário; apague-a apenas se quiser um recomeço limpo.
