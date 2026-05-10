import { memo } from 'react';
import { Text, View, TouchableOpacity, Switch } from "react-native";
import { optionsStyles } from "./styles";
import { Menu, MenuOptions, MenuTrigger } from 'react-native-popup-menu';
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import { setOrder } from "../../reducers/fileReducer";

export const SortModal = memo(({ visibility, setVisibility }) => {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const orderState = useSelector(state => state.files.order) || { type: 'name', ascending: false };

    const updateSort = (type) => {
        dispatch(setOrder({ ...orderState, type }));
    };

    const toggleDirection = (isDescending) => {
        dispatch(setOrder({ ...orderState, ascending: !isDescending }));
    };

    const criteria = [
        { id: 'name', label: t('sort.name', { defaultValue: 'Name' }) },
        { id: 'date', label: t('sort.date', { defaultValue: 'Date' }) },
        { id: 'size', label: t('sort.size', { defaultValue: 'Size' }) },
    ];

    return (
        <Menu opened={visibility} onBackdropPress={() => setVisibility(false)}>
            <MenuTrigger />
            <MenuOptions customStyles={optionsStyles} optionsContainerStyle={{ marginLeft: 10, marginTop: 40, padding: 10, width: 200 }} >
                <View>
                    {criteria.map((c, index) => (
                        <TouchableOpacity 
                            key={c.id} 
                            style={{ 
                                padding: 10, 
                                backgroundColor: orderState.type === c.id ? '#F0F0F0' : 'transparent', 
                                borderRadius: 8,
                                marginBottom: index === criteria.length - 1 ? 0 : 10
                            }}
                            onPress={() => updateSort(c.id)}
                        >
                            <Text style={{ color: '#22215B', fontWeight: orderState.type === c.id ? 'bold' : 'normal' }}>
                                {c.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 10, borderTopWidth: 1, borderColor: '#eee', marginTop: 15 }}>
                        <Text style={{ color: '#22215B' }}>
                            {t('sort.descending', { defaultValue: 'Descending' })}
                        </Text>
                        <Switch 
                            value={!orderState.ascending}
                            onValueChange={toggleDirection}
                        />
                    </View>
                </View>
            </MenuOptions>
        </Menu>
    );
});
