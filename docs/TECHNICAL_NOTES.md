# Technical Notes

## Key CV / ML file
- `src/scripts/BiscuitGate.js`
  - Loads ONNX Runtime Web
  - Reads camera frame pixels from a WebGL texture
  - Runs inference inside a Web Worker
  - Applies stability gating + thresholding

## Loading screen
The export references a `jimjamLoadingScreen.js` asset which is not present as a standalone script in this ZIP.
The runtime loading logic exists in `web/__loading__.js`, which is copied into `src/scripts/jimjamLoadingScreen.js` for readability.
