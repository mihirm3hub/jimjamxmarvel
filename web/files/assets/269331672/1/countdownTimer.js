var CountdownTimer = pc.createScript('countdownTimer');

CountdownTimer.attributes.add('duration', {
    type: 'number',
    default: 5,
    title: 'Duration (seconds)'
});

CountdownTimer.attributes.add('countTextEntity', {
    type: 'entity',
    title: 'Count Text (Element: Text)'
});

CountdownTimer.attributes.add('progressRadialEntity', {
    type: 'entity',
    title: 'Radial Entity (has progressRadial script)'
});

// ⚠️ AutoStart isn’t useful anymore if you want this tied to popup
CountdownTimer.attributes.add('autoStart', {
    type: 'boolean',
    default: false,
    title: 'Auto Start (not recommended)'
});

// ✅ event names you can fire from Game.js
CountdownTimer.attributes.add('startEvent', {
    type: 'string',
    default: 'popup:show',
    title: 'Start Event'
});

CountdownTimer.attributes.add('stopEvent', {
    type: 'string',
    default: 'popup:hide',
    title: 'Stop Event'
});

CountdownTimer.prototype.initialize = function () {
    this._t = 0;
    this._running = false;

    this._textEl = this.countTextEntity && this.countTextEntity.element;
    this._radial = this.progressRadialEntity && this.progressRadialEntity.script
        ? this.progressRadialEntity.script.progressRadial
        : null;

    if (!this._textEl) console.warn('[CountdownTimer] Missing countTextEntity (Text Element).');
    if (!this._radial) console.warn('[CountdownTimer] Missing progressRadialEntity with progressRadial script.');

    // ✅ restart every time popup shows
    this.app.on(this.startEvent, this.start, this);

    // ✅ optional stop/reset when popup hides
    this.app.on(this.stopEvent, this.stop, this);

    if (this.autoStart) this.start();
};

CountdownTimer.prototype.destroy = function () {
    this.app.off(this.startEvent, this.start, this);
    this.app.off(this.stopEvent, this.stop, this);
};

CountdownTimer.prototype.start = function () {
    // ✅ hard reset every time we start
    this._t = 0;
    this._running = true;

    // show initial state: duration and 0% progress
    this._apply(this.duration);
};

CountdownTimer.prototype.stop = function () {
    this._running = false;

    // optional: reset visuals when popup closes
    // comment these out if you want it to "freeze" instead
    if (this._textEl) this._textEl.text = String(this.duration);
    if (this._radial && this._radial.setProgress) this._radial.setProgress(0);
};

// secondsLeftFloat is remaining seconds, progress is 0..1
CountdownTimer.prototype._apply = function (secondsLeftFloat) {
    var display = Math.max(0, Math.ceil(secondsLeftFloat));
    if (this._textEl) this._textEl.text = String(display);

    var progress = pc.math.clamp((this.duration - secondsLeftFloat) / this.duration, 0, 1);
    if (this._radial && this._radial.setProgress) this._radial.setProgress(progress);
};

CountdownTimer.prototype.update = function (dt) {
    if (!this._running) return;

    this._t += dt;

    var remaining = this.duration - this._t;

    if (remaining <= 0) {
        this._running = false;

        if (this._textEl) this._textEl.text = '0';
        if (this._radial && this._radial.setProgress) this._radial.setProgress(1);

        this.app.fire('countdown:done');
        return;
    }

    this._apply(remaining);
};
