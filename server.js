const path = require('path');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;
const ROUND_SECONDS = 15;
const MAX_PLAYERS = 8;
const QUESTION_COUNT = 10;

app.use(express.static(path.join(__dirname, 'public')));
app.get('/health', (_, res) => res.json({ ok: true, game: 'Neon Quiz Arena', aiEnabled: Boolean(process.env.OPENAI_API_KEY) }));

const COLORS = ['#8b5cf6','#06b6d4','#f97316','#22c55e','#ec4899','#eab308','#3b82f6','#ef4444'];
const rooms = new Map();

const FALLBACK = {
  General: [
    q('Which planet is known as the Red Planet?', ['Mars','Venus','Jupiter','Mercury'], 0, 'Mars appears reddish because of iron minerals on its surface.'),
    q('Which ocean is the largest?', ['Atlantic Ocean','Pacific Ocean','Indian Ocean','Arctic Ocean'], 1, 'The Pacific Ocean is the largest ocean on Earth.'),
    q('What is H₂O commonly called?', ['Oxygen','Hydrogen','Water','Salt'], 2, 'H₂O is the chemical formula for water.'),
    q('How many sides does a hexagon have?', ['5','6','7','8'], 1, 'A hexagon has six sides.'),
    q('Which animal is the largest living land animal?', ['Elephant','Giraffe','Hippopotamus','Rhinoceros'], 0, 'The African elephant is the largest living land animal.'),
    q('Which language is primarily used to style web pages?', ['HTML','CSS','SQL','Python'], 1, 'CSS controls the presentation and visual styling of web pages.'),
    q('What is 12 × 8?', ['86','96','108','112'], 1, '12 multiplied by 8 equals 96.'),
    q('Which continent contains the Sahara Desert?', ['Asia','Africa','Australia','South America'], 1, 'The Sahara is in North Africa.'),
    q('Which instrument has black and white keys?', ['Violin','Trumpet','Piano','Flute'], 2, 'A piano keyboard has black and white keys.'),
    q('Which gas do humans need for cellular respiration?', ['Carbon dioxide','Oxygen','Helium','Nitrogen'], 1, 'Human cells use oxygen during aerobic cellular respiration.')
  ],
  Technology: [
    q('What does CPU stand for?', ['Central Processing Unit','Computer Personal Utility','Core Program User','Central Program Upload'], 0, 'CPU stands for Central Processing Unit.'),
    q('Which protocol secures most modern web traffic?', ['FTP','HTTP','HTTPS','SMTP'], 2, 'HTTPS uses TLS to secure HTTP traffic.'),
    q('Which data structure uses FIFO ordering?', ['Stack','Queue','Tree','Graph'], 1, 'A queue follows first-in, first-out ordering.'),
    q('Which language runs natively in web browsers?', ['JavaScript','C','SQL','Java'], 0, 'JavaScript is the standard scripting language executed in browsers.'),
    q('What does SQL primarily manage?', ['Images','Relational data','Audio','Operating-system drivers'], 1, 'SQL is used to query and manage relational databases.'),
    q('Which is a version-control system?', ['Git','Docker','Figma','Redis'], 0, 'Git tracks changes to source code and other files.'),
    q('What does API commonly mean?', ['Application Programming Interface','Advanced Program Installer','Applied Process Input','Application Package Index'], 0, 'API means Application Programming Interface.'),
    q('Which HTML element is commonly used for a top-level heading?', ['<p>','<h1>','<div>','<span>'], 1, 'The h1 element represents the highest-level heading.'),
    q('Which database type stores data in documents?', ['Document database','Graph-only database','Keyless database','Spreadsheet-only database'], 0, 'Document databases store records as document-like structures such as JSON.'),
    q('What is GitHub primarily used for?', ['Source-code collaboration','Video editing','Photo printing','Music mastering'], 0, 'GitHub provides hosting and collaboration tools around Git repositories.')
  ],
  Science: [
    q('What is the chemical symbol for gold?', ['Ag','Au','Gd','Go'], 1, 'Gold has the chemical symbol Au.'),
    q('What force attracts objects toward Earth?', ['Magnetism','Friction','Gravity','Buoyancy'], 2, 'Gravity attracts masses toward one another, including toward Earth.'),
    q('Which organ pumps blood through the human body?', ['Lung','Heart','Liver','Kidney'], 1, 'The heart pumps blood through the circulatory system.'),
    q('What is the closest star to Earth?', ['Sirius','Polaris','The Sun','Betelgeuse'], 2, 'The Sun is the closest star to Earth.'),
    q('Which state of matter has a fixed volume but no fixed shape?', ['Solid','Liquid','Gas','Plasma only'], 1, 'Liquids keep a volume but take the shape of their container.'),
    q('What is the basic unit of life?', ['Atom','Cell','Tissue','Organ'], 1, 'The cell is the basic structural and functional unit of life.'),
    q('Which particle has a negative electric charge?', ['Proton','Neutron','Electron','Photon'], 2, 'Electrons carry negative electric charge.'),
    q('What process do plants use to convert light energy into chemical energy?', ['Respiration','Photosynthesis','Digestion','Fermentation'], 1, 'Photosynthesis converts light energy into stored chemical energy.'),
    q('Which planet has the most prominent ring system?', ['Earth','Saturn','Mars','Mercury'], 1, 'Saturn is famous for its extensive visible ring system.'),
    q('What is the approximate speed of light in vacuum?', ['3,000 km/s','30,000 km/s','300,000 km/s','3,000,000 km/s'], 2, 'Light travels at about 300,000 kilometers per second in vacuum.')
  ]
};

