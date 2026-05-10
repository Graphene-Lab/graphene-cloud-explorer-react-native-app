import { View, Text } from 'react-native'
import { styles } from './styles'
import { useSelector } from 'react-redux';

export const ProgressBar = () => {

    const file = useSelector(state => state.newFileTransfer.uploadQueue);
    const progress = Object.values(file)[0]?.progress ?? 0;

    return (
        <View style={styles.progressSection}>
            <View style={styles.progress}>
                <View style={[styles.blue, { width: `${progress}%` }]} />
                {progress <= 98 && <Text style={styles.text}>{progress}%</Text>}
                <View style={[styles.white, { width: `${100 - progress}%` }]} />
            </View>
        </View>
    )
}

