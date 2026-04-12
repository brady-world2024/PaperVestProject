import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import { StyleSheet, Text, View } from 'react-native';
import {
  loginFormSchema,
  type LoginFormValues,
} from '@papervest/validation';

import { AppButton } from '../../components/common/AppButton';
import { BrandLogo } from '../../components/common/BrandLogo';
import { InlineNotice } from '../../components/feedback/InlineNotice';
import { AppTextField } from '../../components/form/AppTextField';
import { ScreenContainer } from '../../components/layout/ScreenContainer';
import { AuthStackParamList } from '../../navigation/RootNavigator';
import { getApiErrorMessage } from '../../services/api/client';
import { login } from '../../services/api/papervestApi';
import { useAuthStore } from '../../state/authStore';
import { appTheme } from '../../theme';
type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

export function LoginScreen({ navigation }: Props) {
  const completeAuth = useAuthStore((state) => state.completeAuth);
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const loginMutation = useMutation({
    mutationFn: login,
    onSuccess: async (response) => {
      await completeAuth(response);
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    await loginMutation.mutateAsync({
      ...values,
      deviceName: 'PaperVest Mobile',
    });
  });

  return (
    <ScreenContainer contentStyle={styles.content}>
      <View style={styles.header}>
        <BrandLogo size={116} />
        <Text style={styles.title}>Welcome back</Text>
        <Text style={styles.subtitle}>Pick up where your watchlist and virtual portfolio left off.</Text>
      </View>

      {loginMutation.isError ? (
        <InlineNotice
          tone="error"
          message={getApiErrorMessage(loginMutation.error, 'Unable to log in')}
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

        <AppButton
          label="Log In"
          onPress={() => {
            void onSubmit();
          }}
          loading={loginMutation.isPending}
        />
        <AppButton
          label="Need an account?"
          onPress={() => navigation.navigate('Register')}
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
