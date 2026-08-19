(function(root){
  "use strict";
  const raw=root.CircuitCurriculum;
  if(!raw||!Array.isArray(raw.modules))throw new Error("Power topology control module requires CircuitCurriculum");
  if(raw.modules.some(m=>m&&m.id==="power-topology-control"))return;
  raw.modules.push({
    id:"power-topology-control",number:"17",tag:"Power Control",title:"Power Topology Control Atlas",entry:"17_power_topology_control/index.html",
    oneLine:"把 Buck、Boost、PFC、PSFB、LLC、Inverter 放進同一套 plant → loop → digital timing → SFRA → debug 語言，從電路能量流一路連到 C2000。",
    analogy:"六種變換器像六種不同的交通工具：方向盤都叫控制器，但油門可能是 duty、phase shift、switching frequency 或 AC current reference；先認清 power stage 的性格，才知道補償器該怎麼開。",
    whyUseful:"避免拿同一套 PI 直覺硬套所有 topology。能辨認 LC double pole、Boost RHPZ、PFC 雙迴路與 2ω ripple、PSFB duty-loss/ZVS、LLC resonant gain、Inverter LC/LCL/PLL，並把模型差異追到 ADC/ISR/PWM 與 SFRA。",
    lessons:[
      ["index.html#atlas","六種 topology 的控制性格","先比較控制量、回授量、主要難點與最常踩的頻率域限制。","切換六張 topology card，說出每一種『真正的油門』。","不再把 duty control 當成所有 power stage 的共同假設。"],
      ["index.html#buck","Buck：最乾淨的 plant 教科書","用 volt-second、LC double pole、ESR zero 建立基準控制模型。","調 Vin、D、L、C、R、ESR、fs，看 Vout、ripple、fLC、fESR 與 Bode 同步變。","能從電路參數直接預測 pole/zero 與 crossover 壓力。"],
      ["index.html#boost","Boost：RHP zero 為什麼讓迴路不能貪快","先看 duty 增加時電感暫時少送能量到輸出的逆向反應，再看 RHPZ phase penalty。","調 D、L、R，觀察 fRHPZ 與建議 crossover ceiling。","知道 RHPZ 不能靠補償器消掉，必須留 bandwidth 距離。"],
      ["index.html#pfc","PFC：內電流環 + 外電壓環 + 2ω 能量","把 PF/THD、bus regulation、line-frequency ripple 拆成不同時間尺度。","調 line、P、Cbus、Vbus，觀察 input current 與 2ω bus ripple。","知道 outer voltage loop 為什麼不能亂拉快，以及 SPLL/current reference 在哪一層。"],
      ["index.html#psfb","PSFB：控制量從 duty 變成 phase shift","用 phase command 看 effective duty，再把 leakage/dead-time/ZVS window 加回真實世界。","調 phase、turns ratio、leakage、primary current、Coss，觀察輸出估算與 ZVS energy index。","知道 ZVS 是 operating-point 條件，不是『用了 PSFB 就自動有』。"],
      ["index.html#llc","LLC：用 switching frequency 控 gain","從 resonant tank、fr、Ln、Q、fn 看 operating point，而不是從固定頻率 duty 開始。","調 Lr、Cr、Lm、Q、fs，看 resonance 與 normalized FHA gain curve。","知道 LLC plant 隨 operating point/load 變，不把單一線性模型當全域真理。"],
      ["index.html#inverter","Inverter：AC voltage/current loop、PLL 與 LC/LCL resonance","比較 standalone voltage-source 與 grid-current mode。","切 LC/LCL 模式並調 L/C/Vdc/modulation，看 fundamental、resonance 與控制鏈。","知道 grid-tied 問題除了 current loop 還有同步、LCL damping 與 grid impedance。"],
      ["index.html#workflow","同一條 C2000 / SFRA 工作流","把六種 topology 都收斂成 sample → estimate → control → PWM → plant → measure。","用 Debug matrix 從 magnitude/phase/THD/ZVS/2ω ripple 反推模型漏了什麼。","能從實測症狀選下一個量測，而不是直接亂調 Kp/Ki。"]
    ],
    labs:[
      ["buck-duty-identity","驗證理想 CCM Buck 的 volt-second conversion ratio","17_power_topology_control/index.html","調整 Vin 與 duty，讓頁面顯示的 ideal Vout 與獨立解析式 D·Vin 一致，並說明這個 identity 的適用邊界。","頁面輸出與 independent oracle 一致；解釋必須提到 volt-second / duty，限制必須提到非理想壓降、DCM 或 dead-time。","建立 topology model 的第一個原則：先有可驗證的 ideal identity，再逐層加入非理想。"]
    ],
    faults:[
      ["Buck 模型準、實機 crossover 卻比預期早掉","ADC/analog filter、digital delay、PWM update 或寄生 ESR/ESL 未納入。","先對 fLC/fESR，再看 SFRA phase 是否整段額外落後。","量 sampling-to-PWM latency，將 delay/filter 加回模型。","17_power_topology_control/index.html#buck"],
      ["Boost 一拉高 bandwidth 就出現 overshoot/振鈴","crossover 太靠近 RHPZ，或 operating point 讓 RHPZ 下移。","計算 fRHPZ=R(1-D)^2/(2πL)，用 1/5~1/10 作保守距離檢查。","降低 crossover 或改控制架構；不要試圖用 LHP zero『消掉』RHPZ。","17_power_topology_control/index.html#boost"],
      ["PFC bus 很穩但 THD 反而變差","outer voltage loop 太積極追 2ω ripple，污染 current amplitude reference。","看 2×line ripple 與 current reference 是否同步被調幅。","降低 outer-loop bandwidth、改善 feed-forward/normalization，再查 current loop。","17_power_topology_control/index.html#pfc"],
      ["PSFB 輕載失去 ZVS","commutation energy 不足以完成 bridge-node capacitance transition。","比較 leakage/magnetizing current 能量與 Coss transition energy，並看 dead-time window。","調整 dead-time、漏感/輔助能量或 operating strategy；用實測 Vds turn-on 驗證。","17_power_topology_control/index.html#psfb"],
      ["LLC 同一組 PI 在不同 Vin/load 表現差很多","resonant plant 與 frequency-to-gain slope 隨 operating point 改變。","在不同 fn、Q、Ln 下比較增益斜率與 SFRA。","做 gain scheduling、限制 operating region，或採 current-mode/HHC 等更適合架構。","17_power_topology_control/index.html#llc"],
      ["Grid inverter current loop 某頻段突然 phase 崩掉","LCL resonance、digital delay、PLL/grid impedance interaction 未被完整建模。","先定位 fLCL，再比較 open-loop/SFRA 與 PLL bandwidth。","加入 damping、重整 bandwidth hierarchy，並用實際 grid impedance 驗證。","17_power_topology_control/index.html#inverter"]
    ]
  });
})(window);
