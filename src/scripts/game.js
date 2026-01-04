var Game = pc.createScript('game');

// ================= REDIRECT CONFIG =================
var REDIRECT_BASE_URL = 'https://dev.notwist.in';
var REDIRECT_PATH = '/congratulations';
var REDIRECT_DELAY_MS = 300;
var DEFAULT_USER_ID = '100';
// =====================================================================

Game.attributes.add('uiInGame', { type: 'entity' });
Game.attributes.add('uiGameOver', { type: 'entity', description: 'Game Over overlay screen' });
Game.attributes.add('uiPopup', { type: 'entity', description: 'Popup UI overlay (pauses gameplay while visible)' });
Game.attributes.add('audio', { type: 'entity' });
Game.attributes.add('faceTracker', { type: 'entity' });
Game.attributes.add('scanText', { type: 'entity', description: 'Text' });


Game.STATE_INGAME = 'ingame';
Game.STATE_GAMEOVER = 'gameover';

Game.prototype.initialize = function () {
    this._state = null;
    this._score = 0;

    this.setResolution();
    this.animationController = this.app.root.findByName("astroHelm");
    window.addEventListener("resize", this.setResolution.bind(this));

    if (this.faceTracker) this.faceTracker.enabled = false;
    if (this.uiGameOver) this.uiGameOver.enabled = false;

    this.timeLeft = 60;
    this.timerRunning = false;

    this.popupDuration = 10;
    this.popupTriggerTimes = [48, 36, 24, 12, 0];
    this.nextPopupIndex = 0;

    this._popupActive = false;
    this.popupTimer = 0;
    if (this.uiPopup) this.uiPopup.enabled = false;

    // --- Buff wiring: Cube Spawner ---
    this._spawnerEntity = this.app.root.findByName('Cube Spawner');
    this._ec = (this._spawnerEntity && this._spawnerEntity.script) ? this._spawnerEntity.script.entityCreator : null;

    // ✅ PAUSE STATE
    this._paused = false;
    this._wasTimerRunning = false;
    this._wasSpawnerEnabled = true;

    // thresholds per popup window
    this._densityArmed = false;
    this._speedArmed = false;
    this._densityAt = null;
    this._speedAt = null;

    // still support external start/reset events if you use them anywhere
    this.app.on("ui:start", this.start, this);

    this.app.on('countdown:done', this._onCountdownDone, this);

    this.app.on("biscuit:eaten", this._onBiscuitEaten, this);
    this.app.on("biscuit:detect", this._onBiscuitDetected, this);

    // ✅ NEW: Listen for global pause/resume events
    // Use these from anywhere: this.app.fire('game:pause') / this.app.fire('game:resume')
    this.app.on("game:pause", this._onPauseEvent, this);
    this.app.on("game:resume", this._onResumeEvent, this);

    if (this.uiInGame) this.uiInGame.enabled = false;

    this._heroKey = (function () {
        try {
            var p = new URLSearchParams(window.location.search);
            return (p.get('superheromodel') || '').toLowerCase().trim();
        } catch (e) {
            return '';
        }
    })();
};

// ✅ Event handlers
Game.prototype._onPauseEvent = function () {
    // Only pause during gameplay
    if (this._state !== Game.STATE_INGAME) return;

    // If popup is already active, _pauseGame already done; calling again is harmless
    this._pauseGame();
};

Game.prototype._onResumeEvent = function () {
    // Only resume during gameplay
    if (this._state !== Game.STATE_INGAME) return;

    // If popup is still active, you probably DON'T want to resume gameplay.
    // So block resume while popup is visible.
    if (this._popupActive) return;

    this._resumeGame();
};

// ✅ PAUSE/RESUME HELPERS
Game.prototype._pauseGame = function () {
    if (this._paused) return;
    this._paused = true;

    console.log('[Game] PAUSE gameplay');

    // remember state so resume restores correctly
    this._wasTimerRunning = this.timerRunning;
    this._wasSpawnerEnabled = this._spawnerEntity ? this._spawnerEntity.enabled : true;

    // stop gameplay timer updates
    this.timerRunning = false;

    // pause spawner workload (perf)
    if (this._spawnerEntity) this._spawnerEntity.enabled = false;

    // IMPORTANT: keep faceTracker enabled while paused so tracking/scanning still works if needed
};

