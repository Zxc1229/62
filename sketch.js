let video;
let facemesh;
let predictions = [];

let currentTargetChars = [];
let targetPositions = [];
let targetStates = [];
let targetRadius = 40;

const answerSequence = ['T', 'K', 'U', 'E', 'T', 'C', 'F', 'C', 'H', 'E', 'N'];
let collectedSequence = [];
let nextLetterIndex = 0;

let score = 0;
let gameStarted = false;
let gameMode = null; // 'practice', 'memory', 'speed'
let selectedMode = null;
let timer = 60;
let gameFinished = false;
let gameSuccess = false;
let gamePaused = false;

let modeButtons = [];
let startButton;
let menuIcon;
let menuItems = [];
let menuVisible = false;

let hoverStartTimes = [];
let leftEyePositions = [];
let rightEyePositions = [];
let eyePathStartTime = 0;

function setup() {
  createCanvas(640, 480);
  video = createCapture(VIDEO);
  video.size(width, height);
  video.hide();

  facemesh = ml5.facemesh(video, modelReady);
  facemesh.on('predict', results => {
    predictions = results;
  });

  textFont("Arial");
  textStyle(BOLD);

  setupButtons();
  for (let i = 0; i < 5; i++) hoverStartTimes[i] = null;
  eyePathStartTime = millis();
}

function modelReady() {
  console.log("Facemesh model ready!");
}

function draw() {
  if (!video) return;

  // 如果漢堡選單開啟，完全暫停，只顯示選單遮罩與選單
  if (menuVisible) {
    drawMenuOverlay();
    return;
  }

  // 鏡像攝影機畫面
  push();
  translate(width, 0);
  scale(-1, 1);
  image(video, 0, 0, width, height);
  pop();

  if (!gameStarted || gamePaused) {
    drawMainMenu();
  } else if (gameFinished) {
    drawEndMenu();
  } else {
    drawGame();
  }

  drawStudentInfo();
  if (gameStarted && !gameFinished) menuIcon.draw();

  drawEyes();

  // 鼻子的紅圈圈
  if (predictions.length > 0) {
    const nose = getNosePosition();
    drawNoseCircle(nose);
  }
}

function drawEyes() {
  if (predictions.length > 0) {
    const keypoints = predictions[0].scaledMesh;
    const leftEye = createVector(keypoints[33][0], keypoints[33][1]);
    const rightEye = createVector(keypoints[263][0], keypoints[263][1]);
    leftEyePositions.push(leftEye);
    rightEyePositions.push(rightEye);

    // 畫眼睛路徑（鏡像）
    stroke('blue');
    strokeWeight(2);
    noFill();
    beginShape();
    for (let i = 0; i < leftEyePositions.length; i++) {
      vertex(width - leftEyePositions[i].x, leftEyePositions[i].y);
    }
    endShape();

    stroke('green');
    beginShape();
    for (let i = 0; i < rightEyePositions.length; i++) {
      vertex(width - rightEyePositions[i].x, rightEyePositions[i].y);
    }
    endShape();

    // 畫眼睛點（鏡像）
    fill('blue');
    noStroke();
    ellipse(width - leftEye.x, leftEye.y, 10, 10);
    fill('green');
    ellipse(width - rightEye.x, rightEye.y, 10, 10);

    // 3秒自動清除
    if (millis() - eyePathStartTime > 3000) {
      leftEyePositions = [];
      rightEyePositions = [];
      eyePathStartTime = millis();
    }
    if (leftEyePositions.length > 100) leftEyePositions.shift();
    if (rightEyePositions.length > 100) rightEyePositions.shift();
  }
}

function drawGame() {
  // 競速模式倒數計時
  if (gameMode === 'speed' && !gamePaused && !gameFinished) {
    if (frameCount % 60 === 0 && timer > 0) timer--;
    if (timer === 0 && !gameFinished) {
      gameFinished = true;
      gameSuccess = false;
    }
  }

  const nose = getNosePosition();
  drawTargets();
  handleNoseHover(nose);
  drawNoseCircle(nose);
  if (gameMode === 'speed') drawTimer();
  drawProgress();
}

