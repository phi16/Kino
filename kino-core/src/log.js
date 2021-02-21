const o = {};

const props = [];
const logs = [];
o.add = t=>{
  if(consoleOut) {
    console.log(t);
    return;
  }
  let lastPos = 0;
  if(logs.length > 0 && logs[0].pos < lastPos) lastPos = logs[0].pos;
  logs.unshift({ text: t + "", pos: lastPos-1, time: 0 });
};
o.prop = (i,t)=>{
  while(i >= props.length) {
    props.push("");
  }
  props[i] = t;
};

let commandMode = false, command = "";
let commandAnim = 0, commandPos = 1;
o.command = k=>{
  commandMode = true;
  command = ":" + k;
  commandAnim = 1;
  commandPos = 0;
};
o.commitCommand = _=>{
  o.add(command);
  commandMode = false;
  command = "";
};
o.revokeCommand = _=>{
  commandMode = false;
};

let consoleOut = false;
o.toConsole = _=>{
  consoleOut = true;
};

o.render = R=>{
  R.blend("lighter",_=>{
    for(let i=0;i<logs.length;i++) {
      const u = logs[i];
      u.pos += ((commandMode ? i+1 : i) - u.pos) / 2.0;
      let alpha = Math.max(0, u.time - 2);
      alpha = 1 - Math.pow(alpha, 2);
      R.text(u.text,10,-u.pos*35-10+R.h,30).l().fill(0,0,0.5*alpha);
      u.time += 0.01;
      if(u.time > 3) {
        logs.splice(i,1);
        i--;
      }
    }
    for(let i=0;i<props.length;i++) {
      const u = props[i];
      R.text(u,20,40+i*25,20).l().fill(0,0,0.5);
    }
    commandAnim += (0 - commandAnim) / 4.0;
    commandPos += ((commandMode ? 0 : 1) - commandPos) / 2.0;
    R.text(command,10,35*commandPos+commandAnim*5-10+R.h,30).l().fill(0,0,0.7+commandAnim*0.2);
  });
};
module.exports = o;
