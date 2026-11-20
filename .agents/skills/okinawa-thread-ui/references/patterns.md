# 糸の交点：画面の型（最小の例）

[../assets/tokens.css](../assets/tokens.css) を読み込んだ前提の、最小の HTML / CSS の例。クラス名（`ot-` 接頭辞）や要素は**例**であり、対象アプリの命名・部品・フレームワークに合わせて書き直す。動作（JS）は対象アプリの仕組みを使う。

## 目次

1. 帯と見出し面
2. 本文の格子帯
3. 章と項目軸の行
4. 一覧（台帳）と行の直下の詳細
5. 行型の指標と横棒
6. 操作・選択・フォーカス・エラー
7. 狭い幅（600px 未満）
8. 画面の種類ごとの当てはめ方

## 1. 帯と見出し面

```html
<header class="ot-topbar">組織名 <strong>システム名</strong></header>
<div class="ot-hero">
  <h1 class="ot-hero__title">画面名</h1>
  <p class="ot-hero__lead">この画面でできることを1文で。</p>
  <span class="ot-hero__pattern" aria-hidden="true"></span>
</div>
```

```css
.ot-topbar { background: var(--ot-topbar); color: var(--ot-text); padding: 10px 24px; border-bottom: 1px solid var(--ot-line); }
.ot-hero { position: relative; background: var(--ot-hero); padding: 28px 24px; overflow: hidden; }
.ot-hero__title { font-family: var(--ot-font-mincho); font-size: 28px; }
/* 見出しの文字は模様の領域に入れない */
.ot-hero__title, .ot-hero__lead { position: relative; max-width: calc(100% - min(360px, 40%) - 16px); }
.ot-hero__pattern { position: absolute; top: 0; right: 0; bottom: 0; width: min(360px, 40%);
  background: url(thread-pattern.svg) right top / 136px 128px repeat; }
```

小さな画面では見出し面を低くし、模様を省いてよい。

## 2. 本文の格子帯

```css
.ot-body { position: relative; padding: 24px 24px 32px calc(24px + 36px); }
.ot-body::before {
  content: ''; position: absolute; top: 24px; bottom: 32px; left: 24px; width: var(--ot-rail-width);
  border-left: 2px solid var(--ot-thread); border-right: 2px solid var(--ot-thread);
  background:
    linear-gradient(90deg, transparent 5px, var(--ot-thread) 5px 6px, transparent 6px 9px, var(--ot-thread) 9px 10px, transparent 10px),
    repeating-linear-gradient(to bottom, var(--ot-thread) 0 1px, transparent 1px 7px),
    var(--ot-rail);
}
```

`::before` の装飾は読み上げられない。帯の幅は狭い幅で 8px 前後に縮め、本文の左余白も合わせて減らす。

## 3. 章と項目軸の行

```html
<section class="ot-chapter" aria-labelledby="ch-basic">
  <h2 id="ch-basic" class="ot-chapter__title">基本情報</h2>
  <div class="ot-chapter__body">
    <div class="ot-field">
      <label for="title">件名 <span class="ot-req">必須</span></label>
      <div><input id="title" aria-describedby="title-hint"><p id="title-hint">40字以内</p></div>
    </div>
  </div>
</section>
```

```css
.ot-chapter { display: grid; grid-template-columns: 200px 1fr; border-top: var(--ot-chapter-rule); padding-top: 16px; }
.ot-chapter__title { font-family: var(--ot-font-mincho); border-right: var(--ot-axis); padding-right: 16px; }
.ot-chapter__title::before { content: '+'; color: var(--ot-thread); margin-right: .4em; } /* 交点の印。文字で代えてよい */
.ot-field { display: grid; grid-template-columns: 172px 1fr; gap: 0 16px; padding: 12px 0; border-bottom: var(--ot-row-line); }
.ot-field > label { border-right: var(--ot-axis); padding-right: 12px; }
.ot-req { border-left: 1px solid var(--ot-rule); padding-left: .5em; margin-left: .5em; font-size: .85em; }
.ot-field input, .ot-field textarea, .ot-field select { width: 100%; background: var(--ot-input); color: var(--ot-input-text);
  border: 1px solid var(--ot-rule); border-radius: 0; font: inherit; padding: 8px 10px; }
```

閲覧用の詳細も同じ軸で `dl` にする（`dt` に右の縦軸、`dd` に値）。

## 4. 一覧（台帳）と行の直下の詳細

- 列の順は「識別子 → 状態 → 内容」。識別子と状態の列の右に縦軸（`border-right: var(--ot-axis)`）。
- 見出し行は `--ot-header`、行の区切りは `--ot-row-line`。行の背景を交互に塗らない。
- 詳細は、選んだ行の直下に1行（`<tr><td colspan>`）を差し込み、中を「項目名｜値」の `dl` にする。開閉ボタンに `aria-expanded` と `aria-controls`。閉じたら開閉ボタンにフォーカスを戻す。
- 件数（「全 n 件中 m 件」）と絞り込み中の条件は、表の上に文字で示す。

