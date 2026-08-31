import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Eye, EyeOff } from 'lucide-react-native';
import { apiRequest } from '../../services/api';
import { useAuthStore } from '../../store/auth';
import { socketService } from '../../services/socket';
import { Colors } from '../../theme/colors';

export default function RegisterScreen() {
  const router = useRouter();
  const setAuth = useAuthStore((state) => state.setAuth);

  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!displayName.trim()) {
      Alert.alert('Required', 'Please enter your Display Name');
      return;
    }
    if (!password.trim()) {
      Alert.alert('Required', 'Please enter a password');
      return;
    }

    setLoading(true);
    try {
      const data = await apiRequest('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          displayName: displayName.trim(),
          password: password.trim(),
          username: username.trim() || undefined,
        }),
      });

      // Save auth state
      setAuth(data.token, {
        id: data.user.id,
        virtualNumber: data.user.virtualNumber,
        username: data.user.username,
        displayName: data.user.displayName,
        avatarUrl: data.user.avatarUrl,
        statusBio: data.user.statusBio,
        showVirtualNumber: true,
        cloudSyncEnabled: false,
      });

      // Connect WebSocket
      socketService.connect(data.token);

      Alert.alert(
        'Success!',
        `Your virtual mobile number is ${data.user.virtualNumber}`,
        [
          {
            text: 'Start Chatting',
            onPress: () => router.replace('/(tabs)/chats'),
          },
        ]
      );
    } catch (err: any) {
      Alert.alert('Registration Failed', err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Create Account</Text>
        <Text style={styles.headerSubtitle}>
          An auto-assigned Virtual Mobile Number (+888) will be generated for you.
        </Text>
      </View>

      <View style={styles.form}>
        <Text style={styles.label}>Display Name *</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Rahul Kamti"
          placeholderTextColor="#8696A0"
          value={displayName}
          onChangeText={setDisplayName}
        />

        <Text style={styles.label}>Custom Username (Optional)</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. rahul_dev (without @)"
          placeholderTextColor="#8696A0"
          autoCapitalize="none"
          value={username}
          onChangeText={setUsername}
        />

        <Text style={styles.label}>Password *</Text>
        <View style={styles.passwordWrapper}>
          <TextInput
            style={[styles.input, { flex: 1, marginBottom: 0 }]}
            placeholder="Choose a secure password"
            placeholderTextColor="#8696A0"
            secureTextEntry={!showPassword}
            value={password}
            onChangeText={setPassword}
          />
          <TouchableOpacity
            onPress={() => setShowPassword((prev) => !prev)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={styles.eyeIcon}
          >
            {showPassword ? (
              <EyeOff size={20} color="#8696A0" />
            ) : (
              <Eye size={20} color="#8696A0" />
            )}
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleRegister}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.buttonText}>Register Account</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.footerLink}
          onPress={() => router.push('/(auth)/login')}
        >
          <Text style={styles.footerText}>
            Already have an account? <Text style={styles.footerHighlight}>Log In</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  header: {
    marginBottom: 36,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    color: Colors.light.textPrimary,
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    lineHeight: 20,
  },
  form: {
    width: '100%',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.textPrimary,
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: Colors.light.textPrimary,
    backgroundColor: '#F9FAFB',
  },
  button: {
    backgroundColor: Colors.light.primary,
    paddingVertical: 16,
    borderRadius: 28,
    alignItems: 'center',
    marginTop: 24,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  footerLink: {
    alignItems: 'center',
    marginTop: 16,
  },
  footerText: {
    fontSize: 14,
    color: Colors.light.textSecondary,
  },
  footerHighlight: {
    color: Colors.light.primary,
    fontWeight: 'bold',
  },
  passwordWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  eyeIcon: {
    position: 'absolute',
    right: 16,
  },
});
