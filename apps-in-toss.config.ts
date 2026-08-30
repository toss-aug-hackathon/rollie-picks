import { defineConfig } from '@apps-in-toss/web-framework/config';

export default defineConfig({
  appName: 'degul-pick',
  brand: {
    primaryColor: '#44374B',
  },
  webView: {
    bounces: false,
    pullToRefreshEnabled: false,
    overScrollMode: 'never',
    allowsBackForwardNavigationGestures: false,
  },
  permissions: [],
  webBundleDir: 'dist',
});
