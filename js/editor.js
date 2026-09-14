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

  var OTHER_CATEGORY = '__other__';

  var state = {
    categories: [],
    tags: [],
    selectedCategory: '',
    selectedTags: []
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
    var onOther = state.selectedCategory === OTHER_CATEGORY;
    html += '<button type="button" class="chip chip-category' + (onOther ? ' is-on' : '') +
      '" data-category="' + OTHER_CATEGORY + '" aria-pressed="' + (onOther ? 'true' : 'false') + '">その他（自由入力）</button>';

    el.categoryChips.innerHTML = html;
    el.categoryCustom.hidden = !onOther;
  }

  function renderTagChips() {
    var html = '';
    state.tags.forEach(function (tag) {
      var on = state.selectedTags.indexOf(tag) !== -1;
      html += '<button type="button" class="chip chip-tag' + (on ? ' is-on' : '') +
        '" data-tag="' + esc(tag) + '" aria-pressed="' + (on ? 'true' : 'false') + '">#' + esc(tag) + '</button>';
    });
    el.tagChips.innerHTML = html;
  }

  function toggleCategory(category) {
    state.selectedCategory = state.selectedCategory === category ? '' : category;
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

  function customTags() {
    return el.tagsCustom.value.split(',')
      .map(function (t) { return t.trim(); })
      .filter(function (t) { return t !== ''; });
  }

  function allTags() {
    var seen = {};
    var result = [];
    state.selectedTags.concat(customTags()).forEach(function (tag) {
      if (!seen[tag]) { seen[tag] = true; result.push(tag); }
    });
    return result;
  }

  function currentCategory() {
    if (state.selectedCategory === OTHER_CATEGORY) return el.categoryCustom.value.trim();
    return state.selectedCategory;
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

  function validateFilename(name) {
    return /^[a-z0-9-]+\.md$/.test(name);
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

    var filename = el.filename.value.trim();
    var filenameOk = filename !== '' && validateFilename(filename);

    if (filename !== '' && !filenameOk) {
      el.filenameError.textContent = 'ファイル名は半角英小文字・数字・ハイフンのみで、末尾は「.md」にしてください。';
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
    el.title.value = '';
    el.categoryCustom.value = '';
    el.tagsCustom.value = '';
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

    if (category !== '' && state.categories.indexOf(category) !== -1) {
      state.selectedCategory = category;
      el.categoryCustom.value = '';
    } else if (category !== '') {
      state.selectedCategory = OTHER_CATEGORY;
      el.categoryCustom.value = category;
    } else {
      state.selectedCategory = '';
      el.categoryCustom.value = '';
    }

    var known = [];
    var custom = [];
    tags.forEach(function (tag) {
      if (state.tags.indexOf(tag) !== -1) known.push(tag); else custom.push(tag);
    });
    state.selectedTags = known;
    el.tagsCustom.value = custom.join(', ');

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
    var filename = el.filename.value.trim();
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
      var button = event.target.closest('[data-category]');
      if (!button) return;
      toggleCategory(button.dataset.category);
    });

    el.tagChips.addEventListener('click', function (event) {
      var button = event.target.closest('[data-tag]');
      if (!button) return;
      toggleTag(button.dataset.tag);
    });

    ['title', 'categoryCustom', 'tagsCustom', 'description', 'usage', 'prompt', 'filename'].forEach(function (key) {
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
      categoryCustom: document.getElementById('f-category-custom'),
      tagChips: document.getElementById('tag-chips'),
      tagsCustom: document.getElementById('f-tags-custom'),
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
