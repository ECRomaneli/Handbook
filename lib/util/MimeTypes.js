/**
 * Maps MIME types to their corresponding file extensions
 * @type {Object.<string, string[]>}
 */
export const mimeToExtension = {
    // Images
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/svg+xml': 'svg',
    'image/svg': 'svg',
    'image/bmp': 'bmp',
    'image/tiff': 'tiff',
    'image/x-icon': 'ico',

    // Documents
    'application/pdf': 'pdf',
    'application/msword': 'doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/vnd.ms-excel': 'xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
    'application/vnd.ms-powerpoint': 'ppt',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
    'application/rtf': 'rtf',

    // Text
    'text/plain': 'txt',
    'text/html': 'html',
    'text/css': 'css',
    'text/csv': 'csv',
    'text/javascript': 'js',
    'text/xml': 'xml',

    // Data
    'application/json': 'json',
    'application/xml': 'xml',

    // Archives
    'application/zip': 'zip',
    'application/x-tar': 'tar',
    'application/gzip': 'gz',
    'application/x-7z-compressed': '7z',
    'application/x-rar-compressed': 'rar',

    // Audio
    'audio/mpeg': 'mp3',
    'audio/wav': 'wav',
    'audio/ogg': 'ogg',
    'audio/aac': 'aac',
    'audio/flac': 'flac',
    'audio/webm': 'weba',
    'audio/x-m4a': 'm4a',

    // Video
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'video/ogg': 'ogv',
    'video/quicktime': 'mov',
    'video/x-msvideo': 'avi',
    'video/x-ms-wmv': 'wmv',
    'video/3gpp': '3gp',
    'video/mpeg': 'mpg',

    // Fonts
    'font/ttf': 'ttf',
    'font/otf': 'otf',
    'font/woff': 'woff',
    'font/woff2': 'woff2',

    // Binary
    'application/octet-stream': 'bin'
};

/**
 * Gets the appropriate file extension for a given MIME type
 * @param {string} mimeType - The MIME type
 * @returns {string} The preferred file extension (without the dot)
 */
export function getExtensionForMime(mimeType) {
    if (!mimeType || typeof mimeType !== 'string') return ''

    return mimeToExtension[mimeType] ?? ''
}

/**
 * Gets suitable file filters for a given MIME type
 * @param {string} mimeType - The MIME type
 * @returns {Array<{name: string, extensions: string[]}>} Dialog filters
 */
export function getFiltersForMime(mimeType) {
    if (!mimeType || typeof mimeType !== 'string') {
        return [{ name: 'All Files', extensions: ['*'] }]
    }

    // Group filters by type
    if (mimeType.startsWith('image/')) {
        return [
            { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'] },
            { name: 'All Files', extensions: ['*'] }
        ]
    } else if (mimeType.startsWith('audio/')) {
        return [
            { name: 'Audio', extensions: ['mp3', 'wav', 'ogg', 'aac', 'flac', 'm4a'] },
            { name: 'All Files', extensions: ['*'] }
        ]
    } else if (mimeType.startsWith('video/')) {
        return [
            { name: 'Video', extensions: ['mp4', 'webm', 'ogv', 'mov', 'avi', 'wmv'] },
            { name: 'All Files', extensions: ['*'] }
        ]
    } else if (mimeType.startsWith('text/')) {
        return [
            { name: 'Text', extensions: ['txt', 'html', 'css', 'js', 'xml', 'csv'] },
            { name: 'All Files', extensions: ['*'] }
        ]
    }

    // Specific type
    const extensions = mimeToExtension[mimeType]
    if (extensions && extensions.length > 0) {
        return [
            { name: mimeType.split('/')[1].toUpperCase(), extensions },
            { name: 'All Files', extensions: ['*'] }
        ]
    }

    return [{ name: 'All Files', extensions: ['*'] }]
}