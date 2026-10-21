/**
 * Website UI strings — Portuguese (neutral, internationally readable).
 * One pack per language; translations live only in these packs and in
 * website/docs/<lang>/ (see CLAUDE.md language policy).
 */

import type { WebsiteLocaleStrings } from './en'

export const PT: WebsiteLocaleStrings = {
  label: 'Português',
  lang: 'pt-BR',
  hreflang: 'pt',
  link: '/pt/',
  ogLocale: 'pt_BR',
  titleTemplate: 'Um editor de Markdown com pré-visualização em tempo real',
  description:
    'Um editor de Markdown gratuito e de código aberto, com pré-visualização em tempo real, para macOS, Windows e Linux. Matemática KaTeX, diagramas Mermaid e tabelas nativas — tudo renderizado em tempo real.',
  homeOgTitle: 'VeloxMark — um editor de Markdown com pré-visualização em tempo real',
  keywords:
    'editor de markdown, pré-visualização em tempo real, código aberto, WYSIWYG, KaTeX, Mermaid, alternativa ao Typora, Electron, CodeMirror',
  nav: [
    { text: 'Documentação', link: '/pt/docs/' },
    { text: 'Transferir', link: '/pt/download' }
  ],
  sidebar: [
    {
      text: 'Primeiros passos',
      items: [
        { text: 'Introdução', link: '/pt/docs/' },
        { text: 'Instalação', link: '/pt/docs/installation' },
        { text: 'Noções básicas', link: '/pt/docs/basics' }
      ]
    },
    {
      text: 'Escrita',
      items: [
        { text: 'Edição aprofundada', link: '/pt/docs/editing' },
        { text: 'Sintaxe Markdown', link: '/pt/docs/markdown-syntax' },
        { text: 'Imagens', link: '/pt/docs/images' }
      ]
    },
    {
      text: 'Referência',
      items: [
        { text: 'Preferências', link: '/pt/docs/preferences' },
        { text: 'Atalhos de teclado', link: '/pt/docs/key-bindings' },
        { text: 'Idioma e localização', link: '/pt/docs/language' },
        { text: 'Exportar um documento', link: '/pt/docs/export' },
        { text: 'Temas', link: '/pt/docs/themes' }
      ]
    },
    {
      text: 'Ajuda',
      items: [
        { text: 'Atualização automática', link: '/pt/docs/updates' },
        { text: 'Perguntas frequentes', link: '/pt/docs/faq' }
      ]
    }
  ],
  editLinkText: 'Editar esta página no GitHub',
  footerMessage: 'Publicado sob a Licença MIT.',
  outlineLabel: 'Nesta página',
  docPrev: 'Anterior',
  docNext: 'Próximo',
  breadcrumbHome: 'Início',
  breadcrumbDocs: 'Documentação',
  trustTicks: ['macOS · Windows · Linux', 'Dados locais, sem conta', 'Licença MIT, para sempre'],
  schemaDescription:
    'Um editor de Markdown gratuito e de código aberto, com pré-visualização em tempo real, para macOS, Windows e Linux. O código-fonte Markdown é a única fonte de dados — salvar escreve .md puro, com zero perda de ida e volta. Matemática KaTeX, diagramas Mermaid, edição de tabelas nativa, alertas, notas de rodapé e destaques, tudo renderizado em tempo real.',
  schemaFeatures: [
    'Edição com pré-visualização em tempo real (estilo Typora, no local)',
    'Matemática KaTeX e diagramas Mermaid renderizados em tempo real',
    'Edição de tabelas nativa com editores de célula aninhados',
    'Modo de foco, modo máquina de escrever, temas claro e escuro',
    'Exportação para PDF e HTML',
    'Arquivos Markdown puros, com zero perda de ida e volta',
    'Nove idiomas de interface'
  ],
  llmsTxt:
    '# VeloxMark\n\n' +
    '> VeloxMark é um editor de Markdown gratuito e de código aberto (MIT), com pré-visualização em tempo real, para macOS, Windows e Linux. O código-fonte Markdown é a única fonte de dados: o editor renderiza títulos, fórmulas, diagramas e tabelas no local, enquanto o arquivo em disco permanece Markdown puro, com zero perda de ida e volta.\n\n' +
    'VeloxMark é construído sobre Electron e CodeMirror 6. O seu motor de pré-visualização em tempo real esconde os marcadores de sintaxe quando o cursor abandona uma linha (estilo Typora), e qualquer bloco renderizado — código, fórmula KaTeX, diagrama Mermaid, tabela, imagem — pode ser clicado para editar o seu código-fonte Markdown. Inclui edição de tabelas nativa, modo de foco e modo máquina de escrever, temas claro/escuro, exportação PDF/HTML, nove idiomas de interface e atualização automática no Windows (NSIS) e no Linux (AppImage).\n\n' +
    'Fatos-chave: licença MIT · sem conta, sem telemetria · dados locais · instaladores para macOS (dmg/zip), Windows (instalador NSIS, zip portátil), Linux (AppImage, deb, rpm, tar.gz, snap) · GitHub Releases com checksums SHA256SUMS.txt.\n\n' +
    '## Documentação\n\n' +
    '- [Introdução](https://veloxmark.knzn.net/pt/docs/): O que é o VeloxMark, como funciona a pré-visualização em tempo real e a garantia de zero perda de ida e volta\n' +
    '- [Instalação](https://veloxmark.knzn.net/pt/docs/installation): Instaladores por plataforma, verificação de checksums, compilação a partir do código-fonte, desinstalação\n' +
    '- [Noções básicas](https://veloxmark.knzn.net/pt/docs/basics): Anatomia da janela, barra lateral (arquivos/estrutura/pesquisa), abas, modos do editor\n' +
    '- [Edição aprofundada](https://veloxmark.knzn.net/pt/docs/editing): Comportamento da pré-visualização em tempo real, componentes de bloco, edição de tabelas, assistências de digitação\n' +
    '- [Sintaxe Markdown](https://veloxmark.knzn.net/pt/docs/markdown-syntax): Tudo o que é renderizado de forma especial — títulos, matemática KaTeX, Mermaid, alertas, notas de rodapé, destaques, front matter\n' +
    '- [Imagens](https://veloxmark.knzn.net/pt/docs/images): Resolução de caminhos, dimensões `=WxH`, atributos `{align=}`/`{flip=}`, anexos\n' +
    '- [Preferências](https://veloxmark.knzn.net/pt/docs/preferences): Todas as definições com os valores padrão — aparência, editor, arquivos, salvamento automático, imagens\n' +
    '- [Atalhos de teclado](https://veloxmark.knzn.net/pt/docs/key-bindings): Tabelas completas de comandos/atalhos para cada plataforma\n' +
    '- [Idioma e localização](https://veloxmark.knzn.net/pt/docs/language): Nove idiomas de interface e como funciona a escolha de idioma\n' +
    '- [Exportar um documento](https://veloxmark.knzn.net/pt/docs/export): Opções de exportação PDF e HTML, exportação apenas da seleção\n' +
    '- [Temas](https://veloxmark.knzn.net/pt/docs/themes): Temas claro e escuro, alternância, como os temas se aplicam aos componentes\n' +
    '- [Atualização automática](https://veloxmark.knzn.net/pt/docs/updates): Comportamento de atualização por forma de instalação (NSIS/AppImage totalmente automática; as restantes apenas notificam)\n' +
    '- [Perguntas frequentes](https://veloxmark.knzn.net/pt/docs/faq): Plataformas suportadas, licenciamento, resolução de problemas, onde ficam os dados\n\n' +
    '## Transferir\n\n' +
    '- [Transferir](https://veloxmark.knzn.net/pt/download): Todos os instaladores por plataforma, com verificação de checksums e comportamento de atualização\n\n' +
    '## Código-fonte\n\n' +
    '- [Repositório no GitHub](https://github.com/biao-biao-ls/veloxmark): Código-fonte, rastreador de problemas, releases (licença MIT)\n\n' +
    '## Opcional\n\n' +
    '- [Documentação completa em texto simples](https://veloxmark.knzn.net/pt/llms-full.txt): Todo o conteúdo da documentação concatenado para uso offline em LLMs\n'
}