function q(question, options, answer, explanation) { return { question, options, answer, explanation }; }
function cleanName(name) { return String(name || 'Player').replace(/[^a-zA-Z0-9 _-]/g,'').trim().slice(0,18) || 'Player'; }
function cleanTopic(topic) { return String(topic || 'General').trim().slice(0,40) || 'General'; }
function randomCode() { const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let c; do { c=Array.from({length:6},()=>chars[Math.floor(Math.random()*chars.length)]).join(''); } while(rooms.has(c)); return c; }
function makePlayer(id,name,i){ return {id,name:cleanName(name),color:COLORS[i%COLORS.length],score:0,streak:0,answered:false,answer:null}; }
function publicRoom(room){
  return { code:room.code, host:room.host, state:room.state, topic:room.topic, players:[...room.players.values()].map(p=>({id:p.id,name:p.name,color:p.color,score:p.score,streak:p.streak,answered:p.answered})), questionIndex:room.questionIndex, questionCount:room.questions.length, timeLeft:room.state==='question'?Math.max(0,Math.ceil((room.questionEndsAt-Date.now())/1000)):0, question:room.state==='question' ? sanitizeQuestion(room.questions[room.questionIndex]) : null, winner:room.winner || null, aiUsed:room.aiUsed };
}
function sanitizeQuestion(question){ if(!question) return null; return {question:question.question, options:question.options}; }
function emitRoom(room){ io.to(room.code).emit('room:update',publicRoom(room)); }
function scheduleNext(room, delay=900){ clearTimeout(room.timer); room.timer=setTimeout(()=>advanceQuestion(room),delay); }
function startQuestion(room){
  if(room.questionIndex >= room.questions.length) return finishRoom(room);
  for(const p of room.players.values()){p.answered=false;p.answer=null;}
  room.state='question'; room.questionEndsAt=Date.now()+ROUND_SECONDS*1000; emitRoom(room); scheduleNext(room,ROUND_SECONDS*1000);
}
function advanceQuestion(room){ if(room.state!=='question') return; room.questionIndex += 1; startQuestion(room); }
function finishRoom(room){
  clearTimeout(room.timer); room.state='finished'; room.questionEndsAt=0;
  const ranking=[...room.players.values()].sort((a,b)=>b.score-a.score);
  room.winner=ranking[0] ? {name:ranking[0].name,score:ranking[0].score} : null;
  emitRoom(room);
}
function normalizeQuestions(raw){
  if(!Array.isArray(raw)) return null;
  const out=[];
  for(const item of raw.slice(0,QUESTION_COUNT)){
    if(!item || typeof item.question!=='string' || !Array.isArray(item.options) || item.options.length!==4) continue;
    const answer=Number(item.answer);
    if(!Number.isInteger(answer) || answer<0 || answer>3) continue;
    const options=item.options.map(x=>String(x).slice(0,120));
    if(options.some(x=>!x)) continue;
    out.push({question:item.question.slice(0,220),options,answer,explanation:String(item.explanation||'').slice(0,300)});
  }
  return out.length===QUESTION_COUNT ? out : null;
}
async function generateQuestions(topic){
  if(!process.env.OPENAI_API_KEY) return null;
  const prompt = `Create exactly ${QUESTION_COUNT} high-quality multiple-choice quiz questions about ${topic}. Return ONLY valid JSON as an array. Each item must have: question (string), options (array of exactly 4 strings), answer (integer 0-3 indicating the correct option), explanation (short string). Avoid ambiguous questions, duplicate questions, trick wording, current events, and unsafe content. Difficulty: accessible but competitive for a mixed audience.`;
  const response = await fetch('https://api.openai.com/v1/responses', { method:'POST', headers:{'Content-Type':'application/json','Authorization':`Bearer ${process.env.OPENAI_API_KEY}`}, body:JSON.stringify({model:process.env.OPENAI_MODEL||'gpt-6-luna',input:prompt}) });
  if(!response.ok) throw new Error(`OpenAI API ${response.status}`);
  const data=await response.json();
  const text=data.output_text || data.output?.flatMap(x=>x.content||[]).find(x=>x.type==='output_text')?.text || '';
  const cleaned=text.replace(/^```json\s*/,'').replace(/```\s*$/,'').trim();
  return normalizeQuestions(JSON.parse(cleaned));
}

