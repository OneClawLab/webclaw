import React from 'react'

import { File, Menu, Command, PanelLeft, PanelRightOpen, BarChart, HelpCircle, ListTree, SquarePen, Maximize, Plus, Minus, X, Copy, Layers, Layers2, MessageCircleWarning, Square, Bold, Italic, FolderOpen, FolderClosed, Ellipsis, EllipsisVertical, CircleEllipsis, MessageCircleMore, ListCollapse, ChevronRight, ChevronDown, ArrowDownToLine, Save, Download, Pin, TableOfContents, TypeOutline, Underline, Strikethrough, Highlighter, Code, Link, Braces, IndentIncrease, IndentDecrease, Bug, Scissors, Eye, Target, Zap, CircleQuestionMark, Tally1, Tally2, Tally3, Tally4, RefreshCcw, ZoomIn, ZoomOut, RotateCw, FlaskConical, MessageCircle, Info, MessageCircleQuestionMark, MessageCircleCode, MessageCircleHeart, MessageCirclePlus, BrainCircuit, Brain, TriangleAlert, ChevronsLeftRightEllipsis, NotepadText, Binoculars, CopyMinus, CopyPlus, Dot, DotSquare, Grip, Heading, Heading1, Heading2, Heading3, Heading4, Heading5, Heading6, TreePine, Check, FilePlus, FolderPlus, Settings, Cog, Bell, ZapOff, ZapIcon, ChevronLeft, CheckCircle, CircleCheck, CircleAlert, Columns2, Library, ArrowLeftToLine, ArrowRightToLine, Activity, FileText, FileCode2, FileSpreadsheet, FileImage, FileAudio, FileVideo, FileArchive, FileLock2, Database, Terminal, Settings2, BookOpenText, CodeXml, Ampersands, Ampersand, Copyright, Ban, Clock, User, WifiOff } from 'lucide-react'

// 空图标：只占位，不显示任何内容
const EmptyIcon: React.FC<LucideIconProps> = ({
  size = 24,
  className,
  ...rest
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={className}
    {...rest}
  />
);

const iconMap: Record<string, React.FC<LucideIconProps>> = {
  WifiOff,
  User,
  Info,
  FlaskConical,
  ZoomIn,
  ZoomOut,
  RotateCw,
  RefreshCcw,

  Tally1,
  Tally2,
  Tally3,
  Tally4,

  Brain,
  BrainCircuit,
  Zap,
  Target,
  Eye,
  Scissors,
  Bug,
  Binoculars,
  Check,
  CircleCheck,
  CircleAlert,
  Columns2,

  Library,
  Layers,

  Minus,  
  Plus,
  CopyPlus,
  CopyMinus,
  FilePlus,
  FolderPlus,

  IndentIncrease,
  IndentDecrease,
  Link,
  Braces,
  Code,
  Highlighter,
  Strikethrough,
  Underline,
  Italic,
  Bold,

  Dot,
  DotSquare,  
  Ellipsis,
  EllipsisVertical,
  CircleEllipsis,
  ChevronsLeftRightEllipsis,
  Grip,

  MessageCircle,
  MessageCircleMore,
  MessageCircleCode,
  MessageCircleHeart,
  MessageCirclePlus,
  MessageCircleWarning,
  MessageCircleQuestionMark,

  CircleQuestionMark,
  ListCollapse,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Download,
  ArrowDownToLine,
  Save,
  Pin,
  TableOfContents,
  TypeOutline,
  NotepadText,
  Activity,

  File,
  FolderOpen,
  FolderClosed,

  Layers2,
  Maximize,
  Square,
  Copy,
  X,
  Menu,
  Command,
  PanelLeft,
  ListTree,
  TreePine,
  SquarePen,
  PanelRightOpen,
  BarChart,
  HelpCircle,
  Settings,
  Ban,
  Cog,
  Bell,
  ZapIcon,
  ZapOff,

  ArrowLeftToLine,
  ArrowRightToLine,
  
  Heading,
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  Heading5,
  Heading6,

  FileText,
  FileCode2,
  FileSpreadsheet,
  FileImage,
  CodeXml,
  FileAudio,
  FileVideo,
  FileArchive,
  FileLock2,
  Database,
  Copyright,
  Ampersand,
  Terminal,
  Settings2,
  BookOpenText,
  Clock,

  Unknown : TriangleAlert,  // 默认图标
  Default: TriangleAlert,   // 默认图标

  Empty: EmptyIcon, // 空图标
}

export interface LucideIconProps extends React.SVGProps<SVGSVGElement> {
  name: string
  size?: number
  strokeWidth?: number
  color?: string
  className?: string
}

export const LucideIcon: React.FC<LucideIconProps> = ({
  name,
  size = 24,
  strokeWidth=1.25,
  color = 'currentColor',
  className = '',
  ...rest
}) => {
  const Icon = iconMap[name]
  if (!Icon) {
    console.warn(`LucideIcon: icon "${name}" not found`)
    return null
  }

  return <Icon name={name} size={size} color={color} className={className} {...rest} />
}
