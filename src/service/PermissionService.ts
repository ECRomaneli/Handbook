import AppState from '@/AppState';
import { IsDebug, Permission } from '@/data/Constants';
import Storage from '@/data/Storage';
import PreferencesService from '@/service/PreferencesService';
import Dialog from '@/util/modal/Dialog';
import ScreenShareModal from '@/util/modal/ScreenShareModal';
import PromiseQueue from '@/util/PromiseQueue';
import WindowUtil from '@/util/WindowUtil';
import { app, DisplayMediaRequestHandlerHandlerRequest, FilesystemPermissionRequest, MediaAccessPermissionRequest, OpenExternalPermissionRequest, PermissionCheckHandlerHandlerDetails, PermissionRequest, Response, Session, Streams, systemPreferences, WebContents } from 'electron';

type CheckablePermissions = 'clipboard-read' | 'clipboard-sanitized-write' | 'geolocation' | 'fullscreen' | 'hid' |
  'idle-detection' | 'media' | 'mediaKeySystem' | 'midi' | 'midiSysex' | 'notifications' | 'openExternal' |
  'pointerLock' | 'serial' | 'storage-access' | 'top-level-storage-access' | 'usb' | 'deprecated-sync-clipboard-read' |
  'fileSystem' | 'background-sync';

type RequestablePermissions = 'clipboard-read' | 'clipboard-sanitized-write' | 'display-capture' | 'fullscreen' |
  'geolocation' | 'idle-detection' | 'media' | 'mediaKeySystem' | 'midi' | 'midiSysex' | 'notifications' |
  'pointerLock' | 'keyboardLock' | 'openExternal' | 'speaker-selection' | 'storage-access' |
  'top-level-storage-access' | 'window-management' | 'unknown' | 'fileSystem';

type SecureWebContents = WebContents & { __TEMP_PERMISSIONS__?: string[] };

type PermissionDetails =
  (PermissionRequest) |
  (FilesystemPermissionRequest) |
  (MediaAccessPermissionRequest) |
  (OpenExternalPermissionRequest);

interface DependencyProvider {
  getSessionByWebContents(webContents: WebContents): string | undefined;
  getWindow(): Electron.BaseWindow | undefined;
}

class PermissionService {
  private readonly isDebug = IsDebug.permissions;
  private screenShareModal: ScreenShareModal = new ScreenShareModal();
  private queue: PromiseQueue = new PromiseQueue();
  private provider = {} as DependencyProvider;

  public setupPermissionsHandler(dependencyProvider: DependencyProvider): void {
    this.provider = dependencyProvider;
    const requestPermissionsHandler = this.requestPermissions.bind(this);
    const checkPermissionsHandler = this.checkPermissions.bind(this);
    const shareMediaHandler = this.shareMedia.bind(this);
    const pairingHandler = (_: unknown, c: (response: Response) => void) => c({ confirmed: false });

    app.prependListener('session-created', (s: Session) => {
      this.isDebug && console.debug('Session created:', s.storagePath);
      s.setPermissionRequestHandler(requestPermissionsHandler);
      s.setPermissionCheckHandler(checkPermissionsHandler);
      s.setDisplayMediaRequestHandler(shareMediaHandler);
      s.setBluetoothPairingHandler(pairingHandler);
      // s.setDevicePermissionHandler(/* DEFAULT */)
    });
  }

  private async shareMedia(
    request: DisplayMediaRequestHandlerHandlerRequest, callback: (streams: Streams) => void): Promise<void> {
    const window = this.provider.getWindow();

    if (window === undefined) {
      console.error('The current window is no longer available.');
      return callback({});
    }

    const source = await this.screenShareModal.request({
      requesterUrl: request.securityOrigin,
      shareAudioBtn: request.audioRequested,
      parent: window,
    });

    if (source === undefined) { return callback({}); }
    const stream: Streams = { video: source };
    if (request.audioRequested && source.shareAudio) { stream.audio = 'loopback'; }
    callback(stream);
  }

