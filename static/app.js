const PLAYER_KEY = "awsquest_player_id";
const PLAYER_STATE_KEY = "awsquest_guest_state";
let buttonSoundContext = null;

function playButtonSound() {
  buttonSoundContext ||= new (window.AudioContext || window.webkitAudioContext)();
  const oscillator = buttonSoundContext.createOscillator();
  const gain = buttonSoundContext.createGain();
  const now = buttonSoundContext.currentTime;
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(520, now);
  oscillator.frequency.exponentialRampToValueAtTime(760, now + 0.06);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.08, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);
  oscillator.connect(gain);
  gain.connect(buttonSoundContext.destination);
  oscillator.start(now);
  oscillator.stop(now + 0.1);
}

document.addEventListener("click", event => {
  const button = event.target.closest("button");
  if (button && !button.disabled) playButtonSound();
});

function playerId() {
  let id = localStorage.getItem(PLAYER_KEY);
  if (!id) {
    id = "guest-" + crypto.randomUUID();
    localStorage.setItem(PLAYER_KEY, id);
  }
  return id;
}

async function loadProgress() {
  const local = JSON.parse(localStorage.getItem(PLAYER_STATE_KEY) || "null");
  try {
    const r = await fetch(`/api/player/progress?player_id=${encodeURIComponent(playerId())}`);
    const server = await r.json();
    const state = local || server;
    window.playerState = state;
    updateHUD(state);
    return state;
  } catch {
    window.playerState = local || {xp:0,gems:135,hearts:5,streak:1,completed_levels:[]};
    updateHUD(window.playerState);
    return window.playerState;
  }
}

function updateHUD(s) {
  if (!s) return;
  document.getElementById("hud-xp").textContent = s.xp || 0;
  document.getElementById("hud-gems").textContent = s.gems ?? 135;
  document.getElementById("hud-hearts").textContent = s.hearts ?? 5;
  document.getElementById("hud-streak").textContent = s.streak ?? 1;
  document.getElementById("hud-level").textContent = Math.max(1, Math.floor((s.xp || 0) / 100) + 1);
}

function saveLocal(s) {
  window.playerState = s;
  localStorage.setItem(PLAYER_STATE_KEY, JSON.stringify(s));
  updateHUD(s);
}

async function reward(xp=0, gems=0, hearts=null) {
  const s = window.playerState || {xp:0,gems:135,hearts:5,streak:1,completed_levels:[]};
  s.xp += xp; s.gems += gems;
  if (hearts !== null) s.hearts = Math.max(0, Math.min(5, hearts));
  saveLocal(s);
  try {
    await fetch("/api/player/rewards", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body:JSON.stringify({player_id:playerId(), xp, gems, hearts:s.hearts})
    });
  } catch {}
}

function toast(msg) {
  const el = document.getElementById("toast");
  if (!el) return;
  el.textContent = msg;
  el.classList.add("show");
  setTimeout(()=>el.classList.remove("show"), 2200);
}

function updateMap() {
  const s = window.playerState || {};
  const done = new Set(s.completed_levels || []);
  const ids = ["s3","ec2","iam","lambda","aurora","final"];
  let unlocked = true;
  ids.forEach((id, i) => {
    const card = document.querySelector(`[data-level="${id}"]`);
    const state = document.getElementById(`state-${id}`);
    const start = document.getElementById(`start-${id}`);
    if (!card) return;
    if (done.has(id)) {
      card.classList.add("complete"); state.textContent = "✓"; start.textContent = "Replay";
    } else if (unlocked) {
      card.classList.add("active"); state.textContent = "▶"; start.textContent = "Play"; unlocked = false;
    } else {
      card.classList.add("locked"); state.textContent = "🔒"; start.textContent = "Locked";
      start.removeAttribute("href"); start.onclick = e => { e.preventDefault(); toast("Complete the previous quest first!"); };
    }
  });
  const pct = Math.round(done.size / ids.length * 100);
  const bar = document.getElementById("map-progress-bar");
  if (bar) bar.style.width = `${pct}%`;
}

function resetGuest() {
  localStorage.removeItem(PLAYER_KEY);
  localStorage.removeItem(PLAYER_STATE_KEY);
  location.reload();
}

const QUESTION_TIME_LIMIT = 90;
let qIndex = 0, score = 0, answered = false;
let questionTimer = null;
let questionTimeLeft = QUESTION_TIME_LIMIT;
let landingMusicPlaying = false;

function audioCommand(audioId, command, restart = false) {
  const audio = document.getElementById(audioId);
  if (!audio) return;
  if (command === "play") {
    if (restart) audio.currentTime = 0;
    audio.play().catch(() => {});
  } else {
    audio.pause();
  }
}

function startQuizMusic() {
  audioCommand("quiz-audio", "play", true);
}

function stopQuizMusic() {
  audioCommand("quiz-audio", "pause");
}

