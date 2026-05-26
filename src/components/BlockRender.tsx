import React from 'react';
import { BlockData } from '../types';

export const SvgBase = ({ type }: { type: string }) => {
  switch (type) {
    case 'generator':
      return (
        <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-sm">
          <rect x="15" y="15" width="70" height="70" rx="16" fill="#FFBF00" stroke="#CC9900" strokeWidth="4" />
          <path d="M 40 35 L 40 65 L 65 50 Z" className="fill-white" />
          <line x1="85" y1="50" x2="100" y2="50" stroke="#CC9900" strokeWidth="12" strokeLinecap="round" />
        </svg>
      );
    case 'path':
      return (
        <svg viewBox="0 0 100 100" className="w-full h-full text-slate-500">
          <line x1="0" y1="50" x2="100" y2="50" stroke="#4C97FF" strokeWidth="16" strokeLinecap="round" />
        </svg>
      );
    case 'corner':
      return (
        <svg viewBox="0 0 100 100" className="w-full h-full text-slate-500">
          <path d="M 0 50 Q 50 50 50 100" fill="none" stroke="#4C97FF" strokeWidth="16" strokeLinecap="round" />
        </svg>
      );
    case 'splitter':
      return (
        <svg viewBox="0 0 100 100" className="w-full h-full text-amber-500">
          <path d="M 0 50 L 50 50 M 50 50 L 50 0 M 50 50 L 50 100" fill="none" stroke="#FFAB19" strokeWidth="16" strokeLinecap="round" />
          <circle cx="50" cy="50" r="18" fill="#FFAB19" stroke="#CF8B17" strokeWidth="4" />
        </svg>
      );
    case 'merger':
      return (
        <svg viewBox="0 0 100 100" className="w-full h-full text-amber-500">
          <path d="M 50 100 L 50 50 M 50 0 L 50 50 M 0 50 L 100 50" fill="none" stroke="#FFAB19" strokeWidth="16" strokeLinecap="round" />
          <polygon points="75,35 100,50 75,65" fill="#FFAB19" />
          <circle cx="50" cy="50" r="14" fill="white" stroke="#FFAB19" strokeWidth="6" />
        </svg>
      );
    case 'random':
      return (
        <svg viewBox="0 0 100 100" className="w-full h-full text-fuchsia-500">
          <path d="M 0 50 L 50 50 M 50 50 L 50 0 M 50 50 L 50 100" fill="none" stroke="#59C059" strokeWidth="16" strokeLinecap="round" />
          <rect x="35" y="35" width="30" height="30" rx="6" fill="#59C059" stroke="#389438" strokeWidth="4" />
          <circle cx="43" cy="43" r="3" className="fill-white" />
          <circle cx="57" cy="57" r="3" className="fill-white" />
        </svg>
      );
    case 'delay':
      return (
        <svg viewBox="0 0 100 100" className="w-full h-full text-orange-500">
          <line x1="0" y1="50" x2="100" y2="50" stroke="#FFAB19" strokeWidth="16" strokeLinecap="round" />
          <path d="M 35 25 L 65 25 L 50 50 L 65 75 L 35 75 L 50 50 Z" fill="#FFAB19" stroke="#CF8B17" strokeWidth="4" strokeLinejoin="round" />
        </svg>
      );
    case 'counter':
      return (
        <svg viewBox="0 0 100 100" className="w-full h-full text-slate-500">
          <line x1="0" y1="50" x2="100" y2="50" stroke="#FF8C1A" strokeWidth="16" strokeLinecap="round" />
          <rect x="25" y="25" width="50" height="50" rx="10" fill="white" stroke="#FF8C1A" strokeWidth="6" />
        </svg>
      );
    case 'sink':
      return (
        <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-sm">
          <line x1="0" y1="50" x2="30" y2="50" stroke="#FF6680" strokeWidth="16" strokeLinecap="round" />
          <circle cx="60" cy="50" r="30" fill="#FF6680" stroke="#FF3355" strokeWidth="4" />
          <circle cx="60" cy="50" r="16" className="fill-white" />
        </svg>
      );
    case 'faster':
      return (
        <svg viewBox="0 0 100 100" className="w-full h-full text-cyan-500">
          <line x1="0" y1="50" x2="100" y2="50" stroke="#00ccff" strokeWidth="16" strokeLinecap="round" />
          <path d="M 30 30 L 60 50 L 30 70 Z" fill="white" />
          <path d="M 50 30 L 80 50 L 50 70 Z" fill="white" />
        </svg>
      );
    case 'slower':
      return (
        <svg viewBox="0 0 100 100" className="w-full h-full text-orange-800">
          <line x1="0" y1="50" x2="100" y2="50" stroke="#a0522d" strokeWidth="16" strokeLinecap="round" />
          <path d="M 70 30 L 40 50 L 70 70 Z" fill="white" />
          <path d="M 50 30 L 20 50 L 50 70 Z" fill="white" />
        </svg>
      );
    default:
      return null;
  }
};

export const HtmlOverlay = ({ block }: { block: BlockData }) => {
  if (block.type === 'counter') {
    const isLimited = block.config.limit > 0 && block.state.count >= block.config.limit;
    return (
      <div className={`absolute inset-0 flex items-center justify-center pointer-events-none z-10 font-mono text-xl font-black ${isLimited ? 'text-[#FF6680]' : 'text-[#FF8C1A]'}`}>
        <div className="flex flex-col items-center justify-center pt-1">
          <span>{block.state.count || 0}</span>
          {block.config.limit > 0 && <span className="text-[10px] -mt-1 opacity-70 leading-none">/{block.config.limit}</span>}
        </div>
      </div>
    );
  }
  
  if (block.type === 'splitter') {
     // show arrow indicating next path
     const willGoUp = block.config.mode === 'alt' ? block.state.toggle : (block.state.passes < block.config.threshold);
     return (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10 transition-all">
            <span className={`text-white font-black drop-shadow-md ${willGoUp ? '-mt-6' : 'mt-6'}`}>
                {willGoUp ? '\u2191' : '\u2193'}
            </span>
        </div>
     );
  }
  return null;
};
