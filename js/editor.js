(() => {
  const $=s=>document.querySelector(s),audio=$("#editorAudio"),file=$("#audioFile"),play=$("#playPause"),stop=$("#stopBtn"),seek=$("#seek");
  const bpm=$("#bpm"),snap=$("#snap"),offset=$("#offset"),table=$("#noteTable"),lanes=[...document.querySelectorAll(".editor-lane")];
  const map={d:0,f:1,j:2,k:3};let notes=[],objectUrl=null,raf=0,history=[],downs=[null,null,null,null];
  const TAP_THRESHOLD=.15;
  function fmt(t){return Number(t||0).toFixed(3)}function dur(){return Number.isFinite(audio.duration)?audio.duration:0}
  function tick(){$("#currentTime").textContent=fmt(audio.currentTime);$("#duration").textContent=fmt(dur());seek.max=Math.max(dur(),.001);seek.value=Math.min(audio.currentTime,dur());if(!audio.paused)raf=requestAnimationFrame(tick)}
  file.addEventListener("change",()=>{if(!file.files[0])return;if(objectUrl)URL.revokeObjectURL(objectUrl);objectUrl=URL.createObjectURL(file.files[0]);audio.src=objectUrl;$("#status").textContent=file.files[0].name});
  audio.addEventListener("loadedmetadata",render);audio.addEventListener("play",()=>{play.textContent="PAUSE";cancelAnimationFrame(raf);tick()});audio.addEventListener("pause",()=>play.textContent="PLAY");
  play.addEventListener("click",async()=>{if(!audio.src){alert("먼저 음원을 선택하세요.");return}audio.paused?await audio.play():audio.pause()});
  stop.addEventListener("click",()=>{audio.pause();audio.currentTime=0;tick()});seek.addEventListener("input",()=>{audio.currentTime=+seek.value;tick();render()});
  function snapped(t){const s=+snap.value;if(!s)return Math.max(0,t);const beat=60/(+bpm.value||120),step=beat*(4/s),off=(+offset.value||0)/1000;return Math.max(0,Math.round((t-off)/step)*step+off)}
  function saveHistory(){history.push(JSON.stringify(notes))}
  function begin(lane){if(!audio.src||downs[lane]!=null)return;downs[lane]=audio.currentTime}
  function end(lane){
    if(downs[lane]==null)return;const rawStart=downs[lane],rawEnd=audio.currentTime;downs[lane]=null;saveHistory();
    const start=snapped(rawStart),held=Math.max(0,rawEnd-rawStart);
    if(held<=TAP_THRESHOLD)notes.push({time:+start.toFixed(3),lane});
    else{const endT=snapped(rawEnd),duration=Math.max(.05,endT-start);notes.push({time:+start.toFixed(3),lane,duration:+duration.toFixed(3)})}
    notes.sort((a,b)=>a.time-b.time||a.lane-b.lane);render()
  }
  window.addEventListener("keydown",e=>{if(["INPUT","SELECT","TEXTAREA"].includes(document.activeElement.tagName))return;const k=e.key.toLowerCase();if(k in map&&!e.repeat){e.preventDefault();begin(map[k])}if(e.code==="Space"){e.preventDefault();play.click()}});
  window.addEventListener("keyup",e=>{const k=e.key.toLowerCase();if(k in map){e.preventDefault();end(map[k])}});
  // Clicking a lane creates a TAP at current time; keyboard hold creates HOLD.
  lanes.forEach((l,i)=>l.addEventListener("click",()=>{if(!audio.src)return;saveHistory();notes.push({time:+snapped(audio.currentTime).toFixed(3),lane:i});notes.sort((a,b)=>a.time-b.time);render()}));
  function remove(i){saveHistory();notes.splice(i,1);render()}
  function changeDuration(i,v){saveHistory();const x=Math.max(0,+v||0);if(x<.05)delete notes[i].duration;else notes[i].duration=+x.toFixed(3);render()}
  function render(){
    $("#noteCount").textContent=notes.length+" notes";table.innerHTML="";lanes.forEach(l=>l.querySelectorAll(".editor-note,.editor-hold-preview").forEach(x=>x.remove()));
    const total=Math.max(dur(),notes.length?Math.max(...notes.map(n=>n.time+(+n.duration||0)))+1:1);
    notes.forEach((n,i)=>{
      const tr=document.createElement("tr"),isHold=(+n.duration||0)>0;
      tr.innerHTML=`<td>${i+1}</td><td>${fmt(n.time)}</td><td>${["D","F","J","K"][n.lane]} <span class="note-type">${isHold?"HOLD":"TAP"}</span></td><td><input class="duration-input" type="number" min="0" step="0.05" value="${isHold?fmt(n.duration):"0"}" aria-label="duration seconds"></td><td><button type="button">DELETE</button></td>`;
      tr.querySelector("button").addEventListener("click",()=>remove(i));tr.querySelector("input").addEventListener("change",e=>changeDuration(i,e.target.value));table.appendChild(tr);
      const mark=document.createElement("div");mark.className=isHold?"editor-hold-preview":"editor-note";
      const top=(Math.min(1,n.time/total)*92+4),height=isHold?Math.max(7,(n.duration/total)*92*290):7;
      mark.style.top=top+"%";if(isHold)mark.style.height=height+"px";mark.title=`${fmt(n.time)} / ${["D","F","J","K"][n.lane]}${isHold?" / "+fmt(n.duration)+"s":""}`;
      mark.addEventListener("click",e=>{e.stopPropagation();remove(i)});lanes[n.lane].appendChild(mark)
    })
  }
  $("#undoBtn").addEventListener("click",()=>{if(!history.length)return;notes=JSON.parse(history.pop());render()});
  $("#clearBtn").addEventListener("click",()=>{if(notes.length&&confirm("모든 노트를 삭제할까요?")){saveHistory();notes=[];render()}});
  $("#exportBtn").addEventListener("click",()=>{const data={version:2,difficulty:$("#editorDifficulty").value,bpm:+bpm.value||120,offsetMs:+offset.value||0,notes};const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=$("#editorDifficulty").value+".json";a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500)});
  $("#importJson").addEventListener("change",async e=>{const f=e.target.files[0];if(!f)return;try{const o=JSON.parse(await f.text());notes=Array.isArray(o.notes)?o.notes:[];if(o.bpm)bpm.value=o.bpm;if(o.offsetMs!=null)offset.value=o.offsetMs;render()}catch(err){alert("JSON 파일을 읽지 못했습니다.")}e.target.value=""});
  render()
})();