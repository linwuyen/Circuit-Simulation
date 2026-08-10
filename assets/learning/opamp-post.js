(function(root){
  "use strict";
  const Learning=root.CircuitLearning;if(!Learning)return;
  function fix(){document.querySelectorAll('.v8-validity-summary').forEach(el=>{el.innerHTML=el.innerHTML.replace(/(\d+)\/12 modules anchored/g,'$1/13 modules anchored');});const d=document.getElementById('diagnosticCoverageV8');if(d&&/ACMC。/.test(d.textContent))d.innerHTML=d.innerHTML.replace('ACMC。','ACMC / OP AMP。');}
  ['renderHome','renderLabs','renderProgress','renderQuiz','renderTrouble','renderReport'].forEach(name=>{const original=Learning[name];if(typeof original!=="function"||original.__opampPost)return;const wrapped=function(){const value=original.apply(this,arguments);fix();return value;};wrapped.__opampPost=true;Learning[name]=wrapped;});
  root.CircuitOpampPost={version:'1.0.0',fix};
})(window);