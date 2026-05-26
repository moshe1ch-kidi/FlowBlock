import { Direction, BlockType } from './types';

export const DIRS: Direction[] = ['U', 'R', 'D', 'L'];
export const DIR_OPPO: Record<Direction, Direction> = { U: 'D', D: 'U', L: 'R', R: 'L' };

export const rotateLocalToGlobal = (localDir: Direction, rot: number): Direction => {
  return DIRS[(DIRS.indexOf(localDir) + rot) % 4];
};

export const rotateGlobalToLocal = (globalDir: Direction, rot: number): Direction => {
  return DIRS[(DIRS.indexOf(globalDir) - rot + 4) % 4];
};

export interface BlockDef {
  inPorts: Direction[];
  outPorts: (localIn: Direction, state: any, config: any) => Direction | null;
  init: () => { config: any; state: any };
}

export const BLOCK_DEFS: Record<BlockType, BlockDef> = {
  generator: {
    inPorts: [],
    outPorts: () => 'R',
    init: () => ({ config: { mode: 'auto', interval: 2 }, state: {} }),
  },
  path: {
    inPorts: ['L', 'R'],
    outPorts: (localIn) => (localIn === 'L' ? 'R' : 'L'),
    init: () => ({ config: {}, state: {} }),
  },
  corner: {
    inPorts: ['L', 'D'],
    outPorts: (localIn) => (localIn === 'L' ? 'D' : 'L'),
    init: () => ({ config: {}, state: {} }),
  },
  counter: {
    inPorts: ['L', 'R'],
    outPorts: (localIn) => (localIn === 'L' ? 'R' : 'L'),
    init: () => ({ config: { limit: 0 }, state: { count: 0 } }),
  },
  splitter: {
    inPorts: ['L'],
    outPorts: (localIn, state, config) => {
      if (config.mode === 'alt') {
        return state.toggle ? 'U' : 'D';
      }
      return state.passes < config.threshold ? 'U' : 'D';
    },
    init: () => ({ config: { mode: 'alt', threshold: 5 }, state: { toggle: true, passes: 0 } }),
  },
  merger: {
    inPorts: ['L', 'U', 'D'],
    outPorts: () => 'R',
    init: () => ({ config: {}, state: {} }),
  },
  random: {
    inPorts: ['L', 'U', 'D'],
    outPorts: (localIn) => {
      if (localIn === 'L') return Math.random() > 0.5 ? 'U' : 'D';
      if (localIn === 'U') return Math.random() > 0.5 ? 'L' : 'D';
      if (localIn === 'D') return Math.random() > 0.5 ? 'L' : 'U';
      return null;
    },
    init: () => ({ config: {}, state: {} }),
  },
  delay: {
    inPorts: ['L', 'R'],
    outPorts: (localIn) => (localIn === 'L' ? 'R' : 'L'),
    init: () => ({ config: { delayTicks: 3 }, state: { heldPulses: [] } }), // heldPulses: {id, wait, outDirLocal}[]
  },
  sink: {
    inPorts: ['L', 'R', 'U', 'D'],
    outPorts: () => null,
    init: () => ({ config: {}, state: { hits: 0 } }),
  },
  faster: {
    inPorts: ['L', 'R'],
    outPorts: (localIn) => (localIn === 'L' ? 'R' : 'L'),
    init: () => ({ config: {}, state: {} }),
  },
  slower: {
    inPorts: ['L', 'R'],
    outPorts: (localIn) => (localIn === 'L' ? 'R' : 'L'),
    init: () => ({ config: {}, state: {} }),
  },
};
