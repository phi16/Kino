const Clamp = (a,b)=>x=>{
  return Math.min(b,Math.max(a,x));
};
const Saturate = Clamp(0,1);
const E = x=>(a,b)=>f=>(c,d)=>{
  const x01 = Saturate((x-a)/(b-a));
  return f(x01)*(d-c) + c;
};
const Ease = j=>{
  const e = {};
  e.s = x=>x*x*(3-x)/2;
  e.q = x=>x*x;
  e.c = x=>x*x*x;
  e.b = x=>x*x*(3*x-2);
  e.e = x=>Math.pow(2,-(1-x)*10);
  return e;
};
E.i = Ease(f=>f);
E.o = Ease(f=>x=>1-f(1-x));
E.io = Ease(f=>x=> x<0.5 ? f(2*x)/2 : 1-f(2-2*x)/2 );
E.l = x=>x;

const logs = [];
module.exports = {
  add: t=>{
    let lastPos = 0;
    if(logs.length > 0 && logs[0].pos < lastPos) lastPos = logs[0].pos;
    logs.unshift({ text: t + "", pos: lastPos-1, time: 0 });
  },
  render: R=>_=>{
    R.blend("lighter",_=>{
      for(let i=0;i<logs.length;i++) {
        const u = logs[i];
        u.pos += (i - u.pos) / 2.0;
        const alpha = E(u.time)(2,3)(E.i.q)(1,0);
        R.text(u.text,10,-u.pos*35-10+R.height,30).l().fill(0,0,0.5*alpha);
        u.time += 0.01;
        if(u.time > 3) {
          logs.splice(i,1);
          i--;
        }
      }
    });
  }
};
