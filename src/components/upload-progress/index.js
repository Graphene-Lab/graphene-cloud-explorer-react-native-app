import { useNavigation } from '@react-navigation/native';
import { View, Text, TouchableOpacity } from 'react-native'
import { useSelector } from 'react-redux';
import TransferIcon from '../../assets/icons/home/transfer.svg';
import { ProgressBar } from '../progressbar';
import { styles } from './styles'
import { bytesToSize, timeConvert } from '../../utils/essential-functions';

export const UploadProgress = () => {
    const { navigate } = useNavigation();
    const { totalMemory, usedMemory } = useSelector(state => state.profile);
    const { uploadQueue } = useSelector(state => state.newFileTransfer);
    const { remaining, current } = Object.values(uploadQueue)[0] ?? dataCase
    const partSize = Object.values(uploadQueue).reduce((accumulator, object) => accumulator + object.current, 0);
    const allSize = Object.values(uploadQueue).reduce((accumulator, object) => accumulator + object.size, 0);
    const remainingStorageText =
        totalMemory == -1
            ? 'Unlimited'
            : `${bytesToSize(totalMemory - current)} of ${bytesToSize(totalMemory + usedMemory)}`;

    return (
        <TouchableOpacity style={[styles.container, { display: Object.keys(uploadQueue).length !== 0 ? 'flex' : 'none' }]} onPress={() => navigate('UpdateScreen')}>
            <View style={styles.header}>
                <TransferIcon />
                <Text style={styles.headerText}> {Object.values(uploadQueue).length} file ({bytesToSize(partSize)} of {bytesToSize(allSize)})</Text>
            </View>
            <ProgressBar />
            <View style={styles.bottom}>
                <View style={styles.left}>
                    <Text style={styles.remaining}>Remaining storage</Text>
                    <Text style={styles.bottomText}>{remainingStorageText}</Text>
                </View>
                <View style={styles.right}>
                    <Text style={styles.remaining}>Remaining time</Text>
                    <Text style={styles.bottomText}>{timeConvert(remaining)}</Text>
                </View>
            </View>
        </TouchableOpacity>
    )
}

const dataCase = {
    remaining: 0,
    current: 0,
    size: 0,
}