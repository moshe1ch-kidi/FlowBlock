import React, { useState, useCallback } from 'react';
import { Play, Square, Settings2, Trash2, RotateCw, Plus, Minus, X, Book, Gauge, RotateCcw, Save, FolderOpen, HelpCircle } from 'lucide-react';
import { useInterval } from './useInterval';
import { BlockData, PulseData, BlockType, Direction } from './types';
import { BLOCK_DEFS, DIRS } from './blocks';
import { processTick, CELL_SIZE, GRID_W, GRID_H, generateId } from './engine';
import { SvgBase, HtmlOverlay } from './components/BlockRender';
import { TOOLS } from './tools';
import { cn } from './lib/utils';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [blocks, setBlocks] = useState<Record<string, BlockData>>({});
  const [blueprint, setBlueprint] = useState<Record<string, BlockData> | null>(null);
  const [pulses, setPulses] = useState<PulseData[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(600); // ms per tick
  const [globalTick, setGlobalTick] = useState(0);
  
  const [selectedTool, setSelectedTool] = useState<string>('cursor');
  const [selectedCell, setSelectedCell] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [showMobileRightSidebar, setShowMobileRightSidebar] = useState(false);
  const [dragSource, setDragSource] = useState<string | null>(null);
  const [dragTarget, setDragTarget] = useState<string | null>(null);
  const [zoomMultiplier, setZoomMultiplier] = useState<number>(1);

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const canvasContainerRef = React.useRef<HTMLElement>(null);
  const [canvasScale, setCanvasScale] = useState(1);

  React.useEffect(() => {
    if (!canvasContainerRef.current) return;
    let raf: number;
    const observer = new ResizeObserver((entries) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const { width, height } = entries[0].contentRect;
        const targetW = (GRID_W * CELL_SIZE) + 32; 
        const targetH = (GRID_H * CELL_SIZE) + 32;
        const scaleW = width / targetW;
        const scaleH = height / targetH;
        // Also limit scale max to 1.5 if on wide screen, or just 1
        setCanvasScale(Math.min(1, scaleW, scaleH));
      });
    });
    observer.observe(canvasContainerRef.current);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(raf);
    };
  }, []);

  // Engine loop
  useInterval(() => {
    if (!isPlaying) return;
    setGlobalTick(t => t + 1);
    const { newBlocks, newPulses } = processTick(blocks, pulses, globalTick);
    
    let shouldStop = false;
    for (const [id, block] of Object.entries(newBlocks)) {
      if (block.type === 'counter' && block.config.limit > 0) {
        const oldBlock = blocks[id];
        if (block.state.count >= block.config.limit && oldBlock && oldBlock.state.count < block.config.limit) {
          shouldStop = true;
        }
      }
    }

    setBlocks(newBlocks);
    setPulses(newPulses);

    if (shouldStop) {
      setIsPlaying(false);
    }
  }, isPlaying ? speed / 2 : null);

  const handleCellClick = (x: number, y: number) => {
    const key = `${x},${y}`;
    if (selectedTool === 'cursor') {
      setSelectedCell(key);
    } else {
      // Place block
      const toolDef = BLOCK_DEFS[selectedTool as BlockType];
      if (toolDef) {
        const initial = toolDef.init();
        setBlocks(prev => ({
          ...prev,
          [key]: {
            id: key,
            type: selectedTool as BlockType,
            x, y, rot: 0,
            config: initial.config,
            state: initial.state
          }
        }));
        setSelectedCell(key); // Auto select new block
      } else {
         // tool is cursor or unknown
         setSelectedCell(key);
      }
    }
  };

  const handleManualPulse = (blockId: string) => {
    const b = blocks[blockId];
    if (b && b.type === 'generator') {
      const outDir = DIRS[(DIRS.indexOf('R') + b.rot) % 4];
      setPulses(old => [...old, { id: generateId(), x: b.x, y: b.y, dir: outDir, age: 0 }]);
    }
  };

  const deleteSelected = () => {
    if (!selectedCell) return;
    const nb = { ...blocks };
    delete nb[selectedCell];
    setBlocks(nb);
    setSelectedCell(null);
  };

  const rotateSelected = () => {
    if (!selectedCell || !blocks[selectedCell]) return;
    setBlocks(prev => ({
      ...prev,
      [selectedCell]: {
        ...prev[selectedCell],
        rot: (prev[selectedCell].rot + 1) % 4
      }
    }));
  };

  const saveToFile = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(blocks, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", "flowblocks-save.json");
    dlAnchorElem.click();
  };

  const loadFromFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const fileReader = new FileReader();
    if (event.target.files && event.target.files.length > 0) {
      fileReader.readAsText(event.target.files[0], "UTF-8");
      fileReader.onload = e => {
        try {
          const parsed = JSON.parse(e.target?.result as string);
          setBlocks(parsed);
          setPulses([]);
          setGlobalTick(0);
          setIsPlaying(false);
        } catch(e) {
          console.error("Invalid save file");
        }
      };
    }
  };

  const clearBoard = () => {
    setBlocks({});
    setBlueprint(null);
    setPulses([]);
    setGlobalTick(0);
    setIsPlaying(false);
  };

  const setHint = (layout: Array<[number, number, BlockType, number]>) => {
    const newBlueprint: Record<string, BlockData> = {};
    layout.forEach(([x, y, type, rot]) => {
      newBlueprint[`${x},${y}`] = {
        id: `${x},${y}`, type, x, y, rot,
        config: BLOCK_DEFS[type].init().config,
        state: BLOCK_DEFS[type].init().state
      };
    });
    setBlueprint(newBlueprint);
  };

  const loadRollerCoaster = () => {
    const newBlocks: Record<string, BlockData> = {};
    const addB = (x: number, y: number, type: BlockType, rot: number) => {
      newBlocks[`${x},${y}`] = {
        id: `${x},${y}`, type, x, y, rot,
        config: BLOCK_DEFS[type].init().config,
        state: BLOCK_DEFS[type].init().state
      };
    };

    addB(2, 2, 'corner', 3);
    addB(3, 2, 'path', 0);
    addB(4, 2, 'delay', 0);
    addB(5, 2, 'path', 0);
    addB(6, 2, 'corner', 0);

    addB(6, 3, 'faster', 1);
    addB(6, 4, 'faster', 1);

    addB(6, 5, 'merger', 2);
    addB(7, 5, 'generator', 2);

    addB(5, 5, 'path', 2);
    addB(4, 5, 'path', 2);
    addB(3, 5, 'path', 2);
    addB(2, 5, 'corner', 2);

    addB(2, 4, 'slower', 3);
    addB(2, 3, 'slower', 3);

    setBlocks(newBlocks);
    setPulses([{ id: generateId(), x: 2, y: 2, dir: 'R', age: 0, baseCooldown: 2, currentCooldown: 2 }]);
    setGlobalTick(0);
    setIsPlaying(true);
    setSelectedCell(null);
  };

  const selectedBlock = selectedCell ? blocks[selectedCell] : null;

  return (
    <div dir="rtl" className="min-h-screen bg-[#F9F9F9] flex flex-col font-sans select-none overflow-hidden text-slate-800">
      {/* Topbar */}
      <header className="py-2 lg:h-16 border-b border-[#3373CC] bg-[#4C97FF] flex flex-col lg:flex-row items-center justify-between px-6 shrink-0 z-20 shadow-md gap-3 lg:gap-0">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center font-black text-xl shadow-inner text-white">FB</div>
          <div className="text-white">
            <h1 className="text-lg font-bold tracking-tight">FlowBlock</h1>
            <p className="text-[10px] text-blue-100 tracking-widest">לומדים לוגיקה חישובית</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2 lg:gap-6 text-white w-full lg:w-auto overflow-x-auto pb-2 lg:pb-0 hide-scrollbar shrink-0 px-2 lg:px-0">
          <div className="flex items-center shrink-0 gap-3 bg-white/10 px-4 py-2 rounded-full border border-white/20">
            <button 
              onClick={() => setIsPlaying(!isPlaying)}
              className={cn("px-4 py-1.5 rounded-full font-bold flex items-center gap-2 transition-all text-xs tracking-wider", isPlaying ? "bg-[#FF6680] text-white hover:bg-[#FF3355] shadow-sm" : "bg-[#59C059] text-white hover:bg-[#389438] shadow-sm")}
            >
              {isPlaying ? <Square size={14} fill="currentColor"/> : <Play size={14} fill="currentColor" />}
              {isPlaying ? "עצור" : "הפעל"}
            </button>
          </div>

          <div className="flex items-center gap-3 border-l-2 border-white/20 pl-6 border-r-0" title="מהירות">
            <Gauge size={22} className="text-blue-100" />
            <input 
              type="range" min="100" max="1500" step="100" 
              className="w-24 accent-white cursor-pointer"
              style={{ direction: 'ltr' }} // faster on right
              value={speed} onChange={e => setSpeed(Number(e.target.value))}
            />
          </div>
          
          <button onClick={() => { setPulses([]); setGlobalTick(0); }} className="flex items-center gap-1.5 text-xs tracking-widest text-white font-bold ml-2 transition-colors bg-black/20 hover:bg-amber-500 px-5 py-2.5 rounded-full shadow-sm">
            <RotateCcw size={18} />
            איפוס נתונים
          </button>
          <button onClick={clearBoard} className="flex items-center gap-1.5 text-xs tracking-widest text-white font-bold ml-2 transition-colors bg-black/20 hover:bg-red-500 px-5 py-2.5 rounded-full shadow-sm">
            <Trash2 size={18} />
            נקה הכל
          </button>
          
          <div className="border-r border-white/20 h-8 mx-2" />
          
          <button onClick={saveToFile} className="flex items-center gap-1.5 text-xs tracking-widest text-white font-bold ml-2 transition-colors bg-black/20 hover:bg-blue-600 px-5 py-2.5 rounded-full shadow-sm">
            <Save size={18} />
            שמור
          </button>
          <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1.5 text-xs tracking-widest text-white font-bold ml-2 transition-colors bg-black/20 hover:bg-emerald-600 px-5 py-2.5 rounded-full shadow-sm">
            <FolderOpen size={18} />
            טען
          </button>
          <input type="file" ref={fileInputRef} onChange={loadFromFile} accept=".json" className="hidden" />

          <button onClick={() => { setSelectedCell(null); setShowMobileRightSidebar(true); }} className="lg:hidden shrink-0 flex items-center gap-1.5 text-xs tracking-widest text-white hover:bg-slate-700 bg-slate-800 font-bold ml-2 px-5 py-2.5 rounded-full shadow-sm transition-colors"><Gauge size={18} /> משימות חקר</button>

          <button onClick={() => setShowHelp(true)} className="shrink-0 flex items-center gap-1.5 text-xs tracking-widest text-[#3373CC] hover:bg-blue-50 bg-white font-bold ml-2 px-5 py-2.5 rounded-full shadow-sm transition-colors"><Book size={18} /> מדריך רכיבים</button>
        </div>
      </header>

      <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">
        {/* Left Sidebar - Palette */}
        <aside className="lg:w-64 w-full border-l lg:border-b-0 border-b border-slate-200 bg-white flex flex-col shadow-sm z-10 shrink-0">
          <div className="p-4 border-b border-slate-100 bg-slate-50 hidden lg:block">
            <h2 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">מחסן רכיבים</h2>
          </div>
          <div className="p-2 lg:p-4 flex flex-col flex-wrap lg:grid lg:grid-cols-2 gap-2 lg:gap-3 overflow-x-auto lg:overflow-y-auto hide-scrollbar shrink-0 w-full content-start items-start h-[140px] lg:h-auto">
            {TOOLS.map(t => {
              const isSelected = selectedTool === t.id;
              const isLightText = t.id !== 'generator';
              return (
                <button
                  key={t.id}
                  onClick={() => { setSelectedTool(t.id); setSelectedCell(null); }}
                  className={cn(
                    "flex flex-col shrink-0 items-center justify-center p-1 lg:p-3 rounded-xl transition-all h-14 w-14 lg:h-24 lg:w-auto cursor-grab border border-black/10",
                    isSelected ? "shadow-inner" : "shadow-md hover:brightness-105"
                  )}
                  style={{
                    backgroundColor: t.color,
                    borderBottomWidth: isSelected ? '1px' : '4px',
                    borderColor: 'rgba(0,0,0,0.15)',
                    transform: isSelected ? 'translateY(3px)' : 'none',
                    color: isLightText ? 'white' : '#784b00'
                  }}
                >
                  <div dir="ltr" className="mb-0.5 lg:mb-2 drop-shadow-sm">
                    <t.icon className="w-5 h-5 lg:w-9 lg:h-9" strokeWidth={2.5} />
                  </div>
                  <span className="text-[8px] lg:text-[11px] font-bold tracking-tighter drop-shadow-sm truncate w-full text-center">{t.label}</span>
                </button>
              );
            })}
          </div>
        </aside>

        {/* Center - Canvas area */}
        <div className="flex-1 flex flex-col relative min-w-0" ref={canvasContainerRef}>
          <main 
            className="flex-1 bg-[#F9F9F9] overflow-auto relative p-4 lg:p-8" 
            style={{ backgroundImage: 'radial-gradient(#CBD5E1 1px, transparent 1px)', backgroundSize: '40px 40px' }}
          >
            {/* Zoom Controls */}
            <div className="fixed lg:absolute lg:bottom-8 lg:left-8 bottom-24 left-4 z-40 flex flex-col shadow-xl bg-white border border-slate-200 rounded-xl overflow-hidden shrink-0">
              <button onClick={() => setZoomMultiplier(z => Math.min(4, z + 0.3))} className="p-3 bg-white hover:bg-slate-50 text-slate-700 font-bold active:bg-slate-100 transition-colors border-b border-slate-100">
                <Plus size={20} />
              </button>
              <button onClick={() => setZoomMultiplier(z => Math.max(0.5, z - 0.3))} className="p-3 bg-white hover:bg-slate-50 text-slate-700 font-bold active:bg-slate-100 transition-colors border-b border-slate-100">
                <Minus size={20} />
              </button>
              <button onClick={() => setZoomMultiplier(1)} className="p-3 bg-white hover:bg-slate-50 text-slate-500 font-bold active:bg-slate-100 transition-colors" title="אפס זום">
                <span className="text-[10px] font-black tracking-widest block w-5 text-center">1X</span>
              </button>
            </div>

            <div className="w-max h-max mx-auto lg:my-auto my-0 flex items-center justify-center min-h-full">
              <div style={{ width: GRID_W * CELL_SIZE * (canvasScale * zoomMultiplier), height: GRID_H * CELL_SIZE * (canvasScale * zoomMultiplier) }} className="relative shrink-0 transition-all duration-300">
                <div dir="ltr"
                  className="absolute top-0 left-0 bg-white shadow-xl rounded-xl border-4 border-[#E2E8F0] grid-canvas flex-shrink-0 transition-transform duration-300 overflow-hidden"
                  style={{ width: GRID_W * CELL_SIZE, height: GRID_H * CELL_SIZE, transform: `scale(${canvasScale * zoomMultiplier})`, transformOrigin: 'top left' }}
                >
              {/* Grid Interactivity Layer */}
            <div className="absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${GRID_W}, 1fr)`, gridTemplateRows: `repeat(${GRID_H}, 1fr)` }}>
              {Array.from({ length: GRID_W * GRID_H }).map((_, i) => {
                const x = i % GRID_W;
                const y = Math.floor(i / GRID_W);
                const key = `${x},${y}`;
                const isSelected = selectedCell === key;
                const isDragSource = dragSource === key;
                const isDragTarget = dragTarget === key;
                
                return (
                    <div 
                      key={i} 
                      onClick={() => handleCellClick(x, y)}
                      draggable={selectedTool === 'cursor' && !!blocks[key]}
                      onDragStart={(e) => {
                        if (selectedTool !== 'cursor') {
                          e.preventDefault();
                          return;
                        }
                        e.dataTransfer.setData('text/plain', key);
                        e.dataTransfer.effectAllowed = 'move';
                        setDragSource(key);
                      }}
                      onDragEnd={() => {
                        setDragSource(null);
                        setDragTarget(null);
                      }}
                      onDragEnter={(e) => {
                        if (selectedTool !== 'cursor') return;
                        e.preventDefault();
                        setDragTarget(key);
                      }}
                      onDragLeave={(e) => {
                        if (selectedTool !== 'cursor') return;
                        if (dragTarget === key) {
                          setDragTarget(null);
                        }
                      }}
                      onDragOver={(e) => {
                        if (selectedTool !== 'cursor') return;
                        e.preventDefault();
                        e.dataTransfer.dropEffect = 'move';
                      }}
                      onDrop={(e) => {
                        if (selectedTool !== 'cursor') return;
                        e.preventDefault();
                        setDragSource(null);
                        setDragTarget(null);
                        const sourcePos = e.dataTransfer.getData('text/plain');
                        if (!sourcePos || sourcePos === key) return;
                        
                        setBlocks(prev => {
                          const newBlocks = { ...prev };
                          const sourceBlock = newBlocks[sourcePos];
                          const targetBlock = newBlocks[key];
                          
                          if (sourceBlock) {
                            delete newBlocks[sourcePos];
                            newBlocks[key] = { ...sourceBlock, x, y, id: key };
                            if (targetBlock) {
                              const [sx, sy] = sourcePos.split(',').map(Number);
                              newBlocks[sourcePos] = { ...targetBlock, x: sx, y: sy, id: sourcePos };
                            }
                          }
                          return newBlocks;
                        });
                        setSelectedCell(key);
                      }}
                      className={cn(
                        "relative w-full h-full border border-slate-100 transition-colors cursor-pointer",
                        isSelected ? "z-50" : "z-20",
                        isSelected && !isDragSource && !isDragTarget ? "border-[#4C97FF] border-2 bg-blue-50/50 shadow-[inset_0_0_10px_rgba(76,151,255,0.2)]" : 
                        isDragSource ? "opacity-50 border-dashed border-2 border-slate-400 bg-slate-100/50" : 
                        isDragTarget ? "border-amber-400 border-2 bg-amber-50/50 shadow-[inset_0_0_15px_rgba(251,191,36,0.3)]" : 
                        "hover:border-slate-200 hover:bg-slate-50/50"
                      )}
                    >
                      {isSelected && !!blocks[key] && selectedTool === 'cursor' && (
                        <>
                          <button 
                            onClick={(e) => { e.stopPropagation(); deleteSelected(); }} 
                            className="hidden lg:block absolute border border-red-200 text-red-500 rounded-lg p-1.5 top-1 left-1 z-30 bg-white/90 shadow-sm hover:bg-red-50 hover:text-red-600 transition-all active:scale-95 backdrop-blur-sm"
                            title="מחק"
                          >
                            <Trash2 size={12} />
                          </button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); rotateSelected(); }} 
                            className="hidden lg:block absolute border border-slate-200 text-slate-600 rounded-lg p-1.5 top-1 right-1 z-30 bg-white/90 shadow-sm hover:bg-slate-50 hover:text-slate-800 transition-all active:scale-95 backdrop-blur-sm"
                            title="סובב"
                          >
                            <RotateCw size={12} />
                          </button>
                        </>
                      )}
                    </div>
                );
              })}
            </div>

            {/* Blueprint Layer */}
            {blueprint && Object.values<BlockData>(blueprint).map(b => (
              <div 
                key={`blueprint-${b.id}`}
                className="absolute transition-all duration-300 ease-linear z-0 pointer-events-none opacity-40 mix-blend-multiply border-2 border-dashed border-slate-500 rounded-lg scale-90"
                style={{ 
                  left: b.x * CELL_SIZE, 
                  top: b.y * CELL_SIZE, 
                  width: CELL_SIZE, 
                  height: CELL_SIZE,
                }}
              >
                <div style={{ transform: `rotate(${b.rot * 90}deg)` }} className="w-full h-full">
                  <SvgBase type={b.type} />
                </div>
              </div>
            ))}

            {/* Blocks Layer */}
            {Object.values<BlockData>(blocks).map(b => (
              <div 
                key={b.id}
                className="absolute transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] z-10 pointer-events-none"
                style={{ 
                  left: b.x * CELL_SIZE, 
                  top: b.y * CELL_SIZE, 
                  width: CELL_SIZE, 
                  height: CELL_SIZE,
                  filter: selectedCell === b.id ? 'drop-shadow(0 0 8px rgba(59,130,246,0.6)) scale(1.05)' : ''
                }}
              >
                <div style={{ transform: `rotate(${b.rot * 90}deg)` }} className="w-full h-full transition-transform duration-300">
                  <SvgBase type={b.type} />
                </div>
                <HtmlOverlay block={b} />
              </div>
            ))}

            {/* Pulses Layer */}
            {pulses.map(p => (
              <div 
                key={p.id} 
                className="absolute w-4 h-4 rounded-full bg-yellow-300 shadow-[0_0_20px_#fde047] z-30 pointer-events-none mix-blend-screen -ml-2 -mt-2"
                style={{ 
                  left: p.x * CELL_SIZE + CELL_SIZE/2, 
                  top: p.y * CELL_SIZE + CELL_SIZE/2,
                  transition: `left ${(speed / 2) * Math.max(1, p.baseCooldown || 2)}ms linear, top ${(speed / 2) * Math.max(1, p.baseCooldown || 2)}ms linear`
                }}
              />
            ))}
            </div>
          </div>
          </div>
        </main>
        </div>

        {/* Right Sidebar - Properties & Challenges */}
        {showMobileRightSidebar && (
          <div 
            className="fixed inset-0 z-40 bg-slate-900/20 backdrop-blur-sm lg:hidden" 
            onClick={() => setShowMobileRightSidebar(false)}
          />
        )}
        <aside className={cn(
          "lg:w-80 lg:border-t-0 lg:border-r border-slate-200 bg-slate-100 flex-col shadow-sm shrink-0 lg:max-h-full",
          showMobileRightSidebar ? "fixed inset-y-0 right-0 z-50 flex w-[85vw] max-w-[320px] shadow-2xl border-l" : "hidden lg:flex"
        )}>
          <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-200/50">
            <h2 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
              {selectedBlock ? 'מאפייני בלוק' : 'משימות חקר'}
            </h2>
            <button onClick={() => setShowMobileRightSidebar(false)} className="lg:hidden p-2 bg-white rounded-full text-slate-500 hover:bg-slate-200">
              <X size={16} />
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-5 pb-20 lg:pb-5">
            {selectedBlock ? (
               <div className="space-y-6">
                 <div className="flex items-center gap-3 pb-4 border-b border-slate-200">
                   <div className="w-12 h-12 bg-white rounded flex items-center justify-center p-2 border border-slate-300 shadow-sm">
                     <div style={{ transform: `rotate(${selectedBlock.rot*90}deg)` }} className="w-full h-full">
                       <SvgBase type={selectedBlock.type} />
                     </div>
                   </div>
                   <div>
                     <h3 className="font-bold text-slate-800 capitalize tracking-wide">{TOOLS.find(t => t.id === selectedBlock.type)?.label || selectedBlock.type}</h3>
                     <p className="text-[10px] font-mono text-slate-500 tracking-wider" dir="ltr">({selectedBlock.x}, {selectedBlock.y}) :מיקום</p>
                   </div>
                 </div>

                 <div className="flex gap-2">
                   <button onClick={rotateSelected} className="flex-1 flex items-center justify-center gap-2 py-2 bg-white hover:bg-slate-50 border border-slate-300 shadow-sm text-slate-700 font-bold rounded-lg text-xs tracking-wider transition-all active:translate-y-[1px]">
                     <RotateCw size={14}/> סובב
                   </button>
                   <button onClick={deleteSelected} className="flex-1 flex items-center justify-center gap-2 py-2 bg-white hover:bg-red-50 border border-red-300 shadow-sm text-red-600 font-bold rounded-lg text-xs tracking-wider transition-all active:translate-y-[1px]">
                     <Trash2 size={14}/> מחק
                   </button>
                 </div>

                 {/* Block Specific Configs */}
                 {selectedBlock.type === 'generator' && (
                   <div className="space-y-4">
                     <div>
                       <label className="text-[10px] tracking-widest font-bold text-slate-500 mb-1 block">מצב פעולה</label>
                       <select 
                         value={selectedBlock.config.mode}
                         onChange={e => setBlocks(prev => ({...prev, [selectedBlock.id]: {...selectedBlock, config: {...selectedBlock.config, mode: e.target.value}}}))}
                         className="w-full bg-white border border-slate-300 shadow-sm rounded-lg p-2 text-xs font-bold text-slate-700 focus:outline-none focus:border-[#4C97FF]"
                       >
                         <option value="auto">אוטומטי (רציף)</option>
                         <option value="manual">ידני (לחיצה)</option>
                       </select>
                     </div>
                     {selectedBlock.config.mode === 'auto' && (
                       <div>
                         <label className="text-[10px] tracking-widest font-bold text-slate-500 mb-1 block">מרווח זמן (פעימות)</label>
                         <div className="flex items-center gap-2" dir="ltr">
                           <button onClick={() => setBlocks(prev => ({...prev, [selectedBlock.id]: {...selectedBlock, config: {...selectedBlock.config, interval: Math.max(1, selectedBlock.config.interval - 1)}}}))} className="p-2 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-600 active:scale-95 shrink-0"><Minus size={16} /></button>
                           <input type="number" min="1" value={selectedBlock.config.interval} onChange={e => setBlocks(prev => ({...prev, [selectedBlock.id]: {...selectedBlock, config: {...selectedBlock.config, interval: parseInt(e.target.value) || 1}}}))} className="flex-1 min-w-0 bg-white border border-slate-300 shadow-sm rounded-lg p-2 text-xs font-bold text-slate-700 focus:outline-none focus:border-[#4C97FF] text-center" />
                           <button onClick={() => setBlocks(prev => ({...prev, [selectedBlock.id]: {...selectedBlock, config: {...selectedBlock.config, interval: (selectedBlock.config.interval || 1) + 1}}}))} className="p-2 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-600 active:scale-95 shrink-0"><Plus size={16} /></button>
                         </div>
                       </div>
                     )}
                     {selectedBlock.config.mode === 'manual' && (
                        <button onClick={() => handleManualPulse(selectedBlock.id)} className="w-full py-3 bg-[#FFBF00] border-b-4 border-[#CC9900] text-[#784b00] font-bold rounded-lg hover:brightness-105 transition-all text-xs flex items-center justify-center gap-2 active:translate-y-[2px] active:border-b-[2px]">
                           <Play size={16} fill="currentColor"/> שחרר פולס
                        </button>
                     )}
                   </div>
                 )}

                 {selectedBlock.type === 'counter' && (
                   <div className="space-y-4">
                     <div className={cn("text-center p-6 shadow-sm rounded-xl border transition-colors", selectedBlock.config.limit > 0 && selectedBlock.state.count >= selectedBlock.config.limit ? "bg-red-50 border-red-200" : "bg-white border-slate-300")}>
                        <div className={cn("text-5xl font-mono font-black drop-shadow-sm transition-colors", selectedBlock.config.limit > 0 && selectedBlock.state.count >= selectedBlock.config.limit ? "text-[#FF6680]" : "text-[#FF8C1A]")}>
                           {selectedBlock.state.count || 0}
                           {selectedBlock.config.limit > 0 && <span className="text-2xl text-slate-400">/{selectedBlock.config.limit}</span>}
                        </div>
                        <div className="text-[10px] font-bold text-slate-500 mt-2 tracking-widest">
                           {selectedBlock.config.limit > 0 && selectedBlock.state.count >= selectedBlock.config.limit ? "המונה חסום" : "סך הכל פולסים"}
                        </div>
                     </div>
                     <div>
                       <label className="text-[10px] tracking-widest font-bold text-slate-500 mb-1 block">הגבלת ספירה (0 = ללא הגבלה)</label>
                       <div className="flex items-center gap-2" dir="ltr">
                           <button onClick={() => setBlocks(prev => ({...prev, [selectedBlock.id]: {...selectedBlock, config: {...selectedBlock.config, limit: Math.max(0, (selectedBlock.config.limit || 0) - 1)}}}))} className="p-2 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-600 active:scale-95 shrink-0"><Minus size={16} /></button>
                           <input 
                             type="number" 
                             min="0" 
                             value={selectedBlock.config.limit || 0} 
                             onChange={e => setBlocks(prev => ({...prev, [selectedBlock.id]: {...selectedBlock, config: {...selectedBlock.config, limit: parseInt(e.target.value) || 0}}}))} 
                             className="flex-1 min-w-0 bg-white border border-slate-300 shadow-sm rounded-lg p-2 text-xs font-bold text-slate-700 focus:outline-none focus:border-[#4C97FF] text-center" 
                           />
                           <button onClick={() => setBlocks(prev => ({...prev, [selectedBlock.id]: {...selectedBlock, config: {...selectedBlock.config, limit: (selectedBlock.config.limit || 0) + 1}}}))} className="p-2 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-600 active:scale-95 shrink-0"><Plus size={16} /></button>
                       </div>
                     </div>
                     <button onClick={() => setBlocks(prev => ({...prev, [selectedBlock.id]: {...selectedBlock, state: {...selectedBlock.state, count: 0}}}))} className="w-full py-2 bg-white shadow-sm border border-slate-300 text-slate-600 font-bold rounded-lg hover:bg-slate-50 transition-all text-xs tracking-wider active:translate-y-[1px]">
                        אפס מונה
                     </button>
                   </div>
                 )}

                 {selectedBlock.type === 'splitter' && (
                   <div className="space-y-4">
                     <div>
                       <label className="text-[10px] tracking-widest font-bold text-slate-500 mb-1 block">חוקיות ניתוב</label>
                       <select 
                         value={selectedBlock.config.mode}
                         onChange={e => setBlocks(prev => ({...prev, [selectedBlock.id]: {...selectedBlock, state: { toggle: true, passes: 0 }, config: {...selectedBlock.config, mode: e.target.value}}}))}
                         className="w-full bg-white border border-slate-300 shadow-sm rounded-lg p-2 text-xs font-bold text-slate-700 focus:outline-none focus:border-[#4C97FF]"
                       >
                         <option value="alt">סיבובי (למעלה/למטה)</option>
                         <option value="cond">תנאי (סף מספרי)</option>
                       </select>
                     </div>
                     {selectedBlock.config.mode === 'cond' && (
                       <div>
                         <label className="text-[10px] tracking-widest font-bold text-slate-500 mb-1 block">שלח X ראשונים למעלה, והשאר למטה:</label>
                         <div className="flex items-center gap-2" dir="ltr">
                           <button onClick={() => setBlocks(prev => ({...prev, [selectedBlock.id]: {...selectedBlock, config: {...selectedBlock.config, threshold: Math.max(1, (selectedBlock.config.threshold || 1) - 1)}}}))} className="p-2 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-600 active:scale-95 shrink-0"><Minus size={16} /></button>
                           <input type="number" min="1" value={selectedBlock.config.threshold} onChange={e => setBlocks(prev => ({...prev, [selectedBlock.id]: {...selectedBlock, config: {...selectedBlock.config, threshold: parseInt(e.target.value) || 1}}}))} className="flex-1 min-w-0 bg-white border border-slate-300 shadow-sm rounded-lg p-2 text-xs font-bold text-slate-700 focus:outline-none focus:border-[#4C97FF] text-center" />
                           <button onClick={() => setBlocks(prev => ({...prev, [selectedBlock.id]: {...selectedBlock, config: {...selectedBlock.config, threshold: (selectedBlock.config.threshold || 1) + 1}}}))} className="p-2 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-600 active:scale-95 shrink-0"><Plus size={16} /></button>
                         </div>
                       </div>
                     )}
                   </div>
                 )}

               </div>
            ) : (
                <div className="space-y-6">
                  {/* Exercises */}
                  <div className="space-y-4">
                    <TaskCard 
                      title="1. המסלול הראשון שלי" 
                      lvl="מתחילים" 
                      desc="חבר מחולל אל קולט באמצעות נתיבים ומונה. צפה בפולס זורם והמונה עולה!" 
                      onShowHint={() => setHint([
                        [2, 4, 'generator', 0],
                        [3, 4, 'path', 0],
                        [4, 4, 'path', 0],
                        [5, 4, 'counter', 0],
                        [6, 4, 'sink', 0]
                      ])}
                    />
                    <TaskCard 
                      title="2. שוטר התנועה" 
                      lvl="ביניים" 
                      desc="בנה מחולל שנכנס אל מפצל (במצב סירוגין). חבר מונה ליציאה העליונה והתחתונה. הפעל למשך 10 פולסים — מה הם מראים?" 
                      onShowHint={() => setHint([
                        [2, 3, 'generator', 0],
                        [3, 3, 'path', 0],
                        [4, 3, 'splitter', 0],
                        [4, 2, 'counter', 0],
                        [4, 4, 'counter', 0],
                        [5, 2, 'sink', 0],
                        [5, 4, 'sink', 0]
                      ])}
                    />
                    <TaskCard 
                      title="3. רכבת הרים אינסופית" 
                      lvl="מתקדמים" 
                      desc="בנה מעגל סגור של נתיבים. הוסף השהיה בפנים. שלח פולס בודד וצפה בו מסתובב לנצח!" 
                      onShowHint={() => setHint([
                        [2, 2, 'corner', 3],
                        [3, 2, 'path', 0],
                        [4, 2, 'delay', 0],
                        [5, 2, 'path', 0],
                        [6, 2, 'corner', 0],
                        [6, 3, 'faster', 1],
                        [6, 4, 'faster', 1],
                        [6, 5, 'merger', 2],
                        [7, 5, 'generator', 2],
                        [5, 5, 'path', 2],
                        [4, 5, 'path', 2],
                        [3, 5, 'path', 2],
                        [2, 5, 'corner', 2],
                        [2, 4, 'slower', 3],
                        [2, 3, 'slower', 3],
                      ])}
                      onLoad={loadRollerCoaster}
                    />
                    <TaskCard 
                      title="4. מפעל המיון" 
                      lvl="מומחה" 
                      desc="הגדר מפצל עם תנאי (סף=3). נתב את החלק העליון לקולט אחד, ואת התחתון לאחר. צפה כיצד המערכת מסננת." 
                      onShowHint={() => setHint([
                        [2, 3, 'generator', 0],
                        [3, 3, 'path', 0],
                        [4, 3, 'splitter', 0],
                        [4, 2, 'path', 0],
                        [4, 4, 'path', 0],
                        [5, 2, 'sink', 0],
                        [5, 4, 'sink', 0]
                      ])}
                    />
                  </div>
                </div>
            )}
          </div>
        </aside>
      </div>

      {/* Mobile Floating Action Bar for Selected Tool */}
      {selectedCell && blocks[selectedCell] && (
        <div className="lg:hidden fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-800 text-white px-6 py-3 rounded-full shadow-2xl z-40 flex items-center gap-6 border border-slate-700 animate-in fade-in slide-in-from-bottom-5">
          <button onClick={rotateSelected} className="flex flex-col items-center justify-center gap-1 hover:text-blue-400 active:scale-95 transition-transform w-12">
            <RotateCw size={22} />
            <span className="text-[10px] font-bold tracking-wider mt-1">סובב</span>
          </button>
          <div className="w-px h-8 bg-slate-600"></div>
          <button onClick={() => setShowMobileRightSidebar(true)} className="flex flex-col items-center justify-center gap-1 hover:text-amber-400 active:scale-95 transition-transform w-12">
            <Settings2 size={22} />
            <span className="text-[10px] font-bold tracking-wider mt-1">מאפיינים</span>
          </button>
          <div className="w-px h-8 bg-slate-600"></div>
          <button onClick={deleteSelected} className="flex flex-col items-center justify-center gap-1 hover:text-red-400 active:scale-95 transition-transform w-12">
            <Trash2 size={22} />
            <span className="text-[10px] font-bold tracking-wider mt-1">מחק</span>
          </button>
        </div>
      )}

      {/* Help Modal */}
      <AnimatePresence>
        {showHelp && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm" dir="rtl">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[85vh] overflow-hidden flex flex-col border border-slate-200"
            >
              <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                    <Book size={24} />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-slate-800 tracking-tight">מדריך רכיבים</h2>
                    <p className="text-xs font-medium text-slate-500">הכירו את הלבנים השונות וכיצד הן פועלות יחד</p>
                  </div>
                </div>
                <button onClick={() => setShowHelp(false)} className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition-colors">
                  <X size={20} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {TOOLS.map(tool => (
                    <div key={tool.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex gap-4 items-start hover:border-[#4C97FF] hover:shadow-md transition-all">
                      <div className="shrink-0 flex items-center justify-center w-12 h-12 rounded-xl shadow-sm border border-black/10" style={{ backgroundColor: tool.color, color: tool.id !== 'generator' ? 'white' : '#784b00' }}>
                        <div dir="ltr"><tool.icon size={24} strokeWidth={2.5}/></div>
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-800 text-sm mb-1">{tool.label}</h3>
                        <p className="text-xs text-slate-600 leading-relaxed font-medium pr-1">
                          {tool.id === 'cursor' && 'כלי בחירה. השתמשו בו כדי ללחוץ על רכיבים שממוקמים על הלוח. כך תוכלו למחוק, לסובב, או להגדיר להם מאפיינים שונים בתפריט משמאל.'}
                          {tool.id === 'generator' && 'נקודת ההתחלה של הפולסים! גשו למאפיינים והגדירו אם לבצע שחרור אוטומטי (רציף) או באופן ידני בלחיצה.'}
                          {tool.id === 'path' && 'מעביר את הפולס ישר קדימה אל המשבצת הבאה בתור.'}
                          {tool.id === 'corner' && 'משנה את כיוון תנועת הפולס - מסובב אותו 90 מעלות ימינה ביחס לכיוון ממנו בא.'}
                          {tool.id === 'counter' && 'סופר ורושם כל פולס שעובר דרכו. ניתן בשלט המאפיינים להגדיר לו סף (הגבלה), כדי שיעצור את הפולסים הבאים לאחר שעבר את הכמות המותרת.'}
                          {tool.id === 'splitter' && 'מפצל פולסים המגיעים אליו למסלול עליון ולמסלול תחתון. אפשר להגדיר פיצול לפי סבב, או לפי סף כמותי (תנאי).'}
                          {tool.id === 'random' && 'אין לכם שליטה על מה שייצא מפה. הפולס שייכנס לכאן ימשיך ישר קדימה או יפנה הצידה, בהסתברות שווה של 50/50.'}
                          {tool.id === 'delay' && 'רכיב עיכוב - הוא ישהה את הפולס שנכנס אליו למשך מספר פעימות זמן (ניתן להגדרה) לפני שיאפשר לו להמשיך הלאה.'}
                          {tool.id === 'sink' && 'תחנה סופית! כאשר פולס פוגע בקולט, הוא מעיף אותו מהמסלול ונעלם.'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="p-4 border-t border-slate-100 bg-white flex justify-end">
                <button onClick={() => setShowHelp(false)} className="px-6 py-2 bg-[#4C97FF] hover:bg-[#3373CC] text-white font-bold rounded-lg shadow-sm transition-colors text-sm active:translate-y-[1px]">
                  הבנתי, בואו נתחיל
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function TaskCard({ title, desc, lvl, onLoad, onShowHint }: { title: string, desc: string, lvl: string, onLoad?: () => void, onShowHint?: () => void }) {
  return (
    <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm hover:border-[#4C97FF] hover:shadow-md transition-all cursor-pointer">
      <div className="flex items-center justify-between mb-2">
        <h4 className="font-bold text-slate-800 text-sm">{title}</h4>
        <span className={cn("text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-md", lvl === 'מתחילים' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : lvl === 'ביניים' ? 'bg-amber-100 text-amber-800 border border-amber-200' : 'bg-fuchsia-100 text-fuchsia-800 border border-fuchsia-200')}>{lvl}</span>
      </div>
      <p className="text-[11px] text-slate-500 leading-relaxed font-medium">{desc}</p>
      <div className="flex items-center gap-4 mt-3">
        {onLoad && (
          <div onClick={onLoad} className="text-[#4C97FF] hover:text-blue-700 text-[10px] font-bold tracking-widest uppercase flex items-center gap-1 transition-colors">
             טען פתרון <Play size={10} />
          </div>
        )}
        {onShowHint && (
          <div onClick={onShowHint} className="text-amber-500 hover:text-amber-600 text-[10px] font-bold tracking-widest uppercase flex items-center gap-1 transition-colors">
             הצג רמז <HelpCircle size={10} />
          </div>
        )}
      </div>
    </div>
  )
}
