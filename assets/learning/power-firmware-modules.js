(function(root){
  "use strict";
  const raw=root.CircuitCurriculum;
  if(!raw||!Array.isArray(raw.modules))throw new Error("Power firmware modules require CircuitCurriculum");
  const addModule=m=>{if(!raw.modules.some(x=>x&&x.id===m.id))raw.modules.push(m);};

  addModule({
    id:"power-sync",number:"13",tag:"PWM/ADC Sync",title:"PWM → ADC → ISR 同步控制",entry:"13_power_sync/index.html",
    oneLine:"數位控制不是『算得快』就夠；ADC 何時取樣、ISR 何時開始、PWM 何時真正更新，決定閉迴路看見的是現在還是上一拍。",
    analogy:"像接力賽：PWM 發令、ADC 接棒、ISR 計算、shadow register 交棒。每一棒都必須在下一個週期邊界前完成。",
    whyUseful:"把 switching edge、SOC、acquisition、conversion、ISR latency、control execution 與 PWM shadow load 串成同一條 real-time causality chain。",
    prerequisites:[],
    lessons:[
      {id:"power-sync.lesson.soc",href:"13_power_sync/index.html#soc",title:"PWM 事件如何觸發 ADC SOC",objective:"把 switching time-base 與 ADC sample instant 放在同一時間軸。",action:"選擇不同 sample phase，觀察 sample instant。",expectedObservation:"SOC 位置改變會直接改變 measurement age 與 switching-noise exposure。",competency:"power-sync.sample-update.deadline"},
      {id:"power-sync.lesson.acquisition",href:"13_power_sync/lab_timing.html",title:"Acquisition / Conversion 不是零時間",objective:"理解 sample-and-hold 與 conversion latency 會吃掉控制預算。",action:"改 acquisition / conversion time。",expectedObservation:"資料 ready 時刻向後移，剩餘 control margin 下降。",competency:"power-sync.sample-update.deadline"},
      {id:"power-sync.lesson.edge",href:"13_power_sync/lab_edge_noise.html",title:"避開 Switching Edge 取樣",objective:"理解 sample timing 與 switching noise / ringing 的關係。",action:"把 sample 移近/移遠 edge。",expectedObservation:"越靠近 switching edge，noise-risk proxy 越高。",competency:"power-sync.sample-window.noise"},
      {id:"power-sync.lesson.shadow",href:"13_power_sync/lab_update_delay.html",title:"PWM Shadow Update 與一拍延遲",objective:"分清算完 duty 與 power stage 真正吃到新 duty 的時刻。",action:"切換 immediate / next-zero shadow load。",expectedObservation:"錯過 load point 會多一個 switching period 的 effective delay。",competency:"power-sync.shadow-update.delay"}
    ],
    labs:[
      {id:"power-sync.lab.timing",title:"關閉 Sample → Compute → PWM deadline",href:"13_power_sync/lab_timing.html",task:"設定 fsw、sample phase、ADC acquisition/conversion、ISR 與 control execution，讓新 duty 能在同一個 switching period 的 update deadline 前完成。",success:"獨立 reference 與頁面 timing 一致，且剩餘 margin ≥ 1 µs。",value:"直接對應數位電源 PWM→ADC→ISR→PWM 的 timing closure。",competency:"power-sync.sample-update.deadline",transferPrompt:"若 fsw 加倍但各 latency 不變，deadline margin 會如何改變？"},
      {id:"power-sync.lab.edge-noise",title:"選擇低雜訊 ADC sample window",href:"13_power_sync/lab_edge_noise.html",task:"在固定 switching period 下調整 sample phase，使取樣遠離最近 switching edge。",success:"能說明 sample point 為何不能只追求『越早越好』。",value:"把 scope 上的 switching ringing 與 ADC data quality 串起來。",competency:"power-sync.sample-window.noise",transferPrompt:"若 dead-time / ringing duration 變長，sample window 應往哪裡移？"},
      {id:"power-sync.lab.update-delay",title:"找出一拍控制延遲",href:"13_power_sync/lab_update_delay.html",task:"比較 immediate 與 shadow-load 策略，判斷新 duty 在第幾個 PWM 週期生效。",success:"能指出 missed load point 導致的額外 one-cycle delay。",value:"避免把 phase lag / instability 全怪到 PI 參數。",competency:"power-sync.shadow-update.delay",transferPrompt:"若 control ISR 越過 shadow load point，plant 看到的 command age 會增加多少？"}
    ],
    faults:[
      {id:"power-sync.fault.edge-noise",symptom:"ADC raw count 每個週期在 PWM edge 附近抖動",cause:"SOC 落在 switching transient / ringing window。",verify:"固定負載，只掃 sample phase並比較 raw-count variance。",fix:"把 SOC 移到較安靜的 conduction window，並重新確認 acquisition time。",href:"13_power_sync/lab_edge_noise.html",competency:"power-sync.sample-window.noise"},
      {id:"power-sync.fault.one-cycle-delay",symptom:"控制器數學正確但 response 比模型多一拍 phase lag",cause:"ISR 完成後錯過 PWM shadow load point。",verify:"同時量 ADC EOC、ISR entry/exit 與 PWM update event。",fix:"調整 SOC/load point、縮短 critical path 或明確納入 z^-1 delay。",href:"13_power_sync/lab_update_delay.html",competency:"power-sync.shadow-update.delay"},
      {id:"power-sync.fault.deadline",symptom:"提高 switching frequency 後偶發 stale duty / missed update",cause:"sample→conversion→ISR→control critical path 超過 period deadline。",verify:"建立 worst-case latency budget，不只看 average execution time。",fix:"縮短 latency、調 trigger、搬移非關鍵工作或降低 fsw。",href:"13_power_sync/lab_timing.html",competency:"power-sync.sample-update.deadline"}
    ]
  });

  addModule({
    id:"protection",number:"14",tag:"Protection",title:"Power Protection Architecture",entry:"14_power_protection/index.html",
    oneLine:"保護不是一堆 if；真正要設計的是 fault detection path 的 latency、filter、latch、safe state 與 recovery policy。",
    analogy:"安全氣囊不會等主程式輪詢後再決定要不要打開；危險路徑要短、可預測、失效時偏向安全。",
    whyUseful:"把 comparator/CMPSS、digital filter、trip-zone、ADC software protection、fault latch 與 startup/shutdown sequencing 放進同一個 safety model。",
    prerequisites:[],
    lessons:[
      {id:"protection.lesson.paths",href:"14_power_protection/index.html#paths",title:"Hardware Trip vs Software Protection",objective:"比較兩條 fault path 的 latency 與可控性。",action:"分別累加 comparator/filter/trip 與 sample/ADC/ISR/decision latency。",expectedObservation:"hardware trip 通常少經過 CPU critical path。",competency:"protection.trip.latency"},
      {id:"protection.lesson.filter",href:"14_power_protection/lab_latency.html",title:"Filter / Blanking 的代價",objective:"知道去雜訊會換來 detection latency。",action:"增加 filter window 並觀察總 trip latency。",expectedObservation:"robustness 與 reaction time 存在可量化 tradeoff。",competency:"protection.trip.latency"},
      {id:"protection.lesson.latch",href:"14_power_protection/lab_latch.html",title:"Fault Latch 與 Safe State",objective:"區分 transient clear、latched fault 與 reset/re-arm。",action:"注入 fault、clear input、reset latch。",expectedObservation:"latched fault 不應因輸入恢復就自動重新開 PWM。",competency:"protection.fault-latch.safety"},
      {id:"protection.lesson.sequence",href:"14_power_protection/lab_sequence.html",title:"Startup / Shutdown Sequencing",objective:"把 precondition、enable、ready、fault rollback 當成狀態機。",action:"依序滿足條件或故意跳步。",expectedObservation:"非法 transition 會 fail-closed 回 safe state。",competency:"protection.sequence.invariant"}
    ],
    labs:[
      {id:"protection.lab.trip-latency",title:"比較 Hardware / Software Trip Latency",href:"14_power_protection/lab_latency.html",task:"建立兩條 fault path 的 latency budget，讓 hardware path 明顯快於 software path，並說出 filter 增加 latency 的邊界。",success:"獨立 reference 與頁面結果一致，hardware trip < software trip 且 ≤ 1 µs。",value:"把 OCP/OVP 從『程式有判斷』提升成可驗證的 safety timing contract。",competency:"protection.trip.latency",transferPrompt:"如果 digital filter window 加倍，哪條 path 先失去 timing margin？"},
      {id:"protection.lab.latch",title:"驗證 Fault Latch 不會自行復歸",href:"14_power_protection/lab_latch.html",task:"注入 fault 後移除 fault input，確認 PWM 仍保持 inhibited，直到明確 reset/re-arm。",success:"FAULT_LATCH 與 PWM OFF 的 invariant 保持成立。",value:"避免 transient fault 消失後未經授權自動重新上電。",competency:"protection.fault-latch.safety",transferPrompt:"cycle-by-cycle current limit 與 latched catastrophic fault 為什麼不能共用同一 recovery policy？"},
      {id:"protection.lab.sequence",title:"建立 Fail-Closed Startup Sequence",href:"14_power_protection/lab_sequence.html",task:"從 OFF → PRECHECK → READY → RUN，並在任一階段注入 fault。",success:"非法 transition 被拒絕；fault 會回到 SAFE/OFF。",value:"訓練 power-up/down 與 protection ownership。",competency:"protection.sequence.invariant",transferPrompt:"若某 precondition 只能由另一 MCU 回報，timeout 應如何進入安全狀態？"}
    ],
    faults:[
      {id:"protection.fault.slow-trip",symptom:"短路時 software flag 有出現但 power stage 已承受過久 fault energy",cause:"把需要 sub-cycle reaction 的 fault 放在 ADC/ISR software path。",verify:"量 fault edge 到 PWM actually-off 的 end-to-end latency。",fix:"把 catastrophic path 移到 comparator/XBAR/trip-zone，software 保留 logging/recovery。",href:"14_power_protection/lab_latency.html",competency:"protection.trip.latency"},
      {id:"protection.fault.auto-restart",symptom:"fault input 一消失 PWM 就自動恢復",cause:"沒有區分 latched fault 與 cycle-by-cycle limit。",verify:"注入 fault 後移除 input，看 enable 是否仍被 latch 阻擋。",fix:"加入 explicit reset/re-arm policy 與 safe-state invariant。",href:"14_power_protection/lab_latch.html",competency:"protection.fault-latch.safety"},
      {id:"protection.fault.sequence",symptom:"尚未 ready 就允許 power stage enable",cause:"startup 條件散落成 flags，沒有 canonical state transition。",verify:"故意缺少一個 precondition 並請求 RUN。",fix:"用 fail-closed state machine 收斂 enable ownership。",href:"14_power_protection/lab_sequence.html",competency:"protection.sequence.invariant"}
    ]
  });

  addModule({
    id:"power-capstone",number:"15",tag:"Debug Lab",title:"Power Firmware Debug Challenge Bank",entry:"15_power_capstone/index.html",
    oneLine:"Module 19 先建立正常的 Buck 因果鏈；這裡故意給未知 sensing、timing、ownership、state 與 control fault，要求用最少量測收斂 root cause。",
    analogy:"像拿到一台別人寫的電源：你不知道哪裡壞，只能靠 observable 一層層證偽假設，而不是把每個參數都重調一次。",
    whyUseful:"訓練 hypothesis → highest-information measurement → falsification → root cause → verification 的 diagnosis transfer；不是第二個 capstone。",
    prerequisites:[],
    lessons:[
      {id:"power-capstone.lesson.chain",href:"15_power_capstone/index.html#chain",title:"先建立 Unknown-System Signal Chain",objective:"在不知道 root cause 前，先把 command 到 physical output 的 owner、unit 與 observable 寫清楚。",action:"沿著 command→control→PWM→plant→sensor→ADC 追一圈。",expectedObservation:"每個轉換點都有 unit/latency/state contract，可作為後續證偽邊界。",competency:"capstone.signal-chain.integration"},
      {id:"power-capstone.lesson.budget",href:"15_power_capstone/lab_budget.html",title:"End-to-End Control Budget",objective:"辨認 critical path 與 background work。",action:"改 sensing/control/PWM-commit/communication latency。",expectedObservation:"只有 serial critical path 決定 same-cycle deadline；background work 仍需資源隔離。",competency:"capstone.signal-chain.integration"},
      {id:"power-capstone.lesson.fault",href:"15_power_capstone/lab_fault.html",title:"有限量測預算下隔離 Root Cause",objective:"優先量能最大縮小假設空間的 signal。",action:"在 sensor/control/communication fault 間選 measurement。",expectedObservation:"好 debug 不是量最多，而是每一步都最大化可否證性。",competency:"capstone.fault-isolation.measurement"},
      {id:"power-capstone.lesson.ladder",href:"15_power_capstone/lab_debug.html",title:"Debug Ladder：先存在，再時序，再數值",objective:"建立跨模組一致的 debug order。",action:"依 Power/Clock/Reset/Signal/Timing/Data/State/Control/Plant 排序。",expectedObservation:"先證明 lower layer invariant，可避免過早改 control algorithm。",competency:"capstone.debug-ladder.order"}
    ],
    labs:[
      {id:"power-capstone.lab.integration-budget",title:"關閉 Generic Converter Same-Cycle Budget",href:"15_power_capstone/lab_budget.html",task:"在 10 µs generic control period 中分配 sensing、control 與 PWM commit，保留 ≥2 µs deterministic margin；communication 視為 background work。",success:"獨立 reference 與頁面 critical path/margin 一致。",value:"把各 module 組成可審查的 system timing contract。",competency:"capstone.signal-chain.integration",transferPrompt:"若 communication 意外進入 critical section，哪個 deadline 會先被破壞？"},
      {id:"power-capstone.lab.fault-isolation",title:"用三次量測隔離 System Fault",href:"15_power_capstone/lab_fault.html",task:"面對 output 錯誤，只允許有限次量測；先判斷是 sensing scale、control sign 還是 stale command。",success:"用 measurement evidence 而非猜測收斂 root cause。",value:"把 Bayesian diagnosis 拉到 system integration 層。",competency:"capstone.fault-isolation.measurement",transferPrompt:"如果 output symptom 一樣，但 raw ADC 正常，哪一類 hypothesis 應下降？"},
      {id:"power-capstone.lab.debug-ladder",title:"未知系統 Debug Ladder",href:"15_power_capstone/lab_debug.html",task:"把一組混亂檢查項目重排成 Power→Clock→Reset→Signal→Timing→Data→State→Control→Plant。",success:"先驗 lower-layer invariant，再進入高階演算法。",value:"形成可遷移到任何 embedded power system 的除錯 discipline。",competency:"capstone.debug-ladder.order",transferPrompt:"為什麼在 PWM 根本沒有輸出前，不該先調 PI gain？"}
    ],
    faults:[
      {id:"power-capstone.fault.scale",symptom:"控制器穩定但 physical output 比 command 固定差一個比例",cause:"sensor/divider/gain/firmware scaling chain 不一致。",verify:"同時比較 raw ADC、scaled engineering unit 與獨立 DMM/reference。",fix:"找出第一個 unit conversion 分歧點並重新校準。",href:"15_power_capstone/lab_fault.html",competency:"capstone.fault-isolation.measurement"},
      {id:"power-capstone.fault.stale",symptom:"command 更新後 output 偶爾維持舊值一拍或多拍",cause:"communication/data publication 與 control consumer ownership 不一致。",verify:"同時 trace producer sequence、published sequence 與 control-consumed sequence。",fix:"建立 complete-frame publication 與 explicit ownership。",href:"15_power_capstone/lab_fault.html",competency:"capstone.fault-isolation.measurement"},
      {id:"power-capstone.fault.layering",symptom:"debug 時反覆改 PI 仍無法恢復輸出",cause:"真正 fault 位於 lower layer，例如 enable/timing/sensing。",verify:"按照 debug ladder 逐層證明 invariant。",fix:"先修最低失敗層，再重新驗 control behavior。",href:"15_power_capstone/lab_debug.html",competency:"capstone.debug-ladder.order"}
    ]
  });

  if(Array.isArray(raw.glossary)){
    const add=(term,meaning,tip)=>{if(!raw.glossary.some(x=>x&&x[0]===term))raw.glossary.push([term,meaning,tip]);};
    add("SOC","Start of Conversion；由 timer/ePWM 等事件觸發 ADC 開始一次取樣/轉換流程。","先把 SOC、EOC、ISR 與 PWM load point 畫在同一時間軸。 ");
    add("Trip Zone","PWM 的硬體保護路徑，可由 comparator/X-BAR 等事件直接強制輸出到安全狀態。","catastrophic fault 不應只依賴 software polling。 ");
    add("Critical Path","必須串行完成且直接決定 deadline 的最長延遲鏈。","background work 不代表免費；但不要把可平行工作錯算進 serial critical path。 ");
    add("Debug Ladder","由 power/clock/reset/signal/timing/data/state/control/plant 逐層驗證的除錯順序。","先證明 lower-layer invariant，再修改高階控制。 ");
  }
  root.CircuitPowerFirmwareModules={version:"1.0.0",moduleIds:["power-sync","protection","power-capstone"]};
})(typeof globalThis!=="undefined"?globalThis:this);