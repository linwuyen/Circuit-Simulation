/* =============================================================
   foc-lab.js — 各課共用「落地實作」面板（程式碼 + 真實數值 + 術語）
   用法：</body> 前加 <script src="foc-lab.js"></script><script>FOCLab.mount('L3')</script>
   會在 nav.foot 之前插入一段可折疊的實用層，內容由下方 DB 決定。
   ============================================================= */
const FOCLab = (() => {
  // 每課：code 對應 C 程式碼、real 真實數值情境、terms 術語雙語卡
  const DB = {
    L1: {
      code:
`// 旋轉空間向量：每個控制週期把電氣角推進 ω·Ts
theta += omega * Ts;              // omega [rad/s], Ts 控制週期
if (theta >= 2*PI) theta -= 2*PI;
float v_alpha = V_mag * cosf(theta);   // α 軸投影
float v_beta  = V_mag * sinf(theta);   // β 軸投影`,
      real: [
        ['電氣頻率 f', '60 Hz', 'ω = 2πf ≈ 377 rad/s'],
        ['控制週期 Ts', '100 µs', '= 1 / 10 kHz 電流環'],
        ['一個電氣週期', '16.7 ms', '向量轉一整圈'],
        ['每週期推進角', '≈ 2.16°', 'ω·Ts，越小越平滑'],
      ],
      terms: [
        ['Space Vector', '空間向量', '把三相濃縮成一支旋轉箭頭'],
        ['αβ', '靜止座標', '不旋轉的兩軸參考系'],
        ['θ (theta)', '電氣角', '向量目前指的方向'],
        ['ω (omega)', '電氣角速度', '向量每秒轉多少弧度'],
      ],
    },
    L2: {
      code:
`// Clarke：三相 abc → 兩相 αβ（幅值不變式，假設 ia+ib+ic=0）
float i_alpha = ia;
float i_beta  = (ib - ic) * 0.57735027f;   // 1/√3
// 只量兩相就好：ic = -(ia + ib)，省一顆電流感測器`,
      real: [
        ['ADC 解析度', '12-bit', '0–4095 對應量程'],
        ['電流量程', '±10 A', '中點 2048 = 0 A'],
        ['量測相數', '2 相', '第三相用 a+b+c=0 推得'],
        ['1 LSB', '≈ 4.9 mA', '20 A / 4096'],
      ],
      terms: [
        ['Clarke Transform', 'Clarke 變換', '3 相壓成 2 相'],
        ['abc', '三相座標', '彼此相差 120°'],
        ['αβ', '兩相靜止座標', 'Clarke 的輸出'],
        ['Amplitude invariant', '幅值不變式', '轉換後峰值不變'],
      ],
    },
    L2_5: {
      code:
`// 反 Clarke：αβ → abc
float a = v_alpha;
float b = -0.5f*v_alpha + 0.8660254f*v_beta;   // √3/2
float c = -0.5f*v_alpha - 0.8660254f*v_beta;
// SVPWM 共模注入（馬鞍波）：三相同減中點，線電壓不變、峰值降低
float vmax = fmaxf(a, fmaxf(b, c));
float vmin = fminf(a, fminf(b, c));
float vcom = 0.5f * (vmax + vmin);
float duty_a = (a - vcom) / Vdc + 0.5f;        // 0..1 占空比`,
      real: [
        ['母線電壓 Vdc', '24 V', '占空比基準'],
        ['PWM 計數上限 ARR', '4199', '= 84MHz / 20kHz − 1'],
        ['占空比 → CCR', 'duty × ARR', '寫進比較暫存器'],
        ['線性區增益', '+15.5%', '共模注入換來的'],
      ],
      terms: [
        ['Inverse Clarke', '反 Clarke', 'αβ 變回三相'],
        ['SVPWM', '空間向量 PWM', '共模注入的調變法'],
        ['Common-mode', '共模', '三相一起加減的量'],
        ['Duty cycle', '占空比', '高電位佔週期比例'],
      ],
    },
    L3: {
      code:
`// Park：靜止 αβ → 旋轉 dq（座標鎖在轉子電氣角 theta）
float s = sinf(theta), c = cosf(theta);
float id =  i_alpha*c + i_beta*s;   // 直軸（磁通方向）
float iq = -i_alpha*s + i_beta*c;   // 交軸（扭矩方向）
// id、iq 在穩態是「直流」→ 接下來用 PI 控就超簡單`,
      real: [
        ['theta 來源', '編碼器 / 觀測器', '必須對齊轉子'],
        ['穩態 id', '≈ 0 A', '表面型 PMSM 不需磁通電流'],
        ['穩態 iq', '∝ 扭矩', '想要多少力矩就給多少'],
        ['sin/cos 計算', '查表或 CORDIC', 'MCU 上加速'],
      ],
      terms: [
        ['Park Transform', 'Park 變換', '交流變直流的關鍵'],
        ['dq', '旋轉座標', '跟著轉子一起轉'],
        ['d-axis', '直軸', '對齊轉子磁通'],
        ['q-axis', '交軸', '產生扭矩的方向'],
      ],
    },
    L4: {
      code:
`// q 軸電流 PI 控制器（目標是直流 → 可達零穩態誤差）
float err   = iq_ref - iq;
integ      += err * Ts;                 // 積分項：吃掉殘餘誤差
integ       = clampf(integ, -Imax, Imax);   // 抗積分飽和
float vq    = Kp*err + Ki*integ;        // 輸出電壓命令`,
      real: [
        ['控制目標 iq_ref', '直流值', '不是隨時間變的弦波'],
        ['穩態誤差', '0', '積分項保證歸零'],
        ['頻寬 (電流環)', '~1 kHz', 'Kp、Ki 決定快慢'],
        ['抗飽和', 'clamp 積分', '避免 windup'],
      ],
      terms: [
        ['PI Controller', 'PI 控制器', '比例 + 積分'],
        ['Steady-state error', '穩態誤差', '收斂後剩多少差'],
        ['Reference', '命令值 (ref)', '你要它追的目標'],
        ['Anti-windup', '抗積分飽和', '飽和時凍結積分'],
      ],
    },
    L5: {
      code:
`// 前饋解耦：主動抵消 d、q 之間透過 ω·L 的交叉耦合
float vd = pi_d - omega_e * Lq * iq;                 // 抵消 q→d 的踢
float vq = pi_q + omega_e * (Ld * id + flux_pm);     // 抵消 d→q + 反電動勢
// 加了這兩項，d/q 階躍響應就從「螺旋」變成「直線」`,
      real: [
        ['Ld / Lq', '0.5 / 0.8 mH', '電感，耦合強度來源'],
        ['flux_pm', '0.01 Wb', '永磁磁鏈（反電動勢）'],
        ['電氣轉速 ω_e', '高速大', '轉越快耦合越強'],
        ['解耦效果', 'Vd 擾動↓', '右圖 Vd 幾乎不動'],
      ],
      terms: [
        ['Cross-coupling', '交叉耦合', 'd、q 互相干擾'],
        ['Feedforward', '前饋', '預先算好補上去'],
        ['Back-EMF', '反電動勢', '轉子轉動感應的電壓'],
        ['Decoupling', '解耦', '讓兩軸各走各的'],
      ],
    },
    L6: {
      code:
`// 兩相電流先做「偏置 + 增益」校正，再進 Clarke
ia = (adc_a - offset_a) * gain_a;   // gain_a、gain_b 必須一致
ib = (adc_b - offset_b) * gain_b;
// 若 gain_a != gain_b → αβ 圓被壓成橢圓（dq 出現 2 倍頻脈動）`,
      real: [
        ['offset 來源', '上電零電流取樣', '扣掉直流偏置'],
        ['gain 來源', '出廠 / 自我校正', '兩相要校到一致'],
        ['增益失配 1%', '→ 橢圓', '肉眼可見的形變'],
        ['dq 症狀', '2× 電頻脈動', '頻譜可確認'],
      ],
      terms: [
        ['Gain mismatch', '增益失配', '兩相放大倍率不同'],
        ['Calibration', '校正', '量測係數補回來'],
        ['Offset', '偏置', '零點不在零'],
        ['2nd harmonic', '二倍頻', '失配的特徵頻率'],
      ],
    },
    L7: {
      code:
`// 死區補償：依電流方向，前饋補回上下臂死區損失的伏秒
float v_dt = (Tdead / Tpwm) * Vdc;        // 死區造成的等效壓降
v_a += (ia > 0.0f) ? +v_dt : -v_dt;        // 電流流出 → 補正，反之補負
v_b += (ib > 0.0f) ? +v_dt : -v_dt;
v_c += (ic > 0.0f) ? +v_dt : -v_dt;`,
      real: [
        ['死區 Tdead', '0.5–2 µs', '防上下臂直通'],
        ['PWM 週期 Tpwm', '50 µs', '= 1 / 20 kHz'],
        ['等效壓降', 'Tdead/Tpwm·Vdc', '低速時最明顯'],
        ['頻譜特徵', '5、7 次諧波', '靜止系；旋轉系 6×'],
      ],
      terms: [
        ['Dead-time', '死區時間', '上下臂同時關的空檔'],
        ['Shoot-through', '直通', '要避免的短路'],
        ['Vsat', '飽和壓降', '開關元件導通壓降'],
        ['5th/7th harmonic', '5/7 次諧波', '死區的指紋'],
      ],
    },
    L8: {
      code:
`// 限幅：電壓命令超過六邊形內切圓就縮回，避免過調變失真
float vmax = Vdc * 0.57735027f;            // 內切圓半徑 = Vdc/√3
float mag  = hypotf(v_alpha, v_beta);
if (mag > vmax) {                          // 超出線性區
  v_alpha *= vmax / mag;                   // 等比例縮回邊界
  v_beta  *= vmax / mag;
}`,
      real: [
        ['母線 Vdc', '24 V', '電壓天花板'],
        ['線性區相電壓峰值', '≈ 13.9 V', 'Vdc / √3'],
        ['調變比 m', '> 1 → 過調變', 'm=1 是線性極限'],
        ['解法', '弱磁 / 升母線', '降 iq 或提 Vdc'],
      ],
      terms: [
        ['Overmodulation', '過調變', '超過線性區'],
        ['Modulation index', '調變比', '命令 / 可用電壓'],
        ['Field weakening', '弱磁', '高速時降磁通'],
        ['Six-step', '六步方波', '過調變的極限'],
      ],
    },
  };

  function injectCSS() {
    if (document.getElementById('fl-css')) return;
    const s = document.createElement('style'); s.id = 'fl-css';
    s.textContent = `
    .foclab{margin:0 22px 20px;border:1px solid var(--line);border-radius:12px;overflow:hidden;
      background:rgba(15,23,42,.45)}
    .fl-head{display:flex;align-items:center;justify-content:space-between;gap:10px;cursor:pointer;
      padding:13px 16px;background:rgba(15,23,42,.7);user-select:none}
    .fl-head .t{font-size:13px;font-weight:800;color:var(--emer2);letter-spacing:.5px}
    .fl-head .t small{display:block;font-weight:500;color:var(--mut);letter-spacing:0;margin-top:2px;font-size:11px}
    .fl-head .car{color:var(--mut);font-size:13px;transition:.2s}
    .foclab.col .fl-body{display:none}
    .foclab.col .fl-head .car{transform:rotate(-90deg)}
    .fl-body{padding:16px;display:grid;grid-template-columns:1.3fr 1fr;gap:16px}
    @media(max-width:760px){.fl-body{grid-template-columns:1fr}}
    .fl-block h4{margin:0 0 8px;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:var(--mut)}
    .fl-code{position:relative;background:#0a1120;border:1px solid var(--line);border-radius:9px;
      padding:12px 13px;overflow:auto}
    .fl-code pre{margin:0;font-family:ui-monospace,'Cascadia Mono',Consolas,monospace;font-size:12px;
      line-height:1.6;color:#cbd5e1;white-space:pre}
    .fl-code .cm{color:#5b7a8c;font-style:italic}
    .fl-copy{position:absolute;top:8px;right:8px;font-size:11px;padding:4px 9px;border-radius:6px;
      border:1px solid var(--line);background:#1e293b;color:var(--mut)}
    .fl-copy:hover{border-color:var(--emer);color:var(--emer2)}
    .fl-right{display:flex;flex-direction:column;gap:14px}
    .fl-real{display:flex;flex-direction:column;gap:6px}
    .fl-real .r{display:grid;grid-template-columns:auto 1fr;gap:8px;align-items:baseline;
      background:#0b1220;border:1px solid var(--line);border-radius:7px;padding:7px 10px}
    .fl-real .r .lab{font-size:12px;color:var(--mut)}
    .fl-real .r .val{font-family:'Share Tech Mono',monospace;color:var(--emer2);font-size:12.5px;font-weight:700;text-align:right}
    .fl-real .r .nt{grid-column:1/3;font-size:11px;color:var(--dim);line-height:1.4}
    .fl-terms{display:grid;grid-template-columns:1fr 1fr;gap:7px}
    @media(max-width:760px){.fl-terms{grid-template-columns:1fr}}
    .fl-term{background:#0b1220;border:1px solid var(--line);border-radius:7px;padding:7px 9px}
    .fl-term .ab{font-size:12.5px;font-weight:800;color:var(--cyan)}
    .fl-term .zh{font-size:12px;color:var(--ink);margin:1px 0}
    .fl-term .de{font-size:11px;color:var(--dim);line-height:1.4}
    .fl-foot{grid-column:1/-1;font-size:11.5px;color:var(--dim);border-top:1px solid var(--line);padding-top:10px}
    .fl-foot a{color:var(--emer2);text-decoration:none}.fl-foot a:hover{text-decoration:underline}`;
    document.head.appendChild(s);
  }

  const esc = (s) => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const hl = (code) => esc(code).split('\n')
    .map(l => l.replace(/(\/\/.*)$/, '<span class="cm">$1</span>')).join('\n');

  function mount(id) {
    const d = DB[id]; if (!d) return;
    injectCSS();
    const sec = document.createElement('section');
    sec.className = 'foclab';
    const realRows = d.real.map(r =>
      `<div class="r"><span class="lab">${r[0]}</span><span class="val">${r[1]}</span>${r[2]?`<span class="nt">${r[2]}</span>`:''}</div>`).join('');
    const termCards = d.terms.map(t =>
      `<div class="fl-term"><div class="ab">${t[0]}</div><div class="zh">${t[1]}</div><div class="de">${t[2]}</div></div>`).join('');
    sec.innerHTML = `
      <div class="fl-head"><div class="t">🔧 落地實作 <small>把這頁的數學橋到硬體：程式碼 · 真實數值 · 術語</small></div><span class="car">▾</span></div>
      <div class="fl-body">
        <div class="fl-block">
          <h4>① 對應 C 程式碼</h4>
          <div class="fl-code"><button class="fl-copy">複製</button><pre><code>${hl(d.code)}</code></pre></div>
        </div>
        <div class="fl-right">
          <div class="fl-block"><h4>② 真實數值情境</h4><div class="fl-real">${realRows}</div></div>
          <div class="fl-block"><h4>③ 術語雙語卡</h4><div class="fl-terms">${termCards}</div></div>
        </div>
        <div class="fl-foot">看不懂某個詞？ → <a href="glossary.html">完整詞彙表</a></div>
      </div>`;
    const foot = document.querySelector('nav.foot');
    foot ? foot.parentNode.insertBefore(sec, foot) : document.body.appendChild(sec);

    sec.querySelector('.fl-head').onclick = () => sec.classList.toggle('col');
    const cp = sec.querySelector('.fl-copy');
    cp.onclick = (e) => { e.stopPropagation();
      navigator.clipboard?.writeText(d.code).then(() => { cp.textContent = '已複製 ✓';
        setTimeout(() => cp.textContent = '複製', 1400); }); };
  }
  return { mount };
})();
