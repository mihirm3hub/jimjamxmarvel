var UiScore = pc.createScript('uiScore');

UiScore.attributes.add('statusImage', { type: 'entity', title: 'Status Image Entity (Element: Image)' });

UiScore.attributes.add('step', { type: 'number', default: 100, title: 'Positive Trigger Every N Points' });

UiScore.attributes.add('showSeconds', { type: 'number', default: 5, title: 'Show Duration (seconds)' });

// ✅ NEW: hit-based negative logic
UiScore.attributes.add('hitsForNegative', {
    type: 'number',
    default: 4,
    title: 'Show NEG after N hits'
});

UiScore.attributes.add('resetHitsOnPositive', {
    type: 'boolean',
    default: true,
    title: 'Reset hit counter when POS shows'
});

var CDN_BASE = 'https://d3lnwbvoiab3gu.cloudfront.net/';

// ⚠️ Update these paths to your real CloudFront paths
var STATUS_BADGES = {
    captain:   { pos: 'pc_statusImage_assets/LEGENDARY.png',   neg: 'pc_statusImage_assets/SUIT UP.png' },
    deadpool:  { pos: 'pc_statusImage_assets/AMAZING.png',  neg: 'pc_statusImage_assets/ITS NOW OR NEVER.png' },
    ironman:   { pos: 'pc_statusImage_assets/IM INVINCIBLE.png',   neg: 'pc_statusImage_assets/ARMOR UP.png' },
    thor:      { pos: 'pc_statusImage_assets/MIGHTY, WORTHY.png',      neg: 'pc_statusImage_assets/BRING THE THUNDER.png' },
    wolverine: { pos: 'pc_statusImage_assets/ANIKT, WEAPONX.png', neg: 'pc_statusImage_assets/POWER UP.png' }
};

UiScore.prototype.initialize = function () {
    console.log('[UiScore] INIT');

    this.score = this.entity.findByName("ScoreText");
    if (!this.score || !this.score.element) console.error('[UiScore] ❌ ScoreText missing or no Text Element');

    if (!this.statusImage || !this.statusImage.element) {
        console.error('[UiScore] ❌ statusImage missing OR has no Element (Image).');
    } else {
        this.statusImage.enabled = false;
    }

    this._lastMilestone = 0;
    this._hideTimer = 0;
    this._lastScore = 0;

    // ✅ NEW: hit counter
    this._hitCount = 0;

    this._heroKey = (this._getHeroFromUrl() || 'thor').toLowerCase().trim();
    if (!STATUS_BADGES[this._heroKey]) {
        console.warn('[UiScore] ⚠️ Unknown hero:', this._heroKey, '→ fallback thor');
        this._heroKey = 'thor';
    }
    console.log('[UiScore] Hero =', this._heroKey);

    // ✅ Store ASSETS for UI Image element.textureAsset
    this._posAsset = null;
    this._negAsset = null;
    this._preloadHeroTextureAssets(this._heroKey);

    this.on('enable', this.onEnable, this);
    this.on('disable', this.onDisable, this);
    this.onEnable();
};

UiScore.prototype.onEnable = function () {
    console.log('[UiScore] ENABLED → listening for game:score + game:hit');
    this.app.on("game:score", this._changeScore, this);

    // ✅ NEW: listen hits from Trigger
    this.app.on("game:hit", this._onHit, this);

    this._changeScore(0);
};

UiScore.prototype.onDisable = function () {
    console.log('[UiScore] DISABLED');
    this.app.off("game:score", this._changeScore, this);
    this.app.off("game:hit", this._onHit, this);
};

UiScore.prototype._getHeroFromUrl = function () {
    if (!window || !window.location) return null;
    var params = new URLSearchParams(window.location.search);
    return params.get('superheromodel');
};

UiScore.prototype._makeUrl = function (path) {
    var base = CDN_BASE.endsWith('/') ? CDN_BASE : (CDN_BASE + '/');
    return base + String(path || '').replace(/^\/+/, '');
};

// ✅ Load TEXTURE ASSET from URL (not raw resource)
UiScore.prototype._loadTextureAssetFromUrl = function (url, done) {
    var app = this.app;
    var cacheName = 'ui-status-asset:' + url;

    var existing = app.assets.find(cacheName);
    if (existing) {
        if (existing.resource) return done(existing);
        existing.ready(function () { done(existing); });
        app.assets.load(existing);
        return;
    }

    console.log('[UiScore] Loading texture asset:', url);
    var asset = new pc.Asset(cacheName, 'texture', { url: url, crossOrigin: 'anonymous' });

    asset.on('load', function () {
        console.log('[UiScore] ✅ Texture asset loaded:', url);
        done(asset);
    });

    asset.on('error', function (e) {
        console.error('[UiScore] ❌ Texture asset FAILED:', url, e);
        done(null);
    });

    app.assets.add(asset);
    app.assets.load(asset);
};

UiScore.prototype._preloadHeroTextureAssets = function (heroKey) {
    var cfg = STATUS_BADGES[heroKey];
    var posUrl = this._makeUrl(cfg.pos);
    var negUrl = this._makeUrl(cfg.neg);

    var self = this;

    console.log('[UiScore] Preloading POS:', posUrl);
    this._loadTextureAssetFromUrl(posUrl, function (asset) { self._posAsset = asset; });

    console.log('[UiScore] Preloading NEG:', negUrl);
    this._loadTextureAssetFromUrl(negUrl, function (asset) { self._negAsset = asset; });
};

UiScore.prototype._showStatus = function (type /* pos|neg */) {
    if (!this.statusImage || !this.statusImage.element) return;

    var asset = (type === 'neg') ? this._negAsset : this._posAsset;

    if (!asset) {
        console.warn('[UiScore] ⚠️ Asset not ready for', type, '→ retry next frame');
        var self = this;
        this.app.once('postupdate', function () { self._showStatus(type); });
        return;
    }

    console.log('[UiScore] ✅ SHOW', type.toUpperCase(), 'asset=', asset.name);

    // 🔑 UI Image expects textureAsset
    this.statusImage.element.textureAsset = asset;
    this.statusImage.element.opacity = 1;
    this.statusImage.enabled = true;

    this._hideTimer = this.showSeconds;
};

// ✅ NEW: hit handler (show NEG on 4 hits)
UiScore.prototype._onHit = function () {
    this._hitCount++;
    console.log('[UiScore] HIT event → hitCount=', this._hitCount, '/', this.hitsForNegative);

    if (this._hitCount >= this.hitsForNegative) {
        console.log('[UiScore] 💥 NEG trigger: hitCount reached');
        this._showStatus('neg');
        this._hitCount = 0; // reset after showing
    }
};

UiScore.prototype._changeScore = function (newScore) {
    if (this.score && this.score.element) {
        this.score.element.text = String(newScore);
    }

    // Positive milestone logic
    var milestone = Math.floor(newScore / this.step);
    if (milestone >= 1 && milestone > this._lastMilestone) {
        this._lastMilestone = milestone;
        console.log('[UiScore] 🎉 POS milestone:', milestone);
        this._showStatus('pos');

        if (this.resetHitsOnPositive) {
            this._hitCount = 0;
            console.log('[UiScore] hitCount reset on POS');
        }
    }
};

// Auto-hide after showSeconds
UiScore.prototype.update = function (dt) {
    if (!this.statusImage || !this.statusImage.enabled) return;

    this._hideTimer -= dt;
    if (this._hideTimer <= 0) {
        console.log('[UiScore] HIDE status');
        this.statusImage.enabled = false;
        this._hideTimer = 0;
    }
};