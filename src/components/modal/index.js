import { View, Text, Modal, TouchableOpacity, TouchableWithoutFeedback } from 'react-native'
import { useTranslation } from 'react-i18next'
import { lazy } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Suspense } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { closeModal } from '../../reducers/modalReducer';
import { styles } from './styles';
import BackIcon from '../../assets/icons/profile/back.svg'

const Info = lazy(() => import('./info'));
const PrepareModalView = lazy(() => import('./prepare'));
const Confirm = lazy(() => import('./confirm'));
const Input = lazy(() => import('./input'));
const Progress = lazy(() => import('./progress'));
const Update = lazy(() => import('./update'));

const modalTypes = {
    info: <Info />,
    input: <Input />,
    confirm: <Confirm />,
    progress: <Progress />,
    prepare: <PrepareModalView />,
    update: <Update />
}

export const ModalBox = () => {
    const { t } = useTranslation();
    const { visible, type, overlayColor, showBackButton, cancelCallback } = useSelector(state => state.modalController);
    const dispatch = useDispatch();
    
    const modalTypeFinder = (type) => {
        if (type === 'input') return styles.forInput
        else if (type === 'progress') return styles.forProgress
        else if (type === 'prepare') return styles.prepare
        else return styles.box
    }

    const modalCloser = () => {
        if (type !== 'update' && !showBackButton) {
            return dispatch(closeModal());
        } else {
            return null
        }
    }

    const backHandler = () => {
        dispatch(closeModal());
        cancelCallback && cancelCallback();
    }

    return (
        <Suspense fallback={<Text>{t('common.loading')}</Text>}>
            <Modal
                animationType="fade"
                transparent
                visible={visible}
            >
                <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
                    <View style={{ flex: 1 }}>
                        {showBackButton && (
                            <View style={{ 
                                flexDirection: 'row',
                                alignItems: 'center',
                                paddingHorizontal: 16,
                                height: 60,
                                backgroundColor: 'transparent',
                            }}>
                                <TouchableOpacity 
                                    onPress={backHandler} 
                                    style={{ 
                                        width: 24, 
                                        height: 24, 
                                        alignItems: 'center', 
                                        justifyContent: 'center' 
                                    }}
                                >
                                    <BackIcon />
                                </TouchableOpacity>
                            </View>
                        )}
                        <TouchableOpacity 
                            style={[styles.container, overlayColor ? { backgroundColor: overlayColor } : null]} 
                            activeOpacity={1} 
                            onPressOut={modalCloser} 
                        >
                            <TouchableWithoutFeedback>
                                <View style={modalTypeFinder(type)}>
                                    {modalTypes[type]}
                                </View>
                            </TouchableWithoutFeedback>
                        </TouchableOpacity>
                    </View>
                </SafeAreaView>
            </Modal >
        </Suspense>
    )
}
