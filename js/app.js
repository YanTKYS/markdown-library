/*
 * Prompt Library — 一覧・検索・詳細表示
 * ビルド不要。fetch で Markdown を読み、ブラウザ内で検索・絞り込みを行う。
 */
(function () {
  'use strict';

  // ---------------------------------------------------------------
  // 配置場所の解決
  // サブディレクトリ配置（例 /tools/prompt-library/）や末尾スラッシュ無しの
  // URL でも壊れないよう、自身の script src からサイトルートを求める。
  // ---------------------------------------------------------------
  var BASE = new URL('../', document.currentScript.src);
  function url(path) { return new URL(path, BASE).href; }

  var state = {
    prompts: [],
    categories: [],
    tags: [],
    query: '',
    category: '',
    selectedTags: []
  };

  var el = {};

  // ---------------------------------------------------------------
  // 文字列の正規化
  // NFKC で全角英数・半角カナを吸収し、小文字化して比較する。
  // 日本語は単語区切りが無いため、部分一致（includes）で判定する。
  // ---------------------------------------------------------------
  function normalize(text) {
    return String(text == null ? '' : text).normalize('NFKC').toLowerCase();
  }

  function queryTerms(query) {
    var normalized = normalize(query).trim();
    return normalized === '' ? [] : normalized.split(/\s+/);
  }

  // front matter・本文の解析は js/prompt-parser.js（PromptParser）に共通化している。
  // editor.html（作成・編集）と同じロジックを使うことで、仕様のズレを防ぐ。
  function parsePrompt(fileName, text) {
    var parsed = PromptParser.parse(text);
    var meta = parsed.meta;
    var title = meta.title || fileName.replace(/\.md$/i, '');
    var tags = PromptParser.toArray(meta.tags);

    return {
      id: fileName.replace(/\.md$/i, ''),
      file: fileName,
      title: title,
      category: (meta.category || '未分類').trim(),
      tags: tags,
      description: meta.description || '',
      usage: parsed.usage,
      prompt: parsed.prompt,
      hasPromptSection: parsed.hasPromptSection,
      // 検索対象: タイトル / 説明 / カテゴリ / タグ / 本文
      searchText: normalize([title, meta.description || '', meta.category || '', tags.join(' '), parsed.rawBody].join('\n'))
    };
  }

  // ---------------------------------------------------------------
  // 絞り込み
  // ---------------------------------------------------------------
  function matches(prompt, terms, category, tags) {
    if (category && prompt.category !== category) return false;

    for (var i = 0; i < tags.length; i++) {
      if (prompt.tags.indexOf(tags[i]) === -1) return false;
    }
    for (var j = 0; j < terms.length; j++) {
      if (prompt.searchText.indexOf(terms[j]) === -1) return false;
    }
    return true;
  }

  function filtered() {
    var terms = queryTerms(state.query);
    return state.prompts.filter(function (p) {
      return matches(p, terms, state.category, state.selectedTags);
    });
  }

  function countWith(category, tags) {
    var terms = queryTerms(state.query);
    var count = 0;
    state.prompts.forEach(function (p) {
      if (matches(p, terms, category, tags)) count++;
    });
    return count;
  }

  function hasActiveFilter() {
    return state.query.trim() !== '' || state.category !== '' || state.selectedTags.length > 0;
  }

  // ---------------------------------------------------------------
  // 描画
  // ---------------------------------------------------------------
  var esc = MiniMarkdown.escapeHtml;

  function tagChipHtml(tag, extraClass) {
    return '<span class="tag ' + (extraClass || '') + '">#' + esc(tag) + '</span>';
  }

  function renderCategoryFilter() {
    var html = '<button type="button" class="chip chip-category' + (state.category === '' ? ' is-on' : '') +
      '" data-category="" aria-pressed="' + (state.category === '' ? 'true' : 'false') + '">すべて' +
      '<span class="chip-count">' + countWith('', state.selectedTags) + '</span></button>';

    state.categories.forEach(function (category) {
      var count = countWith(category, state.selectedTags);
      var on = state.category === category;
      html += '<button type="button" class="chip chip-category' + (on ? ' is-on' : '') +
        (count === 0 && !on ? ' is-empty' : '') + '" data-category="' + esc(category) +
        '" aria-pressed="' + (on ? 'true' : 'false') + '">' + esc(category) +
        '<span class="chip-count">' + count + '</span></button>';
    });

    el.categoryFilter.innerHTML = html;
  }

  function renderTagFilter() {
    var html = '';
    state.tags.forEach(function (tag) {
      var on = state.selectedTags.indexOf(tag) !== -1;
      var probe = on ? state.selectedTags : state.selectedTags.concat([tag]);
      var count = countWith(state.category, probe);
      html += '<button type="button" class="chip chip-tag' + (on ? ' is-on' : '') +
        (count === 0 && !on ? ' is-empty' : '') + '" data-tag="' + esc(tag) +
        '" aria-pressed="' + (on ? 'true' : 'false') + '">#' + esc(tag) +
        '<span class="chip-count">' + count + '</span></button>';
    });
    el.tagFilter.innerHTML = html;
  }

  function renderActiveFilters() {
    if (!hasActiveFilter()) {
      el.activeFilters.hidden = true;
      el.activeFilters.innerHTML = '';
      return;
    }

    var html = '<span class="active-label">絞り込み中</span>';
    if (state.query.trim() !== '') {
      html += '<button type="button" class="active-item" data-clear="query">キーワード: ' +
        esc(state.query.trim()) + '<span class="active-x" aria-hidden="true">×</span>' +
        '<span class="sr-only">を解除</span></button>';
    }
    if (state.category !== '') {
      html += '<button type="button" class="active-item" data-clear="category">カテゴリ: ' +
        esc(state.category) + '<span class="active-x" aria-hidden="true">×</span>' +
        '<span class="sr-only">を解除</span></button>';
    }
    state.selectedTags.forEach(function (tag) {
      html += '<button type="button" class="active-item" data-clear="tag" data-tag="' + esc(tag) +
        '">#' + esc(tag) + '<span class="active-x" aria-hidden="true">×</span>' +
        '<span class="sr-only">を解除</span></button>';
    });
    html += '<button type="button" class="active-reset" data-clear="all">すべて解除</button>';

    el.activeFilters.innerHTML = html;
    el.activeFilters.hidden = false;
  }

  function renderList() {
    var results = filtered();

    el.count.textContent = hasActiveFilter()
      ? results.length + '件 / 全' + state.prompts.length + '件'
      : '全' + state.prompts.length + '件';

    if (results.length === 0) {
      el.results.innerHTML = '<p class="empty">条件に一致するプロンプトはありません。' +
        '<button type="button" class="link-button" data-clear="all">絞り込みを解除する</button></p>';
      return;
    }

    el.results.innerHTML = results.map(function (p) {
      return '<article class="card">' +
        '<a class="card-main" href="#' + encodeURIComponent(p.id) + '">' +
          '<span class="card-category">' + esc(p.category) + '</span>' +
          '<h3 class="card-title">' + esc(p.title) + '</h3>' +
          '<p class="card-description">' + esc(p.description) + '</p>' +
        '</a>' +
        '<div class="card-footer">' +
          '<div class="card-tags">' + p.tags.map(function (t) {
            return '<button type="button" class="tag tag-button" data-tag="' + esc(t) + '">#' + esc(t) + '</button>';
          }).join('') + '</div>' +
          '<button type="button" class="button button-quiet card-copy" data-copy="' + esc(p.id) + '">コピー</button>' +
        '</div>' +
      '</article>';
    }).join('');
  }

  function renderDetail(prompt) {
    var html = '<a class="back-link" href="#">← 一覧に戻る</a>' +
      '<header class="detail-header">' +
        '<span class="card-category">' + esc(prompt.category) + '</span>' +
        '<h2 class="detail-title">' + esc(prompt.title) + '</h2>' +
        (prompt.description ? '<p class="detail-description">' + esc(prompt.description) + '</p>' : '') +
        (prompt.tags.length
          ? '<div class="detail-tags">' + prompt.tags.map(function (t) {
              return '<button type="button" class="tag tag-button" data-tag="' + esc(t) + '">#' + esc(t) + '</button>';
            }).join('') + '</div>'
          : '') +
      '</header>';

    if (prompt.usage) {
      html += '<section class="detail-section">' +
        '<h3>使い方</h3>' +
        '<div class="prose">' + MiniMarkdown.render(prompt.usage) + '</div>' +
      '</section>';
    }

    html += '<section class="detail-section">' +
      '<div class="prompt-bar">' +
        '<h3>プロンプト</h3>' +
        '<button type="button" class="button button-primary" data-copy="' + esc(prompt.id) + '">プロンプトをコピー</button>' +
      '</div>' +
      (prompt.hasPromptSection ? '' :
        '<p class="notice">この Markdown に「## プロンプト」の見出しがないため、本文全体をコピー対象にしています。</p>') +
      '<pre class="prompt-body">' + esc(prompt.prompt) + '</pre>' +
    '</section>';

    el.detail.innerHTML = html;
  }

  // ---------------------------------------------------------------
  // 画面切り替え（ハッシュで一覧／詳細を切り替える）
  // ---------------------------------------------------------------
  function currentId() {
    var hash = location.hash.replace(/^#/, '');
    if (!hash) return '';
    try { return decodeURIComponent(hash); } catch (e) { return hash; }
  }

  function route() {
    var id = currentId();
    var prompt = id ? findPrompt(id) : null;

    if (prompt) {
      renderDetail(prompt);
      el.listView.hidden = true;
      el.detail.hidden = false;
      document.title = prompt.title + ' | プロンプトライブラリ';
      el.detail.focus({ preventScroll: true });
      window.scrollTo(0, 0);
    } else {
      if (id) location.replace('#');
      el.detail.hidden = true;
      el.detail.innerHTML = '';
      el.listView.hidden = false;
      document.title = 'プロンプトライブラリ';
      refreshList();
    }
  }

  function findPrompt(id) {
    for (var i = 0; i < state.prompts.length; i++) {
      if (state.prompts[i].id === id) return state.prompts[i];
    }
    return null;
  }

  function refreshList() {
    renderCategoryFilter();
    renderTagFilter();
    renderActiveFilters();
    renderList();
  }

  function goToList() {
    // hash の書き換えは同期、hashchange は非同期。待たずにその場で描画する。
    if (location.hash && location.hash !== '#') location.hash = '';
    route();
  }

  // ---------------------------------------------------------------
  // コピー
  // 庁内 IIS は http:// 配信になることがあり、その場合 navigator.clipboard は
  // 使えない（secure context 限定）。旧方式へ確実にフォールバックする。
  // ---------------------------------------------------------------
  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
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
      ok ? resolve() : reject(new Error('copy failed'));
    });
  }

  var copyResetTimer = null;

  function handleCopy(button, id) {
    var prompt = findPrompt(id);
    if (!prompt) return;

    var original = button.dataset.label || button.textContent;
    button.dataset.label = original;
    window.clearTimeout(copyResetTimer);

    copyText(prompt.prompt).then(function () {
      button.textContent = 'コピーしました';
      button.classList.add('is-done');
      el.live.textContent = prompt.title + 'のプロンプトをコピーしました';
    }, function () {
      button.textContent = 'コピーできません';
      el.live.textContent = 'コピーに失敗しました。プロンプト本文を選択して手動でコピーしてください。';
    }).then(function () {
      copyResetTimer = window.setTimeout(function () {
        button.textContent = original;
        button.classList.remove('is-done');
      }, 2000);
    });
  }

  // ---------------------------------------------------------------
  // 操作
  // ---------------------------------------------------------------
  function toggleTag(tag) {
    var index = state.selectedTags.indexOf(tag);
    if (index === -1) {
      state.selectedTags.push(tag);
    } else {
      state.selectedTags.splice(index, 1);
    }
  }

  function bindEvents() {
    el.search.addEventListener('input', function () {
      state.query = el.search.value;
      refreshList();
    });

    el.categoryFilter.addEventListener('click', function (event) {
      var button = event.target.closest('[data-category]');
      if (!button) return;
      state.category = button.dataset.category === state.category ? '' : button.dataset.category;
      refreshList();
    });

    el.tagFilter.addEventListener('click', function (event) {
      var button = event.target.closest('[data-tag]');
      if (!button) return;
      toggleTag(button.dataset.tag);
      refreshList();
    });

    el.activeFilters.addEventListener('click', function (event) {
      var button = event.target.closest('[data-clear]');
      if (!button) return;
      clearFilter(button.dataset.clear, button.dataset.tag);
    });

    // 一覧と詳細に共通する操作（タグ絞り込み・コピー）をまとめて拾う。
    document.addEventListener('click', function (event) {
      var copyButton = event.target.closest('[data-copy]');
      if (copyButton) {
        event.preventDefault();
        handleCopy(copyButton, copyButton.dataset.copy);
        return;
      }

      var clearButton = event.target.closest('.empty [data-clear]');
      if (clearButton) {
        clearFilter(clearButton.dataset.clear, clearButton.dataset.tag);
        return;
      }

      var tagButton = event.target.closest('.tag-button');
      if (tagButton) {
        event.preventDefault();
        if (state.selectedTags.indexOf(tagButton.dataset.tag) === -1) {
          toggleTag(tagButton.dataset.tag);
        }
        goToList();
      }
    });

    window.addEventListener('hashchange', route);

    document.addEventListener('keydown', function (event) {
      var inField = /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName);

      if (event.key === '/' && !inField && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault();
        goToList();
        el.search.focus();
        el.search.select();
        return;
      }

      if (event.key === 'Escape') {
        if (!el.detail.hidden) {
          goToList();
        } else if (hasActiveFilter()) {
          clearFilter('all');
          el.search.focus();
        }
      }
    });
  }

  function clearFilter(kind, tag) {
    if (kind === 'query') {
      state.query = '';
      el.search.value = '';
    } else if (kind === 'category') {
      state.category = '';
    } else if (kind === 'tag' && tag) {
      toggleTag(tag);
    } else if (kind === 'all') {
      state.query = '';
      state.category = '';
      state.selectedTags = [];
      el.search.value = '';
    }
    refreshList();
  }

  // ---------------------------------------------------------------
  // 読み込み
  // ---------------------------------------------------------------
  function fetchText(path) {
    return fetch(url(path), { cache: 'no-cache' }).then(function (response) {
      if (!response.ok) throw new Error(path + ' の取得に失敗しました (HTTP ' + response.status + ')');
      return response.text();
    });
  }

  function fetchJson(path) {
    return fetchText(path).then(function (text) {
      try {
        return JSON.parse(text);
      } catch (e) {
        throw new Error(path + ' の内容が JSON として読み取れません。カンマや括弧の誤りを確認してください。');
      }
    });
  }

  function showError(message) {
    el.status.innerHTML = '<div class="error">' +
      '<p><strong>プロンプトを読み込めませんでした。</strong></p>' +
      '<p>' + esc(message) + '</p>' +
      '<p class="error-hint">index.html をファイルとして直接開いた場合は動作しません。' +
      'IIS などの Web サーバに配置してから開いてください。' +
      'サーバに配置済みで .md が 404 になる場合は、拡張子 .md の MIME 設定を確認してください。</p>' +
      '</div>';
    el.status.hidden = false;
  }

  function collectTags(defined) {
    var seen = {};
    var ordered = [];

    defined.forEach(function (tag) { seen[tag] = true; });
    // 定義済みタグのうち、実際に使われているものだけを表示する。
    defined.forEach(function (tag) {
      if (state.prompts.some(function (p) { return p.tags.indexOf(tag) !== -1; })) ordered.push(tag);
    });
    // tags.json に未登録のタグも取りこぼさず末尾に出す。
    state.prompts.forEach(function (p) {
      p.tags.forEach(function (tag) {
        if (!seen[tag]) { seen[tag] = true; ordered.push(tag); }
      });
    });
    return ordered;
  }

  function collectCategories(defined) {
    var ordered = defined.slice();
    state.prompts.forEach(function (p) {
      if (ordered.indexOf(p.category) === -1) ordered.push(p.category);
    });
    return ordered;
  }

  function init() {
    el = {
      search: document.getElementById('search'),
      categoryFilter: document.getElementById('category-filter'),
      tagFilter: document.getElementById('tag-filter'),
      activeFilters: document.getElementById('active-filters'),
      count: document.getElementById('count'),
      results: document.getElementById('results'),
      listView: document.getElementById('list-view'),
      detail: document.getElementById('detail-view'),
      status: document.getElementById('status'),
      live: document.getElementById('live-region'),
      app: document.getElementById('app')
    };

    Promise.all([fetchJson('data/manifest.json'), fetchJson('data/tags.json')])
      .then(function (results) {
        var manifest = results[0];
        var definitions = results[1] || {};
        var files = Array.isArray(manifest && manifest.prompts) ? manifest.prompts : [];

        if (files.length === 0) {
          throw new Error('data/manifest.json に prompts が1件も登録されていません。');
        }

        return Promise.all(files.map(function (file) {
          return fetchText('prompts/' + file).then(function (text) {
            return parsePrompt(file, text);
          });
        })).then(function (prompts) {
          state.prompts = prompts;
          state.categories = collectCategories(Array.isArray(definitions.categories) ? definitions.categories : []);
          state.tags = collectTags(Array.isArray(definitions.tags) ? definitions.tags : []);
        });
      })
      .then(function () {
        el.status.hidden = true;
        el.app.hidden = false;
        bindEvents();
        route();
      })
      .catch(function (error) {
        showError(error.message || String(error));
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