Game.prototype._resumeGame = function () {
    if (!this._paused) return;
    this._paused = false;

    console.log('[Game] RESUME gameplay');

    // restore spawner state
    if (this._spawnerEntity) this._spawnerEntity.enabled = !!this._wasSpawnerEnabled;

    // restore timer state
    this.timerRunning = !!this._wasTimerRunning;
};

Game.prototype._onCountdownDone = function () {
    if (!this._popupActive) return;

    console.log('[Game] countdown:done → hide popup');
    this._hidePopup();
};

Game.prototype._armBuffsForNextPopup = function () {
    if (!this._ec) {
        this._spawnerEntity = this.app.root.findByName('Cube Spawner');
        this._ec = (this._spawnerEntity && this._spawnerEntity.script)
            ? this._spawnerEntity.script.entityCreator
            : null;
    }

    if (this.nextPopupIndex >= this.popupTriggerTimes.length) {
        this._densityArmed = this._speedArmed = false;
        this._densityAt = this._speedAt = null;
        return;
    }

    var T = this.popupTriggerTimes[this.nextPopupIndex];

    // Density at 7s into window  -> T + 5
    // Speed   at 10s into window -> T + 2
    this._densityAt = T + 5;
    this._speedAt = T + 2;

    this._densityArmed = true;
    this._speedArmed = true;

    console.log(
        '[Game] Armed 12s window buffs | popup @', T,
        '| density @', this._densityAt,
        '| speed @', this._speedAt
    );
};

Game.prototype._onBiscuitEaten = function () {
    // if (!this._popupActive) return;
    // this.addScore(50);
};

Game.prototype._onBiscuitDetected = function () {
    console.log("Biscuit Detected");

    if (this.scanText && this.scanText.element) {
        this.scanText.element.text = 'JIM JAM Scanned!';
    }
    this.app.fire('buffs:stop');

    // ✅ close popup + resume gameplay immediately
    setTimeout(() => {
        this._hidePopup();
    }, 2000)
};

Game.prototype.setResolution = function () {
    var w = window.screen.width;
    var h = window.screen.height;

    if (w < 640) {
        this.app.setCanvasResolution(pc.RESOLUTION_AUTO, w, h);
        this.app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
    }
};

Game.prototype.start = function () {
    // prevent double-start
    if (this._state === Game.STATE_INGAME && this.timerRunning) return;

    setTimeout(() => {
        if (this.animationController &&
            this.animationController.script &&
            this.animationController.script.animationController) {
            this.animationController.script.animationController.animPlay();
        }
    }, 0);

    this._state = Game.STATE_INGAME;
    this.app.fire("game:start");

    if (this.uiInGame) this.uiInGame.enabled = true;
    if (this.uiPopup) this.uiPopup.enabled = false;

    if (this.faceTracker) this.faceTracker.enabled = true;

    if (this.audio && this.audio.sound) this.audio.sound.play("music");

    this.timeLeft = 60;

    // ensure unpaused + spawner restored
    this._paused = false;
    this.timerRunning = true;
    if (this._spawnerEntity) this._spawnerEntity.enabled = true;

    this.popupTriggerTimes = [48, 36, 24, 12, 0];
    this.nextPopupIndex = 0;

    this._popupActive = false;
    this.popupTimer = 0;

    this._armBuffsForNextPopup();

    this.app.fire("game:timer", Math.ceil(this.timeLeft));
    this.app.fire("game:score", this._score);
};

Game.prototype._redirectToResult = function () {
    var score = this._score || 0;

    var params = new URLSearchParams(window.location.search);
    var userId = params.get('user_id') || DEFAULT_USER_ID;

    var base = (REDIRECT_BASE_URL || '').replace(/\/+$/, '');
    var path = score > 0 ? '/levelling-up' : '/better-luck';
    if (path.charAt(0) !== '/') path = '/' + path;

    var url =
        base + path +
        '?score=' + encodeURIComponent(String(score)) +
        '&user_id=' + encodeURIComponent(String(userId));

    console.log('[Game] Redirect:', url);
    window.top.location.href = url;
};

