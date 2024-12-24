import * as esbuild from 'esbuild';
import JavaScriptObfuscator from 'javascript-obfuscator';
import { readFile, writeFile } from 'fs/promises';

async function build() {
  // First, bundle with esbuild
  await esbuild.build({
    entryPoints: ['./src/server.ts'],
    bundle: true,
    minify: true,
    outfile: './dist/server.bundle.cjs',
    format: 'cjs',
    platform: 'node',
    target: 'node16',
    sourcemap: false,
    treeShaking: true,
    legalComments: 'none',
    external: [],
    loader: {
      '.ts': 'ts',
      '.js': 'js',
      '.json': 'json'
    },
    define: {
      'process.env.NODE_ENV': '"production"'
    },
    mainFields: ['module', 'main'],
    resolveExtensions: ['.ts', '.js', '.json'],
  });
}

build().catch(console.error); 