io.on('connection', socket=>{
  socket.on('room:create', async ({name='Player',topic='General'}={})=>{
    const code=randomCode(); const room={code,host:socket.id,state:'lobby',topic:cleanTopic(topic),players:new Map(),questions:[],questionIndex:0,questionEndsAt:0,timer:null,winner:null,aiUsed:false};
    room.players.set(socket.id,makePlayer(socket.id,name,0)); rooms.set(code,room); socket.join(code); socket.data.room=code; socket.emit('room:created',{code}); emitRoom(room);
  });
  socket.on('room:join',({code,name='Player'}={})=>{
    code=String(code||'').toUpperCase().trim(); const room=rooms.get(code);
    if(!room) return socket.emit('error:msg','Room not found.');
    if(room.state!=='lobby') return socket.emit('error:msg','That game has already started.');
    if(room.players.size>=MAX_PLAYERS) return socket.emit('error:msg','Room is full.');
    room.players.set(socket.id,makePlayer(socket.id,name,room.players.size)); socket.join(code); socket.data.room=code; socket.emit('room:joined',{code}); emitRoom(room);
  });
  socket.on('game:start',async()=>{
    const room=rooms.get(socket.data.room); if(!room || room.host!==socket.id) return;
    if(room.players.size<2) return socket.emit('error:msg','At least 2 players are required to start.');
    try { room.state='loading'; emitRoom(room); let questions=await generateQuestions(room.topic); if(questions){room.aiUsed=true;} else {questions=FALLBACK[room.topic]||FALLBACK.General;} room.questions=questions; room.questionIndex=0; startQuestion(room); }
    catch(err){ console.error(err); room.aiUsed=false; room.questions=FALLBACK[room.topic]||FALLBACK.General; room.questionIndex=0; startQuestion(room); }
  });
  socket.on('player:answer',({choice}={})=>{
    const room=rooms.get(socket.data.room); const p=room?.players.get(socket.id); if(!room||!p||room.state!=='question'||p.answered) return;
    const idx=Number(choice); if(!Number.isInteger(idx)||idx<0||idx>3) return;
    const current=room.questions[room.questionIndex]; const elapsed=Math.max(0,ROUND_SECONDS*1000-(room.questionEndsAt-Date.now()));
    const correct=idx===current.answer; p.answered=true; p.answer=idx;
    if(correct){ const speedBonus=Math.max(0,500-Math.floor(elapsed/30)); p.streak+=1; p.score += 500 + speedBonus + Math.min(500,p.streak*50); }
    else { p.streak=0; }
    io.to(room.code).emit('answer:feedback',{playerId:p.id,correct,explanation:current.explanation}); emitRoom(room);
    if([...room.players.values()].every(x=>x.answered)) scheduleNext(room,1100);
  });
  socket.on('game:playAgain',()=>{ const room=rooms.get(socket.data.room); if(!room || room.host!==socket.id) return; room.state='lobby';room.winner=null;room.questions=[];room.questionIndex=0;room.aiUsed=false;for(const p of room.players.values()){p.score=0;p.streak=0;p.answered=false;p.answer=null;}emitRoom(room); });
  socket.on('disconnect',()=>{ const code=socket.data.room; const room=rooms.get(code); if(!room)return; room.players.delete(socket.id); if(room.host===socket.id) room.host=room.players.keys().next().value||null; if(room.players.size===0){clearTimeout(room.timer);rooms.delete(code);} else emitRoom(room); });
});

server.listen(PORT,()=>console.log(`Neon Quiz Arena running at http://localhost:${PORT}`));
