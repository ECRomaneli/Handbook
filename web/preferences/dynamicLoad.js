const fs = require('fs').promises;
const path = require('path');
const ROOT_DIR = __dirname;

async function scanDirectory(directoryPath, componentFiles = []) {
    try {
        // Normalizar o caminho do diretório relativamente à raiz
        const absolutePath = path.resolve(ROOT_DIR, directoryPath);
        
        // Ler os arquivos no diretório
        const files = await fs.readdir(absolutePath);
        
        // Processar cada arquivo/diretório
        for (const file of files) {
            // Ignorar diretórios especiais
            if (file === '.' || file === '..' || file.startsWith('.')) continue;
            
            const absoluteFilePath = path.join(absolutePath, file);
            const stats = await fs.stat(absoluteFilePath);
            
            // Calcular o caminho relativo à raiz
            const relativePath = path.relative(ROOT_DIR, absoluteFilePath);
            
            if (stats.isDirectory()) {
                // Se for um diretório, escanear recursivamente
                await scanDirectory(relativePath, componentFiles);
            } else if (file.endsWith('.js')) {
                // Se for um arquivo JavaScript, adicionar à lista com caminho relativo
                componentFiles.push({
                    path: relativePath.replace(/\\/g, '/'), // Garantir barras no estilo web
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
            script.src = file.path // Usando o caminho relativo
            script.onload = resolve
            script.onerror = reject
            document.body.appendChild(script)
        })
    }))
}