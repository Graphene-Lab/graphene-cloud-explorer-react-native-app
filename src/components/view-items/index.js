import { RefreshControl, View } from 'react-native'
import { Column } from './column/column';
import { Row } from './row/row';
import { styles } from './styles';
import { ViewItemHeader } from './view-header';
import { EmptyComponent } from '../list-empty';
import { useDispatch, useSelector } from 'react-redux';
import { lazy, useState, useCallback, memo } from 'react';
import { setEmptySelectedFiles, setFound } from '../../reducers/fileReducer';
import { FlashList } from "@shopify/flash-list";
import { UploadProgress } from '../upload-progress';
const ResultsView = lazy(() => import('../tag/result-view'));


const ViewItems = ({ content, setContent, name, reload }) => {
  //mode true -> column, mode false -> row 
  const contentSetter = (con) => setContent(con);
  const { mode, filterStatus } = useSelector(state => state.files);
  const [refreshing, setRefreshing] = useState(false);
  const dispatch = useDispatch();
  const { selectedFiles, found } = useSelector(state => state.files);

  const onRefresh = useCallback(() => {
    reload()
    selectedFiles && dispatch(setEmptySelectedFiles([]));
    found && dispatch(setFound(null))
  }, []);

  return (
    <View style={styles.container}>
      <ViewItemHeader contentSetter={contentSetter} content={content?.length} />
      {name === 'CloudScreen' && <UploadProgress />}
      {(filterStatus && name === 'HomeScreen') ? <ResultsView /> : <FlashList
        data={content}
        keyExtractor={(item, index) => item.path + index}
        extraData={mode}
        horizontal={false}
        key={mode ? 1 : 3}
        estimatedItemSize={200}
        ListEmptyComponent={<EmptyComponent />}
        showsVerticalScrollIndicator={false}
        numColumns={mode ? 1 : 3}
        renderItem={({ item }) => mode ? <Column item={item} contentSetter={contentSetter} /> : <Row item={item} contentSetter={contentSetter} />}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
          />
        }
      />}

    </View>
  )
}


export default memo(ViewItems);
