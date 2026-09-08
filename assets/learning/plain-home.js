(()=>{
 'use strict';
 const E=CircuitEvidence,P=CircuitPlainCourse,U=CircuitUnifiedLearning,root=document.getElementById('app');
 U.registerModules(CircuitLearningMap);
 function render(){
  const state=E.load(),basic=state.benchmark.beginnerLessons?.rows||{},bridge=state.benchmark.bridgeLessons?.rows||{};
  const course=[...CircuitUnifiedLearning.basics.map(([id],i)=>({id,row:basic[id],title:['開久一點，輸出會怎樣？','關掉開關，電流就停了嗎？','用電變少，哪裡不同？','數字變小，就是電流變小嗎？','算完，就立刻生效嗎？'][i],href:'15_power_capstone/learn_basics.html#'+id})),...P.bridge.map(l=>({...l,row:bridge[l.id],href:'control-basics.html#'+l.id}))];
  const recommendation=U.next(state,CircuitCoreFlowV1.snapshot()),recommendedId=recommendation.id.replace(/^(basic|bridge)-/,'');
  const next=course.find(l=>l.id===recommendedId),done=course.filter(l=>P.proven(l.row)),st=next?P.stage(next.row):4;
  root.replaceChildren();root.className='simple-home';
  const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text)n.textContent=text;if(cls)n.className=cls;return n;};
  const header=el('header',null,'simple-header');header.append(el('strong','電子模擬・一步一步學'));root.append(header);
  const reviewing=['formal','quiz'].includes(recommendation.id);
  const card=el('section',null,'simple-task');card.append(el('p',next?`第 ${course.indexOf(next)+1} 課，共 8 課`:reviewing?'接續複習':done.length===8?'八課已完成練習':'接續你選擇的進階課程'),el('h1',next?next.title:reviewing?'再想一次，看看還記得多少':'把學到的觀念，帶進完整電路'),el('p',next?['先猜一次，再用畫面檢查。答錯也沒關係。','接著觀察：說出你看到的變化。','接著說原因：為什麼會這樣？','最後換個條件，自己判斷。'][st]:reviewing?'之前安排的複習到了。完成後，再接續課程。':recommendation.remediation?'先做與卡點相關的短練習，完成後回到原本的題目。':'依照已有的進度，接著做下一個練習。'));
  const a=el('a',next?(next.row?.first?'繼續這一課':'開始這一課'):reviewing?'開始複習':'接著做這個練習','simple-primary');a.href=next?.href||(recommendation.remediation?U.remediationRoute(recommendation.id,recommendation.remediation):U.route(recommendation.id));if(recommendation.remediation)a.onclick=()=>U.beginReturn(recommendation.id,recommendation.remediation);card.append(a);
  if(next?.row?.transferPassed&&!P.proven(next.row))card.append(el('p','舊版練習紀錄已保留。這次補上「看見什麼、為什麼」兩個判斷，讓進度更有意義。'));
  root.append(card);
  const status=el('section');status.append(el('h2','我現在會什麼？'),el('p',done.length?`已完成 ${done.length} / 8 課；最近練習：${done.at(-1).title}`:'從第一課開始：看懂開關時間怎麼影響輸出。'),el('p',next?.row?.first&&!next.row.first.correct?'曾卡住的地方：第一次預測與結果不同。回到這一課，比較前後變化即可接著學。':'每課只處理一個問題，不用先背縮寫或公式。'));root.append(status);
  const plan=el('details',null,'simple-plan');plan.append(el('summary','查看八課順序／重看學過的課'));const list=el('ol');for(const l of course){const li=el('li'),link=el('a',`${P.proven(l.row)?'已練習':'待練習'}：${l.title}`);link.href=l.href;li.append(link);list.append(li);}plan.append(list);root.append(plan);
  const footer=el('footer',null,'simple-extras'),details=el('details');details.append(el('summary','已經有基礎？打開工具與完整教材'));
  for(const [href,title]of [['catalog.html','完整教材'],['map.html','能力地圖與學習紀錄'],['learning-case.html','自由實驗：比較改動前後'],['teaching-review.html','教學試用觀察表']]){const link=el('a',title);link.href=href;details.append(link,el('br'));}footer.append(details);root.append(footer);
 }
 render();window.addEventListener('pageshow',render);window.addEventListener('storage',render);
})();
