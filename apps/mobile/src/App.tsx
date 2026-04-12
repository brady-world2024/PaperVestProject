import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { RootNavigator } from './navigation/RootNavigator';
import { AppProviders } from './providers/AppProviders';

export function PaperVestApp() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AppProviders>
        <RootNavigator />
      </AppProviders>
    </GestureHandlerRootView>
  );
}
