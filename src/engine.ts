import { PulseData, BlockData } from './types';
import { BLOCK_DEFS, DIRS, DIR_OPPO, rotateGlobalToLocal, rotateLocalToGlobal } from './blocks';

export const CELL_SIZE = 80;
export const GRID_W = 12;
export const GRID_H = 8;

export const generateId = () => Math.random().toString(36).substr(2, 9);

export function processTick(
  blocks: Record<string, BlockData>,
  pulses: PulseData[],
  globalTick: number
): { newBlocks: Record<string, BlockData>; newPulses: PulseData[] } {
  let updatedBlocks = { ...blocks };
  let pendingPulses: PulseData[] = [];
  let remainingPulses: PulseData[] = [];

  // 1. Check blocks (Generators & Delays)
  Object.values(updatedBlocks).forEach((b) => {
    if (b.type === 'generator') {
      if (b.config.mode === 'auto' && globalTick % (b.config.interval * 2) === 0) {
        const outDir = rotateLocalToGlobal('R', b.rot);
        pendingPulses.push({ id: generateId(), x: b.x, y: b.y, dir: outDir, age: 0, baseCooldown: 2, currentCooldown: 2 });
      }
    }

    if (b.type === 'delay') {
      const held = b.state.heldPulses || [];
      if (held.length > 0) {
        let released: any[] = [];
        let rmd: any[] = [];
        held.forEach((hp: any) => {
          let wait = hp.wait - 1;
          if (wait <= 0) released.push(hp);
          else rmd.push({ ...hp, wait });
        });
        updatedBlocks[`${b.x},${b.y}`] = { ...b, state: { ...b.state, heldPulses: rmd } };
        
        released.forEach((hp) => {
          const outDirLocal = hp.outDirLocal || 'R';
          const outDir = rotateLocalToGlobal(outDirLocal, b.rot);
          pendingPulses.push({ id: hp.id, x: b.x, y: b.y, dir: outDir, age: hp.age + 1, baseCooldown: hp.baseCooldown || 2, currentCooldown: hp.baseCooldown || 2 });
        });
      }
    }
  });

  // 2. Move active pulses
  pulses.forEach((p) => {
    // Cooldown logic
    if (p.currentCooldown > 1) {
      remainingPulses.push({ ...p, currentCooldown: p.currentCooldown - 1 });
      return;
    }
    
    // Reset cooldown for this move
    const currentBaseCooldown = p.baseCooldown || 2;
    let nextBaseCooldown = currentBaseCooldown;

    let nx = p.x;
    let ny = p.y;
    if (p.dir === 'U') ny--;
    if (p.dir === 'D') ny++;
    if (p.dir === 'R') nx++;
    if (p.dir === 'L') nx--;

    // Bounds check
    if (nx < 0 || nx >= GRID_W || ny < 0 || ny >= GRID_H) return; // Die off screen

    const targetBlock = updatedBlocks[`${nx},${ny}`];
    if (!targetBlock) return; // Die hitting wall

    const entryFaceGlobal = DIR_OPPO[p.dir];
    const entryFaceLocal = rotateGlobalToLocal(entryFaceGlobal, targetBlock.rot);

    const def = BLOCK_DEFS[targetBlock.type];
    
    // Check if block accepts input on this face
    if (!def.inPorts.includes(entryFaceLocal)) return; // Crash / Die

    // Process block logic / state updates
    if (targetBlock.type === 'counter') {
      const limit = targetBlock.config.limit || 0;
      if (limit > 0 && (targetBlock.state.count || 0) >= limit) {
        // Pulse hits a blocked counter and dies
        return;
      }
      
      updatedBlocks[`${nx},${ny}`] = {
        ...targetBlock,
        state: { ...targetBlock.state, count: (targetBlock.state.count || 0) + 1 },
      };
    }
    
    if (targetBlock.type === 'splitter') {
      const mode = targetBlock.config.mode;
      let toggle = targetBlock.state.toggle;
      let passes = targetBlock.state.passes || 0;
      
      if (mode === 'alt') {
        updatedBlocks[`${nx},${ny}`] = {
          ...targetBlock,
          state: { toggle: !toggle, passes: passes + 1 },
        };
      } else {
        const threshold = targetBlock.config.threshold || 5;
        const newPasses = passes + 1;
        updatedBlocks[`${nx},${ny}`] = {
          ...targetBlock,
          state: { passes: newPasses, toggle: newPasses < threshold },
        };
      }
    }
    
    if (targetBlock.type === 'sink') {
      updatedBlocks[`${nx},${ny}`] = {
        ...targetBlock,
        state: { hits: (targetBlock.state.hits || 0) + 1 },
      };
      // Pulse dies
      return;
    }

    if (targetBlock.type === 'delay') {
       const delayTicks = targetBlock.config.delayTicks || 3;
       const held = targetBlock.state.heldPulses || [];
       
       const localOut = def.outPorts(entryFaceLocal, targetBlock.state, targetBlock.config);
       if (!localOut) return;

       updatedBlocks[`${nx},${ny}`] = {
           ...targetBlock,
           state: { ...targetBlock.state, heldPulses: [...held, { id: p.id, wait: delayTicks * 2, age: p.age+1, outDirLocal: localOut, baseCooldown: nextBaseCooldown }] }
       };
       return; // Paused inside
    }

    if (targetBlock.type === 'faster') {
      // 1 is fast, 2 is normal, 4 is slow. 
      if (nextBaseCooldown === 4) nextBaseCooldown = 2;
      else if (nextBaseCooldown === 2) nextBaseCooldown = 1;
    }
    
    if (targetBlock.type === 'slower') {
      if (nextBaseCooldown === 1) nextBaseCooldown = 2;
      else if (nextBaseCooldown === 2) nextBaseCooldown = 4;
    }

    // Determine output direction
    const latestStateBlock = updatedBlocks[`${nx},${ny}`];
    const localOut = def.outPorts(entryFaceLocal, latestStateBlock.state, latestStateBlock.config);
    if (!localOut) return;

    const globalOut = rotateLocalToGlobal(localOut, targetBlock.rot);

    remainingPulses.push({
      id: p.id,
      x: nx,
      y: ny,
      dir: globalOut,
      age: p.age + 1,
      baseCooldown: nextBaseCooldown,
      currentCooldown: nextBaseCooldown,
    });
  });

  return { newBlocks: updatedBlocks, newPulses: [...remainingPulses, ...pendingPulses] };
}
