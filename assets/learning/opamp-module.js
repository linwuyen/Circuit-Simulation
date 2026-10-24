(function(root){
  "use strict";
  const raw=root.CircuitCurriculum;
  if(!raw||!Array.isArray(raw.modules))throw new Error("OP AMP module requires CircuitCurriculum");
  if(raw.modules.some(m=>m&&m.id==="opamp"))return;
  raw.modules.push({
    id:"opamp",number:"12",tag:"OP AMP",title:"OP AMP Slew Rate / Dynamic Response",entry:"12_opamp_slew_rate/index.html",
    oneLine:"OP AMP 的大訊號輸出不只受 GBW 限制；Slew Rate 決定輸出最大 dV/dt，振幅與頻率一起決定是否進入 slew-limited 失真。",
    analogy:"小訊號 bandwidth 像轉彎靈活度；Slew Rate 像最高加速度。車再會轉彎，油門加速度不夠仍追不上大幅度高速命令。",
    whyUseful:"看到 step、sine、ADC driver 或 DAC I/V 波形時，能分辨 bandwidth、slew-rate、settling 與 output swing，並由需求反推 OP AMP 規格。",
    prerequisites:[],
    lessons:[
      {id:"opamp.lesson.slew-rate",href:"01_slew_rate.html",title:"Slew Rate 第一性原理",objective:"理解 SR=max|dVout/dt|，不把 V/µs 當成 MHz。",action:"改變 step 幅度與 SR，比較全幅 slew 尺度與實際 clamp 時間。",expectedObservation:"A≤SRdirection × τ 時沒有 slew ramp；超過門檻後，增大 A 才延長 clamp。",competency:"opamp.large-signal.slew-rate"},
      {id:"opamp.lesson.step-response",href:"02_step_response.html",title:"Step Response：Slew Clamp 與 Settling",objective:"區分全幅 slew 尺度、實際 clamp 區間與精度 settling；小 step 可以沒有 clamp。",action:"比較不同 step、GBW、SR 的 10–90% 與 settling。",expectedObservation:"大 step 先呈近固定斜率，接近目標後才進入指數/小訊號收斂。",competency:"opamp.large-signal.slew-rate"},
      {id:"opamp.lesson.sine-fpbw",href:"03_sine_fpbw.html",title:"Sine / Full-Power Bandwidth",objective:"由 sine 最大斜率推出 SRrequired=2πfVpk。",action:"固定 frequency 改 Vpp，再固定 Vpp 改 frequency。",expectedObservation:"required SR 對 f 與 Vpk 都是一次正比。",competency:"opamp.large-signal.slew-rate"},
      {id:"opamp.lesson.gbw-vs-sr",href:"04_gbw_vs_slew.html",title:"GBW vs Slew Rate 診斷",objective:"用 amplitude dependence 區分 small-signal bandwidth 與 large-signal slew limit。",action:"比較同頻 1 Vpp 與 10 Vpp，再比較小訊號 sweep。",expectedObservation:"只在大振幅失真時優先懷疑 SR；小訊號也隨頻率衰減才像 bandwidth。",competency:"opamp.large-signal.slew-rate"},
      {id:"opamp.lesson.settling",href:"05_settling_time.html",title:"Settling Time 不是 ΔV/SR",objective:"知道 A/SRdirection 是全幅 slew 尺度；實際 clamp 與精度 settling 還取決於 τ 和誤差帶。",action:"改 tolerance、GBW、SR，比較 ramp-end 與 settle-end。",expectedObservation:"SR 足夠不代表高精度 settling 一定快。",competency:"opamp.large-signal.slew-rate"},
      {id:"opamp.lesson.selection",href:"06_datasheet_selection.html",title:"Datasheet Selection：從需求反推規格",objective:"把 SR、GBW、output swing、load、settling 同時納入選型。",action:"由 Vpp/f/gain/settling requirement 建立規格 checklist。",expectedObservation:"單看 GBW 或單看 SR 都可能選錯器件。",competency:"opamp.large-signal.slew-rate"}
    ],
    labs:[
      {id:"opamp.lab.opamp-step",title:"分辨全幅 Slew 尺度與 Clamp 時間",href:"12_opamp_slew_rate/lab_step.html",task:"選對方向 SR，先算 A/SRdirection，再以 max(0, A/SRdirection − τ) 預測 clamp，並比較指定精度的 settling。",success:"能指出 slew-limited ramp 與後段 settling 的分界。",value:"避免把整段 step response 都誤認成 bandwidth。",competency:"opamp.large-signal.slew-rate",transferPrompt:"固定 SR 與 τ，step 幅度加倍會讓全幅 slew 尺度加倍；實際 clamp 時間為何不一定加倍？"},
      {id:"opamp.lab.opamp-sine",title:"設計 20–50% Slew Margin",href:"12_opamp_slew_rate/lab_sine.html",task:"設定 Vpp/frequency，調整正負 Slew Rate，使最差方向 SR / SRrequired 落在 1.2–1.5 且波形不進入 slew limit。",success:"獨立解析式與頁面輸出一致，且 worst-case slew margin 介於 1.2–1.5。",value:"直接對應 ADC driver、DAC buffer 與高速類比選型。",competency:"opamp.large-signal.slew-rate",transferPrompt:"Vpp 或 frequency 加倍時，要維持同一 margin，SR 要如何改？"},
      {id:"opamp.lab.opamp-diagnose",title:"GBW / SR / Settling 三選一診斷",href:"12_opamp_slew_rate/lab_diagnose.html",task:"依三組 scope 症狀選出最可能限制，再說出下一個能區分假設的量測。",success:"能用 amplitude dependence、small-signal roll-off 與 settling tail 建立可否證診斷。",value:"對應實機示波器除錯，而不是背規格名詞。",competency:"opamp.large-signal.slew-rate",transferPrompt:"若把振幅縮小 10 倍後失真消失，哪個假設機率應上升？"}
    ],
    faults:[
      {id:"opamp.fault.slew-limit",symptom:"同一 frequency，小振幅正常、大振幅變 triangle-like",cause:"required dV/dt 超過可用 Slew Rate。",verify:"縮小 Vpp 或 frequency；若失真按比例改善，再比較 2πfVpk 與 datasheet SR。",fix:"提高 SR、降低 Vpp/frequency，或改變 gain/stage 分配。",href:"12_opamp_slew_rate/lab_diagnose.html",competency:"opamp.large-signal.slew-rate"},
      {id:"opamp.fault.bandwidth",symptom:"很小的訊號也隨 frequency 上升而衰減、phase lag 增加",cause:"closed-loop bandwidth / GBW 不足。",verify:"保持小振幅做 frequency sweep，避免觸發 slew limit。",fix:"提高 GBW、降低 noise gain 或重新分配級數。",href:"12_opamp_slew_rate/lab_diagnose.html",competency:"opamp.large-signal.slew-rate"},
      {id:"opamp.fault.settling",symptom:"大斜率段已結束，但輸出仍慢慢進入精度帶",cause:"small-signal settling、pole/zero、load 或精度要求主導。",verify:"分開量 slew interval 與進入 ±0.1%/±0.01% tolerance 的時間。",fix:"檢查 GBW/phase margin、load、compensation 與 settling spec。",href:"12_opamp_slew_rate/lab_diagnose.html",competency:"opamp.large-signal.slew-rate"}
    ]
  });
  if(Array.isArray(raw.glossary)){
    const add=(term,meaning,tip)=>{if(!raw.glossary.some(x=>x&&x[0]===term))raw.glossary.push([term,meaning,tip]);};
    add("Slew Rate","OP AMP 輸出可達到的最大電壓變化率，常用 V/µs。","先用 SRrequired=2πfVpk 檢查大訊號正弦。 ");
    add("FPBW","Full-Power Bandwidth；在指定輸出振幅下不進入 slew limit 的頻率尺度。","不要和 small-signal −3 dB bandwidth 混為一談。 ");
    add("Settling Time","輸出進入並維持在指定誤差帶內所需時間。","A/SRdirection 是全幅 slew 尺度；本一階模型的 clamp 時間是 max(0, A/SRdirection − τ)，精度 settling 另取決於誤差帶。 ");
  }
  root.CircuitOpampModule={version:"1.0.0",moduleId:"opamp",competency:"opamp.large-signal.slew-rate"};
})(typeof globalThis!=="undefined"?globalThis:this);
