---
title: Perguntas frequentes
description: Perguntas frequentes sobre o VeloxMark — plataformas suportadas, licenciamento, como funciona a pré-visualização em tempo real, ida e volta de arquivos, localizações de dados, macOS Gatekeeper e comportamento de atualização.
keywords: [FAQ do VeloxMark, perguntas frequentes do editor de Markdown, perguntas sobre pré-visualização em tempo real, resolução de problemas do VeloxMark]
head:
  - - script
    - type: application/ld+json
    - '{"@context":"https://schema.org","@type":"FAQPage","mainEntity":[{"@type":"Question","name":"Quais plataformas são suportadas?","acceptedAnswer":{"@type":"Answer","text":"macOS (Apple Silicon e Intel), Windows 10/11 (x64 e ARM64) e Linux (x64 e arm64 — AppImage, deb, rpm, tar.gz; snap apenas x64)."}},{"@type":"Question","name":"O VeloxMark é gratuito?","acceptedAnswer":{"@type":"Answer","text":"Sim. O VeloxMark é de código aberto sob a Licença MIT. Sem conta, sem assinatura, sem telemetria."}},{"@type":"Question","name":"O que é pré-visualização em tempo real e em que difere de uma vista dividida?","acceptedAnswer":{"@type":"Answer","text":"Não há painel de pré-visualização. O editor renderiza o Markdown no local: quando o cursor abandona uma linha, os marcadores de sintaxe desaparecem e a linha mostra a sua forma final. A linha do cursor permanece sempre em forma de código-fonte, e clicar em qualquer bloco renderizado devolve o Markdown original para edição. O código-fonte Markdown é a única fonte de dados — salvar escreve .md puro com zero perda de ida e volta."}},{"@type":"Question","name":"O VeloxMark altera os meus arquivos Markdown ao salvar?","acceptedAnswer":{"@type":"Answer","text":"Não. Salvar escreve o texto de origem de volta, sem alterações. Toda a renderização é decoração."}},{"@type":"Question","name":"Qual sintaxe Markdown é suportada?","acceptedAnswer":{"@type":"Answer","text":"CommonMark + GFM (tabelas, listas de tarefas, tachado), além de matemática KaTeX, diagramas Mermaid, alertas, notas de rodapé e texto destacado."}},{"@type":"Question","name":"Posso usar o VeloxMark para gestão de notas?","acceptedAnswer":{"@type":"Answer","text":"O VeloxMark é um leitor/editor de Markdown focado — abra pastas e arquivos, use a estrutura e a pesquisa, mas não há camada de gestão de conhecimento. Os seus arquivos permanecem .md puros em disco, para que qualquer outra ferramenta possa trabalhar com eles."}},{"@type":"Question","name":"Como relato um bug?","acceptedAnswer":{"@type":"Answer","text":"Abra uma issue no GitHub com a versão do aplicativo (menu Ajuda), o seu sistema operacional, os passos para reproduzir e o Markdown que se comporta mal."}},{"@type":"Question","name":"Onde ficam os meus rascunhos e definições?","acceptedAnswer":{"@type":"Answer","text":"Preferências, rascunhos e estado da sessão ficam na pasta padrão de dados do aplicativo por usuário (Electron userData): Windows %APPDATA%\\VeloxMark, macOS ~/Library/Application Support/VeloxMark, Linux ~/.config/VeloxMark. Os documentos nunca são movidos nem copiados."}},{"@type":"Question","name":"Por que o macOS diz que o aplicativo é de um programador não identificado?","acceptedAnswer":{"@type":"Answer","text":"As compilações de release estão atualmente por assinar. Execute xattr -d com.apple.quarantine /Applications/VeloxMark.app uma vez após a instalação."}},{"@type":"Question","name":"O aplicativo não atualiza automaticamente na minha plataforma — isso é esperado?","acceptedAnswer":{"@type":"Answer","text":"Sim. A atualização automática completa está ativa em instalações NSIS do Windows e AppImage do Linux; as outras formas de instalação apenas notificam, e o macOS recorre atualmente à abertura da página de releases porque as compilações não são assinadas."}}]}'
---

# Perguntas frequentes (FAQ)

### Quais plataformas são suportadas?

macOS (Apple Silicon e Intel), Windows 10/11 (x64 e ARM64) e Linux (x64 e arm64 —
AppImage, deb, rpm, tar.gz; snap apenas x64). Consulte [Instalação](./installation).

### O VeloxMark é gratuito?

Sim. O VeloxMark é de código aberto sob a
[Licença MIT](https://github.com/biao-biao-ls/veloxmark/blob/main/LICENSE). Sem conta,
sem assinatura, sem telemetria.

### O que é a "pré-visualização em tempo real" e em que difere de uma vista dividida?

Não há painel de pré-visualização. O editor renderiza o seu Markdown **no local**: quando o
cursor abandona uma linha, marcadores de sintaxe como `#`, `**` e `` ` `` desaparecem e a
linha mostra a sua forma final. A linha do cursor permanece sempre em forma de código-fonte,
e clicar em qualquer bloco renderizado (código, fórmula, diagrama, tabela, imagem) devolve
o Markdown original para edição. O código-fonte Markdown é a única fonte de dados — salvar
escreve `.md` puro, com zero perda de ida e volta.

### O VeloxMark altera os meus arquivos Markdown ao salvar?

Não. Salvar escreve o texto de origem de volta, sem alterações. Toda a renderização é
decoração.

### Qual sintaxe Markdown é suportada?

CommonMark + GFM (tabelas, listas de tarefas, tachado), além de matemática KaTeX, diagramas
Mermaid, alertas, notas de rodapé e `==destaques==`. Referência completa:
[Sintaxe Markdown](./markdown-syntax).

### Posso usar o VeloxMark para gestão de notas?

O VeloxMark é um leitor/editor de Markdown focado — abra pastas e arquivos, use a estrutura
e a pesquisa, mas não há camada de gestão de conhecimento (sem etiquetas, ligações inversas
ou base de dados). Os seus arquivos permanecem `.md` puros em disco, para que qualquer
outra ferramenta possa trabalhar com eles.

### Como relato um bug?

Abra uma issue no [GitHub](https://github.com/biao-biao-ls/veloxmark/issues) com a versão
do aplicativo (menu Ajuda), o seu sistema operacional, os passos para reproduzir e o
Markdown que se comporta mal.

### Onde ficam os meus rascunhos e definições?

Preferências, rascunhos e estado da sessão ficam na pasta padrão de dados do aplicativo por
usuário (Electron `userData`): Windows `%APPDATA%\VeloxMark`, macOS
`~/Library/Application Support/VeloxMark`, Linux `~/.config/VeloxMark`. Os documentos nunca
são movidos nem copiados — você edita os arquivos onde eles estão.

### Por que o macOS diz que o aplicativo é de um programador não identificado?

As compilações de release estão atualmente por assinar. Execute
`xattr -d com.apple.quarantine /Applications/VeloxMark.app` uma vez após a instalação —
consulte [Instalação](./installation#macos).

### O aplicativo não atualiza automaticamente na minha plataforma — isso é esperado?

Sim. A atualização automática completa está ativa em instalações NSIS do Windows e AppImage
do Linux; as outras formas de instalação apenas notificam, e o macOS recorre atualmente à
abertura da página de releases porque as compilações não são assinadas. Detalhes:
[Atualização automática](./updates).
