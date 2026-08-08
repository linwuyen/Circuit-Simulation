import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const require=createRequire(import.meta.url);
const Schema=require('../assets/learning/curriculum-schema-v3.js');
const Contracts=require('../assets/learning/lab-verification-contracts.js');
const Oracles=require('../assets/learning/lab-oracles.js');
const Registry=require('../assets/learning/model-registry.js');

function curriculum(){
  const source=readFileSync(new URL('../assets/learning/curriculum.js',import.meta.url),'utf8');
  const sandbox={window:{}};vm.runInNewContext(source,sandbox);
  return Schema.normalizeCurriculum(sandbox.window.CircuitCurriculum);
}

test('all 38 labs are classified and every module has an A-capable path',()=>{
  const c=curriculum(),coverage=Contracts.coverage(c),errors=Contracts.validate(c,Oracles);
  assert.deepEqual(errors,[]);
  assert.equal(coverage.total,38);
  assert.equal(coverage.classified,38);
  assert.equal(coverage.unclassified.length,0);
  assert.equal(coverage.modules.length,12);
  assert.ok(coverage.modules.every(row=>row.classified===row.total));
  assert.ok(coverage.modules.every(row=>row.aCapable>=1));
  assert.ok(coverage.aCapable>=12);
});

test('A contracts are backed by real oracle definitions and B contracts are explicitly capped',()=>{
  const a=Contracts.list.filter(x=>x.gradeCeiling==='A'),b=Contracts.list.filter(x=>x.gradeCeiling==='B');
  assert.ok(a.length>=12);assert.ok(b.length>0);
  assert.ok(a.every(x=>Oracles.supports(x.labId)));
  assert.ok(b.every(x=>x.method==='machine-contract'));
  assert.ok(b.some(x=>/heuristic|diagnostic|artifact|procedure|judgment/i.test(x.modelScope)));
});

test('all A-grade reasoning profiles fail closed on fluent nonsense',()=>{
  const bad={prediction:'參數改變所以結果會下降。',observation:'結果是 1.23。',explanation:'因為月亮很亮所以工程結果就是這樣。',limitations:'香蕉是唯一限制。',transfer:'換一組條件再看看。'};
  for(const contract of Contracts.list.filter(x=>x.gradeCeiling==='A')){
    const gate=Contracts.reasoningGate(contract.labId,bad);
    assert.equal(gate.passed,false,contract.labId);
  }
});

test('black-box page references reject corrupted outputs',()=>{
  const piGood=Oracles.verify('pi.lab.pi-ki',{controls:{'ki-slider':'5000'},observed:{'f0-val':{text:'795.77 Hz'}}},Registry);
  const piBad=Oracles.verify('pi.lab.pi-ki',{controls:{'ki-slider':'5000'},observed:{'f0-val':{text:'900 Hz'}}},Registry);
  assert.equal(piGood.passed,true);assert.equal(piBad.passed,false);

  const spiGood=Oracles.verify('spi.lab.spi-fifo',{controls:{scenario:'isr1',sclk:'12.5',bits:'16',gap:'0',isrOv:'800'},observed:{mTa:{text:'1280 ns'},mTs:{text:'1000 ns'}}},Registry);
  const spiBad=Oracles.verify('spi.lab.spi-fifo',{controls:{scenario:'isr1',sclk:'12.5',bits:'16',gap:'0',isrOv:'800'},observed:{mTa:{text:'1280 ns'},mTs:{text:'700 ns'}}},Registry);
  assert.equal(spiGood.passed,true);assert.equal(spiBad.passed,false);
});

test('FOC, loop, DAC and phase-power oracles compare independent math to page outputs',()=>{
  const foc=Oracles.verify('foc.lab.foc-park',{controls:{'p-d':'15'},observed:{'r-vd':{text:'0.207'},'r-vq':{text:'0.773'},'r-fp':{text:'θ'}}},Registry);
  assert.equal(foc.passed,true);

  const loop=Oracles.verify('loop10us.lab.loop-budget',{controls:{acq:'600',cpu:'1500',pay:'16'},observed:{'s-crit':{text:'3320 ns'},'s-margin':{text:'6680 ns'}}},Registry);
  assert.equal(loop.passed,true);

  const dac=Oracles.verify('ad5543.lab.dac-code',{controls:{want:'-3.5',cvref:'10',cmode:'standard'},observed:{calcOut:{text:'要寫入的數位碼 0x599A 十進位 D = 22938 比例'}}},Registry);
  assert.equal(dac.passed,true);

  const afe=Oracles.verify('afe.lab.afe-phase',{controls:{'ps-phase':'60'},observed:{'ps-pf':{text:'0.500'}}},Registry);
  assert.equal(afe.passed,true);

  const dds=Oracles.verify('c2000-dds.lab.dds-pf',{controls:{'ctrl-phase':'30','ctrl-vrms':'120','ctrl-irms':'10'},metrics:['實功 P 1039.2 W mean(v[n]×i[n])','Total PF 0.8660 P/(Vrms×Irms)','DPF 0.8660 cosφ']},Registry);
  assert.equal(dds.passed,true);
});

test('safety invariants require the actual hazardous transition and safe convergence',()=>{
  const invFail=Oracles.verify('inverter.lab.inv-shoot',{observed:{'status-q1':{text:'ON'},'status-q2':{text:'ON'},'short-circuit-warning':{text:'直通短路',hidden:true}}},Registry);
  const invPass=Oracles.verify('inverter.lab.inv-shoot',{observed:{'status-q1':{text:'ON'},'status-q2':{text:'ON'},'short-circuit-warning':{text:'直通短路',hidden:false}}},Registry);
  assert.equal(invFail.passed,false);assert.equal(invPass.passed,true);

  const bmsFail=Oracles.verify('bms.lab.bms-failsafe',{interaction:{dataset:{fault:'ovp'}},observed:{'system-state':{text:'STANDBY'},contactor:{text:'斷開 OPEN'}}},Registry);
  const bmsPass=Oracles.verify('bms.lab.bms-failsafe',{interaction:{dataset:{fault:'ovp'}},observed:{'system-state':{text:'FAULT_LOCK'},contactor:{text:'斷開 OPEN'}}},Registry);
  assert.equal(bmsFail.passed,false);assert.equal(bmsPass.passed,true);
});

test('ACMC A evidence remains explicitly a teaching estimate, not hardware certification',()=>{
  const result=Oracles.verify('acmc-pro.lab.acmc-protection',{controls:{'ctrl-load':'1200','ctrl-ocp':'8.5','ctrl-offset':'2'},metrics:['估計峰值電流 7.7 A P/220×√2','保護原因 DC SAT 門檻示意','DC 偏壓 2.0 V']},Registry);
  assert.equal(result.passed,true);
  assert.match(result.acceptance.scope,/not hardware certification/i);
  assert.equal(Contracts.get('acmc-pro.lab.acmc-protection').modelScope,'teaching-estimate');
});