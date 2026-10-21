---
title: Темы
description: Светлая и тёмная темы VeloxMark — переключение в один клик, сохранение между сессиями и то, как темы применяются к виджетам кода, формул и диаграмм.
keywords: [тёмный режим Markdown-редактора, светлая тема, тёмная тема, темы редактора, переключение темы]
---

# Темы

VeloxMark поставляется с двумя первоклассными темами — светлой и тёмной —
настроенными для долгих сессий письма. Обе покрывают оформление редактора,
синтаксические цвета и виджеты отрендеренных блоков (формулы, диаграммы, код, таблицы).

<div class="vm-grid-2" style="margin-top:24px">
  <div class="vm-card" style="padding:0;overflow:hidden">
    <div class="vm-window" style="border:none;border-radius:0">
      <div class="win-bar">
        <span class="dot r"></span><span class="dot y"></span><span class="dot g"></span>
        <span class="fname">light</span>
      </div>
      <img src="/img/hero-light.png" alt="Светлая тема VeloxMark" />
    </div>
  </div>
  <div class="vm-card" style="padding:0;overflow:hidden">
    <div class="vm-window" style="border:none;border-radius:0">
      <div class="win-bar">
        <span class="dot r"></span><span class="dot y"></span><span class="dot g"></span>
        <span class="fname">dark</span>
      </div>
      <img src="/img/hero-dark.png" alt="Тёмная тема VeloxMark" />
    </div>
  </div>
</div>

## Переключение тем

- Меню: **Вид → Переключить тему** (также доступно как команда «Переключить тему»).
- Или выберите `light` / `dark` / `system` явно в настройках (режим темы).
- Выбор запоминается между сессиями.

Пользовательский безрамочный заголовок окна и меню приложения (Файл / Правка / Вид /
Вставка / Справка) следуют за активной темой.

## Пример кода в тёмной теме

<div class="vm-shot">

![Блок кода в тёмной теме](/img/code-dark.png)

</div>

## Как применяются темы

Редактор построен на [CodeMirror 6](https://codemirror.net); каждая тема — это тема CM6
плюс CSS-переменные, покрывающие каркас приложения. Отрендеренные виджеты (KaTeX,
Mermaid, highlight.js) подхватывают ту же палитру, поэтому блок кода или диаграмма
никогда не выглядят неуместно.
