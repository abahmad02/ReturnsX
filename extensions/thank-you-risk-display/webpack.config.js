/**
 * Webpack Configuration for Performance Optimization
 * 
 * Optimizes bundle size and loading performance for the Shopify extension
 */

const path = require('path');

module.exports = {
  mode: 'production',
  entry: './src/Checkout.tsx',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].[contenthash].js',
    chunkFilename: '[name].[contenthash].chunk.js',
    clean: true,
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: [
          {
            loader: 'ts-loader',
            options: {
              transpileOnly: true,
              compilerOptions: {
                module: 'esnext',
                target: 'es2020',
              },
            },
          },
        ],
        exclude: /node_modules/,
      },
    ],
  },
  optimization: {
    splitChunks: {
      chunks: 'all',
      cacheGroups: {
        // Vendor chunk for external dependencies
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          chunks: 'all',
          priority: 10,
        },
        // Common chunk for shared code
        common: {
          name: 'common',
          minChunks: 2,
          chunks: 'all',
          priority: 5,
          reuseExistingChunk: true,
        },
        // Lazy components chunk
        lazy: {
          test: /LazyComponents/,
          name: 'lazy',
          chunks: 'all',
          priority: 8,
        },
        // Services chunk
        services: {
          test: /services/,
          name: 'services',
          chunks: 'all',
          priority: 7,
        },
      },
    },
    usedExports: true,
    sideEffects: false,
    minimize: true,
  },
  performance: {
    hints: 'warning',
    maxEntrypointSize: 250000, // 250KB
    maxAssetSize: 250000,
  },
  stats: {
    chunks: true,
    chunkModules: true,
    chunkOrigins: true,
    modules: false,
    reasons: true,
    usedExports: true,
  },
};