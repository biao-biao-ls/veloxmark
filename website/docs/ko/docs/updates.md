---
title: 자동 업데이트
description: 설치 형식별로 VeloxMark가 스스로를 업데이트하는 방식 — Windows NSIS와 Linux AppImage는 완전 자동, 그 외에는 알림만, 수동 대체 지원.
keywords: [VeloxMark 자동 업데이트, electron-updater, AppImage 업데이트, NSIS 업데이트, 수동 업데이트]
---

# 자동 업데이트

VeloxMark는 [GitHub Releases](https://github.com/biao-biao-ls/veloxmark/releases)에서
새 버전을 확인하고, 설치 방식에 따라 서로 다른 경로로 업데이트를 진행합니다.

## 설치 형식별 동작

| 설치 형식 | 업데이트 동작 |
| --- | --- |
| Windows NSIS 설치 프로그램 | 전체 확인 → 다운로드 → 알림 → 재시작 시 설치 |
| Linux AppImage | 전체 확인 → 다운로드 → 알림 → 재시작 시 설치 |
| macOS (dmg / zip) | 확인만 — 서명되지 않은 빌드는 Squirrel.Mac 업데이트를 완료할 수 없어, 앱이 릴리스 페이지를 엽니다 |
| 포터블 zip / deb / rpm / snap / tar.gz | 알림만 — 새 버전을 알리고 링크를 제공합니다 |
| 개발 모드 (`npm run dev`) | 알림만 |

다운로드가 끝나면 **앱은 종료하여 설치하기 전에 동의를 구합니다** — 뒤에서 몰래
진행되는 일은 없습니다.

## 수동으로 확인하기

앱 메뉴에서 **도움말 → 업데이트 확인**을 사용하세요. 알림 전용 설치 형식에서는
릴리스 페이지를 열거나 그곳으로 안내합니다.

## 업데이트 목록

릴리스 자산에는 electron-updater 목록(`latest.yml`, `latest-mac.yml`,
`latest-linux.yml`, `latest-linux-arm64.yml`)과 `SHA256SUMS.txt`가 포함됩니다.
Windows 목록의 `path`는 범용 설치 프로그램 `VeloxMark-Setup-<ver>.exe`를 가리킵니다.

## 업데이트가 실패하면

1. 네트워크 / 프록시를 확인하세요 — 업데이트는 GitHub Releases에서 옵니다.
2. 다운로드한 파일을 `SHA256SUMS.txt`와 대조해 수동으로 검증하세요
   ([설치](./installation#다운로드-검증)를 보세요).
3. [릴리스 페이지](https://github.com/biao-biao-ls/veloxmark/releases)에서 새로
   설치하는 것으로 대체하세요 — 설정과 초안은 유지됩니다.
