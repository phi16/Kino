module.exports = Kino=>{
  const Y = Kino.Y;

  const gens = [];
  const Gen = (n,k)=>{
    const j = gens.length + 1;
    const o = { id: j, name: n };
    o.acquire = a=>{
      const u = {};
      u.id = j;
      u.name = n;
      u.alloc = a;
      u.store = {
        block: new Float32Array(0),
        synth: new Float32Array(0)
      };
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
