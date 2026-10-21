# VeloxMark

Markdown で書く——それ以外はすべて飾り。

[English](../../README.md) · [简体中文](zh.md) · **日本語** · [한국어](ko.md) · [Español](es.md) · [Português](pt.md) · [Français](fr.md) · [Deutsch](de.md) · [Русский](ru.md)

VeloxMark はライブプレビューを備えた、無料・オープンソースの Markdown デスクトップビューア兼エディタです。[Typora](https://typora.io) に代表される摩擦のない執筆体験を目指しつつ、`.md` 純テキストの完全なポータビリティを保ちます——Electron と CodeMirror 6 で構築され、macOS・Windows・Linux に対応。

![VeloxMark ライトテーマ](../../website/docs/public/img/hero-light.png)

- Web サイトとドキュメント:https://veloxmark.knzn.net
- ダウンロード:https://github.com/biao-biao-ls/veloxmark/releases

## 機能

- **ライブプレビュー(Typora スタイル)**:Markdown のソーステキストが唯一のデータです。カーソルが行から離れると `#` や `**`、`` ` `` などの構文マークが隠れ、その行は最終的なスタイルで描画されます。カーソル行は常にソースのまま表示されます
- **ブロック描画**:コードブロック(シンタックスハイライト)、`$$` 数式(KaTeX)、```` ```mermaid ```` 図表——ブロックをクリックするとソースを編集できます
- **テーブル**:ネストしたセルエディタを備えたネイティブなテーブル編集、テーブルの挿入/変換ダイアログ、列のリサイズと揃え
- **アウトラインナビゲーション**:サイドバーの見出しツリー、クリックでジャンプ、現在位置をハイライト
- **マルチタブ編集**:複数ファイルを同時に開き、タブを閉じる/復元、未保存の変更は `•` で表示
- **フォーカスモード**:フォーカスモード、タイプライターモード、ソースモード
- **ライト/ダークテーマ**:**表示 → テーマを切り替え** メニューで切り替え、セッションをまたいで記憶。フレームレスのタイトルバーとアプリ内メニュー(ファイル/編集/表示/ヘルプ)もテーマに追従
- **ファイル操作**:開く / 保存 / 名前を付けて保存、ウィンドウコントロール(最小化/最大化/閉じる)
- **エクスポート**:PDF と HTML、選択範囲のみの HTML エクスポートに対応
- **入力アシスト**:裸の URL をペーストすると自動でリンク化、ペーストした HTML を Markdown に変換
- **タスクリスト**:`- [ ]` はクリック可能なチェックボックスとして描画
- **画像**:絶対パス、相対パス(現在の `.md` ファイル基準)、リモート画像に対応
- **自動更新**:インストーラが GitHub Releases をチェックしてその場で更新(Windows NSIS と Linux AppImage)
- **多言語 UI**:日本語、English、简体中文、한국어、Español、Português、Français、Deutsch、Русский(ネイティブメニューとサンプルドキュメントを含む)

## インストール

[リリースページ](https://github.com/biao-biao-ls/veloxmark/releases/latest)からお使いのプラットフォームのビルドをダウンロードしてください:

- **Windows** — NSIS インストーラ(自動更新対応)またはポータブル zip
- **macOS** — dmg と zip(未署名ビルド)。初回起動時は右クリック → **開く**、または隔離属性を解除:`xattr -d com.apple.quarantine /Applications/VeloxMark.app`
- **Linux** — AppImage(自動更新対応)、deb、rpm、tar.gz、snap

## 開発

```bash
npm install
npm run dev      # 開発モード(ホットリロード)
npm run build    # out/ にビルド
npm run typecheck
```

> 制限されたネットワークで Electron のバイナリがダウンロードできない場合:
> `ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ npm install`

## 技術スタック

- [Electron](https://www.electronjs.org) + [electron-vite](https://electron-vite.org) + React + TypeScript
- [CodeMirror 6](https://codemirror.net) — エディタの中核。StateField デコレータでライブプレビューを実現
- [KaTeX](https://katex.org) — 数式
- [mermaid](https://mermaid.js.org) — 図表
- [highlight.js](https://highlightjs.org) — コードハイライト

## アーキテクチャ

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

中核となる設計:Markdown のテキストが常に唯一のデータソースです(保存はプレーンな `.md` に書き出し、往復でのロスはゼロ)。デコレータエンジンはドキュメント/選択が変わるたびに Decorations を再構築します。構文マークは replace デコレータで隠し、コード/数式/図表ブロックは widget に差し替えます。カーソルが範囲内に入るとその範囲のデコレーションをスキップし、ソースの姿に戻ります。

## ドキュメント

ユーザー向けドキュメントの全文は[Web サイト](https://veloxmark.knzn.net/ja/docs/)にあります。リリース手順書(プロセス、成果物、署名状況、トラブルシューティング)は [CLAUDE.md](../../CLAUDE.md) の "Release process" を参照してください。

## コントリビューション

- **コミットメッセージとコードコメントは英語で書いてください。**
- **翻訳はローカライズパックのみに置きます**——言語ごとに 1 つのパック(ファイルまたはディレクトリ):
  - `src/renderer/src/i18n/<lang>.ts` — UI 辞書と言語の自称
  - `electron/shared/menuStrings/<lang>.ts` — ネイティブメニューの文言
  - `src/renderer/src/content/<lang>.ts` — ウェルカム/ヘルプドキュメント
  - `src/renderer/src/editor/mermaidTemplates/<lang>.ts` — Mermaid テンプレートの本体
  - `docs/readme/<lang>.md` — この README の翻訳
  - `website/docs/<lang>/` と `website/docs/.vitepress/locales/<lang>.ts` — Web サイトのページと UI 文言

  リポジトリ内のそれ以外のファイルはすべて英語のみとします。

## ライセンス

[MIT](../../LICENSE)
