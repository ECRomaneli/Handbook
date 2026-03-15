import { DefaultSettings, IsDebug, Permission, Settings } from '@/data/Constants';
import { PlainPage } from '@/model/Page';
import PreferencesService from '@/service/PreferencesService';
import { app, session } from 'electron';
import Store from 'electron-store';

/**
 * Bounds interface for window dimensions
 */
interface Bounds {
  width: number;
  height: number;
  x?: number;
  y?: number;
}

type AllPermissions = Record<string, SessionPermissions>;
type SessionPermissions = Record<string, UrlPermissions>;
type UrlPermissions = Record<string, PermissionStatus>;
type PermissionStatus = 'allow' | 'deny' | 'ask';

/**
 * Vault class - handles encrypted storage
 */
class Vault {
  private static readonly isDebug = IsDebug.storage;
  private static readonly store = (() => {
    const k = String.fromCharCode(35, 72, 52, 78, 68, 66, 48, 48, 107);
    const store = new Store<Record<string, unknown>>(
      app.isPackaged ? { encryptionKey: k, fileExtension: '.bin' } : undefined,
    );
    !app.isPackaged && console.debug(`Store path: ${store.path}`);
    return store;
  })();

  static get<T>(key: string, defaultValue?: T): T {
    let value = Vault.store.get(key) as T;
    if (value === undefined && defaultValue !== undefined) {
      value = defaultValue;
    }
    Vault.isDebug && console.debug(`Store get: ${key} = ${JSON.stringify(value)}`);
    return structuredClone(value);
  }

  static set<T>(key: string, value: T): void {
    Vault.store.set(key, structuredClone(value));
    Vault.isDebug && console.debug(`Store set: ${key} = ${JSON.stringify(value)}`);
  }

  static delete(key: string): void {
    Vault.store.delete(key);
    Vault.isDebug && console.debug(`Store delete: ${key}`);
  }

  static import(data: string): void {
    const syncSettings = Vault.store.get('SyncSettings');
    Vault.store.store = JSON.parse(data);
    if (syncSettings !== undefined) {
      Vault.store.set('SyncSettings', syncSettings);
    } else {
      Vault.store.delete('SyncSettings');
    }
  }

  static export(): string {
    const data = JSON.parse(JSON.stringify(Vault.store.store));
    delete data.SyncSettings;
    return JSON.stringify(data);
  }
}

/**
 * Storage class - manages application data persistence
 */
class Storage {
  static getSharedBounds(): Bounds {
    return Vault.get('SharedBounds', {
      width: Storage.getSettings(Settings.DEFAULT_WIDTH),
      height: Storage.getSettings(Settings.DEFAULT_HEIGHT),
    } as Bounds)!;
  }

  static getSharedSize(): { width: number; height: number } {
    const bounds = Storage.getSharedBounds();
    return { width: bounds.width, height: bounds.height };
  }

  static setSharedBounds(value: Bounds): void {
    Vault.set('SharedBounds', value);
  }

  static getWindowBounds(id: string | number): Bounds {
    return Vault.get(`WindowBounds.${id}`, {
      width: Storage.getSettings(Settings.DEFAULT_WIDTH),
      height: Storage.getSettings(Settings.DEFAULT_HEIGHT),
    } as Bounds)!;
  }

  static setWindowBounds(id: string | number, value: Bounds): void {
    Vault.set(`WindowBounds.${id}`, value);
  }

  static getPages(): PlainPage[] {
    return Vault.get('Pages', [])!;
  }

  static setPages(pages: PlainPage[]): void {
    const oldPages = Storage.getPages();
    Vault.set('Pages', pages || (pages = []));

    // Clean deleted session data
    clearUnusedSessionData(oldPages, pages);

    // Clean deleted window bounds
    Object.keys((Vault.get('WindowBounds') as Record<string, unknown> | undefined) ?? {})
      .filter((id) => !pages.some((p) => p.id === id))
      .forEach((id) => Vault.delete(`WindowBounds.${id}`));
  }

