/*
 * クリップボードへのコピー（app.js・editor.js 共通）
 * 庁内 IIS は http:// 配信になることがあり、その場合 navigator.clipboard は
 * 使えない（secure context 限定）。旧方式へ確実にフォールバックする。
 */
var CopyHelper = (function () {
  'use strict';

  // 旧方式: 画面外に置いたテキストエリアを選択してコピーする。
  function legacyCopy(text) {
    var area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.top = '-1000px';
    document.body.appendChild(area);
    area.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    document.body.removeChild(area);
    return ok ? Promise.resolve() : Promise.reject(new Error('copy failed'));
  }

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      // ブラウザの設定・ポリシーで Clipboard API が拒否された場合も旧方式で再試行する。
      return navigator.clipboard.writeText(text).catch(function () { return legacyCopy(text); });
    }
    return legacyCopy(text);
  }

  // 「コピーしました」と表示中のボタン。2秒後、または次のコピー時に元の表示へ戻す。
  var active = null;

  function restore() {
    if (!active) return;
    window.clearTimeout(active.timer);
    active.button.textContent = active.label;
    active.button.classList.remove('is-done');
    active = null;
  }

  /*
   * コピーし、結果を押されたボタンの表示で知らせる。
   * 成功なら true、失敗なら false で解決する Promise を返す。
   */
  function copyFromButton(button, text) {
    // 続けて別の内容をコピーしたとき、前のボタンが
    // 「コピーしました」のまま残らないように先に戻す。
    restore();
    var label = button.textContent;

    return copyText(text).then(function () {
      button.textContent = 'コピーしました';
      button.classList.add('is-done');
      return true;
    }, function () {
      button.textContent = 'コピーできません';
      return false;
    }).then(function (ok) {
      active = {
        button: button,
        label: label,
        timer: window.setTimeout(restore, 2000)
      };
      return ok;
    });
  }

  // コードブロック内の「コピー」ボタンから、そのブロックのコード本文だけを取り出す。
  function codeOfButton(button) {
    var block = button.closest('.code-block');
    var code = block && block.querySelector('pre code');
    return code ? code.textContent : null;
  }

  return { copyText: copyText, copyFromButton: copyFromButton, codeOfButton: codeOfButton };
})();
