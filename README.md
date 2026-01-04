# Jim Jam x Marvel — WebAR Biscuit Detector (ONNX + Web Workers + AWS CloudFront)

A production-style **WebAR mini‑game** that runs **real‑time biscuit detection in the browser** using **ONNX Runtime Web** inference in a **Web Worker** (keeps the main thread smooth).  
The ONNX model is hosted on **AWS + CloudFront** for fast global delivery.

## Why this is a strong “pinned” project
- **In‑browser computer vision** (no backend inference)
- **Worker-based inference** (FPS stays stable; UI/render thread isn’t blocked)
- **CDN-served model** (CloudFront) and a clean deployment story
- **WebAR integration** (camera texture → preprocessing → model → gameplay gate)

## Tech stack
- PlayCanvas (WebGL)
- Zappar WebAR
- onnxruntime-web (WASM)
- Web Workers
- AWS S3 + CloudFront (static hosting + model CDN)

## Quick start (local)
```bash
npm install
npm run start
```
Open: http://localhost:8080

> WebAR on phones needs HTTPS for camera permissions. Deploy to HTTPS (recommended) for real-device testing.

## Repo structure
- `web/` — the PlayCanvas exported build (ready to host)
- `src/scripts/` — readable, non‑minified scripts extracted from the project
- `infra/terraform/` — starter AWS infra (minimal skeleton)
- `docs/` — technical notes

## Biscuit detection pipeline
1. Read WebAR camera frame (WebGL texture readback)
2. Resize/pack to model input (224×224 RGBA)
3. Send RGBA buffer to a Web Worker
4. Worker loads ONNX Runtime Web and runs the model
5. Main thread receives `{class, probability}` and applies gating logic

Main file: `src/scripts/BiscuitGate.js`

## Model hosting
Model URL is currently set to:
- `https://d3lnwbvoiab3gu.cloudfront.net/jimjam_fp16_2_classes.onnx`

Forking? Change `ONNX_MODEL_PATH` in `BiscuitGate.js` to your own CDN URL, or host the model inside `web/`.

## Next upgrades (to make it “senior”)
- Move worker code to a real `inference.worker.js` file + bundle it (instead of Blob worker)
- Add perf telemetry: inference time, worker queueing, FPS
- Add a tiny test harness for preprocessing + postprocessing
- Add CI deploy (S3 sync + CloudFront invalidation)

**Author:** Mihir Mainkar
