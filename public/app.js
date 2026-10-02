const socket=io();
const $=id=>document.getElementById(id);
let room=null, me=null, timerHandle=null, lastQuestionKey='';
function show(id){['home','lobby','loading','quiz','result'].forEach(x=>$(x).classList.toggle('hidden',x!==id));}
function message(t){$('msg').textContent=t||'';}
function esc(s){return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
$('create').onclick=()=>{message('');socket.emit('room:create',{name:$('name').value,topic:$('topic').value});};
$('join').onclick=()=>{message('');socket.emit('room:join',{name:$('name').value,code:$('code').value});};
$('start').onclick=()=>socket.emit('game:start');
$('copy').onclick=()=>navigator.clipboard?.writeText(room?.code||'');
$('again').onclick=()=>socket.emit('game:playAgain');
socket.on('room:created',({code})=>{message('');$('roomCode').textContent=code;show('lobby');});
socket.on('room:joined',({code})=>{message('');$('roomCode').textContent=code;show('lobby');});
socket.on('error:msg',m=>message(m));
socket.on('room:update',r=>{room=r;me=r.players.find(p=>p.id===socket.id)||me;render();});
socket.on('answer:feedback',({playerId,correct,explanation})=>{if(playerId!==socket.id)return;const fb=$('feedback');fb.classList.remove('hidden');fb.textContent=correct?`Correct! ${explanation}`:`Not quite. ${explanation}`;});
function render(){
 if(!room)return;
 $('lobbyTopic').textContent=room.topic; $('quizTopic').textContent=room.topic.toUpperCase();
 $('players').innerHTML=room.players.map(p=>`<div class="player"><span class="dot" style="background:${p.color}"></span><b>${esc(p.name)}</b>${p.id===room.host?' <small>HOST</small>':''}</div>`).join('');
 const canStart=room.host===socket.id;
 $('start').disabled=!canStart||room.players.length<2||room.state==='loading';
 $('start').textContent=room.players.length<2?'Need 2 Players':room.state==='loading'?'Creating Quiz…':canStart?'Start Game':'Waiting for Host';
 $('aiState').textContent=room.aiUsed?'AI LIVE':'FALLBACK';
 if(room.state==='lobby')show('lobby');
 if(room.state==='loading')show('loading');
 if(room.state==='question'){show('quiz');renderQuestion();renderLeaders();startTimer();}
 if(room.state==='finished')renderResult();
}
function renderQuestion(){
 const q=room.question;if(!q)return;const key=`${room.questionIndex}:${q.question}`;
 if(lastQuestionKey===key)return;lastQuestionKey=key;$('feedback').classList.add('hidden');
 $('qNumber').textContent=`Question ${room.questionIndex+1} of ${room.questionCount}`;$('question').textContent=q.question;
 $('progressBar').style.width=`${((room.questionIndex)/room.questionCount)*100}%`;
 $('answers').innerHTML=q.options.map((o,i)=>`<button class="answer" data-choice="${i}"><span class="letter">${'ABCD'[i]}</span><span>${esc(o)}</span></button>`).join('');
 document.querySelectorAll('.answer').forEach(b=>b.onclick=()=>{socket.emit('player:answer',{choice:Number(b.dataset.choice)});document.querySelectorAll('.answer').forEach(x=>x.disabled=true);b.style.outline='3px solid #26333b55';});
}
function startTimer(){clearInterval(timerHandle);const end=Date.now()+room.timeLeft*1000;const update=()=>{$('timer').textContent=Math.max(0,Math.ceil((end-Date.now())/1000));};update();timerHandle=setInterval(update,200);}
function renderLeaders(){ $('score').textContent=`${me?.score||0} pts`; $('leaderboard').innerHTML=[...room.players].sort((a,b)=>b.score-a.score).map((p,i)=>`<div class="leader"><div class="leaderName"><span class="rank">${i+1}</span><span class="dot" style="background:${p.color}"></span><span>${esc(p.name)}</span></div><b>${p.score}</b></div>`).join(''); }
function renderResult(){clearInterval(timerHandle);const ranking=[...room.players].sort((a,b)=>b.score-a.score);const w=room.winner;$('winner').textContent=w?.name||'Game Complete';$('winnerScore').textContent=w?`${w.score} points`:'Thanks for playing';$('finalScores').innerHTML=ranking.map((p,i)=>`<div><span>#${i+1} ${esc(p.name)}</span><b>${p.score} pts</b></div>`).join('');show('result');}
setInterval(()=>{if(room?.state==='question')renderLeaders();},500);
