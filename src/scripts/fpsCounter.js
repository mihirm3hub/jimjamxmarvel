var FpsCounter = pc.createScript('fpsCounter');

FpsCounter.prototype.initialize = function () {
    this._frames = 0;
    this._accum = 0;
    this._fps = 0;

    // DOM overlay
    this.el = document.createElement('div');
    this.el.style.position = 'fixed';
    this.el.style.top = '8px';
    this.el.style.left = '8px';
    this.el.style.padding = '6px 10px';
    this.el.style.background = 'rgba(0,0,0,0.7)';
    this.el.style.color = '#00ff88';
    this.el.style.fontFamily = 'monospace';
    this.el.style.fontSize = '12px';
    this.el.style.zIndex = '9999';
    this.el.textContent = 'FPS: --';

    document.body.appendChild(this.el);
};

FpsCounter.prototype.update = function (dt) {
    this._frames++;
    this._accum += dt;

    if (this._accum >= 0.5) { // update twice per second
        this._fps = Math.round(this._frames / this._accum);
        this.el.textContent = 'FPS: ' + this._fps;
        this._frames = 0;
        this._accum = 0;
    }
};

FpsCounter.prototype.destroy = function () {
    if (this.el) this.el.remove();
};
