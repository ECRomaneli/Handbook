import AppState from '@/AppState';
import { IsDebug } from '@/data/Constants';
import Storage from '@/data/Storage';
import ContextMenuService from '@/service/ContextMenuService';
import PreferencesService from '@/service/PreferencesService';
import Dialog from '@/util/modal/Dialog';
import { dialog, net } from 'electron';
import { promises as fs } from 'node:fs';

const FILENAME = IsDebug ? 'handbook-config.debug.json' : 'handbook-config.json';

interface SyncSettings {
  gistToken?: string;
  gistId?: string;
}

class SyncService {

  // ─── Sync Settings ──────────────────────────────────

  public getSettings(): SyncSettings {
    return Storage.getSyncSettings();
  }

  public saveSettings(partial: Partial<SyncSettings>): void {
    const current = this.getSettings();
    Storage.setSyncSettings({ ...current, ...partial });
  }

  // ─── Local File ─────────────────────────────────────

  public async importFromFile(): Promise<void> {
    const win = AppState.preferences;
    if (!win) { return; }

    const s = AppState.strings.sync;

    const result = await dialog.showOpenDialog(win, {
      title: s.importConfig,
      filters: [{ name: 'JSON Files', extensions: ['json'] }],
      properties: ['openFile'],
    });

    if (result.canceled || result.filePaths.length === 0) { return; }

    try {
      const filePath = result.filePaths[0];
      const fileContent = await fs.readFile(filePath, 'utf-8');
      Storage.import(fileContent);

      await Dialog.alert(win, {
        title: s.importSuccess,
        message: s.importSuccessMsg,
      });
      this.reloadAfterImport();
    } catch (error) {
      console.error('Failed to import configuration:', error);
      await Dialog.alert(win, {
        title: s.importFailed,
        message: s.importFailedMsg,
      });
    }
  }

  public async exportToFile(): Promise<void> {
    const win = AppState.preferences;
    if (!win) { return; }

    const s = AppState.strings.sync;

    const result = await dialog.showSaveDialog(win, {
      title: s.exportConfig,
      defaultPath: FILENAME,
      filters: [{ name: 'JSON Files', extensions: ['json'] }],
    });

    if (result.canceled || !result.filePath) { return; }

    try {
      const configData = Storage.export();
      await fs.writeFile(result.filePath, configData, 'utf-8');
      await Dialog.alert(win, {
        title: s.exportSuccess,
        message: `${s.exportSuccessMsg}\n${result.filePath}`,
      });
    } catch (error) {
      console.error('Failed to export configuration:', error);
      await Dialog.alert(win, {
        title: s.exportFailed,
        message: s.exportFailedMsg,
      });
    }
  }

  // ─── GitHub Gist ────────────────────────────────────

  public async gistPush(): Promise<{ gistId: string } | null> {
    const win = AppState.preferences;
    if (!win) { return null; }

    const settings = this.getSettings();
    if (!settings.gistToken) { return null; }

    const s = AppState.strings.sync;

    try {
      const configData = Storage.export();
      let gistId = settings.gistId;

      if (!gistId) {
        gistId = await this.gistFindByFilename(settings.gistToken) ?? undefined;
        if (gistId) { this.saveSettings({ gistId }); }
      }

      if (gistId) {
        await this.gistUpdate(settings.gistToken, gistId, configData);
      } else {
        gistId = await this.gistCreate(settings.gistToken, configData);
        this.saveSettings({ gistId });
      }

      await Dialog.alert(win, {
        title: s.pushSuccess,
        message: s.pushSuccessMsg,
      });

      return { gistId };
    } catch (error) {
      console.error('Failed to push to GitHub Gist:', error);
      await Dialog.alert(win, {
        title: s.pushFailed,
        message: this.friendlyGistError(error),
      });
      return null;
    }
  }

  public async gistPull(): Promise<{ gistId: string } | null> {
    const win = AppState.preferences;
    if (!win) { return null; }

    const settings = this.getSettings();
    if (!settings.gistToken) { return null; }

    const s = AppState.strings.sync;

    try {
      let gistId = settings.gistId;

      if (!gistId) {
        gistId = await this.gistFindByFilename(settings.gistToken) ?? undefined;
        if (gistId) { this.saveSettings({ gistId }); }
      }

      if (!gistId) {
        await Dialog.alert(win, {
          title: s.pullFailed,
          message: s.pullNoGistId,
        });
        return null;
      }

      const content = await this.gistFetch(settings.gistToken, gistId);
      Storage.import(content);

      await Dialog.alert(win, {
        title: s.pullSuccess,
        message: s.pullSuccessMsg,
      });
      this.reloadAfterImport();
      return { gistId };
    } catch (error) {
      console.error('Failed to pull from GitHub Gist:', error);
      await Dialog.alert(win, {
        title: s.pullFailed,
        message: this.friendlyGistError(error),
      });
      return null;
    }
  }

