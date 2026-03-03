import { IsDebug, Permission, Settings } from '@/data/Constants';
import Storage from '@/data/Storage';
import { Page } from '@/model/Page';
import FrameService from '@/service/FrameService';
import PageService from '@/service/PageService';
import PreferencesService from '@/service/PreferencesService';
import Dialog from '@/util/modal/Dialog';
import ScreenShareModal from '@/util/modal/ScreenShareModal';
import PromiseQueue from '@/util/PromiseQueue';
import { app, DisplayMediaRequestHandlerHandlerRequest, FilesystemPermissionRequest, MediaAccessPermissionRequest, OpenExternalPermissionRequest, PermissionCheckHandlerHandlerDetails, PermissionRequest, Session, Streams, systemPreferences, WebContents } from 'electron';

type CheckablePermissions = 'clipboard-read' | 'clipboard-sanitized-write' | 'geolocation' | 'fullscreen' | 'hid' |
  'idle-detection' | 'media' | 'mediaKeySystem' | 'midi' | 'midiSysex' | 'notifications' | 'openExternal' |
  'pointerLock' | 'serial' | 'storage-access' | 'top-level-storage-access' | 'usb' | 'deprecated-sync-clipboard-read' |
  'fileSystem' | 'background-sync';

type RequestablePermissions = 'clipboard-read' | 'clipboard-sanitized-write' | 'display-capture' | 'fullscreen' |
  'geolocation' | 'idle-detection' | 'media' | 'mediaKeySystem' | 'midi' | 'midiSysex' | 'notifications' |
  'pointerLock' | 'keyboardLock' | 'openExternal' | 'speaker-selection' | 'storage-access' |
  'top-level-storage-access' | 'window-management' | 'unknown' | 'fileSystem';

type SecureWebContents = WebContents & { _hb_permissions?: string[] };

type PermissionDetails =
  (PermissionRequest) |
  (FilesystemPermissionRequest) |
  (MediaAccessPermissionRequest) |
  (OpenExternalPermissionRequest);

class PermissionService {
  private static readonly ACCEPT_LANGUAGE_HEADER = 'Accept-Language';
  private readonly isDebug = IsDebug.permissions;
  private screenShareModal: ScreenShareModal = new ScreenShareModal();
  private queue: PromiseQueue = new PromiseQueue();

  public setupPermissionsHandler(): void {
    const preferredLanguage = Storage.getSettings(Settings.PREFERRED_LANGUAGE) as string | undefined;
    const hasPreferredLanguage = preferredLanguage && preferredLanguage.trim() !== '';

    app.prependListener('session-created', (s: Session) => {
      this.isDebug && console.debug('Session created:', s.storagePath);
      s.setPermissionRequestHandler(this.requestPermissions.bind(this));
      s.setPermissionCheckHandler(this.checkPermissions.bind(this));
      s.setDisplayMediaRequestHandler(this.shareMedia.bind(this));
      s.setBluetoothPairingHandler((_, c) => c({ confirmed: false }));
      // s.setDevicePermissionHandler(/* DEFAULT */)

      hasPreferredLanguage && this.overrideAcceptLanguage(s, preferredLanguage);
    });
  }

  private overrideAcceptLanguage(s: Session, preferredLanguage: string): void {
    // Build Accept-Language header with the preferred language + English fallback
    const acceptLanguage = `${preferredLanguage},en;q=0.5`;

    s.webRequest.onBeforeSendHeaders((details, callback) => {
      details.requestHeaders[PermissionService.ACCEPT_LANGUAGE_HEADER] = acceptLanguage;
      callback({ requestHeaders: details.requestHeaders });
    });
  }

  private async shareMedia(
    request: DisplayMediaRequestHandlerHandlerRequest, callback: (streams: Streams) => void): Promise<void> {
    const frame = FrameService.getFrame();

    if (frame === void 0) {
      console.error('The current window is no longer available.');
      return callback({});
    }

    const source = await this.screenShareModal.request({
      requesterUrl: request.securityOrigin,
      shareAudioBtn: request.audioRequested,
      parent: frame,
    });

    if (source === void 0) { return callback({}); }
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

    const page = PageService.getPageByWebContents(webContents!);
    if (page === void 0) { return false; }

    const url = this.createValidURL(
      details.requestingUrl, details.embeddingOrigin, details.securityOrigin, requestingOrigin);
    if (url === void 0) {
      console.error('Permission request without URL or origin:', permission || 'unknown');
      return false;
    }

    const origin = url.protocol === 'file:' ? url.pathname : url.origin;

    permission = this.formatPermission(permission, details.mediaType);

    const result = false !== this.isAllowed(page, origin, permission);
    this.isDebug && console.debug('Permission check:', permission, 'for', origin, 'result:', result);
    return result;
  }

