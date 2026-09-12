import { readdir, readFile } from 'node:fs/promises';
import { extname } from 'node:path';

const sourceRoot = new URL('./src/app/', import.meta.url);
const forbidden = [
  '@NgModule',
  'FormsModule',
  'ReactiveFormsModule',
  'FormControl',
  'FormGroup',
  'FormArray',
  'FormBuilder',
  'NonNullableFormBuilder',
  'NgForm',
  'NgModel',
  'ControlValueAccessor',
  '[(ngModel)]',
  '[formGroup]',
  'formControlName',
  '[formControl]',
  '*ngIf',
  '*ngFor',
  '*ngSwitch',
];

const violations = [];
for (const file of await files(sourceRoot)) {
  const content = await readFile(file, 'utf8');
  for (const token of forbidden) {
    if (content.includes(token)) violations.push(`${file.pathname}: ${token}`);
  }
}

if (violations.length) {
  throw new Error(`APIs Angular proibidas encontradas:\n${violations.join('\n')}`);
}

console.log('Nenhuma API Angular proibida encontrada em src/app.');

async function files(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const result = [];
  for (const entry of entries) {
    const path = new URL(`${entry.name}${entry.isDirectory() ? '/' : ''}`, directory);
    if (entry.isDirectory()) result.push(...(await files(path)));
    else if (['.ts', '.html'].includes(extname(entry.name))) result.push(path);
  }
  return result;
}
