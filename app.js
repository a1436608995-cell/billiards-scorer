/* ===== Audio Engine ===== */
const AudioCtx = window.AudioContext || window.webkitAudioContext
let audioCtx

function beep(freq, duration, type = 'sine', vol = 0.08) {
  if (!audioCtx) audioCtx = new AudioCtx()
  const o = audioCtx.createOscillator()
  const g = audioCtx.createGain()
  o.type = type; o.frequency.value = freq
  g.gain.value = vol; g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration)
  o.connect(g); g.connect(audioCtx.destination)
  o.start(); o.stop(audioCtx.currentTime + duration)
}

function sfxPot() { beep(800, 0.1, 'sine', 0.06); setTimeout(() => beep(1200, 0.08, 'sine', 0.04), 60) }
function sfxFoul() { beep(200, 0.3, 'square', 0.06) }
function sfxWin() { beep(523, 0.15); setTimeout(() => beep(659, 0.15), 150); setTimeout(() => beep(784, 0.3), 300) }
function sfxFlip() { beep(600, 0.08, 'triangle', 0.04) }

/* ===== Screen Navigation ===== */
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'))
  document.getElementById(id).classList.add('active')
  if (id === 'home') document.querySelector('.kb-hint')?.remove()
}

document.querySelectorAll('.tb-back, .card').forEach(el => {
  el.addEventListener('click', () => {
    const screen = el.dataset.screen
    if (screen) showScreen(screen)
  })
})

/* ===== Modal Helpers ===== */
function openModal(id) { document.getElementById(id).classList.add('active') }
function closeModal(id) { document.getElementById(id).classList.remove('active') }
document.querySelectorAll('.modal-cancel').forEach(btn => {
  btn.addEventListener('click', () => {
    btn.closest('.modal-overlay').classList.remove('active')
  })
})
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.classList.remove('active')
  })
})

/* ===== Keyboard Hints ===== */
function showKbHint(text) {
  document.querySelector('.kb-hint')?.remove()
  const el = document.createElement('div')
  el.className = 'kb-hint'; el.textContent = text
  document.body.appendChild(el)
}

/* ===== History ===== */
function saveHistory(mode, detail) {
  const records = JSON.parse(localStorage.getItem('billiards_history') || '[]')
  records.unshift({ mode, detail, time: new Date().toLocaleString() })
  if (records.length > 50) records.length = 50
  localStorage.setItem('billiards_history', JSON.stringify(records))
}

function showHistory() {
  const records = JSON.parse(localStorage.getItem('billiards_history') || '[]')
  const list = document.getElementById('history-list')
  list.innerHTML = records.length === 0
    ? '<div class="history-item" style="text-align:center;color:var(--text2)">暂无记录</div>'
    : records.map(r => `
      <div class="history-item">
        <div class="hi-mode">${r.mode}</div>
        <div class="hi-detail">${r.detail}</div>
        <div class="hi-time">${r.time}</div>
      </div>`).join('')
  openModal('history-modal')
}

// 首页增加历史入口
document.addEventListener('DOMContentLoaded', () => {
  const home = document.getElementById('home')
  const histBtn = document.createElement('button')
  histBtn.className = 'card'
  histBtn.style.cssText = 'margin-top:16px;opacity:0.6'
  histBtn.innerHTML = '<span class="card-icon">📋</span><span class="card-title">对局记录</span><span class="card-desc">查看历史战绩</span>'
  histBtn.addEventListener('click', showHistory)
  home.querySelector('.cards').appendChild(histBtn)
})

/* ================================================================
   SNOOKER
   ================================================================ */
