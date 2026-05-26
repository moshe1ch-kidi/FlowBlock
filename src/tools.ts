import { ArrowRight, CornerRightDown, Split, Zap, Timer, HelpCircle, Target, ArrowDown10, MousePointer2, Rabbit, Turtle, GitMerge } from 'lucide-react';

export const TOOLS = [
  { id: 'cursor', label: 'בחירה', icon: MousePointer2, color: '#94a3b8' },
  { id: 'generator', label: 'מחולל', icon: Zap, color: '#FFBF00' },
  { id: 'path', label: 'נתיב', icon: ArrowRight, color: '#4C97FF' },
  { id: 'corner', label: 'פנייה', icon: CornerRightDown, color: '#4C97FF' },
  { id: 'counter', label: 'מונה', icon: ArrowDown10, color: '#FF8C1A' },
  { id: 'splitter', label: 'מפצל', icon: Split, color: '#FFAB19' },
  { id: 'merger', label: 'ממזג', icon: GitMerge, color: '#FFAB19' },
  { id: 'random', label: 'אקראיות', icon: HelpCircle, color: '#59C059' },
  { id: 'delay', label: 'השהיה', icon: Timer, color: '#FFAB19' },
  { id: 'faster', label: 'מאיץ', icon: Rabbit, color: '#00ccff' },
  { id: 'slower', label: 'מאיט', icon: Turtle, color: '#a0522d' },
  { id: 'sink', label: 'קולט / סיום', icon: Target, color: '#FF6680' },
];

