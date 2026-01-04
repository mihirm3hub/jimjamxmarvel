var TimerUI = pc.createScript('timerUI');

TimerUI.attributes.add('textElement', { type: 'entity' });

TimerUI.prototype.initialize = function () {
    this.app.on('game:timer', function (seconds) {
        var m = Math.floor(seconds / 60);
        var s = seconds % 60;

        this.textElement.element.text =
            String(m).padStart(2, '0') + ':' +
            String(s).padStart(2, '0');

    }, this);
};
