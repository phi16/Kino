const render = require('./render.js');
const input = require('./input.js');
const log = require('./log.js');
const sound = require('./sound.js');

render.onRender(input.proc);
require('./main.js')({ render, input, log, sound });
render.onRender(log.render(render));