function drawTargets() {
  textSize(32);
  textAlign(CENTER, CENTER);
  for (let i = 0; i < currentTargetChars.length; i++) {
    const pos = targetPositions[i];
    const state = targetStates[i];
    fill(state === 'correct' ? '#00e676' : state === 'wrong' ? '#ff1744' : 255); // 綠/紅/白
    stroke(0);
    ellipse(pos.x, pos.y, targetRadius * 2);
    fill(0);
    noStroke();
    text(currentTargetChars[i], pos.x, pos.y);
  }
}

function handleNoseHover(nose) {
  const mirroredNoseX = width - nose.x;
  for (let i = 0; i < currentTargetChars.length; i++) {
    const pos = targetPositions[i];
    const d = dist(mirroredNoseX, nose.y, pos.x, pos.y);
    if (d < targetRadius) {
      if (!hoverStartTimes[i]) hoverStartTimes[i] = millis();
      else if (millis() - hoverStartTimes[i] > 1000 && targetStates[i] === 'normal') {
        processSelection(i);
      }
    } else {
      hoverStartTimes[i] = null;
    }
  }
}

function processSelection(index) {
  const selected = currentTargetChars[index];
  const correct = answerSequence[nextLetterIndex];

  if (selected === correct) {
    targetStates[index] = 'correct';
    collectedSequence.push(selected);
    nextLetterIndex++;
    if (nextLetterIndex >= answerSequence.length) {
      shuffleMenuItems();
      gameFinished = true;
      gameSuccess = true;
    } else {
      generateTargets();
    }
  } else {
    targetStates[index] = 'wrong';
    setTimeout(() => generateTargets(), 1000);
  }
}

function generateTargets() {
  currentTargetChars = [];
  targetPositions = [];
  targetStates = [];
  hoverStartTimes = [];

  const correct = answerSequence[nextLetterIndex];
  let candidates = [];

  if (gameMode === 'practice') {
    candidates.push(correct);
  } else {
    const pool = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    candidates.push(correct);
    while (candidates.length < 5) {
      const randomLetter = pool.charAt(floor(random(pool.length)));
      if (!candidates.includes(randomLetter)) {
        candidates.push(randomLetter);
      }
    }
  }

  shuffle(candidates, true);

  for (let i = 0; i < candidates.length; i++) {
    currentTargetChars.push(candidates[i]);
    let newPos, overlap;
    do {
      overlap = false;
      newPos = createVector(random(80, width - 80), random(80, height - 80));
      for (let j = 0; j < targetPositions.length; j++) {
        if (dist(newPos.x, newPos.y, targetPositions[j].x, targetPositions[j].y) < targetRadius * 2) {
          overlap = true;
          break;
        }
      }
    } while (overlap);
    targetPositions.push(newPos);
    targetStates.push('normal');
    hoverStartTimes.push(null);
  }
}

function getNosePosition() {
  if (predictions.length === 0) return createVector(width / 2, height / 2);
  const keypoints = predictions[0].scaledMesh;
  return createVector(keypoints[94][0], keypoints[94][1]);
}

function drawNoseCircle(nose) {
  noFill();
  stroke('red');
  strokeWeight(2);
  ellipse(width - nose.x, nose.y, 16);
}

function drawTimer() {
  textSize(20);
  fill(timer <= 10 ? 'red' : 'white');
  textAlign(RIGHT, BOTTOM);
  text(`倒數：${timer}s`, width - 10, height - 10);
}

function drawStudentInfo() {
  fill(255);
  textSize(14);
  textAlign(RIGHT, TOP);
  stroke(0);
  strokeWeight(1);
  text("410730542 鄭皓誠", width - 10, 10);
}

function drawProgress() {
  const progressX = width / 2 - 180;
  const progressY = height - 30;
  const letterSpacing = 36;

  for (let i = 0; i < answerSequence.length; i++) {
    let char = '_';
    if (collectedSequence[i]) {
      char = collectedSequence[i];
    }
    fill(0);
    noStroke();
    textSize(32);
    textAlign(CENTER, CENTER);
    text(char, progressX + i * letterSpacing, progressY);
  }
}