  // eslint-disable-next-line @stylistic/max-len
  private checkPermissions(webContents: WebContents | null, permission: CheckablePermissions, requestingOrigin: string, details: PermissionCheckHandlerHandlerDetails): boolean {
    if (permission === 'background-sync' ||
      permission === 'top-level-storage-access' ||
      permission === 'notifications') { return false; } // Background sync is not supported
    if (webContents === null) {
      console.error('Permission check with null webContents');
      console.debug(permission, requestingOrigin, details);
      return false;
    }

    const session = this.provider.getSessionByWebContents(webContents);
    if (session === undefined) { return false; }

    const url = this.createValidURL(
      details.requestingUrl, details.embeddingOrigin, details.securityOrigin, requestingOrigin);
    if (url === undefined) {
      console.error('Permission request without URL or origin:', permission || 'unknown');
      return false;
    }

    const origin = url.protocol === 'file:' ? url.pathname : url.origin;

    permission = this.formatPermission(permission, details.mediaType);

    const result = false !== this.isAllowed(webContents, session, origin, permission);
    this.isDebug && console.debug('Permission check:', permission, 'for', origin, 'result:', result);
    return result;
  }

  // eslint-disable-next-line @stylistic/max-len
  private async requestPermissions(webContents: WebContents, permission: RequestablePermissions, callback: (granted: boolean) => void, details: PermissionDetails): Promise<void> {
    if (!webContents || webContents.isDestroyed()) {
      console.error('Permission request with invalid webContents');
      console.debug(permission, details);
      return callback(false);
    }

    const session = this.provider.getSessionByWebContents(webContents);
    if (session === undefined) {
      console.error('Permission request with no session');
      console.debug(permission, details);
      return callback(false);
    }

    const url = this.createValidURL(details.requestingUrl, (details as MediaAccessPermissionRequest).securityOrigin);

    if (url === undefined) {
      console.error('Permission request without URL or origin:', permission || 'unknown');
      return callback(false);
    }

    const origin = url.protocol === 'file:' ? url.pathname : url.origin;
    const type = this.getRequestType(details);

    let permissionsToRequest: RequestablePermissions[];

    switch (type) {
      case Permission.Type.MEDIA_ACCESS:
        permissionsToRequest = (details as MediaAccessPermissionRequest).mediaTypes?.
          map((mt: string) => this.formatPermission(permission, mt)) ?? [];
        break;
      default: permissionsToRequest = [this.formatPermission(permission)];
    }
    return callback(true === await this.queue.push(() =>
      this.requestPermission(webContents, session, origin, permissionsToRequest)));
  }

  // eslint-disable-next-line @stylistic/max-len
  private isAllowed(webContents: SecureWebContents, session: string, url: string, permission: string): boolean | undefined {
    if (this.allowTemporaryPermission(webContents, permission)) { return true; }

    const status = Storage.getPermissions(session, url, permission) as string;

    if (status === Permission.Status.ALLOW) { return true; }
    if (status === Permission.Status.DENY) { return false; }
    return undefined;
  }

  // eslint-disable-next-line @stylistic/max-len
  private async requestPermission(webContents: WebContents, session: string, url: string, permissions: string[]): Promise<boolean> {
    const permissionsToRequest: string[] = [];
    for (const permission of permissions) {
      const status = this.isAllowed(webContents, session, url, permission);
      if (status === false) { return false; }
      if (status === undefined) {
        // TODO: Validate this
        const systemPermission = await PermissionService.checkSystemPermission(permission);
        if (systemPermission === false) { return false; }
        permissionsToRequest.push(permission);
      }
    }
    if (permissionsToRequest.length === 0) { return true; }
    return await this.askPermissionAndSaveStatus(webContents, {
      session,
      url,
      permissions: permissionsToRequest,
    });
  }

  private static async checkSystemPermission(permission: string): Promise<boolean> {
    if (process.platform !== 'darwin' && process.platform !== 'win32') { return true; }

    const mediaAccess = permission === 'media: video' ? 'camera' :
      permission === 'media: audio' ? 'microphone' : null;
    if (mediaAccess === null) { return true; }

    if (systemPreferences.getMediaAccessStatus(mediaAccess) === 'granted') { return true; }
    return await systemPreferences.askForMediaAccess(mediaAccess);
  }

  private static getHumanReadablePermissions(permissions: string[]): string[] {
    return permissions.map((p) => AppState.strings.permission.text[p] ?? p);
  }