Game.prototype.gameOver = function () {
    if (this._state === Game.STATE_GAMEOVER) return;

    this.timerRunning = false;

    // stop paused mode + stop spawner at end
    this._paused = false;
    if (this._spawnerEntity) this._spawnerEntity.enabled = false;

    this._hidePopup();

    this._state = Game.STATE_GAMEOVER;
    this.app.fire("game:gameover");

    // ✅ SHOW GAME OVER UI
    if (this.uiGameOver) this.uiGameOver.enabled = true;

    if (this.uiInGame) this.uiInGame.enabled = false;

    if (this.faceTracker) this.faceTracker.enabled = false;

    this.app.fire("game:score", this._score);

    if (this.audio && this.audio.sound) {
        this.audio.sound.stop();
        this.audio.sound.play("gameover");
    }

    // ⚠️ If REDIRECT_DELAY_MS is 300, user won’t see the screen.
    // Increase it (e.g., 2000-3000) OR remove redirect if you want manual restart.
    setTimeout(() => this._redirectToResult(), Math.max(0, REDIRECT_DELAY_MS | 0));
};


Game.prototype.getScore = function () { return this._score; };

Game.prototype.addScore = function (v) {
    this._score += v;
    if (this._score < 0) this._score = 0;
    this.app.fire("game:score", this._score);
};

Game.prototype.resetScore = function () {
    this._score = 0;
    this.app.fire("game:score", this._score);
};

// ✅ Popup now PAUSES gameplay while visible
Game.prototype._showPopup = function () {
    if (this.scanText && this.scanText.element) {
        this.scanText.element.text = 'Scan and eat a Jim Jam biscuit to slow attacks';
    }
    if (this._popupActive) return;

    this._popupActive = true;
    this.popupTimer = this.popupDuration;

    if (this.uiPopup) {
        this.uiPopup.enabled = true;

        // pause gameplay load while scanning
        // this._pauseGame();

        if (window.startBiscuitGate) window.startBiscuitGate();
    }

    this.app.fire('popup:show');
};

// ✅ Hide popup RESUMES game
Game.prototype._hidePopup = function () {
    if (this.uiPopup) this.uiPopup.enabled = false;

    if (!this._popupActive) return;

    this._popupActive = false;
    this.popupTimer = 0;

    if (window.stopBiscuitGate) {
        window.stopBiscuitGate();
    }

    if (this.scanText && this.scanText.element) {
        this.scanText.element.text = 'Scan and eat a Jim Jam biscuit to slow attacks';
    }
    this.app.fire('popup:hide');

    // resume gameplay after popup closes
    if (this._state === Game.STATE_INGAME) {
        this._resumeGame();
    }
};

Game.prototype.update = function (dt) {
    if (this._state !== Game.STATE_INGAME) return;

    // ✅ While paused: STILL let popup timer run so it can auto-close and resume
    // if (this._paused) {
    //     if (this._popupActive) {
    //         this.popupTimer -= dt;
    //         if (this.popupTimer <= 0) this._hidePopup();
    //     }
    //     return;
    // }
    // console.log(this._popupActive)
    // // popup auto-hide timer (normal path)
    // if (this._popupActive) {
    //     var prev = this.popupTimer;
    //     this.popupTimer = Math.max(0, this.popupTimer - dt);
    //     console.log(prev)
    //     if (prev > 0 && this.popupTimer === 0) {
    //         this._hidePopup();
    //         return;
    //     }
    // }


    if (!this.timerRunning) return;

    var prevTime = this.timeLeft;

    this.timeLeft -= dt;
    if (this.timeLeft < 0) this.timeLeft = 0;

    this.app.fire("game:timer", Math.ceil(this.timeLeft));

    // ---- Buff triggers ----
    if (this._ec) {
        if (this._densityArmed && prevTime > this._densityAt && this.timeLeft <= this._densityAt) {
            this._densityArmed = false;
            if (this._ec.enableDensityBuff) this._ec.enableDensityBuff();
        }
        if (this._speedArmed && prevTime > this._speedAt && this.timeLeft <= this._speedAt) {
            this._speedArmed = false;
            if (this._ec.enableSpeedBuff) this._ec.enableSpeedBuff();
        }
    }

    // ---- Popup schedule ----
    if (this.nextPopupIndex < this.popupTriggerTimes.length) {
        var trigger = this.popupTriggerTimes[this.nextPopupIndex];
        if (prevTime > trigger && this.timeLeft <= trigger) {
            this.nextPopupIndex++;
            this._showPopup();
            this._armBuffsForNextPopup();
        }
    }

    if (this.timeLeft <= 0) {
        this.timerRunning = false;
        this.gameOver();
    }
};
