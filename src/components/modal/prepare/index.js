import { View, Text } from 'react-native'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator } from 'react-native-paper'
import { styles } from './styles'

const PrepareModalView = () => {
    const { t } = useTranslation();
    return (
        <View style={styles.container}>
            <ActivityIndicator size={34} color="#415EB6" style={styles.indicator} />
            <Text style={styles.text}>{t('upload.preparing')}</Text>
        </View>
    )
}

export default PrepareModalView