function drawCheckmark(x, y) {
  stroke('green');
  strokeWeight(2);
  line(x - 10, y + 10, x, y + 20);
  line(x, y + 20, x + 20, y - 10);
}

function drawCross(x, y) {
  stroke('red');
  strokeWeight(2);
  line(x - 10, y - 10, x + 10, y + 10);
  line(x + 10, y - 10, x - 10, y + 10);
}

function keyPressed() {
  if (key === ' ') {
    if (gameFinished) {
      resetGame();
    } else {
      gamePaused = !gamePaused;
    }
  }
}

function mousePressed() {
  // 點擊漢堡選單圖示開啟選單
  if (menuIcon && !menuVisible && !gameFinished &&
      mouseX > menuIcon.x && mouseX < menuIcon.x + menuIcon.size &&
      mouseY > menuIcon.y && mouseY < menuIcon.y + menuIcon.size) {
    shuffleMenuItems();
    menuVisible = true;
    gamePaused = true; // 進入選單時暫停
    return;
  }
  // 點擊選單按鈕（遊戲中或結束畫面）
  if (menuVisible || gameFinished) {
    let clickedButton = false;
    for (let item of menuItems) {
      if (
        mouseX > item.x && mouseX < item.x + item.w &&
        mouseY > item.y && mouseY < item.y + item.h
      ) {
        clickedButton = true;
        if (item.action === 'restart') {
          gameStarted = true;
          gameFinished = false;
          gameSuccess = false;
          collectedSequence = [];
          nextLetterIndex = 0;
          timer = 60;
          leftEyePositions = [];
          rightEyePositions = [];
          eyePathStartTime = millis();
          generateTargets();
          menuVisible = false;
          gamePaused = false;
        } else if (item.action === 'home') {
          resetGame();
          menuVisible = false;
          gamePaused = false;
          gameFinished = false; // <--- 關鍵
        }
        break;
      }
    }
    // 如果沒點到任何選單按鈕，則關閉選單並繼續遊戲
    if (!clickedButton) {
      menuVisible = false;
      gamePaused = false;
    }
  }
}

// 工具：隨機排列 menuItems
function shuffleMenuItems() {
  for (let i = menuItems.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [menuItems[i], menuItems[j]] = [menuItems[j], menuItems[i]];
  }
}

// --- 修改 drawMenuOverlay ---
function drawMenuOverlay() {
  fill(0, 180);
  rect(0, 0, width, height);

  // 顯示「已暫停」提示
  fill(255);
  textSize(40);
  textAlign(CENTER, CENTER);
  text('已暫停', width / 2, height / 2 - 100);

  menuItems.forEach(item => item.draw());

  // 鼻子 hover 判斷
  if (predictions.length > 0) {
    const nose = getNosePosition();
    menuItems.forEach(item => {
      if (
        nose.x > item.x && nose.x < item.x + item.w &&
        nose.y > item.y && nose.y < item.y + item.h
      ) {
        if (!item.hoverTimer) item.hoverTimer = millis();
        if (millis() - item.hoverTimer > 2000) {
          if (item.action === 'restart') {
            gameStarted = true;
            gameFinished = false;
            gameSuccess = false;
            collectedSequence = [];
            nextLetterIndex = 0;
            timer = 60;
            leftEyePositions = [];
            rightEyePositions = [];
            eyePathStartTime = millis();
            generateTargets();
            menuVisible = false;
            gamePaused = false;
          } else if (item.action === 'home') {
            resetGame();
            gameFinished = false;
            gamePaused = false;
            return; // <--- 關鍵，避免多次觸發
          }
        }
        item.hovered = true;
      } else {
        item.hovered = false;
        item.hoverTimer = null;
      }
    });
  }
}

