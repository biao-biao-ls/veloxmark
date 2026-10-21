---
title: よくある質問
description: VeloxMark のよくある質問——対応プラットフォーム、ライセンス、ライブプレビューの仕組み、ファイルの往復、データの保存場所、macOS Gatekeeper、更新の動作。
keywords: [VeloxMark FAQ, Markdown エディター よくある質問, ライブプレビュー 質問, VeloxMark トラブルシューティング]
head:
  - - script
    - type: application/ld+json
    - '{"@context":"https://schema.org","@type":"FAQPage","mainEntity":[{"@type":"Question","name":"対応しているプラットフォームは？","acceptedAnswer":{"@type":"Answer","text":"macOS（Apple Silicon と Intel）、Windows 10/11（x64 と ARM64）、Linux（x64 と arm64——AppImage、deb、rpm、tar.gz；snap は x64 のみ）。"}},{"@type":"Question","name":"VeloxMark は無料ですか？","acceptedAnswer":{"@type":"Answer","text":"はい。VeloxMark は MIT ライセンスの下でオープンソースとして公開されています。アカウント不要、サブスクリプションなし、テレメトリなし。"}},{"@type":"Question","name":"ライブプレビューとは何ですか？分割ビューとは何が違いますか？","acceptedAnswer":{"@type":"Answer","text":"プレビューペインはありません。エディターは Markdown をその場で描画します：カーソルが行から離れると構文マークが隠れ、その行は最終的な形を表示します。カーソル行は常にソース形式のままで、描画されたブロックをクリックすると元の Markdown が編集用に戻ります。Markdown ソースが唯一のデータソースです——保存はプレーンな .md に書き戻され、往復でロスはゼロ。"}},{"@type":"Question","name":"保存時に VeloxMark は Markdown ファイルを変更しますか？","acceptedAnswer":{"@type":"Answer","text":"いいえ。保存はソーステキストをそのまま書き戻すだけです。すべての描画は装飾です。"}},{"@type":"Question","name":"対応している Markdown 構文は？","acceptedAnswer":{"@type":"Answer","text":"CommonMark + GFM（テーブル、タスクリスト、取り消し線）、そして KaTeX 数式、Mermaid 図表、コールアウト、脚注、ハイライトテキスト。"}},{"@type":"Question","name":"VeloxMark をノート管理に使えますか？","acceptedAnswer":{"@type":"Answer","text":"VeloxMark は焦点を絞った Markdown リーダー／エディターです——フォルダーやファイルを開き、アウトラインや検索を使えますが、知識管理レイヤーはありません。ファイルはディスク上のプレーンな .md のままで、他のツールがそのまま扱えます。"}},{"@type":"Question","name":"バグの報告方法は？","acceptedAnswer":{"@type":"Answer","text":"GitHub で issue を立て、アプリのバージョン（ヘルプメニュー）、OS、再現手順、問題を起こす Markdown を添えてください。"}},{"@type":"Question","name":"下書きと設定はどこに保存されますか？","acceptedAnswer":{"@type":"Answer","text":"環境設定、下書き、セッション状態は標準のユーザーごとのアプリケーションデータディレクトリ（Electron userData）にあります：Windows %APPDATA%\\VeloxMark、macOS ~/Library/Application Support/VeloxMark、Linux ~/.config/VeloxMark。ドキュメント自体が移動やコピーされることはありません。"}},{"@type":"Question","name":"macOS が開発元不明のアプリと表示するのはなぜですか？","acceptedAnswer":{"@type":"Answer","text":"リリースビルドは現在未署名です。インストール後に xattr -d com.apple.quarantine /Applications/VeloxMark.app を一度実行してください。"}},{"@type":"Question","name":"プラットフォームで自動更新されません——正常ですか？","acceptedAnswer":{"@type":"Answer","text":"正常です。完全な自動更新は Windows NSIS インストールと Linux AppImage で有効になっています。他のインストール形式は通知のみで、macOS はビルドが未署名のため現在リリースページを開く形にフォールバックしています。"}}]}'
---

# よくある質問（FAQ）

### 対応しているプラットフォームは？

macOS（Apple Silicon と Intel）、Windows 10/11（x64 と ARM64）、Linux
（x64 と arm64——AppImage、deb、rpm、tar.gz；snap は x64 のみ）。
[インストール](./installation) を参照。

### VeloxMark は無料ですか？

はい。VeloxMark は
[MIT ライセンス](https://github.com/biao-biao-ls/veloxmark/blob/main/LICENSE)の下で
オープンソースとして公開されています。アカウント不要、サブスクリプションなし、テレメトリなし。

### ライブプレビューとは何ですか？分割ビューとは何が違いますか？

プレビューペインはありません。エディターは Markdown を**その場で**描画します：カーソルが
行から離れると、`#`、`**`、`` ` `` のような構文マークが隠れ、その行は最終的な形を
表示します。カーソル行は常にソース形式のままで、描画されたブロック（コード、数式、
図表、テーブル、画像）をクリックすると元の Markdown が編集用に戻ります。Markdown ソースが
唯一のデータソースです——保存はプレーンな `.md` に書き戻され、往復でロスはゼロ。

### 保存時に VeloxMark は Markdown ファイルを変更しますか？

いいえ。保存はソーステキストをそのまま書き戻すだけです。すべての描画は装飾です。

### 対応している Markdown 構文は？

CommonMark + GFM（テーブル、タスクリスト、取り消し線）、そして KaTeX 数式、Mermaid 図表、
コールアウト、脚注、`==ハイライト==`。完全なリファレンス：
[Markdown 構文](./markdown-syntax)。

### VeloxMark をノート管理に使えますか？

VeloxMark は焦点を絞った Markdown リーダー／エディターです——フォルダーやファイルを開き、
アウトラインや検索を使えますが、知識管理レイヤー（タグ、バックリンク、データベース）は
ありません。ファイルはディスク上のプレーンな `.md` のままで、他のツールがそのまま扱えます。

### バグの報告方法は？

[GitHub](https://github.com/biao-biao-ls/veloxmark/issues) で issue を立て、アプリの
バージョン（ヘルプメニュー）、OS、再現手順、問題を起こす Markdown を添えてください。

### 下書きと設定はどこに保存されますか？

環境設定、下書き、セッション状態は標準のユーザーごとのアプリケーションデータディレクトリ
（Electron `userData`）にあります：Windows `%APPDATA%\VeloxMark`、macOS
`~/Library/Application Support/VeloxMark`、Linux `~/.config/VeloxMark`。
ドキュメント自体が移動やコピーされることはありません——ファイルがある場所をそのまま編集します。

### macOS が開発元不明のアプリと表示するのはなぜですか？

リリースビルドは現在未署名です。インストール後に
`xattr -d com.apple.quarantine /Applications/VeloxMark.app` を一度実行してください——
[インストール](./installation#macos) を参照。

### プラットフォームで自動更新されません——正常ですか？

正常です。完全な自動更新は Windows NSIS インストールと Linux AppImage で有効になっています。
他のインストール形式は通知のみで、macOS はビルドが未署名のため現在リリースページを開く形に
フォールバックしています。詳細：[自動更新](./updates)。
