import path from 'path';
import fs from 'fs/promises';
import type { Plugin, ResolvedConfig } from 'vite';
import { FunctionsManifest } from './types';
import { copyDir, getOutDir, getRoot } from './utils';
import {
  getFunctionsManifest,
  getFunctionsManifestDestination,
  getPrerenderManifest,
  getPrerenderManifestDestination,
  getRoutesManifest,
  getRoutesManifestDestination,
} from './manifests';
import { buildApiEndpoints } from './build';
import { execPrerender } from './prerender';

function vercelPlugin(): Plugin {
  let resolvedConfig: ResolvedConfig;

  return {
    apply: 'build',
    name: 'vite-plugin-vercel',
    configResolved(config) {
      resolvedConfig = config;
    },
    async buildStart() {
      if (resolvedConfig.build.ssr) return;
      // step 1:	Clean .output dir
      await cleanOutputDirectory(resolvedConfig);
    },
    async writeBundle() {
      if (!resolvedConfig.build?.ssr) {
        // step 2:		Client side built by vite-plugin-ssr
        // step 2.1:	Copy dist/client to .output/static
        await copyDistClientToOutputStatic(resolvedConfig);

        return;
      }

      // step 3:		Server side built by vite-plugin-ssr
      // step 3.1:	Execute vite-plugin-ssr prerender
      const isrPages = await execPrerender(resolvedConfig);

      // step 3.2:	Compile "api/*" to ".output/server/pages"
      const fnManifests = await buildApiEndpoints(resolvedConfig);

      // step 3.3:	Generates manifests
      await generateFunctionsManifest(resolvedConfig, fnManifests);
      await generateRoutesManifest(resolvedConfig);
      await generatePrerenderManifest(resolvedConfig, isrPages);
    },
  };
}

async function copyDistClientToOutputStatic(resolvedConfig: ResolvedConfig) {
  await copyDir(
    getOutDir(resolvedConfig),
    path.join(getRoot(resolvedConfig), '.output/static'),
  );
}

async function cleanOutputDirectory(resolvedConfig: ResolvedConfig) {
  await fs.rm(path.join(getRoot(resolvedConfig), '.output'), {
    recursive: true,
    force: true,
  });
}

async function generatePrerenderManifest(
  resolvedConfig: ResolvedConfig,
  isrPages: string[],
) {
  await fs.writeFile(
    getPrerenderManifestDestination(resolvedConfig),
    JSON.stringify(
      getPrerenderManifest(resolvedConfig, isrPages),
      undefined,
      2,
    ),
  );
}

async function generateRoutesManifest(resolvedConfig: ResolvedConfig) {
  await fs.writeFile(
    getRoutesManifestDestination(resolvedConfig),
    JSON.stringify(getRoutesManifest(resolvedConfig), undefined, 2),
  );
}

async function generateFunctionsManifest(
  resolvedConfig: ResolvedConfig,
  fnManifests: FunctionsManifest['pages'],
) {
  await fs.writeFile(
    getFunctionsManifestDestination(resolvedConfig),
    JSON.stringify(getFunctionsManifest(fnManifests), undefined, 2),
  );
}

function allPlugins(): Plugin[] {
  return [vercelPlugin()];
}

export { allPlugins as default };