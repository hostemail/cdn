/*!
 * tdx-jump.js — 通达信联动切换 K 线 (智能跳转与回调增强版)
 * 
 * 【前端调用与配置指南】
 * 
 * 1. 基础配置（在引入本脚本之前定义）：
 *    <script>
 *      window.TdxJumpConfig = {
 *        showToast: true,     // 可选，默认 true。是否显示底部 UI 提示框
 *        showConsole: false   // 可选，默认 true。是否在浏览器控制台输出调试日志
 *      };
 *    </script>
 *    <script src="tdx-jump.js"></script>
 * 
 * 2. 极简调用（只需传入代码）：
 *    window.jumpTdx('600519'); 
 * 
 * 3. 进阶调用（指定类型、自定义回调覆盖内部逻辑）：
 *    window.jumpTdx('000001', { 
 *      type: 'index',                 // 可选：'stock' | 'index' | 'etf' | 'sector'
 *      onSuccess: function(code) {    // 可选：联动发起成功（无论是否打开通达信都会在此结束）
 *        console.log('成功', code);
 *      },
 *      onError: function(code, err) { // 可选：联动失败（服务未启动/通达信未开等）
 *        console.log('失败', code, err); 
 *      }
 *    });
 * 
 * 4. 探活探测（供业务降级用）：
 *    window.TdxJump.alive(800).then(isAlive => { ... });
 */
