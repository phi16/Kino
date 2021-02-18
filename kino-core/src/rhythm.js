const o = {};
// Assumption: multiple events do not occur in a single step on a pattern
const patterns = {};
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
    let repeated = false;
    if(loopBeats == 1 && pb != cb) repeated = true;
    pb %= loopBeats;
    cb %= loopBeats;
    if(pb > cb) repeated = true;
    if(repeated) eventIndex = 0, pb -= loopBeats;
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
  let handler = _=>_;
  p.on = cb=>{
    handler = cb;
  };
  p.note = (d,o)=>{
    handler(d,o);
  };
  p.key = Math.random();
  p.release = _=>{
    delete patterns[p.key];
  };
  patterns[p.key] = p;
  return p;
};
const bpm = 120;
const sampleRate = 48000;
const stepSamples = 2048;
const beatSamples = sampleRate / bpm * 60;
let beat = 0, time = 0;
o.step = _=>{
  let curBeat = beat, curTime = time + stepSamples;
  if(curTime >= beatSamples) curBeat++, curTime -= beatSamples;
  const ti = time/beatSamples, curTi = curTime/beatSamples;
  Object.keys(patterns).forEach(key=>{
    const u = patterns[key];
    const pd = u.get(beat, ti, curBeat, curTi);
    if(pd) u.note(pd.d * beatSamples / sampleRate, pd.o);
  });
  beat = curBeat, time = curTime;
};
module.exports = o;
