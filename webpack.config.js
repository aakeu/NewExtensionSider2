import path from 'path';
import { fileURLToPath } from 'url';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import CopyWebpackPlugin from 'copy-webpack-plugin';
import Dotenv from 'dotenv-webpack';
import { CleanWebpackPlugin } from 'clean-webpack-plugin';
import webpack from 'webpack';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default {
  entry: {
    background: path.join(__dirname, 'src', 'background', 'background.js'),
    sidebar: path.join(__dirname, 'src', 'sidebar', 'index.tsx'),
    popup: path.join(__dirname, 'src', 'popup', 'popup.jsx'),
    settings: path.join(__dirname, 'src', 'settings', 'settings.jsx'),
    recorder: path.join(__dirname, 'src', 'recorder', 'recorder.js'),
  },
  output: {
    path: path.join(__dirname, 'dist'),
    filename: '[name].js',
  },
  resolve: {
    extensions: ['.js', '.jsx', '.ts', '.tsx'],
    modules: [path.resolve(__dirname, 'src'), 'node_modules'],
  },
  optimization: {
    splitChunks: {
      chunks: 'all',
      minSize: 20000,
      maxAsyncRequests: 10,
      maxInitialRequests: 5,
      cacheGroups: {
        vendors: {
          test: /[\\/]node_modules[\\/]/,
          priority: -10,
          reuseExistingChunk: true,
        },
        default: {
          minChunks: 2,
          priority: -20,
          reuseExistingChunk: true,
        },
      },
    },
    minimize: true,
  },
  watch: true,
  devtool: false,
  module: {
    rules: [
      {
        test: /\.(ts|tsx)$/,
        exclude: /node_modules/,
        use: 'ts-loader',
      },
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        use: 'babel-loader',
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
      {
        test: /\.(png|jpg|jpeg|gif|svg)$/,
        use: [
          {
            loader: 'file-loader',
            options: {
              name: '[name].[ext]',
              outputPath: 'images',
              publicPath: 'images',
            },
          },
        ],
      },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: path.join(__dirname, 'src', 'sidebar', 'sidebar.html'),
      filename: 'sidebar.html',
      chunks: ['sidebar'],
    }),
    new HtmlWebpackPlugin({
      template: path.join(__dirname, 'src', 'popup', 'popup.html'),
      filename: 'popup.html',
      chunks: ['popup'],
    }),
    new HtmlWebpackPlugin({
      template: path.join(__dirname, 'src', 'settings', 'settings.html'),
      filename: 'settings.html',
      chunks: ['settings'],
    }),
    new HtmlWebpackPlugin({
      template: path.join(__dirname, 'src', 'recorder', 'recorder.html'),
      filename: 'recorder.html',
      chunks: ['recorder'],
    }),
    new Dotenv(),
    new webpack.DefinePlugin({
      'process.env.REACT_APP_ENCRYPT_KEY': JSON.stringify(process.env.REACT_APP_ENCRYPT_KEY || '4768d3891045a169b545701a8b703aeb8121b1c7e32bbcde7c7464c97f7d16dc'),
      'process.env.REACT_APP_IV': JSON.stringify(process.env.REACT_APP_IV || '5d30ac18e5f91d58d63ba85a5a1d6315'),
    }),
    new CopyWebpackPlugin({
      patterns: [
        { from: 'src/assets/icons', to: 'icons' },
        { from: 'src/assets/images', to: 'images' },
        { from: 'manifest.json', to: 'manifest.json' },
        { from: 'src/sidebar/sidebar.css', to: 'sidebar.css' },
        { from: 'src/popup/popup.css', to: 'popup.css' },
        { from: 'src/settings/settings.css', to: 'settings.css' },
        { from: 'src/meeting/overlay.css', to: 'overlay.css' },
        {
          from: 'src/styles/effects.css',
          to: 'style_modules/effects.css',
        },
        { from: 'src/content', to: 'content' },
        { from: 'src/background', to: 'background' },
        { from: 'src/meeting', to: 'meeting' },
        { from: 'src/recorder', to: 'recorder' },
      ],
    }),
    new CleanWebpackPlugin(),
  ],
  mode: process.env.NODE_ENV || 'development',
};