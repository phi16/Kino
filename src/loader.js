const render = require('./lib/render.js');
const input = require('./lib/input.js');
const log = require('./lib/log.js');
const sound = require('./lib/sound.js');

render.onRender(input.proc);
require('./main.js')({ render, input, log, sound });
render.onRender(log.render(render));
