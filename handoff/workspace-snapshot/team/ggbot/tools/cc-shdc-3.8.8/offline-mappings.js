"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// ../../../opt/cocos/CocosCreator-3.8.8-win/resources/resources/3d/engine/editor/exports/offline-mappings.ts
var offline_mappings_exports = {};
__export(offline_mappings_exports, {
  GetTypeSize: () => GetTypeSize,
  RenderPriority: () => RenderPriority,
  Sampler: () => Sampler,
  SamplerInfo: () => SamplerInfo,
  SetIndex: () => SetIndex,
  effectStructure: () => effectStructure,
  formatMap: () => formatMap,
  getDescriptorType: () => getDescriptorType,
  getFormat: () => getFormat,
  getMemoryAccessFlag: () => getMemoryAccessFlag,
  getShaderStage: () => getShaderStage,
  isNormalized: () => isNormalized,
  isPaddedMatrix: () => isPaddedMatrix,
  isSampler: () => isSampler,
  murmurhash2_32_gc: () => murmurhash2_32_gc,
  passParams: () => passParams,
  typeMap: () => typeMap
});
module.exports = __toCommonJS(offline_mappings_exports);

// om/gc-object.ts
var GCObject = class {
  constructor() {
  }
};

// ../../../opt/cocos/CocosCreator-3.8.8-win/resources/resources/3d/engine/cocos/gfx/base/define.ts
var Format = /* @__PURE__ */ ((Format2) => {
  Format2[Format2["UNKNOWN"] = 0] = "UNKNOWN";
  Format2[Format2["A8"] = 1] = "A8";
  Format2[Format2["L8"] = 2] = "L8";
  Format2[Format2["LA8"] = 3] = "LA8";
  Format2[Format2["R8"] = 4] = "R8";
  Format2[Format2["R8SN"] = 5] = "R8SN";
  Format2[Format2["R8UI"] = 6] = "R8UI";
  Format2[Format2["R8I"] = 7] = "R8I";
  Format2[Format2["R16F"] = 8] = "R16F";
  Format2[Format2["R16UI"] = 9] = "R16UI";
  Format2[Format2["R16I"] = 10] = "R16I";
  Format2[Format2["R32F"] = 11] = "R32F";
  Format2[Format2["R32UI"] = 12] = "R32UI";
  Format2[Format2["R32I"] = 13] = "R32I";
  Format2[Format2["RG8"] = 14] = "RG8";
  Format2[Format2["RG8SN"] = 15] = "RG8SN";
  Format2[Format2["RG8UI"] = 16] = "RG8UI";
  Format2[Format2["RG8I"] = 17] = "RG8I";
  Format2[Format2["RG16F"] = 18] = "RG16F";
  Format2[Format2["RG16UI"] = 19] = "RG16UI";
  Format2[Format2["RG16I"] = 20] = "RG16I";
  Format2[Format2["RG32F"] = 21] = "RG32F";
  Format2[Format2["RG32UI"] = 22] = "RG32UI";
  Format2[Format2["RG32I"] = 23] = "RG32I";
  Format2[Format2["RGB8"] = 24] = "RGB8";
  Format2[Format2["SRGB8"] = 25] = "SRGB8";
  Format2[Format2["RGB8SN"] = 26] = "RGB8SN";
  Format2[Format2["RGB8UI"] = 27] = "RGB8UI";
  Format2[Format2["RGB8I"] = 28] = "RGB8I";
  Format2[Format2["RGB16F"] = 29] = "RGB16F";
  Format2[Format2["RGB16UI"] = 30] = "RGB16UI";
  Format2[Format2["RGB16I"] = 31] = "RGB16I";
  Format2[Format2["RGB32F"] = 32] = "RGB32F";
  Format2[Format2["RGB32UI"] = 33] = "RGB32UI";
  Format2[Format2["RGB32I"] = 34] = "RGB32I";
  Format2[Format2["RGBA8"] = 35] = "RGBA8";
  Format2[Format2["BGRA8"] = 36] = "BGRA8";
  Format2[Format2["SRGB8_A8"] = 37] = "SRGB8_A8";
  Format2[Format2["RGBA8SN"] = 38] = "RGBA8SN";
  Format2[Format2["RGBA8UI"] = 39] = "RGBA8UI";
  Format2[Format2["RGBA8I"] = 40] = "RGBA8I";
  Format2[Format2["RGBA16F"] = 41] = "RGBA16F";
  Format2[Format2["RGBA16UI"] = 42] = "RGBA16UI";
  Format2[Format2["RGBA16I"] = 43] = "RGBA16I";
  Format2[Format2["RGBA32F"] = 44] = "RGBA32F";
  Format2[Format2["RGBA32UI"] = 45] = "RGBA32UI";
  Format2[Format2["RGBA32I"] = 46] = "RGBA32I";
  Format2[Format2["R5G6B5"] = 47] = "R5G6B5";
  Format2[Format2["R11G11B10F"] = 48] = "R11G11B10F";
  Format2[Format2["RGB5A1"] = 49] = "RGB5A1";
  Format2[Format2["RGBA4"] = 50] = "RGBA4";
  Format2[Format2["RGB10A2"] = 51] = "RGB10A2";
  Format2[Format2["RGB10A2UI"] = 52] = "RGB10A2UI";
  Format2[Format2["RGB9E5"] = 53] = "RGB9E5";
  Format2[Format2["DEPTH"] = 54] = "DEPTH";
  Format2[Format2["DEPTH_STENCIL"] = 55] = "DEPTH_STENCIL";
  Format2[Format2["BC1"] = 56] = "BC1";
  Format2[Format2["BC1_ALPHA"] = 57] = "BC1_ALPHA";
  Format2[Format2["BC1_SRGB"] = 58] = "BC1_SRGB";
  Format2[Format2["BC1_SRGB_ALPHA"] = 59] = "BC1_SRGB_ALPHA";
  Format2[Format2["BC2"] = 60] = "BC2";
  Format2[Format2["BC2_SRGB"] = 61] = "BC2_SRGB";
  Format2[Format2["BC3"] = 62] = "BC3";
  Format2[Format2["BC3_SRGB"] = 63] = "BC3_SRGB";
  Format2[Format2["BC4"] = 64] = "BC4";
  Format2[Format2["BC4_SNORM"] = 65] = "BC4_SNORM";
  Format2[Format2["BC5"] = 66] = "BC5";
  Format2[Format2["BC5_SNORM"] = 67] = "BC5_SNORM";
  Format2[Format2["BC6H_UF16"] = 68] = "BC6H_UF16";
  Format2[Format2["BC6H_SF16"] = 69] = "BC6H_SF16";
  Format2[Format2["BC7"] = 70] = "BC7";
  Format2[Format2["BC7_SRGB"] = 71] = "BC7_SRGB";
  Format2[Format2["ETC_RGB8"] = 72] = "ETC_RGB8";
  Format2[Format2["ETC2_RGB8"] = 73] = "ETC2_RGB8";
  Format2[Format2["ETC2_SRGB8"] = 74] = "ETC2_SRGB8";
  Format2[Format2["ETC2_RGB8_A1"] = 75] = "ETC2_RGB8_A1";
  Format2[Format2["ETC2_SRGB8_A1"] = 76] = "ETC2_SRGB8_A1";
  Format2[Format2["ETC2_RGBA8"] = 77] = "ETC2_RGBA8";
  Format2[Format2["ETC2_SRGB8_A8"] = 78] = "ETC2_SRGB8_A8";
  Format2[Format2["EAC_R11"] = 79] = "EAC_R11";
  Format2[Format2["EAC_R11SN"] = 80] = "EAC_R11SN";
  Format2[Format2["EAC_RG11"] = 81] = "EAC_RG11";
  Format2[Format2["EAC_RG11SN"] = 82] = "EAC_RG11SN";
  Format2[Format2["PVRTC_RGB2"] = 83] = "PVRTC_RGB2";
  Format2[Format2["PVRTC_RGBA2"] = 84] = "PVRTC_RGBA2";
  Format2[Format2["PVRTC_RGB4"] = 85] = "PVRTC_RGB4";
  Format2[Format2["PVRTC_RGBA4"] = 86] = "PVRTC_RGBA4";
  Format2[Format2["PVRTC2_2BPP"] = 87] = "PVRTC2_2BPP";
  Format2[Format2["PVRTC2_4BPP"] = 88] = "PVRTC2_4BPP";
  Format2[Format2["ASTC_RGBA_4X4"] = 89] = "ASTC_RGBA_4X4";
  Format2[Format2["ASTC_RGBA_5X4"] = 90] = "ASTC_RGBA_5X4";
  Format2[Format2["ASTC_RGBA_5X5"] = 91] = "ASTC_RGBA_5X5";
  Format2[Format2["ASTC_RGBA_6X5"] = 92] = "ASTC_RGBA_6X5";
  Format2[Format2["ASTC_RGBA_6X6"] = 93] = "ASTC_RGBA_6X6";
  Format2[Format2["ASTC_RGBA_8X5"] = 94] = "ASTC_RGBA_8X5";
  Format2[Format2["ASTC_RGBA_8X6"] = 95] = "ASTC_RGBA_8X6";
  Format2[Format2["ASTC_RGBA_8X8"] = 96] = "ASTC_RGBA_8X8";
  Format2[Format2["ASTC_RGBA_10X5"] = 97] = "ASTC_RGBA_10X5";
  Format2[Format2["ASTC_RGBA_10X6"] = 98] = "ASTC_RGBA_10X6";
  Format2[Format2["ASTC_RGBA_10X8"] = 99] = "ASTC_RGBA_10X8";
  Format2[Format2["ASTC_RGBA_10X10"] = 100] = "ASTC_RGBA_10X10";
  Format2[Format2["ASTC_RGBA_12X10"] = 101] = "ASTC_RGBA_12X10";
  Format2[Format2["ASTC_RGBA_12X12"] = 102] = "ASTC_RGBA_12X12";
  Format2[Format2["ASTC_SRGBA_4X4"] = 103] = "ASTC_SRGBA_4X4";
  Format2[Format2["ASTC_SRGBA_5X4"] = 104] = "ASTC_SRGBA_5X4";
  Format2[Format2["ASTC_SRGBA_5X5"] = 105] = "ASTC_SRGBA_5X5";
  Format2[Format2["ASTC_SRGBA_6X5"] = 106] = "ASTC_SRGBA_6X5";
  Format2[Format2["ASTC_SRGBA_6X6"] = 107] = "ASTC_SRGBA_6X6";
  Format2[Format2["ASTC_SRGBA_8X5"] = 108] = "ASTC_SRGBA_8X5";
  Format2[Format2["ASTC_SRGBA_8X6"] = 109] = "ASTC_SRGBA_8X6";
  Format2[Format2["ASTC_SRGBA_8X8"] = 110] = "ASTC_SRGBA_8X8";
  Format2[Format2["ASTC_SRGBA_10X5"] = 111] = "ASTC_SRGBA_10X5";
  Format2[Format2["ASTC_SRGBA_10X6"] = 112] = "ASTC_SRGBA_10X6";
  Format2[Format2["ASTC_SRGBA_10X8"] = 113] = "ASTC_SRGBA_10X8";
  Format2[Format2["ASTC_SRGBA_10X10"] = 114] = "ASTC_SRGBA_10X10";
  Format2[Format2["ASTC_SRGBA_12X10"] = 115] = "ASTC_SRGBA_12X10";
  Format2[Format2["ASTC_SRGBA_12X12"] = 116] = "ASTC_SRGBA_12X12";
  Format2[Format2["COUNT"] = 117] = "COUNT";
  return Format2;
})(Format || {});
var ShaderStageFlagBit = /* @__PURE__ */ ((ShaderStageFlagBit2) => {
  ShaderStageFlagBit2[ShaderStageFlagBit2["NONE"] = 0] = "NONE";
  ShaderStageFlagBit2[ShaderStageFlagBit2["VERTEX"] = 1] = "VERTEX";
  ShaderStageFlagBit2[ShaderStageFlagBit2["CONTROL"] = 2] = "CONTROL";
  ShaderStageFlagBit2[ShaderStageFlagBit2["EVALUATION"] = 4] = "EVALUATION";
  ShaderStageFlagBit2[ShaderStageFlagBit2["GEOMETRY"] = 8] = "GEOMETRY";
  ShaderStageFlagBit2[ShaderStageFlagBit2["FRAGMENT"] = 16] = "FRAGMENT";
  ShaderStageFlagBit2[ShaderStageFlagBit2["COMPUTE"] = 32] = "COMPUTE";
  ShaderStageFlagBit2[ShaderStageFlagBit2["ALL"] = 63] = "ALL";
  return ShaderStageFlagBit2;
})(ShaderStageFlagBit || {});
var DescriptorType = /* @__PURE__ */ ((DescriptorType2) => {
  DescriptorType2[DescriptorType2["UNKNOWN"] = 0] = "UNKNOWN";
  DescriptorType2[DescriptorType2["UNIFORM_BUFFER"] = 1] = "UNIFORM_BUFFER";
  DescriptorType2[DescriptorType2["DYNAMIC_UNIFORM_BUFFER"] = 2] = "DYNAMIC_UNIFORM_BUFFER";
  DescriptorType2[DescriptorType2["STORAGE_BUFFER"] = 4] = "STORAGE_BUFFER";
  DescriptorType2[DescriptorType2["DYNAMIC_STORAGE_BUFFER"] = 8] = "DYNAMIC_STORAGE_BUFFER";
  DescriptorType2[DescriptorType2["SAMPLER_TEXTURE"] = 16] = "SAMPLER_TEXTURE";
  DescriptorType2[DescriptorType2["SAMPLER"] = 32] = "SAMPLER";
  DescriptorType2[DescriptorType2["TEXTURE"] = 64] = "TEXTURE";
  DescriptorType2[DescriptorType2["STORAGE_IMAGE"] = 128] = "STORAGE_IMAGE";
  DescriptorType2[DescriptorType2["INPUT_ATTACHMENT"] = 256] = "INPUT_ATTACHMENT";
  return DescriptorType2;
})(DescriptorType || {});
var SamplerInfo = class {
  // to make sure all usages must be an instance of this exact class, not assembled from plain object
  constructor(minFilter = 2 /* LINEAR */, magFilter = 2 /* LINEAR */, mipFilter = 0 /* NONE */, addressU = 0 /* WRAP */, addressV = 0 /* WRAP */, addressW = 0 /* WRAP */, maxAnisotropy = 0, cmpFunc = 7 /* ALWAYS */) {
    this.minFilter = minFilter;
    this.magFilter = magFilter;
    this.mipFilter = mipFilter;
    this.addressU = addressU;
    this.addressV = addressV;
    this.addressW = addressW;
    this.maxAnisotropy = maxAnisotropy;
    this.cmpFunc = cmpFunc;
  }
  copy(info) {
    this.minFilter = info.minFilter;
    this.magFilter = info.magFilter;
    this.mipFilter = info.mipFilter;
    this.addressU = info.addressU;
    this.addressV = info.addressV;
    this.addressW = info.addressW;
    this.maxAnisotropy = info.maxAnisotropy;
    this.cmpFunc = info.cmpFunc;
    return this;
  }
};
var FormatInfo = class {
  // to make sure all usages must be an instance of this exact class, not assembled from plain object
  constructor(name = "", size = 0, count = 0, type = 0 /* NONE */, hasAlpha = false, hasDepth = false, hasStencil = false, isCompressed = false) {
    this.name = name;
    this.size = size;
    this.count = count;
    this.type = type;
    this.hasAlpha = hasAlpha;
    this.hasDepth = hasDepth;
    this.hasStencil = hasStencil;
    this.isCompressed = isCompressed;
  }
  copy(info) {
    this.name = info.name;
    this.size = info.size;
    this.count = info.count;
    this.type = info.type;
    this.hasAlpha = info.hasAlpha;
    this.hasDepth = info.hasDepth;
    this.hasStencil = info.hasStencil;
    this.isCompressed = info.isCompressed;
    return this;
  }
};
var GFXObject = class _GFXObject extends GCObject {
  constructor(objectType) {
    super();
    /** @mangle */
    this._objectType = 0 /* UNKNOWN */;
    /** @mangle */
    this._objectID = 0;
    /** @mangle */
    this._typedID = 0;
    this._objectType = objectType;
    this._objectID = _GFXObject._idTable[0 /* UNKNOWN */]++;
    this._typedID = _GFXObject._idTable[objectType]++;
  }
  get objectType() {
    return this._objectType;
  }
  get objectID() {
    return this._objectID;
  }
  get typedID() {
    return this._typedID;
  }
  static {
    this._idTable = Array(19 /* COUNT */).fill(1 << 16);
  }
};
function createFormatInfo(name, size, count, type, hasAlpha, hasDepth, hasStencil, isCompressed) {
  return new FormatInfo(name, size, count, type, hasAlpha, hasDepth, hasStencil, isCompressed);
}
function createFormatInfo_ASTC_SRGBA(nameSuffix) {
  return new FormatInfo(`ASTC_SRGBA_${nameSuffix}`, 1, 4, 1 /* UNORM */, true, false, false, true);
}
function createFormatInfo_ASTC_RGBA(nameSuffix) {
  return new FormatInfo(`ASTC_RGBA_${nameSuffix}`, 1, 4, 1 /* UNORM */, true, false, false, true);
}
var FormatInfos = Object.freeze([
  createFormatInfo("UNKNOWN"),
  createFormatInfo("A8", 1, 1, 1 /* UNORM */, true),
  createFormatInfo("L8", 1, 1, 1 /* UNORM */),
  createFormatInfo("LA8", 1, 2, 1 /* UNORM */, true),
  createFormatInfo("R8", 1, 1, 1 /* UNORM */),
  createFormatInfo("R8SN", 1, 1, 2 /* SNORM */),
  createFormatInfo("R8UI", 1, 1, 3 /* UINT */),
  createFormatInfo("R8I", 1, 1, 4 /* INT */),
  createFormatInfo("R16F", 2, 1, 6 /* FLOAT */),
  createFormatInfo("R16UI", 2, 1, 3 /* UINT */),
  createFormatInfo("R16I", 2, 1, 4 /* INT */),
  createFormatInfo("R32F", 4, 1, 6 /* FLOAT */),
  createFormatInfo("R32UI", 4, 1, 3 /* UINT */),
  createFormatInfo("R32I", 4, 1, 4 /* INT */),
  createFormatInfo("RG8", 2, 2, 1 /* UNORM */),
  createFormatInfo("RG8SN", 2, 2, 2 /* SNORM */),
  createFormatInfo("RG8UI", 2, 2, 3 /* UINT */),
  createFormatInfo("RG8I", 2, 2, 4 /* INT */),
  createFormatInfo("RG16F", 4, 2, 6 /* FLOAT */),
  createFormatInfo("RG16UI", 4, 2, 3 /* UINT */),
  createFormatInfo("RG16I", 4, 2, 4 /* INT */),
  createFormatInfo("RG32F", 8, 2, 6 /* FLOAT */),
  createFormatInfo("RG32UI", 8, 2, 3 /* UINT */),
  createFormatInfo("RG32I", 8, 2, 4 /* INT */),
  createFormatInfo("RGB8", 3, 3, 1 /* UNORM */),
  createFormatInfo("SRGB8", 3, 3, 1 /* UNORM */),
  createFormatInfo("RGB8SN", 3, 3, 2 /* SNORM */),
  createFormatInfo("RGB8UI", 3, 3, 3 /* UINT */),
  createFormatInfo("RGB8I", 3, 3, 4 /* INT */),
  createFormatInfo("RGB16F", 6, 3, 6 /* FLOAT */),
  createFormatInfo("RGB16UI", 6, 3, 3 /* UINT */),
  createFormatInfo("RGB16I", 6, 3, 4 /* INT */),
  createFormatInfo("RGB32F", 12, 3, 6 /* FLOAT */),
  createFormatInfo("RGB32UI", 12, 3, 3 /* UINT */),
  createFormatInfo("RGB32I", 12, 3, 4 /* INT */),
  createFormatInfo("RGBA8", 4, 4, 1 /* UNORM */, true),
  createFormatInfo("BGRA8", 4, 4, 1 /* UNORM */, true),
  createFormatInfo("SRGB8_A8", 4, 4, 1 /* UNORM */, true),
  createFormatInfo("RGBA8SN", 4, 4, 2 /* SNORM */, true),
  createFormatInfo("RGBA8UI", 4, 4, 3 /* UINT */, true),
  createFormatInfo("RGBA8I", 4, 4, 4 /* INT */, true),
  createFormatInfo("RGBA16F", 8, 4, 6 /* FLOAT */, true),
  createFormatInfo("RGBA16UI", 8, 4, 3 /* UINT */, true),
  createFormatInfo("RGBA16I", 8, 4, 4 /* INT */, true),
  createFormatInfo("RGBA32F", 16, 4, 6 /* FLOAT */, true),
  createFormatInfo("RGBA32UI", 16, 4, 3 /* UINT */, true),
  createFormatInfo("RGBA32I", 16, 4, 4 /* INT */, true),
  createFormatInfo("R5G6B5", 2, 3, 1 /* UNORM */),
  createFormatInfo("R11G11B10F", 4, 3, 6 /* FLOAT */),
  createFormatInfo("RGB5A1", 2, 4, 1 /* UNORM */, true),
  createFormatInfo("RGBA4", 2, 4, 1 /* UNORM */, true),
  createFormatInfo("RGB10A2", 2, 4, 1 /* UNORM */, true),
  createFormatInfo("RGB10A2UI", 2, 4, 3 /* UINT */, true),
  createFormatInfo("RGB9E5", 2, 4, 6 /* FLOAT */, true),
  createFormatInfo("DEPTH", 4, 1, 6 /* FLOAT */, false, true),
  createFormatInfo("DEPTH_STENCIL", 5, 2, 6 /* FLOAT */, false, true, true),
  createFormatInfo("BC1", 1, 3, 1 /* UNORM */, false, false, false, true),
  createFormatInfo("BC1_ALPHA", 1, 4, 1 /* UNORM */, true, false, false, true),
  createFormatInfo("BC1_SRGB", 1, 3, 1 /* UNORM */, false, false, false, true),
  createFormatInfo("BC1_SRGB_ALPHA", 1, 4, 1 /* UNORM */, true, false, false, true),
  createFormatInfo("BC2", 1, 4, 1 /* UNORM */, true, false, false, true),
  createFormatInfo("BC2_SRGB", 1, 4, 1 /* UNORM */, true, false, false, true),
  createFormatInfo("BC3", 1, 4, 1 /* UNORM */, true, false, false, true),
  createFormatInfo("BC3_SRGB", 1, 4, 1 /* UNORM */, true, false, false, true),
  createFormatInfo("BC4", 1, 1, 1 /* UNORM */, false, false, false, true),
  createFormatInfo("BC4_SNORM", 1, 1, 2 /* SNORM */, false, false, false, true),
  createFormatInfo("BC5", 1, 2, 1 /* UNORM */, false, false, false, true),
  createFormatInfo("BC5_SNORM", 1, 2, 2 /* SNORM */, false, false, false, true),
  createFormatInfo("BC6H_UF16", 1, 3, 5 /* UFLOAT */, false, false, false, true),
  createFormatInfo("BC6H_SF16", 1, 3, 6 /* FLOAT */, false, false, false, true),
  createFormatInfo("BC7", 1, 4, 1 /* UNORM */, true, false, false, true),
  createFormatInfo("BC7_SRGB", 1, 4, 1 /* UNORM */, true, false, false, true),
  createFormatInfo("ETC_RGB8", 1, 3, 1 /* UNORM */, false, false, false, true),
  createFormatInfo("ETC2_RGB8", 1, 3, 1 /* UNORM */, false, false, false, true),
  createFormatInfo("ETC2_SRGB8", 1, 3, 1 /* UNORM */, false, false, false, true),
  createFormatInfo("ETC2_RGB8_A1", 1, 4, 1 /* UNORM */, true, false, false, true),
  createFormatInfo("ETC2_SRGB8_A1", 1, 4, 1 /* UNORM */, true, false, false, true),
  createFormatInfo("ETC2_RGBA8", 2, 4, 1 /* UNORM */, true, false, false, true),
  createFormatInfo("ETC2_SRGB8_A8", 2, 4, 1 /* UNORM */, true, false, false, true),
  createFormatInfo("EAC_R11", 1, 1, 1 /* UNORM */, false, false, false, true),
  createFormatInfo("EAC_R11SN", 1, 1, 2 /* SNORM */, false, false, false, true),
  createFormatInfo("EAC_RG11", 2, 2, 1 /* UNORM */, false, false, false, true),
  createFormatInfo("EAC_RG11SN", 2, 2, 2 /* SNORM */, false, false, false, true),
  createFormatInfo("PVRTC_RGB2", 2, 3, 1 /* UNORM */, false, false, false, true),
  createFormatInfo("PVRTC_RGBA2", 2, 4, 1 /* UNORM */, true, false, false, true),
  createFormatInfo("PVRTC_RGB4", 2, 3, 1 /* UNORM */, false, false, false, true),
  createFormatInfo("PVRTC_RGBA4", 2, 4, 1 /* UNORM */, true, false, false, true),
  createFormatInfo("PVRTC2_2BPP", 2, 4, 1 /* UNORM */, true, false, false, true),
  createFormatInfo("PVRTC2_4BPP", 2, 4, 1 /* UNORM */, true, false, false, true),
  createFormatInfo_ASTC_RGBA("4x4"),
  createFormatInfo_ASTC_RGBA("5x4"),
  createFormatInfo_ASTC_RGBA("5x5"),
  createFormatInfo_ASTC_RGBA("6x5"),
  createFormatInfo_ASTC_RGBA("6x6"),
  createFormatInfo_ASTC_RGBA("8x5"),
  createFormatInfo_ASTC_RGBA("8x6"),
  createFormatInfo_ASTC_RGBA("8x8"),
  createFormatInfo_ASTC_RGBA("10x5"),
  createFormatInfo_ASTC_RGBA("10x6"),
  createFormatInfo_ASTC_RGBA("10x8"),
  createFormatInfo_ASTC_RGBA("10x10"),
  createFormatInfo_ASTC_RGBA("12x10"),
  createFormatInfo_ASTC_RGBA("12x12"),
  createFormatInfo_ASTC_SRGBA("4x4"),
  createFormatInfo_ASTC_SRGBA("5x4"),
  createFormatInfo_ASTC_SRGBA("5x5"),
  createFormatInfo_ASTC_SRGBA("6x5"),
  createFormatInfo_ASTC_SRGBA("6x6"),
  createFormatInfo_ASTC_SRGBA("8x5"),
  createFormatInfo_ASTC_SRGBA("8x6"),
  createFormatInfo_ASTC_SRGBA("8x8"),
  createFormatInfo_ASTC_SRGBA("10x5"),
  createFormatInfo_ASTC_SRGBA("10x6"),
  createFormatInfo_ASTC_SRGBA("10x8"),
  createFormatInfo_ASTC_SRGBA("10x10"),
  createFormatInfo_ASTC_SRGBA("12x10"),
  createFormatInfo_ASTC_SRGBA("12x12")
]);
var DESCRIPTOR_BUFFER_TYPE = 1 /* UNIFORM_BUFFER */ | 2 /* DYNAMIC_UNIFORM_BUFFER */ | 4 /* STORAGE_BUFFER */ | 8 /* DYNAMIC_STORAGE_BUFFER */;
var DESCRIPTOR_SAMPLER_TYPE = 16 /* SAMPLER_TEXTURE */ | 32 /* SAMPLER */ | 64 /* TEXTURE */ | 128 /* STORAGE_IMAGE */ | 256 /* INPUT_ATTACHMENT */;
var DESCRIPTOR_DYNAMIC_TYPE = 8 /* DYNAMIC_STORAGE_BUFFER */ | 2 /* DYNAMIC_UNIFORM_BUFFER */;
var DESCRIPTOR_STORAGE_BUFFER_TYPE = 4 /* STORAGE_BUFFER */ | 8 /* DYNAMIC_STORAGE_BUFFER */;
var _type2size = [
  0,
  // UNKNOWN
  4,
  // BOOL
  8,
  // BOOL2
  12,
  // BOOL3
  16,
  // BOOL4
  4,
  // INT
  8,
  // INT2
  12,
  // INT3
  16,
  // INT4
  4,
  // UINT
  8,
  // UINT2
  12,
  // UINT3
  16,
  // UINT4
  4,
  // FLOAT
  8,
  // FLOAT2
  12,
  // FLOAT3
  16,
  // FLOAT4
  16,
  // MAT2
  24,
  // MAT2X3
  32,
  // MAT2X4
  24,
  // MAT3X2
  36,
  // MAT3
  48,
  // MAT3X4
  32,
  // MAT4X2
  48,
  // MAT4X3
  64,
  // MAT4
  4,
  // SAMPLER1D
  4,
  // SAMPLER1D_ARRAY
  4,
  // SAMPLER2D
  4,
  // SAMPLER2D_ARRAY
  4,
  // SAMPLER3D
  4
  // SAMPLER_CUBE
];
function GetTypeSize(type) {
  return _type2size[type] || 0;
}

