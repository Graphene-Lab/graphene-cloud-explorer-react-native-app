import { FAB } from 'react-native-paper'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import ViewItems from '../../components/view-items'
import { Layout } from '../../layout'
import { setFavoritesContent } from '../../reducers/fileReducer'
import { getFavorites } from '../../utils/essential-functions'
import { globalStyles } from '../../constants/styles';
import FabIcon from '../../assets/icons/home/fab.svg';
import { useContextApi } from '../../context/ContextApi'
import { useEffect } from 'react'
import { dequeue, forceDequeue } from '../../reducers/refreshQueueReducer'
import { getCellularInfoMMKV } from '../../utils/mmkv'
import { openModal } from '../../reducers/modalReducer'


const FavoriteScreen = ({ route, navigation }) => {
    const { t } = useTranslation();

    const dispatch = useDispatch()
    const { favoritesContent } = useSelector(state => state.files)
    const { bottomSheetController } = useContextApi();
    const { connection, type } = useSelector(state => state.network);
    const { screensQueue, forceQueue } = useSelector(state => state.refreshReducer);
    const favoriteContentDispatcher = (con) => dispatch(setFavoritesContent(con))


    const reload = () => {
        if (connection) {
            getFavorites()
                .then(content => content && dispatch(setFavoritesContent(content)))
                .catch(() => null);
        }
    }

    useEffect(() => {
        if (forceQueue.includes(route.name) && connection) {
            getFavorites()
                .then(content => content && favoriteContentDispatcher(content))
                .catch(() => null);
            dispatch(forceDequeue(route.name));
            return
        }

        const unsubscribe = navigation.addListener('focus', () => {
            if (screensQueue.includes(route.name) && connection) {
                getFavorites()
                    .then(content => content && favoriteContentDispatcher(content))
                    .catch(() => null);
                return dispatch(dequeue(route.name))
            }
        });

        return unsubscribe;
    }, [navigation, screensQueue, forceQueue])

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
                content={favoritesContent}
                setContent={favoriteContentDispatcher}
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

export default FavoriteScreen