  // eslint-disable-next-line @stylistic/max-len
  private async requestPermissions(webContents: WebContents, permission: RequestablePermissions, callback: (granted: boolean) => void, details: PermissionDetails): Promise<void> {
    const page = PageService.getPageByWebContents(webContents);
    if (page === void 0) { return callback(false); }

    const url = this.createValidURL(details.requestingUrl, (details as MediaAccessPermissionRequest).securityOrigin);

    if (url === void 0) {
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

    return callback(true === await this.queue.add(() => this.requestPermission(page, origin, permissionsToRequest)));
  }

  private isAllowed(page: Page, url: string, permission: string): boolean | undefined {
    const view = page.view!;
    if (this.allowTemporaryPermission(view.webContents as SecureWebContents, permission)) { return true; }

    const sessionObj = page.session;
    const status = Storage.getPermissions(sessionObj, url, permission) as string;

    if (status === Permission.Status.ALLOW) { return true; }
    if (status === Permission.Status.DENY) { return false; }
    return void 0;
  }

  private async requestPermission(page: Page, url: string, permissions: string[]): Promise<boolean> {
    const permissionsToRequest: string[] = [];
    for (const permission of permissions) {
      const status = this.isAllowed(page, url, permission);
      if (status === false) { return false; }
      if (status === void 0) {
        const systemPermission = await PermissionService.checkSystemPermission(permission);
        if (systemPermission === false) { return false; }
        permissionsToRequest.push(permission);
      }
    }
    if (permissionsToRequest.length === 0) { return true; }
    return await this.askPermissionAndSaveStatus(page, {
      session: page.session,
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
    return permissions.map((p) => (Permission.Text as Record<string, string>)[p] ?? p);
  }

  // eslint-disable-next-line @stylistic/max-len
  private async askPermissionAndSaveStatus(page: Page, data: { session: string; url: string; permissions: string[] }): Promise<boolean> {
    const parent = FrameService.getFrame();

    if (parent === void 0) {
      console.error('The frame is no longer available for page:', page.label);
      return false;
    }

    const humanReadablePermissions = PermissionService.getHumanReadablePermissions(data.permissions);

    const result = await Dialog.show(
      parent.isVisible() ? parent : null,
      {
        // icon: Path.LOGO,
        type: 'question',
        title: 'Permission Request',
        message: `${data.url} wants to access the following permissions:\n - ${humanReadablePermissions.join('\n - ')}`,
        buttons: ['Allow', 'Allow this time', 'Deny', 'Ask Later'],
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
      this.setTemporaryPermission(page.view!.webContents as SecureWebContents, permission);
      Storage.setPermission(data.session, data.url, permission, Permission.Status.ASK);
    }
    PreferencesService.permissionsUpdated();
    return true;
  }

  private setTemporaryPermission(webContents: SecureWebContents, permission: string): void {
    if (webContents._hb_permissions === void 0) {
      webContents._hb_permissions = [];
      webContents.once('did-navigate', () => delete webContents._hb_permissions);
    }
    webContents._hb_permissions.push(permission);
  }

  private allowTemporaryPermission(webContents: SecureWebContents, permission: string): boolean {
    if (!webContents) { return false; }
    if (webContents._hb_permissions === void 0) { return false; }
    return webContents._hb_permissions.includes(permission);
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
    if (type !== void 0) { return `${permission}: ${type}` as T; }
    return permission;
  }

  private createValidURL(...urls: (string | null | undefined)[]): URL | undefined {
    try {
      const validUrlString = urls.find((url) => url != null && url !== '');
      if (!validUrlString) { return void 0; }
      return new URL(validUrlString);
    } catch (e) {
      console.warn('Failed to create URL from provided values:', e);
      return void 0;
    }
  }
}

export default new PermissionService();