  private async gistCreate(token: string, content: string): Promise<string> {
    const body = JSON.stringify({
      description: AppState.strings.sync.gistDescription,
      public: false,
      files: { [FILENAME]: { content } },
    });

    const response = await this.githubRequest('POST', 'https://api.github.com/gists', token, body);
    return response.id;
  }

  private async gistUpdate(token: string, gistId: string, content: string): Promise<void> {
    const body = JSON.stringify({
      files: { [FILENAME]: { content } },
    });

    await this.githubRequest('PATCH', `https://api.github.com/gists/${encodeURIComponent(gistId)}`, token, body);
  }

  private async gistFetch(token: string, gistId: string): Promise<string> {
    const response = await this.githubRequest('GET', `https://api.github.com/gists/${encodeURIComponent(gistId)}`, token);
    const file = response.files?.[FILENAME];
    if (!file || !file.content) {
      throw new Error(`File "${FILENAME}" not found in the gist.`);
    }
    return file.content;
  }

  /**
   * Lists the authenticated user's gists and returns the ID of the
   * first one that contains the Handbook config file, or null.
   */
  private async gistFindByFilename(token: string): Promise<string | null> {
    const perPage = 100;
    for (let page = 1; page <= 10; page++) {
      const url = `https://api.github.com/gists?per_page=${perPage}&page=${page}`;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const gists: any[] = await this.githubRequest('GET', url, token);

      for (const gist of gists) {
        if (gist.files?.[FILENAME]) {
          return gist.id;
        }
      }

      if (gists.length < perPage) { break; }
    }
    return null;
  }

  private reloadAfterImport() {
    PreferencesService.reloadPreferences();
    ContextMenuService.refreshContextMenu();
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private githubRequest(method: string, url: string, token: string, body?: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const request = net.request({ method, url });
      request.setHeader('Authorization', `Bearer ${token}`);
      request.setHeader('Accept', 'application/vnd.github+json');
      request.setHeader('User-Agent', 'Handbook-App');
      if (body) {
        request.setHeader('Content-Type', 'application/json');
      }

      let responseBody = '';
      request.on('response', (response) => {
        response.on('data', (chunk) => { responseBody += chunk.toString(); });
        response.on('end', () => {
          if (response.statusCode && response.statusCode >= 200 && response.statusCode < 300) {
            resolve(JSON.parse(responseBody));
          } else {
            reject(new Error(`GitHub API error (${response.statusCode}): ${responseBody}`));
          }
        });
      });

      request.on('error', reject);
      if (body) { request.write(body); }
      request.end();
    });
  }

  /**
   * Analyzes an error from gistPush / gistPull and returns a
   * human-friendly message for the end user.
   */
  private friendlyGistError(error: unknown): string {
    const msg = (error instanceof Error) ? error.message : String(error);

    const s = AppState.strings.sync.friendlyError;

    // ── GitHub API HTTP status codes ──────────────────
    if (/401/.test(msg)) { return s.e401; }
    if (/403/.test(msg)) { return s.e403; }
    if (/404/.test(msg)) { return s.e404; }
    if (/422/.test(msg)) { return s.e422; }
    if (/5\d{2}/.test(msg)) { return s.e5xx; }

    // ── File not found inside the gist ────────────────
    if (/not found in the gist/i.test(msg)) {
      return s.notFoundGist.replace('{fileName}', FILENAME);
    }

    // ── Network / connectivity errors ─────────────────
    if (/ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ECONNRESET|ETIMEDOUT|network|socket/i.test(msg)) {
      return s.network;
    }

    // ── DNS resolution ────────────────────────────────
    if (/EHOSTUNREACH|getaddrinfo/i.test(msg)) {
      return s.dns;
    }

    // ── JSON parse errors ─────────────────────────────
    if (/JSON|Unexpected token/i.test(msg)) {
      return s.jsonParse;
    }

    // ── Fallback ──────────────────────────────────────
    return s.fallback.replace('{errorMessage}', msg);
  }

}

export default new SyncService();
