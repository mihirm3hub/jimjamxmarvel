var EntityCreator = pc.createScript('entityCreator');

EntityCreator.attributes.add('lifetime', { type: 'number', default: 6 });
EntityCreator.attributes.add('maxCubes', { type: 'number', default: 30 });

// ✅ obstacle size & rotation variation
EntityCreator.attributes.add('minSize', { type: 'number', default: 0.15 });
EntityCreator.attributes.add('maxSize', { type: 'number', default: 0.35 });

EntityCreator.attributes.add('randomRotation', {
    type: 'boolean',
    default: true,
    title: 'Random Rotation'
});

EntityCreator.attributes.add('Particle', { type: 'entity' });
EntityCreator.attributes.add('headEntity', { type: 'entity' });
EntityCreator.attributes.add('noseBridgeEntity', { type: 'entity' });
EntityCreator.attributes.add('noseBridgeChildName', { type: 'string', default: 'Sphere' });
EntityCreator.attributes.add('aimYOffset', { type: 'number', default: 0.0 });

EntityCreator.attributes.add('leftMin', { type: 'number', default: -2.0 });
EntityCreator.attributes.add('leftMax', { type: 'number', default: -1.0 });
EntityCreator.attributes.add('rightMin', { type: 'number', default: 1.0 });
EntityCreator.attributes.add('rightMax', { type: 'number', default: 2.0 });

EntityCreator.attributes.add('yMin', { type: 'number', default: 0.6 });
EntityCreator.attributes.add('yMax', { type: 'number', default: 1.4 });

EntityCreator.attributes.add('zMin', { type: 'number', default: 12 });
EntityCreator.attributes.add('zMax', { type: 'number', default: 13 });

EntityCreator.attributes.add('moveSpeed', { type: 'number', default: 2.5 });
EntityCreator.attributes.add('despawnBehind', { type: 'number', default: 2.0 });

EntityCreator.attributes.add('spacing', { type: 'number', default: 1.0 });
EntityCreator.attributes.add('minAliveTime', { type: 'number', default: 5 });

EntityCreator.attributes.add('densityMult', { type: 'number', default: 1.8 });
EntityCreator.attributes.add('speedMult', { type: 'number', default: 1.5 });

// speed ramp controls
EntityCreator.attributes.add('speedRampInterval', { type: 'number', default: 10 }); // seconds
EntityCreator.attributes.add('speedRampStep', { type: 'number', default: 0.5 });   // speed added per interval
EntityCreator.attributes.add('minMoveSpeed', { type: 'number', default: 0.5 });    // clamp floor (not used as floor below base)
EntityCreator.attributes.add('maxMoveSpeed', { type: 'number', default: 10 });     // clamp ceiling

// density ramp controls
EntityCreator.attributes.add('densityRampStep', { type: 'number', default: 0.15 }); // how much to "undo" density each stop
EntityCreator.attributes.add('minSpacing', { type: 'number', default: 0.35 });      // clamp so it doesn't get too dense
EntityCreator.attributes.add('maxSpacing', { type: 'number', default: 3.0 });       // clamp upper if you want

EntityCreator.attributes.add('enableModelBasedRotation', { type: 'boolean', default: true });

// rotation animation knobs
// Planets (thor/deadpool/wolverine): mainly yaw
EntityCreator.attributes.add('spinYawDegPerSec', { type: 'number', default: 120 });
EntityCreator.attributes.add('spinPitchDegPerSec', { type: 'number', default: 0 });
EntityCreator.attributes.add('spinRollDegPerSec', { type: 'number', default: 0 });

// Debris (captain): random-axis tumble
EntityCreator.attributes.add('debrisSpinMinDegPerSec', { type: 'number', default: 90 });
EntityCreator.attributes.add('debrisSpinMaxDegPerSec', { type: 'number', default: 360 });

// ===================== OBSTACLE CDN WIRING =====================
var CDN_BASE = 'https://d3lnwbvoiab3gu.cloudfront.net/';

var OBSTACLE_PATHS_BY_HERO = {
    thor: [
        'pc_thor_assets/neptune.glb',
        'pc_thor_assets/saturn.glb'
    ],
    ironman: ['pc_ironman_assets/meteor.glb'],
    deadpool: ['pc_deadpool_assets/unicorn.glb'],
    wolverine: ['pc_wolverine_assets/deadFace.glb'],
    captain: [
        'pc_capAmerica_assets/stone_1.glb',
        'pc_capAmerica_assets/stone_2.glb',
        'pc_capAmerica_assets/stone_3.glb',
        'pc_capAmerica_assets/stone_4.glb',
        'pc_capAmerica_assets/stone_5.glb'
    ]
};

