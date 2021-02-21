module.exports = (Kino,effector)=>g=>{
  const o = {};

  const R = Kino.R;
  const H = Kino.H;
  const I = Kino.I.sensel;
  let M = null;
  const lerp = (a,b,x)=>a+(b-a)*x;
  function eff(x) {
    return 1 - Math.exp(-x*0.008);
  }

  const Sequence = (period,phase,unit)=>{
    const u = {};
    u.period = period; // [beat]
    u.phase = phase; // [beat]
    u.unit = unit; // [beat-log2]
    u.rh = [];
    u.muted = false;
    u.muteBar = 0;
    u.alpha = 1;
    for(let i=0;i<8;i++) u.rh.push(null);
    const pat = H.pattern(u.period);
    pat.on(d=>{
      if(u.muted) return;
      if(g.note) g.note(d);
    });
    u.flipMute = _=>{
      u.muted = !u.muted;
    };
    u.texts = ["","",""];
    u.applyText = _=>{
      u.texts[0] = `/${u.period}`;
      u.texts[1] = `${u.phase}`;
      u.texts[2] = u.unit > 0 ? `+${u.unit}` : u.unit == 0 ? `±${u.unit}` : `${u.unit}`;
    };
    u.applyText();
    u.on = (i,d)=>{
      u.rh[i] = d;
      pat.addEvent((u.phase + i*Math.pow(2,u.unit)) % u.period, d);
    };
    u.applyPropertyChange = _=>{
      pat.reset(u.period);
      for(let i=0;i<8;i++) {
        if(u.rh[i]) u.on(i, u.rh[i]);
      }
    };
    u.release = _=>{
      pat.release();
    };
    return u;
  };
  const Qs = (_=>{
    const q = {};
    q.seqs = [Sequence(2,0,-1), Sequence(2,0,-1), Sequence(2,0,-1)];
    const DiscreteSelector = _=>{
      const d = {};
      d.v = d.vM = d.vD = d.vP = 0;
      d.changing = false;
      d.step = _=>{
        d.vM += (d.v + Math.tanh(d.vD)*0.75 - d.vM) / 2.0;
        d.vP += (Math.tanh(d.vD) - d.vP) / 4.0;
      };
      d.lb = 0, d.ub = 1; // both inclusive
      d.startChange = (lb,ub,v)=>{
        d.changing = true;
        d.lb = lb;
        d.ub = ub;
        d.v = d.vM = v;
        d.vD = 0;
      };
      d.endChange = _=>{
        d.changing = false;
        d.vD = 0;
      };
      d.applyDiff = (diff,cb)=>{
        d.vD -= diff;
        if(d.vD > 1.0 && d.v < d.ub) {
          d.v += 1;
          d.vD = 0;
          d.vP = -1;
          cb();
        } else if(d.vD < -1.0 && d.v > d.lb) {
          d.v -= 1;
          d.vD = 0;
          d.vP = 1;
          cb();
        }
      };
      return d;
    };
    q.cur = 1;
    q.curSel = DiscreteSelector();
    q.curSel.v = q.curSel.vM = q.cur;
    q.dPeriod = DiscreteSelector();
    q.dPhase = DiscreteSelector();
    q.dUnit = DiscreteSelector();
    q.step = _=>{
      q.curSel.step();
      q.dPeriod.step();
      q.dPhase.step();
      q.dUnit.step();
    };
    q.addFirst = _=>{
      const u = q.seqs[0];
      const s = Sequence(u.period,u.phase,u.unit);
      s.alpha = 0;
      q.seqs.unshift(s);
      q.cur += 1;
      q.curSel.v = q.curSel.vM = q.cur;
    };
    q.addLast = _=>{
      const u = q.seqs[q.seqs.length-1];
      const s = Sequence(u.period,u.phase,u.unit);
      s.alpha = 0;
      q.seqs.push(s);
    };
    q.remove = u=>{
      for(let i=0;i<q.seqs.length;i++) {
        if(q.seqs[i] == u) {
          u.release();
          q.seqs.splice(i,1);
          if(i <= q.cur) {
            q.cur--;
            q.curSel.v--;
          }
          return;
        }
      }
    };
    return q;
  })();

  function* rhythmNote(touchIndex, c) {
    Qs.seqs[Qs.cur].on(touchIndex, true);
    if(Qs.cur == 0) Qs.addFirst();
    if(Qs.cur == Qs.seqs.length-1) Qs.addLast();
  }
  let countsRetain = 0;
  let pull = 0, pullM = 0;
  function* patternControl(side, c) {
    const d = side == 0 ? Qs.dUnit : side == 1 ? Qs.dPhase : Qs.dPeriod;
    if(d.changing) return;
    const q = Qs.seqs[Qs.cur];
    const removable = Qs.cur != 0 && Qs.cur != Qs.seqs.length-1;
    if(side == 0) d.startChange(-2, 6, q.unit);
    else if(side == 1) d.startChange(0, q.period-1, q.phase);
    else if(side == 2) d.startChange(0, 8, Math.log2(q.period));
    const removeLevel = M.vPad + M.mainH/10 * 2;
    let removeWait = false;
    countsRetain++;
    while(true) {
      const nc = yield;
      if(!removeWait) {
        d.applyDiff(- (nc.x - c.x) * eff(nc.force*0.02) * 10, _=>{
          if(side == 0) q.unit = d.v;
          else if(side == 1) q.phase = d.v;
          else if(side == 2) q.period = Math.pow(2, d.v);
          q.applyText();
        });
        c = nc;
        if(c.state == I.states.END) {
          d.endChange();
          q.applyPropertyChange();
          countsRetain--;
        } else if(c.y > removeLevel && removable) {
          removeWait = true;
          d.endChange();
          q.applyPropertyChange();
        }
      } else {
        pull += nc.y - c.y;
        c = nc;
        if(pull > M.mainH*7/10) {
          Qs.remove(q);
          pull = 0;
          while(true) {
            c = yield;
            if(c.state == I.states.END) countsRetain--;
          }
        }
        if(c.state == I.states.END) {
          countsRetain--;
          pull = 0;
        }
      }
    }
  }
  let scrollRetain = 0;
  function* scroll(c) {
    const d = Qs.curSel;
    if(d.changing) return;
    d.startChange(0, Qs.seqs.length-1,Qs.cur);
    const muteLevel = M.h - M.vPad - M.mainH/10;
    let muteChange = false, abovePos = false, q = null;
    scrollRetain++;
    while(true) {
      const nc = yield;
      if(!muteChange) {
        d.applyDiff((nc.x - c.x) * eff(nc.force*0.02) * 10, _=>{
          Qs.cur = d.v;
        });
        c = nc;
        if(c.state == I.states.END) {
          d.endChange();
          scrollRetain--;
        } else if(c.y < muteLevel) {
          muteChange = true;
          d.endChange();
          q = Qs.seqs[Qs.cur];
          q.flipMute();
          abovePos = true;
        }
      } else {
        if(abovePos && nc.y > muteLevel+1) {
          abovePos = false;
          q.flipMute();
        } else if(!abovePos && nc.y < muteLevel-1) {
          abovePos = true;
          q.flipMute();
        }
        c = nc;
        if(c.state == I.states.END) scrollRetain--;
      }
    }
  }
  let uiActive = false;
  const touchHandler = I.on(function*() {
    if(!uiActive || effector.visible || M == null) return;
    let c = yield;
    if(c.state == I.states.END) return;
    if(M.sideX < c.x && M.vPad < c.y && c.y < M.sideY) {
      const y = ((c.y - M.vPad) / M.mainH * 10 - 1) / 8;
      if(0 < y && y < 1) {
        const yi = Math.floor(y*9 - 0.5);
        yield* rhythmNote(Math.max(0, Math.min(7, yi)), c);
      } else if(y <= 0) {
        let e1 = c.x < M.sideX + M.hPad * 2 / 5;
        let e2 = c.x < M.sideX + M.hPad * 3 / 5;
        yield* patternControl(e1 ? 0 : e2 ? 1 : 2, c);
      } else {
        yield* scroll(c);
      }
    }
  });
  o.open = _=>{
    uiActive = true;
  };
  o.close = _=>{
    uiActive = false;
  };
  o.disconnect = _=>{
    uiActive = false;
    touchHandler.release();
  };
  let currentBeat = 0;
  let beatAnim = 0;
  o.render = M2=>{
    M = M2;
    beatAnim += (0 - beatAnim) / 4.0;
    if(currentBeat != H.beat) {
      currentBeat = H.beat;
      beatAnim = 1;
    }
    R.translate(M.sideX, M.vPad).with(_=>{
      const ub = M.mainH/10, lb = M.mainH - ub;
      const le = M.hPad/8, re = M.hPad - le;

      // Counts line
      const cntLight = countsRetain > 0 ? 0.3 : 0.1;
      R.line(le,ub,re,ub).stroke(1,0,cntLight,0.6);
      // Scroll line
      const scrLight = scrollRetain > 0 ? 0.3 : 0.1;
      R.line(le,lb,re,lb).stroke(1,0,scrLight,0.6);

      const p = 1.5;
      R.rect(p, 0, M.hPad-p*2, M.mainH).clip(_=>{
        Qs.step();
        const periodBright = Qs.dPeriod.changing ? 0.6 : 0;
        const phaseBright = Qs.dPhase.changing ? 0.6 : 0;
        const unitBright = Qs.dUnit.changing ? 0.6 : 0;
        for(let j=Qs.cur-1;j<=Qs.cur+1;j++) {
          if(j < 0 || Qs.seqs.length <= j) continue;
          const d = j - Qs.curSel.vM;
          const x = d * M.hPad;
          const q = Qs.seqs[j];
          const bix = currentBeat%q.period;
          // Fade-In
          if(q.alpha < 1) {
            q.alpha += 0.08;
            q.alpha = Math.min(1, q.alpha);
          }
          // Counts
          const cbr = 0.4 * Math.exp(-Math.abs(d)*2);
          R.translate(x, 0).with(_=>{
            R.text(bix, 15.8, 8.8, 7+beatAnim).r().fill(1,0,cbr+beatAnim*0.2);
            R.text(q.texts[0], 16, 8.8, 3+Qs.dPeriod.vP).l().fill(1,0,cbr+periodBright);
            R.text(q.texts[1], 4, 5.8, 3+Qs.dPhase.vP).l().fill(1,0,cbr+phaseBright);
            R.text(q.texts[2], 4, 9.2, 3+Qs.dUnit.vP).l().fill(1,0,cbr+unitBright);
          });
          // Beats
          const rh = q.rh;
          const bx = M.hPad/2 + d * M.hPad*0.35;
          const mu = 1 + Math.pow(d, 2) * 0.12;
          const ef = (H.beat%q.period+H.time-q.phase+q.period)%q.period / Math.pow(2,q.unit);
          const bbr = Math.exp(-Math.abs(d/2)*2) * q.alpha;
          const bound = Math.min(8, q.period/Math.pow(2,q.unit));
          // mute bar
          if(q.muted) {
            q.muteBar += (1 - q.muteBar) / 3.0;
            const e = q.muteBar*2-1;
            R.line(bx,lerp(lb,ub,0.5-0.435*mu),bx,lerp(lb,ub,0.5+0.435*mu*e)).stroke(1,0,0.2*bbr,0.6);
          } else {
            q.muteBar += (0 - q.muteBar) / 3.0;
            if(q.muteBar > 0.005) {
              const e = q.muteBar*2-1;
              R.line(bx,lerp(lb,ub,0.5-0.435*mu*e),bx,lerp(lb,ub,0.5+0.435*mu)).stroke(1,0,0.2*bbr,0.6);
            }
          }
          // notes
          for(let i=0;i<bound;i++) {
            const y = lerp(ub, lb, ((i+1)/9 - 0.5) * mu + 0.5);
            const e = ef < i ? 0 : ef < i+1 ? Math.exp((i-ef)*3) * (q.muted ? 0.5 : 1) : 0;
            const es = q.muted ? 0 : e;
            if(rh[i]) R.poly(bx,y,3*mu+es,4,0).stroke(1,0,(0.4+e)*bbr,0.6);
            else R.circle(bx,y,mu).stroke(1,0,(0.2+e)*bbr,0.6);
          }
        }
        // Scroll
        const scrollBright = Qs.curSel.changing ? 0.2 : 0;
        for(let j=Qs.cur-2;j<=Qs.cur+2;j++) {
          if(j < 0 || Qs.seqs.length <= j) continue;
          const q = Qs.seqs[j];
          const d = j - Qs.curSel.vM;
          const x = Math.tanh(d*0.3) * M.hPad * 0.7;
          R.circle(M.hPad/2 + x, M.mainH-ub/2, 0.9 + 0.8*Math.exp(-Math.abs(x)*1.0)).stroke(1,0,0.2*q.alpha+scrollBright,0.6);
        }
        // Remove line
        pullM += (pull - pullM) / 2.0;
        const offset = 0.01;
        if(pullM > offset) {
          const f = x=>x*x*(3-2*x);
          const py = M.mainH/10;
          const ph = M.mainH-py*2;
          const full = M.mainH*7/10;
          const pm = f((pullM-offset)/(full-offset)) * ph + py;
          const pr = (1 - Math.exp(-(pullM-offset)*0.05)) * 1;
          if(pr > 0.01) {
            R.line(M.hPad/2,py,M.hPad/2,pm-pr).stroke(0,0,0.6,0.6);
            R.circle(M.hPad/2,pm,pr).stroke(0,0,0.6,0.6);
          }
        }
      });
    });
  };
  return o;
};
