import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import { StyleSheet, Text, View } from 'react-native';
import {
  registerFormSchema,
  type RegisterFormValues,
} from '@papervest/validation';

import { AppButton } from '../../components/common/AppButton';
import { BrandLogo } from '../../components/common/BrandLogo';
import { InlineNotice } from '../../components/feedback/InlineNotice';
import { AppTextField } from '../../components/form/AppTextField';
import { ScreenContainer } from '../../components/layout/ScreenContainer';
import { AuthStackParamList } from '../../navigation/RootNavigator';
import { getApiErrorMessage } from '../../services/api/client';
import { register } from '../../services/api/papervestApi';
import { useAuthStore } from '../../state/authStore';
import { appTheme } from '../../theme';
type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>;

export function RegisterScreen({ navigation }: Props) {
  const completeAuth = useAuthStore((state) => state.completeAuth);
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerFormSchema),
    defaultValues: {
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  const registerMutation = useMutation({
    mutationFn: register,
    onSuccess: async (response) => {
      await completeAuth(response);
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    await registerMutation.mutateAsync({
      ...values,
      deviceName: 'PaperVest Mobile',
    });
  });

  return (
    <ScreenContainer contentStyle={styles.content}>
      <View style={styles.header}>
        <BrandLogo size={116} />
        <Text style={styles.title}>Create your paper account</Text>
        <Text style={styles.subtitle}>
          Start with virtual cash, then build a watchlist and practice trades with live-backed quotes.
        </Text>
      </View>

      {registerMutation.isError ? (
        <InlineNotice
          tone="error"
          message={getApiErrorMessage(registerMutation.error, 'Unable to create account')}
        />
      ) : null}

      <View style={styles.form}>
        <Controller
          control={control}
          name="email"
          render={({ field: { onChange, onBlur, value } }) => (
            <AppTextField
              label="Email"
              value={value}
              onBlur={onBlur}
              onChangeText={onChange}
              autoCapitalize="none"
              keyboardType="email-address"
              error={errors.email?.message}
              placeholder="you@example.com"
            />
          )}
        />
        <Controller
          control={control}
          name="password"
          render={({ field: { onChange, onBlur, value } }) => (
            <AppTextField
              label="Password"
              value={value}
              onBlur={onBlur}
              onChangeText={onChange}
              secureTextEntry
              autoCapitalize="none"
              error={errors.password?.message}
              placeholder="SecurePass1"
            />
          )}
        />
        <Controller
          control={control}
          name="confirmPassword"
          render={({ field: { onChange, onBlur, value } }) => (
            <AppTextField
              label="Confirm Password"
              value={value}
              onBlur={onBlur}
              onChangeText={onChange}
              secureTextEntry
              autoCapitalize="none"
              error={errors.confirmPassword?.message}
              placeholder="SecurePass1"
            />
          )}
        />

        <AppButton
          label="Create Account"
          onPress={() => {
            void onSubmit();
          }}
          loading={registerMutation.isPending}
        />
        <AppButton
          label="Already have an account?"
          onPress={() => navigation.navigate('Login')}
          variant="ghost"
        />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: appTheme.spacing.xl,
  },
  header: {
    alignItems: 'flex-start',
    gap: appTheme.spacing.xs,
  },
  title: {
    color: appTheme.colors.textPrimary,
    fontSize: appTheme.typography.title,
    fontWeight: '800',
  },
  subtitle: {
    color: appTheme.colors.textSecondary,
    fontSize: appTheme.typography.body,
    lineHeight: 22,
  },
  form: {
    gap: appTheme.spacing.md,
  },
});
