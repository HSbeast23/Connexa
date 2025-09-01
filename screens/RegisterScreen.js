import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { MaterialIcons } from '@expo/vector-icons';
import { registerUser, createUserProfile } from '../services/FireBase';
import { useFonts } from 'expo-font';
import PhoneInput from 'react-native-phone-number-input';

const RegisterScreen = ({ navigation }) => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Validation states
  const [usernameError, setUsernameError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');
  const [phoneNumberError, setPhoneNumberError] = useState('');

  const [fontsLoaded] = useFonts({
    'Poppins-Regular': require('../assets/fonts/Poppins-Regular.ttf'),
    'Poppins-Medium': require('../assets/fonts/Poppins-Medium.ttf'),
    'Poppins-SemiBold': require('../assets/fonts/Poppins-SemiBold.ttf'),
  });

  const validateInputs = () => {
    let isValid = true;

    // Username validation
    if (!username) {
      setUsernameError('Username is required');
      isValid = false;
    } else if (username.length < 3) {
      setUsernameError('Username must be at least 3 characters');
      isValid = false;
    } else {
      setUsernameError('');
    }

    // Email validation
    if (!email) {
      setEmailError('Email is required');
      isValid = false;
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      setEmailError('Email format is invalid');
      isValid = false;
    } else {
      setEmailError('');
    }

    // Password validation
    if (!password) {
      setPasswordError('Password is required');
      isValid = false;
    } else if (password.length < 6) {
      setPasswordError('Password must be at least 6 characters');
      isValid = false;
    } else {
      setPasswordError('');
    }

    // Confirm password validation
    if (!confirmPassword) {
      setConfirmPasswordError('Please confirm your password');
      isValid = false;
    } else if (password !== confirmPassword) {
      setConfirmPasswordError('Passwords do not match');
      isValid = false;
    } else {
      setConfirmPasswordError('');
    }

    // Phone number validation
    if (!phoneNumber) {
      setPhoneNumberError('Phone number is required');
      isValid = false;
    } else if (!/^\+?[1-9]\d{1,14}$/.test(phoneNumber)) {
      setPhoneNumberError('Phone number format is invalid');
      isValid = false;
    } else {
      setPhoneNumberError('');
    }

    return isValid;
  };

  const handleRegister = async () => {
    if (!validateInputs()) {
      return;
    }

    setLoading(true);

    const { user, error } = await registerUser(email, password);

    if (error) {
      setLoading(false);
      Alert.alert('Registration Error', error);
      return;
    }

    if (user) {
      // Create user profile in Firestore
      const userData = {
        username,
        email,
        phoneNumber,
        bio: '',
        avatarUrl: '',
      };

      const { success, error: profileError } = await createUserProfile(user.uid, userData);

      setLoading(false);

      if (profileError) {
        Alert.alert('Profile Creation Error', profileError);
      } else {
        // Navigate to ProfileScreen for additional setup
        navigation.reset({
          index: 0,
          routes: [{
            name: 'Profile',
            params: {
              isNewUser: true,
              displayName: username,
              email: email,
              phoneNumber: phoneNumber
            }
          }]
        });
      }
    }
  };

  if (!fontsLoaded) {
    return null;
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoid}
      >
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={styles.inner}>
            <View style={styles.headerContainer}>
              <Text style={styles.headerTitle}>Create Account</Text>
              <Text style={styles.headerSubtitle}>Join Connexa today</Text>
            </View>

            <View style={styles.formContainer}>
              {/* Username Input */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Username</Text>
                <View style={[styles.inputContainer, usernameError ? styles.inputError : null]}>
                  <MaterialIcons name="person" size={20} color="#666" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Enter your username"
                    placeholderTextColor="#999"
                    value={username}
                    onChangeText={(text) => {
                      setUsername(text);
                      if (usernameError) setUsernameError('');
                    }}
                  />
                </View>
                {usernameError ? <Text style={styles.errorText}>{usernameError}</Text> : null}
              </View>

              {/* Email Input */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Email</Text>
                <View style={[styles.inputContainer, emailError ? styles.inputError : null]}>
                  <MaterialIcons name="email" size={20} color="#666" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Enter your email"
                    placeholderTextColor="#999"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    value={email}
                    onChangeText={(text) => {
                      setEmail(text);
                      if (emailError) setEmailError('');
                    }}
                  />
                </View>
                {emailError ? <Text style={styles.errorText}>{emailError}</Text> : null}
              </View>

              {/* Password Input */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Password</Text>
                <View style={[styles.inputContainer, passwordError ? styles.inputError : null]}>
                  <MaterialIcons name="lock" size={20} color="#666" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Enter your password"
                    placeholderTextColor="#999"
                    secureTextEntry={!showPassword}
                    value={password}
                    onChangeText={(text) => {
                      setPassword(text);
                      if (passwordError) setPasswordError('');
                    }}
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword(!showPassword)}
                    style={styles.eyeIcon}
                  >
                    <MaterialIcons
                      name={showPassword ? "visibility" : "visibility-off"}
                      size={20}
                      color="#666"
                    />
                  </TouchableOpacity>
                </View>
                {passwordError ? <Text style={styles.errorText}>{passwordError}</Text> : null}
              </View>

              {/* Confirm Password Input */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Re-type Password</Text>
                <View style={[styles.inputContainer, confirmPasswordError ? styles.inputError : null]}>
                  <MaterialIcons name="lock" size={20} color="#666" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Confirm your password"
                    placeholderTextColor="#999"
                    secureTextEntry={!showConfirmPassword}
                    value={confirmPassword}
                    onChangeText={(text) => {
                      setConfirmPassword(text);
                      if (confirmPasswordError) setConfirmPasswordError('');
                    }}
                  />
                  <TouchableOpacity
                    onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                    style={styles.eyeIcon}
                  >
                    <MaterialIcons
                      name={showConfirmPassword ? "visibility" : "visibility-off"}
                      size={20}
                      color="#666"
                    />
                  </TouchableOpacity>
                </View>
                {confirmPasswordError ? <Text style={styles.errorText}>{confirmPasswordError}</Text> : null}
              </View>

              {/* Phone Number Input */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Phone Number</Text>
                <PhoneInput
                  defaultValue={phoneNumber}
                  defaultCode="IN"
                  layout="first"
                  onChangeFormattedText={(text) => {
                    setPhoneNumber(text);
                    if (phoneNumberError) setPhoneNumberError('');
                  }}
                  containerStyle={[
                    styles.phoneInputContainer,
                    phoneNumberError ? { borderColor: '#ff3b30' } : null
                  ]}
                  textContainerStyle={styles.phoneTextContainer}
                  textInputStyle={styles.phoneTextInput}
                  codeTextStyle={styles.phoneCodeText}
                />
                {phoneNumberError ? <Text style={styles.errorText}>{phoneNumberError}</Text> : null}
              </View>

              <TouchableOpacity
                style={styles.registerButton}
                onPress={handleRegister}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.registerButtonText}>Register</Text>
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.footer}>
              <Text style={styles.footerText}>Already have an account? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                <Text style={styles.loginText}>Login</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#302b63',
  },
  headerContainer: {
    padding: 32,
    paddingBottom: 24,
    // backgroundColor: '#f8f9fa',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerTitle: {
    fontFamily: 'Poppins-Bold',
    fontSize: 28,
    color: '#ffffff',
    marginBottom: 12,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontFamily: 'Poppins-Regular',
    fontSize: 16,
    color: '#e0e0e0',
    lineHeight: 24,
  },
  keyboardAvoid: {
    flex: 1,
  },
  inner: {
    flex: 1,
    padding: 24,
  },
  formContainer: {
    marginTop: 16,
    marginBottom: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontFamily: 'Poppins-Medium',
    fontSize: 14,
    color: '#a5b4fc',
    marginBottom: 8,
    marginLeft: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 8,
    height: 56,
    shadowColor: 'rgba(0,0,0,0.2)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 2,
  },
  inputError: {
    borderColor: '#ef4444',
  },
  inputIcon: {
    paddingHorizontal: 12,
  },
  input: {
    flex: 1,
    fontFamily: 'Poppins-Medium',
    fontSize: 16,
    color: '#ffffff',
    paddingHorizontal: 8,
    height: '100%',
  },
  eyeIcon: {
    paddingHorizontal: 12,
  },
  errorText: {
    fontFamily: 'Poppins-Regular',
    fontSize: 12,
    color: '#ef4444',
    marginTop: 4,
    marginLeft: 4,
  },
  phoneInputContainer: {
    width: '100%',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    shadowColor: 'rgba(0,0,0,0.2)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 2,
    overflow: 'hidden',
  },
  phoneTextContainer: {
    backgroundColor: 'transparent',
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
    paddingVertical: 0,
    height: 52,
  },
  phoneTextInput: {
    fontFamily: 'Poppins-Medium',
    fontSize: 16,
    color: '#ffffff',
    height: '100%',
    backgroundColor: 'transparent',
    paddingLeft: 16,
  },
  phoneCodeText: {
    fontFamily: 'Poppins-Medium',
    fontSize: 16,
    color: '#ffffff',
    paddingLeft: 16,
  },
  registerButton: {
    backgroundColor: '#6366f1',
    borderRadius: 12,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
    marginTop: 8,
  },
  registerButtonText: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 16,
    color: '#fff',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 20,
  },
  footerText: {
    fontFamily: 'Poppins-Regular',
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.8)',
    marginRight: 4,
  },
  loginText: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 15,
    color: '#a5b4fc',
  },
  formContainer: {
    marginTop: 16,
    marginBottom: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
});

export default RegisterScreen;
