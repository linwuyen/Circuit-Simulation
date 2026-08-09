(function(root,factory){
  "use strict";
  const api=factory();if(typeof module==="object"&&module.exports)module.exports=api;root.CircuitMutationV8=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";
  const VERSION="8.0.0";
  const obs=(text,hidden)=>({text:String(text),hidden:!!hidden});
  function baseCases(){return[
    {id:"buck-scale",labId:"buck.lab.buck-ripple",snapshot:{controls:{ind:11.9625,fsw:500,load:2}},mutateRegistry:(Registry)=>({get:id=>Registry.get(id),run:(id,input)=>{const out=Registry.run(id,input);return id==="buck-ripple-ccm"?{...out,deltaIA:out.deltaIA*1.1}:out;}})},
    {id:"adc-divider-scale",labId:"adc.lab.adc-divider",snapshot:{controls:{rtop:1000,rbot:4.7,bus2:400}},mutateRegistry:(Registry)=>({get:id=>Registry.get(id),run:(id,input)=>{const out=Registry.run(id,input);return id==="adc-divider"?{...out,adcInputV:out.adcInputV*1.1}:out;}})},
    {id:"inverter-hidden-warning",labId:"inverter.lab.inv-shoot",snapshot:{observed:{"status-q1":obs("ON"),"status-q2":obs("ON"),"short-circuit-warning":obs("shoot-through",true)}}},
    {id:"foc-swap-dq",labId:"foc.lab.foc-park",snapshot:{controls:{"p-d":30},observed:{"r-vd":obs(0.6928),"r-vq":obs(0.4),"r-fp":obs("theta θ locked frame")}}},
    {id:"pi-hz-times-two",labId:"pi.lab.pi-ki",snapshot:{controls:{"ki-slider":1000},observed:{"f0-val":obs("318.31 Hz")}}},
    {id:"spi-service-double",labId:"spi.lab.spi-fifo",snapshot:{controls:{scenario:"isr1",sclk:10,bits:16,gap:0,isrOv:200},observed:{mTa:obs("1600 ns"),mTs:obs("800 ns")}}},
    {id:"loop-margin-sign",labId:"loop10us.lab.loop-budget",snapshot:{controls:{acq:600,cpu:2000,pay:8},observed:{"s-crit":obs("2640 ns"),"s-margin":obs("-7360 ns")}}},
    {id:"bms-contactor-stuck",labId:"bms.lab.bms-failsafe",snapshot:{interaction:{dataset:{fault:"ov"}},observed:{"system-state":obs("FAULT_LOCK"),contactor:obs("CLOSED")}}},
    {id:"dac-off-by-one",labId:"ad5543.lab.dac-code",snapshot:{controls:{want:2.5,cvref:5,cmode:"positive"},observed:{calcOut:obs("D = 32769")}}},
    {id:"afe-sin-instead-cos",labId:"afe.lab.afe-phase",snapshot:{controls:{"ps-phase":60},observed:{"ps-pf":obs("0.866")}}},
    {id:"acmc-ready-instead-trip",labId:"acmc-pro.lab.acmc-protection",snapshot:{controls:{"ctrl-load":2200,"ctrl-ocp":10,"ctrl-offset":0},metrics:["估計峰值電流 14.14 A","保護原因 READY"]}},
    {id:"dds-watts-sign",labId:"c2000-dds.lab.dds-pf",snapshot:{controls:{"ctrl-phase":60,"ctrl-vrms":20,"ctrl-irms":2},metrics:["Total PF 0.5","實功 P -20 W"]}}
  ];}
  function run(Oracles,Registry){if(!Oracles||!Registry)throw new Error("mutation campaign requires oracles and registry");const results=baseCases().map(c=>{const registry=c.mutateRegistry?c.mutateRegistry(Registry):Registry,result=Oracles.verify(c.labId,c.snapshot,registry);const detected=!(result&&result.passed);return{id:c.id,labId:c.labId,detected,result};});return{version:VERSION,total:results.length,detected:results.filter(x=>x.detected).length,rate:results.length?results.filter(x=>x.detected).length/results.length:0,results};}
  return{VERSION,baseCases,run};
});