const Snk = {
  p1: 0, p2: 0, cur: 1, break: 0,
  reds: 15, phase: 'red', // 'red'|'color'|'colors'|'over'
  colorsOn: [2,3,4,5,6,7], nextIdx: 0,
  history: [],

  init() {
    this.p1 = 0; this.p2 = 0; this.cur = 1; this.break = 0
    this.reds = 15; this.phase = 'red'
    this.colorsOn = [2,3,4,5,6,7]; this.nextIdx = 0
    this.history = []
    this.render()
    document.getElementById('snk-foul-modal').classList.remove('active')
    showKbHint('键盘: R/1=红球  2-7=彩球(按分值)  F=犯规  Space=换人  Z=撤销')
  },

  save() {
    this.history.push({
      p1: this.p1, p2: this.p2, cur: this.cur, break: this.break,
      reds: this.reds, phase: this.phase,
      colorsOn: [...this.colorsOn], nextIdx: this.nextIdx
    })
    if (this.history.length > 50) this.history.shift()
  },

  potRed() {
    if (this.phase !== 'red' || this.reds <= 0) return
    this.save(); sfxPot()
    this.reds--
    if (this.cur === 1) this.p1++; else this.p2++
    this.break++
    this.phase = 'color'
    this.render()
    this.setMsg(this.reds === 0 ? '红球清完！击打彩球，将进入清彩阶段' : '进红球！请击打彩球')
  },

  potColor(val) {
    if (this.phase === 'gameover' || this.phase === 'red') return

    if (this.phase === 'colors') {
      if (val !== this.colorsOn[this.nextIdx]) {
        this.setMsg('必须按顺序击打彩球：黄→绿→棕→蓝→粉→黑'); beep(150, 0.2, 'square', 0.04); return
      }
      this.save(); sfxPot()
      if (this.cur === 1) this.p1 += val; else this.p2 += val
      this.break += val
      this.colorsOn = this.colorsOn.filter(c => c !== val)
      this.nextIdx++
      if (this.colorsOn.length === 0) {
        this.phase = 'gameover'
        this.render()
        this.finish()
        return
      }
      this.render()
      this.setMsg('进了！请继续按顺序击打彩球')
      return
    }

    // phase === 'color'
    this.save(); sfxPot()
    if (this.cur === 1) this.p1 += val; else this.p2 += val
    this.break += val

    if (this.reds > 0) {
      this.phase = 'red'
      this.setMsg(`进彩球(+${val})！请击打红球`)
    } else {
      this.phase = 'colors'
      this.colorsOn = this.colorsOn.filter(c => c !== val)
      if (this.colorsOn.length === 0) {
        this.phase = 'gameover'
        this.render()
        this.finish()
        return
      }
      this.setMsg('进入清彩阶段！按顺序击打：黄→绿→棕→蓝→粉→黑')
    }
    this.render()
  },

  foul(pts) {
    if (this.phase === 'gameover') return
    this.save(); sfxFoul()
    const opp = this.cur === 1 ? 2 : 1
    if (opp === 1) this.p1 += pts; else this.p2 += pts
    this.cur = opp; this.break = 0
    closeModal('snk-foul-modal')
    this.render()
    this.setMsg(`犯规！对手+${pts}分`)
  },

  switchPlayer() {
    if (this.phase === 'gameover') return
    this.save()
    this.cur = this.cur === 1 ? 2 : 1; this.break = 0
    this.render()
    this.setMsg('未进球，换人')
  },

  undo() {
    if (this.history.length === 0) return
    const s = this.history.pop()
    Object.assign(this, s)
    this.colorsOn = [...s.colorsOn]
    this.render()
    this.setMsg('已撤销')
  },

  finish() {
    const winner = this.p1 > this.p2 ? '选手1' : (this.p2 > this.p1 ? '选手2' : '平局')
    this.setMsg(`比赛结束！${winner}获胜 (${this.p1}:${this.p2})`)
    sfxWin()
    saveHistory('斯诺克', `${winner}获胜 ${this.p1}:${this.p2}`)
  },

  setMsg(m) { document.getElementById('snk-msg').textContent = m },

  render() {
    document.getElementById('snk-score1').textContent = this.p1
    document.getElementById('snk-score2').textContent = this.p2
    document.getElementById('snk-break').textContent = this.break
    document.getElementById('snk-break-area').style.display = this.break > 0 ? '' : 'none'
    document.getElementById('snk-reds').textContent = this.reds
    document.getElementById('snk-red-count').textContent = this.reds

    const p1El = document.getElementById('snk-p1')
    const p2El = document.getElementById('snk-p2')
    p1El.classList.toggle('active', this.phase !== 'gameover' && this.cur === 1)
    p2El.classList.toggle('active', this.phase !== 'gameover' && this.cur === 2)

    const redBtn = document.getElementById('snk-red-btn')
    redBtn.classList.toggle('disabled', this.phase !== 'red' || this.reds <= 0)
    redBtn.classList.toggle('must-hit', this.phase === 'red' && this.reds > 0)
    redBtn.style.display = this.reds <= 0 ? 'none' : ''

    const phaseColors = {
      red: '🎯 击打红球', color: '🎯 击打彩球',
      colors: '🎯 清彩阶段', gameover: '🏁 比赛结束'
    }
    document.getElementById('snk-phase').textContent = phaseColors[this.phase] || ''

    document.querySelectorAll('.snk-colors .color-ball').forEach(btn => {
      const v = parseInt(btn.dataset.value)
      const onTable = this.colorsOn.includes(v)
      btn.classList.toggle('disabled', this.phase === 'red' || this.phase === 'gameover' || !onTable)
      btn.classList.toggle('must-hit', this.phase === 'colors' && onTable && v === this.colorsOn[this.nextIdx])
      btn.style.display = onTable ? '' : 'none'
    })
  }
}

