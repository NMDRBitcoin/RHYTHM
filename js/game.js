(() => {
  const $=s=>document.querySelector(s);
  const menu=$("#menuScreen"),game=$("#gameScreen"),result=$("#resultScreen");
  const songSelect=$("#songSelect"),diffSelect=$("#difficultySelect"),startBtn=$("#startBtn");
  const lanesEl=$("#lanes"),audio=$("#audio"),video=$("#loopVideo"),fallback=$("#videoFallback"),comboSound=$("#comboSound");
  const scoreEl=$("#score"),comboEl=$("#combo"),accEl=$("#accuracy"),judgeEl=$("#judgement"),countdown=$("#countdown");
  const playCombo=$("#playCombo"),playComboNumber=$("#playComboNumber");
  const celebration=$("#celebration"),celebrationCount=$("#celebrationCount"),celebrationMessage=$("#celebrationMessage");
  const laneEls=[...document.querySelectorAll(".lane")],keyLabels=[...document.querySelectorAll(".key-label")];
  const keyToLane={d:0,f:1,j:2,k:3};
  let notes=[],chart={},playing=false,raf=0,score=0,combo=0,maxCombo=0,judged=0,qualitySum=0;
  let counts={perfect:0,great:0,good:0,miss:0},held=[false,false,false,false],activeHolds=[null,null,null,null],sparkTimers=[null,null,null,null];
  const approachMs=1700,hitLineBottom=74;

  function show(s){[menu,game,result].forEach(x=>x.classList.remove("active"));s.classList.add("active")}
  function populate(){
    const songs=Array.isArray(window.NMDR_SONGS)?window.NMDR_SONGS:[];
    songSelect.innerHTML="";
    songs.forEach((s,i)=>{const o=document.createElement("option");o.value=i;o.textContent=s.title+(s.hasAudio===false?" [NO AUDIO]":"");songSelect.appendChild(o)});
    if(!songs.length){const o=document.createElement("option");o.textContent="songs 폴더에 곡을 추가하세요";songSelect.appendChild(o);startBtn.disabled=true;return}
    updateMenu()
  }
  function updateMenu(){
    const s=(window.NMDR_SONGS||[])[+songSelect.value||0];if(!s)return;
    if(s.cover){$("#coverImg").src=s.cover;$("#coverImg").style.display="block"}else $("#coverImg").style.display="none";
    $("#nowPlaying").textContent=s.title;startBtn.disabled=(s.hasAudio===false||!s.audio);startBtn.textContent=startBtn.disabled?"ADD song.mp3":"START"
  }
  songSelect.addEventListener("change",updateMenu);

  async function loadChart(){
    const s=window.NMDR_SONGS[+songSelect.value||0],diff=diffSelect.value;
    if(!s||!s.audio)throw new Error("이 곡 폴더에 song.mp3가 없습니다.");
    chart=s.embeddedCharts&&s.embeddedCharts[diff];if(!chart)throw new Error("채보가 없습니다.");
    notes=(chart.notes||[]).map((n,i)=>({...n,duration:+n.duration||0,id:i,hit:false,missed:false,holding:false,completed:false,el:null}));
    audio.src=s.audio;
    if(s.video){video.src=s.video}else{video.removeAttribute("src");video.load()}
    $("#nowPlaying").textContent=s.title;$("#difficultyLabel").textContent=diff.toUpperCase();
    fallback.style.display="grid";
    video.addEventListener("loadeddata",()=>fallback.style.display="none",{once:true});
    video.addEventListener("error",()=>fallback.style.display="grid",{once:true})
  }
  function resetStats(){
    score=combo=maxCombo=judged=qualitySum=0;counts={perfect:0,great:0,good:0,miss:0};
    held.fill(false);activeHolds.fill(null);laneEls.forEach((l,i)=>stopHoldFx(i));updateHud()
  }
  function updateHud(){
    scoreEl.textContent=score.toLocaleString();comboEl.textContent=combo;
    accEl.textContent=(judged?qualitySum/judged*100:100).toFixed(2)+"%";
    if(combo>0){playCombo.classList.add("visible");playComboNumber.textContent=combo;playCombo.classList.remove("pop");void playCombo.offsetWidth;playCombo.classList.add("pop")}
    else playCombo.classList.remove("visible")
  }
  function laneColor(i){return getComputedStyle(laneEls[i]).getPropertyValue("--lane")}
  function makeNoteEl(n){
    const el=document.createElement("div");el.className="note"+(n.duration>0?" hold-note":"");el.style.setProperty("--lane",laneColor(n.lane));
    laneEls[n.lane].appendChild(el);n.el=el
  }
  function tms(){return audio.currentTime*1000}
  function render(){
    if(!playing)return;
    const t=tms(),laneH=lanesEl.clientHeight,judgeY=laneH-hitLineBottom;
    notes.forEach(n=>{
      if(n.completed||n.missed)return;
      const start=n.time*1000,end=(n.time+n.duration)*1000;
      if(!n.holding&&t-start>150){markMiss(n);return}
      if(n.holding){
        if(!held[n.lane]){breakHold(n);return}
        if(t>=end-80){completeHold(n);return}
      }
      const dt=start-t;
      if(dt>approachMs+250)return;
      if(!n.el)makeNoteEl(n);
      const progress=1-(dt/approachMs),headY=Math.max(-30,Math.min(judgeY,progress*judgeY));
      if(n.duration>0){
        const pxPerMs=judgeY/approachMs,body=Math.max(18,n.duration*1000*pxPerMs);
        n.el.style.height=body+"px";
        n.el.style.top=(headY-body+9)+"px";
        if(n.holding){n.el.style.bottom=hitLineBottom+"px";n.el.style.top="auto";n.el.style.height=Math.max(18,(end-t)*pxPerMs)+"px"}
      }else n.el.style.top=(headY-9)+"px"
    });
    raf=requestAnimationFrame(render)
  }
  function judgement(text){judgeEl.textContent=text;judgeEl.classList.remove("pop");void judgeEl.offsetWidth;judgeEl.classList.add("pop")}
  function grade(d){
    if(d<=45)return["PERFECT",1,1000,"perfect"];
    if(d<=90)return["GREAT",.8,700,"great"];
    return["GOOD",.5,400,"good"]
  }
  function addSuccess(label,q,pts,key){
    counts[key]++;judged++;qualitySum+=q;combo++;maxCombo=Math.max(maxCombo,combo);score+=pts+Math.min(combo,100)*5;
    judgement(label);updateHud();if(combo%100===0)celebrate(combo)
  }
  function press(lane){
    if(!playing||held[lane])return;held[lane]=true;keyLabels[lane].classList.add("pad-active");flash(lane);
    const t=tms(),cand=notes.filter(n=>!n.hit&&!n.missed&&!n.holding&&n.lane===lane).map(n=>({n,d:Math.abs(n.time*1000-t)})).filter(x=>x.d<=150).sort((a,b)=>a.d-b.d)[0];
    if(!cand)return;
    const n=cand.n,[label,q,pts,key]=grade(cand.d);n.hit=true;
    if(n.duration>0){
      n.holding=true;activeHolds[lane]=n;if(n.el)n.el.classList.add("holding");startHoldFx(lane);
      addSuccess(label,q,pts,key)
    }else{
      n.completed=true;if(n.el)n.el.remove();addSuccess(label,q,pts,key)
    }
  }
  function release(lane){
    held[lane]=false;keyLabels[lane].classList.remove("pad-active");
    const n=activeHolds[lane];
    if(n&&n.holding&&!n.completed){
      const remain=(n.time+n.duration)*1000-tms();
      if(remain<=130)completeHold(n);else breakHold(n)
    }
  }
  function completeHold(n){
    if(n.completed)return;n.completed=true;n.holding=false;activeHolds[n.lane]=null;stopHoldFx(n.lane);
    if(n.el)n.el.remove();score+=500;judgement("HOLD COMPLETE");burst(n.lane);updateHud()
  }
  function breakHold(n){
    if(n.completed||n.missed)return;n.missed=true;n.holding=false;activeHolds[n.lane]=null;stopHoldFx(n.lane);
    if(n.el)n.el.remove();counts.miss++;judged++;combo=0;judgement("HOLD BREAK");updateHud()
  }
  function markMiss(n){
    n.missed=true;if(n.el)n.el.remove();counts.miss++;judged++;combo=0;judgement("MISS");updateHud()
  }
  function flash(lane){laneEls[lane].classList.add("active");setTimeout(()=>laneEls[lane].classList.remove("active"),160);burst(lane)}
  function burst(lane){const b=document.createElement("div");b.className="hit-burst";laneEls[lane].appendChild(b);setTimeout(()=>b.remove(),300)}
  function startHoldFx(lane){
    laneEls[lane].classList.add("hold-active");stopSparkTimer(lane);
    sparkTimers[lane]=setInterval(()=>{
      const s=document.createElement("i");s.className="hold-spark";s.style.left=(20+Math.random()*60)+"%";s.style.setProperty("--lane",laneColor(lane));laneEls[lane].appendChild(s);setTimeout(()=>s.remove(),750)
    },110)
  }
  function stopSparkTimer(lane){if(sparkTimers[lane]){clearInterval(sparkTimers[lane]);sparkTimers[lane]=null}}
  function stopHoldFx(lane){laneEls[lane].classList.remove("hold-active");stopSparkTimer(lane);keyLabels[lane].classList.remove("pad-active")}
  function celebrate(n){
    const msgs=["YOU'RE AWESOME!","AMAZING!","UNSTOPPABLE!","LEGENDARY!"];
    celebrationCount.textContent=n+" COMBO";celebrationMessage.textContent=msgs[(Math.floor(n/100)-1)%msgs.length];
    celebration.classList.remove("show");void celebration.offsetWidth;celebration.classList.add("show");setTimeout(()=>celebration.classList.remove("show"),1200);
    try{comboSound.currentTime=0;comboSound.volume=.38;comboSound.play().catch(()=>{})}catch(e){}
  }
  function bind(){
    window.addEventListener("keydown",e=>{if(!game.classList.contains("active")||e.repeat||["INPUT","SELECT","TEXTAREA"].includes(document.activeElement.tagName))return;const k=e.key.toLowerCase();if(k in keyToLane){e.preventDefault();press(keyToLane[k])}});
    window.addEventListener("keyup",e=>{const k=e.key.toLowerCase();if(k in keyToLane)release(keyToLane[k])});
    keyLabels.forEach((pad,lane)=>{
      pad.addEventListener("pointerdown",e=>{e.preventDefault();pad.setPointerCapture?.(e.pointerId);press(lane)});
      pad.addEventListener("pointerup",e=>{e.preventDefault();release(lane)});
      pad.addEventListener("pointercancel",()=>release(lane));
    })
  }
  async function start(){
    try{
      startBtn.disabled=true;await loadChart();resetStats();show(game);countdown.textContent="3";await wait(600);countdown.textContent="2";await wait(600);countdown.textContent="1";await wait(600);countdown.textContent="GO";await wait(300);countdown.textContent="";
      try{video.currentTime=0;await video.play()}catch(e){}
      await audio.play();playing=true;render();audio.onended=finish
    }catch(e){alert("실행 실패: "+e.message);show(menu)}finally{startBtn.disabled=false}
  }
  function finish(){
    playing=false;cancelAnimationFrame(raf);video.pause();held.fill(false);laneEls.forEach((l,i)=>stopHoldFx(i));
    notes.forEach(n=>{if(!n.completed&&!n.missed)markMiss(n)});
    const acc=judged?qualitySum/judged*100:0;
    $("#resultScore").textContent=score.toLocaleString();$("#resultAcc").textContent=acc.toFixed(2)+"%";$("#resultCombo").textContent=maxCombo;
    $("#perfectCount").textContent=counts.perfect;$("#greatCount").textContent=counts.great;$("#goodCount").textContent=counts.good;$("#missCount").textContent=counts.miss;
    $("#rank").textContent=acc>=98?"S":acc>=92?"A":acc>=82?"B":acc>=70?"C":"D";show(result)
  }
  function quit(){playing=false;cancelAnimationFrame(raf);audio.pause();video.pause();held.fill(false);laneEls.forEach((l,i)=>stopHoldFx(i));show(menu)}
  function wait(ms){return new Promise(r=>setTimeout(r,ms))}
  startBtn.addEventListener("click",start);$("#quitBtn").addEventListener("click",quit);$("#retryBtn").addEventListener("click",start);$("#backBtn").addEventListener("click",()=>show(menu));
  populate();bind()
})();