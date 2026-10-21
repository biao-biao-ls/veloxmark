# VeloxMark

Escreva em Markdown — todo o resto é decoração.

[English](../../README.md) · [简体中文](zh.md) · [日本語](ja.md) · [한국어](ko.md) · [Español](es.md) · **Português** · [Français](fr.md) · [Deutsch](de.md) · [Русский](ru.md)

VeloxMark é um leitor e editor de Markdown para desktop, gratuito e de código aberto, com pré-visualização ao vivo. Ele busca a sensação de escrita sem atrito popularizada pelo [Typora](https://typora.io), mantendo os arquivos `.md` em texto puro totalmente portáteis — construído sobre Electron e CodeMirror 6, para macOS, Windows e Linux.

![VeloxMark tema claro](../../website/docs/public/img/hero-light.png)

- Site e documentação: https://veloxmark.knzn.net
- Downloads: https://github.com/biao-biao-ls/veloxmark/releases

## Recursos

- **Pré-visualização ao vivo (estilo Typora)**: o texto-fonte Markdown é a única fonte de dados. Quando o cursor sai de uma linha, marcas de sintaxe como `#`, `**` e `` ` `` ficam ocultas e a linha é renderizada em seu estilo final; a linha do cursor permanece em forma de fonte
- **Renderização de blocos**: blocos de código (realce de sintaxe), matemática `$$` (KaTeX) e diagramas ```` ```mermaid ```` — clique em qualquer bloco para editar seu código-fonte
- **Tabelas**: edição de tabelas nativa com editores de célula aninhados, diálogos para inserir/ converter em tabela, redimensionamento de colunas e alinhamento
- **Navegação por esquema**: árvore de títulos na barra lateral com salto por clique e destaque da posição atual
- **Edição com várias abas**: abra vários arquivos de uma vez, feche/restaure abas; alterações não salvas são marcadas com `•`
- **Modos de foco**: modo foco, modo máquina de escrever e modo fonte
- **Tema claro/escuro**: alterne pelo menu **Exibir → Alternar tema** e a preferência é lembrada entre sessões; a barra de título sem moldura e os menus do aplicativo (Arquivo/Editar/Exibir/Ajuda) seguem o tema
- **Operações de arquivo**: abrir / salvar / salvar como; controles de janela personalizados (minimizar/maximizar/fechar)
- **Exportação**: PDF e HTML, incluindo exportação apenas da seleção como HTML
- **Auxílio de digitação**: envolve URLs coladas em links e converte HTML colado em Markdown
- **Listas de tarefas**: `- [ ]` é renderizado como uma caixa de seleção clicável
- **Imagens**: caminhos absolutos, caminhos relativos (em relação ao arquivo `.md` atual) e imagens remotas
- **Atualização automática**: os instaladores verificam o GitHub Releases e atualizam no local (Windows NSIS e Linux AppImage)
- **Localização**: interface em português, English, 简体中文, 日本語, 한국어, Español, Français, Deutsch e Русский (incluindo menus nativos e documentos de exemplo)

## Instalação

Baixe a build da sua plataforma na [página de releases](https://github.com/biao-biao-ls/veloxmark/releases/latest):

- **Windows** — instalador NSIS (com atualização automática) ou zip portátil
- **macOS** — dmg e zip (builds sem assinatura). No primeiro início, clique com o botão direito → **Abrir**, ou remova a marca de quarentena: `xattr -d com.apple.quarantine /Applications/VeloxMark.app`
- **Linux** — AppImage (com atualização automática), deb, rpm, tar.gz ou snap

## Desenvolvimento

```bash
npm install
npm run dev      # modo de desenvolvimento (hot reload)
npm run build    # compilar para out/
npm run typecheck
```

> Se o download dos binários do Electron falhar em redes restritas:
> `ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ npm install`

## Stack de tecnologias

- [Electron](https://www.electronjs.org) + [electron-vite](https://electron-vite.org) + React + TypeScript
- [CodeMirror 6](https://codemirror.net) — núcleo do editor; pré-visualização ao vivo via decorações StateField
- [KaTeX](https://katex.org) — matemática
- [mermaid](https://mermaid.js.org) — diagramas
- [highlight.js](https://highlightjs.org) — realce de código

## Arquitetura

```
electron/main.ts        main process: windows, native menus, file dialogs, mdres:// image protocol
electron/preload.ts     contextBridge-safe IPC API
electron/updater.ts     auto-update routing (electron-updater / manual check)
src/renderer/src/
  App.tsx               shell: title bar, sidebar outline, file/theme state
  editor/livePreview/   live-preview core (StateField decoration engine)
  editor/widgets.ts     code/math/mermaid/image/task widgets
  editor/setup.ts       CodeMirror extension assembly, keybindings
  editor/theme.ts       light/dark themes (CM6 theme + CSS variables)
  outline/extract.ts    heading outline extraction from the syntax tree
  i18n/                 UI dictionaries (en/zh/ja/ko/es/pt/fr/de/ru)
```

Design fundamental: o texto Markdown é sempre a única fonte de dados (salvar escreve um `.md` puro, sem perda de ida e volta). O motor de decorações reconstrói as Decorations a cada mudança de documento/seleção: marcas de sintaxe são ocultadas com decorações replace e blocos de código/matemática/diagramas são substituídos por widgets. Quando o cursor entra em um intervalo, as decorações daquele intervalo são puladas e a forma-fonte volta.

## Documentação

A documentação completa do usuário está no [site](https://veloxmark.knzn.net/pt/docs/). O manual de release (processo, artefatos, status de assinatura, solução de problemas) está no [CLAUDE.md](../../CLAUDE.md), na seção "Release process".

## Contribuindo

- **Mensagens de commit e comentários de código devem ser escritos em inglês.**
- **Traduções pertencem apenas aos pacotes de localização** — um pacote (arquivo ou diretório) por idioma:
  - `src/renderer/src/i18n/<lang>.ts` — dicionário da interface e nomes próprios dos idiomas
  - `electron/shared/menuStrings/<lang>.ts` — textos dos menus nativos
  - `src/renderer/src/content/<lang>.ts` — documentos de boas-vindas/ajuda
  - `src/renderer/src/editor/mermaidTemplates/<lang>.ts` — corpos dos modelos Mermaid
  - `docs/readme/<lang>.md` — traduções deste README
  - `website/docs/<lang>/` e `website/docs/.vitepress/locales/<lang>.ts` — páginas e textos de interface do site

  Todo o restante do repositório permanece apenas em inglês.

## Licença

[MIT](../../LICENSE)
