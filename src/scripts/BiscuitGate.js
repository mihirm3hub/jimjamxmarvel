/* jshint esversion: 6 */
var BiscuitGate = pc.createScript('biscuitGate');

const ORT_CDN = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.17.1/dist/ort.min.js";
const ORT_WASM_PATHS = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.17.1/dist/";
const ONNX_MODEL_PATH = "https://d3lnwbvoiab3gu.cloudfront.net/jimjam_fp16_2_classes.onnx";

const CLASS_NAMES = ["Nothing", "jimjam"];
const THRESH = 0.60;
const REQUIRED_STABLE_FRAMES = 2;

BiscuitGate.prototype.initialize = function () {
  console.log("[BiscuitGate] INIT (use Zappar GL texture)");

  this._w = 224;
  this._h = 224;

  // inference throttle
  this._accum = 0;
  this._inferInterval = 0.15; // ~6-7 FPS
  this._busy = false;

  // stability
  this._lastClass = null;
  this._stableCount = 0;
  this._jimjamDetected = false;
  this._eatingDetected = false;
  this._gateRunning = false;

  // --- Get WebGL context from PlayCanvas (same one Zappar uses) ---
  const canvas = this.app.graphicsDevice.canvas;
  this._gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
  if (!this._gl) { console.error("[BiscuitGate] no gl"); return; }

  // --- Find pipeline (you MUST adjust findByName to your camera entity name) ---
  // Try common camera entity names
  const camEnt =
    this.app.root.findByName("Camera") ||
    this.app.root.findByName("Main Camera") ||
    this.app.root.findByName("AR Camera");

  if (!camEnt || !camEnt.script || !camEnt.script.zapparCamera) {
    console.error("[BiscuitGate] Can't find zapparCamera script on camera entity. Fix entity name lookup.");
    return;
  }

  this._zapparScript = camEnt.script.zapparCamera;
  this._pipeline = this._zapparScript.pipeline; // pipeline created in their script
  if (!this._pipeline) {
    console.error("[BiscuitGate] pipeline not ready yet. Ensure BiscuitGate runs AFTER zapparCamera init.");
    return;
  }

  // --- Setup tiny FBO + shader program to blit texture ---
  this._setupDownsampleFbo();

  // --- Worker for inference ---
  this._worker = this._makeWorker();
  this._worker.onmessage = (ev) => this._onWorker(ev.data);

  this._worker.postMessage({
    type: "init",
    ortCdn: ORT_CDN,
    wasmPaths: ORT_WASM_PATHS,
    modelUrl: ONNX_MODEL_PATH,
    inputW: this._w,
    inputH: this._h
  });

  window.startBiscuitGate = () => {
    this._jimjamDetected = false;
    this._eatingDetected = false;
    this._lastClass = null;
    this._stableCount = 0;
    this._gateRunning = true;
    console.log("[BiscuitGate] START");
  };

  window.stopBiscuitGate = () => {
    this._gateRunning = false;
    console.log("[BiscuitGate] STOP");
  };
};

BiscuitGate.prototype._onWorker = function (msg) {
  this._busy = false;

  if (msg.type === "ready") {
    console.log("[BiscuitGate] Worker READY");
    return;
  }
  if (msg.type === "error") {
    console.error("[BiscuitGate] Worker ERROR:", msg.error);
    return;
  }
  if (msg.type !== "pred") return;

  const { clsIdx, prob } = msg;

  if (clsIdx === this._lastClass) this._stableCount++;
  else { this._stableCount = 1; this._lastClass = clsIdx; }

  if (this._stableCount < REQUIRED_STABLE_FRAMES) return;

  const cls = CLASS_NAMES[clsIdx] || "Unknown";
  if (!this._jimjamDetected && cls === "jimjam" && prob > THRESH) {
    this._jimjamDetected = true;
    console.log("[BiscuitGate] ✅ DETECT", (prob * 100).toFixed(1) + "%");
    this.app.fire("biscuit:detect", { prob });

    if (!this._eatingDetected) {
      this._eatingDetected = true;
      this.app.fire("biscuit:eaten", { prob });
    }
  }
};

BiscuitGate.prototype.update = function (dt) {
  if (!this._gateRunning) return;
  if (!this._pipeline || this._busy) return;
  if (this._jimjamDetected) return;

  this._accum += dt;
  if (this._accum < this._inferInterval) return;
  this._accum = 0;

  // Grab the Zappar camera texture
  const tex = this._pipeline.cameraFrameTextureGL();
  if (!tex) return;

  // Downsample on GPU into 224x224 FBO, then readPixels (small!)
  const rgba = this._renderTexToSmallRgba(tex);

  // Send to worker (transfer the buffer)
  this._busy = true;
  this._worker.postMessage({ type: "rgba", rgba, w: this._w, h: this._h }, [rgba.buffer]);
};

