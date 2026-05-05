import { useEffect, useState } from "react"
import { Dimensions, StyleSheet, Text, View } from "react-native"
import { useTranslation } from "react-i18next"
import { ActivityIndicator } from "react-native-paper"
import { getDir } from "../../../../utils/data-transmission-utils"
import { parseDateTime } from "../../../../utils/essential-functions"
import { Button } from "../../../button"
import { EmptyComponent } from "../../../list-empty"
import { ColumnForUpload } from "./cloumn"
import { Header } from "./header"
import { startMultiUpload } from "../../../../utils/settings-utils";
import { useContextApi } from "../../../../context/ContextApi";
import { FlatList } from "react-native-gesture-handler"
import { useSelector } from "react-redux"

export const CloudChild = () => {
    const { t } = useTranslation();
    const [content, setContent] = useState([])
    const { current } = useSelector(state => state.bottomSheetManager)
    const parentLocation = useSelector(store => store.files.location);
    const [location, setLocation] = useState(current == 'Cloud' ? parentLocation : '');
    const [wait, setWait] = useState(true);
    const { closeBottomSheet } = useContextApi();

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


    const folderParser = (file) => {
        const files = [];
        file?.filter((e) => {
            (e.Name !== '..' && e.IsDirectory) && files.push({
                title: e.Name,
                type: 'folder',
                name: e.Name?.split("/").reverse()[0],
                description: parseDateTime(e.Date),
            })
        })

        return files
    }

    const navigateForUpload = async (loc) => {
        setWait(true);
        const dir = await getDir(loc);
        const parsed = folderParser(dir);
        setContent(parsed)
        return setWait(false);
    }

    useEffect(() => {
        navigateForUpload(location);
    }, [location])

    return (
        <View style={styles.container}>
            {wait && <ActivityIndicator color="#415EB6" style={styles.indicators} />}
            <Text style={styles.text}>{t('options.save_upload_where')}</Text>
            <Header location={location} goBack={goBack} />

            <FlatList
                data={content}
                keyExtractor={(item) => item.title}
                contentContainerStyle={{ flexGrow: 1 }}
                ListEmptyComponent={<EmptyComponent notMargin />}
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => <ColumnForUpload item={item} locationEditor={locationEditor} location={location} />}
            />
            <View style={styles.button}>
                <Button text={t('options.choose')} callback={() => startMultiUpload(location, closeBottomSheet)} />
            </View>
        </View>
    )
}



const styles = StyleSheet.create({
    container: {
        height: ((Dimensions.get('window').height * 75) / 100) - 50,
    },
    button: {
        height: 50,
        marginTop: 5,
    },
    text: {
        color: '#87949E',
        fontSize: 18,
        textAlign: 'center',
        fontWeight: '400',
        marginBottom: 15,
    },
    indicators: {
        position: "absolute",
        backgroundColor: "#fff",
        height: "100%",
        width: "100%",
        zIndex: 100,
        alignSelf: "center",
    },
})