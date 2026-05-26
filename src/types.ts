export type Direction = 'U' | 'R' | 'D' | 'L';
export type BlockType = 'generator' | 'path' | 'corner' | 'counter' | 'splitter' | 'random' | 'delay' | 'sink' | 'faster' | 'slower' | 'merger';

export interface BlockData {
  id: string; // usually x,y
  type: BlockType;
  x: number;
  y: number;
  rot: number; // 0=0, 1=90, 2=180, 3=270
  config: Record<string, any>;
  state: Record<string, any>;
}

export interface PulseData {
  id: string;
  x: number;
  y: number;
  dir: Direction;
  age: number;
  baseCooldown: number;
  currentCooldown: number;
}
