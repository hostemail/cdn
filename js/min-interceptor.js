// ============================================================
// min-interceptor.js —— 极简请求拦截层（host 模式单一）
//
// 唯一契约：代理 URL = {base}/?url={encodeURIComponent(原始URL)}
//
// 精简版移除 token、自动探测、自动切换、prefix 路由等功能。
// 走不走代理，完全由 configure() 的 hostMode / defaultMode 决定。
//
// 用法：
//   MinInterceptor.configure({
//     base: 'https://your.corsproxy.com',
//     defaultMode: 'proxy',                // 'proxy' | 'direct' | 'auto'
//     hostMode: {
//       'api.a.com': 'proxy',              // 强制走代理
//       'b.com':     'direct',             // 强制直连
//       'c.com':     'auto',               // 显式 auto
//     },
//     debug: false,
//   });
//   MinInterceptor.start();
//
// 手工切换 = 改 hostMode → 刷新页面 → 生效。
//
// 兼容：通达信老 CEF（全 var + function，不用 let/const/箭头）
// ============================================================

(function (global) {
  'use strict';

  var CFG = null;
  var STARTED = false;

  var OrigXHR = global.XMLHttpRequest;
  var origFetch = global.fetch;

  // ============================================================
  // 配置
  // ============================================================

  function configure(opts) {
    opts = opts || {};
    CFG = {
      base: String(opts.base || '').replace(/\/+$/, ''),
      hostMode: normalizeMap(opts.hostMode),
      defaultMode: normalizeMode(opts.defaultMode || 'auto'),
      debug: !!opts.debug,
    };
  }

  function normalizeMode(m) {
    m = String(m || '').toLowerCase();
    if (m === 'proxy' || m === 'direct' || m === 'auto') return m;
    return 'auto';
  }

  function normalizeMap(input) {
    var map = {};
    if (!input) return map;
    if (Array.isArray(input)) {
      for (var i = 0; i < input.length; i++) {
        var h = String(input[i]).trim().toLowerCase();
        if (h) map[h] = 'proxy';
      }
      return map;
    }
    if (typeof input === 'object') {
      for (var k in input) {
        if (input.hasOwnProperty(k)) {
          var key = String(k).trim().toLowerCase();
          if (key) map[key] = normalizeMode(input[k]);
        }
      }
    }
    return map;
  }

  function log() {
    if (CFG && CFG.debug && global.console && console.log) {
      var args = Array.prototype.slice.call(arguments);
      args.unshift('[MinInterceptor]');
      console.log.apply(console, args);
    }
  }

  // ============================================================
  // URL 解析与匹配
  // ============================================================

  function parseHost(url) {
    if (typeof url !== 'string') return '';
    var m = url.match(/^https?:\/\/([^\/\?#]+)/i);
    if (!m) return '';
    var h = m[1].toLowerCase();
    var c = h.indexOf(':');
    return c === -1 ? h : h.substring(0, c);
  }

  // 命中 hostMode 的 key（含子域回退）
  function matchKey(host) {
    if (!CFG || !host) return null;
    if (CFG.hostMode[host] !== undefined) return host;
    var parts = host.split('.');
    for (var i = 1; i < parts.length - 1; i++) {
      var parent = parts.slice(i).join('.');
      if (CFG.hostMode[parent] !== undefined) return parent;
    }
    return null;
  }

  function currentOriginHost() {
    try {
      return global.location ? String(global.location.hostname || '').toLowerCase() : '';
    } catch (e) {
      return '';
    }
  }

  // ============================================================
  // 路由决策
  // ============================================================

  function shouldProxy(url) {
    if (!CFG || !CFG.base) return false;
    if (typeof url !== 'string') return false;
    if (url.indexOf('data:') === 0) return false;
    if (url.indexOf('blob:') === 0) return false;

    var host = parseHost(url);
    if (!host) return false;

    var key = matchKey(host);
    if (key) {
      var mode = CFG.hostMode[key];
      if (mode === 'proxy') return true;
      if (mode === 'direct') return false;
      // 'auto' 落到 defaultMode
    }

    if (CFG.defaultMode === 'proxy') return true;
    if (CFG.defaultMode === 'direct') return false;

    // auto：跨域走代理，同源直连
    return host !== currentOriginHost();
  }

  function rewrite(url) {
    if (typeof url !== 'string') return url;
    if (!shouldProxy(url)) return url;
    return CFG.base + '/?url=' + encodeURIComponent(url);
  }

  // ============================================================
  // JSONP 改写入口
  // ------------------------------------------------------------
  // <script src> 标签不受 XHR/fetch 补丁影响，业务代码构造 JSONP
  // 请求时，直接调用本方法改写 src 即可，无需自己实现判断逻辑。
  //
  // 用法：
  //   var s = document.createElement('script');
  //   s.src = MinInterceptor.jsonpUrl('https://api.a.com/data?cb=fn');
  //   document.head.appendChild(s);
  //
  // 与 rewrite 的关系：内部直接复用 shouldProxy + rewrite，
  // jsonpUrl 只是语义化别名，让调用处一眼看出"这是给 JSONP 用的"。
  // ============================================================

  function jsonpUrl(url) {
    if (typeof url !== 'string') return url;
    if (!shouldProxy(url)) {
      log('jsonp [direct]', url);
      return url;
    }
    var finalUrl = rewrite(url);
    log('jsonp [proxy]', finalUrl);
    return finalUrl;
  }

  // ============================================================
  // 重写 XMLHttpRequest
  // ============================================================

  function PatchedXHR() {
    var xhr = new OrigXHR();
    var _proxied = false;
    var _origUrl = '';
    var _wc = false;

    var origOpen = xhr.open;
    var origSend = xhr.send;

    xhr.open = function (method, url, async, user, pass) {
      _origUrl = url;
      _proxied = shouldProxy(url);
      var finalUrl = _proxied ? rewrite(url) : url;
      var a = (async === undefined) ? true : async;
      log('XHR.open', method, _proxied ? '[proxy]' : '[direct]', finalUrl);
      return origOpen.call(xhr, method, finalUrl, a, user, pass);
    };

    try {
      Object.defineProperty(xhr, 'withCredentials', {
        get: function () { return _proxied ? false : _wc; },
        set: function (v) { _wc = !!v; },
        configurable: true,
      });
    } catch (e) {
      log('withCredentials 拦截失败，降级为不拦截');
    }

    xhr.send = function (body) {
      return origSend.call(xhr, body);
    };

    return xhr;
  }

  PatchedXHR.UNSENT = 0;
  PatchedXHR.OPENED = 1;
  PatchedXHR.HEADERS_RECEIVED = 2;
  PatchedXHR.LOADING = 3;
  PatchedXHR.DONE = 4;

  // ============================================================
  // 重写 fetch
  // ============================================================

  function patchedFetch(input, init) {
    var url = '';
    if (typeof input === 'string') url = input;
    else if (input && input.url) url = input.url;

    if (!shouldProxy(url)) {
      return origFetch.call(global, input, init);
    }

    var finalUrl = rewrite(url);
    init = init || {};
    init.credentials = 'omit';

    log('fetch [proxy]', finalUrl);

    if (typeof input === 'string') {
      return origFetch.call(global, finalUrl, init);
    }
    try {
      return origFetch.call(global, new Request(finalUrl, input), init);
    } catch (e) {
      return origFetch.call(global, finalUrl, init);
    }
  }

  // ============================================================
  // 安装与启动
  // ============================================================

  function install() {
    if (global.XMLHttpRequest !== PatchedXHR) {
      global.XMLHttpRequest = PatchedXHR;
    }
    if (typeof origFetch === 'function' && global.fetch !== patchedFetch) {
      global.fetch = patchedFetch;
    }
  }

  function start() {
    if (STARTED) return;
    STARTED = true;
    install();
    log('installed, base =', CFG && CFG.base, ', defaultMode =', CFG && CFG.defaultMode);
  }

  // ============================================================
  // 对外 API
  // ============================================================

  global.MinInterceptor = {
    configure: configure,
    start: start,
    rewrite: rewrite,
    shouldProxy: shouldProxy,
    isInstalled: function () { return STARTED; },
    jsonpUrl: jsonpUrl,
    _getConfig: function () { return CFG; },
    _parseHost: parseHost,
  };

})(typeof window !== 'undefined' ? window : this);
