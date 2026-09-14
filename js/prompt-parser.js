/*
 * Prompt Library — Markdown の解析・生成ロジック（共有）
 * app.js（一覧・詳細表示）と editor.html（作成・編集）の両方から利用する。
 * 解析と生成を同じ仕様に保つため、ロジックはこの1ファイルにまとめる。
 */
var PromptParser = (function () {
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

  // 「## 見出し」の行なら見出し文字列を返す。「###」以下は本文の一部として扱う。
  function headingText(line) {
    var match = /^##[ \t]+(.+?)[ \t]*$/.exec(line);
    return match ? match[1] : null;
  }

  function findHeading(lines, name) {
    for (var i = 0; i < lines.length; i++) {
      if (headingText(lines[i]) === name) return i;
    }
    return -1;
  }

  /*
   * 本文から「使い方」と「プロンプト」を取り出す。
   * プロンプトは「## プロンプト」の次の行から Markdown 末尾までとする。
   * プロンプト自体が「## 前提条件」「## 出力形式」のように見出しで構造化されて
   * いても欠けないようにするため、途中の見出しでは区切らない。
   * その代わり「使い方」は「## プロンプト」より前に置く決まりとする。
   */
  function parseBody(body) {
    var lines = body.split('\n');
    var promptIndex = findHeading(lines, 'プロンプト');

    var prompt = promptIndex === -1 ? '' : lines.slice(promptIndex + 1).join('\n').trim();
    var head = promptIndex === -1 ? lines : lines.slice(0, promptIndex);

    var usage = '';
    var usageIndex = findHeading(head, '使い方');
    if (usageIndex !== -1) {
      var rest = head.slice(usageIndex + 1);
      var end = rest.length;
      for (var i = 0; i < rest.length; i++) {
        if (headingText(rest[i]) !== null) { end = i; break; }
      }
      usage = rest.slice(0, end).join('\n').trim();
    }

    return { usage: usage, prompt: prompt };
  }

  // プロンプト全体がコードフェンスで囲まれている場合だけ、その囲みを外す。
  // 本文中にもフェンスがある場合は構造を壊すため、何もしない。
  function stripOuterFence(text) {
    var lines = text.split('\n');
    var fences = lines.filter(function (line) { return /^```/.test(line); }).length;
    if (fences === 2 && /^```/.test(lines[0]) && /^```\s*$/.test(lines[lines.length - 1])) {
      return lines.slice(1, -1).join('\n').trim();
    }
    return text;
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

  // テキスト全体を解析する。BOM・改行コードの正規化もここで行う。
  function parse(rawText) {
    var normalized = String(rawText || '').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
    var fm = parseFrontMatter(normalized);
    var body = parseBody(fm.body);

    var promptBody = body.prompt;
    var hasPromptSection = promptBody !== '';
    if (!hasPromptSection) {
      // 「## プロンプト」が無い場合は、H1 見出しを除いた本文全体をコピー対象とする。
      promptBody = fm.body.replace(/^\s*#[ \t]+.*\n/, '').trim();
    }

    return {
      meta: fm.meta,
      rawBody: fm.body,
      usage: body.usage,
      prompt: stripOuterFence(promptBody),
      hasPromptSection: hasPromptSection
    };
  }

  // ---------------------------------------------------------------
  // Markdown の生成（解析の逆方向）
  // ---------------------------------------------------------------

  // front matter の値として、そのまま書くと構文を壊す場合や、
  // 読み戻したときに値が変わってしまう場合（引用符で始まる値）は引用符で囲む。
  function needsQuote(value) {
    return value === '' || value !== value.trim() || /[:#]/.test(value) || /^["']/.test(value);
  }

  function quoteScalar(value) {
    return needsQuote(value)
      ? '"' + String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"'
      : value;
  }

  /*
   * フォーム入力から Markdown 全文を生成する。
   * fields: { title, category, tags(配列), description, usage, prompt }
   * README.md「front matter の記述方法」「本文の構成」に記載の形式に合わせる。
   */
  function buildMarkdown(fields) {
    var title = String(fields.title || '').trim();
    var category = String(fields.category || '').trim();
    var description = String(fields.description || '').trim();
    var usage = String(fields.usage || '').trim();
    var prompt = String(fields.prompt || '').trim();
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

    var body = '\n# ' + title + '\n';
    if (usage !== '') {
      body += '\n## 使い方\n\n' + usage + '\n';
    }
    body += '\n## プロンプト\n\n' + prompt + '\n';

    return fm + body;
  }

  // 外から使うのはこの4つだけ。ほかは内部の補助関数として閉じておく。
  return {
    parse: parse,
    toText: toText,
    toArray: toArray,
    buildMarkdown: buildMarkdown
  };
})();
