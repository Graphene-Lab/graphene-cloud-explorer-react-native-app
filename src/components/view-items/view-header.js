import { View, Text, Pressable, BackHandler } from 'react-native'
import { useTranslation } from 'react-i18next'
import { styles } from './styles'
import GroupIcon from '../../assets/icons/bottomSheet/group.svg'
import UnitIcon from '../../assets/icons/bottomSheet/unit.svg'
import FilterIcon from '../../assets/icons/home/ticket.svg';
import { Ionicons } from "@expo/vector-icons";
import { useDispatch, useSelector } from 'react-redux';
import { navigateToBack, parseFile } from '../../utils/essential-functions';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { setFilterResults, setFilterStatus, setMode } from '../../reducers/fileReducer';
import { PopUpModal } from '../pop-up/modal';
import { search } from '../../utils/data-transmission-utils';
import { Tag } from '../tag'
import { useEffect } from 'react';
import { microsoftFamily } from '../pop-up/styles';

const microsoftDocs = ["doc", "docx", "rtf", "xls", "xlsx", "ppt", "pptx", "mpp", "accdb", "pub"];

export const ViewItemHeader = ({ contentSetter, content }) => {
    const { t } = useTranslation();
    const { name } = useRoute();
    const navigation = useNavigation();
    const dispatch = useDispatch()
    const [filter, setFilter] = useState(false)
    const [tagsArray, setTagsArray] = useState([]);
    const { location, mode, filterResults } = useSelector(state => state.files);

    const goBack = () => {
        if (name === 'CloudScreen') {
            return navigateToBack(name)
                .then(content => content && contentSetter(content))
                .catch(() => null)
        }
        else return navigation.canGoBack();
    }

    const buckButton = () => {
        if (name == 'CloudScreen') {
            if (location !== "") {
                navigateToBack(name)
                    .then(content => content && contentSetter(content))
                    .catch(() => null)
                return true
            }
            else return false
        }
        else return false
    }

    useEffect(() => {
        const backHandler = BackHandler.addEventListener(
            "hardwareBackPress",
            buckButton
        );

        return () => backHandler.remove();
    },)

    const locationNameShorter = useCallback((locationName) => {
        const len = locationName?.length;
        if (len > 26) {
            let [currnet, last] = [locationName.split('/').slice(-1), locationName.split('/').reverse()[1]];
            return `.../${last}/${currnet}`
        }
        else if (!locationName.length && name === "CloudScreen") return t('header.your_files')
        else if (name === 'CloudScreen' && location?.length > 0) return locationName;
        else if (name === 'FavoriteScreen') return t('header.favorites')
        else if (name === 'MediaScreen') return t('header.media_files')
        else if (name === 'HomeScreen' && !tagsArray.length) return t('header.recent_files');
        else if (name === 'HomeScreen' && tagsArray.length >= 1) return t('header.search_tags');
    }, [tagsArray])

    const tagDataFromModal = (td, order) => {
        if (order === 'search' && !tagsArray.some(tgs => tgs['tagName'] === td.tagName)) {
            setTagsArray([...tagsArray, { ...td }])
            dispatch(setFilterStatus(true))
            // setBlocked(true)
            search("", `[^\s]+(.*?)\.(${td.tagName === 'docs' ? microsoftFamily : td.tagName})$`, 0, -1).then((result) => {
                dispatch(setFilterResults(filterResults?.length > 0 ? [...parseFile(result), ...filterResults] : parseFile(result)))
            });
        }

        if (order === 'remove') {
            setTagsArray(tagsArray.filter((t) => t.tagName !== td));
            if (td === 'docs') {
                removeForDocs(td);
                return
            }
            const removed = filterResults.filter(item => {
                const [endOf] = item.title.split('.').reverse()
                return endOf !== td
            })
            dispatch(setFilterResults(removed));
            tagsArray.length == 1 && dispatch(setFilterStatus(false))
        }
    }

    const removeForDocs = (td) => {
        const filter = filterResults.filter(item => {
            const [endOf] = item.title.split('.').reverse();
            return !microsoftDocs.includes(endOf)
        })
        dispatch(setFilterResults(filter));
        tagsArray.length == 1 && dispatch(setFilterStatus(false))
    }

    const headerOnPressHandler = () => {
        if (location && name == 'CloudScreen') {
            return goBack();
        } else return null;
    }


    return (
        <View style={styles.selector}>
            <View style={styles.pageTitleView}>
                <Pressable style={styles.pageTitle} onPress={headerOnPressHandler}>
                    {(location && name == 'CloudScreen') && <View style={styles.backIconView} >
                        <Ionicons name="chevron-back" size={20} color="#22215B" />
                    </View>
                    }
                    <Text style={styles.titleText} numberOfLines={1}>{locationNameShorter(location)}</Text>
                </Pressable>
                <View style={styles.selectorIconGroup}>
                    <PopUpModal
                        visibility={filter}
                        setTagsOpen={setFilter}
                        tagDataFromModal={tagDataFromModal}
                    />
                    {name === 'HomeScreen' && <Pressable hitSlop={10} onPress={() => setFilter(!filter)} style={{ marginRight: 9 }}>
                        <FilterIcon color={filter ? '#22215B' : '#B0C0D0'} />
                    </Pressable>}
                    <Pressable hitSlop={10} style={styles.touchableOpacityOne} onPress={() => !mode && dispatch(setMode(true))}>
                        <UnitIcon color={mode ? '#22215B' : '#B0C0D0'} />
                    </Pressable>
                    <Pressable hitSlop={10} onPress={() => mode && dispatch(setMode(false))} style={styles.touchableOpacityTwo}>
                        <GroupIcon color={mode ? '#B0C0D0' : '#22215B'} />
                    </Pressable>
                </View>
            </View>
            {tagsArray && (
                <Tag
                    tagsData={tagsArray}
                    removeSelectedTags={tagDataFromModal}
                />
            )}
        </View>
    )
}

