/* ===========================================================
   共用導覽 / 進度元件
   用法：頁面 <body data-lesson="N"> 之後載入本檔，
   並在需要的地方放 <div id="topnav"></div> 與 <div id="botnav"></div>。
   進度存在 localStorage，按「下一課」會把目前這課標記為完成。
   =========================================================== */
(function(){
  var LESSONS = [
    { id:0, file:'0_index.html',            icon:'🗺️', label:'總覽',     title:'整條訊號鏈的大局' },
    { id:1, file:'1_adc_basics.html',       icon:'🔢', label:'ADC 基礎', title:'ADC 怎麼把電壓變成數字' },
    { id:2, file:'2_current_to_voltage.html',icon:'⚡', label:'電流→電壓',title:'Shunt 分流 + 放大器' },
    { id:3, file:'3_why_offset.html',       icon:'↕️', label:'為何墊高', title:'Offset 與雙向量測' },
    { id:4, file:'4_voltage_divider.html',  icon:'🪜', label:'高壓分壓', title:'分壓電阻與發熱' },
    { id:5, file:'5_firmware_scaling.html', icon:'💻', label:'韌體還原', title:'K 係數與 C code' },
    { id:6, file:'6_full_calculator.html',  icon:'🧮', label:'實戰計算器',title:'綜合驗證工具' }
  ];
  var KEY = 'c2000_adc_progress';

  function load(){ try{ return JSON.parse(localStorage.getItem(KEY)||'{}'); }catch(e){ return {}; } }
  function save(o){ try{ localStorage.setItem(KEY, JSON.stringify(o)); }catch(e){} }
  function markDone(id){ var p=load(); p[id]=1; save(p); }

  var cur = parseInt(document.body.getAttribute('data-lesson'),10);
  var done = load();

  /* ---- 頂部進度列 ---- */
  var top = document.getElementById('topnav');
  if(top){
    var html = '<div class="lpro"><div class="track">';
    LESSONS.forEach(function(L){
      var cls = 'step' + (L.id===cur?' cur':'') + (done[L.id]?' done':'');
      var mark = done[L.id] && L.id!==cur ? '✓' : L.id;
      html += '<a class="'+cls+'" href="'+L.file+'" title="'+L.title+'">'+
              '<span class="b">'+mark+'</span><span class="t">'+L.icon+' '+L.label+'</span></a>';
    });
    html += '</div></div>';
    top.innerHTML = html;
  }

  /* ---- 底部上一課 / 下一課 ---- */
  var bot = document.getElementById('botnav');
  if(bot){
    var prev = LESSONS[cur-1], next = LESSONS[cur+1];
    var h = '<div class="lnav">';
    h += prev
      ? '<a href="'+prev.file+'"><div class="k">← 上一課</div><div class="t">'+prev.icon+' '+prev.label+'</div></a>'
      : '<a class="disabled"><div class="k">← 上一課</div><div class="t">已是第一課</div></a>';
    h += next
      ? '<a class="next" href="'+next.file+'" id="nextBtn"><div class="k">下一課 →</div><div class="t">'+next.icon+' '+next.label+'</div></a>'
      : '<a class="next disabled"><div class="k">下一課 →</div><div class="t">已是最後一課 🎉</div></a>';
    h += '</div>';
    bot.innerHTML = h;
    var nb = document.getElementById('nextBtn');
    if(nb){ nb.addEventListener('click', function(){ markDone(cur); }); }
  }

  // 對外：頁面可呼叫 C2000.markDone() 在「我學會了」時手動標記
  window.C2000 = { markDone:function(){ markDone(cur); }, lessons:LESSONS };
})();