function toggleLandingMusic() {
  const audio = document.getElementById("landing-audio");
  if (!audio) return;
  landingMusicPlaying = audio.paused;
  audioCommand("landing-audio", landingMusicPlaying ? "play" : "pause");
  const button = document.getElementById("landing-music-toggle");
  if (button) button.textContent = landingMusicPlaying ? "♫ Pause music" : "♫ Play music";
}

function updateQuestionTimer() {
  const timer = document.getElementById("question-timer");
  if (!timer) return;
  const minutes = Math.floor(questionTimeLeft / 60);
  const seconds = String(questionTimeLeft % 60).padStart(2, "0");
  timer.textContent = `${minutes}:${seconds}`;
  timer.classList.toggle("urgent", questionTimeLeft <= 15);
}

function stopQuestionTimer() {
  if (questionTimer) clearInterval(questionTimer);
  questionTimer = null;
  stopQuizMusic();
}

function startQuestionTimer(onExpire) {
  stopQuestionTimer();
  questionTimeLeft = QUESTION_TIME_LIMIT;
  updateQuestionTimer();
  startQuizMusic();
  questionTimer = setInterval(() => {
    questionTimeLeft--;
    updateQuestionTimer();
    if (questionTimeLeft <= 0) {
      stopQuestionTimer();
      onExpire();
    }
  }, 1000);
}

function startQuiz() {
  const intro = document.querySelector(".intro-card");
  if (intro) intro.classList.add("hidden");
  const quiz = document.getElementById("quiz");
  if (quiz) { quiz.classList.remove("hidden"); renderQuestion(); quiz.scrollIntoView({behavior:"smooth", block:"start"}); }
}

function renderQuestion() {
  answered = false;
  const q = QUESTIONS[qIndex];
  document.getElementById("question-number").textContent = qIndex + 1;
  document.getElementById("question-text").textContent = q.q;
  document.getElementById("quiz-progress").style.width = `${((qIndex)/QUESTIONS.length)*100}%`;
  const answers = document.getElementById("answers");
  answers.innerHTML = "";
  q.options.forEach((option, i) => {
    const b = document.createElement("button");
    b.className = "answer-button";
    b.innerHTML = `<span class="answer-letter">${String.fromCharCode(65+i)}</span><span>${option}</span>`;
    b.onclick = () => answerQuestion(i);
    answers.appendChild(b);
  });
  document.getElementById("feedback").classList.add("hidden");
  document.getElementById("next-question").classList.add("hidden");
  startQuestionTimer(() => answerQuestion(-1));
}

async function answerQuestion(choice) {
  if (answered) return;
  answered = true;
  stopQuestionTimer();
  const q = QUESTIONS[qIndex];
  const buttons = [...document.querySelectorAll(".answer-button")];
  buttons.forEach(b => b.disabled = true);
  buttons[q.answer].classList.add("correct");
  const feedback = document.getElementById("feedback");
  if (choice === q.answer) {
    score++;
    buttons[choice].classList.add("selected-correct");
    feedback.innerHTML = `<b>✅ Correct!</b><span>${q.why}</span>`;
    feedback.className = "feedback correct-feedback";
    await reward(10, 5);
    toast("+10 XP  +5 💎");
  } else {
    if (choice >= 0) buttons[choice].classList.add("incorrect");
    const s = window.playerState || {};
    s.hearts = Math.max(0, (s.hearts ?? 5) - 1);
    saveLocal(s);
    feedback.innerHTML = choice < 0
      ? `<b>⏱️ Time's up.</b><span>${q.why}</span>`
      : `<b>❌ Not quite.</b><span>${q.why}</span>`;
    feedback.className = "feedback incorrect-feedback";
    try { await fetch("/api/player/rewards",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({player_id:playerId(),xp:0,gems:0,hearts:s.hearts})}); } catch {}
    toast("You lost a heart — keep learning!");
  }
  feedback.classList.remove("hidden");
  document.getElementById("next-question").classList.remove("hidden");
}

async function nextQuestion() {
  qIndex++;
  if (qIndex < QUESTIONS.length) renderQuestion();
  else if (LEVEL_ID === "s3") startMiniGame();
  else finishLevel();
}

function startMiniGame() {
  document.getElementById("quiz").classList.add("hidden");
  document.getElementById("minigame").classList.remove("hidden");
  const items = [
    ["product-image.jpg","s3"],["receipt.pdf","s3"],["product-video.mp4","s3"],
    ["customer-avatar.png","s3"],["server-code.js","lambda"],["application-data","s3"]
  ];
  const box = document.getElementById("warehouse-items");
  box.innerHTML = "";
  items.sort(()=>Math.random()-0.5).forEach(([name, service]) => {
    const el = document.createElement("button");
    el.className = "warehouse-item";
    el.dataset.answer = service;
    el.textContent = "📦 " + name;
    el.onclick = () => {
      document.querySelectorAll(".warehouse-item.selected").forEach(x=>x.classList.remove("selected"));
      el.classList.add("selected");
    };
    box.appendChild(el);
  });
  document.querySelectorAll(".drop-zone").forEach(zone => zone.onclick = () => sortItem(zone.dataset.service));
}

