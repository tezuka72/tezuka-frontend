import { View, Text, Image, TouchableOpacity, Linking, StyleSheet } from 'react-native';

export default function AdCard({ ad }) {
  const handlePress = () => {
    if (ad && ad.link_url) {
      Linking.openURL(ad.link_url);
    }
  };

  if (!ad) return null;

  return (
    <TouchableOpacity style={styles.container} onPress={handlePress}>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>広告</Text>
      </View>
      
      {ad.image_url && (
        <Image 
          source={{ uri: ad.image_url }} 
          style={styles.image}
          resizeMode="cover"
        />
      )}
      
      <View style={styles.content}>
        <Text style={styles.title}>{ad.title}</Text>
        {ad.description && (
          <Text style={styles.description} numberOfLines={2}>
            {ad.description}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginVertical: 8,
    marginHorizontal: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  badge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    zIndex: 1,
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  image: {
    width: '100%',
    height: 180,
    borderRadius: 8,
    marginBottom: 12,
    backgroundColor: '#f5f5f5',
  },
  content: {
    paddingHorizontal: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
    color: '#1a1a1a',
  },
  description: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
});
