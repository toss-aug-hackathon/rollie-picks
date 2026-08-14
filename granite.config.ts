import { defineConfig } from '@apps-in-toss/web-framework/config';
import { networkInterfaces } from 'node:os';

function resolveDevHost() {
  const overrideHost = process.env.AIT_DEV_HOST?.trim();
  if (overrideHost) return overrideHost;

  const interfaces = networkInterfaces();
  const candidates = Object.entries(interfaces)
    .flatMap(([name, addresses]) =>
      (addresses ?? []).map((address) => ({ name, ...address }))
    )
    .filter(({ name, family, internal }) =>
      family === 'IPv4'
      && !internal
      && !/^(utun|awdl|llw|bridge|docker|vbox)/.test(name)
    );

  return candidates.find(({ name }) => name === 'en0')?.address
    ?? candidates.find(({ name }) => /^en\d+$/.test(name))?.address
    ?? candidates[0]?.address
    ?? '127.0.0.1';
}

const devHost = resolveDevHost();

export default defineConfig({
  appName: 'degul-pick',
  brand: {
    displayName: '데굴픽',
    primaryColor: '#44374B',
    icon: 'https://static.toss.im/appsintoss/70341/00681aaf-e2f3-4a09-9a01-ddebbdc4f76d.png',
  },
  webViewProps: {
    type: 'partner',
    bounces: false,
    pullToRefreshEnabled: false,
    overScrollMode: 'never',
    allowsBackForwardNavigationGestures: false,
  },
  web: {
    host: devHost,
    port: 5173,
    commands: {
      dev: 'npm run dev:web',
      build: 'vite build',
    },
  },
  permissions: [],
  outdir: 'dist',
});
