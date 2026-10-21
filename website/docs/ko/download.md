---
title: 다운로드
description: macOS, Windows, Linux용 VeloxMark를 다운로드하세요 — 무료 오픈 소스 Markdown 편집기. 설치 프로그램, SHA256 체크섬, 자동 업데이트 동작 및 이전 버전.
keywords: [VeloxMark 다운로드, Markdown 편집기 다운로드, macOS dmg, Windows 설치 프로그램, Linux AppImage, 오픈 소스 Markdown 편집기]
---

# 다운로드

VeloxMark는 [MIT 라이선스](https://github.com/biao-biao-ls/veloxmark/blob/main/LICENSE)에 따라
무료로 공개됩니다. 모든 설치 프로그램은
[GitHub Releases](https://github.com/biao-biao-ls/veloxmark/releases)에 게시되며,
`SHA256SUMS.txt` 체크섬 목록이 함께 제공됩니다.

<div class="platform-grid">
  <div class="platform-card">
    <h3>macOS</h3>
    <ul class="formats">
      <li><code>VeloxMark-Mac-&lt;arch&gt;-&lt;ver&gt;.dmg</code> — Apple Silicon &amp; Intel</li>
      <li><code>VeloxMark-Mac-&lt;arch&gt;-&lt;ver&gt;.zip</code> — 자동 업데이트용 배포 파일</li>
    </ul>
    <p class="notes">서명되지 않은 빌드입니다 — 설치 후 macOS가 차단하면 앱에 <code>xattr -d com.apple.quarantine</code>을 실행하세요.</p>
  </div>
  <div class="platform-card">
    <h3>Windows</h3>
    <ul class="formats">
      <li><code>VeloxMark-Setup-&lt;ver&gt;-&lt;arch&gt;.exe</code> — NSIS, 자동 업데이트</li>
      <li><code>VeloxMark-Setup-&lt;ver&gt;.exe</code> — 범용 설치 프로그램</li>
      <li><code>VeloxMark-Win-&lt;arch&gt;-&lt;ver&gt;.zip</code> — 포터블</li>
    </ul>
    <p class="notes">x64 &amp; ARM64. NSIS 설치는 제자리에서 스스로 업데이트됩니다.</p>
  </div>
  <div class="platform-card">
    <h3>Linux</h3>
    <ul class="formats">
      <li><code>VeloxMark-Linux-x86_64-&lt;ver&gt;.AppImage</code> — 자동 업데이트</li>
      <li><code>.deb</code> / <code>.rpm</code></li>
      <li><code>.tar.gz</code></li>
      <li><code>.snap</code> — x64 전용</li>
    </ul>
    <p class="notes">x86_64 &amp; aarch64(snap은 x64 전용).</p>
  </div>
</div>

## 다운로드 검증

각 릴리스에는 `SHA256SUMS.txt`가 포함됩니다. 설치하기 전에 다운로드한 파일을 확인하세요:

```bash
sha256sum -c SHA256SUMS.txt
```

## 자동 업데이트 동작

- **Windows NSIS 설치** 및 **Linux AppImage** — 자동 확인, 다운로드 및 설치를 모두 수행합니다.
  업데이트를 적용하기 전 종료할 때 앱이 확인을 요청합니다.
- **macOS 빌드**는 서명되지 않아 제자리 업데이터가 적용할 수 없습니다 — 업데이트 확인 시
  대신 릴리스 페이지를 엽니다.
- **포터블 zip, deb / rpm / snap / tar.gz 설치** — 업데이트 확인 시 알려주고 새 릴리스로
  안내할 뿐, 뒤에서 아무것도 바꾸지 않습니다.

## 이전 버전

게시된 모든 버전은 릴리스 노트와 체크섬과 함께
[릴리스 페이지](https://github.com/biao-biao-ls/veloxmark/releases)에 남아 있습니다.