## 5. 行型の指標と横棒

```html
<dl class="ot-kpis">
  <div class="ot-kpi ot-kpi--lead"><dt>全件</dt><dd class="v">42件</dd><dd>登録されている件数</dd><dd><a href="#list">一覧へ</a></dd></div>
  <div class="ot-kpi"><dt>完了率</dt><dd class="v">64%</dd><dd>完了 ÷ 全件</dd><dd></dd></div>
</dl>
```

```css
.ot-kpi { display: grid; grid-template-columns: 12em 7.5em 1fr 8em; border-bottom: var(--ot-row-line); padding: 10px 12px; }
.ot-kpi--lead { background: var(--ot-lead); color: var(--ot-ground); }
.ot-kpi .v { font-size: 1.4em; font-variant-numeric: tabular-nums; }
.ot-bar { display: flex; align-items: center; gap: .5em; }
.ot-bar__fill { height: 14px; background: var(--ot-bar); width: calc((100% - 3.5em) * var(--r)); } /* --r は 0〜1 */
```

棒の直後に件数を文字で置く（`<span class="ot-bar__fill" style="--r:.6"></span><span>12件</span>`）。グラフは表（または文字の一覧）でも読めるようにする。

## 6. 操作・選択・フォーカス・エラー

```css
.ot-primary { background: var(--ot-cream); color: var(--ot-ground); border: 1px solid var(--ot-cream); font-weight: 700; padding: 8px 18px; }
.ot-secondary { background: transparent; color: var(--ot-text); border: 1px solid var(--ot-thread); padding: 8px 14px; }
.ot-textlink { color: var(--ot-text); text-decoration: underline; background: none; border: 0; }
/* 選択：塗り＋チェック＋太字 */
[aria-pressed="true"], [aria-selected="true"] { background: var(--ot-cream); color: var(--ot-ground); font-weight: 700; }
[aria-pressed="true"]::before, [aria-selected="true"]::before { content: '✓ '; }
/* フォーカス：選択とは別の色と形。プログラムで移した tabindex="-1" の要素にも */
:focus-visible, [tabindex="-1"]:focus { outline: var(--ot-focus-ring); outline-offset: 2px; box-shadow: 0 0 0 2px var(--ot-ground); }
/* エラー */
.ot-field--error input, .ot-field--error textarea { border: 3px solid var(--ot-error-line); }
.ot-error { color: var(--ot-error); font-weight: 700; } /* 「エラー：」で始め、理由と直し方を書く */
```

エラーのまとめは、件数と項目名のリンク（`href="#欄のid"`）を並べ、送信時にまとめへフォーカスを移す。欄には `aria-invalid="true"` と、エラー文への `aria-describedby`。

## 7. 狭い幅（600px 未満）

```css
@media (max-width: 599px) {
  .ot-chapter, .ot-field { grid-template-columns: 1fr; }
  .ot-chapter__title, .ot-field > label { border-right: 0; padding-right: 0; }
  .ot-body { padding-left: calc(16px + 20px); }
  .ot-body::before { left: 16px; width: 8px; background: repeating-linear-gradient(to bottom, var(--ot-thread) 0 1px, transparent 1px 7px), var(--ot-rail); }
  .ot-kpi { grid-template-columns: 1fr auto; }
  /* 表は行ごとのラベル付きの塊に */
  .ot-ledger thead { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
  .ot-ledger tr, .ot-ledger td { display: block; }
  .ot-ledger td[data-label]::before { content: attr(data-label); display: block; color: var(--ot-muted); font-size: .85em; }
}
```

`display: block` にした表は、支援技術によっては表として読まれなくなる。必要なら `role` を補う（対象アプリの方針に合わせる）。

## 8. 画面の種類ごとの当てはめ方

| 画面 | 識別子 → 状態 → 内容 | 章の例 | 入れなくてよい部品 |
| --- | --- | --- | --- |
| 申請の台帳 | 申請番号 → 状態 → 申請者・種別・日付 | 検索条件／一覧 | — |
| メモ・タスク | 番号 → 状態（未着手・進行中・完了） → 件名・期日 | 絞り込み／メモ／集計 | 推移の横棒（件数が少ない場合） |
| 予約 | 日時 → 状態（仮・確定・取消） → 施設・利用者 | 日付／予約一覧／入力 | 行型の指標 |
| 設定 | 項目名 → 現在の値 → 説明 | 設定の分類ごと | 一覧・指標・横棒 |
