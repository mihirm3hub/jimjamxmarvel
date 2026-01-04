var Trigger = pc.createScript('trigger');

Trigger.attributes.add('Sound', {
    type: 'entity',
    description: 'Entity with Sound component'
});

Trigger.attributes.add('dodgeOffset', {
    type: 'number',
    default: 1
});

Trigger.attributes.add('hitFxDuration', {
    type: 'number',
    default: 0.35
});

Trigger.prototype.initialize = function () {
    this.gameEntity = this.app.root.findByName('Game');
    this.game = (this.gameEntity && this.gameEntity.script)
        ? this.gameEntity.script.game
        : null;

    if (!this.entity.collision) {
        console.warn('[Trigger] No collision component.');
        return;
    }

    this.entity.collision.on('triggerenter', this.onTriggerEnter, this);
};

Trigger.prototype._triggerHitPlane = function (enemy, value) {
    var hitPlane = enemy.findByName('HitPlane');

    if (!hitPlane || !hitPlane.script || !hitPlane.script.hitPlaneFx) {
        console.warn('[Trigger] HitPlane / HitPlaneFx missing on', enemy.name);
        return;
    }

    hitPlane.enabled = true;

    hitPlane.script.hitPlaneFx.setValue(value);

    // visibility safety
    if (hitPlane.model && hitPlane.model.meshInstances?.length) {
        var mi = hitPlane.model.meshInstances[0];
        if (mi.material) {
            mi.material.cull = pc.CULLFACE_NONE;
            mi.material.blendType = pc.BLEND_NORMAL;
            mi.material.opacity = 1;
            mi.material.update();
        }
    }

    // console.log('[Trigger] HitPlaneFx triggered:', value);
};

Trigger.prototype._stopEnemyMotion = function (enemy) {
    // Stop your manual velocity-driven movement
    enemy._hit = true;
    enemy._dodged = true; // prevents dodge scoring after hit

    // If you have rigidbody, freeze it too
    if (enemy.rigidbody) {
        // kinematic: teleporting stops mattering, but we still guard
        enemy.rigidbody.linearVelocity = pc.Vec3.ZERO;
        enemy.rigidbody.angularVelocity = pc.Vec3.ZERO;
        enemy.rigidbody.enabled = false;
    }

    // Disable collision so no further triggers
    if (enemy.collision) enemy.collision.enabled = false;
};

Trigger.prototype._hideEnemyVisual = function (enemy) {
    // Hide only the visible mesh entity. In your prefab it's usually "Projectile"
    var vis = enemy.findByName('Projectile') || enemy;

    // Hide model/render components if present
    if (vis.model) vis.model.enabled = false;
    if (vis.render) vis.render.enabled = false;

    // Optional: if you use element/images etc. (usually not)
    if (vis.element) vis.element.enabled = false;
};

Trigger.prototype.onTriggerEnter = function (other) {
    if (!other || !other.tags || !other.tags.has('enemy')) return;
    if (other._hit) return;

    // 1) stop movement + stop future scoring
    this._stopEnemyMotion(other);

    if (this.Sound?.sound) this.Sound.sound.play('wrong');
    this.app.fire('game:hit')
    // 2) apply score
    if (this.game?.getScore) {
        var score = Math.max(0, this.game.getScore() - 5);
        this.game._score = score;
        this.app.fire('game:score', score);
    }

    // 3) show hit fx (+ make sure it is visible)
    this._triggerHitPlane(other, -5);
    
    // 4) hide obstacle visual now (HitPlane stays)
    this._hideEnemyVisual(other);

    // 5) destroy after fx finishes
    setTimeout(() => {
        if (other?.destroy) other.destroy();
    }, this.hitFxDuration * 1000);
};


Trigger.prototype.update = function () {
    if (!this.game?.getScore) return;

    var playerZ = this.entity.getPosition().z;
    var enemies = this.app.root.findByTag('enemy');

    for (var i = 0; i < enemies.length; i++) {
        var e = enemies[i];

        if (e._hit || e._dodged) continue;

        if (e.getPosition().z < playerZ - this.dodgeOffset) {
            e._dodged = true;

            var score = this.game.getScore() + 10;
            this.game._score = score;
            this.app.fire('game:score', score);

            if (this.Sound?.sound) this.Sound.sound.play('correct');

            // 🟢 DODGE FX
            this._triggerHitPlane(e, +10);

            setTimeout(() => {
                if (e?.destroy) e.destroy();
            }, this.hitFxDuration * 1000);
        }
    }
};
