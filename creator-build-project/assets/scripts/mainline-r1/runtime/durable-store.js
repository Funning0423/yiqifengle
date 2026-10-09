'use strict';

function clone(x) {
  return x === undefined ? undefined : JSON.parse(JSON.stringify(x));
}
function serial(x) {
  return x === undefined ? 'undefined' : JSON.stringify(x);
}
function promise(x) {
  if (x && typeof x.then === 'function') {
    if (typeof x.catch === 'function') x.catch(function () {});
    return true;
  }
  return false;
}
function decode(x) {
  return x === null || x === undefined || x === '' ? null : typeof x === 'string' ? JSON.parse(x) : clone(x);
}
function Store(platform, key, validate) {
  this.platform = platform;
  this.key = key;
  this.validate = validate;
  this.raw = undefined;
  this.value = null;
  this.readOnly = false;
  this.error = null;
  try {
    var raw = platform.load(key);
    if (promise(raw)) throw Error('async-storage');
    this.raw = clone(raw);
    this.value = decode(raw);
    if (this.value !== null && validate) validate(this.value);
  } catch (e) {
    this.readOnly = true;
    this.error = {
      code: 'preserved-data-error',
      key: key,
      detail: String(e.message || e),
      retryable: false
    };
  }
}
Store.prototype.current = function () {
  if (this.readOnly) return false;
  try {
    var raw = this.platform.load(this.key);
    if (promise(raw)) throw Error('async-read');
    if (serial(raw) !== serial(this.raw)) {
      this.readOnly = true;
      this.error = {
        code: 'concurrent-write',
        key: this.key,
        retryable: false
      };
      return false;
    }
    return true;
  } catch (e) {
    this.readOnly = true;
    this.error = {
      code: 'unverifiable-storage',
      key: this.key,
      detail: String(e.message || e),
      retryable: false
    };
    return false;
  }
};
Store.prototype.write = function (next) {
  if (!this.current()) return false;
  try {
    if (this.validate) this.validate(next);
    var result;
    try {
      result = this.platform.save(this.key, clone(next));
    } catch (e) {}
    if (promise(result)) throw Error('async-write');
    var raw = this.platform.load(this.key);
    if (promise(raw)) throw Error('async-readback');
    if (serial(decode(raw)) === serial(next)) {
      this.raw = clone(raw);
      this.value = clone(next);
      this.error = null;
      return true;
    }
    if (serial(raw) === serial(this.raw)) {
      this.error = {
        code: 'save-failed',
        key: this.key,
        retryable: true
      };
      return false;
    }
    this.readOnly = true;
    this.error = {
      code: 'unexpected-stored-data',
      key: this.key,
      retryable: false
    };
    return false;
  } catch (e) {
    this.readOnly = true;
    this.error = {
      code: 'unverifiable-storage',
      key: this.key,
      detail: String(e.message || e),
      retryable: false
    };
    return false;
  }
};
Store.clone = clone;
Store.serial = serial;
module.exports = Store;
