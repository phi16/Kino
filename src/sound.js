const X = new AudioContext();
const master = X.createGain();
master.gain.value = 0.5;
master.connect(X.destination);
const comp = X.createDynamicsCompressor();
comp.connect(master);

module.exports = {
  X,
  node: _=>{
    const g = X.createGain();
    g.connect(comp);
    return g;
  }
};
