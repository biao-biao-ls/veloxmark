/**
 * Website UI strings — Russian.
 * One pack per language; translations live only in these packs and in
 * website/docs/<lang>/ (see CLAUDE.md language policy).
 */

import type { WebsiteLocaleStrings } from './en'

export const RU: WebsiteLocaleStrings = {
  label: 'Русский',
  lang: 'ru-RU',
  hreflang: 'ru',
  link: '/ru/',
  ogLocale: 'ru_RU',
  titleTemplate: 'Markdown-редактор с живым предпросмотром',
  description:
    'Бесплатный Markdown-редактор с открытым исходным кодом и живым предпросмотром для macOS, Windows и Linux. Формулы KaTeX, диаграммы Mermaid и нативные таблицы — всё рендерится вживую.',
  homeOgTitle: 'VeloxMark — Markdown-редактор с живым предпросмотром',
  keywords:
    'markdown редактор, живой предпросмотр, открытый исходный код, WYSIWYG, KaTeX, Mermaid, альтернатива Typora, Electron, CodeMirror',
  nav: [
    { text: 'Документация', link: '/ru/docs/' },
    { text: 'Скачать', link: '/ru/download' }
  ],
  sidebar: [
    {
      text: 'Начало работы',
      items: [
        { text: 'Введение', link: '/ru/docs/' },
        { text: 'Установка', link: '/ru/docs/installation' },
        { text: 'Основы', link: '/ru/docs/basics' }
      ]
    },
    {
      text: 'Написание',
      items: [
        { text: 'Подробнее о редактировании', link: '/ru/docs/editing' },
        { text: 'Синтаксис Markdown', link: '/ru/docs/markdown-syntax' },
        { text: 'Изображения', link: '/ru/docs/images' }
      ]
    },
    {
      text: 'Справочник',
      items: [
        { text: 'Настройки', link: '/ru/docs/preferences' },
        { text: 'Горячие клавиши', link: '/ru/docs/key-bindings' },
        { text: 'Язык и локализация', link: '/ru/docs/language' },
        { text: 'Экспорт документа', link: '/ru/docs/export' },
        { text: 'Темы', link: '/ru/docs/themes' }
      ]
    },
    {
      text: 'Помощь',
      items: [
        { text: 'Автообновление', link: '/ru/docs/updates' },
        { text: 'Частые вопросы', link: '/ru/docs/faq' }
      ]
    }
  ],
  editLinkText: 'Редактировать эту страницу на GitHub',
  footerMessage: 'Выпущено под лицензией MIT.',
  outlineLabel: 'На этой странице',
  docPrev: 'Назад',
  docNext: 'Далее',
  breadcrumbHome: 'Главная',
  breadcrumbDocs: 'Документация',
  trustTicks: ['macOS · Windows · Linux', 'Локально, без аккаунта', 'Лицензия MIT навсегда'],
  schemaDescription:
    'Бесплатный Markdown-редактор с открытым исходным кодом и живым предпросмотром для macOS, Windows и Linux. Исходный текст Markdown — единственный источник данных: сохранение записывает обычный .md без потерь при цикле чтения-записи. Формулы KaTeX, диаграммы Mermaid, нативное редактирование таблиц, выноски, сноски и подсветка — всё рендерится вживую.',
  schemaFeatures: [
    'Редактирование с живым предпросмотром (в стиле Typora, на месте)',
    'Формулы KaTeX и диаграммы Mermaid рендерятся вживую',
    'Нативное редактирование таблиц со вложенными редакторами ячеек',
    'Режим фокуса, режим печатной машинки, светлая и тёмная темы',
    'Экспорт в PDF и HTML',
    'Обычные Markdown-файлы без потерь при цикле чтения-записи',
    'Девять языков интерфейса'
  ],
  llmsTxt:
    '# VeloxMark\n\n' +
    '> VeloxMark — бесплатный Markdown-редактор с открытым исходным кодом (MIT) и живым предпросмотром для macOS, Windows и Linux. Исходный текст Markdown — единственный источник данных: редактор рендерит заголовки, формулы, диаграммы и таблицы на месте, а файл на диске остаётся обычным Markdown с нулевыми потерями при сохранении.\n\n' +
    'VeloxMark построен на Electron и CodeMirror 6. Его движок живого предпросмотра скрывает синтаксические маркеры, когда курсор покидает строку (в стиле Typora), а любой отрендеренный блок — код, формула KaTeX, диаграмма Mermaid, таблица, изображение — можно щёлкнуть, чтобы отредактировать его исходный Markdown. В приложении есть нативное редактирование таблиц, режим фокуса и режим печатной машинки, светлые и тёмные темы, экспорт в PDF/HTML, девять языков интерфейса и автообновление в Windows (NSIS) и Linux (AppImage).\n\n' +
    'Ключевые факты: лицензия MIT · без аккаунта, без телеметрии · локально · установки для macOS (dmg/zip), Windows (NSIS-установщик, портативный zip), Linux (AppImage, deb, rpm, tar.gz, snap) · GitHub Releases с контрольными суммами SHA256SUMS.txt.\n\n' +
    '## Документация\n\n' +
    '- [Введение](https://veloxmark.knzn.net/ru/docs/): что такое VeloxMark, как работает живой предпросмотр и гарантия нулевых потерь при цикле чтения-записи\n' +
    '- [Установка](https://veloxmark.knzn.net/ru/docs/installation): установщики для каждой платформы, проверка контрольных сумм, сборка из исходников, удаление\n' +
    '- [Основы](https://veloxmark.knzn.net/ru/docs/basics): устройство окна, боковая панель (файлы/структура/поиск), вкладки, режимы редактора\n' +
    '- [Подробнее о редактировании](https://veloxmark.knzn.net/ru/docs/editing): поведение живого предпросмотра, блочные виджеты, редактирование таблиц, помощники ввода\n' +
    '- [Синтаксис Markdown](https://veloxmark.knzn.net/ru/docs/markdown-syntax): всё, что рендерится особо — заголовки, формулы KaTeX, Mermaid, выноски, сноски, подсветка, метаданные\n' +
    '- [Изображения](https://veloxmark.knzn.net/ru/docs/images): разрешение путей, размер `=WxH`, атрибуты `{align=}`/`{flip=}`, вложения\n' +
    '- [Настройки](https://veloxmark.knzn.net/ru/docs/preferences): все параметры со значениями по умолчанию — оформление, редактор, файлы, автосохранение, изображения\n' +
    '- [Горячие клавиши](https://veloxmark.knzn.net/ru/docs/key-bindings): полные таблицы команд и сочетаний для каждой платформы\n' +
    '- [Язык и локализация](https://veloxmark.knzn.net/ru/docs/language): девять языков интерфейса и принципы выбора языка\n' +
    '- [Экспорт документа](https://veloxmark.knzn.net/ru/docs/export): параметры экспорта в PDF и HTML, экспорт только выделения\n' +
    '- [Темы](https://veloxmark.knzn.net/ru/docs/themes): светлая и тёмная темы, переключение, как темы применяются к виджетам\n' +
    '- [Автообновление](https://veloxmark.knzn.net/ru/docs/updates): поведение обновлений для каждой формы установки (NSIS/AppImage — полностью автоматически; остальные — только уведомление)\n' +
    '- [Частые вопросы](https://veloxmark.knzn.net/ru/docs/faq): поддерживаемые платформы, лицензия, устранение неполадок, где хранятся данные\n\n' +
    '## Скачать\n\n' +
    '- [Скачать](https://veloxmark.knzn.net/ru/download): все установщики по платформам с проверкой контрольных сумм и поведением обновлений\n\n' +
    '## Исходный код\n\n' +
    '- [Репозиторий GitHub](https://github.com/biao-biao-ls/veloxmark): исходный код, трекер проблем, релизы (лицензия MIT)\n\n' +
    '## Необязательно\n\n' +
    '- [Полная документация в виде простого текста](https://veloxmark.knzn.net/ru/llms-full.txt): всё содержимое документации, объединённое для офлайнового использования LLM\n'
}
