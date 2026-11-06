import * as React from 'react';

// Import rounded SVGs as React components via SVGR
import HomeSvg from '@material-symbols/svg-400/rounded/home.svg?react';
import FolderSvg from '@material-symbols/svg-400/rounded/folder.svg?react';
import FolderOpenSvg from '@material-symbols/svg-400/rounded/folder_open.svg?react';
import SearchSvg from '@material-symbols/svg-400/rounded/search.svg?react';
import DescriptionSvg from '@material-symbols/svg-400/rounded/description.svg?react';
import TerminalSvg from '@material-symbols/svg-400/rounded/terminal.svg?react';
import CodeSvg from '@material-symbols/svg-400/rounded/code.svg?react';
import ChatSvg from '@material-symbols/svg-400/rounded/chat.svg?react';
import AccountTreeSvg from '@material-symbols/svg-400/rounded/account_tree.svg?react';
import ListSvg from '@material-symbols/svg-400/rounded/list.svg?react';
import ViewListSvg from '@material-symbols/svg-400/rounded/view_list.svg?react';
import AddSvg from '@material-symbols/svg-400/rounded/add.svg?react';
import DeleteSvg from '@material-symbols/svg-400/rounded/delete.svg?react';
import RefreshSvg from '@material-symbols/svg-400/rounded/refresh.svg?react';
import SyncSvg from '@material-symbols/svg-400/rounded/sync.svg?react';
import ContentCopySvg from '@material-symbols/svg-400/rounded/content_copy.svg?react';
import CheckSvg from '@material-symbols/svg-400/rounded/check.svg?react';
import CheckCircleSvg from '@material-symbols/svg-400/rounded/check_circle.svg?react';
import CloseSvg from '@material-symbols/svg-400/rounded/close.svg?react';
import ErrorSvg from '@material-symbols/svg-400/rounded/error.svg?react';
import WarningSvg from '@material-symbols/svg-400/rounded/warning.svg?react';
import InfoSvg from '@material-symbols/svg-400/rounded/info.svg?react';
import MoreVertSvg from '@material-symbols/svg-400/rounded/more_vert.svg?react';
import MoreHorizSvg from '@material-symbols/svg-400/rounded/more_horiz.svg?react';
import KeyboardArrowDownSvg from '@material-symbols/svg-400/rounded/keyboard_arrow_down.svg?react';
import KeyboardArrowUpSvg from '@material-symbols/svg-400/rounded/keyboard_arrow_up.svg?react';
import ChevronRightSvg from '@material-symbols/svg-400/rounded/chevron_right.svg?react';
import ChevronLeftSvg from '@material-symbols/svg-400/rounded/chevron_left.svg?react';
import ArrowBackSvg from '@material-symbols/svg-400/rounded/arrow_back.svg?react';
import ArrowForwardSvg from '@material-symbols/svg-400/rounded/arrow_forward.svg?react';
import OpenInNewSvg from '@material-symbols/svg-400/rounded/open_in_new.svg?react';
import SendSvg from '@material-symbols/svg-400/rounded/send.svg?react';
import StopCircleSvg from '@material-symbols/svg-400/rounded/stop_circle.svg?react';
import FilterListSvg from '@material-symbols/svg-400/rounded/filter_list.svg?react';
import TuneSvg from '@material-symbols/svg-400/rounded/tune.svg?react';
import ScheduleSvg from '@material-symbols/svg-400/rounded/schedule.svg?react';
import KeepSvg from '@material-symbols/svg-400/rounded/keep.svg?react';
import KeepFillSvg from '@material-symbols/svg-400/rounded/keep-fill.svg?react';
import SecuritySvg from '@material-symbols/svg-400/rounded/security.svg?react';
import VerifiedSvg from '@material-symbols/svg-400/rounded/verified.svg?react';
import HubSvg from '@material-symbols/svg-400/rounded/hub.svg?react';
import CategorySvg from '@material-symbols/svg-400/rounded/category.svg?react';
import DataObjectSvg from '@material-symbols/svg-400/rounded/data_object.svg?react';
import LayersSvg from '@material-symbols/svg-400/rounded/layers.svg?react';
import LockSvg from '@material-symbols/svg-400/rounded/lock.svg?react';
import LogoutSvg from '@material-symbols/svg-400/rounded/logout.svg?react';
import PersonSvg from '@material-symbols/svg-400/rounded/person.svg?react';
import HelpSvg from '@material-symbols/svg-400/rounded/help.svg?react';
import CommitSvg from '@material-symbols/svg-400/rounded/commit.svg?react';
import AltRouteSvg from '@material-symbols/svg-400/rounded/alt_route.svg?react';
import CallSplitSvg from '@material-symbols/svg-400/rounded/call_split.svg?react';
import DnsSvg from '@material-symbols/svg-400/rounded/dns.svg?react';
import MemorySvg from '@material-symbols/svg-400/rounded/memory.svg?react';
import PsychologySvg from '@material-symbols/svg-400/rounded/psychology.svg?react';
import LightModeSvg from '@material-symbols/svg-400/rounded/light_mode.svg?react';
import DarkModeSvg from '@material-symbols/svg-400/rounded/dark_mode.svg?react';

