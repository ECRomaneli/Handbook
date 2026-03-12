import AppState from '@/AppState';
import Storage from '@/data/Storage';
import Dialog from '@/util/modal/Dialog';
import { dialog } from 'electron';
import { promises as fs } from 'node:fs';

class SyncService {
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
}

export default new SyncService();
