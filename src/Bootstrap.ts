import ApplicationService from '@/service/ApplicationService';
import { app } from 'electron';
import AppState from './AppState';
import { OS } from './data/Constants';
import DialogUtil from './util/DialogUtil';

class Bootstrap {
  public initialize() {
    this.registerSecondInstanceEvent();
    ApplicationService.initialize();
    this.notifyAppReady();
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
}

export default new Bootstrap();
