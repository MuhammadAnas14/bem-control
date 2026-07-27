// Not using `import 'expo/AppEntry'` here: that file resolves its App import
// relatively (`../../App`), assuming Expo lives in *this* project's own
// node_modules two levels up. In this npm-workspaces monorepo, Expo is
// hoisted to the repo root instead, which breaks that assumption. Registering
// directly sidesteps it entirely.
import { registerRootComponent } from 'expo';
import App from './App';

registerRootComponent(App);
