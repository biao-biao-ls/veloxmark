# VeloxMark

Пишите на Markdown — всё остальное лишь декорация.

[English](../../README.md) · [简体中文](zh.md) · [日本語](ja.md) · [한국어](ko.md) · [Español](es.md) · [Português](pt.md) · [Français](fr.md) · [Deutsch](de.md) · **Русский**

VeloxMark — бесплатный редактор и просмотрщик Markdown для рабочего стола с живым предпросмотром и открытым исходным кодом. Он стремится к тому ощущению письма без трения, которое популяризировал [Typora](https://typora.io), сохраняя при этом полную переносимость обычных `.md`-файлов — построен на Electron и CodeMirror 6, для macOS, Windows и Linux.

![VeloxMark светлая тема](../../website/docs/public/img/hero-light.png)

- Сайт и документация: https://veloxmark.knzn.net
- Загрузки: https://github.com/biao-biao-ls/veloxmark/releases

## Возможности

- **Живой предпросмотр (в стиле Typora)**: исходный текст Markdown — единственный источник данных. Когда курсор покидает строку, синтаксические маркеры вроде `#`, `**` и `` ` `` скрываются, и строка отображается в окончательном виде; строка с курсором всегда остаётся в исходной форме
- **Отрисовка блоков**: блоки кода (подсветка синтаксиса), формулы `$$` (KaTeX) и диаграммы ```` ```mermaid ```` — нажмите на любой блок, чтобы править его исходник
- **Таблицы**: нативное редактирование таблиц с вложенными редакторами ячеек, диалоги вставки/преобразования в таблицу, изменение ширины столбцов и выравнивание
- **Навигация по оглавлению**: дерево заголовков в боковой панели, переход по клику и подсветка текущей позиции
- **Несколько вкладок**: открывайте несколько файлов сразу, закрывайте и восстанавливайте вкладки; несохранённые изменения помечаются `•`
- **Режимы концентрации**: режим фокуса, режим пишущей машинки и режим исходного кода
- **Светлая/тёмная тема**: переключение в меню **Вид → Сменить тему**, настройка запоминается между сессиями; бескаркасная строка заголовка и меню приложения (Файл/Правка/Вид/Справка) следуют теме
- **Работа с файлами**: открыть / сохранить / сохранить как; собственные кнопки окна (свернуть/развернуть/закрыть)
- **Экспорт**: PDF и HTML, включая экспорт только выделенного фрагмента в HTML
- **Помощь при вводе**: вставленные ссылки оборачиваются в ссылки, вставленный HTML превращается в Markdown
- **Списки задач**: `- [ ]` отображается как кликабельный флажок
- **Изображения**: абсолютные пути, относительные пути (относительно текущего `.md`-файла) и удалённые изображения
- **Автообновление**: установщики проверяют GitHub Releases и обновляются на месте (Windows NSIS и Linux AppImage)
- **Локализация**: интерфейс на русском, English, 简体中文, 日本語, 한국어, Español, Português, Français и Deutsch (включая нативные меню и примеры документов)

## Установка

Скачайте сборку для вашей платформы со [страницы релизов](https://github.com/biao-biao-ls/veloxmark/releases/latest):

- **Windows** — установщик NSIS (с автообновлением) или портативный zip
- **macOS** — dmg и zip (неподписанные сборки). При первом запуске щёлкните правой кнопкой → **Открыть**, или снимите карантин: `xattr -d com.apple.quarantine /Applications/VeloxMark.app`
- **Linux** — AppImage (с автообновлением), deb, rpm, tar.gz или snap

## Разработка

```bash
npm install
npm run dev      # режим разработки (горячая перезагрузка)
npm run build    # сборка в out/
npm run typecheck
```

> Если загрузка бинарных файлов Electron не удаётся в ограниченных сетях:
> `ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ npm install`

## Технологии

- [Electron](https://www.electronjs.org) + [electron-vite](https://electron-vite.org) + React + TypeScript
- [CodeMirror 6](https://codemirror.net) — ядро редактора; живой предпросмотр на декорациях StateField
- [KaTeX](https://katex.org) — формулы
- [mermaid](https://mermaid.js.org) — диаграммы
- [highlight.js](https://highlightjs.org) — подсветка кода

## Архитектура

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

Ключевой принцип: текст Markdown всегда остаётся единственным источником данных (сохранение записывает чистый `.md`, потерь при туда-обратном преобразовании нет). Движок декораций пересоздаёт Decorations при каждом изменении документа или выделения: синтаксические маркеры скрываются декорациями replace, а блоки кода/формул/диаграмм подменяются виджетами. Когда курсор входит в диапазон, декорации этого диапазона пропускаются, и возвращается исходная форма.

## Документация

Полная пользовательская документация — на [сайте](https://veloxmark.knzn.net/ru/docs/). Руководство по релизам (процесс, артефакты, статус подписи, устранение неполадок) — в [CLAUDE.md](../../CLAUDE.md), раздел «Release process».

## Участие в разработке

- **Сообщения коммитов и комментарии в коде должны быть написаны на английском.**
- **Переводы размещаются только в пакетах локализации** — по одному пакету (файлу или каталогу) на язык:
  - `src/renderer/src/i18n/<lang>.ts` — словарь интерфейса и самоназвания языков
  - `electron/shared/menuStrings/<lang>.ts` — тексты нативных меню
  - `src/renderer/src/content/<lang>.ts` — документы приветствия/справки
  - `src/renderer/src/editor/mermaidTemplates/<lang>.ts` — тела шаблонов Mermaid
  - `docs/readme/<lang>.md` — переводы этого README
  - `website/docs/<lang>/` и `website/docs/.vitepress/locales/<lang>.ts` — страницы сайта и строки интерфейса сайта

  Всё остальное в репозитории остаётся только на английском.

## Лицензия

[MIT](../../LICENSE)
