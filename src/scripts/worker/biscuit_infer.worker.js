/* web/workers/biscuit_infer.worker.js */
/* global importScripts */

let session = null, inputName = null, outputName = null;
let W = 224, H = 224, HW = 224 * 224;
let inputBuf = null, inputTensor = null;

function softmax2(a, b) {
  const m = a > b ? a : b;
  const ea = Math.exp(a - m), eb = Math.exp(b - m);
  const s = ea + eb;
  return [ea / s, eb / s];
}

async function init({ ortCdn, wasmPaths, modelUrl, inputW, inputH }) {
  W = inputW; H = inputH; HW = W * H;

  importScripts(ortCdn);

  if (!self.ort) throw new Error("onnxruntime-web failed to load in worker");

  self.ort.env.wasm.wasmPaths = wasmPaths;
  self.ort.env.wasm.simd = true;
  self.ort.env.wasm.numThreads = 1;

  inputBuf = new Float32Array(3 * HW);
  inputTensor = new self.ort.Tensor("float32", inputBuf, [1, 3, H, W]);

  session = await self.ort.InferenceSession.create(modelUrl, {
    executionProviders: ["wasm"],
    graphOptimizationLevel: "all"
  });

  inputName = session.inputNames[0];
  outputName = session.outputNames[0];

  postMessage({ type: "ready" });
}

function rgbaToCHWFloat(rgba) {
  const inv255 = 1 / 255;
  const m0 = 0.485, s0 = 0.229;
  const m1 = 0.456, s1 = 0.224;
  const m2 = 0.406, s2 = 0.225;

  let p = 0;
  for (let i = 0; i < rgba.length; i += 4) {
    const r = rgba[i] * inv255;
    const g = rgba[i + 1] * inv255;
    const b = rgba[i + 2] * inv255;

    inputBuf[p] = (r - m0) / s0;
    inputBuf[p + HW] = (g - m1) / s1;
    inputBuf[p + 2 * HW] = (b - m2) / s2;
    p++;
  }
}

async function predictFromRgba(rgba) {
  if (!session) return;

  rgbaToCHWFloat(rgba);

  const feeds = {};
  feeds[inputName] = inputTensor;

  const out = await session.run(feeds);
  const logits = out[outputName].data;

  const probs = softmax2(logits[0], logits[1]);
  const clsIdx = probs[1] > probs[0] ? 1 : 0;
  const prob = probs[clsIdx];

  postMessage({ type: "pred", clsIdx, prob });
}

self.onmessage = (ev) => {
  const msg = ev.data;

  if (msg.type === "init") {
    init(msg).catch(e => postMessage({ type: "error", error: String(e?.message || e) }));
  } else if (msg.type === "rgba") {
    predictFromRgba(msg.rgba).catch(e => postMessage({ type: "error", error: String(e?.message || e) }));
  } else {
    postMessage({ type: "error", error: `Unknown message type: ${msg.type}` });
  }
};
