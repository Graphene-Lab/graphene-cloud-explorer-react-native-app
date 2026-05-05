import { memo, useEffect, useState } from "react"
import { Text, View } from "react-native"
import { useTranslation } from "react-i18next"
import { ActivityIndicator } from "react-native-paper"
import { getDir } from "../../../../utils/data-transmission-utils"
import { parseFile } from "../../../../utils/essential-functions"
import { Button } from "../../../button"
import { EmptyComponent } from "../../../list-empty"
import { Header } from "./header"
import { useContextApi } from "../../../../context/ContextApi";
import { FlatList } from 'react-native-gesture-handler';
import { styles } from "./styles"
import { useDispatch, useSelector } from "react-redux"
import { Cloumn } from "./clumn"
import { Row } from "./row"
import { copySingle, moveSingle, multiplyCopy, multiplyMove } from "../../../../utils/settings-utils"
import { setEmptySelectedFiles } from "../../../../reducers/fileReducer"
import { NativeViewGestureHandler } from 'react-native-gesture-handler';

const CopyMove = () => {
    const { t } = useTranslation();
    const [content, setContent] = useState([])
    const [location, setLocation] = useState('');
    const [wait, setWait] = useState(true);
    const [disabled, setDisabled] = useState(false);
    const { closeBottomSheet } = useContextApi();
    const { selectedFile, selectedFiles, mode, order } = useSelector(state => state.files);
    const dispatch = useDispatch();

    const goBack = () => {
        if (location.length != 0) {
            const relocation = location.split('/')
            relocation.pop();
            setLocation(relocation.join('/'))
        }
    }

    const locationEditor = (str) => {
        if (location.length == 0) setLocation(str);
        else setLocation(location + '/' + str);
    }


    const navigate = async (loc) => {
        setWait(true);
        const dir = await getDir(loc);
        const parsed = parseFile(dir);
        setContent(parsed)
        return setWait(false);
    }

    const cancelHandle = () => {
        dispatch(setEmptySelectedFiles())
        closeBottomSheet()
        setLocation('');
    }

    useEffect(() => {
        navigate(location);
        return () => false
    }, [location])

    return (
        <NativeViewGestureHandler disallowInterruption={true}>

            <View style={styles.container}>
                {wait && <ActivityIndicator color="#415EB6" style={styles.indicators} />}
                <Text style={styles.text} >{order == 1 ? t('common.copy_file') : t('common.move_file')}</Text>
                <Text style={styles.title} numberOfLines={2}>{selectedFiles?.map((file, i) => (i + 1) + ') ' + file.name + ' ')}</Text>
                <Header location={location} goBack={goBack} />
                <FlatList
                    data={content}
                    horizontal={false}
                    key={mode ? 1 : 3}
                    numColumns={mode ? 1 : 3}
                    keyExtractor={(item) => item.title}
                    contentContainerStyle={{ flexGrow: 1 }}
                    ListEmptyComponent={<EmptyComponent notMargin />}
                    showsVerticalScrollIndicator={false}
                    renderItem={({ item }) => mode ? <Cloumn item={item} locationEditor={locationEditor} /> : <Row item={item} locationEditor={locationEditor} />}
                />
                <View style={styles.button}>
                    <Button text={t('common.cancel')} variant='outlined' callback={cancelHandle} />
                    <View style={styles.gap} />

                    {selectedFiles?.length ?
                        <Button text={order == 1 ? t('common.copy') : t('common.move')} callback={() => order == 1 ? multiplyCopy(location, setDisabled, closeBottomSheet, setLocation) : multiplyMove(location, setDisabled, closeBottomSheet, setLocation)} disabled={disabled} wait={disabled} />
                        : <Button text={order == 1 ? t('common.copy') : t('common.move')} callback={() => order == 1 ? copySingle(location, setDisabled, closeBottomSheet, setLocation) : moveSingle(location, setDisabled, closeBottomSheet, setLocation)} disabled={disabled} wait={disabled} />
                    }
                </View>
            </View>
        </NativeViewGestureHandler>
    )
}





export const CopyMoveComponent = memo(CopyMove);