  // eslint-disable-next-line @stylistic/max-len
  private async askPermissionAndSaveStatus(webContents: WebContents, data: { session: string; url: string; permissions: string[] }): Promise<boolean> {
    const parent = WindowUtil.getWindowFromWebContents(webContents);

    if (parent === undefined) {
      console.error('The frame is no longer available');
      return false;
    }

    const humanReadablePermissions = PermissionService.getHumanReadablePermissions(data.permissions);
    const p = AppState.strings.permission;
    const permissions = '\n - ' + humanReadablePermissions.join('\n - ');
    const result = await Dialog.show(
      parent.isVisible() ? parent : null,
      {
        // icon: Path.LOGO,
        type: 'question',
        title: p.request,
        message: p.message.replace('{origin}', data.url).replace('{permissions}', permissions),
        buttons: [p.allow, p.allowOnce, p.deny, p.askLater],
        defaultId: 3,
        cancelId: 3,
        textWidth: 600,
      },
    );

    const status = result.response === 0 ? Permission.Status.ALLOW :
      result.response === 1 ? Permission.Status.ALLOW_ONCE :
        result.response === 2 ? Permission.Status.DENY :
          Permission.Status.ASK;

    this.isDebug && console.debug('Perm request: [', data.permissions.join(', '), '] for', data.url, 'result:', status);
    if (status !== Permission.Status.ALLOW_ONCE) {
      for (const permission of data.permissions) {
        Storage.setPermission(data.session, data.url, permission, status);
      }
      PreferencesService.permissionsUpdated();
      return status === Permission.Status.ALLOW;
    }
    for (const permission of data.permissions) {
      this.setTemporaryPermission(webContents as SecureWebContents, permission);
      Storage.setPermission(data.session, data.url, permission, Permission.Status.ASK);
    }
    PreferencesService.permissionsUpdated();
    return true;
  }

  private setTemporaryPermission(webContents: SecureWebContents, permission: string): void {
    if (webContents.__TEMP_PERMISSIONS__ === undefined) {
      webContents.__TEMP_PERMISSIONS__ = [];
      webContents.once('did-navigate', () => delete webContents.__TEMP_PERMISSIONS__);
    }
    webContents.__TEMP_PERMISSIONS__.push(permission);
  }

  private allowTemporaryPermission(webContents: SecureWebContents, permission: string): boolean {
    if (!webContents) { return false; }
    if (webContents.__TEMP_PERMISSIONS__ === undefined) { return false; }
    return webContents.__TEMP_PERMISSIONS__.includes(permission);
  }

  private getRequestType(details: PermissionDetails): string {
    if (!details) { console.error('Permission details are undefined'); return Permission.Type.GENERIC; }
    if ('externalURL' in details) { return Permission.Type.OPEN_EXTERNAL; }
    if ('fileAccessType' in details && 'filePath' in details) { return Permission.Type.FILE_SYSTEM; }
    if ('mediaTypes' in details) { return Permission.Type.MEDIA_ACCESS; }
    if ('deviceType' in details && 'device' in details) { return Permission.Type.DEVICE; }
    if ('pairingKind' in details && 'deviceId' in details) { return Permission.Type.BLUETOOTH; }
    if ('videoRequested' in details || 'audioRequested' in details) { return Permission.Type.DISPLAY_MEDIA; }
    return Permission.Type.GENERIC;
  }

  public denyPermissionsOnSession(s: Session): void {
    s.setPermissionRequestHandler((_, _p, c) => c(false));
    s.setPermissionCheckHandler(() => false);
    s.setDisplayMediaRequestHandler((_, c) => c({}));
    s.setDevicePermissionHandler(() => false);
    s.setBluetoothPairingHandler((_, c) => c({ confirmed: false }));
  }

  private formatPermission<T>(permission: T, type?: string): T {
    if (type !== undefined) { return `${permission}: ${type}` as T; }
    return permission;
  }

  private createValidURL(...urls: (string | null | undefined)[]): URL | undefined {
    try {
      const validUrlString = urls.find((url) => url != null && url !== '');
      if (!validUrlString) { return undefined; }
      return new URL(validUrlString);
    } catch (e) {
      console.warn('Failed to create URL from provided values:', e);
      return undefined;
    }
  }
}

export default new PermissionService();
