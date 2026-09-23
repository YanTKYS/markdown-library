/*
 * Markdown Library — エントリ（1ファイル＝1エントリ）の解析・生成ロジック（共有）
 * app.js（一覧・詳細表示）と editor.js（作成・編集）の両方から利用する。
 * 解析と生成を同じ仕様に保つため、ロジックはこの1ファイルにまとめる。
 *
 * エントリは「front matter ＋ Markdown 本文」で構成する。
 * 本文の書き方には決まりを設けず、front matter を除いた部分をそのまま本文として扱う。
 */
var EntryParser = (function () {
  'use strict';

  // ---------------------------------------------------------------
  // front matter の解析
  // YAML 全体ではなく「key: value」と「- 項目」のリストだけを扱う。
  // ---------------------------------------------------------------
  function unquote(value) {
    var trimmed = value.trim();
    if (trimmed.length >= 2) {
      var first = trimmed.charAt(0);
      var last = trimmed.charAt(trimmed.length - 1);
      // 二重引用符の中の \" \\ は buildMarkdown が付けたエスケープなので元に戻す。
      if (first === '"' && last === '"') {
        return trimmed.slice(1, -1).replace(/\\(["\\])/g, '$1');
      }
      if (first === "'" && last === "'") {
        return trimmed.slice(1, -1);
      }
    }
    return trimmed;
  }

  function parseFrontMatter(text) {
    var match = /^---[ \t]*\n([\s\S]*?)\n---[ \t]*(?:\n|$)/.exec(text);
    if (!match) return { meta: {}, body: text };

    var meta = {};
    var listKey = null;

    match[1].split('\n').forEach(function (line) {
      if (line.trim() === '' || /^\s*#/.test(line)) return;

      var item = /^\s*-\s+(.*)$/.exec(line);
      if (item && listKey) {
        meta[listKey].push(unquote(item[1]));
        return;
      }

      var pair = /^([A-Za-z0-9_-]+)\s*:\s*(.*)$/.exec(line);
      if (!pair) return;

      var key = pair[1];
      var value = pair[2].trim();

      if (value === '') {
        // 次行以降が「- 項目」形式のリスト
        listKey = key;
        meta[key] = [];
      } else if (/^\[.*\]$/.test(value)) {
        // インライン配列 tags: [a, b]
        listKey = null;
        meta[key] = value.slice(1, -1).split(',')
          .map(unquote)
          .filter(function (v) { return v !== ''; });
      } else {
        listKey = null;
        meta[key] = unquote(value);
      }
    });

    return { meta: meta, body: text.slice(match[0].length) };
  }

  // 本文の前後にある空行・末尾の空白だけを取り除く。
  // 1行目の字下げなど本文の中身には手を付けない。
  function trimBody(text) {
    return String(text || '').replace(/^\n+/, '').replace(/\s+$/, '');
  }

  /*
   * front matter の値を文字列として取り出す。
   * 「description:」のように値を書き忘れた行はリストの開始とみなされて配列になる。
   * そのまま画面へ渡すと表示時にエラーになるため、ここで必ず文字列へそろえる。
   */
  function toText(value) {
    if (Array.isArray(value)) return value.join(' ').trim();
    return value == null ? '' : String(value).trim();
  }

  function toArray(value) {
    if (Array.isArray(value)) return value.filter(function (v) { return String(v).trim() !== ''; });
    if (value == null || String(value).trim() === '') return [];
    return [String(value).trim()];
  }

  /*
   * テキスト全体を解析する。BOM・改行コードの正規化もここで行う。
   * 戻り値: { meta: front matter の値, body: front matter を除いた Markdown 本文 }
   */
  function parse(rawText) {
    var normalized = String(rawText || '').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
    var fm = parseFrontMatter(normalized);
    return {
      meta: fm.meta,
      body: trimBody(fm.body)
    };
  }

  // ---------------------------------------------------------------
  // Markdown の生成（解析の逆方向）
  // ---------------------------------------------------------------

  // front matter の値として、そのまま書くと構文を壊す場合や、
  // 読み戻したときに値が変わってしまう場合は引用符で囲む。
  // （引用符で始まる値は引用符が外れ、「[様式]」のような値は配列と誤認される）
  function needsQuote(value) {
    return value === '' || value !== value.trim() || /[:#]/.test(value) || /^["'\[]/.test(value);
  }

  function quoteScalar(value) {
    return needsQuote(value)
      ? '"' + String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"'
      : value;
  }

  /*
   * フォーム入力から Markdown 全文を生成する。
   * fields: { title, category, tags(配列), description, body }
   * 本文は利用者が入力したものをそのまま front matter の後ろに置く。
   * 見出し等を自動で書き足すことはしない。
   */
  function buildMarkdown(fields) {
    var title = String(fields.title || '').trim();
    var category = String(fields.category || '').trim();
    var description = String(fields.description || '').trim();
    var body = trimBody(String(fields.body || '').replace(/\r\n?/g, '\n'));
    var tags = (fields.tags || []).map(function (t) { return String(t).trim(); })
      .filter(function (t) { return t !== ''; });

    var fm = '---\n';
    fm += 'title: ' + quoteScalar(title) + '\n';
    fm += 'category: ' + quoteScalar(category) + '\n';
    if (tags.length > 0) {
      fm += 'tags:\n';
      tags.forEach(function (t) { fm += '  - ' + quoteScalar(t) + '\n'; });
    }
    fm += 'description: ' + quoteScalar(description) + '\n';
    fm += '---\n';

    return body === '' ? fm : fm + '\n' + body + '\n';
  }

  // 外から使うのはこの4つだけ。ほかは内部の補助関数として閉じておく。
  return {
    parse: parse,
    toText: toText,
    toArray: toArray,
    buildMarkdown: buildMarkdown
  };
})();
