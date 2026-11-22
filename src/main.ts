import './styles.css';
import { showFatal, startApp } from './app.ts';

document.documentElement.lang = 'de';
// startApp faengt seine Fehler selbst ab; dies ist nur das letzte Netz gegen eine leere Seite
startApp().catch(showFatal);
