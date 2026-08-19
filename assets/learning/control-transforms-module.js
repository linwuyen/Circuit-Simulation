(function(root){
  "use strict";
  const raw=root.CircuitCurriculum;
  if(!raw||!Array.isArray(raw.modules))throw new Error("Control transform module requires CircuitCurriculum");
  if(raw.modules.some(m=>m&&m.id==="control-transforms"))return;
  raw.modules.push({
    id:"control-transforms",number:"16",tag:"Transforms",title:"Fourier / Laplace / Z 變換橋接",entry:"16_control_transforms/index.html",
    oneLine:"用白話直覺、動畫、公式與 C2000 實機，把 Fourier、Laplace、Z、pole/zero、Bode、delay、PI 與 SFRA 串成同一條因果鏈。",
    analogy:"同一台機器用三種鏡頭看：Laplace 看它天生怎麼動，Fourier 拿不同頻率去敲它，Z 則看 MCU 每一拍之間怎麼演化。",
    whyUseful:"不再把 PI/PID、數位濾波器、ADC/PWM delay、SFRA 當分離章節；能從 pole/zero、loop gain、phase margin 一路追到 C2000 timing 與實機量測。",
    lessons:[
      ["index.html#mental-model","三種變換到底各自在問什麼","先用白話建立 Laplace=自然動態、Fourier=頻率響應、Z=每拍動態。","先不算公式，讀三張概念卡並用一句話重述差別。","能不用背定義就說出三者用途。"],
      ["index.html#pole-map","s-plane ↔ z-plane：穩定為什麼是同一件事","從時間波形看衰減/成長，再用 z=e^(sTs) 連到 unit circle。","按穩定/臨界/不穩定 preset，再拖 σ、ω、Ts。","能解釋 Re(s)<0 ⇔ |z|<1，而不是死背規則。"],
      ["index.html#delay-lab","ADC / ISR / PWM delay 為什麼會吃 phase","先把 10 µs 想成波形一圈的幾分之幾，再推到 −360fTd。","改 crossover 與總 delay，看 phase lag、delay/週期比例同步變。","能從 ePWM SOC 一路指出 PWM 真正生效前的 latency。"],
      ["index.html#pi-bode","PI 為什麼其實是一顆 pole 加一顆 zero","從 Kp/Ki 的白話角色，推到 ωz=Ki/Kp，再落成 difference equation。","改 Kp/Ki，看 zero frequency、Bode 與低/高頻主導區同步變。","不再 trial-and-error 調參，而會問 zero 該放哪。"],
      ["index.html#sfra-chain","SFRA 怎麼拿來找模型漏掉的東西","把 model-vs-measurement 差異轉成 delay/filter/plant mismatch 的診斷線索。","播放 sweep，再讀四種 mismatch pattern。","看到理論 PM 與實測不同時知道先查什麼。"],
      ["index.html#control-chain","從微分方程一路到 C2000 與 SFRA","把 G(s)→G(jω)→補償器→離散化→差分方程→ISR→實測串成一條工作流。","逐步播放 8 層因果鏈，再做三題 self-check。","能把數學模型、韌體實作與實機驗證放在同一張圖裡。"]
    ],
    labs:[
      ["transform-pole-map","驗證 s-plane pole 到 z-plane 的精確映射","16_control_transforms/index.html","調整 σ、ω、Ts，讓頁面顯示的 |z| 與獨立解析式 exp(σTs) 一致，並驗證 Re(s) 與 unit circle 的穩定對應。","頁面輸出與 independent oracle 一致，且能解釋 Re(s)<0 ⇔ |z|<1。","建立連續控制與離散控制共同的穩定語言。"]
    ],
    faults:[
      ["理論 phase margin 很高，實機卻容易震盪","模型漏掉 ADC/ISR/PWM commit、ZOH 或濾波延遲。","先算 −360fTd，再用 SFRA 比較實測與模型 phase。","量 GPIO timing、確認 PWM load event，把 delay/pole 納入模型，或降低 crossover。","16_control_transforms/index.html#delay-lab"],
      ["只會靠試誤調 Kp/Ki","沒有把 PI 改寫成 integrator pole + zero。","算 ωz=Ki/Kp，並看 zero 是否放在想補 phase 的頻帶。","先定 plant、crossover、phase 目標，再配置 pole/zero。","16_control_transforms/index.html#pi-bode"],
      ["把 Fourier、Laplace、Z 當成三套互不相干公式","沒有建立自然動態、頻率響應、取樣後每拍動態的共同模型。","先看時間波形，再把 σ 拉到 0，觀察 jω 軸如何映到 unit circle。","用現象→公式→實機的順序理解，不從積分定義硬背。","16_control_transforms/index.html#mental-model"]
    ]
  });
})(window);
