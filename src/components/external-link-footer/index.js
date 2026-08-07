import { Linking, Text, TouchableOpacity, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { styles } from './styles';

const GRAPHENE_CLOUD_URL = 'https://graphenelab.it/cloud';

export const ExternalLinkFooter = ({ prompt, linkText }) => {
  const insets = useSafeAreaInsets();

  const openGrapheneCloud = () => Linking.openURL(GRAPHENE_CLOUD_URL);

  return (
    <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, 16) }]}>
      {prompt ? <Text style={styles.prompt}>{prompt}</Text> : null}
      <TouchableOpacity
        accessibilityRole="link"
        accessibilityLabel={linkText}
        onPress={openGrapheneCloud}
        style={styles.link}
      >
        <Text style={styles.linkText}>{linkText}</Text>
        <Ionicons name="open-outline" size={18} color="#415EB6" />
      </TouchableOpacity>
    </View>
  );
};
