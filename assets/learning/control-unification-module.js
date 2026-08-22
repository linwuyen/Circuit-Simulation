(function(root){
  "use strict";
  const raw=root.CircuitCurriculum;
  if(!raw||!Array.isArray(raw.modules))throw new Error("Control unification module requires CircuitCurriculum");
  if(raw.modules.some(m=>m&&m.id==="control-unification"))return;
  raw.modules.push({
    id:"control-unification",number:"18",tag:"Control Unifier",title:"Universal Control Loop · 16→17 Bridge",entry:"18_control_unification/index.html",
    oneLine:"把 Module 16 的 Laplace/Bode/Z/delay/SFRA，套到 Module 17 的 Buck、Boost、PFC、PSFB、LLC、Inverter，並用 Engineering Workbench 收斂成 operating point→plant→controller→timing→measurement→evidence 的可驗證閉環。",
    analogy:"16 是控制世界的文法，17 是六種不同個性的 power plant；18 像翻譯器，把每一種新拓撲先翻成相同的 reference、controller、actuator、plant、sensor、feedback 問題。",
    whyUseful:"遇到新 topology 不再從『要用哪組 PI』開始，而會先定義 u/y、建立 P(s)、找 pole/zero 與 bandwidth boundary，再處理 sampling/delay、C2000 actuator semantics、controller coefficients 與 SFRA correlation。",
    lessons:[
      ["engineering-workbench.html","Digital Power Engineering Workbench：model → code → evidence","把 plant、PI/2P2Z、ZOH/delay、C2000 cycle timing、operating envelope、SFRA/CSV correlation、robustness 與 model contract 放進同一個工程閉環。","從 Module 18 頁面直接進 Workbench；先設計 loop，再故意 miss PWM load，最後匯入 synthetic measurement 驗證 correlation/evidence gate。","能從數學模型一路追到數位控制、韌體時序與量測證據，而不是只看單一動畫或公式。"],
      ["index.html#universal-loop","Universal Loop Mapper：六種電源先抽象成同一條 feedback loop","用 r、e、C(z)、u、P(s)、y、H 描述所有 topology，再看真正會換的是 actuator、plant、sensor 與 operating point。","切 Buck/Boost/PFC/PSFB/LLC/Inverter，逐一說出 u、y、P(s) personality。","能把陌生 power stage 先翻譯成同一套控制語言，而不是先找 Kp/Ki。"],
      ["index.html#five-lenses","用 Module 16 的五副鏡頭看 Module 17 的 plant","對同一個 topology 依序問 Laplace、Bode、Z、C2000 timing、SFRA 五層問題。","切 topology 後再切五個 lens，觀察問題如何保持相同但答案隨 plant 改變。","能區分『共同方法』與『不同 plant 答案』。"],
      ["index.html#same-not-same","Same skeleton ≠ same PI","明確分開 feedback grammar 與 power-stage personality。","讀六種 topology matrix，比較 duty、phase shift、switching frequency、modulation 與 nested loops。","不會把『同一套控制理論』誤解成『同一組 PI 參數』。"],
      ["index.html#delay-budget","Digital phase budget：把 Td 直接放進 crossover","用 −360·fc·Td 算 pure delay 在 crossover 的相位成本，再與無 pure-delay 時的 PM 比較。","調 fc、Td、Ts、base PM，觀察 phase loss、Td/Ts 與剩餘 margin。","能把 ADC→ISR→PWM latency 量化成 phase budget，而不是只說『有延遲』。"],
      ["index.html#c2000-path","同一個 C2000 control skeleton，不同 actuator semantics","把 ADC→error→C(z)→command→PWM commit→plant 固定下來，只替換 duty/phase/frequency/modulation 的 commit 行為。","切換 topology，看 sensor/controller/actuator/power-stage timeline 同步改變。","能把控制演算法與硬體 actuator API 分層。"],
      ["index.html#debug-router","SFRA 症狀 → 下一個最有資訊量的量測","從 phase-only mismatch、early roll-off、resonance、operating-point drift、PFC THD 反推最可能漏掉的 dynamics。","切五種症狀，先決定 suspect 與 measurement，再考慮調 controller。","建立 evidence-first debug 順序。"],
      ["index.html#new-topology","把方法遷移到 DAB / Totem-Pole / Bidirectional Buck-Boost","遇到沒學過的 topology，固定問 u、y、P(s)、pole/zero、bandwidth、digital timing、verification。","切三個陌生 topology，練習先定義 control problem。","證明學到的是可遷移的控制框架，不是背六種既有答案。"]
    ],
    labs:[
      ["unified-delay-budget","驗證 pure delay 在 crossover 的 phase cost","18_control_unification/index.html#delay-budget","設定 crossover fc 與 measured effective delay Td，讓頁面顯示的 delay phase loss 與獨立解析式 −360·fc·Td 一致，並說明這只是 pure-delay contribution。","頁面 phase loss 與 independent oracle 一致；解釋必須指出頻率越高同一 Td 代表更大角度，限制必須提到 plant/filter/ZOH/operating-point 不能全等效成 pure delay。","把 Module 16 的 delay 公式直接變成 Module 17 每種 topology 都能使用的 phase-margin budget。"]
    ],
    faults:[
      ["看到不同 topology 就重新背一套 PI","沒有先抽象成共同 r→e→C→u→P→y feedback grammar。","先寫出 u、y、sensor 與 actuator，再畫 P(s) / loop gain。","先做 control-problem definition，再做 controller design。","18_control_unification/index.html#universal-loop"],
      ["把『同一套控制』理解成所有電源共用同一組 Kp/Ki","混淆 feedback framework 與 power-stage dynamics。","比較 Buck LC、Boost RHPZ、LLC resonant slope、Inverter LCL 的 plant personality。","保留共同 loop-shaping 流程，但依 P(s)/operating point 重設 controller。","18_control_unification/index.html#same-not-same"],
      ["SFRA phase 比模型差就直接降 Kp","沒有先確認是不是 ADC/ISR/PWM latency 或額外 filter。","若 magnitude 大致一致但 phase 整段多落後，先量 sample-to-actuation timing。","把 measured Td 加回 loop model，再重新決定 crossover。","18_control_unification/index.html#debug-router"],
      ["新 topology 不知道從哪開始","把拓撲名稱當成知識入口，而不是先定義 control variables。","固定問 u、y、P(s)、pole/zero、bandwidth、Ts/Td、verification。","用 Module 18 的七問模板先建第一版控制模型。","18_control_unification/index.html#new-topology"]
    ]
  });

  // Keep the advanced workbench discoverable from the Module 18 page itself.
  const topbar=document.querySelector(".topbar");
  if(topbar&&!topbar.querySelector("[data-engineering-workbench]")){
    const link=document.createElement("a");
    link.href="engineering-workbench.html";
    link.dataset.engineeringWorkbench="true";
    link.textContent="Engineering Workbench →";
    link.setAttribute("aria-label","Open Digital Power Engineering Workbench");
    const badge=topbar.querySelector(".badge");
    topbar.insertBefore(link,badge||null);
  }
})(window);
