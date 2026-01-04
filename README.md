# ONNX Web Inference Pipeline  
**Client-side computer vision using ONNX Runtime Web, Web Workers, and AWS CloudFront**

This repository implements a production-style, client-side computer vision inference pipeline that runs entirely in the browser. Inference is executed via ONNX Runtime Web (WASM) inside a Web Worker, keeping the main render thread responsive. The trained ONNX model is delivered via AWS S3 and CloudFront for predictable, low-latency loading. This pipeline was originally shipped as part of a Jim Jam × Marvel WebAR campaign, where it powered real-time biscuit detection during gameplay. Campaign-specific branding has been intentionally decoupled from the core engineering so the system remains reusable and transferable.

## Why this project stands out
- End-to-end computer vision pipeline running fully client-side
- Worker-based inference to avoid blocking the render thread
- CDN-hosted ONNX model with predictable cold-start performance
- Real-time camera frame processing integrated into a live WebGL pipeline
- Designed and shipped as a static, deployable web application

## Technical overview
### Stack
- PlayCanvas — WebGL rendering and scene management
- Zappar — camera access and tracking (campaign integration layer)
- onnxruntime-web (WASM) — client-side model inference
- Web Workers — off-main-thread inference execution
- AWS S3 + CloudFront — static hosting and model distribution

## Computer vision pipeline
1. Capture camera frame from the rendering pipeline
2. Read back WebGL texture to CPU
3. Preprocess and resize to model input resolution (224×224 RGBA)
4. Transfer pixel buffer to a Web Worker
5. Worker loads ONNX Runtime Web and executes inference
6. Main thread receives `{ class, probability }`
7. Application logic is gated based on model output  
Core logic lives in `src/scripts/BiscuitGate.js`.

## Project structure
web/                # Deployable static build  
src/scripts/        # Non-minified, readable CV + inference logic  
infra/terraform/    # Minimal AWS S3 + CloudFront setup  

## Running locally
This is a static web application and must be served over HTTP. Option 1: VS Code — install the Live Server extension, open `index.html`, right-click and select “Open with Live Server”. Option 2: Node — run `npm install` then `npm run start` and open http://localhost:8080. Option 3: Python — run `python -m http.server 8000` and open http://localhost:8000. Camera access on mobile devices requires HTTPS; for real-device testing, deploy to an HTTPS endpoint such as CloudFront, Vercel, or Netlify.

## Model hosting
The ONNX model is currently loaded from CloudFront at https://d3lnwbvoiab3gu.cloudfront.net/jimjam_fp16_2_classes.onnx. To fork or reuse this pipeline, host your own ONNX model on S3 and CloudFront or place the model inside `web/` and update `ONNX_MODEL_PATH` in `BiscuitGate.js`.

## Engineering considerations
- Inference runs entirely off the main thread to preserve frame rate
- Model loading is decoupled from scene initialization
- Designed as a pure static deployment with no backend dependency
- CORS-safe asset loading is required for WebGL texture uploads

## Planned improvements
- Extract worker code into a standalone `inference.worker.js` and bundle it
- Add inference timing, FPS tracking, and worker queue metrics
- Add unit tests for preprocessing and postprocessing stages
- CI deployment pipeline with S3 sync and CloudFront invalidation

## Author
Mihir Mainkar  
Computer Vision · Client-Side ML · Immersive Systems Engineering