// Snooker event bindings
document.getElementById('snk-red-btn').addEventListener('click', () => Snk.potRed())
document.querySelectorAll('.snk-colors .color-ball').forEach(btn => {
  btn.addEventListener('click', () => Snk.potColor(parseInt(btn.dataset.value)))
})
document.getElementById('snk-foul').addEventListener('click', () => openModal('snk-foul-modal'))
document.querySelectorAll('#snk-foul-modal .foul-opt').forEach(btn => {
  btn.addEventListener('click', () => Snk.foul(parseInt(btn.dataset.pts)))
})
document.getElementById('snk-switch').addEventListener('click', () => Snk.switchPlayer())
document.getElementById('snk-undo').addEventListener('click', () => Snk.undo())
document.getElementById('snk-new').addEventListener('click', () => { Snk.init(); Snk.setMsg('新一局开始！请击打红球') })
// Snooker init when screen shown
new MutationObserver(() => {
  if (document.getElementById('snooker').classList.contains('active')) Snk.init()
}).observe(document.getElementById('snooker'), { attributes: true, attributeFilter: ['class'] })


/* ================================================================
   EIGHT-BALL (Flip Score)
   ================================================================ */
const EB = {
  p1: 0, p2: 0,       // current game score (meaningless for eight-ball, just wins)
  games1: 0, games2: 0, // match games
  totalGames: 7,
  history: [],

  init() {
    this.p1 = 0; this.p2 = 0; this.games1 = 0; this.games2 = 0
    this.totalGames = parseInt(localStorage.getItem('eb_total') || '7')
    this.history = []
    this.render()
    document.getElementById('eb-format-modal').classList.remove('active')
    showKbHint('键盘: 1=选手1得分  2=选手2得分  Z=撤销')
  },

  save() {
    this.history.push({ p1: this.p1, p2: this.p2, games1: this.games1, games2: this.games2 })
    if (this.history.length > 50) this.history.shift()
  },

  addScore(player) {
    this.save(); sfxFlip()
    if (player === 1) this.p1++; else this.p2++

    // Flip animation
    const card = document.getElementById(`flip${player}`)
    const front = card.querySelector('.flip-front')
    const back = card.querySelector('.flip-back')
    back.textContent = player === 1 ? this.p1 : this.p2
    card.classList.add('flipping')
    setTimeout(() => {
      front.textContent = player === 1 ? this.p1 : this.p2
      card.classList.remove('flipping')
    }, 500)

    this.checkWin()
    this.render()
  },

  checkWin() {
    const msgEl = document.getElementById('eb-msg')
    // In eight-ball, the game ends when someone reaches a target.
    // But here we're just tracking score per game. The player who
    // pockets the 8-ball wins. Simplified: just track wins.
    // We'll leave win declaration to the players - they tap when someone wins.
    // For now, each +1 represents a ball potted.
    msgEl.textContent = ''
  },

  gameWin(player) {
    this.save()
    if (player === 1) this.games1++; else this.games2++
    const half = Math.ceil(this.totalGames / 2)
    if (this.games1 >= half || this.games2 >= half) {
      const winner = this.games1 > this.games2 ? '选手1' : '选手2'
      document.getElementById('eb-msg').textContent = `比赛结束！${winner} 以 ${Math.max(this.games1,this.games2)}:${Math.min(this.games1,this.games2)} 获胜`
      sfxWin()
      saveHistory('中式八球', `${winner}获胜 ${this.games1}:${this.games2}`)
    } else {
      document.getElementById('eb-msg').textContent = `选手${player} 赢得此局！`
      sfxPot()
    }
    this.p1 = 0; this.p2 = 0
    this.render()
  },

  undo() {
    if (this.history.length === 0) return
    const s = this.history.pop()
    this.p1 = s.p1; this.p2 = s.p2; this.games1 = s.games1; this.games2 = s.games2
    this.render()
    // Force update flip cards
    document.querySelectorAll('.flip-front').forEach((f, i) => {
      f.textContent = i === 0 ? this.p1 : this.p2
    })
  },

  setTotal(n) {
    this.totalGames = n
    localStorage.setItem('eb_total', n)
    closeModal('eb-format-modal')
    this.render()
  },

  render() {
    document.getElementById('eb-games').textContent = `${this.games1} : ${this.games2}`
    document.getElementById('eb-format').textContent = `${this.totalGames}局${Math.ceil(this.totalGames/2)}胜`
    // Keep flip card fronts in sync
    document.querySelectorAll('.flip-front').forEach((f, i) => {
      f.textContent = i === 0 ? this.p1 : this.p2
    })
  }
}

