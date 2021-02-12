const o = {};

const X = new AudioContext();
const master = X.createGain();
master.gain.value = 1.0;
master.connect(X.destination);
const comp = X.createDynamicsCompressor();
comp.connect(master);
const dummy = X.createGain();
dummy.gain.value = 0;
dummy.connect(X.destination);

o.dummyOut = n=>{
  n.connect(dummy);
};

o.createEffector = _=>{
  const i = X.createGain();

  const l = X.createBiquadFilter();
  l.type = "lowpass";
  l.frequency.value = 20000;
  const ld = X.createGain(), lw = X.createGain();
  ld.gain.value = 1, lw.gain.value = 0;
  const lo = X.createGain();
  const h = X.createBiquadFilter();
  h.type = "highpass";
  h.frequency.value = 20;
  const hd = X.createGain(), hw = X.createGain();
  hd.gain.value = 1, hw.gain.value = 0;
  const ho = X.createGain();
  const g = X.createGain();
  g.gain.value = 0;
  i.connect(l).connect(lw).connect(lo);
  i.connect(ld).connect(lo);
  lo.connect(h).connect(hw).connect(ho);
  lo.connect(hd).connect(ho);
  ho.connect(g);
  return {
    in: i,
    out: g,
    lf: l.frequency,
    ld: ld.gain,
    lw: lw.gain,
    hf: h.frequency,
    hd: hd.gain,
    hw: hw.gain,
    g: g.gain,
    mute: i.gain
  };
};

const masterNode = o.createEffector();
masterNode.out.connect(comp);
const soundOut = masterNode.in;

o.X = X;
o.masterNode = masterNode;
o.reduction = _=>{
  return comp.reduction;
};
o.node = _=>{
  const n = o.createEffector();
  n.out.connect(soundOut);
  return n;
};

const loadedBuffers = {};
o.load = async path=>{
  if(loadedBuffers.hasOwnProperty(path)) {
    return loadedBuffers[path];
  }
  const root = "../sound/";
  const wav = await fetch(root + path);
  const b = await wav.arrayBuffer();
  const bf = await X.decodeAudioData(b);
  loadedBuffers[path] = bf;
  return bf;
};

let outDevice = null;
const deviceCheck = async _=>{
  const devices = await navigator.mediaDevices.enumerateDevices();
  for(let i=0;i<devices.length;i++) {
    const d = devices[i];
    if(d.kind == "audiooutput" && d.label.indexOf("VoiceMeeter Input") != -1) {
      outDevice = d;
      break;
    }
  }
};
o.externalOut = async _=>{
  if(outDevice == null) await deviceCheck();
  const dest = X.createMediaStreamDestination();
  master.connect(dest);
  const outAudio = document.createElement("audio");
  await outAudio.setSinkId(outDevice.deviceId);
  outAudio.srcObject = dest.stream;
  outAudio.play();
};

o.voiceAnalysis = async _=>{
  // Voice Audio Analyzer
  const fftSize = 2048;
  const freqs = new Float32Array(fftSize);
  let currentFreq = { f: 1, s: 0 };
  const ms = await navigator.mediaDevices.getUserMedia({audio:true});
  const s = X.createMediaStreamSource(ms);
  const a = X.createAnalyser();
  a.fftSize = fftSize*2;
  setInterval(_=>{
    a.getFloatFrequencyData(freqs);
    let maxIndex = 0, maxValue = -Infinity;
    for(let i=0;i<freqs.length;i++) {
      if(freqs[i] > maxValue) {
        maxIndex = i;
        maxValue = freqs[i];
      }
    }
    let sumIndex = 0, sumWeight = 0;
    for(let i=-10;i<=10;i++) {
      let j = i + maxIndex;
      if(j < 0 || freqs.length <= j) continue;
      let w = freqs[j] + 50;
      if(w > 0) {
        sumIndex += j * w;
        sumWeight += w;
      }
    }
    if(sumWeight < 0.0001) {
      currentFreq.s *= 0.5;
    } else {
      const centerIndex = sumIndex / sumWeight;
      const centerFreq = centerIndex / fftSize * X.sampleRate / 2;
      currentFreq.f = centerFreq;
      currentFreq.s = 1;
    }
    o.voiceFreqs = freqs;
    o.peakFreq = currentFreq;
  }, 16);
  s.connect(a).connect(dummy);
};

module.exports = o;