async function sortItem(service) {
  const item = document.querySelector(".warehouse-item.selected");
  if (!item) { toast("Pick an item first."); return; }
  const msg = document.getElementById("game-message");
  if (item.dataset.answer === service) {
    item.classList.add("stored"); item.disabled = true; item.classList.remove("selected");
    msg.textContent = "✅ Stored!"; msg.className = "game-message good";
    await reward(20, 10);
    if (!document.querySelector(".warehouse-item:not(.stored)")) {
      setTimeout(finishLevel, 550);
    }
  } else {
    item.classList.add("shake");
    msg.textContent = "❌ This isn't primarily a storage task."; msg.className = "game-message bad";
    setTimeout(()=>item.classList.remove("shake"), 450);
  }
}

async function finishLevel() {
  stopQuestionTimer();
  const results = document.getElementById("results");
  ["quiz","minigame","final-game"].forEach(id => document.getElementById(id)?.classList.add("hidden"));
  results.classList.remove("hidden");
  const baseXP = LEVEL_ID === "final" ? 100 : 50;
  const bonus = Math.round((score / (QUESTIONS.length || 5)) * 50);
  const gems = 25;
  await reward(baseXP + bonus, gems, 5);
  const s = window.playerState;
  s.completed_levels = [...new Set([...(s.completed_levels || []), LEVEL_ID])];
  saveLocal(s);
  try {
    await fetch("/api/player/complete",{method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({player_id:playerId(),level_id:LEVEL_ID,xp:0,gems:0})});
  } catch {}
  document.getElementById("result-xp").textContent = `+${baseXP + bonus}`;
  document.getElementById("result-gems").textContent = `+${gems}`;
  document.getElementById("result-score").textContent = `${Math.round(score/(QUESTIONS.length || 5)*100)}%`;
  document.getElementById("result-copy").textContent = LEVEL_ID === "final"
    ? "🎉 SHOP ONLINE! You connected the core AWS services into a working learning architecture."
    : "Your shop just gained a new capability. Head back to the map to see what you unlocked.";
  document.getElementById("result-title").textContent = LEVEL_ID === "final" ? "🎉 Shop online!" : "Quest complete!";
  results.scrollIntoView({behavior:"smooth", block:"start"});
}

let fIndex=0, fScore=0, fAnswered=false;
function startFinal() {
  document.querySelector(".intro-card").classList.add("hidden");
  document.getElementById("final-game").classList.remove("hidden");
  renderFinal();
}
function renderFinal() {
  fAnswered=false;
  const q=FINAL_QUESTIONS[fIndex];
  document.getElementById("final-number").textContent=fIndex+1;
  document.getElementById("final-question").textContent=q[0];
  document.getElementById("final-progress").style.width=`${fIndex/FINAL_QUESTIONS.length*100}%`;
  const answers=["Amazon S3","Amazon EC2","AWS Lambda","AWS IAM","Amazon Aurora DSQL"];
  const box=document.getElementById("final-answers"); box.innerHTML="";
  answers.sort(()=>Math.random()-0.5).forEach(a=>{
    const b=document.createElement("button"); b.className="answer-button"; b.textContent=a;
    b.onclick=()=>answerFinal(a,b,q[1]); box.appendChild(b);
  });
  document.getElementById("final-feedback").classList.add("hidden");
  document.getElementById("final-next").classList.add("hidden");
  startQuestionTimer(() => answerFinal(null, null, q[1]));
}
async function answerFinal(choice, btn, correct) {
  if(fAnswered)return; fAnswered=true;
  stopQuestionTimer();
  document.querySelectorAll("#final-answers .answer-button").forEach(x=>x.disabled=true);
  const fb=document.getElementById("final-feedback");
  if(choice===correct){fScore++;btn.classList.add("correct");fb.innerHTML=`<b>✅ Connected!</b><span>${correct} fits this part of the architecture.</span>`;fb.className="feedback correct-feedback";await reward(15,5);}
  else{if(btn)btn.classList.add("incorrect");fb.innerHTML=choice === null ? `<b>⏱️ Time's up.</b><span>This scenario is matched with ${correct} in this quest.</span>` : `<b>❌ Not quite.</b><span>This scenario is matched with ${correct} in this quest.</span>`;fb.className="feedback incorrect-feedback";}
  fb.classList.remove("hidden");document.getElementById("final-next").classList.remove("hidden");
}
function nextFinal(){fIndex++;if(fIndex<FINAL_QUESTIONS.length)renderFinal();else{score=fScore;finishLevel();}}
