import React from 'react';
import { View, StyleSheet, Image, ScrollView, TouchableOpacity, Text } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { Button } from '../../components/button';
import { CustomText } from '../../components/text';
import { Layout } from '../../layout';

const QRSelectionScreen = () => {
  const { t } = useTranslation();
  const navigation = useNavigation();

  return (
    <Layout name="QR Selection">
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <Image 
          source={require('../../assets/images/qr_guide.png')} 
          style={styles.guideImage}
          resizeMode="contain"
          accessibilityLabel="Sample QR code"
        />
        
        <View style={styles.content}>
          <View style={styles.stepsContainer}>
            <View style={styles.stepItem}>
              <CustomText size={16} color="#22215B" custom={styles.stepText}>
                {t('qr_selection.step1')}
              </CustomText>
            </View>
            <View style={styles.stepItem}>
              <CustomText size={16} color="#22215B" custom={styles.stepText}>
                {t('qr_selection.step2')}
              </CustomText>
            </View>
            <View style={styles.stepItem}>
              <CustomText size={16} color="#22215B" custom={styles.stepText}>
                {t('qr_selection.step3')}
              </CustomText>
            </View>
          </View>

          <View style={styles.buttonGroup}>
            <Button 
              text={t('qr_selection.scan_button')} 
              callback={() => navigation.navigate('QRScreen')} 
            />
            
            <TouchableOpacity 
              onPress={() => navigation.navigate('SingInViaTextScreen')}
              style={styles.manualButton}
            >
              <Text style={styles.manualText}>
                {t('signin.enter_qr_manually')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </Layout>
  );
};

const styles = StyleSheet.create({
  scrollContainer: {
    flexGrow: 1,
    backgroundColor: '#fff',
    paddingBottom: 40
  },
  guideImage: {
    width: '100%',
    height: 250,
    backgroundColor: '#F5F7FB'
  },
  content: {
    paddingHorizontal: 25,
    paddingTop: 20
  },
  title: {
    fontWeight: '700',
    marginBottom: 20
  },
  stepsContainer: {
    marginBottom: 30
  },
  stepItem: {
    marginBottom: 15,
    paddingLeft: 5
  },
  stepText: {
    lineHeight: 22,
    textAlign: 'left'
  },
  buttonGroup: {
    marginTop: 10
  },
  manualButton: {
    marginTop: 20,
    alignItems: 'center'
  },
  manualText: {
    color: '#415EB6',
    fontSize: 16,
    fontWeight: '600'
  }
});

export default QRSelectionScreen;
