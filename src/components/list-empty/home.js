import { View, Text, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import FolderIcon from '../../assets/icons/noContent/cloud.svg'

export const EmptyComponentHome = () => {
    const { t } = useTranslation();
    return (
        <View style={styles.container}>
            <FolderIcon />
            <Text style={styles.text} > {t('common.no_files')}</Text>
        </View >
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
    },
    text: {
        color: '#B0C0D0',
        fontSize: 14,
        marginTop: 12,
        textAlign: 'center',
    }
})