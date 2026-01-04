var HitPlaneFx = pc.createScript('hitPlaneFx');

HitPlaneFx.attributes.add('greenTex', { type: 'asset', assetType: 'texture' });
HitPlaneFx.attributes.add('redTex', { type: 'asset', assetType: 'texture' });

// total lifetime of the popup
HitPlaneFx.attributes.add('duration', {
    type: 'number',
    default: 0.6
});

// how far it rises over the duration (world units)
HitPlaneFx.attributes.add('riseDistance', {
    type: 'number',
    default: 0.3
});

// optional small offset when it appears (world units)
HitPlaneFx.attributes.add('startYOffset', {
    type: 'number',
    default: 0.0
});

HitPlaneFx.attributes.add('startZOffset', {
    type: 'number',
    default: 0.0
});

HitPlaneFx.prototype.initialize = function () {
    this.mi = null;

    this._playing = false;
    this._t = 0;

    this._startPos = new pc.Vec3();
    this._tmpPos = new pc.Vec3();

    this._ensureMeshInstance(); // try once on init

    // default hidden
    this.entity.enabled = false;
};

HitPlaneFx.prototype._ensureMeshInstance = function () {
    // Model component
    if (this.entity.model && this.entity.model.meshInstances && this.entity.model.meshInstances.length) {
        this.mi = this.entity.model.meshInstances[0];
    }
    // Render component
    else if (this.entity.render && this.entity.render.meshInstances && this.entity.render.meshInstances.length) {
        this.mi = this.entity.render.meshInstances[0];
    }

    if (this.mi && this.mi.material) {
        this.mi.material = this.mi.material.clone();

        // visibility-safe defaults + required for fading
        var mat = this.mi.material;
        mat.cull = pc.CULLFACE_NONE;
        mat.blendType = pc.BLEND_NORMAL;
        mat.opacity = 1;
        mat.update();

        return true;
    }

    this.mi = null;
    return false;
};

HitPlaneFx.prototype.setValue = function (value) {
    // lazy acquire (important if model loads after init)
    if (!this.mi || !this.mi.material) {
        if (!this._ensureMeshInstance()) {
            console.warn('[HitPlaneFx] No mesh/material ❌', this.entity.name);
            return;
        }
    }

    var isPositive = value > 0;

    var tex = isPositive
        ? (this.greenTex && this.greenTex.resource)
        : (this.redTex && this.redTex.resource);

    var s = isPositive ? 0.45 : 0.35;
    this.entity.setLocalScale(s, s, s);


    if (!tex) {
        console.warn('[HitPlaneFx] Texture missing ❌');
        return;
    }

    var mat = this.mi.material;

    // NOTE: if your HitPlane material is Unlit in the editor, emissiveMap is the correct slot.
    // If you're using a Standard material, diffuseMap is fine. We'll set both to be safe.
    mat.diffuseMap = tex;
    mat.emissiveMap = tex;

    mat.diffuseMapTiling.set(1, 1);
    if (mat.emissiveMapTiling) mat.emissiveMapTiling.set(1, 1);

    mat.opacity = 1;
    mat.update();

    // start animation
    this._t = 0;
    this._playing = true;

    // capture start world position + optional y offset
    this._startPos.copy(this.entity.getPosition());
    this._startPos.y += this.startYOffset;
    this._startPos.z += this.startZOffset;

    // this.entity.setLocalScale(0.45, 0.45, 0.45)
    this.entity.setPosition(this._startPos);
    this.entity.enabled = true;

    // console.log('[HitPlaneFx] play ✅', value > 0 ? 'GREEN' : 'RED');
};

HitPlaneFx.prototype.update = function (dt) {
    if (!this._playing) return;

    this._t += dt;
    var u = this._t / this.duration;

    if (u >= 1) {
        this._playing = false;
        this.entity.enabled = false; // keep it for reuse (don’t destroy)
        return;
    }

    // smoothstep easing (0..1)
    var s = u * u * (3 - 2 * u);

    // rise
    this._tmpPos.copy(this._startPos);
    this._tmpPos.y += this.riseDistance * s;
    this.entity.setPosition(this._tmpPos);

    // fade out
    if (this.mi && this.mi.material) {
        this.mi.material.opacity = 1 - s;
        this.mi.material.update();
    }
};
