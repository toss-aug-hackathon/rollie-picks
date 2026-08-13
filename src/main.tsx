import ReactDOM from 'react-dom/client';
import { ColorSchemeArea } from '@toss/tds-mobile';
import { TDSMobileAITProvider } from '@toss/tds-mobile-ait';
import { App } from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <TDSMobileAITProvider brandPrimaryColor="#44374B">
    <ColorSchemeArea theme="light">
      <App />
    </ColorSchemeArea>
  </TDSMobileAITProvider>
);