// ../../../opt/cocos/CocosCreator-3.8.8-win/resources/resources/3d/engine/cocos/gfx/base/states/sampler.ts
var Sampler = class extends GFXObject {
  constructor(info, hash) {
    super(6 /* SAMPLER */);
    /** @mangle */
    this._info = new SamplerInfo();
    /** @mangle */
    this._hash = 0;
    this._info.copy(info);
    this._hash = hash;
  }
  get info() {
    return this._info;
  }
  get hash() {
    return this._hash;
  }
  static computeHash(info) {
    let hash = info.minFilter;
    hash |= info.magFilter << 2;
    hash |= info.mipFilter << 4;
    hash |= info.addressU << 6;
    hash |= info.addressV << 8;
    hash |= info.addressW << 10;
    hash |= Math.min(info.maxAnisotropy, 16) << 12;
    hash |= info.cmpFunc << 17;
    return hash;
  }
  static unpackFromHash(hash) {
    const info = new SamplerInfo();
    info.minFilter = hash & 3;
    info.magFilter = hash >> 2 & 3;
    info.mipFilter = hash >> 4 & 3;
    info.addressU = hash >> 6 & 3;
    info.addressV = hash >> 8 & 3;
    info.addressW = hash >> 10 & 3;
    info.maxAnisotropy = hash >> 12 & 31;
    info.cmpFunc = hash >> 17 & 7;
    return info;
  }
};

