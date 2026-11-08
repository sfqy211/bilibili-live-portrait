// ==UserScript==
// @name         B站直播间竖屏极简版
// @namespace    local.bilibili.live-portrait-min
// @version      0.1.0
// @description  直播间竖屏自适应重排：窄窗自动切为「信息栏/播放器/礼物栏/观众榜/弹幕区/输入框」纵向布局，宽窗自动还原原版 UI；修复弹幕滚轮与自动跟随、视频黑边、右缘裁切；禁用网页全屏入口
// @author       sfqy211
// @homepageURL  https://github.com/sfqy211/bilibili-live-portrait
// @supportURL   https://github.com/sfqy211/bilibili-live-portrait/issues
// @match        https://live.bilibili.com/*
// @noframes
// @run-at       document-start
// @grant        none
// @license      MIT
// ==/UserScript==

(() => {
  'use strict';
  if (window.__BLP_LOADED__) return;
  window.__BLP_LOADED__ = true;

  const $ = (s) => document.querySelector(s);

  /* ---------- 自适应决策（带迟滞防抖动）----------
     宽高比 ≤ 1（竖屏/窄窗）→ 竖屏布局；> 1（横屏）→ 还原 B 站原版 UI */
  let curRatioOn = null;
  function decide() {
    const r = window.innerWidth / window.innerHeight;
    if (curRatioOn === null) curRatioOn = r <= 1.0;   // 初始判定
    else if (r < 0.95) curRatioOn = true;             // 明显竖屏 → 开
    else if (r > 1.05) curRatioOn = false;            // 明显横屏 → 关
    return curRatioOn;                                // 迟滞带内保持现状
  }

  /* ---------- 样式 ---------- */
  const CSS = `
    /* 视口锁定 */
    html.blp-on, html.blp-on body { height: 100% !important; overflow: hidden !important; }

    /* 极窄窗口：解除 B 站桌面版最小宽度限制 */
    html.blp-on, html.blp-on body, html.blp-on #app {
      min-width: 0 !important; max-width: 100vw !important; overflow-x: hidden !important;
    }
    html.blp-on :is(.app-body, main.app-content, .app-content,
      section.player-and-aside-area, #player-ctnr, .aside-area,
      #live-player-ctnr, .live-player-ctnr) { min-width: 0 !important; }

    /* 隐藏：导航/页脚/背景/悬浮件 */
    html.blp-on :is(
      .link-navbar-ctnr, .z-navbar, .link-footer-ctnr, [class*="room-bg"],
      .aside-area-toggle-btn, #aside-area-toggle-btn,
      [class*="activity-banner"], [class*="announcement"],
      #web-player-aside-bottom-btn-vm, #web-player-aside-top-btn-vm,
      #sidebar-vm, #link-feed-card-popup
    ) { display: none !important; }
    /* 输入框之后的兄弟节点（主播简介/公告/动态面板）隐藏 */
    html.blp-on #chat-control-panel-vm ~ * { display: none !important; }
    /* 布局容器里除 播放器/弹幕侧栏 以外的兄弟节点（TA的动态等异步内容）剔除 */
    html.blp-on section.player-and-aside-area > :not(#player-ctnr):not(.aside-area) { display: none !important; }
    html.blp-on .app-body > :not(section.player-and-aside-area) { display: none !important; }

    /* 主容器：竖向 flex */
    html.blp-on .app-body {
      display: flex !important; flex-direction: column !important;
      width: 100% !important;              /* B 站写死了 980px，必须覆盖 */
      min-width: 0 !important; max-width: 100% !important;
      height: 100dvh !important; max-height: 100dvh !important;
      overflow: hidden !important; min-height: 0 !important;
      padding: 0 !important; margin: 0 !important; background: #000 !important;
    }
    html.blp-on :is(main.app-content, .app-content) { padding: 0 !important; margin: 0 !important; }
    html.blp-on section.player-and-aside-area {
      flex: 1 1 0 !important; min-height: 0 !important;
      display: flex !important; flex-direction: column !important;
      width: 100% !important; max-width: 100% !important;
      position: relative !important; inset: auto !important; background: #000 !important;
      overflow-x: hidden !important;
    }
    /* 兜底：关键区块一律不允许超出容器宽度 */
    html.blp-on section.player-and-aside-area :is(
      #player-ctnr, .head-info-section, #live-player-ctnr, #live-player,
      .live-player-mounter, .aside-area, #rank-list-vm, .chat-history-panel,
      #chat-history-list, #chat-items, #chat-control-panel-vm, .chat-control-panel
    ) {
      min-width: 0 !important; max-width: 100% !important; box-sizing: border-box !important;
    }

    /* 播放器容器：信息栏(自动高) + 视频区(16:9) */
    html.blp-on #player-ctnr {
      flex: 0 0 auto !important;
      width: 100% !important; max-width: 100% !important;
      position: relative !important; inset: auto !important;
      display: flex !important; flex-direction: column !important;
      background: #000 !important; overflow: hidden !important;
    }
    html.blp-on .head-info-section { flex: 0 0 auto !important; width: 100% !important; }
    html.blp-on :is(#live-player-ctnr, .live-player-ctnr) {
      position: relative !important; inset: auto !important;
      width: 100% !important; max-width: 100% !important;
      height: calc(100vw * 9 / 16) !important;
      max-height: calc(100dvh - 300px) !important;
    }
    /* 视频元素锁满容器（赢过 B 站的内联样式，消除黑边） */
    html.blp-on :is(#player-ctnr, #live-player-ctnr) video {
      width: 100% !important; height: 100% !important;
      object-fit: contain !important;
    }
    /* 禁用网页全屏入口按钮 */
    html.blp-on #player-ctnr [class*="web-full"],
    html.blp-on #player-ctnr [class*="web-fullscreen"],
    html.blp-on #player-ctnr [class*="webFull"],
    html.blp-on #player-ctnr [class*="web_full"] { display: none !important; }

    /* 弹幕侧栏：观众榜(自动) + 弹幕区(占满) + 输入栏(置底) */
    html.blp-on .aside-area {
      position: relative !important; inset: auto !important;
      width: 100% !important; max-width: 100% !important; min-width: 0 !important;
      flex: 1 1 0 !important; min-height: 0 !important;
      height: auto !important; max-height: none !important;
      display: flex !important; flex-direction: column !important;
      overflow: hidden !important; background: #18181c !important;
    }
    html.blp-on #rank-list-vm { flex: 0 0 auto !important; width: 100% !important; }
    html.blp-on .aside-area :is(.chat-history-panel, #chat-history-list) {
      flex: 1 1 0 !important; min-height: 0 !important;
      height: auto !important; max-height: none !important;
      display: flex !important; flex-direction: column !important;
      position: relative !important; inset: auto !important;
    }
    html.blp-on #chat-items {
      flex: 1 1 0 !important;
      height: auto !important; max-height: none !important;
      overflow-y: auto !important; overscroll-behavior: contain;
      pointer-events: auto !important;
    }
    html.blp-on .chat-overlay-layer,
    html.blp-on .aside-area [class*="overlay"] { pointer-events: none !important; }
    html.blp-on #chat-control-panel-vm {
      flex: 0 0 auto !important;
      position: relative !important; inset: auto !important;
      width: 100% !important; max-width: 100% !important;
    }
  `;

  let styleTag = null;
  let applied = false;

  /* ---------- 视频尺寸强制（对抗 B 站的高频内联改写）---------- */
  function chainToPlayer(v) {
    const out = [];
    let node = v, guard = 0;
    const top = $('#player-ctnr');
    while (node && node !== top && node !== document.body && guard++ < 10) { out.push(node); node = node.parentElement; }
    return node === top ? out : null;
  }
  function forceVideo() {
    for (const v of document.querySelectorAll('video')) {
      const chain = chainToPlayer(v);
      if (!chain) continue;
      const box = ($('#live-player-ctnr') || $('#player-ctnr')).getBoundingClientRect();
      const r = v.getBoundingClientRect();
      if (Math.abs(r.width - box.width) < 2 && Math.abs(r.height - box.height) < 2) continue;
      for (const n of chain) {
        n.style.setProperty('width', '100%', 'important');
        n.style.setProperty('height', '100%', 'important');
      }
    }
  }
  function watchVideo() {
    if (window.__BLP_MO__ || !$('#player-ctnr')) return;
    const mo = new MutationObserver(() => { requestAnimationFrame(forceVideo); });
    mo.observe($('#player-ctnr'), { subtree: true, attributes: true, attributeFilter: ['style'] });
    window.__BLP_MO__ = mo;
  }

  /* ---------- 弹幕区滚动接管 ----------
     滚轮按"谁可滚谁处理"分发；新消息到达时若在底部附近则自动跟随 */
  function setupChatScroll() {
    const ci = $('#chat-items');
    const list = $('#chat-history-list');
    if (!ci || ci.__blpScroll) return;
    ci.__blpScroll = true;

    const canScroll = (el, deltaY) =>
      el.scrollHeight > el.clientHeight + 2 &&
      (deltaY < 0 ? el.scrollTop > 0 : el.scrollTop + el.clientHeight < el.scrollHeight - 1);

    const zone = list || ci;
    zone.addEventListener('wheel', (e) => {
      if (e.deltaY === 0) return;
      for (let n = e.target; n && n !== zone.parentElement; n = n.parentElement) {
        if ((n === ci || n === list) && canScroll(n, e.deltaY)) {
          e.preventDefault();
          e.stopImmediatePropagation();
          n.scrollTop += e.deltaY;
          return;
        }
      }
    }, { passive: false });

    const stick = new Map();
    const follow = () => {
      for (const el of [ci, list]) {
        if (!el) continue;
        if (!stick.has(el)) stick.set(el, true);
        if (stick.get(el) && el.scrollHeight > el.clientHeight + 2) {
          el.scrollTop = el.scrollHeight;
        }
      }
    };
    for (const el of [ci, list]) {
      if (!el) continue;
      el.addEventListener('scroll', () => {
        stick.set(el, el.scrollHeight - el.scrollTop - el.clientHeight < 60);
      }, { passive: true });
    }
    new MutationObserver(follow).observe(ci, { childList: true, subtree: true });
  }

  /* ---------- 禁用网页全屏（进入会破坏竖屏布局）----------
     双击手势捕获拦截；控制栏按钮常驻监听、一出现立即隐藏 + 点击拦截 */
  function setupBlockWebFull() {
    const pc = $('#player-ctnr');
    if (!pc || pc.__blpNoWebFull) return;
    pc.__blpNoWebFull = true;
    pc.addEventListener('dblclick', (e) => {
      e.preventDefault();
      e.stopPropagation();
    }, true);
    pc.addEventListener('click', (e) => {
      const t = e.target && e.target.closest
        ? e.target.closest('[class*="web-full"],[class*="webFull"],[class*="web_full"]')
        : null;
      if (t) { e.preventDefault(); e.stopPropagation(); }
    }, true);

    const LABEL = /网页全屏|网页模式/;
    const isTarget = (e) => {
      const label = (e.getAttribute && ((e.getAttribute('aria-label') || '') + (e.getAttribute('title') || ''))) || '';
      return LABEL.test(label);
    };
    const hideIn = (root) => {
      if (!root || root.nodeType !== 1) return;
      if (isTarget(root)) root.style.setProperty('display', 'none', 'important');
      for (const e of root.querySelectorAll('[aria-label],[title]')) {
        if (isTarget(e)) e.style.setProperty('display', 'none', 'important');
      }
    };
    const mo = new MutationObserver((muts) => {
      for (const m of muts) {
        for (const n of m.addedNodes) hideIn(n);
        if (m.type === 'attributes' && m.target && isTarget(m.target)) {
          m.target.style.setProperty('display', 'none', 'important');
        }
      }
    });
    mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-label', 'title', 'class'] });
    hideIn(document.body);
  }

  /* ---------- 应用/卸载 ---------- */
  function apply() {
    const on = decide();
    if (on === applied) return;
    const wasApplied = applied;
    applied = on;
    const html = document.documentElement;
    if (on) {
      html.classList.add('blp-on');
      if (!styleTag) {
        styleTag = document.createElement('style');
        styleTag.id = 'blp-style';
        (document.head || document.documentElement).appendChild(styleTag);
      }
      styleTag.textContent = CSS;
      window.dispatchEvent(new Event('resize'));
      setupChatScroll();
      setupBlockWebFull();
      forceVideo();
      watchVideo();
      if (!window.__BLP_VTIMER__) window.__BLP_VTIMER__ = setInterval(forceVideo, 600);
    } else {
      if (window.__BLP_VTIMER__) { clearInterval(window.__BLP_VTIMER__); window.__BLP_VTIMER__ = 0; }
      if (wasApplied === true) {
        applied = false;
        location.reload();   // 竖屏 → 宽屏：整页刷新，完整还原原版 UI
        return;
      }
    }
  }

  /* ---------- 启动 ---------- */
  const t0 = Date.now();
  const timer = setInterval(() => {
    const ready = $('#player-ctnr') && $('#chat-history-list');
    if (ready) { clearInterval(timer); apply(); }
    else if (Date.now() - t0 > 20000) clearInterval(timer);
  }, 250);
  window.addEventListener('resize', () => apply());
  setInterval(() => apply(), 1000);   // 自检兜底（跨显示器移动等不触发 resize 的场景）
  document.addEventListener('visibilitychange', () => { if (!document.hidden) apply(); });
})();
