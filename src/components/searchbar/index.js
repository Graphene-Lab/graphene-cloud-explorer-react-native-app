import { View, TextInput, Text, ScrollView, Keyboard, Pressable } from 'react-native'
import SearchIcon from '../../assets/icons/search.svg'
import { AntDesign } from "@expo/vector-icons";
import { memo, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { styles } from './styles';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    Easing,
} from 'react-native-reanimated';
import { search } from '../../utils/data-transmission-utils';
import { parseFile } from '../../utils/essential-functions';
import { Cloumn } from '../bottom-sheet/childs/copymove/clumn';
import { ActivityIndicator } from 'react-native-paper';
import { useCallback } from 'react';
import useDebounce from '../../hooks/useDebounce';

const SearchBar = ({ name }) => {
    const { t } = useTranslation();
    const [focused, setFocused] = useState(false);
    const [text, setText] = useState(null);
    const [context, setContext] = useState([]);
    const [wait, setWait] = useState(true);

    const height = useSharedValue(46);
    const padding = useSharedValue(0)
    const border = useSharedValue(0);
    const borderColor = useSharedValue('transparent');
    let hidden = 'none';
    const style = useAnimatedStyle(() => {
        return {
            height: withTiming(height.value, {
                duration: 500,
                easing: Easing.bezier(0.25, 0.1, 0.25, 1),
            }),
            padding: withTiming(padding.value, {
                duration: 500,
                easing: Easing.bezier(0.25, 0.1, 0.25, 1),
            }),
            borderWidth: withTiming(border.value, {
                duration: 500,
                easing: Easing.bezier(0.25, 0.1, 0.25, 1),
            }),
            borderColor: withTiming(borderColor.value, {
                duration: 500,
                easing: Easing.bezier(0.25, 0.1, 0.25, 1),
            }),
            borderRadius: 15,
            marginBottom: 20,
        };
    });

    const searchHandle = useCallback((input) => {
        if (input?.length) {
            padding.value = 12
            border.value = 1
            height.value = 360
            borderColor.value = '#B0C0D0'
            hidden = 'flex'
        } else {
            padding.value = 0
            border.value = 0
            height.value = 46
            borderColor.value = 'transparent'
            hidden = 'none'
            setText(null)
            setFocused(false)
        }
        setText(input)
        setWait(true)
    }, [])

    const closeView = () => {
        padding.value = 0
        border.value = 0
        height.value = 46
        borderColor.value = 'transparent'
        hidden = 'none'
        setText(null)
        setFocused(false)
        Keyboard.dismiss()
    }


    const debounceValue = useDebounce(text, 350);

    useEffect(() => {
        debounceValue && search('', `${debounceValue}`, 0, -1).then((response) => {
            setContext(parseFile(response))
            setWait(false)
        })
    }, [debounceValue])

    return (
        <Animated.View style={[style, !name && { marginTop: 20 }]}>
            <View style={[{ ...styles.container }]}>
                {text ?
                    <Pressable hitSlop={18} onPressOut={() => closeView()}>
                        <AntDesign name="close" size={17} color="#5D82F5" />
                    </Pressable>
                    : <SearchIcon />
                }

                <TextInput
                    onFocus={() => setFocused(true)}
                    onEndEditing={() => closeView()}
                    style={styles.input}
                    onBlur={() => closeView()}
                    onChangeText={(text) => searchHandle(text)}
                    placeholder={t('common.search_folder')}
                    placeholderTextColor='#B0C0D0'
                    value={text}
                    autoCapitalize={false}
                    autoCorrect={false}
                />
            </View>
            {
                text?.length ? <View style={{ flex: 1, }}>
                    {!wait ? <ScrollView keyboardShouldPersistTaps='always' showsVerticalScrollIndicator={false}>
                        {context.length > 1 ? context?.map((file, key) => <Cloumn key={key} item={file} search close={closeView} />) : <Text style={{ textAlign: 'center' }}>{t('common.no_search_results')}</Text>}
                    </ScrollView> : <ActivityIndicator color="#415EB6" style={styles.indicators} />
                    }
                </View> : null
            }

        </ Animated.View >
    )
}

export default memo(SearchBar);

