import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const example = path.join(root, 'backend', '.env.example');
const target = path.join(root, 'backend', '.env');

if (!fs.existsSync(example)) {
  console.error('Не найден backend/.env.example');
  process.exit(1);
}

if (fs.existsSync(target)) {
  console.log('backend/.env уже есть — пропуск.');
} else {
  fs.copyFileSync(example, target);
  console.log('Создан backend/.env из .env.example');
}