export const ICON_MAP: Record<string, React.FC<React.SVGProps<SVGSVGElement>>> = {
  home: HomeSvg,
  dashboard: HomeSvg,
  folder: FolderSvg,
  folder_open: FolderOpenSvg,
  folder_special: FolderSvg,
  search: SearchSvg,
  description: DescriptionSvg,
  terminal: TerminalSvg,
  code: CodeSvg,
  chat: ChatSvg,
  chat_bubble: ChatSvg,
  chat_bubble_outline: ChatSvg,
  account_tree: AccountTreeSvg,
  list: ListSvg,
  view_list: ViewListSvg,
  add: AddSvg,
  add_circle: AddSvg,
  delete: DeleteSvg,
  refresh: RefreshSvg,
  restart_alt: RefreshSvg,
  sync: SyncSvg,
  content_copy: ContentCopySvg,
  check: CheckSvg,
  check_circle: CheckCircleSvg,
  close: CloseSvg,
  error: ErrorSvg,
  error_outline: ErrorSvg,
  warning: WarningSvg,
  info: InfoSvg,
  more_vert: MoreVertSvg,
  more_horiz: MoreHorizSvg,
  expand_more: KeyboardArrowDownSvg,
  expand_less: KeyboardArrowUpSvg,
  keyboard_arrow_down: KeyboardArrowDownSvg,
  keyboard_arrow_up: KeyboardArrowUpSvg,
  chevron_right: ChevronRightSvg,
  chevron_left: ChevronLeftSvg,
  arrow_back: ArrowBackSvg,
  arrow_forward: ArrowForwardSvg,
  arrow_downward: KeyboardArrowDownSvg,
  arrow_outward: OpenInNewSvg,
  open_in_new: OpenInNewSvg,
  send: SendSvg,
  stop_circle: StopCircleSvg,
  filter_list: FilterListSvg,
  tune: TuneSvg,
  schedule: ScheduleSvg,
  push_pin: KeepSvg,
  pin_drop: KeepSvg,
  keep: KeepSvg,
  'keep-fill': KeepFillSvg,
  security: SecuritySvg,
  verified: VerifiedSvg,
  verified_user: VerifiedSvg,
  hub: HubSvg,
  category: CategorySvg,
  data_object: DataObjectSvg,
  layers: LayersSvg,
  lock: LockSvg,
  logout: LogoutSvg,
  person: PersonSvg,
  account_circle: PersonSvg,
  help: HelpSvg,
  commit: CommitSvg,
  alt_route: AltRouteSvg,
  call_split: CallSplitSvg,
  dns: DnsSvg,
  memory: MemorySvg,
  auto_awesome: PsychologySvg,
  sparkles: PsychologySvg,
  light_mode: LightModeSvg,
  dark_mode: DarkModeSvg,
  sun: LightModeSvg,
  moon: DarkModeSvg,
};

export type IconName = keyof typeof ICON_MAP;

