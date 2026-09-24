(function(root,factory){
  const api=factory();
  if(typeof module==="object"&&module.exports)module.exports=api;
  root.CircuitTIConceptLabCore=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";
  const STAGES=["predict","diagnose","transfer"];

  function validate(cardsDoc,labsDoc){
    const errors=[];
    const cards=cardsDoc?.cards||[],labs=labsDoc?.labs||[];
    const byLab=new Map(labs.map(x=>[x.id,x]));
    if(cards.length!==labs.length)errors.push(`card/lab count mismatch: ${cards.length}/${labs.length}`);
    for(const card of cards){
      const lab=byLab.get(card.id);
      if(!lab){errors.push("missing lab: "+card.id);continue;}
      for(const stage of STAGES){
        const s=lab.stages?.[stage];
        if(!s?.prompt||!Array.isArray(s.choices)||s.choices.length<2)errors.push(`invalid ${stage}: ${card.id}`);
        if(s&&!s.choices.some(c=>c[0]===s.expected))errors.push(`expected choice missing: ${card.id}/${stage}`);
      }
    }
    for(const lab of labs)if(!cards.some(c=>c.id===lab.id))errors.push("orphan lab: "+lab.id);
    return {valid:errors.length===0,errors,cardCount:cards.length,labCount:labs.length};
  }

  function freshSession(id=1){
    return {id,startedAt:new Date().toISOString(),attempts:{},stage:"predict",completed:false};
  }
  function normalize(record={}){
    const session=record.session&&typeof record.session==="object"?record.session:freshSession((record.sessions?.length||0)+1);
    session.attempts=session.attempts&&typeof session.attempts==="object"?session.attempts:{};
    session.stage=STAGES.includes(session.stage)?session.stage:"predict";
    return {...record,sessions:Array.isArray(record.sessions)?record.sessions:[],session};
  }
  function grade(record={}){
    const r=normalize(record),a=r.session.attempts;
    const passed=STAGES.filter(s=>a[s]?.passed).length;
    const attempted=STAGES.filter(s=>a[s]).length;
    const all=passed===STAGES.length;
    if(all){
      const firstPerfect=STAGES.every(s=>a[s]?.firstCorrect===true);
      return firstPerfect?"transfer":"pass";
    }
    if(attempted===0)return null;
    if(passed===0)return "fail";
    return "partial";
  }
  function nextStage(record={}){
    const r=normalize(record);
    return STAGES.find(s=>!r.session.attempts[s]?.passed)||null;
  }
  function applyAttempt(record,stage,answer,expected,at=new Date().toISOString()){
    if(!STAGES.includes(stage))throw new Error("unknown stage: "+stage);
    const r=normalize(record),session={...r.session,attempts:{...r.session.attempts}};
    const prev=session.attempts[stage]||null;
    const correct=answer===expected;
    const entry={
      firstAnswer:prev?.firstAnswer??answer,
      firstCorrect:prev?.firstCorrect??correct,
      lastAnswer:answer,
      passed:!!prev?.passed||correct,
      attempts:Number(prev?.attempts||0)+1,
      lastAt:at
    };
    session.attempts[stage]=entry;
    const pending=STAGES.find(s=>!session.attempts[s]?.passed)||null;
    session.stage=pending||"transfer";
    session.completed=pending===null;
    if(session.completed&&!session.completedAt)session.completedAt=at;
    const next={...r,session,updatedAt:at};
    return {...next,grade:grade(next),nextStage:nextStage(next),completed:session.completed};
  }
  function startReview(record={},at=new Date().toISOString()){
    const r=normalize(record);
    const archived={...r.session};
    const id=Number(r.session.id||0)+1;
    return {...r,sessions:[...r.sessions,archived].slice(-12),session:freshSession(id),reviewStartedAt:at,updatedAt:at,completed:false,grade:null,nextReview:null};
  }
  function prerequisiteStatus(card,state={}){
    const missing=[];
    for(const id of card?.prerequisites||[]){
      const generic=state.benchmark?.tiConceptLabs?.[id];
      const specialized=state.benchmark?.tiEngineeringLearning?.concepts?.[id];
      const done=generic?.completed===true||generic?.session?.completed===true||Number(specialized?.progress||0)>=4;
      if(!done)missing.push(id);
    }
    return {unlocked:missing.length===0,missing};
  }
  return {STAGES,validate,freshSession,normalize,grade,nextStage,applyAttempt,startReview,prerequisiteStatus};
});
