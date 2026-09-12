import test from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),U=require('../assets/learning/unified-learning.js');
test('record routes use canonical identifiers and keep unknown inputs internal',()=>{
 assert.equal(U.recordRoute('experiment','energy'),'index.html#experiment-energy');
 assert.equal(U.recordRoute('applications','llc'),'17_power_topology_control/index.html?lesson=llc#guided-applications');
 assert.equal(U.recordRoute('topology-assessment','topology-psfb-scaling'),'quiz.html?module=power-topology-control&family=topology-psfb-scaling');
 assert.equal(U.recordRoute('applications','https://evil.invalid'),U.route('applications'));
 assert.equal(U.recordRoute('topology-assessment','buck-ripple-inductance-transfer'),U.route('topology-assessment'));
 assert.equal(U.recordRoute('https://evil.invalid','x'),U.route('home'));
});
