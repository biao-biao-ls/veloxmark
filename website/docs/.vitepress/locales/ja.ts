/**
 * Website UI strings — Japanese.
 * One pack per language; translations live only in these packs and in
 * website/docs/<lang>/ (see CLAUDE.md language policy).
 */

import type { WebsiteLocaleStrings } from './en'

export const JA: WebsiteLocaleStrings = {
  label: '日本語',
  lang: 'ja-JP',
  hreflang: 'ja',
  link: '/ja/',
  ogLocale: 'ja_JP',
  titleTemplate: 'ライブプレビュー付き Markdown エディター',
  description:
    'macOS・Windows・Linux 向けの無料オープンソース Markdown エディター。KaTeX 数式、Mermaid 図表、ネイティブなテーブル——すべてライブで描画されます。',
  homeOgTitle: 'VeloxMark — ライブプレビュー付き Markdown エディター',
  keywords:
    'markdown エディター, ライブプレビュー, オープンソース, WYSIWYG, KaTeX, Mermaid, Typora 代替, Electron, CodeMirror',
  nav: [
    { text: 'ドキュメント', link: '/ja/docs/' },
    { text: 'ダウンロード', link: '/ja/download' }
  ],
  sidebar: [
    {
      text: 'はじめに',
      items: [
        { text: 'イントロダクション', link: '/ja/docs/' },
        { text: 'インストール', link: '/ja/docs/installation' },
        { text: '基本操作', link: '/ja/docs/basics' }
      ]
    },
    {
      text: '執筆',
      items: [
        { text: '編集の詳細', link: '/ja/docs/editing' },
        { text: 'Markdown 構文', link: '/ja/docs/markdown-syntax' },
        { text: '画像', link: '/ja/docs/images' }
      ]
    },
    {
      text: '参考',
      items: [
        { text: '環境設定', link: '/ja/docs/preferences' },
        { text: 'キーバインド', link: '/ja/docs/key-bindings' },
        { text: '言語とローカライズ', link: '/ja/docs/language' },
        { text: 'ドキュメントの書き出し', link: '/ja/docs/export' },
        { text: 'テーマ', link: '/ja/docs/themes' }
      ]
    },
    {
      text: 'ヘルプ',
      items: [
        { text: '自動更新', link: '/ja/docs/updates' },
        { text: 'よくある質問', link: '/ja/docs/faq' }
      ]
    }
  ],
  editLinkText: 'GitHub でこのページを編集',
  footerMessage: 'MIT ライセンスで公開されています。',
  outlineLabel: 'このページ内',
  docPrev: '前へ',
  docNext: '次へ',
  breadcrumbHome: 'ホーム',
  breadcrumbDocs: 'ドキュメント',
  trustTicks: ['macOS · Windows · Linux', 'ローカルファースト、アカウント不要', 'MIT ライセンス、永久に'],
  schemaDescription:
    'macOS・Windows・Linux 向けの無料オープンソース Markdown エディター。ライブプレビュー付き。Markdown ソースが唯一のデータソースです——保存はプレーンな .md に書き戻され、往復でロスはゼロ。KaTeX 数式、Mermaid 図表、ネイティブなテーブル編集、コールアウト、脚注、ハイライトまで、すべてライブで描画されます。',
  schemaFeatures: [
    'ライブプレビュー編集（Typora スタイル、その場で描画）',
    'KaTeX 数式と Mermaid 図表をライブ描画',
    'ネイティブなテーブル編集（ネストしたセルエディター）',
    'フォーカスモード、タイプライターモード、ライト／ダークテーマ',
    'PDF と HTML への書き出し',
    'プレーンな Markdown ファイル、往復ロスなし',
    '9 つの UI 言語'
  ],
  llmsTxt:
    '# VeloxMark\n\n' +
    '> VeloxMark は macOS・Windows・Linux 向けの無料オープンソース（MIT）Markdown エディターで、ライブプレビューを備えています。Markdown ソースが唯一のデータソースです：エディターは見出し、数式、図表、テーブルをその場で描画し、ディスク上のファイルは常にプレーンな Markdown のまま、保存の往復でロスがありません。\n\n' +
    'VeloxMark は Electron と CodeMirror 6 を基盤に構築されています。ライブプレビュー・エンジンは、カーソルが行から離れると構文マークを隠し（Typora スタイル）、描画されたブロック——コード、KaTeX 数式、Mermaid 図表、テーブル、画像——はどれもクリックすると Markdown ソースを編集できます。ネイティブなテーブル編集、フォーカスモードとタイプライターモード、ライト／ダークテーマ、PDF/HTML 書き出し、9 つの UI 言語、そして Windows（NSIS）と Linux（AppImage）での自動更新を備えています。\n\n' +
    '主要な事実：MIT ライセンス · アカウント不要、テレメトリなし · ローカルファースト · macOS（dmg/zip）、Windows（NSIS インストーラー、ポータブル zip）、Linux（AppImage、deb、rpm、tar.gz、snap）向けインストーラー · GitHub Releases に SHA256SUMS.txt チェックサム付き。\n\n' +
    '## ドキュメント\n\n' +
    '- [イントロダクション](https://veloxmark.knzn.net/ja/docs/)：VeloxMark とは何か、ライブプレビューの仕組み、往復ロスなしの保証\n' +
    '- [インストール](https://veloxmark.knzn.net/ja/docs/installation)：各プラットフォームのインストーラー、チェックサム検証、ソースからのビルド、アンインストール\n' +
    '- [基本操作](https://veloxmark.knzn.net/ja/docs/basics)：ウィンドウの構成、サイドバー（ファイル／アウトライン／検索）、タブ、エディターモード\n' +
    '- [編集の詳細](https://veloxmark.knzn.net/ja/docs/editing)：ライブプレビューの挙動、ブロックウィジェット、テーブル編集、入力支援\n' +
    '- [Markdown 構文](https://veloxmark.knzn.net/ja/docs/markdown-syntax)：特別に描画されるすべて——見出し、KaTeX 数式、Mermaid、コールアウト、脚注、ハイライト、フロントマター\n' +
    '- [画像](https://veloxmark.knzn.net/ja/docs/images)：パス解決、`=WxH` サイズ指定、`{align=}`／`{flip=}` 属性、添付\n' +
    '- [環境設定](https://veloxmark.knzn.net/ja/docs/preferences)：すべての設定と既定値——外観、エディター、ファイル、自動保存、画像\n' +
    '- [キーバインド](https://veloxmark.knzn.net/ja/docs/key-bindings)：各プラットフォームの完全なコマンド／ショートカット表\n' +
    '- [言語とローカライズ](https://veloxmark.knzn.net/ja/docs/language)：9 つの UI 言語と言語選択の仕組み\n' +
    '- [ドキュメントの書き出し](https://veloxmark.knzn.net/ja/docs/export)：PDF と HTML の書き出しオプション、選択範囲のみの書き出し\n' +
    '- [テーマ](https://veloxmark.knzn.net/ja/docs/themes)：ライト／ダークテーマ、切り替え、テーマがウィジェットに適用される仕組み\n' +
    '- [自動更新](https://veloxmark.knzn.net/ja/docs/updates)：インストール形式ごとの更新動作（NSIS/AppImage は完全自動、その他は通知のみ）\n' +
    '- [よくある質問](https://veloxmark.knzn.net/ja/docs/faq)：対応プラットフォーム、ライセンス、トラブルシューティング、データの保存場所\n\n' +
    '## ダウンロード\n\n' +
    '- [ダウンロード](https://veloxmark.knzn.net/ja/download)：プラットフォーム別のインストーラー、チェックサム検証、更新動作\n\n' +
    '## ソース\n\n' +
    '- [GitHub リポジトリ](https://github.com/biao-biao-ls/veloxmark)：ソースコード、課題トラッカー、リリース（MIT ライセンス）\n\n' +
    '## 任意\n\n' +
    '- [完全なドキュメント（プレーンテキスト）](https://veloxmark.knzn.net/ja/llms-full.txt)：オフラインの LLM 利用向けに全ドキュメントを連結したもの\n'
}
