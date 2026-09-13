/*
 * ごく小さな Markdown レンダラー。
 * 「## 使い方」など説明文の描画だけに使う。
 * 対応: 段落 / 箇条書き(- *) / 番号付きリスト(1.) / 強調(**) / インラインコード(`)
 * プロンプト本文はコピー内容を変えないため、これを通さず原文のまま表示する。
 */
var MiniMarkdown = (function () {
  'use strict';

  function escapeHtml(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function inline(text) {
    return escapeHtml(text)
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  }

  // 空行区切りのブロックへ分割し、ブロックごとにリストか段落かを判定する。
  function render(markdown) {
    var blocks = String(markdown || '').replace(/\r\n?/g, '\n').trim().split(/\n{2,}/);
    var html = '';

    blocks.forEach(function (block) {
      var lines = block.split('\n').filter(function (line) { return line.trim() !== ''; });
      if (lines.length === 0) return;

      var isBullet = lines.every(function (line) { return /^\s*[-*]\s+/.test(line); });
      var isNumber = lines.every(function (line) { return /^\s*\d+[.)]\s+/.test(line); });

      if (isBullet || isNumber) {
        var tag = isBullet ? 'ul' : 'ol';
        html += '<' + tag + '>';
        lines.forEach(function (line) {
          html += '<li>' + inline(line.replace(/^\s*(?:[-*]|\d+[.)])\s+/, '')) + '</li>';
        });
        html += '</' + tag + '>';
      } else {
        html += '<p>' + lines.map(inline).join('<br>') + '</p>';
      }
    });

    return html;
  }

  return { render: render, escapeHtml: escapeHtml };
})();
