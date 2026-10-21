---
title: 自動更新
description: インストール形式ごとに VeloxMark がどう自分自身を更新するか——Windows NSIS と Linux AppImage では完全自動、それ以外は通知のみ、手動のフォールバック。
keywords: [VeloxMark 自動更新, electron-updater, AppImage 更新, NSIS 更新, 手動で更新]
---

# 自動更新

VeloxMark は [GitHub Releases](https://github.com/biao-biao-ls/veloxmark/releases) で
新しいバージョンを確認し、インストール方法によって更新の経路を切り替えます。

## インストール形式ごとの動作

| インストール形式 | 更新の動作 |
| --- | --- |
| Windows NSIS インストーラー | 完全なチェック → ダウンロード → 確認 → 再起動時にインストール |
| Linux AppImage | 完全なチェック → ダウンロード → 確認 → 再起動時にインストール |
| macOS（dmg / zip） | チェックのみ——未署名ビルドは Squirrel.Mac の更新を完了できないため、アプリはリリースページを開く |
| ポータブル zip / deb / rpm / snap / tar.gz | 通知のみ——新しいバージョンを告知しリンクする |
| 開発モード（`npm run dev`） | 通知のみ |

ダウンロードが完了すると、**アプリは終了してインストールする前に確認を求めます**——
背後で何も起こることはありません。

## 手動で確認する

アプリメニューの **ヘルプ → 更新を確認** を使ってください。通知のみのインストール形式では、
リリースページが開くか、そこへ案内されます。

## 更新マニフェスト

リリースアセットには electron-updater のマニフェスト（`latest.yml`、`latest-mac.yml`、
`latest-linux.yml`、`latest-linux-arm64.yml`）と `SHA256SUMS.txt` が含まれます。
Windows のマニフェストの `path` はユニバーサルの `VeloxMark-Setup-<ver>.exe` を指します。

## 更新に失敗した場合

1. ネットワーク／プロキシを確認してください——更新は GitHub Releases から取得されます。
2. ダウンロードを `SHA256SUMS.txt` と手動で照合してください
   （[インストール](./installation#ダウンロードの検証) を参照）。
3. [リリースページ](https://github.com/biao-biao-ls/veloxmark/releases) から新規インストールに
   フォールバックしてください——設定と下書きは保持されます。
