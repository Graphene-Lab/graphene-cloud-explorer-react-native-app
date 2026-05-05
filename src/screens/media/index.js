import { Layout } from '../../layout'
import { useTranslation } from 'react-i18next'
import { useState, useEffect } from 'react'
import ViewItems from '../../components/view-items'
import { getAllImages } from '../../utils/essential-functions'
import { useDispatch, useSelector } from 'react-redux'
import { globalStyles } from '../../constants/styles';
import FabIcon from '../../assets/icons/home/fab.svg';
import { useContextApi } from '../../context/ContextApi'
import { FAB } from 'react-native-paper'
import { dequeue, forceDequeue } from '../../reducers/refreshQueueReducer'
import { getCellularInfoMMKV } from '../../utils/mmkv'
import { openModal } from '../../reducers/modalReducer'

const MediaScreen = ({ route, navigation }) => {
    const { t } = useTranslation();

    const dispatch = useDispatch()
    const [content, setContent] = useState([]);
    const { screensQueue, forceQueue } = useSelector(state => state.refreshReducer);
    const { bottomSheetController } = useContextApi();
    const { connection, type } = useSelector(state => state.network);


    useEffect(() => {
        if (forceQueue.includes(route.name) && connection) {
            getAllImages()
                .then(content => content && setContent(content))
                .catch(() => null);
            dispatch(forceDequeue(route.name));
            return

        }

        const unsubscribe = navigation.addListener('focus', () => {
            if (screensQueue.includes(route.name) && connection) {
                getAllImages()
                    .then(content => content && setContent(content))
                    .catch(() => null);
                return dispatch(dequeue(route.name))
            }
        });

        return unsubscribe;
    }, [navigation, screensQueue, forceQueue])

    const reload = () => {
        connection === true &&
            getAllImages()
                .then(content => content && setContent(content))
                .catch(() => null);
    }


    const openFab = async () => {
        const isToggled = await getCellularInfoMMKV();
        if (type === 'wifi' || isToggled) return bottomSheetController(1);

        dispatch(openModal({
            content: t('cellular.off_desc'),
            head: t('cellular.head'),
            type: 'confirm',
            icon: 'ex',
            callback: () => bottomSheetController(1)
        }))

    }

    return (
        <Layout name={route.name} searchBar>
            <ViewItems
                content={content}
                setContent={setContent}
                reload={reload}
            />
            <FAB
                style={globalStyles.fab}
                mode="flat"
                icon={FabIcon}
                color={'#415EB6'}
                theme={{ myOwnProperty: true, colors: { accentColor: '#EEF2FE' } }}
                onPress={openFab}
            />
        </Layout>
    )
}

export default MediaScreen
