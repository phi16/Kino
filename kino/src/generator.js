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
      u.step = _=>_;
      k(u);
      return u;
    };
    gens.push(o);
  };
  Gen("Grain", o=>{
    o.alloc();
  });
  Gen("Cycle", o=>{
    o.alloc();
  });
  Gen("Noise", o=>{
    o.alloc();
  });
  Gen("Sample", o=>{
    o.alloc();
  });
  return gens;
};