// --- 修改 drawEndMenu ---
function drawEndMenu() {
  fill(255);
  textSize(32);
  textAlign(CENTER, CENTER);
  text(gameSuccess ? '恭喜你完成遊戲！' : (gameMode === 'speed' && !gameSuccess ? '失敗了' : '遊戲結束'), width / 2, height / 2 - 50);
  textSize(24);
  text('你的分數：' + score, width / 2, height / 2);

  // 隨機排列選單項目
  shuffleMenuItems();
  menuItems.forEach(item => item.draw());

  // 鼻子 hover 判斷
  if (predictions.length > 0) {
    const nose = getNosePosition();
    menuItems.forEach(item => {
      if (
        nose.x > item.x && nose.x < item.x + item.w &&
        nose.y > item.y && nose.y < item.y + item.h
      ) {
        if (!item.hoverTimer) item.hoverTimer = millis();
        if (millis() - item.hoverTimer > 2000) {
          if (item.action === 'restart') {
            gameStarted = true;
            gameFinished = false;
            gameSuccess = false;
            collectedSequence = [];
            nextLetterIndex = 0;
            timer = 60;
            leftEyePositions = [];
            rightEyePositions = [];
            eyePathStartTime = millis();
            generateTargets();
          } else if (item.action === 'home') {
            resetGame();
            // 關閉結束畫面
            gameFinished = false;
            gamePaused = false;
          }
        }
        item.hovered = true;
      } else {
        item.hovered = false;
        item.hoverTimer = null;
      }
    });
  }
}

// --- 建議：在 setupButtons() 內 menuItems 初始化不變 ---
function setupButtons() {
  modeButtons = [];
  const buttonWidth = 120;
  const buttonHeight = 40;
  const buttonMargin = 10;
  const modeNames = ['練習模式', '記憶模式', '速度模式'];
  modeNames.forEach((name, index) => {
    const x = width / 2 - buttonWidth / 2;
    const y = height / 2 - buttonHeight / 2 + index * (buttonHeight + buttonMargin);
    const button = new ModeButton(x, y, buttonWidth, buttonHeight, name, index);
    modeButtons.push(button);
  });

  const iconSize = 40;
  menuIcon = new MenuIcon(10, 10, iconSize);

  // 漢堡選單項目
  menuItems = [
    new MenuItem(width / 2 - 80, height / 2 - 30, 160, 40, '重新開始', 'restart'),
    new MenuItem(width / 2 - 80, height / 2 + 30, 160, 40, '返回主頁', 'home')
  ];
}

function drawMainMenu() {
  fill(255);
  textSize(32);
  textAlign(CENTER, CENTER);
  text('選擇遊戲模式', width / 2, height / 2 - 50);

  let nose = null;
  if (predictions.length > 0) {
    nose = getNosePosition();
  }

  modeButtons.forEach((button, idx) => {
    if (
      nose &&
      nose.x > button.x && nose.x < button.x + button.w &&
      nose.y > button.y && nose.y < button.y + button.h
    ) {
      if (!button.hoverTimer) button.hoverTimer = millis();
      if (millis() - button.hoverTimer > 2000) {
        resetGame();
        collectedSequence = [];
        selectedMode = idx;
        gameMode = ['practice', 'memory', 'speed'][idx];
        gameStarted = true;
        generateTargets();
      }
      button.hovered = true;
    } else {
      button.hovered = false;
      button.hoverTimer = null;
    }
    button.draw();
  });
}

// --- drawEndMenu 也移除 startButton ---
function drawEndMenu() {
  fill(255);
  textSize(32);
  textAlign(CENTER, CENTER);
  text(gameSuccess ? '恭喜你完成遊戲！' : (gameMode === 'speed' && !gameSuccess ? '失敗了' : '遊戲結束'), width / 2, height / 2 - 50);
  textSize(24);
  text('你的分數：' + score, width / 2, height / 2);

  // 隨機排列選單項目
  shuffleMenuItems();
  menuItems.forEach(item => item.draw());

  // 鼻子 hover 判斷
  if (predictions.length > 0) {
    const nose = getNosePosition();
    menuItems.forEach(item => {
      if (
        nose.x > item.x && nose.x < item.x + item.w &&
        nose.y > item.y && nose.y < item.y + item.h
      ) {
        if (!item.hoverTimer) item.hoverTimer = millis();
        if (millis() - item.hoverTimer > 2000) {
          if (item.action === 'restart') {
            gameStarted = true;
            gameFinished = false;
            gameSuccess = false;
            collectedSequence = [];
            nextLetterIndex = 0;
            timer = 60;
            leftEyePositions = [];
            rightEyePositions = [];
            eyePathStartTime = millis();
            generateTargets();
          } else if (item.action === 'home') {
            resetGame();
            // 關閉結束畫面
            gameFinished = false;
            gamePaused = false;
          }
        }
        item.hovered = true;
      } else {
        item.hovered = false;
        item.hoverTimer = null;
      }
    });
  }
}

