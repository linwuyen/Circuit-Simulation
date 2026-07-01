/* foc-quiz.js — 各課共用的小測驗（浮動按鈕 + 彈窗）。
   用法：在課程頁 </body> 前加 <script src="foc-quiz.js"></script><script>FOCQuiz.mount('L1')</script> */
const FOCQuiz = (() => {
  const DB = {
    L0: { q: 'FOC 相對於六步方波控制，最關鍵的好處是？',
      opts: ['電流平滑正弦、磁場連續旋轉 → 扭矩平穩無頓挫', '不需要任何感測器', '開關損耗一定最低', '不用寫程式'],
      correct: 0, explain: 'FOC 讓定子磁場連續旋轉並維持最佳出力角，扭矩漣波極小；六步方波每 60° 跳一格，低速時頓挫、噪音明顯。' },
    L1: { q: '一個在 αβ 平面等速旋轉的向量，投影到兩軸會是什麼？',
      opts: ['兩條相差 90° 的正弦波', '兩條同相位的正弦波', '一條固定的直流', '三條方波'],
      correct: 0, explain: '向量尖端在 α、β 軸的投影分別是 cos 與 sin，自然相差 90°。' },
    L2: { q: '三相平衡（Va+Vb+Vc=0）實際上有幾個獨立自由度？',
      opts: ['3 個', '2 個', '1 個', '無限多'],
      correct: 1, explain: '總和為 0 這個約束少掉一個自由度，所以 3 個數可無損壓成 α、β 兩個。' },
    L2_5: { q: 'SVPWM 的「馬鞍波」占空比是怎麼來的？帶來什麼好處？',
      opts: ['加入共模（≈3 次諧波）注入，線性區多約 15%', '提高開關頻率', '降低死區', '濾掉雜訊'],
      correct: 0, explain: '三相同步加減共模不影響線電壓，卻能壓低每相峰值，把線性極限從 0.5 撐到 0.577。' },
    L3: { q: 'Park 變換能把交流變直流，靠的是什麼？',
      opts: ['把座標系綁在轉子上一起旋轉', '對訊號做低通濾波', '把頻率除以二', '放大振幅'],
      correct: 0, explain: 'Park 不改變向量，只是換到跟轉子同步旋轉的 dq 視角，旋轉量在此視角中就「定住」成直流。' },
    L4: { q: '為什麼 FOC 要先變到 dq 再用 PI 控制？',
      opts: ['PI 對直流可零穩態誤差，對交流會落後又衰減', 'dq 計算比較快', 'dq 不需要感測器', '可以省略 PWM'],
      correct: 0, explain: 'PI 控制器追交流目標必有相位落後與幅值衰減；變成直流後才能精準零誤差追蹤。' },
    L5: { q: '階躍時 dq 軌跡畫出螺旋，代表什麼？',
      opts: ['缺少前饋解耦，d/q 透過 ω·L 交叉耦合', 'ADC 壞了', '轉速量測錯誤', '母線電壓不足'],
      correct: 0, explain: 'q 軸變動經 ω·L 反電動勢踢到 d 軸；加入前饋解耦抵消後，響應就變成直線。' },
    L6: { q: 'αβ 的正圓變成橢圓，最可能的原因是？',
      opts: ['兩相電流感測器 / ADC 增益不對稱', '死區時間', '電壓過調變', '轉子位置誤差'],
      correct: 0, explain: 'α 軸放大、β 軸縮小（或反之）就把圓壓成橢圓；在 dq 表現為 2 倍頻脈動。' },
    L7: { q: 'αβ 圓周出現 6 個規律凹凸（六角星），通常是？',
      opts: ['死區時間畸變（5、7 次諧波）', '增益不對稱', '雜訊', '過調變'],
      correct: 0, explain: '死區在每 60° 注入固定伏秒誤差，6 倍頻徑向漣波 = 靜止系 5、7 次諧波。' },
    L8: { q: 'αβ 的圓退化、貼到六邊形邊界，代表？',
      opts: ['電壓過調變，超過母線線性區', '增益不對稱', '死區', '感測器雜訊'],
      correct: 0, explain: '指令超過六邊形內切圓（|V|>1.0）後只能沿邊走，產生低次諧波，極限是六步方波。' },
    FAULT: { q: 'αβ 軌跡是一個漂亮的正圓，但馬達效率低、同電流發熱大，最可能是？',
      opts: ['轉子位置角 θ 偏移（編碼器未對齊）', 'ADC 增益不對稱', '死區時間', '電壓過調變'],
      correct: 0, explain: 'θ 誤差不會讓 αβ 變形，所以「看 αβ 正常」反而是線索 —— 要改看 dq：Id 不為零、扭矩效率下降。提醒你：不是每個故障都看得出形狀。' }
  };

  function injectCSS() {
    if (document.getElementById('fq-css')) return;
    const s = document.createElement('style'); s.id = 'fq-css';
    s.textContent = `
    .fq-fab{position:fixed;right:18px;bottom:18px;z-index:50;background:linear-gradient(90deg,#7c3aed,#4f46e5);
      color:#fff;border:none;border-radius:999px;padding:11px 18px;font-size:14px;font-weight:700;cursor:pointer;
      box-shadow:0 6px 20px rgba(79,70,229,.45)}
    .fq-fab:hover{filter:brightness(1.1)}
    .fq-ov{position:fixed;inset:0;z-index:60;background:rgba(2,6,23,.72);display:flex;align-items:center;justify-content:center;padding:20px}
    .fq-card{background:#0b1220;border:1px solid #1e293b;border-radius:14px;max-width:440px;width:100%;
      padding:20px;display:flex;flex-direction:column;gap:9px;font-family:Inter,system-ui,sans-serif;color:#e2e8f0;
      box-shadow:0 20px 60px rgba(0,0,0,.6)}
    .fq-q{font-size:15px;font-weight:700;line-height:1.5;margin-bottom:4px}
    .fq-opt{text-align:left;background:#1e293b;border:1px solid #334155;color:#e2e8f0;border-radius:9px;
      padding:11px 13px;font-size:13.5px;cursor:pointer;transition:.12s}
    .fq-opt:hover:not(:disabled){border-color:#10b981}
    .fq-opt.ok{background:#0b3b2e;border-color:#10b981;color:#6ee7b7;font-weight:700}
    .fq-opt.no{background:#3b1212;border-color:#ef4444;color:#fca5a5}
    .fq-opt:disabled{cursor:default}
    .fq-exp{font-size:12.5px;line-height:1.65;color:#94a3b8;background:#0f172a;border:1px solid #1e293b;
      border-radius:8px;padding:10px 12px;margin-top:4px}
    .fq-close{margin-top:6px;align-self:flex-end;background:transparent;border:1px solid #334155;color:#94a3b8;
      border-radius:8px;padding:7px 16px;font-size:13px;cursor:pointer}
    .fq-close:hover{border-color:#10b981;color:#34d399}`;
    document.head.appendChild(s);
  }

  function open(q) {
    const ov = document.createElement('div'); ov.className = 'fq-ov';
    const card = document.createElement('div'); card.className = 'fq-card';
    const h = document.createElement('div'); h.className = 'fq-q'; h.textContent = '🧠 ' + q.q;
    card.appendChild(h);
    const exp = document.createElement('div'); exp.className = 'fq-exp'; exp.style.display = 'none';
    q.opts.forEach((o, i) => {
      const b = document.createElement('button'); b.className = 'fq-opt'; b.textContent = o;
      b.onclick = () => {
        if (card.dataset.done) return; card.dataset.done = '1';
        card.querySelectorAll('.fq-opt').forEach((x, j) => {
          if (j === q.correct) x.classList.add('ok');
          if (j === i && i !== q.correct) x.classList.add('no');
          x.disabled = true;
        });
        exp.style.display = 'block';
        exp.textContent = (i === q.correct ? '✅ 答對了！ ' : '❌ 正解：' + q.opts[q.correct] + '。 ') + q.explain;
      };
      card.appendChild(b);
    });
    card.appendChild(exp);
    const close = document.createElement('button'); close.className = 'fq-close'; close.textContent = '關閉';
    close.onclick = () => ov.remove();
    card.appendChild(close);
    ov.appendChild(card);
    ov.onclick = (e) => { if (e.target === ov) ov.remove(); };
    document.body.appendChild(ov);
  }

  function mount(id) {
    const q = DB[id]; if (!q) return;
    injectCSS();
    const btn = document.createElement('button');
    btn.className = 'fq-fab'; btn.textContent = '🧠 小測驗';
    btn.onclick = () => open(q);
    document.body.appendChild(btn);
  }
  return { mount };
})();
