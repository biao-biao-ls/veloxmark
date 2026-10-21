---
title: Установка
description: Установка VeloxMark на macOS, Windows или Linux — форматы установщиков, проверка контрольных сумм SHA256, сборка из исходников, обновление и удаление.
keywords: [установка VeloxMark, установщик Markdown-редактора, AppImage, NSIS, dmg, deb, rpm, snap, проверка контрольных сумм]
---

# Установка

VeloxMark бесплатен и имеет открытый исходный код. Готовые бинарные файлы для macOS,
Windows и Linux публикуются в
[GitHub Releases](https://github.com/biao-biao-ls/veloxmark/releases).
Каждый релиз поставляется с файлом `SHA256SUMS.txt`, чтобы вы могли проверить
скачанное.

## Windows

| Артефакт | Примечания |
| --- | --- |
| `VeloxMark-Setup-<ver>-x64.exe` / `-arm64.exe` | Установщик NSIS, рекомендуется. Обновляется на месте. |
| `VeloxMark-Setup-<ver>.exe` | Универсальный установщик (манифест автообновления указывает на него). |
| `VeloxMark-Win-<arch>-<ver>.zip` | Портативная сборка — распакуйте и запускайте, без установщика и без автообновления. |

Запустите установщик и откройте VeloxMark из меню «Пуск». Аккаунт не требуется.

## macOS

| Артефакт | Примечания |
| --- | --- |
| `VeloxMark-Mac-arm64-<ver>.dmg` / `VeloxMark-Mac-x64-<ver>.dmg` | Дисковые образы для Apple Silicon и Intel. |
| `VeloxMark-Mac-arm64-<ver>.zip` / `VeloxMark-Mac-x64-<ver>.zip` | Zip-архивы (они же носитель для автообновления). |

Перетащите приложение в **Программы** и запустите его.

> [!WARNING]
> Релизные сборки в настоящее время **неподписаны**. macOS Gatekeeper откажется открыть
> приложение при первом запуске. Вместо этого снимите атрибут карантина:
>
> ```sh
> xattr -d com.apple.quarantine /Applications/VeloxMark.app
> ```

Поскольку сборки неподписаны, встроенное автообновление не может установить их в macOS —
обновитель деградирует до открытия страницы релизов, где вы можете скачать новую версию
вручную.

## Linux

| Формат | Примечания |
| --- | --- |
| `VeloxMark-Linux-x86_64-<ver>.AppImage` / `…-aarch64-…` | Рекомендуется. `chmod +x` и запуск. Полное автообновление. |
| `VeloxMark-Linux-amd64-<ver>.deb` / `…-arm64-…` | Debian / Ubuntu: `sudo apt install ./VeloxMark-Linux-amd64-<ver>.deb` |
| `VeloxMark-Linux-x86_64-<ver>.rpm` / `…-aarch64-…` | Fedora / RHEL / openSUSE. |
| `VeloxMark-Linux-<arch>-<ver>.tar.gz` | Портативный tar-архив. |
| `VeloxMark-Linux-x64-<ver>.snap` | Snap-пакет (только x64). |

Установки deb, rpm, snap и tar.gz для обновлений работают только на уведомление —
приложение сообщает о новой версии и указывает на страницу релизов.

## Проверка загрузки

Каждый релиз включает `SHA256SUMS.txt`. Сверьте свой файл с ним:

```sh
sha256sum -c SHA256SUMS.txt --ignore-missing
```

В macOS: `shasum -a 256 -c SHA256SUMS.txt --ignore-missing` (или `shasum -a 256 <file>`
и сравните вручную). В Windows (PowerShell):

```powershell
Get-FileHash .\VeloxMark-Setup-0.1.0-x64.exe -Algorithm SHA256
```

## Обновление

VeloxMark проверяет GitHub Releases на предмет новых версий. Поведение зависит от формы
установки:

- **Windows NSIS** и **Linux AppImage** — полная проверка, загрузка и установка. После
  загрузки приложение спрашивает разрешение, прежде чем выйти для установки.
- **macOS** — проверка находит релиз, но неподписанная сборка не может завершить
  обновления Squirrel.Mac; приложение вместо этого открывает страницу релизов.
- **Всё остальное** (портативный zip, deb / rpm / snap / tar.gz, режим разработки) —
  ручная проверка только с уведомлением.

Вы также всегда можете забрать последнюю версию со
[страницы релизов](https://github.com/biao-biao-ls/veloxmark/releases).

## Сборка из исходников

```sh
git clone https://github.com/biao-biao-ls/veloxmark.git
cd veloxmark
npm install
npm run dev      # режим разработки
npm run build    # производственная сборка в out/
```

Если бинарные файлы Electron не скачиваются в ограниченных сетях:

```sh
ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ npm install
```

Соберите распространяемый пакет командой `npm run build:win`, `npm run build:mac` или
`npm run build:linux`.

## Удаление

- **Windows** — Параметры → Приложения → VeloxMark → Удалить.
- **macOS** — перетащите VeloxMark.app из папки «Программы» в Корзину.
- **Linux** — удалите пакет (`apt remove`, `dnf remove`, `snap remove`) или удалите
  AppImage / распакованный tar-архив.

Пользовательские данные (черновики, настройки, состояние сессии) хранятся в стандартном
каталоге данных приложений пользователя; удаляйте его, только если хотите начать с
чистого листа.
