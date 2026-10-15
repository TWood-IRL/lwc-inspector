import { LightningElement } from 'lwc';
import { LABELS } from 'data/labelService';
import {
    applyTheme,
    nextTheme,
    resolveTheme,
    storeTheme,
    watchSystemTheme
} from 'my/theme';

export default class Header extends LightningElement {
    LABELS = LABELS;
    theme = 'light';
    unwatch;

    connectedCallback() {
        this.theme = resolveTheme();
        applyTheme(this.theme);
        this.unwatch = watchSystemTheme((theme) => {
            this.theme = theme;
            applyTheme(theme);
        });
    }

    disconnectedCallback() {
        if (this.unwatch) {
            this.unwatch();
            this.unwatch = undefined;
        }
    }

    get isDark() {
        return this.theme === 'dark';
    }

    get themeTitle() {
        return this.isDark ? 'Switch to light theme' : 'Switch to dark theme';
    }

    get ariaPressed() {
        return String(this.isDark);
    }

    handleThemeToggle() {
        this.theme = nextTheme(this.theme);
        storeTheme(this.theme);
        applyTheme(this.theme);
    }
}
