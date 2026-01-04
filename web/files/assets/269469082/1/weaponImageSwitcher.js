var WeaponImageSwitcher = pc.createScript('weaponImageSwitcher');

// Optional: if your WeaponImage is not the script entity, you can point it
WeaponImageSwitcher.attributes.add('target', {
    type: 'entity',
    title: 'WeaponImage Entity (optional)'
});

// --- CONFIG ---
var CDN_BASE = 'https://d3lnwbvoiab3gu.cloudfront.net/';
var WEAPON_IMAGE_PATHS = {
    thor:      'pc_weapon_images/thor-weapon.png',
    ironman:   'pc_weapon_images/ironman-weapon.png',
    deadpool:  'pc_weapon_images/deadpool-weapon.png',
    wolverine: 'pc_weapon_images/wolverine-weapon.png',
    captain:   'pc_weapon_images/captain-weapon.png'
};
var DEFAULT_KEY = 'thor';
// -------------

WeaponImageSwitcher.prototype.initialize = function () {
    var entity = this.target || this.entity;

    if (!entity || !entity.element || entity.element.type !== 'image') {
        console.warn('[WeaponImageSwitcher] Target has no Image Element:', entity ? entity.name : '(null)');
        return;
    }

    var key = this._getHeroKeyFromUrl();
    var url = this._getWeaponUrl(key);

    if (!url) {
        console.warn('[WeaponImageSwitcher] Unknown hero key:', key, '-> fallback:', DEFAULT_KEY);
        key = DEFAULT_KEY;
        url = this._getWeaponUrl(key);
    }

    this._loadTexture(url, (texAsset) => {
        if (!texAsset || !texAsset.resource) return;

        // Assign via textureAsset (correct way for Image Element)
        entity.element.textureAsset = texAsset;

        // Some projects need this to force refresh in older builds:
        entity.element.texture = texAsset.resource;

        entity.element.opacity = 1;

        console.log('[WeaponImageSwitcher] Weapon image set:', key, url);
    });
};

WeaponImageSwitcher.prototype._getHeroKeyFromUrl = function () {
    if (!window || !window.location) return DEFAULT_KEY;
    var params = new URLSearchParams(window.location.search);
    var key = (params.get('superheromodel') || DEFAULT_KEY).toLowerCase().trim();
    return key;
};

WeaponImageSwitcher.prototype._getWeaponUrl = function (key) {
    var path = WEAPON_IMAGE_PATHS[key];
    if (!path) return null;
    var base = CDN_BASE.endsWith('/') ? CDN_BASE : (CDN_BASE + '/');
    return base + path.replace(/^\/+/, '');
};

WeaponImageSwitcher.prototype._loadTexture = function (url, done) {
    var app = this.app;
    var name = 'runtime-weapon-texture:' + url;

    // Reuse if already created
    var existing = app.assets.find(name);
    if (existing) {
        if (existing.resource) return done(existing);
        existing.ready(function () { done(existing); });
        app.assets.load(existing);
        return;
    }

    var asset = new pc.Asset(name, 'texture', { url: url });

    asset.on('load', function () { done(asset); });
    asset.on('error', function (err) {
        console.error('[WeaponImageSwitcher] Failed to load texture:', url, err);
        done(null);
    });

    app.assets.add(asset);
    app.assets.load(asset);
    
};
