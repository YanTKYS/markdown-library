/*
 * プロンプトエディタ — Markdown を直接書かずに作成・編集するための画面。
 * data/tags.json のカテゴリ・タグを使い、フォーム内容から
 * Prompt Library 仕様の Markdown を生成する。
 * GitHub / IIS への反映は行わない（.md ファイルのダウンロードのみ）。
 */
(function () {
  'use strict';

  var BASE = new URL('../', document.currentScript.src);
  function url(path) { return new URL(path, BASE).href; }

  var state = {
    categories: [],
    tags: [],
    selectedCategory: '',
    selectedTags: [],
    // 読み込んだ Markdown に data/tags.json 未定義の値があった場合の保持先。
    // カテゴリ・タグの新規追加はエディタの責務外（将来の管理機能側）とし、
    // ここでは既存値を消さずに保持し、警告として表示するだけにとどめる。
    unknownCategory: '',
    unknownTags: []
  };

  var el = {};
  var esc = MiniMarkdown.escapeHtml;

  // ---------------------------------------------------------------
  // カテゴリ・タグの選択（一覧画面の絞り込みチップと同じ見た目を再利用する）
  // ---------------------------------------------------------------
  function renderCategoryChips() {
    var html = '';
    state.categories.forEach(function (category) {
      var on = state.selectedCategory === category;
      html += '<button type="button" class="chip chip-category' + (on ? ' is-on' : '') +
        '" data-category="' + esc(category) + '" aria-pressed="' + (on ? 'true' : 'false') + '">' +
        esc(category) + '</button>';
    });
    if (state.unknownCategory) {
      html += '<button type="button" class="chip chip-category chip-unknown" data-remove-unknown-category="1" ' +
        'title="data/tags.json に未定義のカテゴリです。クリックすると削除します。">' +
        esc(state.unknownCategory) + ' <span aria-hidden="true">×</span></button>';
    }

    el.categoryChips.innerHTML = html;

    el.categoryWarning.hidden = !state.unknownCategory;
    if (state.unknownCategory) {
      el.categoryWarning.textContent = '「' + state.unknownCategory + '」は data/tags.json に未定義のカテゴリです。' +
        '値は保持していますが、正式な分類として追加するには管理側で data/tags.json を更新してください。';
    }
  }

  function renderTagChips() {
    var html = '';
    state.tags.forEach(function (tag) {
      var on = state.selectedTags.indexOf(tag) !== -1;
      html += '<button type="button" class="chip chip-tag' + (on ? ' is-on' : '') +
        '" data-tag="' + esc(tag) + '" aria-pressed="' + (on ? 'true' : 'false') + '">#' + esc(tag) + '</button>';
    });
    state.unknownTags.forEach(function (tag) {
      html += '<button type="button" class="chip chip-tag chip-unknown" data-remove-unknown-tag="' + esc(tag) + '" ' +
        'title="data/tags.json に未定義のタグです。クリックすると削除します。">#' + esc(tag) + ' <span aria-hidden="true">×</span></button>';
    });
    el.tagChips.innerHTML = html;

    el.tagWarning.hidden = state.unknownTags.length === 0;
    if (state.unknownTags.length) {
      el.tagWarning.textContent = '未定義のタグ（data/tags.json に無いもの）: ' + state.unknownTags.join('、') + '。' +
        '値は保持していますが、正式に追加するには管理側で data/tags.json を更新してください。';
    }
  }

  function toggleCategory(category) {
    state.selectedCategory = state.selectedCategory === category ? '' : category;
    // カテゴリは1つだけのため、定義済みを選んだ時点で未定義の保持値は置き換える。
    if (state.selectedCategory) state.unknownCategory = '';
    renderCategoryChips();
    updatePreview();
  }

  function removeUnknownCategory() {
    state.unknownCategory = '';
    renderCategoryChips();
    updatePreview();
  }

  function toggleTag(tag) {
    var index = state.selectedTags.indexOf(tag);
    if (index === -1) {
      state.selectedTags.push(tag);
    } else {
      state.selectedTags.splice(index, 1);
    }
    renderTagChips();
    updatePreview();
  }

  function removeUnknownTag(tag) {
    state.unknownTags = state.unknownTags.filter(function (t) { return t !== tag; });
    renderTagChips();
    updatePreview();
  }

  function allTags() {
    var seen = {};
    var result = [];
    state.selectedTags.concat(state.unknownTags).forEach(function (tag) {
      if (!seen[tag]) { seen[tag] = true; result.push(tag); }
    });
    return result;
  }

  function currentCategory() {
    return state.selectedCategory || state.unknownCategory;
  }

  // ---------------------------------------------------------------
  // フォーム内容 ⇔ Markdown
  // ---------------------------------------------------------------
  function currentFields() {
    return {
      title: el.title.value.trim(),
      category: currentCategory(),
      tags: allTags(),
      description: el.description.value.trim(),
      usage: el.usage.value,
      prompt: el.prompt.value
    };
  }

  // ---------------------------------------------------------------
  // 保存ファイル名の検証
  // 日本語を含む Windows / IIS で安全なファイル名を許可する。
  // ".md" を除いた部分は、将来 history/<ファイル名>/ のようにディレクトリ名
  // としても使う予定のため、ディレクトリ名としても安全な範囲で検証する。
  // ---------------------------------------------------------------
  var FILENAME_MAX_LENGTH = 150; // Windows の1階層あたりの上限(255)より十分小さく、history/ 配下に余裕を残す
  var FORBIDDEN_CHARS_REGEX = /[\\/:*?"<>|]/;
  var CONTROL_CHARS_REGEX = /[\x00-\x1f\x7f-\x9f]/;
  var RESERVED_NAMES = [
    'CON', 'PRN', 'AUX', 'NUL',
    'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
    'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'
  ];

  // Unicode 正規化した保存ファイル名を返す。
  // 先頭・末尾の空白は検証対象とするため、ここでは trim しない。
  function normalizedFilename() {
    return String(el.filename.value || '').normalize('NFC');
  }

  // 検証エラーがあればメッセージ、問題なければ空文字を返す。
  function filenameError(name) {
    if (name.trim() === '') return 'ファイル名を入力してください。';

    if (/^\s|\s$/.test(name)) {
      return 'ファイル名の先頭・末尾に空白を含めないでください。';
    }

    if (!/\.md$/.test(name)) {
      return 'ファイル名の末尾は半角の「.md」にしてください。';
    }

    var base = name.slice(0, -3);
    if (base === '') {
      return '「.md」の前にファイル名を入力してください。';
    }

    var length = Array.from(name).length;
    if (length > FILENAME_MAX_LENGTH) {
      return 'ファイル名が長すぎます（' + length + '文字）。' + FILENAME_MAX_LENGTH + '文字以内にしてください。';
    }

    if (FORBIDDEN_CHARS_REGEX.test(base)) {
      return 'ファイル名に使用できない記号が含まれています（\\ / : * ? " < > | は使用できません）。';
    }

    if (CONTROL_CHARS_REGEX.test(base)) {
      return 'ファイル名に制御文字が含まれています。';
    }

    if (base === '.' || base === '..') {
      return '「.」や「..」だけのファイル名は使用できません。';
    }

    if (/[ .]$/.test(base)) {
      return 'ファイル名の末尾にピリオドや空白は使用できません。';
    }

    var stem = base.split('.')[0].toUpperCase();
    if (RESERVED_NAMES.indexOf(stem) !== -1) {
      return '「' + stem + '」は Windows の予約名のため使用できません（CON, PRN, AUX, NUL, COM1〜9, LPT1〜9 など）。';
    }

    return '';
  }

  function validateFilename(name) {
    return filenameError(name) === '';
  }

  function renderPreviewDetail(fields) {
    var html = '<header class="detail-header">' +
      '<span class="card-category">' + esc(fields.category || '(カテゴリ未設定)') + '</span>' +
      '<h2 class="detail-title">' + esc(fields.title || '(無題)') + '</h2>' +
      (fields.description ? '<p class="detail-description">' + esc(fields.description) + '</p>' : '') +
      (fields.tags.length
        ? '<div class="detail-tags">' + fields.tags.map(function (t) {
            return '<span class="tag">#' + esc(t) + '</span>';
          }).join('') + '</div>'
        : '') +
      '</header>';

    if (fields.usage.trim() !== '') {
      html += '<section class="detail-section"><h3>使い方</h3>' +
        '<div class="prose">' + MiniMarkdown.render(fields.usage) + '</div></section>';
    }

    html += '<section class="detail-section"><h3>プロンプト</h3>' +
      '<pre class="prompt-body">' + esc(fields.prompt.trim()) + '</pre></section>';

    el.previewDetail.innerHTML = html;
  }

  function updatePreview() {
    var fields = currentFields();
    var markdown = PromptParser.buildMarkdown(fields);
    el.rawOutput.value = markdown;

    renderPreviewDetail(fields);

    var filename = normalizedFilename();
    var errorMessage = filenameError(filename);
    var filenameOk = filename !== '' && errorMessage === '';

    if (filename !== '' && errorMessage !== '') {
      el.filenameError.textContent = errorMessage;
      el.filenameError.hidden = false;
    } else {
      el.filenameError.hidden = true;
    }

    var ready = fields.title !== '' && fields.category !== '' &&
      fields.description !== '' && fields.prompt.trim() !== '' && filenameOk;

    el.btnDownload.disabled = !ready;

    if (ready) {
      el.manifestHint.hidden = false;
      el.manifestSnippet.textContent = '"' + filename + '"';
    } else {
      el.manifestHint.hidden = true;
    }
  }

  // ---------------------------------------------------------------
  // 新規作成・読み込み
  // ---------------------------------------------------------------
  function resetForm() {
    state.selectedCategory = '';
    state.selectedTags = [];
    state.unknownCategory = '';
    state.unknownTags = [];
    el.title.value = '';
    el.description.value = '';
    el.usage.value = '';
    el.prompt.value = '';
    el.filename.value = '';
    el.loadStatus.textContent = '';
    renderCategoryChips();
    renderTagChips();
    updatePreview();
  }

  function applyParsed(parsed, fileName) {
    var meta = parsed.meta;
    var tags = PromptParser.toArray(meta.tags);
    var category = String(meta.category || '').trim();

    el.title.value = meta.title || '';
    el.description.value = meta.description || '';
    el.usage.value = parsed.usage;
    el.prompt.value = parsed.prompt;

    // 定義済みのカテゴリ・タグはチップで選択状態にする。未定義の値は
    // 消さずに保持し、警告付きの表示にとどめる（追加は管理側の作業とする）。
    if (category !== '' && state.categories.indexOf(category) !== -1) {
      state.selectedCategory = category;
      state.unknownCategory = '';
    } else if (category !== '') {
      state.selectedCategory = '';
      state.unknownCategory = category;
    } else {
      state.selectedCategory = '';
      state.unknownCategory = '';
    }

    var known = [];
    var unknown = [];
    tags.forEach(function (tag) {
      if (state.tags.indexOf(tag) !== -1) known.push(tag); else unknown.push(tag);
    });
    state.selectedTags = known;
    state.unknownTags = unknown;

    if (fileName) el.filename.value = fileName;

    renderCategoryChips();
    renderTagChips();
    updatePreview();
  }

  function loadFile(file) {
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var parsed = PromptParser.parse(String(reader.result));
        applyParsed(parsed, file.name);
        el.loadStatus.textContent = file.name + ' を読み込みました。';
      } catch (e) {
        el.loadStatus.textContent = '読み込みに失敗しました: ' + (e && e.message ? e.message : e);
      }
    };
    reader.onerror = function () {
      el.loadStatus.textContent = 'ファイルの読み込みに失敗しました。';
    };
    reader.readAsText(file, 'UTF-8');
  }

  // ---------------------------------------------------------------
  // 保存（ダウンロードのみ。GitHub / IIS への反映は行わない）
  // ---------------------------------------------------------------
  function downloadMarkdown() {
    var filename = normalizedFilename();
    if (!validateFilename(filename)) return;

    var blob = new Blob([el.rawOutput.value], { type: 'text/markdown;charset=utf-8' });
    var objectUrl = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = objectUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.setTimeout(function () { URL.revokeObjectURL(objectUrl); }, 1000);
  }

  // ---------------------------------------------------------------
  // 初期化
  // ---------------------------------------------------------------
  function bindEvents() {
    el.categoryChips.addEventListener('click', function (event) {
      var removeButton = event.target.closest('[data-remove-unknown-category]');
      if (removeButton) { removeUnknownCategory(); return; }

      var button = event.target.closest('[data-category]');
      if (!button) return;
      toggleCategory(button.dataset.category);
    });

    el.tagChips.addEventListener('click', function (event) {
      var removeButton = event.target.closest('[data-remove-unknown-tag]');
      if (removeButton) { removeUnknownTag(removeButton.dataset.removeUnknownTag); return; }

      var button = event.target.closest('[data-tag]');
      if (!button) return;
      toggleTag(button.dataset.tag);
    });

    ['title', 'description', 'usage', 'prompt', 'filename'].forEach(function (key) {
      el[key].addEventListener('input', updatePreview);
    });

    el.fileInput.addEventListener('change', function () {
      var file = el.fileInput.files && el.fileInput.files[0];
      if (file) loadFile(file);
      el.fileInput.value = '';
    });

    el.btnNew.addEventListener('click', function () {
      if (window.confirm('現在の入力内容を消去して新規作成しますか？')) resetForm();
    });

    el.btnDownload.addEventListener('click', downloadMarkdown);
  }

  function fetchJson(path) {
    return fetch(url(path), { cache: 'no-cache' }).then(function (response) {
      if (!response.ok) throw new Error(path + ' の取得に失敗しました (HTTP ' + response.status + ')');
      return response.json();
    });
  }

  function init() {
    el = {
      categoryChips: document.getElementById('category-chips'),
      categoryWarning: document.getElementById('category-warning'),
      tagChips: document.getElementById('tag-chips'),
      tagWarning: document.getElementById('tag-warning'),
      title: document.getElementById('f-title'),
      description: document.getElementById('f-description'),
      usage: document.getElementById('f-usage'),
      prompt: document.getElementById('f-prompt'),
      filename: document.getElementById('f-filename'),
      filenameError: document.getElementById('filename-error'),
      fileInput: document.getElementById('file-input'),
      btnNew: document.getElementById('btn-new'),
      btnDownload: document.getElementById('btn-download'),
      loadStatus: document.getElementById('load-status'),
      previewDetail: document.getElementById('preview-detail'),
      rawOutput: document.getElementById('raw-output'),
      manifestHint: document.getElementById('manifest-hint'),
      manifestSnippet: document.getElementById('manifest-snippet')
    };

    bindEvents();

    fetchJson('data/tags.json').then(function (defs) {
      state.categories = Array.isArray(defs.categories) ? defs.categories : [];
      state.tags = Array.isArray(defs.tags) ? defs.tags : [];
    }).catch(function (error) {
      el.loadStatus.textContent = 'カテゴリ・タグ定義（data/tags.json）の取得に失敗しました。' +
        'Web サーバ経由で開いているか確認してください。（' + (error.message || error) + '）';
    }).then(function () {
      renderCategoryChips();
      renderTagChips();
      updatePreview();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
