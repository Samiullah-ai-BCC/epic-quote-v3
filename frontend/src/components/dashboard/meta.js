import {
  IcClipboard, IcSpinner, IcImage, IcCheck, IcCard, IcShare, IcClock, IcHourglass, IcPause, IcX,
} from '../icons'

// status → pill colour (read status by colour, everywhere)
export const COLOR = {
  'To Do': 'gray', 'In Progress': 'blue', 'Artwork Needed': 'amber', 'Quote Approval Needed': 'pink',
  'Need Payment Link Sent': 'coral', 'Need To Share With Customer': 'teal',
  'Awaiting Customer Response': 'purple', 'Awaiting Rod Response': 'purple', 'Awaiting Sir Sami Response': 'purple',
  'On Hold': 'gray', 'Rejected by Client': 'coral', 'Out of Scope': 'gray',
  'Done': 'green',
}

// status → the next action the rep must take (the "needs attention" chip)
export const ACTION = {
  'Artwork Needed': 'Upload artwork', 'Quote Approval Needed': 'Get approval', 'Need Payment Link Sent': 'Send payment link',
  'Need To Share With Customer': 'Share with customer', 'Awaiting Customer Response': 'Chase customer',
  'Awaiting Rod Response': 'Chase Rod', 'Awaiting Sir Sami Response': 'Chase Sami',
}

// status → a stage icon for the pipeline grid
export const STATUS_ICON = {
  'To Do': IcClipboard, 'In Progress': IcSpinner, 'Artwork Needed': IcImage, 'Quote Approval Needed': IcCheck,
  'Need Payment Link Sent': IcCard, 'Need To Share With Customer': IcShare, 'Awaiting Customer Response': IcClock,
  'Awaiting Rod Response': IcHourglass, 'Awaiting Sir Sami Response': IcHourglass, 'On Hold': IcPause,
  'Rejected by Client': IcX, 'Out of Scope': IcX, 'Done': IcCheck,
}

export const ATTN = Object.keys(ACTION)

export const money = (n) => '$' + Number(n || 0).toLocaleString()
