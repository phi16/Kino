const X = new AudioContext();
const master = X.createGain();
master.gain.value = 1.0;
master.connect(X.destination);
(async _=>{
  return;
  const devices = await navigator.mediaDevices.enumerateDevices();
  for(let i=0;i<devices.length;i++) {
    const d = devices[i];
    if(d.kind == "audiooutput" && d.label.indexOf("VoiceMeeter Input") != -1) {
      const dest = X.createMediaStreamDestination();
      master.connect(dest);
      const outAudio = document.createElement("audio");
      await outAudio.setSinkId(d.deviceId);
      outAudio.srcObject = dest.stream;
      outAudio.play();
      break;
    }
  }
})();
const comp = X.createDynamicsCompressor();
comp.connect(master);

// Voice Audio Analyzer
const fftSize = 2048;
const freqs = new Float32Array(fftSize);
let currentFreq = { f: 1, f1: 1, s: 0 };
navigator.mediaDevices.getUserMedia({audio:true}).then(ms=>{
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
    const maxFreq = maxIndex/fftSize * X.sampleRate / 2;
    currentFreq.f += (maxFreq - currentFreq.f) * 0.2;
    currentFreq.f1 += (currentFreq.f - currentFreq.f1) * 0.2;
    currentFreq.s *= 0.1;
    currentFreq.s = Math.max(currentFreq.s, Math.exp(-Math.abs(currentFreq.f1-currentFreq.f)*0.1) * Math.exp(Math.min(0, maxValue+40)));
  }, 16);
  const g = X.createGain();
  g.gain.value = 0;
  s.connect(a).connect(g).connect(master);
});

const loadedBuffers = {};
module.exports = {
  X,
  node: _=>{
    const g = X.createGain();
    g.connect(comp);
    return g;
  },
  load: async path=>{
    if(loadedBuffers.hasOwnProperty(path)) {
      return loadedBuffers[path];
    }
    const wav = await fetch(path);
    const b = await wav.arrayBuffer();
    const bf = await X.decodeAudioData(b);
    loadedBuffers[path] = bf;
    return bf;
  },
  voiceFreq: _=>currentFreq,
  voiceFreqs: freqs
};
