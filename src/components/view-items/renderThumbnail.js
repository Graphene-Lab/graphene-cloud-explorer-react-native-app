import { Image, View } from 'react-native'
import FileIcon from '../../assets/icons/viewer/file.svg';
import FolderIcon from '../../assets/icons/viewer/folder.svg';
import {
    Entypo,
    AntDesign,
    MaterialIcons,
    MaterialCommunityIcons,
    FontAwesome,
    SimpleLineIcons
} from "@expo/vector-icons";


const thumbnails = {
    folder: <FolderIcon />,
    other: <SimpleLineIcons name="question" size={20} color="#415EB6" />,
    document: <FileIcon />,
    video: <FontAwesome name="video-camera" size={20} color="#415EB6" />,
    audio: <MaterialIcons name="audiotrack" size={20} color="#415EB6" />,
    pdf: <AntDesign name="pdffile1" size={20} color="#415EB6" />,
    txt: <Entypo name="text" size={20} color="#415EB6" />,
    presentation: <MaterialCommunityIcons name="file-powerpoint-box" size={20} color="#415EB6" />,
    spreadsheet: <FontAwesome
        name="file-excel-o"
        size={20}
        color="#415EB6"
    />,
    archive: <FontAwesome name="file-archive-o" size={20} color="#415EB6" />,
    code: <FontAwesome name="code" size={20} color="#415EB6" />,
    image: <MaterialIcons name="image" size={20} color="#415EB6" />

}

export const renderThumbnail = (item, border) => {
    if (item.type !== 'image') {
        return thumbnails[item.type];
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
        )
    }
    return (
        <View style={imageFrameStyle}>
            <Image
                source={{ uri: item.source }}
                resizeMode="cover"
                style={imageStyle}
            />
        </View>
    )
}