// Model component is on a child:
var OBSTACLE_MODEL_ENTITY_NAME = 'Projectile';
// ===============================================================

EntityCreator.prototype.initialize = function () {
    this.entities = [];
    this._spawnTimer = 0;
    this._nextSide = -1;

    this._gameStarted = false;
    this._timePaused = false;

    this.noseBridgeAim = null;
    this._aimWarnCooldown = 0;

    // ---- boost particle entity (child named 'boost') ----
    this.boost = this.entity.findByName('boost');
    if (!this.boost || !this.boost.particlesystem) {
        console.warn('[EntityCreator] boost entity/particlesystem not found. Check child name "boost" and component.');
    }

    this.stopBoostDebug = false;

    this._keepBoostAlive = false;
    this._boostKeepAliveTimer = 0;
    this._boostKeepAliveInterval = 0.35;

    this._speedRampTimer = 0;

    this.app.on('ui:start', this.onGameStart, this);
    this.app.on('ui:reset', this.onGameReset, this);
    this.app.on('game:pause', this.onTimePause, this);
    this.app.on('game:resume', this.onTimeResume, this);

    this.app.on('buffs:stop', this.stopBuffs, this);

    this.stopBoost(true);
    this._acquireNoseBridgeAim(false);

    this._heroKey = this._getHeroKeyFromUrl();

    // base snapshots
    this._initialBaseMoveSpeed = this.moveSpeed;
    this._baseMoveSpeed = this.moveSpeed;

    this._baseSpacing = this.spacing;
    this._baseMaxCubes = this.maxCubes;

    this._densityEnabled = false;
    this._speedEnabled = false;

    // ✅ runtime asset cache for obstacle models
    this._runtimeModelCache = {}; // url -> asset

    this._totalSpawned = 0;

    this.app.on('game:gameover', function () {
        console.log(
            '[EntityCreator] Total obstacles spawned this run =',
            this._totalSpawned
        );
    }, this);

    console.log('[EntityCreator] heroKey=', this._heroKey);
};

EntityCreator.prototype._getHeroKeyFromUrl = function () {
    if (!window || !window.location) return 'thor';
    var params = new URLSearchParams(window.location.search);
    var key = params.get('superheromodel');
    key = (key || 'thor').toLowerCase().trim();
    return key;
};

EntityCreator.prototype.onGameStart = function () {
    this._gameStarted = true;
    this._timePaused = false;
    this._spawnTimer = 0;
    this._speedRampTimer = 0;

    this._acquireNoseBridgeAim(true);
    this.stopBoost(true);
};

EntityCreator.prototype.onGameReset = function () {
    this._gameStarted = false;
    this._timePaused = false;

    this.stopBoost(true);

    for (var i = this.entities.length - 1; i >= 0; i--) {
        if (this.entities[i] && this.entities[i].entity) this.entities[i].entity.destroy();
        this.entities.splice(i, 1);
    }
};

EntityCreator.prototype.onTimePause = function () { this._timePaused = true; };
EntityCreator.prototype.onTimeResume = function () { this._timePaused = false; };

EntityCreator.prototype._acquireNoseBridgeAim = function (logOnFind) {
    if (this.noseBridgeAim && this.noseBridgeAim.enabled) return true;

    var nb = this.noseBridgeEntity || this.app.root.findByName('Nose (Bridge)');
    if (!nb) return false;

    var aim = nb.findByName(this.noseBridgeChildName) || nb;
    if (aim && aim.enabled) {
        this.noseBridgeAim = aim;
        if (logOnFind) console.log('[EntityCreator] Nose bridge aim acquired');
        return true;
    }
    return false;
};

EntityCreator.prototype._getAimPos = function () {
    var pos;

    if (this._acquireNoseBridgeAim(false) && this.noseBridgeAim) {
        pos = this.noseBridgeAim.getPosition().clone();
    } else if (this.headEntity && this.headEntity.enabled) {
        pos = this.headEntity.getPosition().clone();
    } else {
        if (this._aimWarnCooldown <= 0) {
            console.warn('[AIM] Nose bridge not available yet.');
            this._aimWarnCooldown = 1.0;
        }
        return new pc.Vec3(0, 0, 0);
    }

    pos.y += this.aimYOffset;
    return pos;
};

