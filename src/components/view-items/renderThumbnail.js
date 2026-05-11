import { Image, View } from 'react-native';
import FileIcon from '../../assets/icons/viewer/file.svg';
import FolderIcon from '../../assets/icons/viewer/folder.svg';
import {
    Entypo,
    MaterialIcons,
    MaterialCommunityIcons,
    FontAwesome,
    SimpleLineIcons
} from "@expo/vector-icons";

const COLOR = '#415EB6';

const buildThumbnails = (size) => ({
    folder: <FolderIcon width={size} height={size} />,
    other: <SimpleLineIcons name="question" size={size} color={COLOR} />,
    document: <FileIcon width={size} height={size} />,
    video: <FontAwesome name="video-camera" size={size} color={COLOR} />,
    audio: <MaterialIcons name="audiotrack" size={size} color={COLOR} />,
    pdf: <MaterialCommunityIcons name="file-pdf-box" size={size} color={COLOR} />,
    txt: <Entypo name="text" size={size} color={COLOR} />,
    presentation: <MaterialCommunityIcons name="file-powerpoint-box" size={size} color={COLOR} />,
    spreadsheet: <FontAwesome name="file-excel-o" size={size} color={COLOR} />,
    archive: <FontAwesome name="file-archive-o" size={size} color={COLOR} />,
    code: <FontAwesome name="code" size={size} color={COLOR} />,
    image: <MaterialIcons name="image" size={size} color={COLOR} />,
});

/**
 * @param {object} item  - file item from Redux state
 * @param {number} border - border radius for image previews
 * @param {number} [iconSize=20] - size for vector icons (not images)
 */
export const renderThumbnail = (item, border, iconSize = 20) => {
    const thumbnails = buildThumbnails(iconSize);

    if (item.type !== 'image') {
        return thumbnails[item.type] ?? thumbnails.other;
    }

    const imageFrameStyle = {
        width: '100%',
        height: '100%',
        borderRadius: border,
        overflow: 'hidden',
    };
    const imageStyle = {
        width: '100%',
        height: '100%',
    };

    const hasLocalPreview = item.local && item.source;
    const hasRemotePreview = !item.local && item.source && item.allowRemotePreview;
    if (!hasLocalPreview && !hasRemotePreview) {
        return thumbnails.image;
    }

    if (hasLocalPreview) {
        return (
            <View style={imageFrameStyle}>
                <Image
                    source={{ uri: `file://${item.source}` }}
                    resizeMode="cover"
                    style={imageStyle}
                />
            </View>
        );
    }
    return (
        <View style={imageFrameStyle}>
            <Image
                source={{ uri: item.source }}
                resizeMode="cover"
                style={imageStyle}
            />
        </View>
    );
};
