---
title: インストール
description: macOS・Windows・Linux に VeloxMark をインストール——インストーラー形式、SHA256 チェックサム検証、ソースからのビルド、更新とアンインストールの手順。
keywords: [VeloxMark インストール, Markdown エディター インストーラー, AppImage, NSIS, dmg, deb, rpm, snap, チェックサム検証]
---

# インストール

VeloxMark は無料のオープンソースです。macOS・Windows・Linux 向けのビルド済みバイナリは
[GitHub Releases](https://github.com/biao-biao-ls/veloxmark/releases) に公開されています。
各リリースには `SHA256SUMS.txt` が付属し、ダウンロードした内容を検証できます。

## Windows

| 成果物 | 説明 |
| --- | --- |
| `VeloxMark-Setup-<ver>-x64.exe` / `-arm64.exe` | NSIS インストーラー、推奨。その場で自動更新されます。 |
| `VeloxMark-Setup-<ver>.exe` | ユニバーサルインストーラー（自動更新マニフェストはこれを指します）。 |
| `VeloxMark-Win-<arch>-<ver>.zip` | ポータブル版——展開して実行するだけで、インストーラーなし、自動更新なし。 |

インストーラーを実行し、スタートメニューから VeloxMark を起動してください。アカウントは不要です。

## macOS

| 成果物 | 説明 |
| --- | --- |
| `VeloxMark-Mac-arm64-<ver>.dmg` / `VeloxMark-Mac-x64-<ver>.dmg` | Apple Silicon と Intel 向けのディスクイメージ。 |
| `VeloxMark-Mac-arm64-<ver>.zip` / `VeloxMark-Mac-x64-<ver>.zip` | Zip アーカイブ（自動更新用パッケージでもあります）。 |

アプリを **Applications** にドラッグして起動してください。

> [!WARNING]
> リリースビルドは現在**未署名**です。初回起動時に macOS の Gatekeeper が開くことを拒否します。
> 代わりに検疫属性を外してください：
>
> ```sh
> xattr -d com.apple.quarantine /Applications/VeloxMark.app
> ```

ビルドが未署名のため、macOS ではアプリ内自動更新でインストールできません——更新ツールは
代わりにリリースページを開き、新しいバージョンを手動でダウンロードできるようにします。

## Linux

| 形式 | 説明 |
| --- | --- |
| `VeloxMark-Linux-x86_64-<ver>.AppImage` / `…-aarch64-…` | 推奨。`chmod +x` して実行。完全な自動更新。 |
| `VeloxMark-Linux-amd64-<ver>.deb` / `…-arm64-…` | Debian / Ubuntu：`sudo apt install ./VeloxMark-Linux-amd64-<ver>.deb` |
| `VeloxMark-Linux-x86_64-<ver>.rpm` / `…-aarch64-…` | Fedora / RHEL / openSUSE。 |
| `VeloxMark-Linux-<arch>-<ver>.tar.gz` | ポータブル tar ボール。 |
| `VeloxMark-Linux-x64-<ver>.snap` | Snap パッケージ（x64 のみ）。 |

deb、rpm、snap、tar.gz インストールの更新は通知のみです——アプリは新しいバージョンの存在を
伝え、リリースページへ案内します。

## ダウンロードの検証

各リリースには `SHA256SUMS.txt` が含まれます。ファイルを照合してください：

```sh
sha256sum -c SHA256SUMS.txt --ignore-missing
```

macOS：`shasum -a 256 -c SHA256SUMS.txt --ignore-missing`（または `shasum -a 256 <file>` で
手動で比較）。Windows（PowerShell）：

```powershell
Get-FileHash .\VeloxMark-Setup-0.1.0-x64.exe -Algorithm SHA256
```

## 更新

VeloxMark は GitHub Releases で新しいバージョンを確認します。動作はインストール形式によって
異なります：

- **Windows NSIS** と **Linux AppImage** —— 完全なチェック、ダウンロード、インストール。
  ダウンロード後、アプリは終了してインストールする前に確認を求めます。
- **macOS** —— チェックはリリースを見つけますが、未署名ビルドでは Squirrel.Mac の更新を
  完了できません。アプリは代わりにリリースページを開きます。
- **その他**（ポータブル zip、deb / rpm / snap / tar.gz、開発モード）—— 通知のみの手動チェック。

いつでも [リリースページ](https://github.com/biao-biao-ls/veloxmark/releases) から最新版を
入手できます。

## ソースからビルド

```sh
git clone https://github.com/biao-biao-ls/veloxmark.git
cd veloxmark
npm install
npm run dev      # 開発モード
npm run build    # out/ へのプロダクションビルド
```

制限されたネットワークで Electron バイナリのダウンロードに失敗する場合：

```sh
ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ npm install
```

`npm run build:win`、`npm run build:mac`、`npm run build:linux` で配布物をパッケージできます。

## アンインストール

- **Windows** —— 設定 → アプリ → VeloxMark → アンインストール。
- **macOS** —— VeloxMark.app を Applications からゴミ箱へドラッグ。
- **Linux** —— パッケージを削除（`apt remove`、`dnf remove`、`snap remove`）するか、
  AppImage／展開した tar ボールを削除。

ユーザーデータ（下書き、環境設定、セッション状態）は標準のユーザーごとのアプリケーション
データディレクトリにあります。クリーンな状態に戻したいときだけ削除してください。