  static setPage(page: PlainPage): void {
    const pages = Storage.getPages();
    if (page.id === undefined) {
      page.id = `${Date.now()}${pages.length}`;
    }
    pages.push(page);
    Storage.setPages(pages);
  }

  static getDefaultSize(): Bounds {
    return {
      width: Storage.getSettings(Settings.DEFAULT_WIDTH),
      height: Storage.getSettings(Settings.DEFAULT_HEIGHT),
    } as Bounds;
  }

  static getPermissions(
    sessionName?: string,
    url?: string,
    permission?: string,
  ): PermissionStatus | UrlPermissions | SessionPermissions | AllPermissions {
    let key = 'Permissions';

    if (!sessionName) {
      const permissions = Vault.get(key, {}) as AllPermissions;
      for (const sess in permissions) {
        const sessionPermissions = permissions[sess];
        for (const u in sessionPermissions) {
          sessionPermissions[revertDots(u)] = sessionPermissions[u];
          delete sessionPermissions[u];
        }
      }
      return permissions;
    }

    key += `.${sessionName}`;

    if (!url) {
      const permissions = Vault.get(key, {}) as SessionPermissions;
      for (const u in permissions) {
        permissions[revertDots(u)] = permissions[u];
        delete permissions[u];
      }
      return permissions;
    }

    key += `.${replaceDots(url)}`;

    if (!permission) {
      return Vault.get(key, {}) as UrlPermissions;
    }

    key += `.${permission}`;

    return Vault.get(key, Permission.Status.ASK) as PermissionStatus;
  }

  static revokePermissions(sessionName?: string, url?: string, permission?: string): void {
    if (!sessionName) {
      Vault.delete('Permissions');
      return;
    }
    if (!url) {
      Vault.delete(`Permissions.${sessionName}`);
      return;
    }
    if (!permission) {
      Vault.delete(`Permissions.${sessionName}.${replaceDots(url)}`);
      return;
    }
    Vault.delete(`Permissions.${sessionName}.${replaceDots(url)}.${permission}`);
  }

  static setPermission(sessionName: string, url: string, permission: string, value: string): void {
    Vault.set(`Permissions.${sessionName}.${replaceDots(url)}.${permission}`, value);
  }

  static getSettings<T>(id: string): T {
    return Vault.get(`Settings.${id}`, DefaultSettings[id]) as T;
  }

  static setSettings(id: string, value: unknown): void {
    Vault.set(`Settings.${id}`, value);
  }

  static getPartitionName(sessionName: string): string {
    return `persist:handbook_${sessionName}`;
  }

  static getSyncSettings(): Record<string, unknown> {
    return Vault.get('SyncSettings', {}) as Record<string, unknown>;
  }

  static setSyncSettings(value: Record<string, unknown>): void {
    Vault.set('SyncSettings', value);
  }

  static import(data: string): void {
    Vault.import(data);
  }

  static export(): string {
    return Vault.export();
  }
}

/**
 * Clear session data that is no longer used
 * @param oldPages Previously stored pages
 * @param newPages New pages to store
 */
function clearUnusedSessionData(oldPages: PlainPage[], newPages: PlainPage[]): void {
  const oldSessions = new Set(oldPages.map((p) => p.session));
  const newSessions = new Set(newPages.map((p) => p.session));
  const removedSessions = oldSessions.difference(newSessions);

  // Remove sessions that are no longer used
  removedSessions.forEach((s) => {
    if (s) {
      console.debug(`Clearing session data for removed session: ${s}`);
      session.fromPartition(Storage.getPartitionName(s)).clearData();
      Storage.revokePermissions(s);
      PreferencesService.permissionsUpdated();
    }
  });
}

/**
 * Replace dots with single quotes for storage keys
 * @param s String to process
 * @returns Processed string
 */
const replaceDots = (s: string): string => s.replaceAll('.', '\'');

/**
 * Revert dots from single quotes for storage keys
 * @param s String to process
 * @returns Processed string
 */
const revertDots = (s: string): string => s.replaceAll('\'', '.');

export default Storage;