// om/rendering-define.ts
var RenderPassStage = /* @__PURE__ */ ((RenderPassStage2) => {
  RenderPassStage2[RenderPassStage2["DEFAULT"] = 100] = "DEFAULT";
  RenderPassStage2[RenderPassStage2["UI"] = 200] = "UI";
  return RenderPassStage2;
})(RenderPassStage || {});
var RenderPriority = /* @__PURE__ */ ((RenderPriority2) => {
  RenderPriority2[RenderPriority2["MIN"] = 0] = "MIN";
  RenderPriority2[RenderPriority2["MAX"] = 255] = "MAX";
  RenderPriority2[RenderPriority2["DEFAULT"] = 128] = "DEFAULT";
  return RenderPriority2;
})(RenderPriority || {});
var SetIndex = /* @__PURE__ */ ((SetIndex2) => {
  SetIndex2[SetIndex2["GLOBAL"] = 0] = "GLOBAL";
  SetIndex2[SetIndex2["MATERIAL"] = 1] = "MATERIAL";
  SetIndex2[SetIndex2["LOCAL"] = 2] = "LOCAL";
  SetIndex2[SetIndex2["COUNT"] = 3] = "COUNT";
  return SetIndex2;
})(SetIndex || {});

// ../../../opt/cocos/CocosCreator-3.8.8-win/resources/resources/3d/engine/cocos/core/algorithm/murmurhash2_gc.ts
var getUint8ForString = String.prototype.charCodeAt;
function getUint8ForArray(idx) {
  return this[idx];
}
function murmurhash2_32_gc(input, seed) {
  let l = input.length;
  let h = seed ^ l;
  let i = 0;
  const getUint8 = typeof input === "string" ? getUint8ForString : getUint8ForArray;
  while (l >= 4) {
    let k = getUint8.call(input, i) & 255 | (getUint8.call(input, ++i) & 255) << 8 | (getUint8.call(input, ++i) & 255) << 16 | (getUint8.call(input, ++i) & 255) << 24;
    k = (k & 65535) * 1540483477 + (((k >>> 16) * 1540483477 & 65535) << 16);
    k ^= k >>> 24;
    k = (k & 65535) * 1540483477 + (((k >>> 16) * 1540483477 & 65535) << 16);
    h = (h & 65535) * 1540483477 + (((h >>> 16) * 1540483477 & 65535) << 16) ^ k;
    l -= 4;
    ++i;
  }
  switch (l) {
    // Don't break in case 3 and case 2.
    case 3:
      h ^= (getUint8.call(input, i + 2) & 255) << 16;
    // eslint-disable-next-line no-fallthrough
    case 2:
      h ^= (getUint8.call(input, i + 1) & 255) << 8;
    // eslint-disable-next-line no-fallthrough
    case 1:
      h ^= getUint8.call(input, i) & 255;
      h = (h & 65535) * 1540483477 + (((h >>> 16) * 1540483477 & 65535) << 16);
      break;
    default:
      break;
  }
  h ^= h >>> 13;
  h = (h & 65535) * 1540483477 + (((h >>> 16) * 1540483477 & 65535) << 16);
  h ^= h >>> 15;
  return h >>> 0;
}

