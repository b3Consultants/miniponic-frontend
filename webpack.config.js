const webpack = require('webpack')
const path = require('path')
const CopyWebpackPlugin = require('copy-webpack-plugin')

const prod = process.argv.indexOf('-p') !== -1

module.exports = {
  entry: path.join(__dirname, 'src/index.js'),
  devtool: 'cheap-module-eval-source-map',
  output: {
    filename: 'bundle.js',
    path: path.join(__dirname, 'public'),
    publicPath: '/',
    sourceMapFilename: '[name].js.map'
  },
  module: {
    rules: [
      {
        test: /\.jsx?/i,
        loader: 'babel-loader',
        exclude: /node_modules/
      },
      {
        test: /\.css$/,
        exclude: /node_modules/,
        use: [
          'style-loader',
          'css-loader',
          'postcss-loader'
        ]
      },
      {
        test: /\.(png|jpg)$/,
        loader: 'url-loader?limit=8192'
      },
      {
        test: /\.woff(2)?(\?v=[0-9]\.[0-9]\.[0-9])?$/,
        loader: 'url-loader?limit=10000&mimetype=application/font-woff'
      },
      {
        test: /\.(ttf|eot|svg)(\?v=[0-9]\.[0-9]\.[0-9])?$/,
        loader: 'file-loader'
      }
    ]
  },
  plugins: [
    new CopyWebpackPlugin([{
      from: path.join(__dirname, 'src', 'vendor', 'ccs.beat.detection.js'),
      to: path.join(__dirname, 'public', 'beat.js')
    }]),
    new webpack.DefinePlugin({
      __DEV__: !prod
    }),
    new webpack.LoaderOptionsPlugin({
      debug: true
    }),
    new webpack.HotModuleReplacementPlugin()
  ],
  devServer: {
    historyApiFallback: {
      index: '/'
    },
    // outputPath: path.join(__dirname, 'public'),
    host: '0.0.0.0',
    port: 8080
  }
}
