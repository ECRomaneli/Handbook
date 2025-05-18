const fs = require('fs').promises;
const path = require('path');
const ROOT_DIR = __dirname;

async function scanDirectory(directoryPath, componentFiles = []) {
    try {
        const absolutePath = path.resolve(ROOT_DIR, directoryPath);
        
        const files = await fs.readdir(absolutePath);
        
        for (const file of files) {
            if (file === '.' || file === '..' || file.startsWith('.')) continue;
            
            const absoluteFilePath = path.join(absolutePath, file);
            const stats = await fs.stat(absoluteFilePath);
            
            const relativePath = path.relative(ROOT_DIR, absoluteFilePath);
            
            if (stats.isDirectory()) {
                await scanDirectory(relativePath, componentFiles);
            } else if (file.endsWith('.js')) {
                componentFiles.push({
                    path: relativePath.replace(/\\/g, '/'),
                    name: file
                });
            }
        }
        
        return componentFiles;
    } catch (error) {
        throw new Error(`Failed to load directory: ${directoryPath}: ${error.message}`);
    }
}

async function loadScripts(directoryPath) {
    return await Promise.all((await scanDirectory(directoryPath)).map(file => {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script')
            script.src = file.path
            script.onload = resolve
            script.onerror = reject
            document.body.appendChild(script)
        })
    }))
}

export { loadScripts }