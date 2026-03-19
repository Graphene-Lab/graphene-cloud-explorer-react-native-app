const { getDefaultConfig } = require("metro-config");
const path = require("path");

module.exports = (async () => {
    const {
        resolver: { sourceExts, assetExts },
    } = await getDefaultConfig();
    return {
        transformer: {
            babelTransformerPath: require.resolve(
                "react-native-svg-transformer"
            ),
        },
        resolver: {
            assetExts: assetExts.filter((ext) => ext !== "svg"),
            sourceExts: [...sourceExts, "svg"],
            extraNodeModules: {
                stream: require.resolve("stream-browserify"),
                buffer: require.resolve("buffer"),
                crypto: require.resolve("react-native-quick-crypto"),
            },
            nodeModulesPaths: [path.resolve(__dirname, "node_modules")],
        },
    };
})();
