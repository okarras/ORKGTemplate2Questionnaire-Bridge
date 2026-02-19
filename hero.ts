import { heroui } from "@heroui/theme";
import { empireThemeLight, empireThemeDark } from "./config/empire-theme";

export default heroui({
  themes: {
    light: {
      extend: "light",
      layout: empireThemeLight.layout,
      colors: empireThemeLight.colors,
    },
    dark: {
      extend: "dark",
      layout: empireThemeDark.layout,
      colors: empireThemeDark.colors,
    },
  },
  defaultTheme: "light",
});
