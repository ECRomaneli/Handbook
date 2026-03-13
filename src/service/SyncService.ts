import AppState from '@/AppState';
import Storage from '@/data/Storage';
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
        message: `Failed to push configuration to GitHub Gist.\n${(error as Error).message}`,
      });
      return null;
    }
  }

  public async gistPull(): Promise<void> {
    const win = AppState.preferences;
    if (!win) { return; }

    const settings = this.getSettings();
    if (!settings.gistToken || !settings.gistId) {
      await Dialog.alert(win, {
        title: 'Pull Failed',
        message: 'No Gist ID configured. Push first to create a gist, or enter an existing Gist ID.',
      });
      return;
    }

    try {
      const content = await this.gistFetch(settings.gistToken, settings.gistId);
      Storage.import(content);

      await Dialog.alert(win, {
        title: 'Pull Successful',
        message: 'Configuration pulled from GitHub Gist.',
      });
    } catch (error) {
      console.error('Failed to pull from GitHub Gist:', error);
      await Dialog.alert(win, {
        title: 'Pull Failed',
        message: `Failed to pull configuration from GitHub Gist.\n${(error as Error).message}`,
      });
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

}

export default new SyncService();
