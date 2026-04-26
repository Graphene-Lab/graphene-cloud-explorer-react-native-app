import { View, Text, TouchableOpacity, Keyboard, Pressable, InteractionManager } from 'react-native';
import { useDispatch } from 'react-redux';
import { useContextApi } from '../../../../context/ContextApi';
import { setFound, setLocation, setSelectedFile } from '../../../../reducers/fileReducer';
import { renderThumbnail } from '../../../view-items/renderThumbnail';
import { ColumnStyles as styles } from './styles';
import DotsIcon from '../../../../assets/icons/viewer/dotsvertical.svg';
import { navigationPush } from '../../../../navigation/root';
import { locationGenerator } from '../../../../utils/essential-functions';
import { renderScreen } from '../../../../reducers/screenRerenderReducer';


export const Cloumn = ({ item, locationEditor, search, close }) => {
    const { bottomSheetController } = useContextApi();
    const dispatch = useDispatch();

    const onPressHanle = (file) => {
        if (file.type === 'folder' && !search) locationEditor(item.title);
        else if (search && file.type) {
            Keyboard.dismiss();
            close();
            dispatch(setLocation(locationGenerator(file.path)));
            dispatch(setFound(file.name));
            dispatch(renderScreen(['CloudScreen']));
            navigationPush("Cloud");
        } else return null;

    };

    const settingOnPress = (file) => {
        dispatch(setSelectedFile(file));
        Keyboard.dismiss();
        InteractionManager.runAfterInteractions(() => bottomSheetController(2));
    };

    return (
        <TouchableOpacity
            onPress={() => onPressHanle(item)}
            style={[item.type === 'folder' ? styles.onSelect : styles.container]}
        // style={styles.container}
        >
            <View style={styles.left}>
                <View style={styles.thumbnail}>{renderThumbnail(item, 5)}</View>
                <View style={styles.textArea}>
                    <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
                    <Text style={styles.description}>{item.description}</Text>
                </View>
                {
                    search && <Pressable hitSlop={18} onPress={() => settingOnPress(item)} style={styles.setting}>
                        <DotsIcon />
                    </Pressable>
                }
            </View>
        </TouchableOpacity >
    );
};

