"use strict";

// Creator 3.8.8 的原始 worker；补丁只补齐初始化窗口内漏掉的注册。
const original = require("./asset-db-manager.ccc");
const manager = original.assetDBManager;
const originalInit = manager.init;

manager.init = async function (...args) {
  const result = await originalInit.apply(this, args);
  // 原 init 已挂上 enable 监听器。重新对齐此前漏掉的事件，且不重复注册。
  const registry = this.assetHandlerManager;
  for (const info of Object.values(this.pluginManager.packageRegisterInfo)) {
    if (!info.enable || !Array.isArray(info.assetHandlerInfos)) continue;
    const missing = info.assetHandlerInfos.filter(
      (handler) => !registry.name2registerInfo[handler.name]
    );
    if (missing.length) {
      registry.register(info.name, missing, info.internal);
      console.log(
        `[asset-db-init-fix] reconciled ${info.name}: ${missing.length} missing handlers before importing`
      );
    }
  }
  return result;
};

module.exports = original;
