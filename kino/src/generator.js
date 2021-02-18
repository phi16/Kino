module.exports = Kino=>{
  const Y = Kino.Y;

  const NoteAllocator = (u,a)=>{
    const units = 512;
    const allocBlock = 16;
    const blockUnits = units / allocBlock;
    const blockNotes = blockUnits / 2;
    const paramCount = 32; // per 1 block
    const noteParam = paramCount / blockNotes;
    const freeLocs = [];
    function allocNote() {
      if(freeLocs.length == 0) {
        if(a() == null) return null;
        const j = u.store.synth.length / paramCount / 4 - 1;
        for(let i=0;i<blockNotes;i++) {
          for(let k=0;k<noteParam*4;k++) {
            u.store.synth[j*4*paramCount+i*4*noteParam+k] = 0;
          }
          freeLocs.push(j*paramCount + i*noteParam);
        }
      }
      const l = freeLocs.shift();
      return {
        param: ps=>{
          for(let k=0;k<ps.length;k++) {
            u.store.synth[l*4+k] = ps[k];
          }
        },
        release: _=>{
          for(let k=0;k<noteParam*4;k++) {
            u.store.synth[l*4+k] = 0;
          }
          setTimeout(_=>{
            freeLocs.push(l);
          }, 100);
        }
      };
    }
    return allocNote;
  };

  const gens = [];
  const Gen = (n,k)=>{
    const j = gens.length + 1;
    const o = { id: j, name: n };
    o.acquire = a=>{
      const u = {};
      u.id = j;
      u.name = n;
      u.store = {
        block: new Float32Array(0),
        synth: new Float32Array(0)
      };
      u.alloc = NoteAllocator(u,a);
      k(u);
      return u;
    };
    gens.push(o);
  };
  Gen("Grain", o=>{
    require('./generators/grain')(Kino,o);
  });
  Gen("Noise", o=>{
    require('./generators/noise')(Kino,o);
  });
  Gen("Cycle", o=>{
    require('./generators/cycle')(Kino,o);
  });
  return gens;
};
