import { useState } from 'react'
import { Keyboard, SafeAreaView, Text, TextInput, TouchableWithoutFeedback, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { Button } from '../../components/button'
import { PasswordModal } from '../../components/modal/password'
import { styles } from './styles'

const SingInViaText = () => {
    const { t } = useTranslation();

    const [barcode, setBarcode] = useState("");
    const [openModal, setOpenModal] = useState(false);

    const cancel = () => {
        setOpenModal(false)
    }


    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
            <TouchableWithoutFeedback style={{ flex: 1, borderWidth: 1 }} onPress={() => Keyboard.dismiss()}>
                {
                    openModal ?
                        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#00000053', paddingHorizontal: 20 }}>
                            <PasswordModal barcode={barcode} cancel={cancel} />
                        </View>
                        : <View style={styles.container}>
                            <Text style={styles.header}>{t('signin.login')}</Text>
                            <TextInput
                                numberOfLines={40}
                                multiline={true}
                                value={barcode}
                                onChangeText={setBarcode}
                                style={styles.input}
                                placeholder={t('signin.qr_placeholder')}
                            />
                            <View style={{ height: 50 }}>
                                <Button text={t('signin.login')} callback={() => setOpenModal(true)} disabled={barcode.length < 10} />
                            </View>
                        </View>
                }
            </TouchableWithoutFeedback>
        </SafeAreaView>
    )
}

export default SingInViaText