EntityCreator.prototype._triggerBoostOnce = function () {
    if (!this.boost || !this.boost.particlesystem) return;

    this.boost.enabled = true;
    this.boost.particlesystem.enabled = true;

    this.boost.particlesystem.stop();
    this.boost.particlesystem.reset();
    this.boost.particlesystem.play();
};

EntityCreator.prototype.playBoost = function (stopBoost) {
    if (stopBoost === true) return;
    if (this.stopBoostDebug === true) return;

    if (!this.boost || !this.boost.particlesystem) {
        console.warn('[EntityCreator] playBoost called but boost particle system missing.');
        return;
    }

    this._triggerBoostOnce();
};

EntityCreator.prototype.stopBoost = function (disableEntity) {
    if (!this.boost || !this.boost.particlesystem) return;
    this.boost.particlesystem.stop();
    if (disableEntity) this.boost.enabled = false;
};

EntityCreator.prototype._applySpeedDelta = function (delta) {
    var floor = this._initialBaseMoveSpeed;
    var ceil = this.maxMoveSpeed;

    this.moveSpeed = pc.math.clamp(this.moveSpeed + delta, floor, ceil);
    this._baseMoveSpeed = this.moveSpeed;
};

EntityCreator.prototype.enableDensityBuff = function () {
    if (this._densityEnabled) return;

    this._densityEnabled = true;

    this.spacing = this._baseSpacing / this.densityMult;
    this.maxCubes = Math.max(this.maxCubes, Math.ceil(this._baseMaxCubes * this.densityMult));

    console.log('[EntityCreator] Density buff ENABLED | spacing=', this.spacing, '| maxCubes=', this.maxCubes);
};

EntityCreator.prototype.enableSpeedBuff = function () {
    if (this._speedEnabled) return;

    this._speedEnabled = true;

    this.moveSpeed = pc.math.clamp(this.moveSpeed * this.speedMult, this._initialBaseMoveSpeed, this.maxMoveSpeed);
    this._baseMoveSpeed = this.moveSpeed;

    this._keepBoostAlive = true;
    this._boostKeepAliveTimer = 0;

    this.playBoost(false);

    console.log('[EntityCreator] Speed buff ENABLED | moveSpeed=', this.moveSpeed, '| boostKeepAlive=ON');
};

EntityCreator.prototype.stopBuffs = function () {
    // reduce SPEED 
    this._applySpeedDelta(-this.speedRampStep);

    // reduce DENSITY 
    var step = Math.max(0.0001, this.densityRampStep || 0.15);

    // If density buff was never enabled, this still safely reduces density (less spawn frequency)
    this.spacing = pc.math.clamp(this.spacing + step, this.minSpacing, this.maxSpacing);

    // Optional: reduce maxCubes a bit too (gradual), but never below original base
    // this.maxCubes = Math.max(this._baseMaxCubes, Math.floor(this.maxCubes - 1));

    console.log(
        '[EntityCreator] Buffs REDUCED | speed -=', this.speedRampStep,
        '| spacing +=', step,
        '| spacing now =', this.spacing.toFixed(3),
        '| maxCubes =', this.maxCubes
    );
};


// ===================== OBSTACLE MODEL LOADING =====================
EntityCreator.prototype._getObstacleUrlForHero = function () {
    var key = this._heroKey || 'thor';
    var list = OBSTACLE_PATHS_BY_HERO[key];

    if (!list || list.length === 0) return null;

    var idx = Math.floor(Math.random() * list.length);
    var base = CDN_BASE.endsWith('/') ? CDN_BASE : (CDN_BASE + '/');
    return base + list[idx].replace(/^\/+/, '');
};

