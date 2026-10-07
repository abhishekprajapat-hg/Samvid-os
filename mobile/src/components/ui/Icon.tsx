import React from "react";
import type { StyleProp, ViewStyle } from "react-native";
import {
  Activity, AlertCircle, ArrowLeft, BarChart3, Bell, Building2, Calendar,
  CalendarDays, Camera, Check, CheckCheck,
  CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Circle,
  ClipboardList, Clock, Copy, CornerUpRight, Download, Eye, EyeOff, FileText,
  Filter, Home, LayoutGrid, List, Mail, Map, MapPin, Menu, MessageCircle,
  MessageSquare, MoreHorizontal, Paperclip, Pencil, Phone, PieChart, Plus,
  RefreshCw, Search, Send, Settings, Share2, ShieldCheck, SwitchCamera, Target,
  Trash2, TrendingUp, Trophy, User, UserCheck, UserCircle2, Users, Video, X,
  CheckSquare, CreditCard, Mic, MicOff, Pause, Play, Square, VideoOff,
  Volume1, Volume2, IndianRupee, ListTodo, TrendingDown, UserPlus, Zap,
  ArrowUpDown, Columns3, EllipsisVertical, Flag, ListChecks, SlidersHorizontal, Tag,
  XCircle, type LucideIcon,
} from "lucide-react-native";
import { palette } from "../../theme/tokens";
import { themePalette } from "../../theme/themedStyles";

/*
 * The single icon surface for the app.
 *
 * The web app draws every icon from lucide-react. Mobile had drifted onto
 * @expo/vector-icons Ionicons, so the tab bar was a different icon family from
 * web *and* from the rest of the app. This adapter puts everything on lucide -
 * the same family, and for the navigation icons literally the same glyphs
 * workbenchNavigation.js picks.
 *
 * It accepts the Ionicons names the existing screens already pass, so ~150 call
 * sites move over by swapping the component rather than being rewritten one at
 * a time. New code should use a semantic name from this map and, once the
 * legacy names are gone, the Ionicons aliases can be dropped.
 */

const ICONS: Record<string, LucideIcon> = {
  /* ---- semantic names (prefer these in new code) ---- */
  dashboard: Home,
  leads: Users,
  inventory: Building2,
  projects: LayoutGrid,
  finance: PieChart,
  reports: ClipboardList,
  leaderboard: Trophy,
  targets: Target,
  calendar: Calendar,
  tasks: CheckCircle2,
  attendance: UserCheck,
  chat: MessageSquare,
  coworking: Building2,
  admin: ShieldCheck,
  settings: Settings,
  profile: UserCircle2,
  notifications: Bell,
  more: Menu,
  fieldOps: Map,
  trend: TrendingUp,
  trendDown: TrendingDown,
  activity: Activity,
  revenue: IndianRupee,
  todo: ListTodo,
  calendarDays: CalendarDays,
  addUser: UserPlus,
  quickAction: Zap,
  pieChart: PieChart,
  barChart: BarChart3,
  sort: ArrowUpDown,
  flag: Flag,
  board: Columns3,
  sliders: SlidersHorizontal,
  "ellipsis-vertical": EllipsisVertical,
  tag: Tag,
  subtasks: ListChecks,

  /* ---- Ionicons aliases, kept so existing screens keep working ---- */
  "alert-circle-outline": AlertCircle,
  "arrow-back": ArrowLeft,
  "arrow-redo-outline": CornerUpRight,
  attach: Paperclip,
  "calendar-outline": Calendar,
  call: Phone,
  "call-outline": Phone,
  "camera-outline": Camera,
  "camera-reverse-outline": SwitchCamera,
  checkmark: Check,
  "checkmark-circle-outline": CheckCircle2,
  "checkmark-done": CheckCheck,
  "chevron-back": ChevronLeft,
  "chevron-down": ChevronDown,
  "chevron-down-outline": ChevronDown,
  "chevron-up": ChevronUp,
  "chevron-forward": ChevronRight,
  close: X,
  "close-circle": XCircle,
  "copy-outline": Copy,
  "create-outline": Pencil,
  "document-text-outline": FileText,
  "download-outline": Download,
  "eye-outline": Eye,
  "eye-off-outline": EyeOff,
  "funnel-outline": Filter,
  list: List,
  "location-outline": MapPin,
  // lucide carries no brand marks; a message glyph is the honest stand-in.
  "logo-whatsapp": MessageCircle,
  "mail-outline": Mail,
  "paper-plane": Send,
  "paper-plane-outline": Send,
  "people-outline": Users,
  "person-outline": User,
  "ellipsis-horizontal": MoreHorizontal,
  add: Plus,
  refresh: RefreshCw,
  search: Search,
  "share-social-outline": Share2,
  "time-outline": Clock,
  "trash-outline": Trash2,
  "videocam-outline": Video,

  /*
   * Names only ever passed as an expression - the call controls, the
   * checkboxes, the request-kind glyphs. The first sweep of this map was built
   * from literal name="..." props, so every one of these was silently
   * rendering nothing.
   */
  mic: Mic,
  "mic-off": MicOff,
  videocam: Video,
  "videocam-off": VideoOff,
  "volume-high": Volume2,
  "volume-medium": Volume1,
  pause: Pause,
  play: Play,
  stop: Square,
  checkbox: CheckSquare,
  "square-outline": Square,
  sync: RefreshCw,
  card: CreditCard,
  business: Building2,

  /* ---- tab-bar aliases, aligned to the web nav's own glyph choices ---- */
  speedometer: Home,
  people: Users,
  cube: Building2,
  time: UserCheck,
  "bar-chart": ClipboardList,
  wallet: PieChart,
  chatbubble: MessageSquare,
  "person-circle": Users,
  trophy: Trophy,
  person: UserCircle2,
  menu: Menu,
  map: Map,
  ellipse: Circle,
};

export type IconName = keyof typeof ICONS | string;

/*
 * Ionicons ships a filled and an outline cut of most glyphs and the screens use
 * the suffix to pick between them. Lucide has one stroke style, so an unmapped
 * "-outline" name falls back to its base name rather than rendering nothing.
 */
const resolve = (name: string): LucideIcon | null => {
  if (ICONS[name]) return ICONS[name];
  const base = name.replace(/-outline$/, "");
  return ICONS[base] || null;
};

export const Icon = ({
  name,
  size = 18,
  color = themePalette.slate[600],
  strokeWidth = 2,
  style,
}: {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
  style?: StyleProp<ViewStyle>;
}) => {
  const Glyph = resolve(String(name));
  if (!Glyph) {
    if (__DEV__) console.warn(`Icon: no lucide glyph mapped for "${name}"`);
    return null;
  }
  return <Glyph size={size} color={color} strokeWidth={strokeWidth} style={style} />;
};

export default Icon;
