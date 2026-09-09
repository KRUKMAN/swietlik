module.exports = {
  extends: [
    'airbnb-base',
    'eslint:recommended',
    'plugin:vue/vue3-recommended',
  ],
  env: {
    browser: true,
    node: true,
    es2021: true,
  },
  parserOptions: {
    ecmaVersion: 'latest',
  },
  rules: {
    'vue/no-mutating-props': ['error', {
      shallowOnly: true,
    }],
    'no-plusplus': 'off',
    'no-underscore-dangle': 'off',
    'max-classes-per-file': 'off',
    'no-constructor-return': 'off',
    'no-param-reassign': 'off',
    'no-await-in-loop': 'off',
    camelcase: 'off',
    // Vite query-suffix imports (?worker/?raw) and three's extensionless ESM
    // subpaths are resolved by Vite, not by eslint-import-resolver-alias.
    'import/no-unresolved': ['error', {
      ignore: ['\\?worker$', '\\?raw$', '^three/examples/'],
    }],
  },
  settings: {
    // three's extensionless ESM subpaths crash eslint-module-utils' resolver
    // (Vite resolves them fine at build time) — treat them as always-resolved.
    'import/core-modules': [
      'three/examples/jsm/controls/TransformControls',
      'three/examples/jsm/loaders/GLTFLoader',
      'three/examples/jsm/loaders/DRACOLoader',
    ],
    'import/resolver': {
      alias: {
        map: [
          ['@', './src'],
          ['@root', './'],
        ],
        extensions: ['.js', '.vue'],
      },
      // Fallback for extensionless deep imports (three/examples/jsm/...).
      node: {
        extensions: ['.js', '.vue'],
      },
    },
  },
};