// ../../../opt/cocos/CocosCreator-3.8.8-win/resources/resources/3d/engine/editor/exports/offline-mappings.ts
var typeMap = {};
typeMap[typeMap.bool = 1 /* BOOL */] = "bool";
typeMap[typeMap.bvec2 = 2 /* BOOL2 */] = "bvec2";
typeMap[typeMap.bvec3 = 3 /* BOOL3 */] = "bvec3";
typeMap[typeMap.bvec4 = 4 /* BOOL4 */] = "bvec4";
typeMap[typeMap.int = 5 /* INT */] = "int";
typeMap[typeMap.ivec2 = 6 /* INT2 */] = "ivec2";
typeMap[typeMap.ivec3 = 7 /* INT3 */] = "ivec3";
typeMap[typeMap.ivec4 = 8 /* INT4 */] = "ivec4";
typeMap[typeMap.uint = 9 /* UINT */] = "uint";
typeMap[typeMap.uvec2 = 10 /* UINT2 */] = "uvec2";
typeMap[typeMap.uvec3 = 11 /* UINT3 */] = "uvec3";
typeMap[typeMap.uvec4 = 12 /* UINT4 */] = "uvec4";
typeMap[typeMap.float = 13 /* FLOAT */] = "float";
typeMap[typeMap.vec2 = 14 /* FLOAT2 */] = "vec2";
typeMap[typeMap.vec3 = 15 /* FLOAT3 */] = "vec3";
typeMap[typeMap.vec4 = 16 /* FLOAT4 */] = "vec4";
typeMap[typeMap.mat2 = 17 /* MAT2 */] = "mat2";
typeMap[typeMap.mat3 = 21 /* MAT3 */] = "mat3";
typeMap[typeMap.mat4 = 25 /* MAT4 */] = "mat4";
typeMap[typeMap.mat2x3 = 18 /* MAT2X3 */] = "mat2x3";
typeMap[typeMap.mat2x4 = 19 /* MAT2X4 */] = "mat2x4";
typeMap[typeMap.mat3x2 = 20 /* MAT3X2 */] = "mat3x2";
typeMap[typeMap.mat3x4 = 22 /* MAT3X4 */] = "mat3x4";
typeMap[typeMap.mat4x2 = 23 /* MAT4X2 */] = "mat4x2";
typeMap[typeMap.mat4x3 = 24 /* MAT4X3 */] = "mat4x3";
typeMap[typeMap.sampler1D = 26 /* SAMPLER1D */] = "sampler1D";
typeMap[typeMap.sampler1DArray = 27 /* SAMPLER1D_ARRAY */] = "sampler1DArray";
typeMap[typeMap.sampler2D = 28 /* SAMPLER2D */] = "sampler2D";
typeMap[typeMap.sampler2DArray = 29 /* SAMPLER2D_ARRAY */] = "sampler2DArray";
typeMap[typeMap.sampler3D = 30 /* SAMPLER3D */] = "sampler3D";
typeMap[typeMap.samplerCube = 31 /* SAMPLER_CUBE */] = "samplerCube";
typeMap[typeMap.sampler = 32 /* SAMPLER */] = "sampler";
typeMap[typeMap.texture1D = 33 /* TEXTURE1D */] = "texture1D";
typeMap[typeMap.texture1DArray = 34 /* TEXTURE1D_ARRAY */] = "texture1DArray";
typeMap[typeMap.texture2D = 35 /* TEXTURE2D */] = "texture2D";
typeMap[typeMap.texture2DArray = 36 /* TEXTURE2D_ARRAY */] = "texture2DArray";
typeMap[typeMap.texture3D = 37 /* TEXTURE3D */] = "texture3D";
typeMap[typeMap.textureCube = 38 /* TEXTURE_CUBE */] = "textureCube";
typeMap[typeMap.image1D = 39 /* IMAGE1D */] = "image1D";
typeMap[typeMap.image1DArray = 40 /* IMAGE1D_ARRAY */] = "image1DArray";
typeMap[typeMap.image2D = 41 /* IMAGE2D */] = "image2D";
typeMap[typeMap.image2DArray = 42 /* IMAGE2D_ARRAY */] = "image2DArray";
typeMap[typeMap.image3D = 43 /* IMAGE3D */] = "image3D";
typeMap[typeMap.imageCube = 44 /* IMAGE_CUBE */] = "imageCube";
typeMap[typeMap.subpassInput = 45 /* SUBPASS_INPUT */] = "subpassInput";
typeMap.int8_t = 5 /* INT */;
typeMap.i8vec2 = 6 /* INT2 */;
typeMap.i8vec3 = 7 /* INT3 */;
typeMap.i8vec4 = 8 /* INT4 */;
typeMap.uint8_t = 9 /* UINT */;
typeMap.u8vec2 = 10 /* UINT2 */;
typeMap.u8vec3 = 11 /* UINT3 */;
typeMap.u8vec4 = 12 /* UINT4 */;
typeMap.int16_t = 5 /* INT */;
typeMap.i16vec2 = 6 /* INT2 */;
typeMap.i16vec3 = 7 /* INT3 */;
typeMap.i16vec4 = 8 /* INT4 */;
typeMap.uint16_t = 5 /* INT */;
typeMap.u16vec2 = 10 /* UINT2 */;
typeMap.u16vec3 = 11 /* UINT3 */;
typeMap.u16vec4 = 12 /* UINT4 */;
typeMap.float16_t = 13 /* FLOAT */;
typeMap.f16vec2 = 14 /* FLOAT2 */;
typeMap.f16vec3 = 15 /* FLOAT3 */;
typeMap.f16vec4 = 16 /* FLOAT4 */;
typeMap.mat2x2 = 17 /* MAT2 */;
typeMap.mat3x3 = 21 /* MAT3 */;
typeMap.mat4x4 = 25 /* MAT4 */;
typeMap.isampler1D = 26 /* SAMPLER1D */;
typeMap.usampler1D = 26 /* SAMPLER1D */;
typeMap.sampler1DShadow = 26 /* SAMPLER1D */;
typeMap.isampler1DArray = 27 /* SAMPLER1D_ARRAY */;
typeMap.usampler1DArray = 27 /* SAMPLER1D_ARRAY */;
typeMap.sampler1DArrayShadow = 27 /* SAMPLER1D_ARRAY */;
typeMap.isampler2D = 28 /* SAMPLER2D */;
typeMap.usampler2D = 28 /* SAMPLER2D */;
typeMap.sampler2DShadow = 28 /* SAMPLER2D */;
typeMap.isampler2DArray = 29 /* SAMPLER2D_ARRAY */;
typeMap.usampler2DArray = 29 /* SAMPLER2D_ARRAY */;
typeMap.sampler2DArrayShadow = 29 /* SAMPLER2D_ARRAY */;
typeMap.isampler3D = 30 /* SAMPLER3D */;
typeMap.usampler3D = 30 /* SAMPLER3D */;
typeMap.isamplerCube = 31 /* SAMPLER_CUBE */;
typeMap.usamplerCube = 31 /* SAMPLER_CUBE */;
typeMap.samplerCubeShadow = 31 /* SAMPLER_CUBE */;
typeMap.iimage2D = 41 /* IMAGE2D */;
typeMap.uimage2D = 41 /* IMAGE2D */;
typeMap.usubpassInput = 45 /* SUBPASS_INPUT */;
typeMap.isubpassInput = 45 /* SUBPASS_INPUT */;
var isSampler = (type) => type >= 26 /* SAMPLER1D */;
var isPaddedMatrix = (type) => type >= 17 /* MAT2 */ && type < 25 /* MAT4 */;
var formatMap = {
  bool: 4 /* R8 */,
  bvec2: 14 /* RG8 */,
  bvec3: 24 /* RGB8 */,
  bvec4: 35 /* RGBA8 */,
  int: 13 /* R32I */,
  ivec2: 23 /* RG32I */,
  ivec3: 34 /* RGB32I */,
  ivec4: 46 /* RGBA32I */,
  uint: 12 /* R32UI */,
  uvec2: 22 /* RG32UI */,
  uvec3: 33 /* RGB32UI */,
  uvec4: 45 /* RGBA32UI */,
  float: 11 /* R32F */,
  vec2: 21 /* RG32F */,
  vec3: 32 /* RGB32F */,
  vec4: 44 /* RGBA32F */,
  int8_t: 7 /* R8I */,
  i8vec2: 17 /* RG8I */,
  i8vec3: 28 /* RGB8I */,
  i8vec4: 40 /* RGBA8I */,
  uint8_t: 6 /* R8UI */,
  u8vec2: 16 /* RG8UI */,
  u8vec3: 27 /* RGB8UI */,
  u8vec4: 39 /* RGBA8UI */,
  int16_t: 10 /* R16I */,
  i16vec2: 20 /* RG16I */,
  i16vec3: 31 /* RGB16I */,
  i16vec4: 43 /* RGBA16I */,
  uint16_t: 9 /* R16UI */,
  u16vec2: 19 /* RG16UI */,
  u16vec3: 30 /* RGB16UI */,
  u16vec4: 42 /* RGBA16UI */,
  float16_t: 8 /* R16F */,
  f16vec2: 18 /* RG16F */,
  f16vec3: 29 /* RGB16F */,
  f16vec4: 41 /* RGBA16F */,
  // no suitable conversions:
  mat2: 44 /* RGBA32F */,
  mat3: 44 /* RGBA32F */,
  mat4: 44 /* RGBA32F */,
  mat2x2: 44 /* RGBA32F */,
  mat3x3: 44 /* RGBA32F */,
  mat4x4: 44 /* RGBA32F */,
  mat2x3: 44 /* RGBA32F */,
  mat2x4: 44 /* RGBA32F */,
  mat3x2: 44 /* RGBA32F */,
  mat3x4: 44 /* RGBA32F */,
  mat4x2: 44 /* RGBA32F */,
  mat4x3: 44 /* RGBA32F */
};
var getFormat = (name) => Format[name.toUpperCase()];
var getShaderStage = (name) => ShaderStageFlagBit[name.toUpperCase()];
var getDescriptorType = (name) => DescriptorType[name.toUpperCase()];
var isNormalized = (format) => {
  const type = FormatInfos[format] && FormatInfos[format].type;
  return type === 1 /* UNORM */ || type === 2 /* SNORM */;
};
var getMemoryAccessFlag = (access) => {
  if (access === "writeonly") {
    return 2 /* WRITE_ONLY */;
  }
  if (access === "readonly") {
    return 1 /* READ_ONLY */;
  }
  return 3 /* READ_WRITE */;
};
var passParams = {
  // color mask
  NONE: 0 /* NONE */,
  R: 1 /* R */,
  G: 2 /* G */,
  B: 4 /* B */,
  A: 8 /* A */,
  RG: 1 /* R */ | 2 /* G */,
  RB: 1 /* R */ | 4 /* B */,
  RA: 1 /* R */ | 8 /* A */,
  GB: 2 /* G */ | 4 /* B */,
  GA: 2 /* G */ | 8 /* A */,
  BA: 4 /* B */ | 8 /* A */,
  RGB: 1 /* R */ | 2 /* G */ | 4 /* B */,
  RGA: 1 /* R */ | 2 /* G */ | 8 /* A */,
  RBA: 1 /* R */ | 4 /* B */ | 8 /* A */,
  GBA: 2 /* G */ | 4 /* B */ | 8 /* A */,
  ALL: 15 /* ALL */,
  // blend operation
  ADD: 0 /* ADD */,
  SUB: 1 /* SUB */,
  REV_SUB: 2 /* REV_SUB */,
  MIN: 3 /* MIN */,
  MAX: 4 /* MAX */,
  // blend factor
  ZERO: 0 /* ZERO */,
  ONE: 1 /* ONE */,
  SRC_ALPHA: 2 /* SRC_ALPHA */,
  DST_ALPHA: 3 /* DST_ALPHA */,
  ONE_MINUS_SRC_ALPHA: 4 /* ONE_MINUS_SRC_ALPHA */,
  ONE_MINUS_DST_ALPHA: 5 /* ONE_MINUS_DST_ALPHA */,
  SRC_COLOR: 6 /* SRC_COLOR */,
  DST_COLOR: 7 /* DST_COLOR */,
  ONE_MINUS_SRC_COLOR: 8 /* ONE_MINUS_SRC_COLOR */,
  ONE_MINUS_DST_COLOR: 9 /* ONE_MINUS_DST_COLOR */,
  SRC_ALPHA_SATURATE: 10 /* SRC_ALPHA_SATURATE */,
  CONSTANT_COLOR: 11 /* CONSTANT_COLOR */,
  ONE_MINUS_CONSTANT_COLOR: 12 /* ONE_MINUS_CONSTANT_COLOR */,
  CONSTANT_ALPHA: 13 /* CONSTANT_ALPHA */,
  ONE_MINUS_CONSTANT_ALPHA: 14 /* ONE_MINUS_CONSTANT_ALPHA */,
  // stencil operation
  // ZERO: StencilOp.ZERO, // duplicate, safely removed because enum value is(and always will be) the same
  KEEP: 1 /* KEEP */,
  REPLACE: 2 /* REPLACE */,
  INCR: 3 /* INCR */,
  DECR: 4 /* DECR */,
  INVERT: 5 /* INVERT */,
  INCR_WRAP: 6 /* INCR_WRAP */,
  DECR_WRAP: 7 /* DECR_WRAP */,
  // comparison function
  NEVER: 0 /* NEVER */,
  LESS: 1 /* LESS */,
  EQUAL: 2 /* EQUAL */,
  LESS_EQUAL: 3 /* LESS_EQUAL */,
  GREATER: 4 /* GREATER */,
  NOT_EQUAL: 5 /* NOT_EQUAL */,
  GREATER_EQUAL: 6 /* GREATER_EQUAL */,
  ALWAYS: 7 /* ALWAYS */,
  // cull mode
  // NONE: CullMode.NONE, // duplicate, safely removed because enum value is(and always will be) the same
  FRONT: 1 /* FRONT */,
  BACK: 2 /* BACK */,
  // shade mode
  GOURAND: 0 /* GOURAND */,
  FLAT: 1 /* FLAT */,
  // polygon mode
  FILL: 0 /* FILL */,
  LINE: 2 /* LINE */,
  POINT: 1 /* POINT */,
  // primitive mode
  POINT_LIST: 0 /* POINT_LIST */,
  LINE_LIST: 1 /* LINE_LIST */,
  LINE_STRIP: 2 /* LINE_STRIP */,
  LINE_LOOP: 3 /* LINE_LOOP */,
  TRIANGLE_LIST: 7 /* TRIANGLE_LIST */,
  TRIANGLE_STRIP: 8 /* TRIANGLE_STRIP */,
  TRIANGLE_FAN: 9 /* TRIANGLE_FAN */,
  LINE_LIST_ADJACENCY: 4 /* LINE_LIST_ADJACENCY */,
  LINE_STRIP_ADJACENCY: 5 /* LINE_STRIP_ADJACENCY */,
  TRIANGLE_LIST_ADJACENCY: 10 /* TRIANGLE_LIST_ADJACENCY */,
  TRIANGLE_STRIP_ADJACENCY: 11 /* TRIANGLE_STRIP_ADJACENCY */,
  TRIANGLE_PATCH_ADJACENCY: 12 /* TRIANGLE_PATCH_ADJACENCY */,
  QUAD_PATCH_LIST: 13 /* QUAD_PATCH_LIST */,
  ISO_LINE_LIST: 6 /* ISO_LINE_LIST */,
  // POINT: Filter.POINT, // duplicate, safely removed because enum value is(and always will be) the same
  LINEAR: 2 /* LINEAR */,
  ANISOTROPIC: 3 /* ANISOTROPIC */,
  WRAP: 0 /* WRAP */,
  MIRROR: 1 /* MIRROR */,
  CLAMP: 2 /* CLAMP */,
  BORDER: 3 /* BORDER */,
  LINE_WIDTH: 1 /* LINE_WIDTH */,
  DEPTH_BIAS: 2 /* DEPTH_BIAS */,
  BLEND_CONSTANTS: 4 /* BLEND_CONSTANTS */,
  DEPTH_BOUNDS: 8 /* DEPTH_BOUNDS */,
  STENCIL_WRITE_MASK: 16 /* STENCIL_WRITE_MASK */,
  STENCIL_COMPARE_MASK: 32 /* STENCIL_COMPARE_MASK */,
  TRUE: true,
  FALSE: false
};
Object.assign(passParams, RenderPassStage);
var effectStructure = {
  $techniques: [
    {
      $passes: [
        {
          depthStencilState: {},
          rasterizerState: {},
          blendState: { targets: [{}] },
          properties: { any: { sampler: {}, editor: {} } },
          migrations: { properties: { any: {} }, macros: { any: {} } },
          embeddedMacros: {}
        }
      ]
    }
  ]
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  GetTypeSize,
  RenderPriority,
  Sampler,
  SamplerInfo,
  SetIndex,
  effectStructure,
  formatMap,
  getDescriptorType,
  getFormat,
  getMemoryAccessFlag,
  getShaderStage,
  isNormalized,
  isPaddedMatrix,
  isSampler,
  murmurhash2_32_gc,
  passParams,
  typeMap
});
