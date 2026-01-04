var ModelSwitcher = pc.createScript('modelSwitcher');

ModelSwitcher.attributes.add('targetEntity', { type: 'entity', title: 'Main Target Entity' });
ModelSwitcher.attributes.add('defaultModelKey', { type: 'string', default: 'thor' });

// pick Ironman model directly from PlayCanvas Assets (Editor)
ModelSwitcher.attributes.add('ironmanModelAsset', {
    type: 'asset',
    assetType: 'model',
    title: 'Ironman Model (Editor Asset)'
});

// CDN for other models (keep as-is)
var CDN_BASE = 'https://d3lnwbvoiab3gu.cloudfront.net/';
var MODEL_PATHS = {
    thor: 'pc_thor_assets/thor.glb',
    // ironman is now from editor asset, NOT CDN
    deadpool: 'pc_deadpool_assets/deadPool.glb',
    wolverine: 'pc_wolverine_assets/wolverine.glb',
    captain: 'pc_capAmerica_assets/cap.glb'
};

ModelSwitcher.prototype.initialize = function () {
    if (!this.targetEntity || !this.targetEntity.model) {
        console.error('[ModelSwitcher] targetEntity missing OR has no Model component.');
        return;
    }

    var key = (this._getModelKeyFromUrl() || this.defaultModelKey).toLowerCase().trim();

    // ⚠️ Static can stop runtime updates
    if (this.targetEntity.model.static === true) {
        console.warn('[ModelSwitcher] targetEntity Model component is Static. Turn it OFF for runtime swapping.');
    }

    // IRONMAN: load from Editor asset folder
    if (key === 'ironman') {
        if (!this.ironmanModelAsset) {
            console.error('[ModelSwitcher] URL requested ironman but ironmanModelAsset is not set in the Editor.');
            return;
        }

        console.log('[ModelSwitcher] Loading IRONMAN from Editor asset:', this.ironmanModelAsset.name);

        this._loadModelAsset(this.ironmanModelAsset, (asset) => {
            this._applyModelLegacy(asset);
        });

        return;
    }

    // Others: CDN
    var url = this._getUrlForModel(key);
    if (!url) {
        console.warn('[ModelSwitcher] Unknown model key:', key, '→ fallback:', this.defaultModelKey);
        key = this.defaultModelKey;
        url = this._getUrlForModel(key);
    }

    console.log('[ModelSwitcher] Loading model from CDN:', key, url);

    this._loadModelFromUrl(url, (asset) => {
        this._applyModelLegacy(asset);
    });
};

ModelSwitcher.prototype._getModelKeyFromUrl = function () {
    if (!window || !window.location) return null;
    var params = new URLSearchParams(window.location.search);
    return params.get('superheromodel');
};

ModelSwitcher.prototype._getUrlForModel = function (key) {
    var path = MODEL_PATHS[key];
    if (!path) return null;
    var base = CDN_BASE.endsWith('/') ? CDN_BASE : (CDN_BASE + '/');
    return base + path.replace(/^\/+/, '');
};

// Load an editor asset (no CDN)
ModelSwitcher.prototype._loadModelAsset = function (asset, done) {
    var app = this.app;

    if (asset.resource) {
        done(asset);
        return;
    }

    asset.ready(function () {
        done(asset);
    });

    app.assets.load(asset);
};

// CDN loader
ModelSwitcher.prototype._loadModelFromUrl = function (url, done) {
    var app = this.app;
    var cacheName = 'runtime-model:' + url;

    var existing = app.assets.find(cacheName);
    if (existing) {
        if (existing.resource) return done(existing);
        existing.ready(function () { done(existing); });
        app.assets.load(existing);
        return;
    }

    var asset = new pc.Asset(cacheName, 'model', { url: url });

    asset.on('load', function () { done(asset); });
    asset.on('error', function (e) {
        console.error('[ModelSwitcher] Failed to load:', url, e);
    });

    app.assets.add(asset);
    app.assets.load(asset);
};

// MODEL (LEGACY) apply for 1.77
ModelSwitcher.prototype._applyModelLegacy = function (asset) {
    var e = this.targetEntity;

    // 1) Assign asset
    e.model.asset = asset;

    // 2) Force-refresh legacy model instance
    if (asset.resource) {
        e.model.model = asset.resource;
    }

    console.log('[ModelSwitcher] Applied model asset:', asset.name);

    // 3) Wait for meshInstances then override materials
    this._waitForLegacyMeshInstances(e, 180);
};

ModelSwitcher.prototype._waitForLegacyMeshInstances = function (entity, framesLeft) {
    var mis = this._getLegacyMeshInstances(entity);

    if (mis && mis.length) {
        console.log('[ModelSwitcher] Legacy meshInstances found:', mis.length);
        this._overrideMaterials(mis);
        return;
    }

    if (framesLeft <= 0) {
        console.error('[ModelSwitcher] meshInstances never appeared.');
        console.log('[ModelSwitcher] entity.model.asset=', entity.model.asset);
        console.log('[ModelSwitcher] entity.model.model=', entity.model.model);
        return;
    }

    this.app.once('postupdate', this._waitForLegacyMeshInstances.bind(this, entity, framesLeft - 1));
};

ModelSwitcher.prototype._getLegacyMeshInstances = function (entity) {
    if (entity.model && entity.model.model && entity.model.model.meshInstances) {
        return entity.model.model.meshInstances;
    }
    if (entity.model && entity.model.meshInstances) {
        return entity.model.meshInstances;
    }
    return null;
};

ModelSwitcher.prototype._overrideMaterials = function (meshInstances) {
    var key = (this._getModelKeyFromUrl() || this.defaultModelKey).toLowerCase().trim();

    for (var i = 0; i < meshInstances.length; i++) {
        var mi = meshInstances[i];
        if (!mi || !mi.material) continue;

        var m = mi.material = mi.material.clone();
        m.blendType = pc.BLEND_NORMAL;

        if (key === 'thor') {
            // keeping your custom override
            m.diffuseMapUv = 1;
        }

        m.update();
    }
};
