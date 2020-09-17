/*

- Node
  - op: Operation
  - x, y: Float (relative)
  - bb: [ lx, ly, ux, uy: Float ] (bounding box)
  - length: Int
  - next: [Node]
- Graph
  - root: Node

*/

const Op = {
  none: { r: 0, arity: 0 },
  u0: { r: 0.25, arity: 0 },
  u1: { r: 0.25, arity: 1 },
  u12: { r: 0.375, arity: 1 },
  u2: { r: 0.25, arity: 2 },
  merge: { r: 0, arity: 2 },
  root: { r: 0, arity: 1 }
};
Object.keys(Op).forEach(n=>{
  Op[n].name = n;
});

const Graph = _=>{
  const g = {};

  g.root = {
    op: Op.root,
    x: 10, y: 0,
    mx: 10, my: 0,
    length: 10,
    next: []
  };
  g.collide = (x,y,cb)=>{
    function traverse(nx, ny, n) {
      const cx = nx + n.x;
      const cy = ny + n.y;
      const dx = x - cx;
      const dy = y - cy;
      if(n.op != Op.root) {
        let d = Math.sqrt(dx*dx+dy*dy);
        if(d < n.op.r * 1.25) {
          cb("node", cx, cy, n);
          return;
        } else if(-n.length-1 < dx && dx < 0 && Math.abs(dy) < 0.25) {
          cb("edge", cx, cy, n);
          return;
        } else if(d < n.op.r * 2) {
          cb("node", cx, cy, n);
          return;
        }
      }
      if(n.op == Op.root || n.bb[0] < dx && dx < n.bb[2] && n.bb[1] < dy && dy < n.bb[3]) {
        for(let c of n.next) {
          traverse(cx, cy, c);
        }
      }
    }
    traverse(-(10-1), 0, g.root);
  };
  g.layout = n=>{
    for(let c of n.next) {
      g.layout(c);
    }
    // TODO: dispatch
    // TODO: may not sufficient
    if(n.op == Op.none || n.op == Op.u0) {
      const u = Math.max(0.25, n.op.r);
      n.bb = [-u,-u,u,u];
    } else if(n.op == Op.root) {
      const c = n.next[0];
      c.x = c.length;
      c.y = 0;
      n.bb = [].concat(c.bb);
      n.bb[2] += c.x;
    } else if(n.op == Op.u1 || n.op == Op.u12) {
      const c = n.next[0];
      c.x = c.length + 1 - c.bb[0];
      c.y = 0;
      n.bb = [].concat(c.bb);
      n.bb[2] += c.x;
    } else if(n.op == Op.u2) {
      const c0 = n.next[0];
      const c1 = n.next[1];
      c0.x = c0.length + 1 - c0.bb[0];
      c0.y = 0;
      n.bb = [].concat(c0.bb);
      n.bb[2] += c0.x;
      const p0 = Math.abs(c0.bb[3]) + Math.abs(c1.bb[1]) + 0.25;
      c1.y = p0;
      c1.x = p0 + c1.length;
      n.bb[2] = Math.max(n.bb[2], c1.x + c1.bb[2]);
      n.bb[3] = Math.max(n.bb[3], c1.y + c1.bb[3]);
    } else if(n.op == Op.merge) {
      const c0 = n.next[0];
      const c1 = n.next[1];
      const p0 = Math.max(Math.abs(c0.bb[3]), 0.5);
      const p1 = Math.max(Math.abs(c1.bb[1]), 0.5);
      c0.y = -p0;
      c1.y = p1;
      c0.x = p0 + c0.length;
      c1.x = p1 + c1.length;
      n.bb = [
        -0.25,
        c0.y + c0.bb[1],
        Math.max(c0.x + c0.bb[2], c1.x + c1.bb[2]),
        c1.y + c1.bb[3]
      ];
    }
    if(n.bb[1] > -n.op.r) n.bb[1] = -n.op.r;
    if(n.bb[0] > -n.op.r) n.bb[0] = -n.op.r;
    if(n.bb[3] < +n.op.r) n.bb[3] = +n.op.r;
    n.passed = 0;
  };

  function traverse(n,k) {
    let ov = ["none", "u0", "u1", "u12", "u2", "u2", "merge", "merge"];
    if(k == 5) ov = ["none","u0"];
    for(let i=0;i<n.op.arity;i++) {
      const p = {
        op: Op[ov[Math.floor(Math.random()*ov.length)]],
        x: Math.random()*5, y: Math.random()*5-5,
        length: Math.random() < 0.2 ? 0 : 1,
        next: []
      };
      p.mx = p.x, p.my = p.y;
      traverse(p,k+1);
      n.next.push(p);
    }
  }
  traverse(g.root,0);
  g.layout(g.root);

  return g;
};

module.exports = Graph;
