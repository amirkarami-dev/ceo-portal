import { MainMenu } from "@excalidraw/excalidraw";

/**
 * The board's menu, chosen item by item.
 *
 * Excalidraw's default menu ends with an «Excalidraw links» group — GitHub, X and Discord — which
 * belong to Excalidraw and not to this organisation's meeting room. There is no prop to hide them:
 * building the menu ourselves is the way they go away, and anything not listed here simply does not
 * render.
 *
 * <b>Returned as an ELEMENT, not wrapped in a component of ours.</b> Excalidraw finds this by
 * checking its children's TYPE for `MainMenu`, so `<WhiteboardMenu />` would hide it behind our own
 * type, Excalidraw would find no menu, and the default one — links and all — would come straight
 * back. That failure is silent, which is why it is written down here.
 *
 * `ToggleTheme` is left out on purpose too: the board already follows the app's light/dark through
 * the `theme` prop, and a second switch inside the canvas would let the two disagree with no way to
 * tell which is right.
 *
 * Every label here comes from Excalidraw's own Persian locale, which the Vite plugin in
 * `vite.config.ts` re-enables — see that file for why it was showing English.
 *
 * <b>`SearchMenu` is left out because it is the one item the locale cannot translate.</b> fa-IR is
 * 84% complete, and «Find on canvas» is in the missing 16%: the shipped Persian locale contains not
 * one occurrence of «جستجو», so that entry fell back to English and sat there as the only English
 * word in a Persian menu.
 *
 * <b>This hides the entry; it does NOT remove the feature.</b> Excalidraw binds the same panel to
 * `CtrlOrCmd+F` in its own keymap, which no prop reaches, so anyone pressing Ctrl+F still gets the
 * search panel — and that panel is English too («Find text on canvas…», «No matches found…»). The
 * choice was to hide it or to break it: hiding a menu entry leaves a working shortcut, while hiding
 * the panel would leave a shortcut that appears to do nothing, which is worse than an English label.
 */
export function whiteboardMenu() {
  return (
    <MainMenu>
      <MainMenu.DefaultItems.LoadScene />
      <MainMenu.DefaultItems.SaveToActiveFile />
      <MainMenu.DefaultItems.SaveAsImage />
      <MainMenu.DefaultItems.Help />
      <MainMenu.DefaultItems.ClearCanvas />
      <MainMenu.Separator />
      <MainMenu.DefaultItems.ChangeCanvasBackground />
    </MainMenu>
  );
}
