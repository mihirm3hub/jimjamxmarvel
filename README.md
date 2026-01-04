# Jim Jam × Marvel 
**Real-time in-browser computer vision using ONNX Runtime Web, Web Workers, and AWS CloudFront**

This project is a production-style WebAR mini-game that performs real-time biscuit detection directly in the browser. Inference runs via ONNX Runtime Web (WASM) inside a Web Worker, keeping rendering and UI responsive. The trained model is delivered via AWS S3 and CloudFront for fast, globally cached loading.

---

## Why this project stands out
- End-to-end computer vision pipeline running entirely in the browser
- Worker-based inference to avoid blocking the render thread
- CDN-hosted ONNX model with predictable load performance
- WebAR camera integration feeding live frames into a CV pipeline
- Designed and shipped as a static, deployable web application

---

## Technical overview

### Stack
- PlayCanvas — WebGL rendering and scene management
- Zappar WebAR — camera access and AR tracking
- onnxruntime-web (WASM) — client-side model inference
- Web Workers — off-main-thread inference execution
- AWS S3 + CloudFront — static hosting and model distribution

---

## Computer vision pipeline
1. Capture camera frame from WebAR pipeline
2. Read back WebGL texture to CPU
3. Preprocess and resize to model input resolution (224×224 RGBA)
4. Transfer pixel buffer to a Web Worker
5. Worker loads ONNX Runtime Web and executes inference
6. Main thread receives {class, probability}
7. Gameplay logic is gated based on model output

Core logic lives in src/scripts/BiscuitGate.js

---

## Project structure
web/                # Deployable PlayCanvas build (static site)  
src/scripts/        # Non-minified, readable game + CV logic  
infra/terraform/    # Minimal AWS S3 + CloudFront setup  

---

## Running locally
This is a static web application and must be served over HTTP.

### Option 1: VS Code
``` 
- install live server extention on VS Code
- Open index.html
- Right-click open with live server 
```

### Option 2: Node
```
npm install  
npm run start  

Open http://localhost:8080
```
### Option 3: Python
```
python -m http.server 8000  

Open http://localhost:8000
```
Camera access on mobile devices requires HTTPS. For real device testing, deploy to an HTTPS endpoint such as CloudFront, Vercel, or Netlify.

---

## Model hosting
The ONNX model is currently loaded from CloudFront at  
https://d3lnwbvoiab3gu.cloudfront.net/jimjam_fp16_2_classes.onnx

To fork or reuse this project, host your own ONNX model on S3 and CloudFront or place the model inside web/ and update ONNX_MODEL_PATH in BiscuitGate.js.

---

## Engineering considerations
- Inference runs entirely off the main thread to preserve frame rate
- Model loading is decoupled from scene initialization
- Designed to work as a pure static deployment with no backend dependency
- CORS-safe asset loading is required for WebGL texture uploads

---

## Planned improvements
- Extract worker code into a standalone inference.worker.js and bundle it
- Add inference timing, FPS tracking, and worker queue metrics
- Add unit tests for preprocessing and postprocessing stages
- CI deployment pipeline with S3 sync and CloudFront invalidation

---

## Author
Mihir Mainkar  