document.querySelectorAll('.eb-plus').forEach(btn => {
  btn.addEventListener('click', () => EB.addScore(parseInt(btn.dataset.player)))
})
document.getElementById('eb-undo').addEventListener('click', () => EB.undo())
document.getElementById('eb-reset-game').addEventListener('click', () => {
  EB.p1 = 0; EB.p2 = 0
  EB.render()
  document.querySelectorAll('.flip-front').forEach((f, i) => { f.textContent = '0' })
  document.getElementById('eb-msg').textContent = ''
})
document.getElementById('eb-new').addEventListener('click', () => EB.init())
document.getElementById('eb-format-btn').addEventListener('click', () => openModal('eb-format-modal'))
document.querySelectorAll('#eb-format-modal .foul-opt').forEach(btn => {
  btn.addEventListener('click', () => EB.setTotal(parseInt(btn.dataset.total)))
})

// Long press on flip card to register a game win
document.querySelectorAll('.flip-card').forEach(card => {
  let timer
  card.addEventListener('pointerdown', () => {
    timer = setTimeout(() => {
      const player = card.id === 'flip1' ? 1 : 2
      EB.gameWin(player)
    }, 800)
  })
  card.addEventListener('pointerup', () => clearTimeout(timer))
  card.addEventListener('pointerleave', () => clearTimeout(timer))
})

// Init EB when shown
new MutationObserver(() => {
  if (document.getElementById('eightball').classList.contains('active')) EB.init()
}).observe(document.getElementById('eightball'), { attributes: true, attributeFilter: ['class'] })


/* ================================================================
   CHASE / 追分
   ================================================================ */
