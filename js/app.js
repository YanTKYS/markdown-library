/*
 * Markdown Library — 一覧・検索・詳細表示
 * ビルド不要。fetch で Markdown を読み、ブラウザ内で検索・絞り込みを行う。
 */
(function () {
  'use strict';

  // ---------------------------------------------------------------
  // 配置場所の解決
  // サブディレクトリ配置（例 /tools/markdown-library/）や末尾スラッシュ無しの
  // URL でも壊れないよう、自身の script src からサイトルートを求める。
  // ---------------------------------------------------------------
  var BASE = new URL('../', document.currentScript.src);
  function url(path) { return new URL(path, BASE).href; }

  var state = {
    entries: [],
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

  // front matter・本文の解析は js/entry-parser.js（EntryParser）に共通化している。
  // editor.html（作成・編集）と同じロジックを使うことで、仕様のズレを防ぐ。
  function parseEntry(fileName, text) {
    var parsed = EntryParser.parse(text);
    var meta = parsed.meta;
    // front matter の値は toText で必ず文字列にそろえる。
    // 値を書き忘れた行（「description:」だけ等）は配列になるため、そのまま使うと表示時に落ちる。
    var title = EntryParser.toText(meta.title) || fileName.replace(/\.md$/i, '');
    var category = EntryParser.toText(meta.category) || '未分類';
    var description = EntryParser.toText(meta.description);
    var tags = EntryParser.toArray(meta.tags);

    return {
      id: fileName.replace(/\.md$/i, ''),
      file: fileName,
      title: title,
      category: category,
      tags: tags,
      description: description,
      // front matter を除いた Markdown 本文。「Markdownをコピー」の対象もこれ。
      body: parsed.body,
      // 検索対象: タイトル / 説明 / カテゴリ / タグ / 本文
      searchText: normalize([title, description, category, tags.join(' '), parsed.body].join('\n'))
    };
  }

  // ---------------------------------------------------------------
  // 絞り込み
  // ---------------------------------------------------------------
  function matches(entry, terms, category, tags) {
    if (category && entry.category !== category) return false;

    for (var i = 0; i < tags.length; i++) {
      if (entry.tags.indexOf(tags[i]) === -1) return false;
    }
    for (var j = 0; j < terms.length; j++) {
      if (entry.searchText.indexOf(terms[j]) === -1) return false;
    }
    return true;
  }

  function filtered() {
    var terms = queryTerms(state.query);
    return state.entries.filter(function (entry) {
      return matches(entry, terms, state.category, state.selectedTags);
    });
  }

  function countWith(category, tags) {
    var terms = queryTerms(state.query);
    var count = 0;
    state.entries.forEach(function (entry) {
      if (matches(entry, terms, category, tags)) count++;
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
      ? results.length + '件 / 全' + state.entries.length + '件'
      : '全' + state.entries.length + '件';

    if (results.length === 0) {
      el.results.innerHTML = '<p class="empty">条件に一致する Markdown はありません。' +
        '<button type="button" class="link-button" data-clear="all">絞り込みを解除する</button></p>';
      return;
    }

    // 一覧は探すことを優先し、コピー操作は詳細画面にまとめる。
    el.results.innerHTML = results.map(function (entry) {
      return '<article class="card">' +
        '<a class="card-main" href="#' + encodeURIComponent(entry.id) + '">' +
          '<span class="card-category">' + esc(entry.category) + '</span>' +
          '<h3 class="card-title">' + esc(entry.title) + '</h3>' +
          '<p class="card-description">' + esc(entry.description) + '</p>' +
        '</a>' +
        (entry.tags.length
          ? '<div class="card-footer"><div class="card-tags">' + entry.tags.map(function (t) {
              return '<button type="button" class="tag tag-button" data-tag="' + esc(t) + '">#' + esc(t) + '</button>';
            }).join('') + '</div></div>'
          : '') +
      '</article>';
    }).join('');
  }

  function renderDetail(entry) {
    var html = '<a class="back-link" href="#">← 一覧に戻る</a>' +
      '<header class="detail-header">' +
        '<span class="card-category">' + esc(entry.category) + '</span>' +
        '<h2 class="detail-title">' + esc(entry.title) + '</h2>' +
        (entry.description ? '<p class="detail-description">' + esc(entry.description) + '</p>' : '') +
        (entry.tags.length
          ? '<div class="detail-tags">' + entry.tags.map(function (t) {
              return '<button type="button" class="tag tag-button" data-tag="' + esc(t) + '">#' + esc(t) + '</button>';
            }).join('') + '</div>'
          : '') +
      '</header>' +
      '<div class="detail-actions">' +
        '<button type="button" class="button button-primary" data-copy-entry="' + esc(entry.id) + '">Markdownをコピー</button>' +
        '<a class="button button-quiet" href="editor.html?file=' + encodeURIComponent(entry.file) + '">このMarkdownを編集</a>' +
        '<p class="detail-actions-note">「Markdownをコピー」は本文全体をコピーします。' +
          '<span class="code-hint" hidden>コードブロックの「コピー」では、そのブロックの内容だけをコピーできます。</span></p>' +
      '</div>' +
      '<div class="markdown-body">' + MiniMarkdown.render(entry.body, { headingOffset: 2 }) + '</div>';

    el.detail.innerHTML = html;
    el.detail.querySelector('.code-hint').hidden = !el.detail.querySelector('.code-block');
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
    var entry = id ? findEntry(id) : null;

    if (entry) {
      renderDetail(entry);
      el.listView.hidden = true;
      el.detail.hidden = false;
      document.title = entry.title + ' | Markdown Library';
      el.detail.focus({ preventScroll: true });
      window.scrollTo(0, 0);
    } else {
      if (id) location.replace('#');
      el.detail.hidden = true;
      el.detail.innerHTML = '';
      el.listView.hidden = false;
      document.title = 'Markdown Library';
      refreshList();
    }
  }

  function findEntry(id) {
    for (var i = 0; i < state.entries.length; i++) {
      if (state.entries[i].id === id) return state.entries[i];
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
  // コピー（処理本体は js/clipboard.js の CopyHelper に共通化している）
  // ---------------------------------------------------------------

  // 詳細画面の「Markdownをコピー」。front matter を除いた本文全体をコピーする。
  function handleEntryCopy(button, id) {
    var entry = findEntry(id);
    if (!entry) return;

    CopyHelper.copyFromButton(button, entry.body).then(function (ok) {
      el.live.textContent = ok
        ? entry.title + 'の Markdown をコピーしました'
        : 'コピーに失敗しました。本文を選択して手動でコピーしてください。';
    });
  }

  // コードブロックごとの「コピー」。フェンスや言語名を除いたコード本文だけをコピーする。
  function handleCodeCopy(button) {
    var code = CopyHelper.codeOfButton(button);
    if (code === null) return;

    CopyHelper.copyFromButton(button, code).then(function (ok) {
      el.live.textContent = ok
        ? 'コードブロックの内容をコピーしました'
        : 'コピーに失敗しました。コードを選択して手動でコピーしてください。';
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
      var entryCopyButton = event.target.closest('[data-copy-entry]');
      if (entryCopyButton) {
        event.preventDefault();
        handleEntryCopy(entryCopyButton, entryCopyButton.dataset.copyEntry);
        return;
      }

      var codeCopyButton = event.target.closest('.code-copy');
      if (codeCopyButton) {
        event.preventDefault();
        handleCodeCopy(codeCopyButton);
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
      '<p><strong>Markdown を読み込めませんでした。</strong></p>' +
      '<p>' + esc(message) + '</p>' +
      '<p class="error-hint">index.html をファイルとして直接開いた場合は動作しません。' +
      'IIS などの Web サーバに配置してから開いてください。' +
      'サーバに配置済みで .md が 404 になる場合は、拡張子 .md の MIME 設定を確認してください。</p>' +
      '</div>';
    el.status.hidden = false;
  }

  function collectTags(defined) {
    var list = Array.isArray(defined) ? defined : [];
    var seen = {};
    var ordered = [];

    list.forEach(function (tag) { seen[tag] = true; });
    // 定義済みタグのうち、実際に使われているものだけを表示する。
    list.forEach(function (tag) {
      if (state.entries.some(function (entry) { return entry.tags.indexOf(tag) !== -1; })) ordered.push(tag);
    });
    // tags.json に未登録のタグも取りこぼさず末尾に出す。
    state.entries.forEach(function (entry) {
      entry.tags.forEach(function (tag) {
        if (!seen[tag]) { seen[tag] = true; ordered.push(tag); }
      });
    });
    return ordered;
  }

  function collectCategories(defined) {
    var ordered = Array.isArray(defined) ? defined.slice() : [];
    state.entries.forEach(function (entry) {
      if (ordered.indexOf(entry.category) === -1) ordered.push(entry.category);
    });
    return ordered;
  }

  /*
   * manifest.json に並んだ Markdown を読み込む。
   * 読めなかったファイルは読み飛ばし、ファイル名だけを返す。
   * （manifest.json への登録漏れやファイル名の打ち間違いで、
   * 　ライブラリ全体が表示できなくなるのを避けるため）
   */
  function loadEntries(files) {
    var failed = [];

    return Promise.all(files.map(function (file) {
      // ファイル名は1つのパスセグメントとしてエンコードする。
      // 「#」を含む名前をそのまま連結すると、URL の断片指定として扱われ取得できない。
      return fetchText('entries/' + encodeURIComponent(file))
        .then(function (text) { return parseEntry(file, text); })
        .catch(function () { failed.push(file); return null; });
    })).then(function (results) {
      return {
        entries: results.filter(function (entry) { return entry !== null; }),
        failed: failed
      };
    });
  }

  // カテゴリ・タグの定義は絞り込みの並び順を決めるだけなので、
  // 読めなくても（JSON の書き間違いなど）一覧の表示は続ける。
  function loadDefinitions() {
    return fetchJson('data/tags.json').catch(function () { return {}; });
  }

  // 読み飛ばしたファイルを知らせる。追加した職員がその場で気づけるようにする。
  function showSkipped(failed) {
    if (failed.length === 0) return;
    el.skipped.textContent = '次のファイルを読み込めませんでした: ' + failed.join('、') +
      '（entries/ フォルダにファイルがあるか、data/manifest.json のファイル名が正しいか確認してください）';
    el.skipped.hidden = false;
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
      skipped: document.getElementById('skipped'),
      live: document.getElementById('live-region'),
      app: document.getElementById('app')
    };

    fetchJson('data/manifest.json')
      .then(function (manifest) {
        var files = Array.isArray(manifest && manifest.entries) ? manifest.entries : [];
        if (files.length === 0) {
          throw new Error('data/manifest.json の entries にファイルが1件も登録されていません。');
        }
        return Promise.all([loadEntries(files), loadDefinitions()]);
      })
      .then(function (results) {
        var loaded = results[0];
        var definitions = results[1];

        if (loaded.entries.length === 0) {
          throw new Error('entries/ フォルダから Markdown を1件も読み込めませんでした。');
        }

        state.entries = loaded.entries;
        state.categories = collectCategories(definitions.categories);
        state.tags = collectTags(definitions.tags);

        el.status.hidden = true;
        el.app.hidden = false;
        showSkipped(loaded.failed);
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
