import { edgeGlideMode } from './edgeGlide';
import { shieldHopMode } from './shieldHop';
import { botSlicerMode } from './botSlicer';
import { infraStackMode } from './infraStack';
import { packetCatcherMode } from './packetCatcher';

const modeMap = {
  'edge-glide': edgeGlideMode,
  'shield-hop': shieldHopMode,
  'bot-slicer': botSlicerMode,
  'infra-stack': infraStackMode,
  'packet-catcher': packetCatcherMode,
};

export function getModeById(id) {
  return modeMap[id] ?? edgeGlideMode;
}