const Chase = {
  playerCount: 3,
  ballCount: 9,
  rules: { big: 10, small: 5, normal: 3, foul: -1 },
  players: [],      // [{name, score}]
  currentIdx: 0,
  pottedBalls: [],
  history: [],

  init() {
    document.getElementById('ch-setup').style.display = ''
    document.getElementById('ch-game').classList.remove('active')
    document.getElementById('ch-foul-modal')?.classList.remove('active')
    showKbHint('')
    this.updateSetupUI()
  },

  updateSetupUI() {
    // Update segmented controls
    document.querySelectorAll('#ch-player-count button').forEach(b => {
      b.classList.toggle('active', parseInt(b.dataset.n) === this.playerCount)
    })
    document.querySelectorAll('#ch-ball-count button').forEach(b => {
      b.classList.toggle('active', parseInt(b.dataset.n) === this.ballCount)
    })
    document.getElementById('ch-rule-big').value = this.rules.big
    document.getElementById('ch-rule-small').value = this.rules.small
    document.getElementById('ch-rule-normal').value = this.rules.normal
    document.getElementById('ch-rule-foul').value = this.rules.foul
  },

  startGame() {
    // Read rules from inputs
    this.rules.big = parseInt(document.getElementById('ch-rule-big').value) || 10
    this.rules.small = parseInt(document.getElementById('ch-rule-small').value) || 5
    this.rules.normal = parseInt(document.getElementById('ch-rule-normal').value) || 3
    this.rules.foul = parseInt(document.getElementById('ch-rule-foul').value) || -1

    this.players = []
    for (let i = 0; i < this.playerCount; i++) {
      this.players.push({ name: `选手${i + 1}`, score: 0 })
    }
    this.currentIdx = 0
    this.pottedBalls = []
    this.history = []

    document.getElementById('ch-setup').style.display = 'none'
    document.getElementById('ch-game').classList.add('active')
    this.renderGame()
    this.setMsg(`${this.players[0].name} 开球`)
    showKbHint('键盘: 1-9=进球  F=犯规  Space=换人  Z=撤销  B/N/M=大金/小金/普胜')
  },

  save() {
    this.history.push({
      players: this.players.map(p => ({...p})),
      currentIdx: this.currentIdx,
      pottedBalls: [...this.pottedBalls]
    })
    if (this.history.length > 50) this.history.shift()
  },

  score(type) {
    this.save(); sfxPot()
    const p = this.players[this.currentIdx]
    const pts = this.rules[type]
    p.score += pts

    const labels = { big: '大金', small: '小金', normal: '普胜' }
    this.setMsg(`${p.name} ${labels[type]} (+${pts})`)

    if (type === 'big' || type === 'small') {
      // Golden break types - pot the last ball
      this.pottedBalls = []
      for (let i = 1; i <= this.ballCount; i++) this.pottedBalls.push(i)
    }

    this.renderGame()
    this.checkEnd()
  },

  doFoul() {
    this.save(); sfxFoul()
    const p = this.players[this.currentIdx]
    p.score += this.rules.foul
    this.setMsg(`${p.name} 犯规 (${this.rules.foul})`)
    this.nextPlayer()
  },

  nextPlayer() {
    this.currentIdx = (this.currentIdx + 1) % this.playerCount
    this.renderGame()
  },

  potBall(ball) {
    if (this.pottedBalls.includes(ball)) return
    this.save(); sfxPot()
    this.pottedBalls.push(ball)
    const p = this.players[this.currentIdx]
    p.score += 1
    this.setMsg(`${p.name} 打进${ball}号球 (+1)`)
    this.renderGame()

    // If all balls potted, treat as normal win
    if (this.pottedBalls.length >= this.ballCount) {
      this.checkEnd()
    }
  },

  switchPlayer() {
    this.save()
    const old = this.players[this.currentIdx].name
    this.nextPlayer()
    this.setMsg(`${old} 未进球，换${this.players[this.currentIdx].name}`)
  },

  undo() {
    if (this.history.length === 0) return
    const s = this.history.pop()
    this.players = s.players
    this.currentIdx = s.currentIdx
    this.pottedBalls = s.pottedBalls
    this.renderGame()
    this.setMsg('已撤销')
  },

  checkEnd() {
    // Game ends when all balls are cleared (via big/small/normal or potting all)
    if (this.pottedBalls.length >= this.ballCount) {
      const sorted = [...this.players].sort((a, b) => b.score - a.score)
      const msg = `游戏结束！排名: ${sorted.map((p, i) => `${i+1}.${p.name}(${p.score}分)`).join(' ')}`
      this.setMsg(msg)
      sfxWin()
      saveHistory('追分', msg)
    }
  },

  setMsg(m) { document.getElementById('ch-msg').textContent = m },

  renderGame() {
    const container = document.getElementById('ch-players')
    container.innerHTML = this.players.map((p, i) => `
      <div class="ch-p ${i === this.currentIdx ? 'active' : ''}" data-idx="${i}">
        <div class="ch-p-name">${p.name}</div>
        <div class="ch-p-score">${p.score}</div>
        <div class="ch-p-turn">▼ 击球中</div>
      </div>`).join('')

    // Click player to switch current
    container.querySelectorAll('.ch-p').forEach(el => {
      el.addEventListener('click', () => {
        if (parseInt(el.dataset.idx) !== this.currentIdx) {
          this.save()
          this.currentIdx = parseInt(el.dataset.idx)
          this.renderGame()
          this.setMsg(`切换到${this.players[this.currentIdx].name}击球`)
        }
      })
    })

    // Render balls
    const ballsEl = document.getElementById('ch-balls')
    let html = ''
    for (let i = 1; i <= this.ballCount; i++) {
      html += `<div class="ch-ball ${this.pottedBalls.includes(i) ? 'potted' : ''}"
        data-n="${i}" data-ball="${i}">${i}</div>`
    }
    ballsEl.innerHTML = html
    ballsEl.querySelectorAll('.ch-ball').forEach(b => {
      b.addEventListener('click', () => {
        if (!this.pottedBalls.includes(parseInt(b.dataset.ball))) {
          this.potBall(parseInt(b.dataset.ball))
        }
      })
    })

    // Update score buttons with rule values
    document.querySelectorAll('.btn-score').forEach(btn => {
      const type = btn.dataset.type
      btn.textContent = type === 'big' ? `🌟 大金 (+${this.rules.big})` :
                        type === 'small' ? `⭐ 小金 (+${this.rules.small})` :
                        `普胜 (+${this.rules.normal})`
    })
  }
}

