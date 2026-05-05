import { View, Text, Modal, TouchableOpacity, TouchableWithoutFeedback } from 'react-native'
import { useTranslation } from 'react-i18next'
import { lazy } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Suspense } from 'react';
import { closeModal } from '../../reducers/modalReducer';
import { styles } from './styles';
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
    const { visible, type, overlayColor } = useSelector(state => state.modalController);
    const dispatch = useDispatch();
    const modalTypeFinder = (type) => {
        if (type === 'input') return styles.forInput
        else if (type === 'progress') return styles.forProgress
        else if (type === 'prepare') return styles.prepare
        else return styles.box
    }

    const modalCloser = () => {
        if (type !== 'update') {
            return dispatch(closeModal());
        } else {
            return null
        }
    }

    return (
        <Suspense fallback={<Text>{t('common.loading')}</Text>}>
            <Modal
                animationType="fade"
                transparent
                visible={visible}
            >
                <View style={styles.safe}>
                    <TouchableOpacity style={[styles.container, overlayColor ? { backgroundColor: overlayColor } : null]} activeOpacity={1} onPressOut={modalCloser} >
                        <TouchableWithoutFeedback>
                            <View style={modalTypeFinder(type)}>
                                {modalTypes[type]}
                            </View>
                        </TouchableWithoutFeedback>
                    </TouchableOpacity>
                </View>
            </Modal >
        </Suspense>
    )
}
