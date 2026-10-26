(function () {
  'use strict';

  const data = window.COMPANION_DATA;
  const app = document.getElementById('app');
  const live = document.getElementById('view-status');
  const state = {
    view: 'entry', stationId: null, panel: null, previousView: null, lang: 'en',
    menu: false, comparing: false, panelTrigger: null
  };
  let currentHash = '';
  let hold = null;
  let ignoreClick = null;
  let announcementTimer;
  const escape = value => String(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[character]));
  const t = key => data.ui[state.lang][key] || data.ui.en[key] || key;
  const english = value => `<span lang="en">${escape(value)}</span>`;
  const stationHash = id => `#/station/${id}`;

  function parse(hash) {
    if (hash === '#/') return { view: 'entry', stationId: null };
    if (hash === '#/compare') return { view: 'compare', stationId: null };
    if (hash === '#/linear') return { view: 'linear', stationId: null };
    const match = /^#\/(station|source)\/(message|body|delivery|reopen)$/.exec(hash);
    return match ? { view: match[1], stationId: match[2] } : null;
  }

  function announce(text) {
    clearTimeout(announcementTimer);
    live.textContent = '';
    announcementTimer = setTimeout(() => { live.textContent = text; }, 30);
  }

  function navigate(hash) {
    if (!parse(hash)) hash = '#/';
    if (hash === currentHash) return;
    history.pushState({ companion: true, hash, from: currentHash }, '', hash);
    syncRoute();
  }

  function syncRoute() {
    let hash = location.hash;
    if (!parse(hash)) {
      hash = '#/';
      history.replaceState({ companion: true, hash, from: null }, '', hash);
    }
    if (currentHash === hash) return;
    if (!history.state || !history.state.companion || history.state.hash !== hash) {
      history.replaceState({ companion: true, hash, from: currentHash || null }, '', hash);
    }
    currentHash = hash;
    Object.assign(state, parse(hash), { panel: null, menu: false, comparing: false, panelTrigger: null });
    hold = null;
    ignoreClick = null;
    const from = history.state.from;
    state.previousView = from && parse(from) && parse(from).view !== 'source' ? from : stationHash(state.stationId || 'message');
    render();
    const heading = document.getElementById('view-title');
    heading.focus({ preventScroll: true });
    window.scrollTo(0, 0);
    document.title = `${heading.textContent} · ${data.ui.en['app.title']}`;
    announce(heading.textContent);
  }

  function progress(number) {
    return `<footer class="progress" aria-label="${escape(t('common.progress'))}">
      <span class="progress-dots" aria-hidden="true">${data.route.map((_, index) => `<span class="dot ${index + 1 === Number(number) ? 'current' : ''}"></span>`).join('')}</span>
      <span>${number} / 04</span>
    </footer>`;
  }

  function masthead(source = false) {
    return `<header class="masthead"><p class="eyebrow">${escape(t('app.kicker'))}</p>${source ?
      `<nav class="languages" aria-label="${escape(t('common.language'))}">
        <button class="lang-button" data-language="en" lang="en" aria-pressed="${state.lang === 'en'}">EN</button>
        <button class="lang-button" data-language="zh" lang="zh-Hans" aria-pressed="${state.lang === 'zh'}">中文</button>
      </nav>` : '<span class="seal" lang="zh-Hans" aria-hidden="true">双鲤</span>'}</header>`;
  }

  function routeList() {
    return `<ol class="route-list">${data.route.map(id => {
      const station = data.stations[id];
      return `<li><a class="route-row" href="${stationHash(id)}"><span class="route-number">${station.number}</span>
        <span><span class="route-name" lang="en">${escape(station.routeName)}</span><span class="route-title" lang="en">${escape(station.title)}</span></span>
        <span class="route-arrow" aria-hidden="true">→</span></a></li>`;
    }).join('')}</ol>`;
  }

  function renderEntry() {
    return `<article class="view entry">${masthead()}
      <h1 id="view-title" tabindex="-1" lang="en">${escape(t('entry.title'))}</h1>
      <p class="intro" lang="en">${escape(t('entry.subtitle'))}</p>
      <nav id="route-overview" aria-label="${escape(t('common.menu'))}" ${state.menu ? 'hidden' : ''}>${routeList()}</nav>
      <section id="station-list" class="station-picker panel" ${state.menu ? '' : 'hidden'} aria-labelledby="picker-heading">
        <div class="panel-head"><h2 id="picker-heading">${escape(t('common.menu'))}</h2><button class="button" data-action="close-menu">${escape(t('common.close'))}</button></div>
        <nav aria-label="${escape(t('common.menu'))}">${routeList()}</nav>
      </section>
      <div class="actions"><a class="button primary" href="#/station/message">${escape(t('entry.follow'))}</a>
        <button class="button" data-action="menu" aria-expanded="${state.menu}" aria-controls="station-list">${escape(t('entry.choose'))}</button></div>
      <a class="text-link" href="#/linear">${escape(t('entry.linear'))}</a>
      ${progress('01')}
    </article>`;
  }

  function record(station) {
    return `<dl class="record">${Object.entries(station.source).map(([key, value]) =>
      `<div><dt>${escape(data.fieldLabels[state.lang][key])}</dt><dd lang="en">${escape(value)}</dd></div>`).join('')}</dl>`;
  }

  function renderStation(id) {
    const station = data.stations[id];
    const nextHash = station.next === 'compare' ? '#/compare' : stationHash(station.next);
    const nextTitle = station.next === 'compare' ? t('compare.title') : data.stations[station.next].title;
    return `<article class="view station">${masthead()}
      <p class="eyebrow" lang="en">${escape(station.eyebrow)}</p>
      <h1 id="view-title" tabindex="-1" lang="en">${escape(station.title)}</h1>
      <figure class="plate"><img src="${station.image}" alt="${escape(station.alt)}" lang="en" width="960" height="600">
        <div class="image-fallback" hidden></div><figcaption lang="en">${escape(station.caption)}</figcaption></figure>
      <p class="summary" lang="en">${escape(station.summary)}</p>
      <section class="label-copy" lang="en"><h2>${escape(station.labelTitle)}</h2><p>${escape(station.labelBody)}</p></section>
      <div class="actions"><button class="button disclosure" data-action="omission" aria-expanded="${state.panel === 'omission'}" aria-controls="omission-panel">${escape(t('station.omission'))}</button></div>
      <div id="omission-panel" class="panel" ${state.panel === 'omission' ? '' : 'hidden'}><p lang="en">${escape(station.omission)}</p></div>
      <a class="button" href="#/source/${id}">${escape(t('station.source'))}</a>
      <nav class="bottom-nav" aria-label="${escape(t('common.menu'))}">
        <a class="text-link route-back" href="#/">${escape(t('station.back'))}</a>
        ${station.prev ? `<a class="button" href="${stationHash(station.prev)}">${escape(t('station.prev_prefix'))} ${english(data.stations[station.prev].title)}</a>` : ''}
        <a class="button primary" href="${nextHash}">${escape(t('station.next_prefix'))} ${english(nextTitle)}</a>
      </nav>${progress(station.number)}
    </article>`;
  }

  function renderCompare() {
    return `<article class="view compare">${masthead()}
      <p class="eyebrow">${escape(t('compare.kicker'))}</p>
      <h1 id="view-title" tabindex="-1" lang="en">${escape(t('compare.title'))}</h1>
      <div class="compare-cards">${['confident', 'accountable'].map(key => `<button class="compare-card ${key}" data-card="${key}" aria-pressed="false" aria-describedby="compare-state"><span class="card-name" lang="en">${escape(t(`compare.${key}`))}</span><span class="card-text" lang="en">${escape(data.labels[key])}</span></button>`).join('')}</div>
      <p class="compare-note" lang="en">${escape(data.labels.bottomLine)}</p>
      <p class="compare-hint">${escape(t('compare.hint'))}</p>
      <button class="button" data-action="compare" aria-pressed="false">${escape(t('compare.toggle'))}</button>
      <output id="compare-state" class="compare-status" aria-live="polite">${escape(t('compare.inactive'))}</output>
      <a class="button primary" href="#/source/reopen">${escape(t('compare.source'))}</a>
      <nav class="bottom-nav"><a class="text-link" href="#/">${escape(t('compare.back'))}</a><a class="text-link" href="#/linear">${escape(t('entry.linear'))}</a></nav>
      ${progress('04')}
    </article>`;
  }

  function renderSource(id) {
    const station = data.stations[id];
    return `<article class="view source">${masthead(true)}
      <p class="eyebrow">${escape(t('source.kicker'))} / <span lang="en">${escape(station.id)}</span></p>
      <h1 id="view-title" tabindex="-1">${escape(t('source.title'))}</h1>
      <p class="object-title" lang="en">${station.number} / ${escape(station.title)}</p>
      ${record(station)}<p lang="en">${escape(t('source.body'))}</p>
      <div class="actions">
        <button class="button" data-action="audio-text" aria-expanded="${state.panel === 'transcript'}" aria-controls="transcript-panel">${escape(t('source.listen'))}</button>
        <button class="button disclosure" data-action="transcript" aria-expanded="${state.panel === 'transcript'}" aria-controls="transcript-panel">${escape(t('source.transcript'))}</button>
      </div>
      <section id="transcript-panel" class="panel" ${state.panel === 'transcript' ? '' : 'hidden'} aria-label="${escape(t('source.transcript'))}">
        <h2 lang="en">${escape(station.labelTitle)}</h2><p lang="en">${escape(station.labelBody)}</p>
        <h3>${escape(t('station.omission'))}</h3><p lang="en">${escape(station.omission)}</p>
        <button class="text-link" data-action="close-transcript">${escape(t('common.close'))}</button>
      </section>
      <a class="button" href="#/linear">${escape(t('source.plain'))}</a>
      <nav class="bottom-nav"><a class="text-link" href="${escape(state.previousView)}" data-action="source-back">${escape(t('source.back'))}</a></nav>
      ${progress(station.number)}
    </article>`;
  }

  function renderLinear() {
    return `<article class="view linear">${masthead()}
      <h1 id="view-title" tabindex="-1">${escape(t('linear.title'))}</h1>
      <a class="text-link" href="#/">${escape(t('linear.back'))}</a>
      <h2 class="linear-title" lang="en">${escape(t('entry.title'))}</h2>
      <p lang="en">${escape(t('app.subtitle'))}</p>
      ${data.route.map(id => {
        const station = data.stations[id];
        return `<section class="linear-station" id="linear-${id}"><p class="eyebrow" lang="en">${station.number} / ${escape(station.routeName)}</p>
          <h2 lang="en">${escape(station.title)}</h2><p lang="en">${escape(station.summary)}</p>
          <h3 lang="en">${escape(station.labelTitle)}</h3><p lang="en">${escape(station.labelBody)}</p>
          <p lang="en">${escape(station.alt)}</p><p lang="en">${escape(station.caption)}</p>
          <h3>${escape(t('station.omission'))}</h3><p lang="en">${escape(station.omission)}</p>
          <h3>${escape(t('station.source'))}</h3>${record(station)}</section>`;
      }).join('')}
      <section class="linear-counter"><p class="eyebrow">${escape(t('compare.kicker'))}</p><h2 lang="en">${escape(t('compare.title'))}</h2>
        <h3 lang="en">${escape(t('compare.confident'))}</h3><p lang="en">${escape(data.labels.confident)}</p>
        <h3 lang="en">${escape(t('compare.accountable'))}</h3><p lang="en">${escape(data.labels.accountable)}</p><p lang="en">${escape(data.labels.bottomLine)}</p>
        <p lang="en">${escape(t('source.body'))}</p>
      </section><a class="text-link" href="#/">${escape(t('linear.back'))}</a>
    </article>`;
  }

  function render() {
    document.documentElement.lang = state.lang === 'zh' ? 'zh-Hans' : 'en';
    document.querySelector('.skip-link').textContent = t('common.skip');
    app.className = ['source', 'linear'].includes(state.view) ? 'light' : '';
    const views = { entry: renderEntry, station: renderStation, compare: renderCompare, source: renderSource, linear: renderLinear };
    app.innerHTML = views[state.view](state.stationId);
    // Error can fire before insertion for a previously failed cached image.
    app.querySelectorAll('img').forEach(img => { if (img.complete && !img.naturalWidth) imageFallback(img); });
  }

  function imageFallback(img) {
    const fallback = img.nextElementSibling;
    if (!fallback || !fallback.classList.contains('image-fallback')) return;
    img.hidden = true;
    fallback.hidden = false;
    fallback.lang = 'en';
    fallback.textContent = img.alt;
  }

  function setMenu(open) {
    state.menu = open;
    document.getElementById('station-list').hidden = !open;
    document.getElementById('route-overview').hidden = open;
    const trigger = app.querySelector('[data-action="menu"]');
    trigger.setAttribute('aria-expanded', String(open));
    (open ? app.querySelector('#station-list .route-row') : trigger).focus();
  }

  function setPanel(panel, open, trigger) {
    state.panel = open ? panel : null;
    if (trigger) state.panelTrigger = trigger;
    document.getElementById(`${panel}-panel`).hidden = !open;
    app.querySelectorAll(`[aria-controls="${panel}-panel"]`).forEach(button => button.setAttribute('aria-expanded', String(open)));
  }

  function closePanel() {
    const panel = state.panel;
    if (!panel) return;
    setPanel(panel, false);
    const trigger = app.querySelector(`[data-action="${state.panelTrigger || panel}"]`);
    if (trigger) trigger.focus();
  }

  function sourceBack() {
    if (history.state && history.state.from === state.previousView) history.back();
    else navigate(state.previousView);
  }

  function showComparison() {
    if (state.view !== 'compare') return;
    const active = state.comparing || Boolean(hold);
    app.querySelectorAll('[data-card]').forEach(card => {
      card.classList.toggle('is-highlighted', hold ? card.dataset.card !== hold.card : state.comparing);
      card.setAttribute('aria-pressed', String(state.comparing));
    });
    app.querySelector('[data-action="compare"]').setAttribute('aria-pressed', String(state.comparing));
    document.getElementById('compare-state').textContent = t(active ? 'compare.active' : 'compare.inactive');
  }

  function endHold(event, cancelled = false) {
    if (!hold || (event && event.pointerId !== undefined && event.pointerId !== hold.pointerId)) return;
    if (cancelled || performance.now() - hold.started >= 350) ignoreClick = { card: hold.card, until: performance.now() + 800 };
    hold = null;
    showComparison();
  }

  app.addEventListener('click', event => {
    const control = event.target.closest('a, button');
    if (!control || !app.contains(control)) return;
    if (control.dataset.language) {
      state.lang = control.dataset.language;
      render();
      app.querySelector(`[data-language="${state.lang}"]`).focus();
      document.title = `${document.getElementById('view-title').textContent} · ${data.ui.en['app.title']}`;
      announce(t('common.language'));
      return;
    }
    if (control.dataset.card) {
      if (ignoreClick && ignoreClick.card === control.dataset.card && performance.now() < ignoreClick.until && event.detail !== 0) { ignoreClick = null; return; }
      ignoreClick = null;
      state.comparing = !state.comparing;
      showComparison();
      return;
    }
    switch (control.dataset.action) {
      case 'menu': setMenu(!state.menu); return;
      case 'close-menu': setMenu(false); return;
      case 'omission': setPanel('omission', state.panel !== 'omission', 'omission'); return;
      case 'transcript': setPanel('transcript', state.panel !== 'transcript', 'transcript'); return;
      case 'audio-text': setPanel('transcript', true, 'audio-text'); return;
      case 'close-transcript': closePanel(); return;
      case 'source-back': event.preventDefault(); sourceBack(); return;
      case 'compare': state.comparing = !state.comparing; showComparison(); return;
      default: break;
    }
    if (control.tagName === 'A' && control.getAttribute('href').startsWith('#/') && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
      event.preventDefault();
      navigate(control.getAttribute('href'));
    }
  });

  app.addEventListener('pointerdown', event => {
    const card = event.target.closest('[data-card]');
    if (!card || event.button !== 0 || event.isPrimary === false) return;
    ignoreClick = null;
    hold = { card: card.dataset.card, pointerId: event.pointerId, started: performance.now() };
    showComparison();
  });
  app.addEventListener('pointerout', event => {
    const card = event.target.closest('[data-card]');
    if (card && !card.contains(event.relatedTarget)) endHold(event, true);
  });
  app.addEventListener('pointerleave', event => {
    if (event.target.matches('[data-card]')) endHold(event, true);
  }, true);
  window.addEventListener('pointerup', event => endHold(event));
  window.addEventListener('pointercancel', event => endHold(event, true));
  window.addEventListener('blur', () => endHold(null, true));
  document.addEventListener('visibilitychange', () => { if (document.hidden) endHold(null, true); });
  app.addEventListener('error', event => { if (event.target.tagName === 'IMG') imageFallback(event.target); }, true);

  document.querySelector('.skip-link').addEventListener('click', event => {
    event.preventDefault();
    document.getElementById('view-title').focus();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      if (state.panel) { event.preventDefault(); closePanel(); }
      else if (state.menu) { event.preventDefault(); setMenu(false); }
      else if (state.view === 'source') { event.preventDefault(); sourceBack(); }
      else if (state.view === 'compare' && (state.comparing || hold)) { state.comparing = false; hold = null; showComparison(); }
      return;
    }
    const row = event.target.closest('.route-row');
    if (!row) return;
    if (event.key === ' ') { event.preventDefault(); row.click(); return; }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const rows = [...row.closest('nav').querySelectorAll('.route-row')];
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      rows[(rows.indexOf(row) + direction + rows.length) % rows.length].focus();
    }
  });
  window.addEventListener('popstate', syncRoute);
  window.addEventListener('hashchange', syncRoute);
  syncRoute();
}());
