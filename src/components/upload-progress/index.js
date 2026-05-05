import { useNavigation } from '@react-navigation/native';
import { View, Text, TouchableOpacity } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useSelector } from 'react-redux';
import TransferIcon from '../../assets/icons/home/transfer.svg';
import { ProgressBar } from '../progressbar';
import { styles } from './styles'
import { bytesToSize, timeConvert } from '../../utils/essential-functions';

export const UploadProgress = () => {
    const { navigate } = useNavigation();
    const { t } = useTranslation();
    const { totalMemory, usedMemory } = useSelector(state => state.profile);
    const { uploadQueue } = useSelector(state => state.newFileTransfer);
    const { remaining, current } = Object.values(uploadQueue)[0] ?? dataCase
    const partSize = Object.values(uploadQueue).reduce((accumulator, object) => accumulator + object.current, 0);
    const allSize = Object.values(uploadQueue).reduce((accumulator, object) => accumulator + object.size, 0);
    const remainingStorageText =
        totalMemory == -1
            ? t('details.unlimited')
            : t('upload.storage_of', { available: bytesToSize(totalMemory - current), total: bytesToSize(totalMemory + usedMemory) });

    return (
        <TouchableOpacity style={[styles.container, { display: Object.keys(uploadQueue).length !== 0 ? 'flex' : 'none' }]} onPress={() => navigate('UpdateScreen')}>
            <View style={styles.header}>
                <TransferIcon />
                <Text style={styles.headerText}> {t('upload.files_count', { count: Object.values(uploadQueue).length, part: bytesToSize(partSize), all: bytesToSize(allSize) })}</Text>
            </View>
            <ProgressBar />
            <View style={styles.bottom}>
                <View style={styles.left}>
                    <Text style={styles.remaining}>{t('upload.remaining_storage')}</Text>
                    <Text style={styles.bottomText}>{remainingStorageText}</Text>
                </View>
                <View style={styles.right}>
                    <Text style={styles.remaining}>{t('upload.remaining_time')}</Text>
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