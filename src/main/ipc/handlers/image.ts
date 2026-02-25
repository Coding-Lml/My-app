import { ipcMain, dialog, app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

let imagesDir: string | null = null;

function getImagesDir(): string {
  if (!imagesDir) {
    const userDataPath = app.getPath('userData');
    imagesDir = path.join(userDataPath, 'note-images');
    if (!fs.existsSync(imagesDir)) {
      fs.mkdirSync(imagesDir, { recursive: true });
    }
  }
  return imagesDir;
}

function sanitizeImageBaseName(fileName?: string): string {
  if (!fileName) return '';
  const rawName = path.parse(fileName).name.trim();
  if (!rawName) return '';

  return rawName
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\u4e00-\u9fa5-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-_.]+|[-_.]+$/g, '')
    .toLowerCase();
}

function generateImageName(ext: string, dir: string, preferredName?: string): string {
  const extName = ext.toLowerCase().replace(/^\./, '');
  const preferredBase = sanitizeImageBaseName(preferredName);
  const base = preferredBase || `img-${new Date().toISOString().slice(0, 10)}`;

  let candidate = `${base}.${extName}`;
  let index = 2;

  while (fs.existsSync(path.join(dir, candidate))) {
    candidate = `${base}-${index}.${extName}`;
    index += 1;
  }

  return candidate;
}

export function registerImageHandlers() {
  ipcMain.handle(
    'image:save',
    async (_event, imageData: string, targetDir?: string, options?: { fileName?: string }) => {
      try {
        const matches = imageData.match(/^data:image\/([\w+-]+);base64,(.+)$/);
        if (!matches) {
          throw new Error('Invalid image data format');
        }

        const extRaw = matches[1].toLowerCase();
        const ext = extRaw === 'jpeg' ? 'jpg' : extRaw === 'svg+xml' ? 'svg' : extRaw;
        const base64Data = matches[2];
        const buffer = Buffer.from(base64Data, 'base64');

        let imagesPath: string;

        if (targetDir) {
          imagesPath = path.join(targetDir, 'assets');
          if (!fs.existsSync(imagesPath)) {
            fs.mkdirSync(imagesPath, { recursive: true });
          }
        } else {
          imagesPath = getImagesDir();
        }

        const fileName = generateImageName(ext, imagesPath, options?.fileName);
        const relativePath = targetDir ? `assets/${fileName}` : `note-images/${fileName}`;
        const filePath = path.join(imagesPath, fileName);

        fs.writeFileSync(filePath, buffer);

        return {
          success: true,
          path: filePath,
          relativePath: relativePath,
        };
      } catch (error) {
        console.error('Failed to save image:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  ipcMain.handle('image:select', async () => {
    try {
      const result = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [
          { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'] },
        ],
      });

      if (result.canceled || result.filePaths.length === 0) {
        return { success: false, canceled: true };
      }

      const sourcePath = result.filePaths[0];
      const ext = path.extname(sourcePath).slice(1);
      const imagesPath = getImagesDir();
      const fileName = generateImageName(ext, imagesPath, path.basename(sourcePath));
      const destPath = path.join(imagesPath, fileName);

      fs.copyFileSync(sourcePath, destPath);

      return {
        success: true,
        path: destPath,
        relativePath: `note-images/${fileName}`,
      };
    } catch (error) {
      console.error('Failed to select image:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  ipcMain.handle('image:read', async (_event, relativePath: string) => {
    try {
      const userDataPath = app.getPath('userData');
      const filePath = path.join(userDataPath, relativePath);
      
      if (!fs.existsSync(filePath)) {
        throw new Error('Image not found');
      }

      const buffer = fs.readFileSync(filePath);
      const base64 = buffer.toString('base64');
      const ext = path.extname(filePath).slice(1);
      const mimeType = ext === 'svg' ? 'image/svg+xml' : `image/${ext === 'jpg' ? 'jpeg' : ext}`;
      
      return {
        success: true,
        data: `data:${mimeType};base64,${base64}`,
      };
    } catch (error) {
      console.error('Failed to read image:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });
}
