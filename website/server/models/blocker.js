// Stub: blocker model removed — IP blocking feature stripped.
import { EventEmitter } from 'events';

const noop = new EventEmitter();

export const model = {
  watchBlockers: () => noop,
};
export const schema = { paths: {} };
