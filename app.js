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
  // float toolbar: sit below topbar on sub-screens
  const tb = document.querySelector('.float-toolbar')
  tb.style.top = id === 'home' ? '12px' : '56px'
}

document.querySelectorAll('.tb-back').forEach(el => {
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

/* ===== Home Page Card Carousel ===== */
const Carousel = {
  cards: [
    { icon: '🏆', title: '斯诺克', desc: '15红球 + 6彩球 · 犯规罚分 · 单杆追踪', screen: 'snooker' },
    { icon: '🎯', title: '中式八球', desc: '翻牌计分 · N局N胜 · 红蓝对决', screen: 'eightball' },
    { icon: '💰', title: '追分', desc: '2-4人 · 4/6/9球 · 得分自定义', screen: 'chase' },
    { icon: '📋', title: '对局记录', desc: '查看历史战绩', action: 'history' }
  ],
  currentIndex: 0,
  targetIndex: 0,
  dragOffset: 0,
  gap: 120,         // vertical gap between cards
  containerH: 310,   // matches CSS .card-carousel height
  cardH: 95,         // approximate card height
  animId: null,
  isDragging: false,
  dragStartY: 0,
  dragStartOffset: 0,
  _wheelTimer: null,
  _snapping: false,

  init() {
    this.currentIndex = 0
    this.targetIndex = 0
    this.dragOffset = 0
    this.buildDOM()
    this.positionCards()
    this.bindEvents()
  },

  buildDOM() {
    const track = document.getElementById('carousel-track')
    track.innerHTML = this.cards.map((c, i) => `
      <div class="carousel-card" data-index="${i}">
        <span class="card-icon">${c.icon}</span>
        <div>
          <span class="card-title">${c.title}</span>
          <span class="card-desc">${c.desc}</span>
        </div>
      </div>
    `).join('')

    const indicator = document.getElementById('carousel-indicator')
    indicator.innerHTML = this.cards.map((_, i) =>
      `<div class="carousel-dot" data-dot="${i}"></div>`
    ).join('')
  },

  cardStyle(index) {
    const dist = index - this.currentIndex
    const centerY = (this.containerH - this.cardH) / 2
    const y = centerY + dist * this.gap + this.dragOffset
    const absDist = Math.abs(dist)

    // scale and opacity based on distance from active
    let scale, opacity, rotX
    if (absDist < 0.5) {
      // Active card (interpolating toward center)
      const t = absDist * 2 // 0 to 1 within half-step
      scale = 1 - t * 0.12
      opacity = 1 - t * 0.3
      rotX = dist * 8
    } else if (absDist < 1.5) {
      scale = 0.85
      opacity = 0.55
      rotX = dist > 0 ? -25 : 25
    } else {
      scale = 0.7
      opacity = 0.25
      rotX = dist > 0 ? -40 : 40
    }

    return {
      transform: `translateY(${y}px) scale(${scale}) rotateX(${rotX}deg)`,
      opacity: opacity,
      zIndex: 10 - absDist * 5
    }
  },

  positionCards() {
    const cards = document.querySelectorAll('.carousel-card')
    cards.forEach((card, i) => {
      const s = this.cardStyle(i)
      card.style.transform = s.transform
      card.style.opacity = s.opacity
      card.style.zIndex = s.zIndex
      card.classList.toggle('active', i === this.currentIndex)
    })

    document.querySelectorAll('.carousel-dot').forEach((dot, i) => {
      dot.classList.toggle('active', i === this.currentIndex)
    })
  },

  snapTo(index) {
    this.targetIndex = ((index % this.cards.length) + this.cards.length) % this.cards.length
    this._snapping = true
    const startOffset = this.dragOffset
    const startIndex = this.currentIndex
    const targetOffset = (startIndex - this.targetIndex) * this.gap
    const startTime = performance.now()
    const duration = 350

    const animate = (now) => {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      this.dragOffset = startOffset + (targetOffset - startOffset) * eased

      // When offset passes threshold, switch currentIndex
      const netOffset = this.dragOffset
      const shiftedBy = Math.round(netOffset / this.gap)
      const newIndex = ((startIndex - shiftedBy) % this.cards.length + this.cards.length) % this.cards.length
      if (newIndex !== this.currentIndex) {
        this.currentIndex = newIndex
        this.dragOffset = netOffset - shiftedBy * this.gap
      }

      this.positionCards()

      if (progress < 1) {
        this.animId = requestAnimationFrame(animate)
      } else {
        // Final snap
        this.currentIndex = this.targetIndex
        this.dragOffset = 0
        this.positionCards()
        this.animId = null
        this._snapping = false
      }
    }
    if (this.animId) cancelAnimationFrame(this.animId)
    this.animId = requestAnimationFrame(animate)
  },

  selectActive() {
    const card = this.cards[this.currentIndex]
    if (card.screen) {
      showScreen(card.screen)
    } else if (card.action === 'history') {
      showHistory()
    }
  },

  bindEvents() {
    const el = document.getElementById('card-carousel')

    el.addEventListener('click', (e) => {
      if (this.isDragging || this._snapping) return
      const card = e.target.closest('.carousel-card')
      if (card) {
        const idx = parseInt(card.dataset.index)
        if (idx === this.currentIndex) {
          this.selectActive()
        } else {
          this.snapTo(idx)
        }
      }
    })

    el.addEventListener('pointerdown', (e) => {
      if (this._snapping) return
      this.isDragging = true
      this.dragStartY = e.clientY
      this.dragStartOffset = this.dragOffset
      el.classList.add('dragging')
      el.setPointerCapture(e.pointerId)
    })

    el.addEventListener('pointermove', (e) => {
      if (!this.isDragging) return
      const deltaY = e.clientY - this.dragStartY
      if (Math.abs(deltaY) < 3) return
      this.dragOffset = this.dragStartOffset + deltaY

      // Switch currentIndex when offset crosses gap/2
      const totalOffset = this.dragStartOffset + deltaY
      const crossed = Math.round(totalOffset / this.gap)
      const startShifted = Math.round(this.dragStartOffset / this.gap)
      const indexDelta = crossed - startShifted
      if (indexDelta !== 0) {
        let newIdx = this.currentIndex - indexDelta
        newIdx = ((newIdx % this.cards.length) + this.cards.length) % this.cards.length
        if (newIdx !== this.currentIndex) {
          this.currentIndex = newIdx
          this.dragOffset = totalOffset - crossed * this.gap
          this.dragStartOffset = this.dragOffset
          this.dragStartY = e.clientY
        }
      }
      this.positionCards()
    })

    el.addEventListener('pointerup', () => {
      if (!this.isDragging) return
      this.isDragging = false
      el.classList.remove('dragging')
      this.snapTo(this.currentIndex)
    })

    el.addEventListener('pointerleave', () => {
      if (this.isDragging) {
        this.isDragging = false
        el.classList.remove('dragging')
        this.snapTo(this.currentIndex)
      }
    })

    el.addEventListener('wheel', (e) => {
      e.preventDefault()
      if (this._snapping) return
      this.dragOffset -= e.deltaY * 0.4
      const crossed = Math.round(this.dragOffset / this.gap)
      if (crossed !== 0) {
        let newIdx = this.currentIndex - crossed
        newIdx = ((newIdx % this.cards.length) + this.cards.length) % this.cards.length
        this.currentIndex = newIdx
        this.dragOffset -= crossed * this.gap
      }
      this.positionCards()
      clearTimeout(this._wheelTimer)
      this._wheelTimer = setTimeout(() => this.snapTo(this.currentIndex), 250)
    }, { passive: false })

    document.getElementById('carousel-indicator').addEventListener('click', (e) => {
      const dot = e.target.closest('.carousel-dot')
      if (dot) this.snapTo(parseInt(dot.dataset.dot))
    })

    document.addEventListener('keydown', (e) => {
      if (!document.getElementById('home').classList.contains('active')) return
      if (this._snapping) return
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault()
        const dir = e.key === 'ArrowUp' ? -1 : 1
        this.snapTo(this.currentIndex + dir)
      }
      if (e.key === 'Enter') this.selectActive()
    })
  }
}

Carousel.init()

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

  remainingPoints() {
    if (this.phase === 'gameover') return 0
    const colorSum = this.colorsOn.reduce((a, b) => a + b, 0)
    if (this.phase === 'colors') return colorSum
    return this.reds * 8 + colorSum
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
    document.getElementById('snk-remaining').textContent = this.remainingPoints()
    document.getElementById('snk-remaining-area').style.display = this.phase === 'gameover' ? 'none' : ''

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

// Scoreboard mode toggle
let scoreboardMode = false
document.getElementById('eb-scoreboard').addEventListener('click', () => {
  scoreboardMode = !scoreboardMode
  document.body.classList.toggle('scoreboard-mode', scoreboardMode)
  document.getElementById('eb-scoreboard').textContent = scoreboardMode ? '退出计分牌' : '计分牌模式'
  // Hide other screens from nav
  document.querySelectorAll('.tb-back').forEach(b => b.style.display = scoreboardMode ? 'none' : '')
  if (!scoreboardMode) {
    document.querySelectorAll('.tb-back').forEach(b => b.style.display = '')
  }
})
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

/* ===== Fullscreen + Landscape Toggle (combined) ===== */
let isRotated = false
document.getElementById('btn-rotate').addEventListener('click', () => {
  isRotated = !isRotated
  const app = document.getElementById('app')
  if (isRotated) {
    // 1. Go fullscreen
    const el = document.documentElement
    if (!document.fullscreenElement && !document.webkitFullscreenElement) {
      ;(el.requestFullscreen || el.webkitRequestFullscreen).call(el)
    }
    // 2. Lock landscape orientation
    try { screen.orientation.lock('landscape').catch(() => {}) } catch(e) {}
    // 3. Apply CSS rotate class
    app.classList.add('rotated')
  } else {
    // Exit fullscreen
    if (document.fullscreenElement || document.webkitFullscreenElement) {
      (document.exitFullscreen || document.webkitExitFullscreen).call(document)
    }
    // Unlock orientation
    try { screen.orientation.unlock() } catch(e) {}
    // Remove CSS rotate
    app.classList.remove('rotated')
  }
})

/* ===== Match Result Image Generator ===== */
function generateShareImage(mode, data) {
  const canvas = document.getElementById('share-canvas')
  const ctx = canvas.getContext('2d')
  const w = canvas.width, h = canvas.height

  // Background - pool table green felt
  const bgGrad = ctx.createRadialGradient(w/2, h*0.3, 100, w/2, h, 800)
  bgGrad.addColorStop(0, '#1a4a2a')
  bgGrad.addColorStop(0.5, '#0d2b15')
  bgGrad.addColorStop(1, '#050f08')
  ctx.fillStyle = bgGrad
  ctx.fillRect(0, 0, w, h)

  // Corner decorations (like pool table pockets)
  const corners = [[40,40],[w-40,40],[40,h-40],[w-40,h-40]]
  corners.forEach(([x,y]) => {
    ctx.fillStyle = '#000'
    ctx.beginPath(); ctx.arc(x, y, 30, 0, Math.PI*2); ctx.fill()
  })

  // Title
  ctx.fillStyle = '#ffd60a'
  ctx.font = 'bold 42px "Arial Black", "PingFang SC", sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('台球计分器', w/2, 120)

  // Mode
  ctx.fillStyle = '#98989d'
  ctx.font = '24px "PingFang SC", sans-serif'
  ctx.fillText(mode, w/2, 165)

  // Divider
  ctx.strokeStyle = 'rgba(255,255,255,0.15)'
  ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(80, 200); ctx.lineTo(w-80, 200); ctx.stroke()

  // Score/Result
  ctx.fillStyle = '#fff'
  ctx.font = 'bold 64px "Arial Black", "PingFang SC", sans-serif'
  ctx.fillText(data.result, w/2, 290)

  // Players & Scores
  if (data.players) {
    data.players.forEach((p, i) => {
      const y = 400 + i * 160
      // Player card
      ctx.fillStyle = i === 0 ? 'rgba(255,59,48,0.15)' : i === 1 ? 'rgba(0,122,255,0.15)' : 'rgba(255,255,255,0.05)'
      ctx.fillRect(100, y - 40, w - 200, 120)
      ctx.strokeStyle = 'rgba(255,255,255,0.1)'
      ctx.strokeRect(100, y - 40, w - 200, 120)

      ctx.fillStyle = '#fff'
      ctx.font = 'bold 36px "Arial Black", "PingFang SC", sans-serif'
      ctx.textAlign = 'left'
      ctx.fillText(`${i+1}. ${p.name}`, 140, y + 10)

      ctx.fillStyle = '#ffd60a'
      ctx.font = 'bold 56px "Arial Black", sans-serif'
      ctx.textAlign = 'right'
      ctx.fillText(`${p.score}分`, w - 140, y + 15)
    })
  }

  // Date
  ctx.fillStyle = 'rgba(255,255,255,0.3)'
  ctx.font = '20px "PingFang SC", sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(new Date().toLocaleString(), w/2, h - 100)

  // Bottom branding
  ctx.fillStyle = 'rgba(255,255,255,0.15)'
  ctx.font = '18px "PingFang SC", sans-serif'
  ctx.fillText('台球计分器 · billiards-scorer', w/2, h - 50)

  return canvas.toDataURL('image/png')
}

// Share button on snooker
function addShareToTopbar(screenId, mode, getData) {
  const topbar = document.querySelector(`#${screenId} .topbar`)
  if (!topbar || topbar.querySelector('.tb-share')) return
  const btn = document.createElement('button')
  btn.className = 'tb-action tb-share'
  btn.textContent = '分享'
  btn.addEventListener('click', () => {
    const data = getData()
    const imgUrl = generateShareImage(mode, data)
    // Try Web Share API first, fallback to download
    if (navigator.share && navigator.canShare) {
      fetch(imgUrl).then(r => r.blob()).then(blob => {
        const file = new File([blob], 'billiards-result.png', {type:'image/png'})
        navigator.share({ files: [file], title: '台球计分器战绩', text: data.result })
          .catch(() => downloadImage(imgUrl))
      }).catch(() => downloadImage(imgUrl))
    } else {
      downloadImage(imgUrl)
    }
  })
  topbar.appendChild(btn)
}

function downloadImage(url) {
  const a = document.createElement('a')
  a.href = url; a.download = 'billiards-result.png'
  document.body.appendChild(a); a.click(); document.body.removeChild(a)
}

// Add share buttons when screens are shown
new MutationObserver(() => {
  if (document.getElementById('snooker').classList.contains('active')) {
    addShareToTopbar('snooker', '斯诺克', () => ({
      result: Snk.p1 > Snk.p2 ? '选手1 获胜' : Snk.p2 > Snk.p1 ? '选手2 获胜' : '平局',
      players: [{name:'选手1',score:Snk.p1}, {name:'选手2',score:Snk.p2}]
    }))
  }
  if (document.getElementById('eightball').classList.contains('active')) {
    addShareToTopbar('eightball', '中式八球', () => ({
      result: `${EB.games1}:${EB.games2} (${EB.totalGames}局${Math.ceil(EB.totalGames/2)}胜)`,
      players: [{name:'选手1',score:EB.games1}, {name:'选手2',score:EB.games2}]
    }))
  }
  if (document.getElementById('chase').classList.contains('active')) {
    addShareToTopbar('chase', '追分', () => ({
      result: Chase.players.length ? Chase.players.map(p => `${p.name}:${p.score}`).join(' | ') : '新游戏',
      players: Chase.players.map(p => ({name:p.name, score:p.score}))
    }))
  }
}).observe(document.getElementById('app'), { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] })

/* ===== Initialize ===== */
Snk.init()
EB.init()
Chase.init()
showScreen('home')
