import { useState } from 'react'
import { View, Text, TextInput } from 'react-native'
import { useDispatch, useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { closeModal, setText, setWait } from '../../../reducers/modalReducer'
import { Button } from '../../button'
import { iconManager } from '../iconManager'
import { styles } from '../info/styles'

const InputModal = () => {

    const { t } = useTranslation();
    const dispatch = useDispatch()
    const { content, head, icon, callback, cancelCallback, wait, cancelButtonText } = useSelector(state => state.modalController);
    const [data, setData] = useState(content)
    const callbackHandler = () => {
        dispatch(setText(data))
        dispatch(setWait(true))
        callback()
    }
    const cancelHandler = () => {
        dispatch(closeModal())
        cancelCallback && cancelCallback()
    }
    return (
        <View style={styles.container}>
            {icon && iconManager(icon)}
            <Text style={styles.head}>{head}</Text>
            <TextInput
                autoCapitalize="none"
                style={styles.input}
                onChangeText={setData}
                value={data}
            />
            <View style={styles.buttonGroup}>
                <Button variant='outlined' text={cancelButtonText ? cancelButtonText : t('common.cancel')} callback={cancelHandler} />
                <View style={styles.gap}></View>
                <Button text={t('common.ok')} callback={callbackHandler} disabled={content == data || wait} wait={wait} />
            </View>
        </View >
    )
}

export default InputModal