(function (global) {
  'use strict';

  var CFG = global.TdxJumpConfig || {};
  var TDX_LINK_BASE = CFG.base || 'http://127.0.0.1:9528'; 
  var TDX_TREEID    = CFG.treeidHost || 'http://www.treeid';
  
  // 默认开启 Toast 和 Console。可在引入前通过 window.TdxJumpConfig 关闭。
  var SHOW_TOAST = CFG.showToast !== false; 
  var SHOW_CONSOLE = CFG.showConsole !== false; 

  var SPECIAL_INDEX = CFG.specialIndex || {
    '000001': { market: '1#', code: '999999' },
    '399001': { market: '0#', code: '399001' },
    '399006': { market: '0#', code: '399006' },
    '000688': { market: '1#', code: '000688' },
    '000016': { market: '1#', code: '000016' },
    '399300': { market: '0#', code: '399300' },
    '399102': { market: '0#', code: '399102' },
    '399106': { market: '0#', code: '399106' },
    '399905': { market: '0#', code: '399905' },
    '399303': { market: '0#', code: '399303' }
  };

  function isTdxEmbedded() {
    var ua = (navigator.userAgent || '').toLowerCase();
    return ua.indexOf('tdx') >= 0 || ua.indexOf('tdxw') >= 0;
  }

  function normalize(code) {
    if (code == null) return '';
    var s = String(code).trim();
    if (!s) return '';
    var m = s.match(/\d{6}/);
    return m ? m[0] : '';
  }

  function treeidUrl(code, type) {
    if (type === 'index') {
      var sp = SPECIAL_INDEX[code];
      if (sp) return TDX_TREEID + '/breed_' + sp.market + sp.code;
      var mkt = (code.charAt(0) === '6' || code.charAt(0) === '9') ? '1#' : '0#';
      return TDX_TREEID + '/breed_' + mkt + code;
    }
    return TDX_TREEID + '/code_' + code;
  }

  // 统一日志与 UI 提示输出
  function _log(msg, isError) {
    if (SHOW_CONSOLE && typeof console !== 'undefined') {
      if (isError) console.warn('[tdx-jump]', msg);
      else console.log('[tdx-jump]', msg);
    }

    if (!SHOW_TOAST || typeof document === 'undefined') return;
    var el = document.getElementById('tdx-jump-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'tdx-jump-toast';
      el.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);padding:8px 16px;border-radius:4px;color:#fff;font-size:14px;z-index:999999;transition:opacity 0.3s;opacity:0;pointer-events:none;box-shadow:0 4px 12px rgba(0,0,0,0.15);';
      document.body.appendChild(el);
    }
    el.style.backgroundColor = isError ? '#ff4d4f' : '#52c41a';
    el.textContent = msg;
    el.style.opacity = '1';
    clearTimeout(el._timer);
    el._timer = setTimeout(function() { el.style.opacity = '0'; }, 2000);
  }

  /**
   * 联动切 K 线核心逻辑
   */
  function jumpTdx(code, opt) {
    opt = opt || {};
    var c = normalize(code);
    if (!c) {
      _log('股票代码格式不正确: ' + code, true);
      if (opt.onError) opt.onError(code, 'Invalid code');
      return false;
    }
    var type = opt.type || 'stock';

    // ① 内嵌浏览器环境：直接走协议跳转
    if (isTdxEmbedded()) {
      global.location.href = treeidUrl(c, type);
      if (opt.onSuccess) opt.onSuccess(c);
      return true;
    }

    // ② 外部浏览器环境：探活 -> 校验通达信 -> 发起跳转
    try {
      var xStatus = new XMLHttpRequest();
      xStatus.open('GET', TDX_LINK_BASE + '/status?t=' + Date.now());
      
      xStatus.onload = function() {
        var isServiceOk = false;
        var isTdxFound = false;
        
        try {
          var statusJson = JSON.parse(xStatus.responseText);
          isServiceOk = (statusJson.ok === true);
          isTdxFound = (statusJson.extra && statusJson.extra.tdxFound === true);
        } catch (e) {
          isServiceOk = (xStatus.status === 200);
        }

        if (!isServiceOk) {
          _log('tdxlink 联动服务未启动', true);
          if (opt.onError) opt.onError(c, 'Service offline');
          return;
        }

        if (!isTdxFound) {
          _log('通达信未运行，请先打开通达信', true);
          if (opt.onError) opt.onError(c, 'TDX not running');
          return;
        }

        executeJump(c, type, opt);
      };

      xStatus.onerror = function () {
        _log('tdxlink 联动服务未启动 (网络错误)', true);
        if (opt.onError) opt.onError(c, 'Network error');
      };

      xStatus.send();
      return true;
    } catch (e) {
      _log('发起联动异常: ' + e.message, true);
      if (opt.onError) opt.onError(c, e.message);
      return false;
    }
  }

  // 发起真正的跳转指令
  function executeJump(c, type, opt) {
    try {
      var xJump = new XMLHttpRequest();
      xJump.open('GET', TDX_LINK_BASE + '/jump?code=' + encodeURIComponent(c));
      
      xJump.onload = function () {
        if (xJump.status === 200) {
           _log('✅ ' + c + ' 跳转成功', false); 
          if (opt.onSuccess) opt.onSuccess(c);
        } else {
          _log('联动失败，通达信返回状态码: ' + xJump.status, true);
          if (opt.onError) opt.onError(c, 'HTTP status ' + xJump.status);
        }
      };
      
      xJump.onerror = function () {
        _log('发送跳转指令失败 (网络错误)', true);
        if (opt.onError) opt.onError(c, 'Network error');
      };
      
      xJump.send();
    } catch (e) {
      _log('发起跳转异常: ' + e.message, true);
      if (opt.onError) opt.onError(c, e.message);
    }
  }

  // 探测本机 tdxlink 服务是否在线
  function tdxlinkAlive(timeoutMs) {
    return new Promise(function (resolve) {
      var done = false;
      var t = setTimeout(function () { if (!done) { done = true; resolve(false); } }, timeoutMs || 800);
      try {
        var x = new XMLHttpRequest();
        x.open('GET', TDX_LINK_BASE + '/status?t=' + Date.now());
        x.onload = function () {
          if (done) return; done = true; clearTimeout(t);
          var ok = false;
          try { ok = (JSON.parse(x.responseText).ok === true); } catch (e) { ok = (x.status === 200); }
          resolve(!!ok);
        };
        x.onerror = function () { if (done) return; done = true; clearTimeout(t); resolve(false); };
        x.send();
      } catch (e) { if (!done) { done = true; clearTimeout(t); resolve(false); } }
    });
  }

  // 导出全局对象
  global.jumpTdx = jumpTdx;
  global.TdxJump = {
    jump: jumpTdx,
    alive: tdxlinkAlive,
    normalize: normalize,
    isTdxEmbedded: isTdxEmbedded,
    SPECIAL_INDEX: SPECIAL_INDEX
  };
})(window);
