(function(root){
  "use strict";
  const raw=root.CircuitCurriculum;
  if(!raw||!Array.isArray(raw.modules))throw new Error("Control transform module requires CircuitCurriculum");
  if(raw.modules.some(m=>m&&m.id==="control-transforms"))return;
  raw.modules.push({
    id:"control-transforms",number:"16",tag:"Transforms",title:"Fourier / Laplace / Z 變換橋接",entry:"16_control_transforms/index.html",
    oneLine:"把 Fourier、Laplace、Z、pole/zero、Bode、delay、PI 與 SFRA 串成同一條數位控制因果鏈。",
    analogy:"不是學三種不同魔法，而是把同一個動態系統換到不同座標系：連續時間看 s-plane，取樣後看 z-plane，頻率響應則沿特殊邊界觀察。",
    whyUseful:"能直接解釋數位電源為什麼會因 sample/PWM delay 掉 phase margin、PI 參數如何移動 zero，以及 SFRA 為何能驗證模型。",
    lessons:[
      ["index.html#transform-family","三種變換其實是一家人","先建立 Fourier ⊂ Laplace、DTFT ⊂ Z-transform 的關係。","沿著公式 s=jω、z=e^(sTs)、|z|=1 追一次。","能說出 Fourier axis 與 unit circle 分別代表什麼。"],
      ["index.html#pole-map","s-plane ↔ z-plane pole mapping","把穩定規則 Re(s)<0 與 |z|<1 連成同一條公式。","拖 σ、ω、Ts，看 pole 與時間響應同步移動。","知道 unit circle 不是背出來的，而是 z=e^(sTs) 的結果。"],
      ["index.html#delay-lab","ADC / ISR / PWM delay 的 phase lag","理解延遲幾乎不改 magnitude，卻會吃掉 phase margin。","改 crossover 與總 delay，量化 −360fTd。","能在實機 loop 不穩時先估 timing 造成的 phase loss。"],
      ["index.html#pi-bode","PI 其實是 integrator pole + zero","把 Kp/Ki 改寫成 pole-zero placement。","改 Kp/Ki，看 zero frequency 與 Bode 同步移動。","不再把 PI 調參當 trial-and-error。"],
      ["index.html#sfra-chain","SFRA = 實機量測 T(jω)","把理論 model 與實機 frequency response 接起來。","播放 sweep，觀察高頻模型偏差。","模型與實測不符時，會優先查 delay/filter/plant mismatch。"],
      ["index.html#control-chain","G(s) → G(jω) → G(z) → C code","把整套控制理論收斂成可實作流程。","逐步播放完整因果鏈。","能從微分方程一路追到 C2000 ISR 與 SFRA verification。"]
    ],
    labs:[
      ["transform-pole-map","把一顆連續 pole 映射到 z-plane","16_control_transforms/index.html#pole-map","選一組 σ、ω、Ts，驗證 Re(s)<0 時 |z|<1，並把 σ 拉到 0 看 unit circle。","能用 z=e^(sTs) 解釋穩定區域映射。","建立連續控制與數位控制共同的穩定語言。"],
      ["transform-delay","估算 10 kHz crossover 的數位延遲代價","16_control_transforms/index.html#delay-lab","設定 fc=10kHz、Td=10µs，確認 phase lag 約 −36°，再改 Td 看裕度。","算式與畫面一致，並能指出何時 delay 已成主要風險。","直接對應 ADC→ISR→PWM timing closure。"],
      ["transform-pi-zero","用 Kp/Ki 移動 PI zero","16_control_transforms/index.html#pi-bode","固定 Kp 或 Ki，掃另一個參數，觀察 fz=Ki/(2πKp) 與 Bode 變化。","能預測 zero 左移或右移對 phase boost 出現位置的影響。","把 PI tuning 升級成 loop shaping。"]
    ],
    faults:[
      ["理論 phase margin 很高，實機卻容易震盪","模型漏掉 ADC/ISR/PWM commit、ZOH 或濾波延遲。","先算 −360fTd，再用 SFRA 比較實測與模型 phase。","把量到的 delay/pole 納入模型，或降低 crossover/縮短 latency。","16_control_transforms/index.html#delay-lab"],
      ["只會靠試誤調 Kp/Ki","沒有把 PI 改寫成 integrator pole + zero。","算 ωz=Ki/Kp，並看 zero 是否放在想補 phase 的頻帶。","先定 crossover/phase 目標，再配置 pole/zero。","16_control_transforms/index.html#pi-bode"],
      ["把 Fourier、Laplace、Z 當成三套互不相干公式","沒有建立 s=jω 與 z=e^(sTs) 的邊界關係。","把 σ 調到 0，觀察 s-plane jω 軸如何映到 z-plane unit circle。","用 pole mapping 與時間響應一起驗證，不死背定義。","16_control_transforms/index.html#pole-map"]
    ]
  });
})(window);
