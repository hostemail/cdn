/**
 * SmartRefresh v2.7 - 全站智能刷新控制引擎
 */
window.SmartRefresh = (function() {
  let currentMode = 'smart';   
  let fixedInterval = 15;      
  let countdown = 0;           
  let timer = null;            
  let isRefreshing = false;    
  let userCallback = null;     
  let uiStyle = 'full';
  
  // ★ 优化2：允许外部覆盖默认的智能频率策略
  let customIntervals = null;

  let ui = { container: null, select: null, text: null, btn: null, dot: null };

  // ================== 核心策略 ==================
  function getSmartInterval() {
    const now = new Date();
    const day = now.getDay();
    const t = now.getHours() * 60 + now.getMinutes();

    if (day === 0 || day === 6) return 0;    
    if (t < 555) return 0;                   
    if (t >= 555 && t <= 565) return customIntervals?.auction ?? 3;      
    if (t > 565 && t < 570) return customIntervals?.auction ?? 3;        
    if (t >= 570 && t <= 690) return customIntervals?.trading ?? 3;      
    if (t > 690 && t < 780) return customIntervals?.lunch ?? 60;       
    if (t >= 780 && t <= 900) return customIntervals?.trading ?? 3;      
    if (t > 900 && t <= 930) return customIntervals?.postTrade ?? 15;      
    return 0;                                
  }

  function getPhaseName() {
    const now = new Date();
    const day = now.getDay();
    const t = now.getHours() * 60 + now.getMinutes();

    if (day === 0 || day === 6) return '休市';
    if (t < 555) return '盘前';
    if (t >= 555 && t <= 565) return '集合竞价';
    if (t > 565 && t < 570) return '过渡期';
    if (t >= 570 && t <= 690) return '盘中';
    if (t > 690 && t < 780) return '午休';
    if (t >= 780 && t <= 900) return '盘中';
    if (t > 900 && t <= 930) return '盘后固定交易';
    return '已收盘'; 
  }

  function getCurrentInterval() {
    if (currentMode === 'manual') return 0;
    if (currentMode === 'fixed') return fixedInterval;
    return getSmartInterval();
  }

  // ================== 心跳与执行 ==================
  function tick() {
    if (document.hidden) return; 
    if (currentMode === 'manual') return; 
    if (isRefreshing) return; // ★ 优化4：如果在刷新中，暂停倒计时

    if (currentMode === 'smart') {
      const expected = getSmartInterval();
      if (expected === 0) {
        countdown = 0;
        updateUI();
        return;
      }
      if (countdown > expected) {
        countdown = expected;
        updateUI();
      }
    }

    if (countdown <= 0) {
      if (getCurrentInterval() > 0) {
        triggerRefresh();
      }
    } else {
      countdown--;
      updateUI();
    }
  }

  async function triggerRefresh() {
    if (isRefreshing) return;
    isRefreshing = true;
    
    // 刷新中状态反馈
    updateUI(); 

    try {
      if (userCallback) await userCallback();
    } catch (e) {
      console.error('[SmartRefresh]', e);
    } finally {
      isRefreshing = false;
      countdown = getCurrentInterval();
      updateUI();
    }
  }

  // ================== UI 更新 ==================
  function updateUI() {
    if (!ui.container) return;

    if (ui.dot) {
      if (currentMode === 'manual') ui.dot.style.background = '#6f9eff';
      else if (currentMode === 'fixed') ui.dot.style.background = '#5cc8ff';
      else {
        const base = getSmartInterval();
        if (base === 3) ui.dot.style.background = '#22e07a';
        else if (base === 60) ui.dot.style.background = '#ffaa33';
        else if (base === 0) ui.dot.style.background = '#555555';
        else ui.dot.style.background = '#888888';
      }
    }

    if (ui.select) {
      if (currentMode === 'smart') ui.select.value = 'smart';
      else if (currentMode === 'manual') ui.select.value = 'manual';
      else ui.select.value = String(fixedInterval);
    }

    if (ui.btn) {
      ui.btn.style.display = currentMode === 'manual' ? 'inline-flex' : 'none';
      // 同步按钮旋转
      const icon = ui.btn.querySelector('.sr-icon');
      if (icon) {
        if (isRefreshing) icon.classList.add('spinning');
        else icon.classList.remove('spinning');
      }
      ui.btn.style.opacity = isRefreshing ? '0.6' : '1';
    }

    if (ui.text) {
      if (currentMode === 'manual') {
        ui.text.style.display = 'none';
      } else {
        ui.text.style.display = 'inline-block';
        
        // ★ 优化4：如果在刷新中，显示明确的提示
        if (isRefreshing) {
          ui.text.innerText = '⟳ 刷新中...';
          return;
        }

        const currentTargetSec = getCurrentInterval();
        let timeStr = '';
        
        if (currentTargetSec === 0) {
          timeStr = '停止刷新';
        } else if (countdown === currentTargetSec && countdown <= 60) {
          timeStr = `${countdown}s 后刷新`;
        } else if (countdown > 60) {
          if (countdown % 60 === 0) timeStr = `${countdown / 60}分钟`;
          else timeStr = `${Math.floor(countdown / 60)}分${countdown % 60}秒`;
        } else {
          timeStr = `${countdown}s 后刷新`;
        }

        let phaseHint = '';
        if (currentMode === 'smart') {
          const phase = getPhaseName();
          if (phase === '盘中') phaseHint = '⚡盘中 ';
          else if (phase === '午休') phaseHint = '☕午休 ';
          else if (phase === '集合竞价') phaseHint = '🚀竞价 ';
          else if (phase === '过渡期') phaseHint = '⏳过渡 ';
          else if (phase === '盘前') phaseHint = '🕘盘前 ';
          else if (phase === '盘后固定交易') phaseHint = '⏳盘后 ';
          else if (phase === '已收盘') phaseHint = '🌙已收盘 ';
          else if (phase === '休市') phaseHint = '🏖️休市 ';
        }
        
        ui.text.innerText = `${phaseHint}(${timeStr})`;
      }
    }
  }

  // ================== UI 渲染 ==================
  function renderUI(containerId) {
    const el = document.getElementById(containerId);
    if (!el) return;
    ui.container = el;

    if (uiStyle === 'none') {
      el.style.display = 'none';
      return;
    }

    if (uiStyle === 'mini') {
      el.innerHTML = `
        <div style="display:flex; align-items:center; gap:6px; font-size:12px; cursor:pointer;" title="点击立即刷新">
          <div class="sr-dot" style="width:8px; height:8px; border-radius:50%; box-shadow:0 0 6px currentColor; animation: sr-pulse 2s infinite;"></div>
          <span class="sr-text" style="font-family:monospace; color:#8890b5;"></span>
        </div>
        <style>
          @keyframes sr-pulse { 0% { opacity: 1; } 50% { opacity: 0.3; } 100% { opacity: 1; } }
        </style>
      `;
      ui.dot = el.querySelector('.sr-dot');
      ui.text = el.querySelector('.sr-text');
      el.addEventListener('click', () => triggerRefresh());
    } else {
      el.innerHTML = `
        <style>
          @keyframes sr-spin { to { transform: rotate(360deg); } }
          .sr-btn .sr-icon.spinning { animation: sr-spin 0.7s linear infinite; display: inline-block; }
        </style>
        <div style="display:flex; align-items:center; justify-content:flex-end; gap:6px; font-size:12px; color:#8890b5; margin-left:auto;">
          <select class="sr-select" style="background:#141c36; color:#e0e0e5; border:1px solid #243156; border-radius:4px; padding:2px 4px; outline:none; cursor:pointer;">
            <option value="smart" selected>智能刷新</option>
            <option value="3">每 3 秒</option>
            <option value="5">每 5 秒</option>
            <option value="15">每 15 秒</option>
            <option value="30">每 30 秒</option>
            <option value="60">每 60 秒</option>
            <option value="manual">手工刷新</option>
          </select>
          <span class="sr-text" style="font-family:monospace; font-weight:bold; color:#ffd740; white-space:nowrap;"></span>
          <button class="sr-btn" style="display:none; align-items:center; gap:4px; background:#ffd740; color:#111530; border:none; border-radius:4px; padding:3px 10px; font-size:12px; font-weight:bold; cursor:pointer;">
            <span class="sr-icon" style="display:inline-block;">⟳</span> 刷新
          </button>
        </div>
      `;
      ui.select = el.querySelector('.sr-select');
      ui.text = el.querySelector('.sr-text');
      ui.btn = el.querySelector('.sr-btn');
      
      if (ui.select) {
        ui.select.addEventListener('change', (e) => {
          const val = e.target.value;
          if (val === 'smart') currentMode = 'smart';
          else if (val === 'manual') currentMode = 'manual';
          else { currentMode = 'fixed'; fixedInterval = parseInt(val, 10); }
          countdown = getCurrentInterval();
          updateUI();
        });
      }
      if (ui.btn) ui.btn.addEventListener('click', triggerRefresh);
    }
  }

  // ================== API ==================
  return {
    init: function(options) {
      userCallback = options.onRefresh;
      uiStyle = options.uiStyle || 'full'; 
      // ★ 暴露配置入口
      customIntervals = options.smartIntervals || null;
      
      if (options.elementId) {
        renderUI(options.elementId);
      }
      
      currentMode = 'smart';
      countdown = getCurrentInterval();
      updateUI();
      
      if (timer) clearInterval(timer);
      timer = setInterval(tick, 1000);

      // ★ 优化1：监听页面从后台切回前台
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden && currentMode !== 'manual') {
          const expected = getCurrentInterval();
          // 如果处于活跃时段，并且剩余时间小于一次刷新间隔（说明在后台待了很久），直接刷新
          if (expected > 0 && countdown < expected) {
            triggerRefresh();
          }
        }
      });
    },
    getMode: () => currentMode,
    manualRefresh: () => triggerRefresh(),
    destroy: () => {
      if (timer) clearInterval(timer);
      if (ui.container) ui.container.innerHTML = '';
    }
  };
})();
