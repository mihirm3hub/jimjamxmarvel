var ProgressRadial = pc.createScript('progressRadial');

ProgressRadial.prototype.initialize = function () {
    this._element = this.entity.element;

    // Clone the material so changes don’t affect other elements
    if (this._element && this._element.material) {
        this._element.material = this._element.material.clone();
    }

    this._progress = 0;

    // Start with 0 progress
    this.setProgress(0);
};

ProgressRadial.prototype.setProgress = function (value) {
    value = pc.math.clamp(value, 0.0, 1.0);
    this._progress = value;

    if (this._element && this._element.material) {
        // Small offset to avoid alphaTest == 0 edge case
        this._element.material.alphaTest = value + 0.001;
    }
};

// ProgressRadial.prototype.update = function (dt) {
//     this.setProgress(this._progress + dt * 0.3);

//     if (this._progress >= 1) {
//         this._progress = 0;
//     }
// };
// //