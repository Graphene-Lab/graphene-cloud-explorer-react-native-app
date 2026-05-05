import React, { useState } from 'react';
import { View, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button } from '../../components/button';
import { Alert } from 'react-native';
import { useStripe } from '@stripe/stripe-react-native';
import { Layout } from '../../layout';
import { useSelector } from 'react-redux';
import { paymentApiClient } from '../../utils/apiClient';
import { ROUTES } from '../../navigation/types';
import { reportCrash } from '../../utils/crashlytics-utils';

export default function PaymentScreen ({ route, navigation }) {
    const { t } = useTranslation();

    const PLANS = {
        STANDARD: {
            name: t('payment.standard_plan'),
            price: t('payment.price_month', { price: '$1' }),
            features: [
                t('payment.storage_100gb'),
            ]
        },
        PREMIUM: {
            name: t('payment.premium_plan'),
            price: t('payment.price_month', { price: '$2' }),
            features: [
                t('payment.storage_300gb'),
            ]
        }
    };
    const { initPaymentSheet, presentPaymentSheet } = useStripe();
    const [selectedPlan, setSelectedPlan] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [clientSecrets, setClientSecrets] = useState({
        STANDARD: null,
        PREMIUM: null
    });

    const { loader, blocker } = useSelector(
        (state) => state.screenController[route.name] || { loader: false, blocker: false }
    );

    const initializePaymentSheet = async (clientSecret) => {
        const { error } = await initPaymentSheet({
            paymentIntentClientSecret: clientSecret,
            merchantDisplayName: 'Graphene Cloud',
        });
        
        if (error) {
            reportCrash(new Error(`Payment sheet init failed: ${error.message || 'unknown error'}`), {
                screen: 'PaymentScreen',
                flow: 'initializePaymentSheet',
            });
            Alert.alert(t('payment.error'), t('payment.init_failed'));
        }
    };

    const fetchPaymentIntent = async (planName) => {
        if (clientSecrets[planName]) {
            await initializePaymentSheet(clientSecrets[planName]);
            return;
        }

        setIsLoading(true);
        try {
            const response = await paymentApiClient.post('/payment/intent', {
                planName: planName
            });
            const { clientSecret } = response.data;
            
            setClientSecrets(prev => ({
                ...prev,
                [planName]: clientSecret
            }));
            
            await initializePaymentSheet(clientSecret);
        } catch (error) {
            reportCrash(error, {
                screen: 'PaymentScreen',
                flow: 'fetchPaymentIntent',
                planName,
            });
            Alert.alert(t('payment.error'), t('payment.initiate_failed'));
        } finally {
            setIsLoading(false);
        }
    };

    const handlePlanSelection = (planName) => {
        setSelectedPlan(planName);
        fetchPaymentIntent(planName);
    };

    const openPaymentSheet = async () => {
        try {
            const { error } = await presentPaymentSheet();
            if (error) {
                reportCrash(new Error(`Payment failed: ${error.message || 'unknown error'}`), {
                    screen: 'PaymentScreen',
                    flow: 'openPaymentSheet',
                    planName: selectedPlan,
                });
                Alert.alert(`${t('payment.error')}: ${error.message}`);
                setClientSecrets(prev => ({
                    ...prev,
                    [selectedPlan]: null
                }));
            } else {
                Alert.alert(
                    t('payment.success'),
                    t('payment.activated'),
                    [
                        {
                            text: t('payment.ok'),
                            onPress: () => {
                                setClientSecrets({
                                    STANDARD: null,
                                    PREMIUM: null
                                });
                                navigation.navigate(ROUTES.TAB_NAVIGATOR);
                            }
                        }
                    ]
                );
            }
        } catch (error) {
            reportCrash(error, {
                screen: 'PaymentScreen',
                flow: 'openPaymentSheetException',
                planName: selectedPlan,
            });
            Alert.alert(t('payment.error'), t('payment.present_failed'));
        }
    };

    const getButtonText = () => {
        if (isLoading) return t('payment.please_wait');
        if (!selectedPlan) return t('payment.select_plan');
        return t('payment.subscribe_now');
    };

    const PlanCard = ({ plan, planKey }) => (
        <TouchableOpacity
            style={[
                styles.planCard,
                selectedPlan === planKey && styles.selectedPlan
            ]}
            onPress={() => handlePlanSelection(planKey)}
        >
            <Text style={styles.planName}>{plan.name}</Text>
            <Text style={styles.planPrice}>{plan.price}</Text>
            <View style={styles.featuresContainer}>
                {plan.features.map((feature, index) => (
                    <Text key={index} style={styles.feature}>• {feature}</Text>
                ))}
            </View>
        </TouchableOpacity>
    );

    return (
        <Layout name={route.name}>
            <View style={styles.container}>
                <Text style={styles.header}>{t('payment.choose_plan')}</Text>
                <PlanCard plan={PLANS.STANDARD} planKey="STANDARD" />
                <PlanCard plan={PLANS.PREMIUM} planKey="PREMIUM" />
                <View style={styles.buttonContainer}>
                    <Button 
                        text={getButtonText()}
                        callback={openPaymentSheet}
                        disabled={!clientSecrets[selectedPlan] || !selectedPlan || isLoading}
                        loading={isLoading}
                    />
                </View>
            </View>
        </Layout>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingHorizontal: 20,
        paddingVertical: 20,
        backgroundColor: '#fff'
    },
    header: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 20,
        textAlign: 'center'
    },
    planCard: {
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 8,
        padding: 16,
        marginBottom: 16,
        backgroundColor: '#f8f8f8'
    },
    selectedPlan: {
        borderColor: '#007AFF',
        backgroundColor: '#F0F8FF'
    },
    planName: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 8
    },
    planPrice: {
        fontSize: 18,
        color: '#007AFF',
        marginBottom: 12
    },
    featuresContainer: {
        marginTop: 8
    },
    feature: {
        fontSize: 14,
        marginBottom: 4,
        color: '#666'
    },
    buttonContainer: {
        width: '100%',
        height: 50,
        marginTop: 20
    }
});
