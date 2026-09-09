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
  return {views,taxonomy,moduleTopics,faultTaxonomy,diagnosticChain,viewTopics};
});
