var ScorePopup = pc.createScript('scorePopup');

ScorePopup.attributes.add('textEntity', {
    type: 'entity',
    description: 'Text element child'
});

ScorePopup.attributes.add('duration', {
    type: 'number',
    default: 0.9
});

ScorePopup.attributes.add('riseAmount', {
    type: 'number',
    default: 30
});

ScorePopup.prototype.initialize = function () {
    this.timer = 0;
    this.startY = this.entity.getLocalPosition().y;

    this.entity.enabled = false;

    // Listen globally
    this.app.on('score:popup', this.show, this);
};

ScorePopup.prototype.show = function (data) {
    // data: { value: +10 | -10 }
    var value = data.value;

    this.timer = 0;
    this.entity.enabled = true;

    var text = (value > 0 ? '+' : '') + value;
    this.textEntity.element.text = text;

    // Color
    this.textEntity.element.color = value > 0
        ? new pc.Color(0.2, 1, 0.2)   // green
        : new pc.Color(1, 0.2, 0.2); // red

    // Reset position & opacity
    var p = this.entity.getLocalPosition();
    p.y = this.startY;
    this.entity.setLocalPosition(p);

    this.textEntity.element.opacity = 1;
};

ScorePopup.prototype.update = function (dt) {
    if (!this.entity.enabled) return;

    this.timer += dt;
    var t = this.timer / this.duration;

    if (t >= 1) {
        this.entity.enabled = false;
        return;
    }

    // Ease-out upward movement
    var p = this.entity.getLocalPosition();
    p.y = this.startY + this.riseAmount * t;
    this.entity.setLocalPosition(p);

    // Fade out
    this.textEntity.element.opacity = 1 - t;
};
