import ApplicationService from '@/service/ApplicationService';
import { app } from 'electron';
import AppState from './AppState';
import { OS } from './data/Constants';
import Storage from './data/Storage';
import NavbarPropagator from './propagator/NavbarPropagator';
import PreferencesPropagator from './propagator/PreferencesPropagator';
import StatePropagator from './propagator/StatePropagator';
import TrayPropagator from './propagator/TrayPropagator';
import ViewPropagator from './propagator/ViewPropagator';
import FrameService from './service/FrameService';
import PageService from './service/PageService';
import ViewService from './service/ViewService';
import DialogUtil from './util/DialogUtil';

class Bootstrap {
  public initialize() {
    this.registerSecondInstanceEvent();
    ApplicationService.initialize();
    this.notifyAppReady();
    this.exposeTestBridge();
  }

  private registerSecondInstanceEvent() {
    app.on('second-instance', () => {
      const strings = AppState.strings;
      DialogUtil.notify(
        strings.notifications.secondInstance.title,
        strings.notifications.secondInstance.content,
      );
    });
  }

  private notifyAppReady() {
    const strings = AppState.strings;
    DialogUtil.notify(
      strings.notifications.onReady.title,
      OS.IS_WIN32 ? strings.notifications.onReady.content : strings.notifications.onReady.contentNonWin,
    );
  }

  private exposeTestBridge() {
    if (!process.env.HANDBOOK_E2E) { return; }
    // Expose singletons for Playwright electronApp.evaluate() access
    (globalThis as Record<string, unknown>).__handbook = {
      AppState,
      FrameService,
      PageService,
      ViewService,
      NavbarPropagator,
      ViewPropagator,
      PreferencesPropagator,
      TrayPropagator,
      StatePropagator,
      Storage,
    };
  }
}

export default new Bootstrap();
