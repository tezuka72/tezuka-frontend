import { StyleSheet } from 'react-native';
import { Colors } from './colors';

export const CommonStyles = StyleSheet.create({
  // Containers
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  
  card: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
  },
  
  cardGlass: {
    backgroundColor: 'rgba(20, 20, 25, 0.8)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(42, 42, 53, 0.5)',
    padding: 16,
  },
  
  // Text
  textPrimary: {
    color: Colors.foreground,
    fontSize: 16,
  },
  
  textMuted: {
    color: Colors.muted,
    fontSize: 14,
  },
  
  textTitle: {
    color: Colors.foreground,
    fontSize: 20,
    fontWeight: 'bold',
  },
  
  // Buttons
  buttonPrimary: {
    backgroundColor: Colors.primary,
    borderRadius: 24,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  
  // Borders
  border: {
    borderWidth: 1,
    borderColor: Colors.border,
  },
  
  borderTop: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  
  borderBottom: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
});

// Shadow styles
export const Shadows = {
  small: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
  },
  
  medium: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  
  large: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  
  glow: {
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 10,
  },
};
