import { View } from 'react-native';
import { indicatorStyles as styles } from './styles';

export const Indicator = ({ currentIndex, count }) => {
  return (
    <View style={styles.container}>
      {[...Array(count)].map((_, index) => {
        return (
          <View
            key={index}
            style={[
              styles.dot,
              { backgroundColor: index !== currentIndex ? '#D9D9D9' : '#415EB6' },
            ]}
          />
        );
      })}
    </View>
  );
};
