const X = new AudioContext();
const master = X.createGain();
master.gain.value = 0.5;
master.connect(X.destination);
const comp = X.createDynamicsCompressor();
comp.connect(master);

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
  }
};
