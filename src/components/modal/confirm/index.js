import { View, Text } from 'react-native'
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { closeModal } from '../../../reducers/modalReducer';
import { Button } from '../../button';
import { iconManager } from '../iconManager';
import { styles } from '../info/styles';

const ConfirmModal = () => {
    const { t } = useTranslation();
    const dispatch = useDispatch()
    const { content, head, icon, callback, cancelCallback, buttonText, cancelButtonText } = useSelector(state => state.modalController);
    const callbackHandler = () => {
        dispatch(closeModal())
        callback()
    }
    const cancelHandler = () => {
        dispatch(closeModal());
        cancelCallback && cancelCallback();
    }
    return (
        <View style={styles.container}>
            {iconManager(icon)}
            <Text style={styles.head} numberOfLines={2}>{head}</Text>
            <Text style={styles.content}>{content}</Text>
            <View style={styles.buttonGroup}>
                <Button variant='outlined' text={cancelButtonText ? cancelButtonText : t('common.cancel')} callback={cancelHandler} />
                <View style={styles.gap}></View>
                <Button text={buttonText ? buttonText : t('common.ok')} callback={callbackHandler} />
            </View>
        </View >
    )
}

export default ConfirmModal