// ---------- GPU downsample setup ----------
BiscuitGate.prototype._setupDownsampleFbo = function () {
  const gl = this._gl;

  // texture to render into
  this._smallTex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, this._smallTex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this._w, this._h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  // framebuffer
  this._fbo = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, this._fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this._smallTex, 0);

  const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
  if (status !== gl.FRAMEBUFFER_COMPLETE) {
    console.error("[BiscuitGate] FBO incomplete:", status);
  }
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);

  // fullscreen quad program
  const vs = `
    attribute vec2 aPos;
    varying vec2 vUv;
    void main() {
      vUv = (aPos + 1.0) * 0.5;
      gl_Position = vec4(aPos, 0.0, 1.0);
    }`;
  const fs = `
    precision mediump float;
    varying vec2 vUv;
    uniform sampler2D uTex;
    void main() {
      gl_FragColor = texture2D(uTex, vUv);
    }`;

  const vsh = this._compile(gl.VERTEX_SHADER, vs);
  const fsh = this._compile(gl.FRAGMENT_SHADER, fs);

  this._prog = gl.createProgram();
  gl.attachShader(this._prog, vsh);
  gl.attachShader(this._prog, fsh);
  gl.linkProgram(this._prog);
  if (!gl.getProgramParameter(this._prog, gl.LINK_STATUS)) {
    console.error("[BiscuitGate] Program link failed:", gl.getProgramInfoLog(this._prog));
  }

  this._aPos = gl.getAttribLocation(this._prog, "aPos");
  this._uTex = gl.getUniformLocation(this._prog, "uTex");

  // quad buffer
  this._vb = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, this._vb);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    -1, -1, 1, -1, -1, 1,
    -1, 1, 1, -1, 1, 1
  ]), gl.STATIC_DRAW);

  this._rgba = new Uint8Array(this._w * this._h * 4);
};

BiscuitGate.prototype._compile = function (type, src) {
  const gl = this._gl;
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    console.error("[BiscuitGate] Shader compile error:", gl.getShaderInfoLog(sh));
  }
  return sh;
};

BiscuitGate.prototype._renderTexToSmallRgba = function (cameraGlTex) {
  const gl = this._gl;

  // --- SAVE STATE (PlayCanvas expects these) ---
  const prevFbo = gl.getParameter(gl.FRAMEBUFFER_BINDING);
  const prevViewport = gl.getParameter(gl.VIEWPORT);
  const prevProgram = gl.getParameter(gl.CURRENT_PROGRAM);
  const prevArrayBuf = gl.getParameter(gl.ARRAY_BUFFER_BINDING);
  const prevActiveTex = gl.getParameter(gl.ACTIVE_TEXTURE);
  const prevTex0 = gl.getParameter(gl.TEXTURE_BINDING_2D);

  // --- RENDER INTO 224x224 FBO ---
  gl.bindFramebuffer(gl.FRAMEBUFFER, this._fbo);
  gl.viewport(0, 0, this._w, this._h);

  gl.useProgram(this._prog);
  gl.bindBuffer(gl.ARRAY_BUFFER, this._vb);
  gl.enableVertexAttribArray(this._aPos);
  gl.vertexAttribPointer(this._aPos, 2, gl.FLOAT, false, 0, 0);

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, cameraGlTex);
  gl.uniform1i(this._uTex, 0);

  gl.drawArrays(gl.TRIANGLES, 0, 6);

  gl.readPixels(0, 0, this._w, this._h, gl.RGBA, gl.UNSIGNED_BYTE, this._rgba);

  // --- RESTORE STATE (CRITICAL) ---
  gl.bindFramebuffer(gl.FRAMEBUFFER, prevFbo);
  gl.viewport(prevViewport[0], prevViewport[1], prevViewport[2], prevViewport[3]);

  gl.useProgram(prevProgram);
  gl.bindBuffer(gl.ARRAY_BUFFER, prevArrayBuf);
  gl.activeTexture(prevActiveTex);
  gl.bindTexture(gl.TEXTURE_2D, prevTex0);

  // Return transferable copy
  return new Uint8Array(this._rgba);
};


// ---------- Worker ----------
BiscuitGate.prototype._makeWorker = function () {
  // Worker path is relative to index.html
  // If index.html is served from /, this resolves to /workers/biscuit_infer.worker.js
  const workerUrl = "workers/biscuit_infer.worker.js";

  try {
    if (msg.type === "pong") {
      console.log("[BiscuitGate] Worker pong received");
    }

    return new Worker(workerUrl);
  } catch (e) {
    console.error("[BiscuitGate] Failed to create Worker:", workerUrl, e);
    throw e;
  }

};

