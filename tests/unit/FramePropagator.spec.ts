import { BaseWindow } from 'electron';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FramePropagator } from '../../src/propagator/FramePropagator';

describe('FramePropagator', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('routes frame lifecycle events', () => {
    const propagator = new FramePropagator();
    const frame = new BaseWindow();

    const showListener = vi.fn();
    const hideListener = vi.fn();
    const focusListener = vi.fn();
    const blurListener = vi.fn();
    const modalFocusListener = vi.fn();
    const modalBlurListener = vi.fn();

    propagator.on('show', showListener);
    propagator.on('hide', hideListener);
    propagator.on('focus', focusListener);
    propagator.on('blur', blurListener);
    propagator.on('modal-focus', modalFocusListener);
    propagator.on('modal-blur', modalBlurListener);

    propagator.propagate(frame);

    frame.emit('show');
    frame.emit('hide');
    frame.emit('focus');
    frame.emit('blur');
    frame.emit('modal-focus');
    frame.emit('modal-blur');

    expect(showListener).toHaveBeenCalledTimes(1);
    expect(hideListener).toHaveBeenCalledTimes(1);
    expect(focusListener).toHaveBeenCalledTimes(1);
    expect(blurListener).toHaveBeenCalledTimes(1);
    expect(modalFocusListener).toHaveBeenCalledTimes(1);
    expect(modalBlurListener).toHaveBeenCalledTimes(1);
  });

  it('debounces move events into a single moved event', () => {
    const propagator = new FramePropagator();
    const frame = new BaseWindow();
    const movedListener = vi.fn();

    propagator.on('moved', movedListener);
    propagator.propagate(frame);

    frame.emit('move');
    frame.emit('move');
    frame.emit('move');

    vi.advanceTimersByTime(199);
    expect(movedListener).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(movedListener).toHaveBeenCalledTimes(1);
  });

  it('emits resize immediately and resized after debounce window', () => {
    const propagator = new FramePropagator();
    const frame = new BaseWindow();
    const resizeListener = vi.fn();
    const resizedListener = vi.fn();

    propagator.on('resize', resizeListener);
    propagator.on('resized', resizedListener);
    propagator.propagate(frame);

    frame.emit('resize');

    expect(resizeListener).toHaveBeenCalledTimes(1);
    expect(resizedListener).not.toHaveBeenCalled();

    vi.advanceTimersByTime(200);
    expect(resizedListener).toHaveBeenCalledTimes(1);

    frame.emit('resize');
    vi.advanceTimersByTime(100);
    frame.emit('resize');

    expect(resizeListener).toHaveBeenCalledTimes(3);

    vi.advanceTimersByTime(199);
    expect(resizedListener).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(1);
    expect(resizedListener).toHaveBeenCalledTimes(2);
  });

  it('does not register duplicate handlers when propagated twice', () => {
    const propagator = new FramePropagator();
    const frame = new BaseWindow();
    const showListener = vi.fn();

    propagator.on('show', showListener);
    propagator.propagate(frame);
    propagator.propagate(frame);

    frame.emit('show');

    expect(showListener).toHaveBeenCalledTimes(1);
  });
});
