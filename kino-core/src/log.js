const props = [];
const logs = [];
let showProp = true;
module.exports = {
  add: t=>{
    let lastPos = 0;
    if(logs.length > 0 && logs[0].pos < lastPos) lastPos = logs[0].pos;
    logs.unshift({ text: t + "", pos: lastPos-1, time: 0 });
  },
  prop: (i,t)=>{
    while(i >= props.length) {
      props.push("");
    }
    props[i] = t;
  },
  propShow: b=>{
    showProp = b;
  },
  render: R=>{
    R.blend("lighter",_=>{
      for(let i=0;i<logs.length;i++) {
        const u = logs[i];
        u.pos += (i - u.pos) / 2.0;
        let alpha = Math.max(0, u.time - 2);
        alpha = 1 - Math.pow(alpha, 2);
        R.text(u.text,10,-u.pos*35-10+R.h,30).l().fill(0,0,0.5*alpha);
        u.time += 0.01;
        if(u.time > 3) {
          logs.splice(i,1);
          i--;
        }
      }
      if(!showProp) return;
      for(let i=0;i<props.length;i++) {
        const u = props[i];
        R.text(u,20,40+i*25,20).l().fill(0,0,0.5);
      }
    });
  }
};
