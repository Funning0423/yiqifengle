// AmbienceNight.ts — Voice bot：把海岛夜间权重（IslandPropsLayout.propNightWeight，0 白天 / 1 夜里）接给 AmbienceAudio。
// 单独一个文件，AmbienceAudio 本身不 import world-r2（音频测试的模块加载器不用跟着改）；Cocos 启动时会执行所有脚本模块。
// 室内时 propNightWeight 可能停在最后的值不更新——室内本来就没有海鸥，没关系。
import { AmbienceAudio } from './AmbienceAudio';
import { BedLayerAudio } from './BedLayerAudio';
import { propNightWeight } from '../world-r2/IslandPropsLayout';

AmbienceAudio.setNightSource(propNightWeight);
BedLayerAudio.setNightSource(propNightWeight);
