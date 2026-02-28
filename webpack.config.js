const path = require('path');
const TerserPlugin = require('terser-webpack-plugin');
const CopyPlugin = require('copy-webpack-plugin');
const { minify: minifyHtml } = require('html-minifier-terser');
const { minify: minifyJs } = require('terser');
const CleanCSS = require('clean-css');

module.exports = (env, argv) => {
  const isProduction = argv.mode === 'production';

  const terserPlugin = new TerserPlugin({
    terserOptions: {
      compress: {
        drop_console: false,
        drop_debugger: true,
        passes: 3,
        pure_funcs: isProduction ? ['console.debug', 'console.trace'] : [],
      },
      mangle: { toplevel: true },
      format: { comments: false },
    },
    extractComments: false,
  });

  const commonConfig = {
    mode: argv.mode || 'production',
    devtool: isProduction ? false : 'source-map',
    stats: 'minimal',
    resolve: {
      extensions: ['.ts', '.js'],
      alias: {
        '@': path.resolve(__dirname, 'src'),
      },
    },
    optimization: {
      minimize: isProduction,
      minimizer: [terserPlugin],
    },
  };

  // Main process
  const mainConfig = {
    ...commonConfig,
    target: 'electron-main',
    entry: './src/main.ts',
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: 'main.js',
    },
    module: {
      rules: [
        {
          test: /\.ts$/,
          use: {
            loader: 'ts-loader',
            options: { transpileOnly: true },
          },
          exclude: /node_modules/,
        },
      ],
    },
    externals: {
      'electron-updater': 'commonjs electron-updater',
    },
  };

  // Standalone EventKeyCapture bundle for web usage
  const eventKeyCaptureConfig = {
    ...commonConfig,
    target: 'web',
    entry: {
      'EventKeyCapture': './src/util/EventKeyCapture.ts',
    },
    output: {
      path: path.resolve(__dirname, 'dist/web/vendor'),
      filename: '[name].js',
      library: {
        name: 'EventKeyCapture',
        type: 'umd',
      },
      globalObject: 'this',
      clean: false,
    },
    module: {
      rules: [
        {
          test: /\.ts$/,
          use: {
            loader: 'ts-loader',
            options: { transpileOnly: true },
          },
          exclude: /node_modules/,
        },
      ],
    },
  };

  // Assets folder copy config
  const assetsConfig = {
    mode: argv.mode || 'production',
    entry: {},
    output: {
      path: path.resolve(__dirname, 'dist'),
    },
    plugins: [
      new CopyPlugin({
        patterns: [
          {
            from: 'assets',
            to: 'assets',
            noErrorOnMissing: true,
            globOptions: {
              ignore: ['**/dist/**'],
            },
          },
        ],
      }),
    ],
    stats: 'minimal',
  };

  // Web folder copy config
  const webConfig = {
    mode: argv.mode || 'production',
    entry: {},
    output: {
      path: path.resolve(__dirname, 'dist/web'),
    },
    plugins: [
      new CopyPlugin({
        patterns: [
          {
            from: 'web',
            to: '.',
            noErrorOnMissing: true,
            transform: isProduction
              ? async (content, absoluteFrom) => {
                const ext = path.extname(absoluteFrom).toLowerCase();
                const contentStr = content.toString();

                // Minify HTML
                if (ext === '.html' || ext === '.htm') {
                  return await minifyHtml(contentStr, {
                    collapseWhitespace: true,
                    removeComments: true,
                    removeRedundantAttributes: true,
                    removeScriptTypeAttributes: true,
                    removeStyleLinkTypeAttributes: true,
                    useShortDoctype: true,
                    minifyCSS: true,
                    minifyJS: true,
                  });
                }

                // Minify JS
                if (ext === '.js') {
                  const result = await minifyJs(contentStr, {
                    compress: {
                      drop_console: true,
                      drop_debugger: true,
                    },
                    mangle: true,
                    format: { comments: false },
                  });
                  return result.code || contentStr;
                }

                // Minify CSS
                if (ext === '.css') {
                  const result = new CleanCSS({
                    level: 2,
                  }).minify(contentStr);
                  return result.styles || contentStr;
                }

                // Return unchanged for other files
                return content;
              }
              : undefined,
          },
        ],
      }),
    ],
    stats: 'minimal',
  };

  return [mainConfig, assetsConfig, eventKeyCaptureConfig, webConfig];
};
