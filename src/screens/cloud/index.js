import { Layout } from '../../layout'
import { useTranslation } from 'react-i18next'
import { navigateToFolder } from '../../utils/essential-functions'
import { useEffect } from 'react'
import ViewItems from '../../components/view-items'
import { useDispatch, useSelector } from 'react-redux'
import { setData } from '../../reducers/testReducer'
import { FAB } from 'react-native-paper'
import { globalStyles } from '../../constants/styles';
import FabIcon from '../../assets/icons/home/fab.svg';
import { useContextApi } from '../../context/ContextApi'
import { dequeue, forceDequeue } from '../../reducers/refreshQueueReducer'
import { getCellularInfoMMKV } from '../../utils/mmkv'
import { openModal } from '../../reducers/modalReducer'

const CloudScreen = ({ route, navigation }) => {
    const { t } = useTranslation()
    const dispatch = useDispatch()
    const { cloud } = useSelector(state => state.test);
    const { location } = useSelector(state => state.files);
    const { bottomSheetController } = useContextApi();
    const { connection, type } = useSelector(state => state.network);
    const { screensQueue, forceQueue } = useSelector(state => state.refreshReducer);
    const setContent = (content) => dispatch(setData(content))


    useEffect(() => {
        if (forceQueue.includes(route.name) && connection) {
            navigateToFolder(location, route.name)
                .then((content) => content && setContent(content))
                .catch(() => null)
            dispatch(forceDequeue(route.name));
            return
        }
        const unsubscribe = navigation.addListener('focus', () => {
            if (screensQueue.includes(route.name) && connection) {
                navigateToFolder(location, route.name)
                    .then((content) => content && setContent(content))
                    .catch(() => null)
                return dispatch(dequeue(route.name))
            }
        });
        return unsubscribe;
    }, [navigation, screensQueue, forceQueue])



    const reloader = () => {
        if (connection) {
            navigateToFolder(location, route.name)
                .then((content) => content && setContent(content))
                .catch(() => null);
        }
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
                content={cloud}
                setContent={setContent}
                name={route.name}
                reload={reloader}
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

export default CloudScreen
