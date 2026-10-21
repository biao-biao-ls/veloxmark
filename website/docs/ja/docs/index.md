---
title: イントロダクション
description: VeloxMark ユーザードキュメントへようこそ——Electron と CodeMirror 6 の上に構築された、ライブプレビュー付きの無料オープンソース Markdown エディター。
keywords: [VeloxMark ドキュメント, Markdown エディター ガイド, ライブプレビュー エディター, イントロダクション]
---

# イントロダクション

VeloxMark のユーザードキュメントへようこそ——macOS・Windows・Linux 向けの、ライブプレビュー付きの
無料オープンソース Markdown エディターです。Typora にインスパイアされ、Electron +
CodeMirror 6 の上に構築されています。

<div class="vm-shot">

![VeloxMark のインターフェイス](/img/hero-light.png)

</div>

## VeloxMark の何が違うのか

**Markdown ソースが唯一のデータソースです。** リッチなもの——描画された見出し、数式、
図表、テーブル——はすべて、プレーンテキストファイルの上に載る一時的な装飾にすぎません。
保存はクリーンな `.md` を書き出し、往復でロスはゼロ。独自のドキュメント形式も、
隠れた状態もありません。

ライブプレビュー・エンジンは、ドキュメントと選択範囲が変わるたびに装飾を再構築します：
構文マークは置換装飾で隠され、コード／数式／Mermaid／画像ブロックは描画済みウィジェットに
差し替えられます。カーソルが範囲内に入るとその範囲の装飾はスキップされ、ソース形式が
戻ってきます。カーソル行は常にソース形式のままなので、自分が何を編集しているか常に
正確にわかります。

## 次に読む場所

<div class="vm-grid-3" style="margin-top:24px">
  <div class="vm-card">
    <h3><a href="./installation">インストール</a></h3>
    <p>macOS・Windows・Linux 向けのインストーラー、チェックサム検証、プラットフォームごとの注意点。</p>
  </div>
  <div class="vm-card">
    <h3><a href="./basics">基本操作</a></h3>
    <p>ウィンドウ、サイドバー、タブ、3 つのエディターモード——初回起動時に見えるものすべて。</p>
  </div>
  <div class="vm-card">
    <h3><a href="./editing">編集の詳細</a></h3>
    <p>入力中にライブプレビューがどう振る舞うか：ブロックウィジェット、テーブル、フォーカスモード、入力支援。</p>
  </div>
  <div class="vm-card">
    <h3><a href="./markdown-syntax">Markdown 構文</a></h3>
    <p>VeloxMark が特別に描画するすべての構文構造と、そのソース例。</p>
  </div>
  <div class="vm-card">
    <h3><a href="./key-bindings">キーバインド</a></h3>
    <p>各プラットフォームのアクセラレータ付き完全なコマンド一覧。</p>
  </div>
  <div class="vm-card">
    <h3><a href="./faq">よくある質問</a></h3>
    <p>対応プラットフォーム、トラブルシューティング、バグの報告方法。</p>
  </div>
</div>

## ライセンス

VeloxMark は [MIT ライセンス](https://github.com/biao-biao-ls/veloxmark/blob/main/LICENSE)の下で公開されています。
ソースは [github.com/biao-biao-ls/veloxmark](https://github.com/biao-biao-ls/veloxmark) にあります。
