let R = null, I = null, L = null, S = null;

// EDCBAGF
const noteBrightness = {};
function addBright(k) {
  if(noteBrightness[k] === undefined) noteBrightness[k] = { count: 0, value: 0 };
  noteBrightness[k].count++;
}
function removeBright(k) {
  noteBrightness[k].count--;
}

function render() {
  Object.keys(noteBrightness).forEach(k=>{
    const b = noteBrightness[k];
    if(b.count > 0) {
      b.value += (1 - b.value) / 4.0;
    } else {
      b.value += (0 - b.value) / 4.0;
      if(b.value < 0.001) delete noteBrightness[k];
    }
  });
  R.translate(R.width/2, R.height/2).with(_=>{
    R.scale(Math.min(R.width/I.width, R.height/I.height)*0.9).with(_=>{
      const field = R.rect(-I.width/2, -I.height/2, I.width, I.height);
      field.fill(1,0,0.1);
      field.clip(_=>{
        const s = 24;
        const w = Math.max(I.width, I.height);
        for(let i=-7;i<6;i++) {
          const ii = (i+8)%2;
          const x = i+0.5;
          for(let j=0;j<4;j++) {
            const y = j-Math.floor(i/2)-3;
            if(ii == 0 && j == 0) continue;
            let b = noteBrightness[i*5-y*2+3];
            if(b) b = b.value * 0.2;
            else b = 0;
            R.rect(x*s,y*s,s,s).fill(1,0,0.15+b);
          }
        }
        for(let i=-6;i<6;i++) {
          let x = (i+0.5) * s;
          let y = i * s;
          R.line(x,-w,x,w).stroke(1,0,0.25,0.5);
          R.line(-w,y,w,y).stroke(1,0,0.25,0.5);
        }
        for(let i=-3;i<3;i++) {
          R.translate((i*2+1)*s,(-i-0.5)*s).with(_=>{
            R.shape(X=>{
              X.moveTo(-s,0);
              X.lineTo(s,0);
              X.moveTo(0,-s);
              X.lineTo(0,s);
            }).stroke(1,0,0.5,1.5);
          });
        }
      });
      field.stroke(1,0,0.2,2);
      R.translate(-I.width/2, -I.height/2).with(_=>{
        for(let id in I.touches) {
          let c;
          c = I.touches[id];
          p = 1 - Math.exp(-c.force*0.002);
          R.ellipse(c.x, c.y, c.minor_axis*p, c.major_axis*p, c.orientation*Math.PI/180).stroke(1,0,0.8,1);
        }
      });
    });
  });
}

module.exports = o=>{
  R = o.render;
  I = o.input;
  L = o.log;
  S = o.sound;

  R.onRender(render);
  let baseFreq = 440;
  I.onTouch(function*() {
    let c = yield;
    const st = new Date();
    const g = S.node();
    g.gain.value = 0;
    const osc = S.X.createOscillator();
    const og = S.X.createGain();
    const osc2 = S.X.createOscillator();
    const s = 24;
    const posX = Math.floor((c.x-I.width/2)/s+0.5), posY = Math.floor((c.y-I.height/2)/s)+1;
    let offset = posX*5 - posY*2;
    const freq = baseFreq * Math.pow(2.0, offset/12);
    osc.frequency.value = freq*4;
    og.gain.value = freq;
    osc2.frequency.value = freq;
    addBright(offset);
    osc.connect(og);
    osc.start();
    og.connect(osc2.frequency);
    osc2.connect(g);
    osc2.start();
    g.gain.setTargetAtTime(Math.max(0,c.force-10)*0.001, S.X.currentTime+0.001, 0.01);
    while((c=yield).state == I.state.MOVE) {
      const posX = Math.floor((c.x-I.width/2)/s+0.5), posY = Math.floor((c.y-I.height/2)/s)+1;
      let newOffset = posX*5 - posY*2;
      if(offset != newOffset) {
        removeBright(offset);
        offset = newOffset;
        addBright(offset);
        const freq = baseFreq * Math.pow(2.0, offset/12);
        osc.frequency.setTargetAtTime(freq*4, S.X.currentTime+0.001, 0.01);
        og.gain.setTargetAtTime(freq*0.5, S.X.currentTime+0.001, 0.01);
        osc2.frequency.setTargetAtTime(freq, S.X.currentTime+0.001, 0.01);
      }
      g.gain.setTargetAtTime(Math.max(0,c.force-10)*0.001, S.X.currentTime+0.001, 0.01);
    }
    const dur = (new Date() - st) / 1000;
    g.gain.setTargetAtTime(0, S.X.currentTime+0.001, 0.01 + 0.3*Math.exp(-dur*3.0));
    removeBright(offset);
    setTimeout(_=>{
      osc2.disconnect();
    },2000);
  });
  L.add("Launched.");
};
