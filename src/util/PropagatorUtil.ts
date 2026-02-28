import RenderablePropagator from '@/propagator/RenderablePropagator';
import { BaseWindow, Point, Rectangle, screen } from 'electron';

export function registerDraggableArea(
  propagator: RenderablePropagator, windowProvider: () => BaseWindow, setupMaximize?: true): void {
  let bounds: Rectangle;
  let startPos: Point;

  propagator.onRender('dragStart', () => {
    const win = windowProvider();
    if (win.isMaximized()) { return; }
    bounds = win.getBounds();
    startPos = screen.getCursorScreenPoint();
    startPos.x -= bounds.x;
    startPos.y -= bounds.y;
  });

  propagator.onRender('dragging', () => {
    const win = windowProvider();
    if (win.isMaximized()) { return; }
    const currentPos = screen.getCursorScreenPoint();
    bounds.x = currentPos.x - startPos.x;
    bounds.y = currentPos.y - startPos.y;
    win.setBounds(bounds);
  });

  if (!setupMaximize) { return; }

  propagator.onRender('maximize', () => {
    const win = windowProvider();
    win.isMaximized() ? win.unmaximize() : win.maximize();
  });
}
