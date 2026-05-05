import { View, Text, } from 'react-native'
import { useTranslation } from 'react-i18next'
import PieChart from 'react-native-pie-chart';
import { useSelector } from 'react-redux';
import { sliceColor, } from '../../constants';
import { bytesToSize, } from '../../utils/essential-functions';
import { Progress } from './progress';
import { styles } from './styles';

export const DetailsScreen = () => {
    const { t } = useTranslation();
    const widthAndHeight = 150;
    const MIN_USED_VISUAL_RATIO = 0.01;
    const { totalMemory, usedMemory } = useSelector(state => state.profile);
    const { zeroKnowledgeEnabled } = useSelector(state => state.userSecret);
    const { images, video, documents, music, other } = useSelector(state => state.fileOccupiedInfo);
    const parsedUsedMemory = Number(usedMemory) || 0;
    const parsedAvailableMemory = Number(totalMemory) || 0;
    const isUnlimitedStorage = totalMemory == -1 || usedMemory == -1;
    const finiteTotalCapacity = Math.max(parsedUsedMemory + parsedAvailableMemory, 0);
    const categorySeries = [images, video, documents, music, other].map(
        (value, index) => ({
            value: (parseInt(value, 10) || 0) + 1,
            color: sliceColor[index] || '#567DF4'
        })
    );
    const visualUsedStorage = isUnlimitedStorage
        ? Math.max(parsedUsedMemory, 1)
        : Math.max(
            parsedUsedMemory,
            Math.ceil(finiteTotalCapacity * MIN_USED_VISUAL_RATIO),
            1
        );
    const storageSeries = isUnlimitedStorage
        ? [{ value: visualUsedStorage, color: '#E5E7EB' }]
        : [
            { value: visualUsedStorage, color: '#E5E7EB' },
            { value: Math.max(finiteTotalCapacity, 1), color: '#567DF4' }
        ];
    const totalLabel =
        totalMemory == -1 || usedMemory == -1
            ? t('details.unlimited')
            : totalMemory
                ? bytesToSize(totalMemory + usedMemory)
                : '...';


    return (
        <View
            style={styles.container}
        >
            <PieChart
                style={styles.chart}
                widthAndHeight={widthAndHeight}
                series={zeroKnowledgeEnabled ? storageSeries : categorySeries}
                doughnut={true}
                coverRadius={0.62}
                coverFill={"#fff"}
            />
            <View style={styles.view}>
                <View style={styles.textView}>
                    <View>
                        <Text style={styles.textHead}>{t('details.available')}</Text>
                        <Text style={styles.textMain}>{totalMemory ? bytesToSize(totalMemory) : '...'}</Text>
                    </View>
                    <View>
                        <Text style={[styles.textHead, { textAlign: 'right' }]}>{t('details.total')}</Text>
                        <Text style={styles.textMain}>{totalLabel}</Text>
                    </View>
                </View>
                {zeroKnowledgeEnabled && (

                    <>
                        <View style={styles.storageLegend}>
                            <View style={styles.storageLegendItem}>
                                <View style={[styles.dot, { backgroundColor: '#E5E7EB' }]} />
                                <Text style={styles.storageLegendLabel}>{t('details.used')}</Text>
                            </View>
                            {!isUnlimitedStorage && (
                                <View style={styles.storageLegendItem}>
                                    <View style={[styles.dot, { backgroundColor: '#567DF4' }]} />
                                    <Text style={styles.storageLegendLabel}>{t('details.available')}</Text>
                                </View>
                            )}
                        </View>
                        <Text style={styles.zeroKnowledgeInfo}>
                            {t('details.zero_knowledge_info')}
                        </Text>

                    </>
                )}
                {!zeroKnowledgeEnabled && (
                    <View style={styles.progressView}>
                        <View style={styles.progressContiner}>
                            <View style={styles.forDot}>
                                <View style={[styles.dot, { backgroundColor: "#FFBB34" }]} />
                                <View style={styles.textBox}>
                                    <Text style={styles.porgressText}>{t('details.images')}</Text>
                                    <Text style={styles.content}>{bytesToSize(images)}</Text>
                                </View>

                            </View>
                            <Progress percent={((images / usedMemory) * 100)} color={'#FFBB34'} />
                        </View>
                        <View style={styles.progressContiner}>
                            <View style={styles.forDot}>
                                <View style={[styles.dot, { backgroundColor: "#39C0B8" }]} />
                                <View style={styles.textBox}>
                                    <Text style={styles.porgressText}>{t('details.video')}</Text>
                                    <Text style={styles.content}>{bytesToSize(video)}</Text>
                                </View>

                            </View>
                            <Progress percent={((video / usedMemory) * 100)} color={'#39C0B8'} />
                        </View>
                        <View style={styles.progressContiner}>
                            <View style={styles.forDot}>
                                <View style={[styles.dot, { backgroundColor: "#567DF4" }]} />
                                <View style={styles.textBox}>
                                    <Text style={styles.porgressText}>{t('details.documents')}</Text>
                                    <Text style={styles.content}>{bytesToSize(documents)}</Text>
                                </View>

                            </View>
                            <Progress percent={((documents / usedMemory) * 100)} color={'#567DF4'} />
                        </View>
                        <View style={styles.progressContiner}>
                            <View style={styles.forDot}>
                                <View style={[styles.dot, { backgroundColor: "#FF842A" }]} />
                                <View style={styles.textBox}>
                                    <Text style={styles.porgressText}>{t('details.music')}</Text>
                                    <Text style={styles.content}>{bytesToSize(music)}</Text>
                                </View>

                            </View>
                            <Progress percent={((music / usedMemory) * 100)} color={'#FF842A'} />
                        </View>
                        <View style={styles.progressContiner}>
                            <View style={styles.forDot}>
                                <View style={[styles.dot, { backgroundColor: "#6C56F4" }]} />
                                <View style={styles.textBox}>
                                    <Text style={styles.porgressText}>{t('details.other')}</Text>
                                    <Text style={styles.content}>{bytesToSize(other)}</Text>
                                </View>

                            </View>
                            <Progress percent={((other / usedMemory) * 100)} color={'#6C56F4'} />
                        </View>
                    </View>
                )}
            </View>
        </View>
    )
}