EntityCreator.prototype._loadModelFromUrl = function (url, done) {
    var app = this.app;
    var cacheName = 'runtime-model:' + url;

    if (this._runtimeModelCache[url]) {
        var cached = this._runtimeModelCache[url];
        if (cached.resource) return done(cached);
        cached.ready(function () { done(cached); });
        app.assets.load(cached);
        return;
    }

    var existing = app.assets.find(cacheName);
    if (existing) {
        this._runtimeModelCache[url] = existing;

        if (existing.resource) return done(existing);
        existing.ready(function () { done(existing); });
        app.assets.load(existing);
        return;
    }

    var asset = new pc.Asset(cacheName, 'model', { url: url, crossOrigin: 'anonymous' });

    asset.on('load', function () { done(asset); });
    asset.on('error', function (e) {
        console.error('[EntityCreator] Failed to load model:', url, e);
        done(null);
    });

    app.assets.add(asset);
    app.assets.load(asset);

    this._runtimeModelCache[url] = asset;
};

EntityCreator.prototype._applyObstacleModelLegacy = function (entity, asset) {
    if (!entity || !asset) return;

    var target = entity;
    if (OBSTACLE_MODEL_ENTITY_NAME) {
        var child = entity.findByName(OBSTACLE_MODEL_ENTITY_NAME);
        if (child) target = child;
    }

    if (!target.model) {
        console.warn('[EntityCreator] Spawned obstacle has no Model component to apply:', target.name);
        return;
    }

    // ✅ Safe: asset-only (prevents "assign a model to multiple ModelComponents")
    target.model.asset = asset;

    // ✅ apply size ONLY once here (remove duplicate setLocalScale)
    var s = pc.math.random(this.minSize, this.maxSize);
    entity.setLocalScale(s, s, s);
};

// ===============================================================

EntityCreator.prototype.update = function (dt) {
    if (this._aimWarnCooldown > 0) this._aimWarnCooldown -= dt;
    if (!this._gameStarted) return;

    // speed ramp
    this._speedRampTimer += dt;
    if (this._speedRampTimer >= this.speedRampInterval) {
        while (this._speedRampTimer >= this.speedRampInterval) {
            this._speedRampTimer -= this.speedRampInterval;
            this._applySpeedDelta(this.speedRampStep);
        }
    }

    // MOVE PROJECTILES + spin
    for (var i = this.entities.length - 1; i >= 0; i--) {
        var o = this.entities[i];
        if (!o || !o.entity) {
            this.entities.splice(i, 1);
            continue;
        }

        o.age += dt;

        if (!this._timePaused) o.timer -= dt;

        var p = o.entity.getPosition().clone();
        p.add(o.vel.clone().scale(dt));

        if (o.entity.rigidbody) o.entity.rigidbody.teleport(p);
        else o.entity.setPosition(p);

        // ✅ rotation animation (visual child only)
        // planet spin: thor/deadpool/wolverine (single-axis yaw by default)
        // debris tumble: captain (random-axis rates stored per spawn)
        if (o.visual && o.spinEnabled && this.enableModelBasedRotation) {
            if (o.spinType === 'planet') {
                o.visual.rotateLocal(
                    (this.spinPitchDegPerSec || 0) * dt,
                    (this.spinYawDegPerSec || 0) * dt,
                    (this.spinRollDegPerSec || 0) * dt
                );
            } else if (o.spinType === 'debris') {
                o.visual.rotateLocal(
                    (o.spinPitchDegPerSec || 0) * dt,
                    (o.spinYawDegPerSec || 0) * dt,
                    (o.spinRollDegPerSec || 0) * dt
                );
            } else if (o.spinType === 'meteor') {
                o.visual.rotateLocal(
                    0,
                    0,
                    (o.spinRollDegPerSec || 0) * dt
                );
            }
        }

        if (o.age < this.minAliveTime) continue;

        if (o.timer <= 0) {
            o.entity.destroy();
            this.entities.splice(i, 1);
            continue;
        }

        if (o.targetZ !== null && p.z < (o.targetZ - this.despawnBehind)) {
            o.entity.destroy();
            this.entities.splice(i, 1);
            continue;
        }
    }

    // boost keep-alive (even during pause)
    if (this._keepBoostAlive && !this.stopBoostDebug) {
        this._boostKeepAliveTimer += dt;
        if (this._boostKeepAliveTimer >= this._boostKeepAliveInterval) {
            this._boostKeepAliveTimer = 0;
            this._triggerBoostOnce();
        }
    }

    if (this._timePaused) return;

    // SPAWNER
    var timeBetween = this.spacing / Math.max(0.001, this.moveSpeed);
    this._spawnTimer += dt;

    while (this._spawnTimer >= timeBetween) {
        this._spawnTimer -= timeBetween;

        if (this.entities.length >= this.maxCubes) {
            this._spawnTimer = 0;
            break;
        }

        this.spawnOne(this._nextSide);
        this._nextSide *= -1;
    }
};

