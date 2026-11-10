/*!
 * quote-site.js — 打开行情网站（东财 / 同花顺 / 雪球）
 * 仅负责拼 URL + window.open，与 TDX 联动无关
 * 版本: v1.1
 *
 * 用法:
 *   openQuoteSite('600519');                      // 默认东财，自动推断类型
 *   openQuoteSite('000001', { type:'index' });    // 显式指数，避免与平安银行歧义
 *   openQuoteSite('600519', { site:'ths' });      // 同花顺
 *   openQuoteSite('600519', { site:'xueqiu' });   // 雪球
 */
(function (global) {
  'use strict';

  var CFG = global.QuoteSiteConfig || {};
  var DEFAULT_SITE = CFG.defaultSite || 'eastmoney';
  var OPEN_BLANK   = CFG.openBlank !== false;   // 默认新窗口

  // ---------- 工具 ----------
  function normalize(code) {
    if (code == null) return '';
    var s = String(code).trim();
    if (!s) return '';
    var m = s.match(/\d{6}/);   // SZ002950 / SZ.002950 / 002950.SZ → 002950
    return m ? m[0] : '';
  }

  // 按 6 位数字推断类型（仅兜底；指数建议显式传 type:'index'）
  function guessType(code) {
    if (!/^\d{6}$/.test(code)) return 'stock';
    var c0 = code.charAt(0);
    if (c0 === '5' || c0 === '1') return 'etf';
    return 'stock';
  }

  function isBj(code) {
    return code.indexOf('920') === 0 || code.charAt(0) === '4' || code.charAt(0) === '8';
  }

  // ---------- 东财 ----------
  function eastmoneyUrl(code, type) {
    type = type || guessType(code);
    if (type === 'index') return 'https://quote.eastmoney.com/zs' + code + '.html';
    if (type === 'etf')   return 'https://quote.eastmoney.com/' + (code.charAt(0) === '5' ? 'sh' : 'sz') + code + '.html';

    // 北交所：920 开头 / 4 开头 / 8 开头
    if (isBj(code)) return 'https://quote.eastmoney.com/bj/' + code + '.html';
    if (code.charAt(0) === '6') return 'https://quote.eastmoney.com/sh' + code + '.html';
    return 'https://quote.eastmoney.com/sz' + code + '.html';
  }

  // ---------- 同花顺 ----------
  // 个股: stockpage.10jqka.com.cn/{code}/
  // ETF:  fund.10jqka.com.cn/{code}/
  // 指数: 上证 1A0001，科创50 1B0688，其余直接用 6 位代码
  function thsUrl(code, type) {
    type = type || guessType(code);
    if (type === 'etf') return 'https://fund.10jqka.com.cn/' + code + '/';
    if (type === 'index') {
      var map = {
        '000001': '1A0001',   // 上证指数
        '000688': '1B0688'    // 科创50（已确认）
      };
      return 'https://stockpage.10jqka.com.cn/' + (map[code] || code) + '/';
    }
    return 'https://stockpage.10jqka.com.cn/' + code + '/';
  }

  // ---------- 雪球 ----------
  // 个股/ETF: /S/{SH|SZ|BJ}{code}
  // 指数:     399 开头 SZ，其余 SH
  function xueqiuUrl(code, type) {
    type = type || guessType(code);
    if (type === 'index') {
      var mk = (code.charAt(0) === '3') ? 'SZ' : 'SH';
      return 'https://www.xueqiu.com/S/' + mk + code;
    }
    var prefix;
    if (isBj(code)) prefix = 'BJ';
    else if (code.charAt(0) === '6' || code.charAt(0) === '5') prefix = 'SH';
    else prefix = 'SZ';
    return 'https://www.xueqiu.com/S/' + prefix + code;
  }

  // ---------- 站点表 ----------
  var BUILTIN = {
    eastmoney: eastmoneyUrl,
    ths:       thsUrl,
    xueqiu:    xueqiuUrl
  };

  function buildUrl(site, code, type) {
    var fn = BUILTIN[site];
    if (!fn) { console.warn('[quote-site] 未知站点:', site); return ''; }
    return fn(code, type) || '';
  }

  // ---------- 统一入口 ----------
  /**
   * @param {string} code  代码（支持 SZ002950 等格式）
   * @param {object} [opt] { site:'eastmoney'|'ths'|'xueqiu', type:'stock'|'index'|'etf' }
   * @returns {boolean}
   */
  function openQuoteSite(code, opt) {
    opt = opt || {};
    var c = normalize(code);
    if (!c) return false;
    var url = buildUrl(opt.site || DEFAULT_SITE, c, opt.type || guessType(c));
    if (!url) return false;
    if (OPEN_BLANK) global.open(url, '_blank');
    else global.location.href = url;
    return true;
  }

  global.openQuoteSite = openQuoteSite;
  global.QuoteSite = {
    open:     openQuoteSite,
    buildUrl: buildUrl,
    normalize: normalize,
    guessType: guessType,
    sites:    ['eastmoney', 'ths', 'xueqiu']
  };
})(window);
