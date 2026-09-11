(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.CircuitEngineeringCurriculum=api;})(globalThis,function(){
  'use strict';
  // Shared curriculum facts extracted from Module 19. No calculation, routing or state.
  const views = {
    physical: {
      label: "PHYSICAL",
      title: "能量真的怎麼流",
      flow: ["PWM / switch state", "Switch node", "vL → di/dt", "L / C 儲能", "Load / Vout"],
      note: "先問電流路徑與儲能元件能不能瞬間改變，再談 controller。真板高價值量測：switch node、iL、Vout。"
    },
    signal: {
      label: "SIGNAL",
      title: "物理量怎麼變成韌體數字",
      flow: ["Vout physical", "Divider / AFE", "ADC pin", "Sample / count", "Scaling → ŷ"],
      note: "controller 控制的是重建後的 ŷ，不是你心裡認為的 Vout。先驗 scale / offset / sample point，再調 PI。"
    },
    control: {
      label: "CONTROL",
      title: "負回授每一拍做了什麼",
      flow: ["Reference r", "e = r − ŷ", "C(z) / PI", "Duty command", "Plant response"],
      note: "把 reference、feedback、error、command 分開看。數學正確不代表 measurement、timing 或 actuator authority 正確。"
    },
    time: {
      label: "TIME",
      title: "算完不代表已經作用到 power stage",
      flow: ["SOCA", "ADC ready", "ISR / CLA", "CMPA shadow write", "ZERO load → active PWM"],
      note: "量 end-to-end sample-to-actuate latency；miss shadow-load 就是額外一拍，不要把這個 phase lag 全怪給 PI。"
    },
    authority: {
      label: "AUTHORITY",
      title: "誰真的有資格讓 PWM 導通",
      flow: ["RUN state", "Fresh command", "Valid sensing", "Valid calibration", "Peripherals ready", "No fault", "PWM grant"],
      note: "software grant 是多個 invariant 的 AND；CMPSS / Trip Zone 仍保有獨立 hardware veto。"
    }
  };
  const taxonomy = {
    Physics:'電路物理', Sensing:'感測', SignalConditioning:'訊號調理', ADC:'類比轉數位',
    Feedback:'回授', Control:'控制', PWM:'脈寬調變', Timing:'時序', Dynamics:'動態',
    Protection:'保護', StateMachine:'狀態機', ProductionFirmware:'量產韌體',
    Verification:'驗證', BoardMeasurement:'真板量測', Debugging:'除錯', TopologyTransfer:'拓撲遷移'
  };
  const moduleTopics = {
    0:['Physics','PWM','Dynamics'],1:['Sensing','ADC'],2:['Physics','PWM','TopologyTransfer'],
    3:['Control','PWM','Sensing'],4:['Control','Feedback','Dynamics'],5:['Timing','ProductionFirmware'],
    6:['Timing','ADC','PWM'],7:['Sensing','Protection','StateMachine'],8:['SignalConditioning','ProductionFirmware'],
    9:['Sensing','SignalConditioning','ADC'],10:['Control','Protection','TopologyTransfer'],11:['Sensing','Control','Timing'],
    12:['SignalConditioning','Dynamics'],13:['Timing','ADC','PWM'],14:['Protection','StateMachine'],
    15:['Debugging','Sensing','Timing','Control','StateMachine','ProductionFirmware'],16:['Dynamics','Control','Timing'],
    17:['TopologyTransfer','Physics','Control','Dynamics'],18:['Control','Feedback','Verification'],
    19:['Physics','Sensing','ADC','Feedback','Control','PWM','Timing','Dynamics','Protection','StateMachine','ProductionFirmware','Verification','BoardMeasurement']
  };
  const faultTaxonomy = {POWER_PATH:'能量路徑',SENSING:'感測',ADC:'轉換',TIMING:'時序',CONTROL:'控制',PWM:'開關輸出',PROTECTION:'保護',STATE:'狀態',COMMUNICATION:'通訊',CALIBRATION:'校準',CONFIGURATION:'設定'};
  const diagnosticChain=['症狀','可能出錯的階段','可否證的假設','最能區分原因的量測','觀察結果','排除原因','修正','回歸測試','陌生條件'];
  const viewTopics={physical:['Physics','Dynamics','TopologyTransfer'],signal:['Sensing','SignalConditioning','ADC'],control:['Feedback','Control'],time:['Timing','PWM'],authority:['Protection','StateMachine','ProductionFirmware']};
  // Guided experiment facts; equations and authority remain in the registered kernel.
  const workbenchLessons=[
    {id:'energy',title:'開久一點，電路真的怎麼變？',intro:'先固定每輪開關打開的比例，比較電能送進電感和電容後，輸出如何建立。',action:'把開關比例從 25% 改為 40%，重跑',change:{manualDuty:.4},question:'開關打開的時間變長，這組條件下的平均輸出會？',choices:[['up','提高'],['down','降低'],['same','不變']],answer:'up',reason:'每輪送入電能的時間增加，儲能元件與負載共同決定輸出。',wrong:'只有顯示倍率改變，電路沒有收到更多電能。',view:'voltage',modules:[0]},
    {id:'storage',title:'關掉開關，電流去哪裡？',intro:'沿用剛才的電路，放大已穩定後的一輪。關閉開關後，找電感與二極體提供的回路。',action:'放大一輪，查看開關關閉後的電流',change:{},question:'在這一輪的關閉區段，電感電流會？',choices:[['continues','繼續流動，逐漸下降'],['zero','立刻變成零'],['rise','一直往上升']],answer:'continues',reason:'電感電流無法瞬間改變，二極體提供續流回路；這時電感逐漸釋放能量。',wrong:'因為程式還沒發現開關已經關掉。',view:'current',modules:[0]},
    {id:'demand',title:'用電變少，電流與輸出一起看',intro:'沿用同一組開關設定，把負載電阻提高；這代表相同電壓下需要的電流變少。',action:'把負載從 12 Ω 改為 24 Ω，重跑',change:{loadProfile:[{cycle:0,ohm:24}]},question:'比較最後一段的平均負載電流，會？',choices:[['lower','減少'],['higher','增加'],['zero','一定完全為零']],answer:'lower',reason:'電阻提高後，同一電壓下需求電流減少；也要同時檢查輸出是否改變。',wrong:'電阻提高會把開關命令直接關閉。',view:'voltage',modules:[0]},
    {id:'sensing',title:'量錯了，控制器會相信哪個數字？',intro:'先保持手動開關比例。把電壓量測倍率改錯，同時看真實電壓與控制器讀值。下一步會修正倍率，再開啟自動控制。',action:'把量測倍率从 1 改為 0.8，重跑',change:{sensorGain:.8},question:'尚未開啟自動控制，倍率改錯後會？',choices:[['reading','讀值變低，實際電壓保持相同'],['physical','實際電壓也立刻少兩成'],['stop','保護必定立即停機']],answer:'reading',reason:'手動命令沒有使用量測回授，所以倍率錯誤先出現在讀值；接上控制後就可能影響電路。',wrong:'量測倍率會直接改變電容的真實電壓。',view:'signal',modules:[1,9,12]},
    {id:'feedback',title:'修正量測，讓電路自己接近目標',intro:'先把上一課的錯誤倍率修正為 1，確認真實值與讀值一致。再只改一件事：讓控制器根據差距決定開關比例。',prepare:{sensorGain:1},action:'開啟自動調整，追蹤 24 V 目標',change:{controlMode:'feedback'},question:'量測修正後，開啟自動控制，最後的輸出通常會？',choices:[['closer','比固定開關比例更接近 24 V'],['exact','每一瞬間都精確等於 24 V'],['same','完全不受控制器影響']],answer:'closer',reason:'控制器用目標減去讀值，再調整開關命令；實際輸出仍要經過電感、電容與時間才能改變。',wrong:'控制器直接把真實輸出電壓指定為 24 V，不經過電路。',view:'voltage',modules:[4,18]},
    {id:'deadline',title:'算完了，為什麼還沒用上？',intro:'沿用已閉合的控制。把計算時間拉長，對照算完、寫入命令和真正更新開關的時刻。',action:'把計算時間從 1.7 µs 改為 11 µs，重跑',change:{computeUs:11},question:'更新每 10 µs 發生一次，計算晚到之後，新命令會？',choices:[['later','等更後面的更新點才生效'],['instant','算完就立即生效'],['past','回到已經過去的更新點']],answer:'later',reason:'命令先寫入等待區，開關只在固定更新點讀取；錯過這次就要等下一次。',wrong:'波形畫得比較慢，實際命令沒有延遲。',view:'timing',modules:[6,13]},
    {id:'response',title:'調得更用力，一定更好嗎？',intro:'先把計算時間修回原值，避免同時改兩個因素，再加強累積誤差的修正。比較整段啟動波形，別只看最後一點。',prepare:{computeUs:1.7},action:'把累積修正強度從 40 改為 400，重跑',change:{kiV:400},question:'這組條件下，加強累積修正後，啟動時的最高電壓會？',choices:[['higher','更高，更容易越過目標'],['perfect','保證更平順且永不越過'],['same','一定完全相同']],answer:'higher',reason:'電路儲能與反應需要時間，累積修正太強可能在輸出追上前送入過多能量。',wrong:'最後接近目標，就代表整段啟動過程都沒有問題。',view:'voltage',modules:[4,16,18]},
    {id:'protection',title:'超過限制，誰能讓它停下？',intro:'沿用控制器與電路，把保護門檻降到 2 A，觀察偵測後的開關命令、電流與輸出。這是故意觸發保護的教學試驗。',action:'把過流保護門檻從 18 A 改為 2 A，重跑',change:{tripCurrent:2},question:'過流保護觸發後，控制器仍想送電時會？',choices:[['veto','開關被禁止，儲能再逐漸消退'],['continue','照常執行控制器命令'],['instant','所有電流與電壓瞬間歸零']],answer:'veto',reason:'保護擁有否決開關輸出的權限；關閉能量入口後，電感與電容的能量仍需要時間消退。',wrong:'只要誤差夠大，控制器就可以越過故障鎖定繼續輸出。',view:'voltage',modules:[14,15,19]}
  ];
  const topologySteps=[
    {id:'prediction',label:'先猜',title:'把開關開久一點，哪個輸出會升高？',note:'輸入、電感、電容與負載相同。先分開猜降壓與升壓，之後再算。',choices:[['both','兩者都升高'],['buck','只有降壓升高'],['boost','只有升壓升高']],answer:'both'},
    {id:'observation',label:'操作比較',title:'看完同條件比較，你發現什麼？',note:'對照兩種輸出，再看升壓動態限制那一列。',choices:[['separate','輸出都升高，但升壓的動態限制移到更低頻率'],['faster','輸出升高，代表控制一定能更快'],['same','兩種電路的輸出數值一定相同']],answer:'separate'},
    {id:'reason',label:'說明原因',title:'為什麼升壓不能只照搬降壓的調法？',note:'升壓電路先在電感存能，開關關閉時才送往輸出。提高開啟比例，也縮短了當輪送出的時間；這會限制回授反應。',choices:[['path','能量送出的路徑不同，穩定輸出和動態反應要分開看'],['labels','只是名稱不同，任何調整值都可以直接照搬']],answer:'path'},
    {id:'return',label:'返回降壓',title:'回到降壓電路，哪些判斷可以帶回去？',note:'現在要回去改善原本的 Buck 控制。哪些需要重新確認，哪些不能照抄？',choices:[['recheck','重新檢查量測、更新時間與保護；不要套用 Boost 特有的 RHP 零點'],['copy','直接把 Boost 的動態限制數字當成 Buck 的控制頻寬']],answer:'recheck'}
  ];
  const applicationLessons=[
    {id:'pfc',label:'交流整流（PFC）',title:'電容加大，電壓的起伏會怎樣？',modelId:'boost-pfc-bus-energy-outer',section:'pfc',
     baseline:{pfcVrms:230,pfcPower:2000,pfcBus:400,pfcC:500,pfcHz:60,pfcL:500},change:{pfcC:1000},
     inputs:{pfcVrms:['vrms',1],pfcPower:['powerW',1],pfcBus:['vbus',1],pfcC:['busCapF',1e-6],pfcHz:['lineHz',1],pfcL:['inductanceH',1e-6]},
     setup:'這次使用交流 230 V、2000 W、直流端 400 V、60 Hz，電感 500 µH。這是 PFC 的指定條件，不承接 Buck 的儲能狀態。',action:'把直流端電容從 500 改為 1000 µF',
     question:'其他條件相同，電壓起伏的幅度會？',answer:'lower',metrics:[['busRippleVpk','電壓起伏幅度','V'],['outerPoleHz','慢速反應的轉折頻率','Hz'],['doubleLineHz','供電帶來的起伏頻率','Hz']],
     reason:'電容較大，同樣的能量起伏造成較小的電壓變動；起伏頻率仍由交流供電決定。',wrong:'電容加大，會把交流供電頻率也減半。',boundary:'這是平均能量模型；供電帶來的 120 Hz 起伏不是控制模型的極點，也不代表已算出輸入電流失真。'},
    {id:'psfb',label:'隔離電源（PSFB）',title:'電流變小，開關還能輕鬆切換嗎？',modelId:'psfb-ideal-output',section:'psfb',
     baseline:{psfbVin:400,psfbPhase:90,psfbN:.08,psfbLlk:8,psfbI:10,psfbCoss:1,psfbLo:100,psfbCo:480,psfbR:4},change:{psfbI:2},
     inputs:{psfbVin:['vin',1],psfbPhase:['phaseDeg',1],psfbN:['turnsRatio',1],psfbLlk:['leakageH',1e-6],psfbI:['primaryCurrentA',1],psfbCoss:['commutationCapF',1e-9],psfbLo:['outputInductanceH',1e-6],psfbCo:['outputCapacitanceF',1e-6],psfbR:['loadOhm',1]},
     setup:'使用 400 V、90 度相移、0.08 匝數比、8 µH 漏感與 1 nF 換流電容。這次獨立改變主側電流，估算換流能量，不把它假裝成完整的負載暫態。',action:'把主側電流從 10 改為 2 A',
     question:'可用能量相對於切換所需能量的比例會？',answer:'lower',metrics:[['zvsEnergyMargin','可用／所需換流能量','倍'],['idealSecondaryV','理想輸出映射','V']],
     reason:'電流變小，漏感儲存的能量減少；理想輸出公式看起來正常，也不能證明開關已達到低損耗切換。',wrong:'只要理想輸出電壓不變，實際開關就一定能零電壓切換。',boundary:'換流能量比只是估算，不能當成真板 ZVS（零電壓切換）證據。輸出映射也未包含換流造成的有效占空比損失。'},
    {id:'llc',label:'諧振電源（LLC）',title:'換個開關速度，輸出比例還一樣嗎？',modelId:'llc-normalized-fha',section:'llc',
     baseline:{llcLr:20,llcCr:100,llcLm:120,llcQ:.5,llcFs:120},change:{llcFs:180},
     inputs:{llcLr:['resonantInductanceH',1e-6],llcCr:['resonantCapF',1e-9],llcLm:['magnetizingInductanceH',1e-6],llcQ:['q',1],llcFs:['switchingHz',1e3]},
     setup:'使用 20 µH 諧振電感、100 nF 電容、120 µH 激磁電感，負載參數 Q=0.5。這組條件從共振點稍高的位置開始。',action:'把開關頻率從 120 改為 180 kHz',
     question:'在這組指定條件下，穩定輸出比例會？',answer:'lower',metrics:[['gain','正規化穩定增益','倍'],['normalizedFrequency','開關／共振頻率','倍']],
     reason:'儲能元件對頻率的反應不同；工作位置換了，就要重新確認輸出比例，不能把一個位置的模型套到全部範圍。',wrong:'開關速度加快，任何 LLC 工作條件的輸出都一定變大。',boundary:'FHA 是穩態近似。這條增益曲線不能當成啟動波形、控制迴路相位或真實開關損耗。'},
    {id:'inverter',label:'逆變器',title:'濾波電容加大，容易共振的位置會移到哪？',modelId:'inverter-filter-plant',section:'inverter',
     baseline:{invMode:'lcl',invVdc:400,invM:.8,invL1:2,invC:10,invL2:1,invR:20},change:{invC:20},
     inputs:{invMode:['mode',1],invVdc:['dcBusV',1],invM:['modulationIndex',1],invL1:['l1H',1e-3],invC:['capF',1e-6],invL2:['l2H',1e-3],invR:['loadOhm',1]},
     setup:'這次選併網 LCL：兩個電感為 2 mH 與 1 mH，直流端 400 V、調變比例 0.8。這是理想電網與無阻尼濾波器的比較。',action:'把濾波電容從 10 改為 20 µF',
     question:'濾波器的共振頻率會？',answer:'lower',metrics:[['resonanceHz','共振頻率','Hz'],['fundamentalVrms','理想橋臂基波','Vrms']],
     reason:'儲能元件的組合變了，共振位置也會改變；在加快控制之前，必須重新檢查阻尼與電網條件。',wrong:'只要增加電容，所有共振就會消失，也不再需要阻尼。',boundary:'此模型沒有真實阻尼與電網阻抗。共振點的理想奇異值不是實際可達到的電壓或電流。'}
  ];
  return {applicationLessons,topologySteps,workbenchLessons,views,taxonomy,moduleTopics,faultTaxonomy,diagnosticChain,viewTopics};
});
