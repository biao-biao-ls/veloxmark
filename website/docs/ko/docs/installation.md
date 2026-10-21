---
title: 설치
description: macOS, Windows 또는 Linux에 VeloxMark를 설치하세요 — 설치 프로그램 형식, SHA256 체크섬 검증, 소스에서 빌드, 업데이트 및 제거 절차.
keywords: [VeloxMark 설치, Markdown 편집기 설치 프로그램, AppImage, NSIS, dmg, deb, rpm, snap, 체크섬 검증]
---

# 설치

VeloxMark는 무료 오픈 소스입니다. macOS, Windows, Linux용 사전 빌드된 바이너리는
[GitHub Releases](https://github.com/biao-biao-ls/veloxmark/releases)에 게시됩니다.
모든 릴리스에는 다운로드한 내용을 검증할 수 있도록 `SHA256SUMS.txt` 파일이 포함됩니다.

## Windows

| 배포 파일 | 설명 |
| --- | --- |
| `VeloxMark-Setup-<ver>-x64.exe` / `-arm64.exe` | NSIS 설치 프로그램, 권장. 제자리에서 자동 업데이트됩니다. |
| `VeloxMark-Setup-<ver>.exe` | 범용 설치 프로그램 (자동 업데이트 목록이 이 파일을 가리킵니다). |
| `VeloxMark-Win-<arch>-<ver>.zip` | 포터블 빌드 — 압축을 풀고 실행, 설치 과정 없음, 자동 업데이트 없음. |

설치 프로그램을 실행하고 시작 메뉴에서 VeloxMark를 실행하세요. 계정은 필요 없습니다.

## macOS

| 배포 파일 | 설명 |
| --- | --- |
| `VeloxMark-Mac-arm64-<ver>.dmg` / `VeloxMark-Mac-x64-<ver>.dmg` | Apple Silicon 및 Intel용 디스크 이미지. |
| `VeloxMark-Mac-arm64-<ver>.zip` / `VeloxMark-Mac-x64-<ver>.zip` | Zip 압축 파일 (자동 업데이트용 배포 파일이기도 합니다). |

앱을 **Applications**로 드래그한 뒤 실행하세요.

> [!WARNING]
> 릴리스 빌드는 현재 **서명되지 않았습니다**. macOS Gatekeeper가 첫 실행 시 앱 열기를
> 거부합니다. 대신 검역 속성을 제거하세요:
>
> ```sh
> xattr -d com.apple.quarantine /Applications/VeloxMark.app
> ```

빌드가 서명되지 않았기 때문에 macOS에서는 앱 내 자동 업데이트로 설치할 수 없습니다 —
업데이터는 대신 릴리스 페이지를 열어 새 버전을 수동으로 내려받을 수 있게 합니다.

## Linux

| 형식 | 설명 |
| --- | --- |
| `VeloxMark-Linux-x86_64-<ver>.AppImage` / `…-aarch64-…` | 권장. `chmod +x` 후 실행. 완전한 자동 업데이트. |
| `VeloxMark-Linux-amd64-<ver>.deb` / `…-arm64-…` | Debian / Ubuntu: `sudo apt install ./VeloxMark-Linux-amd64-<ver>.deb` |
| `VeloxMark-Linux-x86_64-<ver>.rpm` / `…-aarch64-…` | Fedora / RHEL / openSUSE. |
| `VeloxMark-Linux-<arch>-<ver>.tar.gz` | 포터블 tarball. |
| `VeloxMark-Linux-x64-<ver>.snap` | Snap 패키지 (x64 전용). |

Deb, rpm, snap, tar.gz 설치의 업데이트는 알림 전용입니다 — 앱이 새 버전의 존재를 알리고
릴리스 페이지로 안내합니다.

## 다운로드 검증

각 릴리스에는 `SHA256SUMS.txt`가 포함됩니다. 파일을 대조해 확인하세요:

```sh
sha256sum -c SHA256SUMS.txt --ignore-missing
```

macOS에서는: `shasum -a 256 -c SHA256SUMS.txt --ignore-missing` (또는 `shasum -a 256 <file>`로
직접 비교). Windows(PowerShell)에서는:

```powershell
Get-FileHash .\VeloxMark-Setup-0.1.0-x64.exe -Algorithm SHA256
```

## 업데이트

VeloxMark는 GitHub Releases에서 새 버전을 확인합니다. 동작은 설치 형식에 따라 다릅니다:

- **Windows NSIS** 및 **Linux AppImage** — 확인, 다운로드, 설치를 모두 수행합니다.
  다운로드 후 종료하여 설치할 때 앱이 확인을 요청합니다.
- **macOS** — 확인은 릴리스를 찾지만, 서명되지 않은 빌드는 Squirrel.Mac 업데이트를
  완료할 수 없습니다. 앱은 대신 릴리스 페이지를 엽니다.
- **기타** (포터블 zip, deb / rpm / snap / tar.gz, 개발 모드) — 알림 전용 수동 확인.

언제든 [릴리스 페이지](https://github.com/biao-biao-ls/veloxmark/releases)에서
최신 버전을 받을 수 있습니다.

## 소스에서 빌드

```sh
git clone https://github.com/biao-biao-ls/veloxmark.git
cd veloxmark
npm install
npm run dev      # development mode
npm run build    # production build to out/
```

제한된 네트워크에서 Electron 바이너리 다운로드가 실패하면:

```sh
ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ npm install
```

`npm run build:win`, `npm run build:mac` 또는 `npm run build:linux`로 배포 가능한 패키지를 만듭니다.

## 제거

- **Windows** — 설정 → 앱 → VeloxMark → 제거.
- **macOS** — Applications에서 VeloxMark.app을 휴지통으로 드래그합니다.
- **Linux** — 패키지를 제거하거나(`apt remove`, `dnf remove`, `snap remove`) AppImage /
  압축을 푼 tarball을 삭제합니다.

사용자 데이터(초안, 환경 설정, 세션 상태)는 표준 사용자별 애플리케이션 데이터 디렉터리에
있습니다. 처음부터 다시 시작하려는 경우에만 삭제하세요.
