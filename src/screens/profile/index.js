import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { spacesCommands } from '../../constants';
import { Layout } from '../../layout';
import { dequeue } from '../../reducers/refreshQueueReducer';
import { setScreenBehavior } from '../../reducers/screenControllerReducer';
import { GetOccupiedSpace } from '../../utils/data-transmission-utils';
import { storageInfo } from '../../utils/essential-functions';
import { DetailsScreen } from '../details';
import { Button } from '../../components/button';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';

const ProfileScreen = ({ route, navigation }) => {
    const { connection } = useSelector(state => state.network);
    const { screensQueue } = useSelector(state => state.refreshReducer);
    const { zeroKnowledgeEnabled } = useSelector(state => state.userSecret);
    const dispatch = useDispatch();

    const getAll = () => {
        dispatch(setScreenBehavior({ routeName: 'ProfileScreen', loader: true, blocker: false }));
        const requests = [storageInfo()];
        if (!zeroKnowledgeEnabled) {
            requests.push(
                GetOccupiedSpace("", spacesCommands.document),
                GetOccupiedSpace("", spacesCommands.image),
                GetOccupiedSpace("", spacesCommands.video),
                GetOccupiedSpace("", spacesCommands.music),
                GetOccupiedSpace("", spacesCommands.other)
            );
        }
        Promise.all(requests).finally(() => {
            dispatch(setScreenBehavior({ routeName: 'ProfileScreen', loader: false, blocker: false }));
        });
    };

    useEffect(() => {
        const unsubscribe = navigation.addListener('focus', () => {
            if (screensQueue.includes(route.name) && connection) {
                getAll();
                dispatch(dequeue(route.name));
            }
        });
        return unsubscribe;
    }, [screensQueue, navigation, connection, route.name, zeroKnowledgeEnabled]);

    return (
        <Layout name={route.name}>
            {/* <View style={styles.buttonContainer}>
                <TouchableOpacity 
                    style={styles.button}
                    onPress={() => navigation.navigate('PaymentScreen')}
                >
                    <Text style={styles.buttonText}>Upgrade Storage Space</Text>
                </TouchableOpacity>
            </View> */}
            <DetailsScreen />
        </Layout>
    );
};

const styles = StyleSheet.create({
    
    button: {
        width: '100%',
        minHeight: 60,
        borderRadius: 8,
        backgroundColor: '#007AFF',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 15,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 1,
        },
        shadowOpacity: 0.2,
        shadowRadius: 1.41,
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600'
    }
});

export default ProfileScreen;