// Chase setup events
document.querySelectorAll('#ch-player-count button').forEach(btn => {
  btn.addEventListener('click', () => {
    Chase.playerCount = parseInt(btn.dataset.n)
    Chase.updateSetupUI()
  })
})
document.querySelectorAll('#ch-ball-count button').forEach(btn => {
  btn.addEventListener('click', () => {
    Chase.ballCount = parseInt(btn.dataset.n)
    Chase.updateSetupUI()
  })
})
document.getElementById('ch-start').addEventListener('click', () => Chase.startGame())

// Chase game events
document.querySelectorAll('.ch-score-btns .btn-score').forEach(btn => {
  btn.addEventListener('click', () => Chase.score(btn.dataset.type))
})
document.getElementById('ch-foul-btn').addEventListener('click', () => Chase.doFoul())
document.getElementById('ch-switch-btn').addEventListener('click', () => Chase.switchPlayer())
document.getElementById('ch-undo').addEventListener('click', () => Chase.undo())
document.getElementById('ch-new').addEventListener('click', () => Chase.init())

// Init chase when shown
new MutationObserver(() => {
  if (document.getElementById('chase').classList.contains('active')) Chase.init()
}).observe(document.getElementById('chase'), { attributes: true, attributeFilter: ['class'] })


/* ===== Global Keyboard Shortcuts ===== */
document.addEventListener('keydown', (e) => {
  const key = e.key.toLowerCase()
  const activeScreen = document.querySelector('.screen.active')?.id

  if (activeScreen === 'snooker' && !document.getElementById('snk-foul-modal').classList.contains('active')) {
    if (key === '1' || key === 'r') Snk.potRed()
    else if (key === '2') Snk.potColor(2)
    else if (key === '3') Snk.potColor(3)
    else if (key === '4') Snk.potColor(4)
    else if (key === '5') Snk.potColor(5)
    else if (key === '6') Snk.potColor(6)
    else if (key === '7') Snk.potColor(7)
    else if (key === 'f') openModal('snk-foul-modal')
    else if (key === ' ' || key === 'space') { e.preventDefault(); Snk.switchPlayer() }
    else if (key === 'z' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); Snk.undo() }
  }

  if (activeScreen === 'eightball') {
    if (key === '1') EB.addScore(1)
    else if (key === '2') EB.addScore(2)
    else if (key === 'z' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); EB.undo() }
  }

  if (activeScreen === 'chase') {
    if (key >= '1' && key <= '9' && parseInt(key) <= Chase.ballCount) {
      const ball = parseInt(key)
      if (!Chase.pottedBalls.includes(ball)) Chase.potBall(ball)
    } else if (key === 'b' && !e.ctrlKey) Chase.score('big')
    else if (key === 'n') Chase.score('normal')
    else if (key === 'm') Chase.score('small')
    else if (key === 'f') Chase.doFoul()
    else if (key === ' ' || key === 'space') { e.preventDefault(); Chase.switchPlayer() }
    else if (key === 'z' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); Chase.undo() }
  }
})

/* ===== Fullscreen ===== */
document.getElementById('btn-fullscreen').addEventListener('click', () => {
  const el = document.documentElement
  if (document.fullscreenElement || document.webkitFullscreenElement) {
    (document.exitFullscreen || document.webkitExitFullscreen).call(document)
  } else {
    (el.requestFullscreen || el.webkitRequestFullscreen).call(el)
  }
})

/* ===== Rotate / Landscape Toggle ===== */
let isRotated = false
document.getElementById('btn-rotate').addEventListener('click', () => {
  isRotated = !isRotated
  const app = document.getElementById('app')
  if (isRotated) {
    app.classList.add('rotated')
    // Try native orientation lock too
    try { screen.orientation.lock('landscape').catch(() => {}) } catch(e) {}
  } else {
    app.classList.remove('rotated')
    try { screen.orientation.unlock() } catch(e) {}
  }
})

/* ===== Initialize ===== */
Snk.init()
EB.init()
Chase.init()
showScreen('home')
