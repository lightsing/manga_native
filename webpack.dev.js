const path = require('path');
const CopyPlugin = require("copy-webpack-plugin");
const HtmlWebpackPlugin = require("html-webpack-plugin");

module.exports = {
    mode: 'development',
    entry: './src/index.js',
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: 'bundle.js'
    },
    module: {
        rules: [
            {
                test: /\.css$/i,
                use: ["style-loader", "css-loader"],
            },
            {
                test: /\.(svg|png|jpe?g|gif|cur)$/i,
                use: ["file-loader"],
            },
            {
                test: /\.(woff2?)$/i,
                use: ["file-loader"],
            },
        ],
    },
    resolve: {
        fallback: {
            "buffer": false,
            "crypto": false,
            "fs": false,
            "path": false,
            "stream": false,
        }
    },
    plugins: [
        new CopyPlugin({
            patterns: [
                { from: 'img', to: path.resolve(__dirname, 'dist', 'img') },
                { from: 'wasm', to: path.resolve(__dirname, 'dist', 'wasm') }
            ]
        }),
        new HtmlWebpackPlugin({
            inject: 'head',
            hash: true,
            template: './index.html',
            filename: 'index.html'
        }),
    ],
    devServer: {
        contentBase: path.join(__dirname, 'dist'),
        compress: true,
        port: 8000,
    }
};