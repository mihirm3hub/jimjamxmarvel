/* jshint esversion: 6 */
var FacePauseBridge = pc.createScript('facePauseBridge');

// --- Face pause / resume ---
FacePauseBridge.attributes.add('pauseDelay', {
    type: 'number',
    default: 0.30,
    description: 'Seconds to wait before pausing after anchor_not_visible (debounce)'
});

FacePauseBridge.attributes.add('pauseWhenGameNotStarted', {
    type: 'boolean',
    default: false,
    description: 'If false, only pauses/resumes after game:start'
});

FacePauseBridge.attributes.add('debugLogs', {
    type: 'boolean',
    default: true
});

// --- Animation (moved from ModelSwitcher) ---
FacePauseBridge.attributes.add('animTargetEntity', {
    type: 'entity',
    title: 'Animation Target Entity',
    description: 'Entity that has Animation (Legacy) component (your hero/model root)'
});

FacePauseBridge.attributes.add('playAnimAfterMs', {
    type: 'number',
    default: 3000,
    title: 'Play Animation After (ms)'
});

FacePauseBridge.attributes.add('animationClipName', {
    type: 'string',
    default: '',
    title: 'Animation Clip Name (optional)'
});

FacePauseBridge.prototype.initialize = function () {
    this._gameStarted = false;

    // face visibility state + debounce
    this._faceVisible = false;
    this._pendingPause = false;
    this._notVisibleT = 0;

    // animation play-once per game start
    this._shouldPlayAnimOnce = false;
    this._animPlayedThisRun = false;

    this._logT = 0;

    // Listen to Zappar face tracker events emitted by zapparFaceTracker script
    this.app.on('zappar:face_tracker', this._onZapparFaceEvent, this);

    // Track game state
    this.app.on('game:start', () => {
        this._gameStarted = true;
        this._shouldPlayAnimOnce = true;     // arm animation for first face visible
        this._animPlayedThisRun = false;
        if (this.debugLogs) console.log('[FacePauseBridge] ▶ game:start (arm anim)');
    }, this);

    this.app.on('game:gameover', () => {
        this._gameStarted = false;
        this._shouldPlayAnimOnce = false;
        this._animPlayedThisRun = false;
        if (this.debugLogs) console.log('[FacePauseBridge] ■ game:gameover');
    }, this);

    if (this.debugLogs) console.log('[FacePauseBridge] ✅ Initialized. Listening to zappar:face_tracker');
};

FacePauseBridge.prototype._shouldAffectGame = function () {
    return this.pauseWhenGameNotStarted || this._gameStarted;
};

FacePauseBridge.prototype._onZapparFaceEvent = function (ev) {
    if (!ev || !ev.message) return;
    if (!this._shouldAffectGame()) return;

    if (ev.message === 'anchor_visible') {
        // resume immediately
        this._pendingPause = false;
        this._notVisibleT = 0;

        if (!this._faceVisible) {
            this._faceVisible = true;
            if (this.debugLogs) console.log('[FacePauseBridge] 🟢 anchor_visible → game:resume');
            this.app.fire('game:resume', { reason: 'face_visible' });
        }

        // ✅ play animation ONCE on first face visible after game start
        if (this._shouldPlayAnimOnce && !this._animPlayedThisRun) {
            this._animPlayedThisRun = true;
            this._shouldPlayAnimOnce = false;
            this._playLegacyAnimOnce();
        }

        return;
    }

    if (ev.message === 'anchor_not_visible') {
        // start debounce timer
        if (this._faceVisible) {
            this._pendingPause = true;
            this._notVisibleT = 0;
            if (this.debugLogs) console.log('[FacePauseBridge] 🟠 anchor_not_visible → pending pause');
        }
        return;
    }

    if (ev.message === 'model_loaded') {
        if (this.debugLogs) console.log('[FacePauseBridge] ✅ face model loaded');
    }
};

FacePauseBridge.prototype.update = function (dt) {
    if (!this._shouldAffectGame()) return;

    // optional status log (throttled)
    if (this.debugLogs) {
        this._logT += dt;
        if (this._logT >= 1.0) {
            this._logT = 0;
            // comment out if noisy:
            // console.log('[FacePauseBridge] state | faceVisible:', this._faceVisible, '| pendingPause:', this._pendingPause);
        }
    }

    // Debounced pause
    if (this._pendingPause) {
        this._notVisibleT += dt;
        if (this._notVisibleT >= this.pauseDelay) {
            this._pendingPause = false;
            this._notVisibleT = 0;

            if (this._faceVisible) {
                this._faceVisible = false;
                if (this.debugLogs) console.log('[FacePauseBridge] 🔴 debounced → game:pause');
                this.app.fire('game:pause', { reason: 'face_lost' });
            }
        }
    }
};

// --- Animation logic moved here ---
FacePauseBridge.prototype._playLegacyAnimOnce = function () {
    var e = this.animTargetEntity;
    var delay = Math.max(0, this.playAnimAfterMs | 0);

    if (!e || !e.animation) {
        if (this.debugLogs) console.warn('[FacePauseBridge] No Animation (Legacy) on animTargetEntity. Skipping anim.');
        return;
    }

    // Ensure it's enabled
    e.animation.activate = true;
    e.animation.enabled = true;

    if (this.debugLogs) console.log('[FacePauseBridge] 🎬 Scheduling legacy animation in', delay, 'ms');

    setTimeout(() => {
        if (!e || !e.animation) return;

        try {
            var clipName = (this.animationClipName || '').trim();

            if (clipName.length) {
                e.animation.play(clipName);
                if (this.debugLogs) console.log('[FacePauseBridge] 🎬 Playing legacy animation clip:', clipName);
            } else {
                // Play first available
                var anims = e.animation.animations;
                var first = anims ? Object.keys(anims)[0] : null;

                if (first) {
                    e.animation.play(first);
                    if (this.debugLogs) console.log('[FacePauseBridge] 🎬 Playing first legacy animation clip:', first);
                } else {
                    if (this.debugLogs) console.warn('[FacePauseBridge] No legacy animation clips found.');
                }
            }
        } catch (err) {
            console.error('[FacePauseBridge] Failed to play legacy animation:', err);
        }
    }, delay);
};
