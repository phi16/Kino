const o = {};
// Assumption: multiple events do not occur in a single step on a pattern
o.pattern = iniLoopBeats=>{
  const p = {};
  let loopBeats = iniLoopBeats; // must be an integer
  let events = [];
  let eventIndex = 0;
  p.addEvent = (t,o)=>{
    for(let i=0;i<events.length;i++) {
      if(t < events[i].t) {
        events.splice(i, 0, { t, o });
        return;
      }
    }
    events.push({ t, o });
  };
  p.get = (pb,pt,cb,ct)=>{
    if(events.length == 0) return null;
    pb %= loopBeats;
    cb %= loopBeats;
    if(pb > cb) eventIndex = 0, pb -= loopBeats;
    const pu = pb + pt, cu = cb + ct;
    for(let i=eventIndex;i<events.length;i++) {
      const e = events[i];
      if(e.t < pu) continue;
      if(e.t < cu) {
        eventIndex = i + 1;
        const d = e.t - pu;
        return { d, o: e.o };
      } else return null;
    }
    eventIndex = 0;
    return null;
  };
  return p;
};
const u = o.pattern(4);
u.addEvent(0);
u.addEvent(1);
u.addEvent(2);
u.addEvent(3);
const bpm = 125;
const sampleRate = 48000;
const stepSamples = 2048;
const beatSamples = sampleRate / bpm * 60;
let beat = 0, time = 0;
o.step = _=>{
  let curBeat = beat, curTime = time + stepSamples;
  if(curTime >= beatSamples) curBeat++, curTime -= beatSamples;
  const ti = time/beatSamples, curTi = curTime/beatSamples;
  const pd = u.get(beat, ti, curBeat, curTi);
  // if(pd) console.log(pd.d * beatSamples / stepSamples);
  beat = curBeat, time = curTime;
};
module.exports = o;
