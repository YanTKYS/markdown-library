---
name: okinawa-thread-ui
description: Applies the "糸の交点" (Okinawa-themed, thread-intersection) visual design to a web UI — deep indigo ground, light plain input surfaces, a thin lattice rail, double-ruled chapters, and chapter / label / value axes — when asked to design a new screen or restyle an existing screen in the 糸の交点 / 沖縄テーマ style. Covers lists, forms, dashboards and small apps (memos, reservations). Do not use for unrelated coding, refactoring or other design styles.
compatibility: Plain HTML/CSS (optionally JS). Works offline; no CDN, web font or external API is required.
metadata:
  source: "YanTKYS/design-lab okinawa-thread (9th comparison design)"
  version: "0.1"
---

# 糸の交点 UI を適用する

宮古上布の経糸・緯糸・十字絣に**着想した独自のデザイン**（名称は仮称）を、Web 画面に適用する。宮古上布の公式な意匠・伝統工芸の再現・沖縄全域を代表する様式ではない。依頼者や画面にもそう説明しない。

見た目を貼り付けるのではなく、**読み順の構造**（章 → 項目名 → 値、番号 → 状態 → 値）を対象の業務に合わせて組み直すことが目的。

## 使う場面

- 「糸の交点」「沖縄テーマ」の見た目で、新しい画面を作る／既存の画面を改修する依頼。
- 一覧・フォーム・集計に限らず、メモ・予約・設定など小さな画面にも使える。

使わない場面：このデザインの指定がない作業、ほかのデザインシステムの適用、見た目と無関係な修正。

## 手順

1. **対象を先に確認する。** 技術スタック（素の HTML か、フレームワークか）、既存の CSS の読み込み順、画面の目的・主要操作、入力の検証と保存の仕組み、既存のアクセシビリティ対応（ラベル、`aria-*`、フォーカス移動）を読む。動作・データ・保存処理は変えない。
2. **規則を読む。** [references/design-principles.md](references/design-principles.md) の「必ず守る規則」「調整してよい点」「避ける実装」を確認する。
3. **トークンを入れる。** [assets/tokens.css](assets/tokens.css) を対象に取り込む（コピーしてよい）。既存のクラス名・CSS 変数と衝突する場合は、接頭辞を変えるか、適用範囲を画面のルート要素に限定する。
4. **画面の型に当てはめる。** [references/patterns.md](references/patterns.md) から近い型（帯・章・項目軸の行・台帳・行型の指標・横棒・狭い幅）を選び、対象のマークアップに合わせて書く。対象の業務にない部品（KPI、横棒など）は足さない。
5. **見出しの模様を置く（任意）。** [assets/thread-pattern.svg](assets/thread-pattern.svg) を画面名の見出し面の右端だけに置く。`aria-hidden="true"`、情報や操作の上には重ねない。
6. **自己点検する**（下記）。直したら、もう一度 1280px 前後と 375px で確認する。

## 自己点検

- [ ] 濃藍の地に、本文・補助文字・入力欄の文字が十分に読める（目安：本文と入力欄は 4.5:1 以上）。
- [ ] 本文左の格子帯、章の二重罫、「章｜項目名｜値」の縦軸がある。装飾だけでなく読み順になっている。
- [ ] 主操作（生成りの塗り）・副操作（細い枠）・文字の操作（下線）が区別できる。
- [ ] 選択（生成りの塗り＋チェック＋太字）と、フォーカス（黄色の外枠）が別に見える。プログラムで移したフォーカスにも枠が出る。
- [ ] エラーは「エラー」の文字・理由・欄の太枠で示し、色だけに頼らない。件数のまとめから該当欄へ移れる。
- [ ] 長い日本語のラベル・値・同意文が折り返し、375px でページ全体が横にはみ出さない。項目名は値の直上に来る。
- [ ] IME の変換中に入力や検索結果が勝手に確定・再描画されない（既存の挙動を壊していない）。
- [ ] キーボードだけで主要操作ができる。開閉した後のフォーカスの戻り先が自然。
- [ ] 模様は見出し面の右端だけで、`aria-hidden` になっている。模様の領域に情報を置いていない。
- [ ] 外部のフォント・CDN・API を追加していない。明朝がない端末ではゴシックに落ちても崩れない。

## 報告するときの注意

- 何を参照したか（このファイル、references、assets）と、対象に合わせて変えた点を書く。
- 実機で確かめていないこと（スクリーンリーダー、別ブラウザ、実機の IME など）は「未確認」と書く。
- 地域の印象・業務効率・アクセシビリティ基準への適合を、確かめずに断定しない。