// ----- 漢堡選單 -----
function drawMenuOverlay() {
  fill(0, 180);
  rect(0, 0, width, height);

  // 顯示「已暫停」提示
  fill(255);
  textSize(40);
  textAlign(CENTER, CENTER);
  text('已暫停', width / 2, height / 2 - 100);

  menuItems.forEach(item => item.draw());

  // 鼻子 hover 判斷
  if (predictions.length > 0) {
    const nose = getNosePosition();
    menuItems.forEach(item => {
      if (
        nose.x > item.x && nose.x < item.x + item.w &&
        nose.y > item.y && nose.y < item.y + item.h
      ) {
        if (!item.hoverTimer) item.hoverTimer = millis();
        if (millis() - item.hoverTimer > 2000) {
          if (item.action === 'restart') {
            gameStarted = true;
            gameFinished = false;
            gameSuccess = false;
            collectedSequence = [];
            nextLetterIndex = 0;
            timer = 60;
            leftEyePositions = [];
            rightEyePositions = [];
            eyePathStartTime = millis();
            generateTargets();
            menuVisible = false;
            gamePaused = false;
          } else if (item.action === 'home') {
            resetGame();
            menuVisible = false;
            gamePaused = false;
          }
        }
        item.hovered = true;
      } else {
        item.hovered = false;
        item.hoverTimer = null;
      }
    });
  }
}

// ----- UI 類別 -----
function ModeButton(x, y, w, h, label, index) {
  this.x = x;
  this.y = y;
  this.w = w;
  this.h = h;
  this.label = label;
  this.index = index;
  this.hovered = false;
  this.hoverTimer = null; // 必須有這行

  this.draw = function() {
    fill(this.hovered ? 'lightblue' : 255);
    stroke(0);
    strokeWeight(2);
    rect(this.x, this.y, this.w, this.h, 10);

    fill(0);
    noStroke();
    textAlign(CENTER, CENTER);
    textSize(16);
    text(this.label, this.x + this.w / 2, this.y + this.h / 2);
  }
}

function MenuIcon(x, y, size) {
  this.x = x;
  this.y = y;
  this.size = size;
  this.visible = true;

  this.draw = function() {
    if (!this.visible) return;
    fill(255);
    noStroke();
    ellipse(this.x + this.size / 2, this.y + this.size / 2, this.size);

    stroke(0);
    strokeWeight(4);
    let lineY = this.y + this.size / 2;
    line(this.x + 10, lineY, this.x + this.size - 10, lineY);
    line(this.x + this.size / 2, this.y + 10, this.x + this.size / 2, this.y + this.size - 10);
  }
}

function MenuItem(x, y, w, h, label, action) {
  this.x = x;
  this.y = y;
  this.w = w;
  this.h = h;
  this.label = label;
  this.action = action;
  this.hovered = false;
  this.hoverTimer = null;

  this.draw = function() {
    fill(this.hovered ? 'orange' : 255);
    stroke(0);
    strokeWeight(2);
    rect(this.x, this.y, this.w, this.h, 10);

    fill(0);
    noStroke();
    textAlign(CENTER, CENTER);
    textSize(20);
    text(this.label, this.x + this.w / 2, this.y + this.h / 2);
  }
}

function resetGame() {
  currentTargetChars = [];
  targetPositions = [];
  targetStates = [];
  hoverStartTimes = [];
  collectedSequence = [];
  nextLetterIndex = 0;
  score = 0;
  timer = 60;
  gameStarted = false;
  gameMode = null;
  selectedMode = null;
  gameFinished = false;
  gameSuccess = false;
  gamePaused = false;
  leftEyePositions = [];
  rightEyePositions = [];
  eyePathStartTime = millis();
}