import { WELCOME_LOGO_DATA_URI } from '../welcomeLogo'
import { OPEN_KEY, SAVE_KEY } from './keys'

export const WELCOME_MD_JA = `# VeloxMark へようこそ

**Markdown** エディタのライブプレビュー — \`構文\`マーカーは行から離れると隠れます。Typora と同じ感覚です。

## 機能

- ライブプレビュー編集（ウィジウィグ風）
- *斜体*、**太字**、~~取り消し線~~、\`インラインコード\`
- [リンク](https://commonmark.org)と画像
- タスクリスト:
  - [x] ファイルを開く (${OPEN_KEY})
  - [ ] 数式を試す
- Mermaid 図表とコードハイライト
- コールアウト、脚注、==ハイライト==
- 複数タブ編集、アウトラインパネル、PDF/HTML 書き出し

## 数式

インライン数式 $E = mc^2$ や、ディスプレイ数式:

$$
\\int_{-\\infty}^{\\infty} e^{-x^2} \\, dx = \\sqrt{\\pi}
$$

## コード

\`\`\`typescript
function greet(name: string): string {
  return \`Hello, \${name}!\`
}
\`\`\`

## 図表

\`\`\`mermaid
graph LR
  A[Markdown を書く] --> B{ライブプレビュー}
  B --> C[きれいに見える]
  B --> D[クリックして編集]
\`\`\`

## 表

| 機能 | 状態 | 備考 |
| :------ | :----: | ----: |
| ライブプレビュー | ✅ | Typora スタイル |
| 数式 | ✅ | KaTeX |
| Mermaid | ✅ | クリックで編集 |

## 画像

![VeloxMark ロゴ](${WELCOME_LOGO_DATA_URI} =128x128)

## 拡張構文

コールアウトと ==ハイライトされたテキスト==:

> [!TIP]
> 図表、数式、コードブロックをクリックするとソースを編集できます。

脚注[^1]は定義へジャンプします — 番号をクリックしてみてください。

[^1]: この脚注のように。

> ヒント: レンダリングされたブロック（コード、数式、図表、表、画像）をクリックすると編集できます。
> \`${OPEN_KEY}\` で \`.md\` ファイルを開き、\`${SAVE_KEY}\` で保存します。
`

export const HELP_MD_JA = `# Markdown 構文リファレンス

## 見出し

# で始めます（1–6 個のハッシュ）:

\`\`\`markdown
# H1
## H2
### H3
\`\`\`

## 強調

\`\`\`markdown
**太字**  *斜体*  ~~取り消し線~~  \`コード\`
\`\`\`

## リスト

\`\`\`markdown
- 箇条書き項目
1. 番号付き項目
- [ ] タスク
- [x] 完了
\`\`\`

## 引用と区切り線

\`\`\`markdown
> 引用テキスト

---
\`\`\`

## 数式（KaTeX）

\`\`\`markdown
インライン: $a^2 + b^2 = c^2$

ディスプレイ:
$$
\\frac{1}{2}
$$
\`\`\`

## 図表（Mermaid）

\`\`\`\`markdown
\`\`\`mermaid
graph TD
  A --> B
\`\`\`
\`\`\`\`

## リンクと画像

\`\`\`markdown
[テキスト](https://example.com)
![代替テキスト](./image.png)
\`\`\`
`
