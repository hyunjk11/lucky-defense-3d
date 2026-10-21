import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');

export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'three') {
    return {
      shortCircuit: true,
      url: pathToFileURL(path.join(root, 'lib', 'three.module.js')).href,
    };
  }
  if (specifier.startsWith('three/addons/')) {
    const sub = specifier.slice('three/addons/'.length);
    return {
      shortCircuit: true,
      url: pathToFileURL(path.join(root, 'lib', 'addons', sub)).href,
    };
  }
  return nextResolve(specifier, context);
}
