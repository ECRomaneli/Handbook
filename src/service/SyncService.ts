import AppState from '@/AppState';
import Storage from '@/data/Storage';
import ContextMenuService from '@/service/ContextMenuService';
import PreferencesService from '@/service/PreferencesService';
import Dialog from '@/util/modal/Dialog';
import { dialog, net } from 'electron';
import { promises as fs } from 'node:fs';

const GIST_FILENAME = 'handbook-config.json';

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

    const result = await dialog.showOpenDialog(win, {
      title: 'Import Configuration',
      filters: [{ name: 'JSON Files', extensions: ['json'] }],
      properties: ['openFile'],
    });

    if (result.canceled || result.filePaths.length === 0) { return; }

    try {
      const filePath = result.filePaths[0];
      const fileContent = await fs.readFile(filePath, 'utf-8');
      Storage.import(fileContent);

      await Dialog.alert(win, {
        title: 'Import Successful',
        message: 'Configuration imported successfully.',
      });
      PreferencesService.reloadPreferences();
      ContextMenuService.refreshContextMenu();
    } catch (error) {
      console.error('Failed to import configuration:', error);
      await Dialog.alert(win, {
        title: 'Import Failed',
        message: 'Failed to import configuration file. Please ensure the file is a valid JSON format.',
      });
    }
  }

  public async exportToFile(): Promise<void> {
    const win = AppState.preferences;
    if (!win) { return; }

    const result = await dialog.showSaveDialog(win, {
      title: 'Export Configuration',
      defaultPath: 'config.json',
      filters: [{ name: 'JSON Files', extensions: ['json'] }],
    });

    if (result.canceled || !result.filePath) { return; }

    try {
      const configData = Storage.export();
      await fs.writeFile(result.filePath, configData, 'utf-8');
      await Dialog.alert(win, {
        title: 'Export Successful',
        message: `Configuration exported successfully to:\n${result.filePath}`,
      });
    } catch (error) {
      console.error('Failed to export configuration:', error);
      await Dialog.alert(win, {
        title: 'Export Failed',
        message: 'Failed to export configuration file. Please try again.',
      });
    }
  }

  // ─── GitHub Gist ────────────────────────────────────

  public async gistPush(): Promise<{ gistId: string } | null> {
    const win = AppState.preferences;
    if (!win) { return null; }

    const settings = this.getSettings();
    if (!settings.gistToken) { return null; }

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
        title: 'Push Successful',
        message: 'Configuration pushed to GitHub Gist.',
      });

      return { gistId };
    } catch (error) {
      console.error('Failed to push to GitHub Gist:', error);
      await Dialog.alert(win, {
        title: 'Push Failed',
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

    try {
      let gistId = settings.gistId;

      if (!gistId) {
        gistId = await this.gistFindByFilename(settings.gistToken) ?? undefined;
        if (gistId) { this.saveSettings({ gistId }); }
      }

      if (!gistId) {
        await Dialog.alert(win, {
          title: 'Pull Failed',
          message: 'No gist found. Push first to create one, or enter an existing Gist ID.',
        });
        return null;
      }

      const content = await this.gistFetch(settings.gistToken, gistId);
      Storage.import(content);

      await Dialog.alert(win, {
        title: 'Pull Successful',
        message: 'Configuration pulled from GitHub Gist.',
      });
      win.webContents.reload();

      return { gistId };
    } catch (error) {
      console.error('Failed to pull from GitHub Gist:', error);
      await Dialog.alert(win, {
        title: 'Pull Failed',
        message: this.friendlyGistError(error),
      });
      return null;
    }
  }

  private async gistCreate(token: string, content: string): Promise<string> {
    const body = JSON.stringify({
      description: 'Handbook Configuration Backup',
      public: false,
      files: { [GIST_FILENAME]: { content } },
    });

    const response = await this.githubRequest('POST', 'https://api.github.com/gists', token, body);
    return response.id;
  }

  private async gistUpdate(token: string, gistId: string, content: string): Promise<void> {
    const body = JSON.stringify({
      files: { [GIST_FILENAME]: { content } },
    });

    await this.githubRequest('PATCH', `https://api.github.com/gists/${encodeURIComponent(gistId)}`, token, body);
  }

  private async gistFetch(token: string, gistId: string): Promise<string> {
    const response = await this.githubRequest('GET', `https://api.github.com/gists/${encodeURIComponent(gistId)}`, token);
    const file = response.files?.[GIST_FILENAME];
    if (!file || !file.content) {
      throw new Error(`File "${GIST_FILENAME}" not found in the gist.`);
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
        if (gist.files?.[GIST_FILENAME]) {
          return gist.id;
        }
      }

      if (gists.length < perPage) { break; }
    }
    return null;
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

    // ── GitHub API HTTP status codes ──────────────────
    if (/401/.test(msg)) {
      return 'Authentication failed. Please check that your GitHub token is valid and has not expired.';
    }
    if (/403/.test(msg)) {
      return 'Permission denied. Your token may lack the required "gist" scope, or you have hit the API rate limit.';
    }
    if (/404/.test(msg)) {
      return 'Gist not found. The configured Gist ID may be incorrect, or the gist may have been deleted.';
    }
    if (/422/.test(msg)) {
      return 'The request was rejected by GitHub. The data sent may be invalid or the gist content is empty.';
    }
    if (/5\d{2}/.test(msg)) {
      return 'GitHub is experiencing issues. Please try again in a few moments.';
    }

    // ── File not found inside the gist ────────────────
    if (/not found in the gist/i.test(msg)) {
      return `The file "${GIST_FILENAME}" was not found inside the gist.`
        + ' Make sure you are using a gist created by Handbook.';
    }

    // ── Network / connectivity errors ─────────────────
    if (/ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ECONNRESET|ETIMEDOUT|network|socket/i.test(msg)) {
      return 'Communication failure. Check your internet connection and try again.';
    }

    // ── DNS resolution ────────────────────────────────
    if (/EHOSTUNREACH|getaddrinfo/i.test(msg)) {
      return 'Could not reach GitHub. Please verify your network settings or try again later.';
    }

    // ── JSON parse errors ─────────────────────────────
    if (/JSON|Unexpected token/i.test(msg)) {
      return 'Received an unexpected response from GitHub. The gist content may be corrupted.';
    }

    // ── Fallback ──────────────────────────────────────
    return `An unexpected error occurred: ${msg}`;
  }

}

export default new SyncService();
