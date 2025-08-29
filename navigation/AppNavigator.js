import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

// Import screens
import SplashScreen from '../screens/SplashScreen';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import HomeScreen from '../screens/HomeScreen';
import ProfileScreen from '../screens/ProfileScreen';
import ChatScreen from '../screens/ChatScreen';

// Create stack navigator
const Stack = createNativeStackNavigator();

const AppNavigator = () => {
  return (
    <Stack.Navigator 
      initialRouteName="Splash"
      screenOptions={{
        headerShown: false,
        animation: 'fade',
        contentStyle: { backgroundColor: '#fff' },
      }}
    >
      {/* Splash Screen - Shows first, handles initial navigation */}
      <Stack.Screen 
        name="Splash" 
        component={SplashScreen} 
      />
      
      {/* Auth Screens - No header shown */}
      <Stack.Screen 
        name="Login" 
        component={LoginScreen} 
        options={{
          animationTypeForReplace: 'pop',
          gestureEnabled: false,
        }}
      />
      
      <Stack.Screen 
        name="Register" 
        component={RegisterScreen} 
        options={{
          animation: 'slide_from_right',
        }}
      />
      
      {/* Main App Screens */}
      <Stack.Screen 
        name="Home" 
        component={HomeScreen} 
        options={{
          gestureEnabled: false,
        }}
      />
      
      <Stack.Screen 
        name="Profile" 
        component={ProfileScreen} 
        options={{
          animation: 'slide_from_right',
          gestureEnabled: true,
          headerShown: true,
          title: 'Your Profile',
          headerStyle: {
            backgroundColor: '#fff',
            elevation: 0,
            shadowOpacity: 0,
          },
          headerTintColor: '#000',
          headerTitleStyle: {
            fontFamily: 'Poppins-SemiBold',
            fontSize: 18,
          },
        }}
      />
      
      {/* Chat Screen */}
      <Stack.Screen 
        name="Chat" 
        component={ChatScreen} 
        options={{
          animation: 'slide_from_right',
          gestureEnabled: true,
          headerShown: true,
          headerBackTitle: 'Back',
          headerStyle: {
            elevation: 0,
            shadowOpacity: 0,
          },
          headerTitleStyle: {
            fontFamily: 'Poppins-SemiBold',
            fontSize: 18,
          },
        }}
      />
    </Stack.Navigator>
  );
};

export default AppNavigator;