EntityCreator.prototype.spawnOne = function (side) {
    if (!this.Particle) return;

    var target = this._getAimPos();
    if (target.x === 0 && target.y === 0 && target.z === 0) return;

    var entity = this.Particle.clone();
    entity.enabled = true;

    this._totalSpawned++;

    // random size + rotation (template-level random pose)
    var s = pc.math.random(this.minSize, this.maxSize);
    entity.setLocalScale(s, s, s);

    if (this.randomRotation) {
        entity.setEulerAngles(
            pc.math.random(0, 360),
            pc.math.random(0, 360),
            pc.math.random(0, 360)
        );
    }

    if (entity.rigidbody) {
        entity.rigidbody.type = pc.BODYTYPE_KINEMATIC;
        entity.rigidbody.enabled = true;
    }

    this.app.root.addChild(entity);

    var xOffset = (side < 0)
        ? pc.math.random(this.leftMin, this.leftMax)
        : pc.math.random(this.rightMin, this.rightMax);

    var spawnPos = target.clone();
    spawnPos.x += xOffset;
    spawnPos.y += pc.math.random(this.yMin, this.yMax);
    spawnPos.z += pc.math.random(this.zMin, this.zMax);

    entity.setPosition(spawnPos);

    var dir = target.clone().sub(spawnPos).normalize();
    var vel = dir.scale(this.moveSpeed);

    // ✅ visual reference (child that holds Model component)
    var visual = entity;
    if (OBSTACLE_MODEL_ENTITY_NAME) {
        var child = entity.findByName(OBSTACLE_MODEL_ENTITY_NAME);
        if (child) visual = child;
    }

    // ✅ per-hero spin wiring
    var hero = (this._heroKey || 'thor').toLowerCase().trim();

    var spinEnabled = this.enableModelBasedRotation &&
        (hero === 'thor' || hero === 'deadpool' || hero === 'wolverine' || hero === 'captain' || hero === 'ironman');

    var spinType = null;
    var spinPitch = 0, spinYaw = 0, spinRoll = 0;

    if (spinEnabled) {
        if (hero === 'captain') {
            // debris tumble: random axis
            spinType = 'debris';

            var axis = new pc.Vec3(
                pc.math.random(-1, 1),
                pc.math.random(-1, 1),
                pc.math.random(-1, 1)
            );
            if (axis.lengthSq() < 1e-5) axis.set(0, 1, 0);
            axis.normalize();

            var w = pc.math.random(this.debrisSpinMinDegPerSec, this.debrisSpinMaxDegPerSec);

            spinPitch = axis.x * w;
            spinYaw = axis.y * w;
            spinRoll = axis.z * w;
        } else if (hero === 'ironman') {
            // ✅ meteor: Z-only spin
            spinType = 'meteor';
            spinPitch = 0;
            spinYaw = 0;

            // pick ONE:
            // fixed speed:
            // spinRoll = (this.meteorSpinDegPerSec != null) ? this.meteorSpinDegPerSec : 220;

            // or random range (uncomment if you prefer):
            var min = (this.meteorSpinMinDegPerSec != null) ? this.meteorSpinMinDegPerSec : 160;
            var max = (this.meteorSpinMaxDegPerSec != null) ? this.meteorSpinMaxDegPerSec : 280;
            spinRoll = pc.math.random(min, max);
        } else {
            // planets: use your knobs (defaults to yaw-only)
            spinType = 'planet';
        }
    }

    // ✅ OBSTACLE MODEL: pick & apply per spawn (random mix)
    var url = this._getObstacleUrlForHero();
    if (url) {
        this._loadModelFromUrl(url, (asset) => {
            this._applyObstacleModelLegacy(entity, asset);
        });
    }

    this.entities.push({
        entity: entity,
        visual: visual,

        spinEnabled: spinEnabled,
        spinType: spinType,

        // used only when captain debris
        spinPitchDegPerSec: spinPitch,
        spinYawDegPerSec: spinYaw,
        spinRollDegPerSec: spinRoll,

        timer: this.lifetime,
        age: 0,
        vel: vel,
        targetZ: target.z
    });
};

