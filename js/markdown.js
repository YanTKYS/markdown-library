/*
 * 小さな Markdown レンダラー（外部ライブラリ不使用）。
 * 一覧の詳細画面とエディタのプレビューで、エントリ本文の表示に使う。
 *
 * 対応: 見出し(# 〜 ######) / 段落 / 改行 / 箇条書き(- * +) / 番号付きリスト(1. 1))
 *       / 入れ子のリスト / 区切り線(---) / 太字(**) / インラインコード(`)
 *       / コードブロック(``` または ~~~、言語名付き)
 * 表・リンク・画像などには対応せず、書かれた文字列をそのまま表示する。
 *
 * 安全のため、本文中の HTML はすべて文字としてエスケープし、実行・解釈しない。
 * コードブロックの中身も変換せず、そのまま表示する（PlantUML・Mermaid も図にはしない）。
 */
var MiniMarkdown = (function () {
  'use strict';

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // ---------------------------------------------------------------
  // インライン要素（太字・インラインコード）
  // コード部分に「**」があっても太字にしないよう、先にコードで区切ってから処理する。
  // ---------------------------------------------------------------
  function emphasis(text) {
    return escapeHtml(text).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  }

  function inline(text) {
    var pattern = /`([^`]+)`/g;
    var html = '';
    var last = 0;
    var match;
    while ((match = pattern.exec(text)) !== null) {
      html += emphasis(text.slice(last, match.index)) + '<code>' + escapeHtml(match[1]) + '</code>';
      last = pattern.lastIndex;
    }
    return html + emphasis(text.slice(last));
  }

  // 複数行を1つの段落・項目として表示する。行の区切りはそのまま改行にする。
  function inlineLines(lines) {
    return lines.map(function (line) { return inline(line.trim()); }).join('<br>');
  }

  // ---------------------------------------------------------------
  // 行の判定
  // ---------------------------------------------------------------
  var FENCE = /^([ \t]*)(`{3,}|~{3,})[ \t]*([^`]*?)[ \t]*$/;
  var HEADING = /^ {0,3}(#{1,6})(?:[ \t]+(.*?))?(?:[ \t]+#+)?[ \t]*$/;
  var RULE = /^ {0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/;
  var LIST_ITEM = /^([ \t]*)([-*+]|\d{1,9}[.)])[ \t]+(.*)$/;

  function isBlank(line) { return line.trim() === ''; }

  function indentWidth(space) { return space.replace(/\t/g, '    ').length; }

  function startsBlock(line) {
    return FENCE.test(line) || HEADING.test(line) || RULE.test(line) || LIST_ITEM.test(line);
  }

  // ---------------------------------------------------------------
  // コードブロック
  // コピー用のボタンは表示だけを用意し、動作は利用側（app.js / editor.js）で付ける。
  // ---------------------------------------------------------------
  function codeBlock(lang, code) {
    var safeLang = lang.replace(/[^\w+#.-]/g, '');
    return '<div class="code-block">' +
      '<div class="code-block-bar">' +
        '<span class="code-lang">' + escapeHtml(lang || 'コード') + '</span>' +
        '<button type="button" class="button button-quiet code-copy">コピー</button>' +
      '</div>' +
      '<pre><code' + (safeLang ? ' class="language-' + escapeHtml(safeLang) + '"' : '') + '>' +
        escapeHtml(code) +
      '</code></pre>' +
    '</div>';
  }

  // 開始フェンスと同じ記号で、同じ長さ以上のフェンスが来るまでをコードとする。
  // 閉じるフェンスが無い場合は本文の最後までをコードとする。
  function readFence(lines, start) {
    var open = FENCE.exec(lines[start]);
    var indent = indentWidth(open[1]);
    var marker = open[2];
    var lang = open[3].split(/\s+/)[0] || '';
    var code = [];
    var i = start + 1;

    for (; i < lines.length; i++) {
      var close = /^[ \t]*(`{3,}|~{3,})[ \t]*$/.exec(lines[i]);
      if (close && close[1].charAt(0) === marker.charAt(0) && close[1].length >= marker.length) {
        i++;
        break;
      }
      // 開始フェンスが字下げされている場合は、その分だけ各行の字下げを外す。
      code.push(indent > 0 ? lines[i].replace(new RegExp('^ {0,' + indent + '}'), '') : lines[i]);
    }

    return { html: codeBlock(lang, code.join('\n')), next: i };
  }

  // ---------------------------------------------------------------
  // リスト（字下げの深さで入れ子にする）
  // ---------------------------------------------------------------
  function readList(lines, start) {
    var items = [];
    var i = start;

    for (; i < lines.length; i++) {
      var line = lines[i];

      if (isBlank(line)) {
        // 空行の次もリストの項目なら、同じリストの続きとして扱う。
        var j = i + 1;
        while (j < lines.length && isBlank(lines[j])) j++;
        if (j < lines.length && LIST_ITEM.test(lines[j]) && !RULE.test(lines[j])) {
          i = j - 1;
          continue;
        }
        break;
      }

      if (FENCE.test(line) || HEADING.test(line) || RULE.test(line)) break;

      var item = LIST_ITEM.exec(line);
      if (item) {
        items.push({
          indent: indentWidth(item[1]),
          ordered: /\d/.test(item[2]),
          number: parseInt(item[2], 10),
          lines: [item[3]]
        });
      } else {
        // 項目の続きの行
        items[items.length - 1].lines.push(line);
      }
    }

    return { html: renderListItems(items), next: i };
  }

  function openList(item) {
    if (!item.ordered) return '<ul>';
    return item.number !== 1 && !isNaN(item.number) ? '<ol start="' + item.number + '">' : '<ol>';
  }

  function renderListItems(items) {
    var html = '';
    var stack = []; // 開いているリスト { indent, ordered }

    items.forEach(function (item) {
      while (stack.length > 1 && item.indent < stack[stack.length - 1].indent) {
        html += '</li>' + (stack.pop().ordered ? '</ol>' : '</ul>');
      }

      var top = stack[stack.length - 1];
      if (!top || item.indent > top.indent) {
        // 新しいリスト（2つめ以降は直前の項目の中に入れ子で開く）
        stack.push({ indent: item.indent, ordered: item.ordered });
        html += openList(item);
      } else {
        html += '</li>';
        if (top.ordered !== item.ordered) {
          html += (top.ordered ? '</ol>' : '</ul>') + openList(item);
          top.ordered = item.ordered;
        }
      }
      html += '<li>' + inlineLines(item.lines);
    });

    while (stack.length) {
      html += '</li>' + (stack.pop().ordered ? '</ol>' : '</ul>');
    }
    return html;
  }

  // ---------------------------------------------------------------
  // 本文全体
  // ---------------------------------------------------------------

  /*
   * options.headingOffset: 見出しレベルの繰り下げ数。
   * 画面側で既に h2 などを使っている場合に、本文の「#」を h3 以下へずらして
   * 文書構造を崩さないために使う（見た目は md-h1〜md-h6 のクラスで元のレベルに合わせる）。
   */
  function render(markdown, options) {
    var offset = (options && options.headingOffset) || 0;
    var lines = String(markdown || '').replace(/\r\n?/g, '\n').split('\n');
    var html = '';
    var i = 0;

    while (i < lines.length) {
      var line = lines[i];

      if (isBlank(line)) { i++; continue; }

      if (FENCE.test(line)) {
        var fence = readFence(lines, i);
        html += fence.html;
        i = fence.next;
        continue;
      }

      var heading = HEADING.exec(line);
      if (heading) {
        var level = heading[1].length;
        var tag = 'h' + Math.min(level + offset, 6);
        html += '<' + tag + ' class="md-h' + level + '">' + inline(heading[2] || '') + '</' + tag + '>';
        i++;
        continue;
      }

      if (RULE.test(line)) {
        html += '<hr>';
        i++;
        continue;
      }

      if (LIST_ITEM.test(line)) {
        var list = readList(lines, i);
        html += list.html;
        i = list.next;
        continue;
      }

      // 段落: 空行または別の種類の行が来るまで。
      var paragraph = [line];
      i++;
      while (i < lines.length && !isBlank(lines[i]) && !startsBlock(lines[i])) {
        paragraph.push(lines[i]);
        i++;
      }
      html += '<p>' + inlineLines(paragraph) + '</p>';
    }

    return html;
  }

  return { render: render, escapeHtml: escapeHtml };
})();
