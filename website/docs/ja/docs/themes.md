---
title: テーマ
description: VeloxMark のライトとダークのテーマ——ワンクリックで切り替え、セッションをまたいで記憶、コード・数式・図表ウィジェットへの適用方法。
keywords: [Markdown エディター ダークモード, ライトテーマ, ダークテーマ, エディター テーマ, テーマ切り替え]
---

# テーマ

VeloxMark は 2 つの第一級のテーマ——ライトとダーク——を、長い執筆セッション向けに
調整して提供しています。どちらもエディターのクローム、シンタックスカラー、描画済み
ブロックのウィジェット（数式、図表、コード、テーブル）をカバーします。

<div class="vm-grid-2" style="margin-top:24px">
  <div class="vm-card" style="padding:0;overflow:hidden">
    <div class="vm-window" style="border:none;border-radius:0">
      <div class="win-bar">
        <span class="dot r"></span><span class="dot y"></span><span class="dot g"></span>
        <span class="fname">light</span>
      </div>
      <img src="/img/hero-light.png" alt="VeloxMark ライトテーマ" />
    </div>
  </div>
  <div class="vm-card" style="padding:0;overflow:hidden">
    <div class="vm-window" style="border:none;border-radius:0">
      <div class="win-bar">
        <span class="dot r"></span><span class="dot y"></span><span class="dot g"></span>
        <span class="fname">dark</span>
      </div>
      <img src="/img/hero-dark.png" alt="VeloxMark ダークテーマ" />
    </div>
  </div>
</div>

## テーマの切り替え

- メニュー：**表示 → テーマを切り替え**（「テーマを切り替え」コマンドでも利用可能）。
- または環境設定（テーマモード）で `light` / `dark` / `system` を明示的に選ぶ。
- 選択はセッションをまたいで記憶されます。

カスタムのフレームレスタイトルバーとアプリ内メニュー（ファイル／編集／表示／挿入／ヘルプ）は、
アクティブなテーマに追従します。

## ダークテーマのコード例

<div class="vm-shot">

![ダークテーマのコードブロック](/img/code-dark.png)

</div>

## テーマの適用方法

エディターは [CodeMirror 6](https://codemirror.net) です。各テーマは CM6 テーマと、
アプリシェルをカバーする CSS 変数で構成されます。描画ウィジェット（KaTeX、Mermaid、
highlight.js）も同じパレットを使うため、コードブロックや図表が浮いて見えることはありません。
