'use strict';
// Cloud-only in-process vm client; no sockets, network, or real DevTools.
const fs = require('fs'), path = require('path'), vm = require('vm'), {EventEmitter} = require('events');
exports.connect = async ({wsEndpoint}) => {
  const port = new URL(wsEndpoint).port;
  const info = JSON.parse(fs.readFileSync(path.join(process.env.QF_REVIEW_STATE, port + '.json'), 'utf8'));
  const events = new EventEmitter();
  let forwarding = false;
  const con = {};
  for (const type of ['log', 'info', 'error', 'warn']) con[type] = (...args) => { if (forwarding) events.emit('console', {type, args}); };
  const context = vm.createContext({console: con, wx: {onError() {}, onUnhandledRejection() {}}, Date, JSON});
  vm.runInContext(fs.readFileSync(path.join(info.project, 'game.js'), 'utf8'), context);
  forwarding = true;
  events.evaluate = async (fn) => vm.runInContext('(' + fn.toString() + ')()', context);
  events.screenshot = async () => { throw new Error('review fake: screenshot unavailable'); };
  events.disconnect = () => {};
  return events;
};
