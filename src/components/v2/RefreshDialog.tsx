/**
 * RefreshDialog - Re-export from modular components
 *
 * This file maintains backwards compatibility.
 * The actual implementation is in ./refresh-dialog/
 */

export {
  RefreshDialog,
  RefreshDialog as default,
} from './refresh-dialog';

export type {
  RefreshDialogProps,
  V2RefreshResult,
  LegacyRefreshResult,
  SourceData,
} from './refresh-dialog';
