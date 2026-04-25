import { StatusBar, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { styles } from './styles'
import { ScreenHeader } from '../components/screen-header'
import SearchBar from '../components/searchbar'
import { MultipleSelection } from '../components/multiple-selection'
import { useSelector } from 'react-redux'
import { ActivityIndicator } from 'react-native-paper'
// import { useEffect } from 'react'
// import { BackHandler } from "react-native";

export const Layout = ({ children, name, searchBar }) => {
    const { selectedFiles } = useSelector(state => state.files);
    const { loader } = useSelector(state => state.screenController[name]);
    return (
        <View style={{ flex: 1, backgroundColor: '#fff' }}>
            <StatusBar barStyle='dark-content' />
            <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
                {selectedFiles.length ? <MultipleSelection router={name} /> : (name && <ScreenHeader name={name} />)}
                <View style={styles.container}>
                    {searchBar && <SearchBar name={name} />}
                    {
                        loader ? <ActivityIndicator size="large" color="#415EB6" style={styles.indicators} /> : children
                    }
                </View>
            </SafeAreaView>
        </View>
    )
}
